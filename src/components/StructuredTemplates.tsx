import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight, X, Loader2, ExternalLink, Eye, ThumbsUp, Play, Users, Lock,
  Sparkles, FileText, Clapperboard, Film, ArrowRight, ArrowLeft, RefreshCw,
  Copy, Video, Download, Mic, Volume2, Coins, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCharacter } from "@/contexts/CharacterContext";
import { useAuth } from "@/contexts/AuthContext";
import { useElevenLabsKey } from "@/hooks/useElevenLabsKey";

// ── WAV header builder for Gemini TTS PCM output ──
function createWavHeader(dataLength: number, sampleRate: number, channels: number, bitsPerSample: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeString = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bitsPerSample / 8, true);
  view.setUint16(32, channels * bitsPerSample / 8, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);
  return new Uint8Array(header);
}

// ── callChat — identical to DarkPipelinePage ──
async function callChat(message: string, token: string, characterBlock?: string | null, mode?: string): Promise<string> {
  const body: Record<string, unknown> = {
    messages: [{ role: "user", content: message }],
    mode: mode || "quick",
  };
  if (characterBlock) body.characterBlock = characterBlock;

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    }
  );

  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const reader = resp.body?.getReader();
    if (!reader) throw new Error("No response stream");
    const decoder = new TextDecoder();
    let fullText = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed.choices?.[0]?.delta?.content || "";
          fullText += text;
        } catch { /* skip non-JSON */ }
      }
    }
    return fullText.trim();
  }

  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data.reply || data.message || data.content || JSON.stringify(data);
}

// ── Types ──
type TemplateField = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "select";
  options?: string[];
};

type Template = {
  id: string;
  emoji: string;
  label: string;
  description: string;
  fields: TemplateField[];
  buildPrompt: (values: Record<string, string>) => string;
};

type Props = {
  onSend: (prompt: string) => void;
  disabled?: boolean;
};

type PipelineStep = "theme" | "title" | "config" | "script" | "character" | "narration" | "scenes" | "generate";

interface SceneData {
  index: number;
  prompt: string;
  description: string;
  videoUrl?: string;
  generating?: boolean;
  error?: string;
}

interface VPState {
  theme: string;
  titles: string[];
  selectedTitle: string;
  wordCount: number;
  sceneDuration: 8 | 15;
  sceneCount: number;
  aspectRatio: string;
  script: string;
  characterId: string | null;
  characterName: string | null;
  characterVoiceId: string | null;
  referenceImageUrl: string | null;
  scenes: SceneData[];
}

const VP_STEPS: { key: PipelineStep; label: string }[] = [
  { key: "theme",     label: "Tema" },
  { key: "title",     label: "Título" },
  { key: "config",    label: "Config" },
  { key: "script",    label: "Roteiro" },
  { key: "character", label: "Personagem" },
  { key: "narration", label: "Narração" },
  { key: "scenes",    label: "Cenas" },
  { key: "generate",  label: "Gerar" },
];

const TTS_VOICES = [
  { id: "Charon",  name: "Charon (Masculino, Sério)" },
  { id: "Gacrux",  name: "Gacrux (Masculino, Maduro)" },
  { id: "Algieba", name: "Algieba (Masculino, Suave)" },
  { id: "Puck",    name: "Puck (Masculino, Animado)" },
  { id: "Kore",    name: "Kore (Feminino, Firme)" },
  { id: "Zephyr",  name: "Zephyr (Feminino, Luminosa)" },
  { id: "Aoede",   name: "Aoede (Feminino, Leve)" },
];

const EMPTY_VP: VPState = {
  theme: "", titles: [], selectedTitle: "", wordCount: 500,
  sceneDuration: 8, sceneCount: 5, aspectRatio: "9:16",
  script: "", characterId: null, characterName: null,
  characterVoiceId: null, referenceImageUrl: null, scenes: [],
};

// ──────────────────────────────────────────────────────────
export function StructuredTemplates({ onSend, disabled }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { characters, activeCharacter, selectCharacter, identityBlock, wanT2VBlock, negativePrompt, activeCharacterName } = useCharacter();
  const { user, profile, refreshProfile } = useAuth();
  const elevenLabs = useElevenLabsKey();
  const isPT = i18n.language?.startsWith("pt");

  // ── Existing template state ──
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [viralVideos, setViralVideos] = useState<any[]>([]);
  const [viralLoading, setViralLoading] = useState(false);
  const [viralStep, setViralStep] = useState<"form" | "videos" | "selected">("form");
  const [selectedVideo, setSelectedVideo] = useState<any>(null);

  // ── Viral video pipeline state ──
  const [pipelineActive, setPipelineActive] = useState(false);
  const [vpStep, setVpStep] = useState<PipelineStep>("theme");
  const [vpLoading, setVpLoading] = useState(false);
  const [vp, setVp] = useState<VPState>(EMPTY_VP);

  // Voice state
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [narrationStorageUrl, setNarrationStorageUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [selectedTtsVoice, setSelectedTtsVoice] = useState(TTS_VOICES[0]);

  const useElevenLabsVoice = elevenLabs.hasKey && elevenLabs.hasVoice;

  // Re-select character after navigation (same pattern as DarkPipelinePage)
  useEffect(() => {
    if (pipelineActive && vp.characterId && characters.length > 0 && !activeCharacter) {
      const found = characters.find((c) => c.id === vp.characterId);
      if (found) selectCharacter(vp.characterId);
    }
  }, [pipelineActive, vp.characterId, characters, activeCharacter, selectCharacter]);

  const vpStepIndex = VP_STEPS.findIndex((s) => s.key === vpStep);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  };

  // ── Reset pipeline ──
  const handleNewPipeline = () => {
    setVp(EMPTY_VP);
    setVpStep("theme");
    setVoiceUrl(null);
    setVoiceError(null);
    setNarrationStorageUrl(null);
    setAudioDuration(null);
    toast.success("Novo projeto iniciado");
  };

  // ── STEP 1: Titles ──
  const handleGenerateTitles = async () => {
    if (!vp.theme.trim()) return;
    setVpLoading(true);
    try {
      const token = await getToken();
      const reply = await callChat(
        `Gera exatamente 5 títulos para vídeo sobre o tema: "${vp.theme}".

Regras:
- Títulos em Português
- Analisa o nicho do tema (religioso, mistério, educação, motivação, saúde, finanças, etc.) e adapta o estilo:
  · Se religioso/espiritual: títulos que evocam fé, proteção, milagre, transformação ("Oração Poderosa que...", "Deus Vai...")
  · Se dark/mistério: curiosidade profunda, suspense ("O que Realmente Aconteceu...", "A Verdade que Ninguém...")
  · Se educação/ciência: autoridade + revelação ("Os Cientistas Confirmaram...", "7 Descobertas que...")
  · Se motivação: transformação pessoal ("Como Eu Saí de...", "O Segredo dos...")
  · Se outro: adapta o melhor estilo de título viral para esse nicho
- Títulos com alto poder de clique mas sem mentir
- Cada título numa linha separada, numerado de 1 a 5
- Sem explicações adicionais, só os 5 títulos`,
        token
      );
      const titles = reply
        .split("\n")
        .map((l) => l.replace(/^\d+[\.\)\-]\s*/, "").trim())
        .filter((l) => l.length > 5)
        .slice(0, 5);
      setVp((p) => ({ ...p, titles }));
      setVpStep("title");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar títulos");
    } finally {
      setVpLoading(false);
    }
  };

  // ── STEP 4: Script ──
  const handleGenerateScript = async () => {
    if (!vp.selectedTitle) return;
    setVpLoading(true);
    try {
      const token = await getToken();
      const reply = await callChat(
        `Escreve um roteiro completo para vídeo com o título: "${vp.selectedTitle}".
Tema original: "${vp.theme}"

REGRAS DE ESTRUTURA:
- Exatamente ${vp.wordCount} palavras (pode variar ±10%)
- Em Português do Brasil
- Apenas o texto de narração puro — SEM indicações de cena, SEM timestamps, SEM [corte], SEM (pausa)

ESTRUTURA OBRIGATÓRIA DO ROTEIRO:

1. HOOK (primeiros 5-8 segundos / ~30 palavras):
   Frase de abertura que PRENDE imediatamente. Deve criar urgência, curiosidade ou emoção forte.

2. DESENVOLVIMENTO (corpo principal):
   Narração imersiva, envolvente, com ritmo emocional.
   Adapta o tom ao nicho:
   · Religioso/Espiritual: tom de autoridade espiritual, conexão com Deus, linguagem de fé e esperança
   · Dark/Mistério: tom misterioso, suspense, revelações graduais
   · Educação: tom de autoridade, dados surpreendentes, explicações claras
   · Motivação: tom inspirador, história de superação, virada emocional
   · Outro: adapta naturalmente

3. CTAs NATIVOS (distribuídos dentro do roteiro — NÃO no final como bloco separado):
   Insere 2-3 CTAs ao longo do roteiro de forma NATURAL, como se fosse parte da narração.
   Os CTAs devem ser adaptados ao nicho (espiritual, mistério, educação, motivação).

   REGRA CRÍTICA: Os CTAs NÃO podem parecer genéricos. Devem fluir naturalmente como parte da mensagem.

4. CONCLUSÃO (últimos ~50 palavras):
   Encerramento emocional forte que conecta com o início.
   Termina com uma frase de impacto que fica na mente do espectador.

REGRA ABSOLUTA DE OUTPUT:
- Retorna APENAS o texto de narração. NADA MAIS.
- SEM título, SEM cabeçalho, SEM "## Roteiro", SEM "---"
- SEM menções a ferramentas (Veo3, ElevenLabs, CapCut, etc.)
- O output deve ser EXCLUSIVAMENTE o texto que será narrado em voz alta.`,
        token
      );
      setVp((p) => ({ ...p, script: reply }));
      setVpStep("script");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar roteiro");
    } finally {
      setVpLoading(false);
    }
  };

  // ── STEP 6: Narration ──
  const handleGenerateVoice = async () => {
    if (!vp.script.trim()) return;
    setVoiceLoading(true);
    setVoiceError(null);
    setVoiceUrl(null);
    setNarrationStorageUrl(null);

    try {
      const hasCharVoice = !!vp.characterVoiceId && elevenLabs.hasKey;
      const useEL = hasCharVoice || useElevenLabsVoice;

      const voiceBody: any = {
        text: vp.script,
        voiceId: hasCharVoice ? vp.characterVoiceId : (useElevenLabsVoice ? elevenLabs.voiceId : selectedTtsVoice.id),
        provider: useEL ? "elevenlabs" : "gemini",
      };
      if (useEL) voiceBody.elevenLabsKey = elevenLabs.apiKey;

      const { data, error: fnError } = await supabase.functions.invoke("generate-voice", { body: voiceBody });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      if (data?.audio) {
        const mimeType = data.mimeType || "audio/mpeg";
        let blob: Blob;

        if (mimeType.includes("L16") || mimeType.includes("pcm")) {
          const raw = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
          const wavHeader = createWavHeader(raw.length, 24000, 1, 16);
          const wavData = new Uint8Array(wavHeader.length + raw.length);
          wavData.set(wavHeader, 0);
          wavData.set(raw, wavHeader.length);
          blob = new Blob([wavData], { type: "audio/wav" });
        } else {
          const byteChars = atob(data.audio);
          const byteArray = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
          blob = new Blob([byteArray], { type: mimeType });
        }

        const blobUrl = URL.createObjectURL(blob);
        setVoiceUrl(blobUrl);

        // Auto-calculate scene count from duration
        const audio = new Audio(blobUrl);
        audio.addEventListener("loadedmetadata", () => {
          const dur = Math.ceil(audio.duration);
          setAudioDuration(dur);
          const autoScenes = Math.ceil(dur / vp.sceneDuration);
          setVp((p) => ({ ...p, sceneCount: autoScenes }));
        });

        // Upload to Supabase Storage
        if (user?.id) {
          try {
            const ext = mimeType.includes("wav") ? "wav" : "mp3";
            const storagePath = `narrations/${user.id}/${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from("character-references")
              .upload(storagePath, blob, { contentType: mimeType, upsert: true });
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from("character-references").getPublicUrl(storagePath);
              if (urlData?.publicUrl) setNarrationStorageUrl(urlData.publicUrl);
            }
          } catch { /* non-blocking */ }
        }

        toast.success("Narração gerada!");
      }
    } catch (e: any) {
      setVoiceError(e.message || "Erro ao gerar voz");
      toast.error("Erro ao gerar narração");
    } finally {
      setVoiceLoading(false);
    }
  };

  // ── STEP 7: Generate scenes ──
  const handleGenerateScenes = async () => {
    if (!vp.script) return;
    if (vp.characterId && !identityBlock) {
      toast.error("Personagem selecionado mas identidade não carregada. Seleciona o personagem novamente.");
      return;
    }
    setVpLoading(true);
    try {
      const token = await getToken();
      const charSection = identityBlock
        ? `PERSONAGEM PRINCIPAL — IDENTIDADE FIXA:
"""
${identityBlock}
"""

REGRAS DE USO DO PERSONAGEM NOS PROMPTS:
- NÃO copies o bloco de identidade inteiro para dentro de cada prompt. O sistema já injeta a identidade automaticamente.
- Em cada prompt de cena, descreve APENAS: acção, cenário, iluminação, câmera, expressão.
- Refere o personagem como "The character" ou "He/She" — nunca "a man", "a woman", "a person".
- Se a cena NÃO tem o personagem (ex: plano de paisagem), indica claramente "No character in this scene".`
        : vp.characterName
          ? `O personagem principal é: ${vp.characterName}. Mantém a mesma pessoa em todas as cenas.`
          : "";

      const hasNarrationForScenes = !!narrationStorageUrl || !!voiceUrl;
      const silentRule = hasNarrationForScenes
        ? `   - OBRIGATÓRIO no final de CADA prompt: "No dialogue, no speech, no voiceover, no narration, no text on screen. Silent cinematic footage only. Audio will be added separately."`
        : `   - O vídeo DEVE ter áudio nativo: sons ambiente, diálogos em português do Brasil se o personagem falar, sons naturais da cena.`;

      const reply = await callChat(
        `Analisa este roteiro e divide-o em exatamente ${vp.sceneCount} cenas visuais para geração de vídeo IA.

ROTEIRO:
${vp.script}

${charSection}

Para cada cena, gera:
1. Descrição curta da cena (1 frase em PT)
2. Prompt completo em inglês para geração de vídeo IA (3-5 frases). O prompt deve descrever:
   - O que o personagem FAZ na cena (acção, expressão, gestos)
   - Ambiente e cenário detalhado
   - Iluminação específica
   - Movimento de câmera (close-up, medium shot, wide, etc.)
   - "Photorealistic, shot on iPhone 15 Pro, handheld, available light, UGC aesthetic"
   - NÃO incluas a descrição física do personagem no prompt (é adicionada automaticamente)
${silentRule}

Formato OBRIGATÓRIO (uma cena por bloco):
CENA 1:
DESC: [descrição em PT]
PROMPT: [prompt em inglês]

CENA 2:
DESC: [descrição em PT]
PROMPT: [prompt em inglês]

...e assim por diante até CENA ${vp.sceneCount}.
Sem texto adicional fora deste formato.`,
        token,
        identityBlock,
        identityBlock ? "deep" : "quick"
      );

      const sceneBlocks = reply.split(/CENA\s*\d+\s*:/i).filter((b) => b.trim());
      const scenes: SceneData[] = [];
      for (const block of sceneBlocks) {
        const descMatch = block.match(/DESC:\s*(.+?)(?=PROMPT:|$)/si);
        const promptMatch = block.match(/PROMPT:\s*([\s\S]+?)(?=CENA\s*\d+|$)/si);
        if (descMatch && promptMatch) {
          scenes.push({
            index: scenes.length + 1,
            description: descMatch[1].trim(),
            prompt: promptMatch[1].trim().replace(/\n{3,}/g, "\n\n"),
          });
        }
        if (scenes.length >= vp.sceneCount) break;
      }
      while (scenes.length < vp.sceneCount) {
        scenes.push({ index: scenes.length + 1, description: `Cena ${scenes.length + 1}`, prompt: "Atmospheric cinematic scene with available light" });
      }
      setVp((p) => ({ ...p, scenes }));
      setVpStep("scenes");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar cenas");
    } finally {
      setVpLoading(false);
    }
  };

  // ── STEP 8: Generate video per scene ──
  const handleGenerateVideo = async (sceneIndex: number) => {
    const scene = vp.scenes[sceneIndex];
    if (!scene) return;

    setVp((p) => ({
      ...p,
      scenes: p.scenes.map((s, i) => i === sceneIndex ? { ...s, generating: true, error: undefined } : s),
    }));

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`;

      // Model selection — same logic as DarkPipelinePage
      let model: string;
      if (vp.sceneDuration <= 8) {
        model = vp.referenceImageUrl ? "veo3-fast-i2v" : "veo3-fast";
      } else {
        model = "wan26-t2v-flash";
      }

      const hasNarration = !!narrationStorageUrl || !!voiceUrl || !!audioDuration
        || scene.prompt.includes("Silent cinematic footage");
      const silentSuffix = hasNarration && model.startsWith("veo3")
        ? "\n\nNo dialogue, no speech, no voiceover, no narration, no text on screen. Silent cinematic footage only. Audio will be added separately."
        : "";

      const promptAlreadyHasIdentity = scene.prompt.includes("FIXED CHARACTER") || scene.prompt.includes("same person in every frame");

      let finalPrompt: string;
      if (model.startsWith("wan26")) {
        finalPrompt = promptAlreadyHasIdentity
          ? scene.prompt
          : wanT2VBlock ? `${wanT2VBlock} SCENE: ${scene.prompt}` : scene.prompt;
      } else {
        if (promptAlreadyHasIdentity) {
          finalPrompt = `${scene.prompt}${silentSuffix}`;
        } else {
          finalPrompt = identityBlock
            ? `${identityBlock}\n\nSCENE: ${scene.prompt}${silentSuffix}`
            : `${scene.prompt}${silentSuffix}`;
        }
      }

      // Submit
      const submitResp = await fetch(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: finalPrompt,
          aspectRatio: vp.aspectRatio,
          duration: vp.sceneDuration,
          model,
          referenceImageUrl: model === "veo3-fast-i2v" ? vp.referenceImageUrl : undefined,
          silentVideo: hasNarration,
        }),
      });

      const submitData = await submitResp.json();
      if (submitData.error) throw new Error(submitData.error);
      if (submitData.status !== "SUBMITTED") throw new Error("Falha ao submeter");

      const { requestId, statusUrl, responseUrl } = submitData;

      // Poll
      const maxWait = 600000;
      const pollInterval = 5000;
      let elapsed = 0;
      while (elapsed < maxWait) {
        await new Promise((r) => setTimeout(r, pollInterval));
        elapsed += pollInterval;

        const pollResp = await fetch(baseUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "poll", requestId, statusUrl, responseUrl }),
        });
        const pollData = await pollResp.json();

        if (pollData.status === "COMPLETED" && pollData.videoUrl) {
          setVp((p) => ({
            ...p,
            scenes: p.scenes.map((s, i) => i === sceneIndex ? { ...s, videoUrl: pollData.videoUrl, generating: false } : s),
          }));
          toast.success(`Cena ${sceneIndex + 1} gerada! (${Math.round(elapsed / 1000)}s)`);
          refreshProfile();
          return;
        }
        if (pollData.status === "FAILED") throw new Error(pollData.error || "Geração falhou");
      }
      throw new Error("Timeout — vídeo a demorar mais de 10 minutos");
    } catch (e: any) {
      setVp((p) => ({
        ...p,
        scenes: p.scenes.map((s, i) => i === sceneIndex ? { ...s, generating: false, error: e.message } : s),
      }));
      toast.error(`Cena ${sceneIndex + 1}: ${e.message}`);
    }
  };

  // ── Character selection ──
  const handleSelectCharacter = async (charId: string, charName: string) => {
    selectCharacter(charId);
    const char = characters.find((c) => c.id === charId);
    let voiceId: string | null = null;
    const { data } = await supabase.from("characters").select("elevenlabs_voice_id").eq("id", charId).single();
    if (data?.elevenlabs_voice_id) {
      voiceId = data.elevenlabs_voice_id;
      toast.success(`Voz do ${charName} detectada!`);
    }
    setVp((p) => ({
      ...p,
      characterId: charId,
      characterName: charName,
      characterVoiceId: voiceId,
      referenceImageUrl: char?.referenceImageUrl || null,
    }));
  };

  // ── Export all prompts ──
  const handleExportPrompts = () => {
    const lines = [
      `# ${vp.selectedTitle}`,
      `## Tema: ${vp.theme}`,
      `## Duração: ${vp.sceneDuration}s por cena | Formato: ${vp.aspectRatio}`,
      vp.characterName ? `## Personagem: ${vp.characterName}` : "",
      "", "---", "",
      "## ROTEIRO", vp.script, "", "---", "", "## CENAS",
      ...vp.scenes.map((s) => [`### Cena ${s.index}: ${s.description}`, `**Prompt:** ${s.prompt}`, ""]).flat(),
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(lines);
    toast.success("Todos os prompts copiados!");
  };

  // ═══════════════════════════════════════════
  // EXISTING TEMPLATE LOGIC (unchanged below)
  // ═══════════════════════════════════════════

  const handleViralVideoSelect = (vid: any) => {
    try {
      const v = fieldValues;
      const hasChar = !!identityBlock;

      const charSection = hasChar ? (isPT
        ? `\n\n## 3. IMAGEM (${v.imageTool})
O personagem já está definido via Identity Lock. USA EXACTAMENTE o identity block abaixo em cada prompt — NÃO inventes descrição nova:

\`\`\`
${identityBlock}

[prompt da cena aqui: enquadramento, pose, iluminação, fundo, expressão]

Negative: ${negativePrompt || "no perfect symmetry, no airbrushed skin, no CGI look, no illustration, no anime"}
\`\`\`

NOTA: O negative prompt vai DENTRO do mesmo bloco de código, não separado.`
        : `\n\n## 3. IMAGE (${v.imageTool})
Character is already defined via Identity Lock. Use EXACTLY the identity block below in every prompt — do NOT invent a new description:

\`\`\`
${identityBlock}

[scene prompt here: framing, pose, lighting, background, expression]

Negative: ${negativePrompt || "no perfect symmetry, no airbrushed skin, no CGI look, no illustration, no anime"}
\`\`\`

NOTE: The negative prompt goes INSIDE the same code block, not separate.`)
        : "";

      const prompt = isPT
        ? `${hasChar ? `═══ PERSONAGEM ATIVO — IDENTITY LOCK ═══\n${identityBlock}\n═══ FIM IDENTITY LOCK ═══\n\n` : ""}Modela este vídeo viral para eu recriar com ${v.imageTool} + ${v.videoTool} + CapCut.

VÍDEO: "${vid.title}" | ${vid.channel} | ${formatNumber(vid.views)} views | ${vid.duration} | ${vid.url}
CONTEXTO: ${v.niche} | Público: ${v.audience} ${v.brand ? `| Marca: ${v.brand}` : ""} | Idioma: ${v.videoLang}

ENTREGA EXACTAMENTE NESTA ORDEM E FORMATO:

## 1. ANÁLISE
Máximo 4 linhas. Porque viralizou, técnica, emoção.

## 2. IDEIA DA MODELAGEM
Máximo 4 linhas. Como vou adaptar este vídeo ao meu contexto, qual a mensagem, diferencial.
${hasChar ? charSection : `
## 3. IMAGEM (${v.imageTool})
Descrição do personagem em 2 linhas, depois:

Prompt ${v.imageTool} dentro de bloco de código (entre \`\`\`):
\`\`\`
[prompt completo em inglês aqui]

Negative: [negative prompt aqui]
\`\`\`
`}

## 4. CENAS ${v.videoTool}
Calcula quantas cenas de 8 segundos são necessárias.
Para CADA cena:

**CENA [N] — [título]**

Prompt ${v.videoTool} dentro de bloco de código:
\`\`\`
${hasChar ? "[identity block do personagem] + " : ""}[prompt completo em inglês, com ação, câmera, iluminação, expressão, cenário, diálogo entre aspas no idioma ${v.videoLang}. Maximizar 8 segundos.]${hasChar ? `\n\nNegative: ${negativePrompt || "no perfect symmetry, no airbrushed skin, no CGI look"}` : ""}
\`\`\`

Texto na tela: [overlay curto, máx 5 palavras]

## 5. MONTAGEM CAPCUT
3 linhas máximo: ordem das cenas, transições, música.

REGRAS ABSOLUTAS:
- Cada prompt OBRIGATORIAMENTE dentro de bloco de código (\`\`\`) para o utilizador poder copiar com um clique
- Prompts de imagem e vídeo SEMPRE em inglês
- Diálogos/falas no idioma: ${v.videoLang}
- ZERO explicações desnecessárias — só o que é preciso para executar
- Cada cena ${v.videoTool} usa o MÁXIMO dos 8 segundos
- Cena 1 = HOOK | Última cena = CTA
${hasChar ? "- CADA prompt (imagem e vídeo) DEVE começar com o identity block COMPLETO do personagem\n- O negative prompt vai DENTRO do bloco de código, NÃO como bloco separado" : ""}`
        : `${hasChar ? `═══ ACTIVE CHARACTER — IDENTITY LOCK ═══\n${identityBlock}\n═══ END IDENTITY LOCK ═══\n\n` : ""}Model this viral video for me to recreate with ${v.imageTool} + ${v.videoTool} + CapCut.

VIDEO: "${vid.title}" | ${vid.channel} | ${formatNumber(vid.views)} views | ${vid.duration} | ${vid.url}
CONTEXT: ${v.niche} | Audience: ${v.audience} ${v.brand ? `| Brand: ${v.brand}` : ""} | Language: ${v.videoLang}

DELIVER EXACTLY IN THIS ORDER AND FORMAT:

## 1. ANALYSIS
Max 4 lines. Why it went viral, technique, emotion.

## 2. MODELING IDEA
Max 4 lines. How to adapt to my context, message, differentiator.
${hasChar ? charSection : `
## 3. IMAGE (${v.imageTool})
Character description in 2 lines, then:

${v.imageTool} prompt inside code block:
\`\`\`
[complete prompt in English]

Negative: [negative prompt]
\`\`\`
`}

## 4. SCENES ${v.videoTool}
Calculate how many 8-second scenes needed.
For EACH scene:

**SCENE [N] — [title]**

${v.videoTool} prompt inside code block:
\`\`\`
${hasChar ? "[character identity block] + " : ""}[complete prompt in English, action, camera, lighting, expression, setting, dialogue in ${v.videoLang}. Maximize 8 seconds.]${hasChar ? `\n\nNegative: ${negativePrompt || "no perfect symmetry, no airbrushed skin, no CGI look"}` : ""}
\`\`\`

Text on screen: [short overlay, max 5 words]

## 5. CAPCUT ASSEMBLY
3 lines max: scene order, transitions, music.

ABSOLUTE RULES:
- Every prompt MUST be inside a code block
- Image and video prompts ALWAYS in English
- Dialogue/speech in: ${v.videoLang}
- ZERO unnecessary explanations
- Each ${v.videoTool} scene uses MAXIMUM 8 seconds
- Scene 1 = HOOK | Last scene = CTA
${hasChar ? "- EVERY prompt (image and video) MUST start with the FULL character identity block\n- Negative prompt goes INSIDE the code block, NOT as a separate block" : ""}`;

      onSend(prompt);
      resetViralFlow();
    } catch (e) {
      console.error("Error building viral prompt:", e);
      toast.error(isPT ? "Erro ao modelar vídeo. Tenta novamente." : "Error modeling video. Try again.");
      resetViralFlow();
    }
  };

  const templates: Template[] = [
    {
      id: "ugc-influencer",
      emoji: "🎭",
      label: isPT ? "Criar Influencer UGC" : "Create UGC Influencer",
      description: isPT ? "Prompt profissional para gerar imagem de influencer" : "Professional prompt to generate influencer image",
      fields: [
        { key: "niche", label: isPT ? "Nicho" : "Niche", placeholder: isPT ? "ex: fitness, beleza, oração, finanças" : "e.g., fitness, beauty, prayer, finance" },
        { key: "gender", label: isPT ? "Género" : "Gender", type: "select", options: isPT ? ["Homem", "Mulher"] : ["Male", "Female"], placeholder: "" },
        { key: "age", label: isPT ? "Idade aprox." : "Approx. age", placeholder: isPT ? "ex: 30-35 anos" : "e.g., 30-35 years" },
        { key: "style", label: isPT ? "Estilo visual" : "Visual style", placeholder: isPT ? "ex: elegante minimalista, casual urbano" : "e.g., minimalist elegant, urban casual" },
        { key: "setting", label: isPT ? "Cenário" : "Setting", placeholder: isPT ? "ex: escritório em casa, estúdio, café" : "e.g., home office, studio, café" },
        { key: "platform", label: isPT ? "Plataforma" : "Platform", type: "select", options: ["Instagram Reels", "TikTok", "YouTube Shorts", "LinkedIn"], placeholder: "" },
        { key: "tool", label: isPT ? "Ferramenta" : "Tool", type: "select", options: ["SavvyOwl"], placeholder: "" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria um prompt profissional ultra-detalhado para gerar a imagem de um influencer UGC no ${v.tool || "SavvyOwl Image"}.

Detalhes do personagem:
- Nicho: ${v.niche}
- Género: ${v.gender}
- Idade: ${v.age}
- Estilo visual: ${v.style}
- Cenário: ${v.setting}
- Plataforma principal: ${v.platform}

Preciso de:
1. PROMPT PRINCIPAL completo e pronto a colar na ferramenta (com negative prompt na última linha do mesmo bloco de código, formato "Negative: ...")
2. VERSÃO CURTA para ferramentas com limite de caracteres
3. PARÂMETROS TÉCNICOS (proporção, ângulo, iluminação)
4. 2 VARIAÇÕES com cenários ou moods diferentes (cada uma completa e autónoma, com negative dentro do mesmo bloco)
5. PRÓXIMOS PASSOS: como usar esta imagem como referência para criar vídeo na SavvyOwl

REGRA: O negative prompt vai SEMPRE como última linha dentro do bloco de código do prompt principal. NUNCA como bloco de código separado.

O prompt deve ser para estilo UGC — parecer autêntico, gravado com telemóvel, natural e não comercial.`
        : `Create an ultra-detailed professional prompt to generate a UGC influencer image in ${v.tool || "SavvyOwl Image"}.

Character details:
- Niche: ${v.niche}
- Gender: ${v.gender}
- Age: ${v.age}
- Visual style: ${v.style}
- Setting: ${v.setting}
- Main platform: ${v.platform}

I need:
1. MAIN PROMPT complete and ready to paste (with negative prompt as last line inside the same code block, format "Negative: ...")
2. SHORT VERSION for character-limited tools
3. TECHNICAL PARAMETERS (ratio, angle, lighting)
4. 2 VARIATIONS with different settings/moods (each complete and standalone, with negative inside same block)
5. NEXT STEPS: how to use this image as reference for video in SavvyOwl

RULE: The negative prompt ALWAYS goes as the last line inside the main prompt code block. NEVER as a separate code block.

The prompt must be UGC style — authentic, smartphone-like, natural, not commercial.`,
    },
    {
      id: "caption-pro",
      emoji: "✍️",
      label: isPT ? "Copy / Legenda Pro" : "Pro Caption / Copy",
      description: isPT ? "Legenda profissional para qualquer plataforma" : "Professional caption for any platform",
      fields: [
        { key: "platform", label: isPT ? "Plataforma" : "Platform", type: "select", options: ["Instagram", "LinkedIn", "TikTok", "Twitter/X", "Facebook"], placeholder: "" },
        { key: "topic", label: isPT ? "Tema / Produto" : "Topic / Product", placeholder: isPT ? "ex: lançamento de curso online" : "e.g., online course launch" },
        { key: "audience", label: isPT ? "Público-alvo" : "Target audience", placeholder: isPT ? "ex: empreendedores 25-40 anos" : "e.g., entrepreneurs 25-40" },
        { key: "tone", label: isPT ? "Tom" : "Tone", type: "select", options: isPT ? ["Profissional", "Casual", "Inspirador", "Urgente", "Humorístico", "Educativo"] : ["Professional", "Casual", "Inspiring", "Urgent", "Humorous", "Educational"], placeholder: "" },
        { key: "goal", label: isPT ? "Objetivo" : "Goal", type: "select", options: isPT ? ["Engagement", "Venda", "Awareness", "Tráfego", "Leads"] : ["Engagement", "Sales", "Awareness", "Traffic", "Leads"], placeholder: "" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria uma legenda profissional para ${v.platform}.

Tema: ${v.topic}
Público-alvo: ${v.audience}
Tom: ${v.tone}
Objetivo: ${v.goal}

Preciso de:
- 3 variações de HOOK (primeira linha que para o scroll)
- Corpo da legenda formatado nativamente para ${v.platform}
- CTA específico e forte (não genérico)
- 5 hashtags de nicho (se aplicável à plataforma)
- Melhor horário para publicar
- Sugestão de formato complementar (ex: se é copy, sugere o Reels que combina)`
        : `Create a professional caption for ${v.platform}.

Topic: ${v.topic}
Target audience: ${v.audience}
Tone: ${v.tone}
Goal: ${v.goal}

I need:
- 3 HOOK variations (first line that stops the scroll)
- Caption body formatted natively for ${v.platform}
- Specific, strong CTA (not generic)
- 5 niche hashtags (if applicable)
- Best posting time
- Complementary format suggestion (e.g., matching Reels idea)`,
    },
    {
      id: "video-script",
      emoji: "🎬",
      label: isPT ? "Script de Vídeo / Reels" : "Video / Reels Script",
      description: isPT ? "Roteiro cena a cena pronto para gravar" : "Scene-by-scene script ready to record",
      fields: [
        { key: "platform", label: isPT ? "Plataforma" : "Platform", type: "select", options: ["Instagram Reels", "TikTok", "YouTube Shorts", "YouTube"], placeholder: "" },
        { key: "duration", label: isPT ? "Duração" : "Duration", type: "select", options: ["15s", "30s", "60s", "3-5min", "10min+"], placeholder: "" },
        { key: "topic", label: isPT ? "Tema" : "Topic", placeholder: isPT ? "ex: 5 dicas de produtividade" : "e.g., 5 productivity tips" },
        { key: "style", label: isPT ? "Estilo" : "Style", type: "select", options: isPT ? ["UGC / Talking head", "Tutorial", "Storytelling", "Tendência / Trend", "Antes e Depois", "Review"] : ["UGC / Talking head", "Tutorial", "Storytelling", "Trend", "Before & After", "Review"], placeholder: "" },
        { key: "audience", label: isPT ? "Público-alvo" : "Target audience", placeholder: isPT ? "ex: mulheres 20-35 interessadas em skincare" : "e.g., women 20-35 interested in skincare" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria um roteiro completo para ${v.platform} de ${v.duration}.

Tema: ${v.topic}
Estilo: ${v.style}
Público: ${v.audience}

Formato cena a cena:
Para cada cena inclui:
- VISUAL: o que aparece no ecrã
- ÁUDIO: texto da voz off / fala
- TEXTO NA TELA: overlays e legendas
- DURAÇÃO: tempo de cada cena
- TRANSIÇÃO: como passa para a cena seguinte

Regras:
- Hook nos primeiros 1-3 segundos (obrigatório)
- CTA nos últimos 3 segundos
- Direção de som/música
- Se for UGC, incluir notas de autenticidade (enquadramento smartphone, luz natural)`
        : `Create a complete script for ${v.platform}, ${v.duration} long.

Topic: ${v.topic}
Style: ${v.style}
Audience: ${v.audience}

Scene-by-scene format:
For each scene include:
- VISUAL: what appears on screen
- AUDIO: voiceover / speech text
- TEXT ON SCREEN: overlays and captions
- DURATION: time per scene
- TRANSITION: how to move to next scene

Rules:
- Hook in first 1-3 seconds (mandatory)
- CTA in last 3 seconds
- Sound/music direction
- If UGC, include authenticity notes (smartphone framing, natural light)`,
    },
    {
      id: "content-calendar",
      emoji: "📅",
      label: isPT ? "Calendário de Conteúdo" : "Content Calendar",
      description: isPT ? "Plano semanal ou mensal completo" : "Complete weekly or monthly plan",
      fields: [
        { key: "platform", label: isPT ? "Plataforma" : "Platform", type: "select", options: ["Instagram", "TikTok", "LinkedIn", "Multi-plataforma"], placeholder: "" },
        { key: "niche", label: isPT ? "Nicho" : "Niche", placeholder: isPT ? "ex: marketing digital, fitness, moda" : "e.g., digital marketing, fitness, fashion" },
        { key: "period", label: isPT ? "Período" : "Period", type: "select", options: isPT ? ["1 semana (seg-sex)", "2 semanas", "1 mês"] : ["1 week (Mon-Fri)", "2 weeks", "1 month"], placeholder: "" },
        { key: "goal", label: isPT ? "Objetivo principal" : "Main goal", type: "select", options: isPT ? ["Crescer seguidores", "Gerar vendas", "Aumentar engagement", "Lançamento de produto"] : ["Grow followers", "Drive sales", "Boost engagement", "Product launch"], placeholder: "" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria um calendário de conteúdo para ${v.platform} no nicho de ${v.niche}.

Período: ${v.period}
Objetivo principal: ${v.goal}

Para cada dia inclui:
- Formato (Reels, carrossel, post, Stories, Live)
- Tema específico
- Hook (primeira linha / primeiros 3 segundos)
- Objetivo do post (awareness, engagement, conversão)
- Melhor horário para publicar
- Pilares de conteúdo variados

Mistura tipos de conteúdo para variedade. Inclui pelo menos 40% de Reels/vídeo.`
        : `Create a content calendar for ${v.platform} in the ${v.niche} niche.

Period: ${v.period}
Main goal: ${v.goal}

For each day include:
- Format (Reels, carousel, post, Stories, Live)
- Specific topic
- Hook (first line / first 3 seconds)
- Post goal (awareness, engagement, conversion)
- Best posting time
- Varied content pillars

Mix content types for variety. Include at least 40% Reels/video.`,
    },
    {
      id: "ebook",
      emoji: "📚",
      label: isPT ? "Criar eBook / Lead Magnet" : "Create eBook / Lead Magnet",
      description: isPT ? "Estrutura completa de eBook ou material rico" : "Complete eBook or lead magnet structure",
      fields: [
        { key: "topic", label: isPT ? "Tema" : "Topic", placeholder: isPT ? "ex: Como criar conteúdo que vende" : "e.g., How to create content that sells" },
        { key: "audience", label: isPT ? "Público-alvo" : "Target audience", placeholder: isPT ? "ex: donos de pequenos negócios" : "e.g., small business owners" },
        { key: "pages", label: isPT ? "Nº de páginas" : "Number of pages", type: "select", options: ["5-10", "10-20", "20-30", "30-50"], placeholder: "" },
        { key: "goal", label: isPT ? "Objetivo" : "Goal", type: "select", options: isPT ? ["Captar leads", "Vender produto", "Educar audiência", "Posicionar autoridade"] : ["Capture leads", "Sell product", "Educate audience", "Position authority"], placeholder: "" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria a estrutura completa de um eBook / Lead Magnet.

Tema: ${v.topic}
Público-alvo: ${v.audience}
Tamanho: ${v.pages} páginas
Objetivo: ${v.goal}

Preciso de:
1. TÍTULO principal + 3 alternativas
2. SUBTÍTULO que complementa
3. ESTRUTURA DE CAPÍTULOS com título e resumo de cada um
4. INTRODUÇÃO escrita (pronta a usar)
5. CONTEÚDO do primeiro capítulo completo (como exemplo)
6. CTA final e página de conversão
7. SUGESTÕES de design (cores, estilo visual, tipo de imagens)
8. COPY para landing page de download
9. SEQUÊNCIA de 3 emails para entregar o eBook e nurturar o lead`
        : `Create the complete structure of an eBook / Lead Magnet.

Topic: ${v.topic}
Target audience: ${v.audience}
Size: ${v.pages} pages
Goal: ${v.goal}

I need:
1. MAIN TITLE + 3 alternatives
2. SUBTITLE
3. CHAPTER STRUCTURE with title and summary for each
4. Written INTRODUCTION (ready to use)
5. First chapter CONTENT complete (as example)
6. Final CTA and conversion page
7. DESIGN SUGGESTIONS (colors, visual style, image types)
8. COPY for download landing page
9. 3-EMAIL SEQUENCE to deliver and nurture the lead`,
    },
    {
      id: "ai-video",
      emoji: "🎥",
      label: isPT ? "Prompt Vídeo IA" : "AI Video Prompt",
      description: isPT ? "Prompt para gerar vídeo com IA" : "Prompt to generate AI video",
      fields: [
        { key: "tool", label: isPT ? "Ferramenta" : "Tool", type: "select", options: ["SavvyOwl Video 8s", "SavvyOwl Video 15s"], placeholder: "" },
        { key: "concept", label: isPT ? "Conceito do vídeo" : "Video concept", placeholder: isPT ? "ex: influencer apresentando produto de skincare" : "e.g., influencer presenting skincare product" },
        { key: "duration", label: isPT ? "Duração" : "Duration", type: "select", options: ["5s", "10s", "15s", "30s"], placeholder: "" },
        { key: "style", label: isPT ? "Estilo" : "Style", type: "select", options: isPT ? ["UGC realista", "Cinematográfico", "Animação", "Produto em destaque", "Lifestyle"] : ["Realistic UGC", "Cinematic", "Animation", "Product showcase", "Lifestyle"], placeholder: "" },
        { key: "aspect", label: isPT ? "Proporção" : "Aspect ratio", type: "select", options: ["9:16 (Reels/TikTok)", "16:9 (YouTube)", "1:1 (Feed)"], placeholder: "" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria um prompt profissional para gerar vídeo no ${v.tool}.

Conceito: ${v.concept}
Duração: ${v.duration}
Estilo: ${v.style}
Proporção: ${v.aspect}

Preciso de:
1. PROMPT PRINCIPAL detalhado com descrição de movimento, câmera, iluminação, ação (com negative prompt como última linha dentro do mesmo bloco de código)
2. VERSÃO CURTA
3. 2 VARIAÇÕES com ângulos ou moods diferentes
4. NOTAS DE DIREÇÃO: o que ajustar se o primeiro resultado não ficar perfeito

REGRA: O negative prompt vai SEMPRE dentro do bloco de código do prompt principal (linha "Negative: ..."). NUNCA como bloco separado.`
        : `Create a professional prompt to generate video in ${v.tool}.

Concept: ${v.concept}
Duration: ${v.duration}
Style: ${v.style}
Aspect ratio: ${v.aspect}

I need:
1. Detailed MAIN PROMPT with movement, camera, lighting, action description (with negative prompt as last line inside the same code block)
2. SHORT VERSION
3. 2 VARIATIONS with different angles or moods
4. DIRECTION NOTES: what to adjust if first result isn't perfect

RULE: The negative prompt ALWAYS goes inside the main prompt code block (line "Negative: ..."). NEVER as a separate block.`,
    },
    {
      id: "scene-generator",
      emoji: "🎞️",
      label: isPT ? "Gerador de Cenas (Vídeo Longo)" : "Scene Generator (Long Video)",
      description: isPT ? "Cenas prontas para vídeo IA, CapCut, etc." : "Ready scenes for AI video, CapCut, etc.",
      fields: [
        { key: "tool", label: isPT ? "Ferramenta de vídeo" : "Video tool", type: "select", options: ["SavvyOwl Video 8s", "SavvyOwl Video 15s", "CapCut AI"], placeholder: "" },
        { key: "scenes", label: isPT ? "Nº de cenas" : "Number of scenes", type: "select", options: ["3", "4", "5", "6", "8", "10", "12", "15"], placeholder: "" },
        { key: "maxDuration", label: isPT ? "Duração máx. por cena" : "Max duration per scene", type: "select", options: ["5s", "8s", "10s", "15s", "30s"], placeholder: "" },
        { key: "videoType", label: isPT ? "Tipo de vídeo" : "Video type", type: "select", options: isPT ? ["Influencer UGC", "Vídeo Dark / Narração", "Review de produto", "Tutorial passo a passo", "Storytelling emocional", "Antes e Depois", "Vlog / Day in my life"] : ["UGC Influencer", "Dark Video / Narration", "Product Review", "Step-by-step Tutorial", "Emotional Storytelling", "Before & After", "Vlog / Day in my life"], placeholder: "" },
        { key: "objective", label: isPT ? "Objetivo do vídeo" : "Video objective", placeholder: isPT ? "ex: vender um curso de marketing, apresentar produto de skincare, motivar audiência" : "e.g., sell a marketing course, present skincare product, motivate audience" },
        { key: "voiceover", label: isPT ? "Narração / Voz" : "Narration / Voice", type: "select", options: isPT ? ["Com voz off (narração)", "Personagem a falar", "Sem voz (só música + texto)", "Voz off + texto na tela"] : ["Voiceover (narration)", "Character speaking", "No voice (music + text only)", "Voiceover + text on screen"], placeholder: "" },
        { key: "aspect", label: isPT ? "Proporção" : "Aspect ratio", type: "select", options: ["9:16 (Reels/TikTok)", "16:9 (YouTube)", "1:1 (Feed)"], placeholder: "" },
        { key: "music", label: isPT ? "Estilo de música" : "Music style", placeholder: isPT ? "ex: motivacional épica, lo-fi relaxante, trending TikTok, dramática" : "e.g., epic motivational, lo-fi relaxing, trending TikTok, dramatic" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria um roteiro completo de ${v.scenes} cenas para ${v.tool}, pronto para gerar cena a cena.

BRIEFING DO VÍDEO:
- Tipo: ${v.videoType}
- Objetivo: ${v.objective}
- Nº de cenas: ${v.scenes}
- Duração máxima por cena: ${v.maxDuration}
- Proporção: ${v.aspect}
- Narração: ${v.voiceover}
- Música: ${v.music}

REGRAS OBRIGATÓRIAS:
1. Cada cena deve usar o MÁXIMO da duração disponível (${v.maxDuration}) — nunca gerar cenas curtas
2. A CENA 1 é o HOOK — tem de captar atenção imediatamente
3. A ÚLTIMA CENA é o CTA — chamada para ação clara
4. Cada cena deve ter CONTINUIDADE com a anterior (transição lógica)

PARA CADA CENA entrega:
- CENA [N] — Título descritivo
- PROMPT ${v.tool}: prompt completo dentro de bloco de código, incluindo: ação/movimento, enquadramento de câmera, iluminação, expressão do personagem, cenário, o que acontece do início ao fim da cena. O negative prompt vai NO FINAL do mesmo bloco de código (linha "Negative: ...")
- NARRAÇÃO/VOZ: texto exacto da fala ou narração (com timing)
- TEXTO NA TELA: overlays, legendas, títulos (com posição e estilo)
- MÚSICA: direção sonora para esta cena
- DURAÇÃO: ${v.maxDuration}
- TRANSIÇÃO PARA PRÓXIMA CENA: como conectar

NO FINAL inclui:
- SEQUÊNCIA DE MONTAGEM: ordem das cenas e como montar o vídeo final
- DICAS DE PÓS-PRODUÇÃO: como juntar as cenas no CapCut/editor
- DURAÇÃO TOTAL ESTIMADA do vídeo final`
        : `Create a complete script of ${v.scenes} scenes for ${v.tool}, ready to generate scene by scene.

VIDEO BRIEF:
- Type: ${v.videoType}
- Objective: ${v.objective}
- Number of scenes: ${v.scenes}
- Max duration per scene: ${v.maxDuration}
- Aspect ratio: ${v.aspect}
- Narration: ${v.voiceover}
- Music: ${v.music}

MANDATORY RULES:
1. Each scene must use the MAXIMUM available duration (${v.maxDuration})
2. SCENE 1 is the HOOK
3. LAST SCENE is the CTA
4. Each scene must have CONTINUITY with the previous one

FOR EACH SCENE deliver:
- SCENE [N] — Descriptive title
- ${v.tool} PROMPT: complete prompt inside a code block. Negative prompt at the END (line "Negative: ...")
- NARRATION/VOICE: exact speech or narration text (with timing)
- TEXT ON SCREEN: overlays, captions, titles
- MUSIC: sound direction for this scene
- DURATION: ${v.maxDuration}
- TRANSITION TO NEXT SCENE

AT THE END include:
- EDITING SEQUENCE: scene order and how to assemble the final video
- POST-PRODUCTION TIPS
- ESTIMATED TOTAL DURATION`,
    },
    {
      id: "dark-channel",
      emoji: "🌑",
      label: isPT ? "Canal Dark (Página Completa)" : "Dark Channel (Full Page)",
      description: isPT ? "Abre o Dark Pipeline Pro numa página dedicada" : "Open Dark Pipeline Pro in a dedicated page",
      fields: [],
      buildPrompt: () => "__REDIRECT__/dashboard/dark-pipeline",
    },
    {
      id: "viral-video-pipeline",
      emoji: "🚀",
      label: isPT ? "Vídeo Viral (Pipeline)" : "Viral Video (Pipeline)",
      description: isPT ? "Pipeline: Tema → Título → Roteiro → Personagem → Cenas → Vídeo" : "Pipeline: Theme → Title → Script → Character → Scenes → Video",
      fields: [],
      buildPrompt: () => "__PIPELINE__",
    },
    {
      id: "viral-modeling",
      emoji: "🔥",
      label: isPT ? "Modelar Vídeo Viral" : "Model Viral Video",
      description: isPT ? "Encontra vídeos virais e adapta para ti" : "Find viral videos and adapt for you",
      fields: [
        { key: "niche", label: isPT ? "Nicho" : "Niche", placeholder: isPT ? "ex: fitness, marketing digital, beleza, finanças, culinária" : "e.g., fitness, digital marketing, beauty, finance, cooking" },
        { key: "platform", label: isPT ? "Plataforma" : "Platform", type: "select", options: ["TikTok", "Instagram Reels", "YouTube Shorts", "YouTube"], placeholder: "" },
        { key: "audience", label: isPT ? "Teu público-alvo" : "Your target audience", placeholder: isPT ? "ex: mulheres 25-40 interessadas em skincare" : "e.g., women 25-40 interested in skincare" },
        { key: "brand", label: isPT ? "Teu produto/marca (opcional)" : "Your product/brand (optional)", placeholder: isPT ? "ex: curso online de marketing, loja de roupa, app de meditação" : "e.g., online marketing course, clothing store, meditation app" },
        { key: "imageTool", label: isPT ? "Ferramenta de imagem" : "Image tool", type: "select", options: ["SavvyOwl"], placeholder: "" },
        { key: "videoTool", label: isPT ? "Ferramenta de vídeo" : "Video tool", type: "select", options: ["SavvyOwl Video 8s", "SavvyOwl Video 15s"], placeholder: "" },
        { key: "videoLang", label: isPT ? "Idioma do vídeo" : "Video language", type: "select", options: isPT ? ["Português (BR)", "Português (PT)", "Inglês", "Espanhol"] : ["Portuguese (BR)", "Portuguese (PT)", "English", "Spanish"], placeholder: "" },
      ],
      buildPrompt: (v) => isPT
        ? `Quero modelar vídeos virais do nicho de ${v.niche} no ${v.platform}.

O MEU CONTEXTO:
- Público-alvo: ${v.audience}
${v.brand ? `- Produto/Marca: ${v.brand}` : ""}
- Ferramentas disponíveis: ${v.imageTool} + ${v.videoTool} + CapCut

PASSO 1 — TENDÊNCIAS VIRAIS:
Identifica os 10 formatos/padrões de vídeo que estão a viralizar AGORA no nicho de ${v.niche} no ${v.platform}. Para cada um:
- NOME DO FORMATO
- DESCRIÇÃO: como funciona este formato (estrutura, duração, estilo)
- POR QUE VIRALIZA: qual mecanismo psicológico usa
- EXEMPLO: descreve um vídeo concreto neste formato
- LINK DE REFERÊNCIA: termos de pesquisa para encontrar no ${v.platform}
- ESTIMATIVA DE VIEWS: potencial de visualizações

PASSO 2 — ADAPTAÇÃO:
Para os 3 formatos com maior potencial, cria a MODELAGEM COMPLETA adaptada ao meu contexto.

PASSO 3 — PLANO DE EXECUÇÃO:
- Qual dos 3 formatos fazer PRIMEIRO (e porquê)
- Calendário de publicação para a próxima semana
- Como testar e iterar baseado nos resultados`
        : `I want to model viral videos from the ${v.niche} niche on ${v.platform}.

MY CONTEXT:
- Target audience: ${v.audience}
${v.brand ? `- Product/Brand: ${v.brand}` : ""}
- Available tools: ${v.imageTool} + ${v.videoTool} + CapCut

STEP 1 — VIRAL TRENDS: Identify 10 viral formats NOW in ${v.niche} on ${v.platform}.
STEP 2 — ADAPTATION: For top 3 formats, create complete modeling for my context.
STEP 3 — EXECUTION PLAN: Which to do first, weekly calendar, how to iterate.`,
    },
  ];

  const isSceneTemplate = (id: string) => [
    "scene-generator", "dark-channel", "viral-video-pipeline", "viral-modeling", "ai-video", "ugc-influencer"
  ].includes(id);

  const handleSubmitTemplate = async () => {
    if (!activeTemplate) return;

    if (activeTemplate.id === "viral-modeling" && viralStep === "form") {
      setViralLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-trending`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ niche: fieldValues.niche, platform: fieldValues.platform, maxResults: 10 }),
          }
        );
        const data = await resp.json();
        if (data.videos && data.videos.length > 0) {
          setViralVideos(data.videos);
          setViralStep("videos");
        } else {
          toast.error(isPT ? "Nenhum vídeo viral encontrado. Tenta outro nicho." : "No viral videos found. Try another niche.");
        }
      } catch {
        toast.error(isPT ? "Erro ao buscar vídeos. Tenta novamente." : "Error fetching videos. Try again.");
      } finally {
        setViralLoading(false);
      }
      return;
    }

    let prompt = activeTemplate.buildPrompt(fieldValues);

    if (identityBlock && isSceneTemplate(activeTemplate.id)) {
      const charInstruction = isPT
        ? `\n\n═══ PERSONAGEM ATIVO — IDENTITY LOCK ═══
O personagem abaixo é OBRIGATÓRIO em todas as cenas. Cada prompt de imagem/vídeo que gerares DEVE incluir este bloco de identidade COMPLETO no início. NÃO inventes descrições — usa EXACTAMENTE este bloco:

${identityBlock}

NEGATIVE PROMPT (incluir em TODOS os prompts de imagem):
${negativePrompt || "no perfect symmetry, no airbrushed skin, no CGI look, no illustration, no anime, no cartoon"}

REGRA: O negative prompt vai JUNTO do prompt principal (não como bloco separado). Formato:
\`\`\`
[identity block + prompt da cena]

Negative: [negative prompt]
\`\`\`
═══ FIM IDENTITY LOCK ═══`
        : `\n\n═══ ACTIVE CHARACTER — IDENTITY LOCK ═══
The character below is MANDATORY in all scenes. Every image/video prompt you generate MUST include this identity block in FULL at the beginning. Do NOT invent descriptions — use EXACTLY this block:

${identityBlock}

NEGATIVE PROMPT (include in ALL image prompts):
${negativePrompt || "no perfect symmetry, no airbrushed skin, no CGI look, no illustration, no anime, no cartoon"}

RULE: The negative prompt goes TOGETHER with the main prompt (not as a separate block). Format:
\`\`\`
[identity block + scene prompt]

Negative: [negative prompt]
\`\`\`
═══ END IDENTITY LOCK ═══`;

      prompt = charInstruction + "\n\n" + prompt;
    }

    onSend(prompt);
    setActiveTemplate(null);
    setFieldValues({});
  };

  const resetViralFlow = () => {
    setActiveTemplate(null);
    setFieldValues({});
    setViralVideos([]);
    setViralStep("form");
    setSelectedVideo(null);
  };

  const formatNumber = (n: number): string => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  // ── VIRAL VIDEO PIPELINE (8 steps inline) ──
  if (pipelineActive) {
    return (
      <div className="w-full max-w-2xl space-y-4">
        {/* Pipeline header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-semibold text-foreground">Vídeo Viral Pipeline</span>
          </div>
          <div className="flex items-center gap-2">
            {vpStep !== "theme" && (
              <Button variant="ghost" size="sm" onClick={handleNewPipeline} className="text-[10px] text-muted-foreground gap-1">
                <RefreshCw className="h-3 w-3" />Novo
              </Button>
            )}
            <div className="flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 rounded-full px-2 py-0.5">
              <Coins className="h-3 w-3 text-purple-500" />
              <span className="text-[11px] font-bold text-purple-500">{profile?.credits_balance ?? 0}</span>
            </div>
            <button onClick={() => { setPipelineActive(false); handleNewPipeline(); }} className="p-1 rounded text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {VP_STEPS.map((s, i) => (
            <div key={s.key} className={`h-1 rounded-full transition-all flex-1 ${i <= vpStepIndex ? "bg-purple-500" : "bg-border"}`} />
          ))}
        </div>

        {/* ── STEP 1: THEME ── */}
        {vpStep === "theme" && (
          <div className="space-y-3">
            <div className="text-center">
              <Sparkles className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-foreground">Etapa 1 — Tema</h3>
              <p className="text-[11px] text-muted-foreground">Qual é o tema do teu vídeo?</p>
            </div>
            <textarea
              value={vp.theme}
              onChange={(e) => setVp((p) => ({ ...p, theme: e.target.value }))}
              placeholder="Ex: oração do salmo 91, mistérios do oceano, 5 hábitos milionários..."
              rows={3}
              className="w-full rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-400/40 resize-none"
            />
            <Button onClick={handleGenerateTitles} disabled={!vp.theme.trim() || vpLoading} className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-sm">
              {vpLoading ? <><Loader2 className="h-4 w-4 animate-spin" />A gerar títulos...</> : <><ArrowRight className="h-4 w-4" />Gerar 5 Títulos</>}
            </Button>
          </div>
        )}

        {/* ── STEP 2: TITLE ── */}
        {vpStep === "title" && (
          <div className="space-y-3">
            <div className="text-center">
              <FileText className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-foreground">Etapa 2 — Título</h3>
              <p className="text-[11px] text-muted-foreground">{vp.theme}</p>
            </div>
            <div className="space-y-1.5">
              {vp.titles.map((title, i) => (
                <button key={i} onClick={() => setVp((p) => ({ ...p, selectedTitle: title }))}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs ${vp.selectedTitle === title ? "border-purple-500 bg-purple-500/10 text-foreground" : "border-border/50 bg-secondary/20 text-muted-foreground hover:bg-secondary/40"}`}>
                  <span className="text-purple-500 font-mono mr-1.5">{i + 1}.</span>{title}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={handleGenerateTitles} disabled={vpLoading} className="gap-1 text-xs">
              <RefreshCw className="h-3 w-3" />Gerar novos títulos
            </Button>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Palavras no roteiro</p>
              <div className="flex gap-2">
                {[300, 500, 800, 1200].map((w) => (
                  <button key={w} onClick={() => setVp((p) => ({ ...p, wordCount: w }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${vp.wordCount === w ? "bg-purple-600 text-white" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={() => setVpStep("config")} disabled={!vp.selectedTitle} className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-sm">
              <ArrowRight className="h-4 w-4" />Configurar Cenas
            </Button>
            <button onClick={() => setVpStep("theme")} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
              <ArrowLeft className="h-3 w-3" />Voltar
            </button>
          </div>
        )}

        {/* ── STEP 3: CONFIG (duration + scenes + aspect) ── */}
        {vpStep === "config" && (
          <div className="space-y-3">
            <div className="text-center">
              <Clapperboard className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-foreground">Etapa 3 — Tempo & Cenas</h3>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Duração por cena</p>
              <div className="flex gap-2">
                {([8, 15] as const).map((d) => (
                  <button key={d} onClick={() => setVp((p) => ({ ...p, sceneDuration: d }))}
                    className={`flex-1 p-2 rounded-lg border text-center transition-all ${vp.sceneDuration === d ? "border-purple-500 bg-purple-500/10" : "border-border/50"}`}>
                    <span className="text-sm font-bold block">{d}s</span>
                    <span className="text-[9px] text-muted-foreground">{d <= 8 ? "Veo3 · 10 créd" : "Wan 2.6 · 5 créd"}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Número de cenas</p>
              <div className="flex gap-1 flex-wrap">
                {[3, 5, 7, 10, 15, 20].map((n) => (
                  <button key={n} onClick={() => setVp((p) => ({ ...p, sceneCount: n }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${vp.sceneCount === n ? "bg-purple-600 text-white" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Formato</p>
              <div className="flex gap-1">
                {[{ v: "9:16", l: "9:16 Reels" }, { v: "16:9", l: "16:9 YouTube" }, { v: "1:1", l: "1:1 Feed" }].map((o) => (
                  <button key={o.v} onClick={() => setVp((p) => ({ ...p, aspectRatio: o.v }))}
                    className={`px-3 py-1.5 rounded text-[10px] font-medium transition-all ${vp.aspectRatio === o.v ? "bg-purple-600 text-white" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo estimado:</span>
                <span className="text-purple-500 font-bold">{vp.sceneCount * (vp.sceneDuration <= 8 ? 10 : 5)} créditos</span>
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-muted-foreground">Teu saldo:</span>
                <span className={`font-bold ${(profile?.credits_balance ?? 0) >= vp.sceneCount * (vp.sceneDuration <= 8 ? 10 : 5) ? "text-green-500" : "text-destructive"}`}>
                  {profile?.credits_balance ?? 0} créditos
                </span>
              </div>
            </div>

            <Button onClick={handleGenerateScript} disabled={vpLoading} className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-sm">
              {vpLoading ? <><Loader2 className="h-4 w-4 animate-spin" />A gerar roteiro...</> : <><ArrowRight className="h-4 w-4" />Gerar Roteiro</>}
            </Button>
            <button onClick={() => setVpStep("title")} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
              <ArrowLeft className="h-3 w-3" />Voltar
            </button>
          </div>
        )}

        {/* ── STEP 4: SCRIPT ── */}
        {vpStep === "script" && (
          <div className="space-y-3">
            <div className="text-center">
              <FileText className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-foreground">Etapa 4 — Roteiro</h3>
              <p className="text-[11px] text-muted-foreground">{vp.script.split(/\s+/).length} palavras</p>
            </div>
            <textarea
              value={vp.script}
              onChange={(e) => setVp((p) => ({ ...p, script: e.target.value }))}
              rows={10}
              className="w-full rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground leading-relaxed focus:outline-none focus:border-purple-400/40 resize-y"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerateScript} disabled={vpLoading} className="gap-1 text-xs">
                <RefreshCw className="h-3 w-3" />Regenerar
              </Button>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(vp.script); toast.success("Roteiro copiado!"); }} className="gap-1 text-xs">
                <Copy className="h-3 w-3" />Copiar
              </Button>
            </div>
            <Button onClick={() => setVpStep("character")} className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-sm">
              <ArrowRight className="h-4 w-4" />Escolher Personagem
            </Button>
            <button onClick={() => setVpStep("config")} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
              <ArrowLeft className="h-3 w-3" />Voltar
            </button>
          </div>
        )}

        {/* ── STEP 5: CHARACTER ── */}
        {vpStep === "character" && (
          <div className="space-y-3">
            <div className="text-center">
              <Users className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-foreground">Etapa 5 — Personagem</h3>
              <p className="text-[11px] text-muted-foreground">Escolhe um personagem ou avança sem</p>
            </div>

            {characters.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Personagens guardados</p>
                {characters.map((char) => (
                  <button key={char.id} onClick={() => handleSelectCharacter(char.id, char.name)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${vp.characterId === char.id ? "border-purple-500 bg-purple-500/10" : "border-border/50 bg-secondary/20 hover:bg-secondary/40"}`}>
                    <Users className="h-4 w-4 text-purple-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-foreground block">{char.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate block">{char.summary}</span>
                    </div>
                    {char.referenceImageUrl && <span className="text-[9px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-full">ref ✓</span>}
                    {vp.characterId === char.id && <Check className="h-3.5 w-3.5 text-purple-500" />}
                  </button>
                ))}
              </div>
            )}

            <Button variant="outline" onClick={() => navigate("/dashboard/characters")} className="w-full gap-2 text-xs">
              <Sparkles className="h-3.5 w-3.5" />Criar Novo Personagem
            </Button>

            <Button onClick={() => setVpStep("narration")} className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-sm">
              <ArrowRight className="h-4 w-4" />
              {vp.characterId ? `Continuar com ${vp.characterName}` : "Continuar sem Personagem"}
            </Button>
            <button onClick={() => setVpStep("script")} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
              <ArrowLeft className="h-3 w-3" />Voltar
            </button>
          </div>
        )}

        {/* ── STEP 6: NARRATION ── */}
        {vpStep === "narration" && (
          <div className="space-y-3">
            <div className="text-center">
              <Mic className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-foreground">Etapa 6 — Narração</h3>
              <p className="text-[11px] text-muted-foreground">Gera a narração ou avança sem áudio</p>
            </div>

            <div className="rounded-xl border border-orange-400/20 bg-orange-500/5 p-3 space-y-2">
              {vp.characterVoiceId ? (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-xs">
                  <p className="text-green-700 dark:text-green-400">
                    <strong>{vp.characterName}</strong> tem voz ElevenLabs configurada.
                  </p>
                </div>
              ) : useElevenLabsVoice ? (
                <div className="bg-orange-500/10 border border-orange-400/20 rounded-lg p-2 text-xs">
                  <p className="text-orange-700 dark:text-orange-400">Voz ElevenLabs: <strong>{elevenLabs.voiceName}</strong></p>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Voz da narração (SavvyOwl)</p>
                  <div className="flex gap-1 flex-wrap">
                    {TTS_VOICES.map((v) => (
                      <button key={v.id} onClick={() => setSelectedTtsVoice(v)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${selectedTtsVoice.id === v.id ? "bg-orange-500 text-white" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
                        {v.name.split(" (")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!(voiceUrl || narrationStorageUrl) && (
                <Button onClick={handleGenerateVoice} disabled={voiceLoading} size="sm" className="gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white w-full">
                  {voiceLoading ? <><Loader2 className="h-3 w-3 animate-spin" />A gerar...</> : <><Mic className="h-3 w-3" />Gerar Narração</>}
                </Button>
              )}

              {voiceError && <p className="text-[10px] text-destructive">{voiceError}</p>}

              {(voiceUrl || narrationStorageUrl) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-400/20">
                    <Volume2 className="h-4 w-4 text-orange-400 shrink-0" />
                    <audio controls src={voiceUrl || narrationStorageUrl!} className="flex-1 h-7" />
                  </div>
                  <div className="flex gap-2">
                    {voiceUrl && (
                      <a href={voiceUrl} download={`${vp.selectedTitle || "narracao"}-savvyowl.mp3`}>
                        <Button variant="outline" size="sm" className="gap-1 text-xs text-orange-400 border-orange-400/30">
                          <Download className="h-3 w-3" />Download
                        </Button>
                      </a>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { setVoiceUrl(null); setVoiceError(null); setNarrationStorageUrl(null); setAudioDuration(null); }} className="text-xs text-muted-foreground">
                      <RefreshCw className="h-3 w-3 mr-1" />Gerar nova
                    </Button>
                  </div>
                  {audioDuration && (
                    <p className="text-[10px] text-muted-foreground">
                      Duração: {Math.floor(audioDuration / 60)}:{String(audioDuration % 60).padStart(2, "0")} · {vp.sceneCount} cenas auto-calculadas
                    </p>
                  )}
                </div>
              )}
            </div>

            <Button onClick={handleGenerateScenes} disabled={vpLoading} className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-sm">
              {vpLoading ? <><Loader2 className="h-4 w-4 animate-spin" />A gerar cenas...</> : <><Clapperboard className="h-4 w-4" />Gerar Cenas</>}
            </Button>
            <button onClick={() => setVpStep("character")} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
              <ArrowLeft className="h-3 w-3" />Voltar
            </button>
          </div>
        )}

        {/* ── STEP 7: SCENES (review + edit + copy) ── */}
        {vpStep === "scenes" && (
          <div className="space-y-3">
            <div className="text-center">
              <Clapperboard className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-foreground">Etapa 7 — Cenas</h3>
              <p className="text-[11px] text-muted-foreground">{vp.scenes.length} cenas · {vp.sceneDuration}s · {vp.aspectRatio}</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleExportPrompts} variant="outline" size="sm" className="gap-1 text-xs">
                <Copy className="h-3 w-3" />Copiar todos
              </Button>
              <Button onClick={() => setVpStep("generate")} size="sm" className="gap-1 text-xs bg-purple-600 hover:bg-purple-700">
                <Video className="h-3 w-3" />Gerar Vídeos
              </Button>
            </div>

            {vp.scenes.map((scene, i) => (
              <div key={i} className="rounded-xl border border-border/60 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-secondary/30">
                  <span className="text-[11px] font-semibold text-purple-500">Cena {scene.index}</span>
                  <span className="text-[10px] text-muted-foreground">{vp.sceneDuration}s</span>
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-xs text-foreground font-medium">{scene.description}</p>
                  <textarea
                    value={scene.prompt}
                    onChange={(e) => setVp((p) => ({ ...p, scenes: p.scenes.map((s, idx) => idx === i ? { ...s, prompt: e.target.value } : s) }))}
                    rows={2}
                    className="w-full rounded-lg border border-border/50 bg-secondary/10 px-2 py-1.5 text-[11px] text-foreground focus:outline-none focus:border-purple-400/30 resize-y"
                  />
                  <Button variant="ghost" size="sm" onClick={() => {
                    const alreadyHasIdentity = scene.prompt.includes("FIXED CHARACTER") || scene.prompt.includes("same person in every frame");
                    const fullPrompt = identityBlock && !alreadyHasIdentity ? `${identityBlock}\n\nSCENE: ${scene.prompt}` : scene.prompt;
                    navigator.clipboard.writeText(fullPrompt);
                    toast.success(`Prompt Cena ${scene.index} copiado!`);
                  }} className="gap-1 text-[10px] text-muted-foreground hover:text-purple-500">
                    <Copy className="h-3 w-3" />Copiar prompt completo
                  </Button>
                </div>
              </div>
            ))}

            <button onClick={() => setVpStep("narration")} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
              <ArrowLeft className="h-3 w-3" />Voltar
            </button>
          </div>
        )}

        {/* ── STEP 8: GENERATE (generate videos per scene) ── */}
        {vpStep === "generate" && (
          <div className="space-y-3">
            <div className="text-center">
              <Film className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-foreground">Etapa 8 — Gerar Vídeos</h3>
              <p className="text-[11px] text-muted-foreground">Clica em cada cena para gerar</p>
            </div>

            {vp.characterName && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-[10px] text-green-700 dark:text-green-400 flex items-center gap-1.5">
                <Users className="h-3 w-3 shrink-0" />
                Personagem: <strong>{vp.characterName}</strong>
                {vp.referenceImageUrl && " · Referência visual ativa"}
              </div>
            )}

            {vp.scenes.map((scene, i) => (
              <div key={i} className="rounded-xl border border-border/60 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-purple-500">Cena {scene.index}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">{scene.description}</span>
                  </div>
                  {scene.videoUrl && <Check className="h-3.5 w-3.5 text-green-500" />}
                </div>
                <div className="p-3">
                  {scene.videoUrl ? (
                    <div className="space-y-2">
                      <video src={scene.videoUrl} controls className="rounded-lg max-w-full max-h-[200px] border border-border/50" />
                      <a href={scene.videoUrl} download={`${vp.selectedTitle}-cena${scene.index}.mp4`}
                        className="inline-flex items-center gap-1 text-[10px] text-purple-500 hover:underline">
                        <Download className="h-3 w-3" />Download
                      </a>
                    </div>
                  ) : (
                    <Button onClick={() => handleGenerateVideo(i)} disabled={scene.generating} size="sm" className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700">
                      {scene.generating
                        ? <><Loader2 className="h-3 w-3 animate-spin" />A gerar...</>
                        : <><Video className="h-3 w-3" />Gerar Cena {scene.index} · {vp.sceneDuration <= 8 ? 10 : 5} créditos</>}
                    </Button>
                  )}
                  {scene.error && <p className="text-[10px] text-destructive mt-1">{scene.error}</p>}
                  <Button variant="ghost" size="sm" onClick={() => {
                    const alreadyHasIdentity = scene.prompt.includes("FIXED CHARACTER") || scene.prompt.includes("same person in every frame");
                    const fullPrompt = identityBlock && !alreadyHasIdentity ? `${identityBlock}\n\nSCENE: ${scene.prompt}` : scene.prompt;
                    navigator.clipboard.writeText(fullPrompt);
                    toast.success(`Prompt Cena ${scene.index} copiado!`);
                  }} className="gap-1 text-[10px] text-muted-foreground hover:text-purple-500 mt-1">
                    <Copy className="h-3 w-3" />Copiar prompt
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-2 border-t border-border/50">
              <Button onClick={handleExportPrompts} variant="outline" size="sm" className="gap-1 text-xs">
                <Copy className="h-3 w-3" />Exportar prompts
              </Button>
              <Button onClick={() => setVpStep("scenes")} variant="ghost" size="sm" className="text-xs">
                <ArrowLeft className="h-3 w-3 mr-1" />Editar cenas
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Template grid ──
  if (!activeTemplate) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full max-w-2xl">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => {
              const testPrompt = tpl.buildPrompt({});
              if (testPrompt.startsWith("__REDIRECT__")) {
                navigate(testPrompt.replace("__REDIRECT__", ""));
                return;
              }
              if (testPrompt.startsWith("__PIPELINE__")) {
                setPipelineActive(true);
                return;
              }
              setActiveTemplate(tpl);
              setFieldValues({});
            }}
            disabled={disabled}
            className="flex items-start gap-2.5 p-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/50 hover:border-border transition-all text-left group"
          >
            <span className="text-base mt-0.5">{tpl.emoji}</span>
            <div>
              <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground block leading-snug">{tpl.label}</span>
              <span className="text-[10px] text-muted-foreground/60 leading-tight block mt-0.5">{tpl.description}</span>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // ── Viral video selection ──
  if (activeTemplate?.id === "viral-modeling" && viralStep === "videos" && viralVideos.length > 0) {
    return (
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <h3 className="text-sm font-semibold text-foreground">
              {isPT ? `${viralVideos.length} vídeos virais encontrados` : `${viralVideos.length} viral videos found`}
            </h3>
          </div>
          <button onClick={resetViralFlow} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {isPT ? "Escolhe um vídeo para a SavvyOwl modelar e adaptar ao teu contexto:" : "Pick a video for SavvyOwl to model and adapt to your context:"}
        </p>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {viralVideos.map((vid: any) => (
            <button key={vid.id} onClick={() => handleViralVideoSelect(vid)}
              className="w-full flex gap-3 p-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/50 hover:border-primary/30 transition-all text-left group">
              <img src={vid.thumbnail} alt={vid.title} className="w-24 h-16 object-cover rounded-lg shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground group-hover:text-primary line-clamp-2 leading-snug mb-1">{vid.title}</p>
                <p className="text-[10px] text-muted-foreground mb-1">{vid.channel}</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                  <span className="flex items-center gap-1"><Eye className="h-2.5 w-2.5" />{formatNumber(vid.views)}</span>
                  <span className="flex items-center gap-1"><ThumbsUp className="h-2.5 w-2.5" />{formatNumber(vid.likes)}</span>
                  <span className="flex items-center gap-1"><Play className="h-2.5 w-2.5" />{vid.duration}</span>
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-primary mt-1" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Template form ──
  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{activeTemplate.emoji}</span>
          <h3 className="text-sm font-semibold text-foreground">{activeTemplate.label}</h3>
        </div>
        <button onClick={() => { resetViralFlow(); }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {activeCharacterName && activeTemplate && isSceneTemplate(activeTemplate.id) && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-green-500/30 bg-green-500/5">
            <Lock className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-green-600 dark:text-green-400">
                {isPT ? "Personagem ativo" : "Active character"}: {activeCharacterName}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isPT
                  ? "Identity block + negative prompt serão injetados automaticamente em cada prompt gerado"
                  : "Identity block + negative prompt will be auto-injected into every generated prompt"}
              </p>
            </div>
          </div>
        )}

        {!activeCharacterName && activeTemplate && isSceneTemplate(activeTemplate.id) && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5">
            <Users className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground">
                {isPT
                  ? "Nenhum personagem selecionado. As cenas serão geradas sem identity lock. Seleciona um personagem no seletor acima para consistência visual."
                  : "No character selected. Scenes will be generated without identity lock. Select a character above for visual consistency."}
              </p>
            </div>
          </div>
        )}

        {activeTemplate.fields.map((field) => (
          <div key={field.key}>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.label}</label>
            {field.type === "select" ? (
              <div className="flex flex-wrap gap-1.5">
                {field.options?.map((opt) => (
                  <button key={opt} onClick={() => setFieldValues((prev) => ({ ...prev, [field.key]: opt }))}
                    className={`px-2.5 py-1 rounded-full text-xs transition-all ${fieldValues[field.key] === opt ? "bg-foreground text-background" : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <input type="text" value={fieldValues[field.key] || ""} onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-border/60 bg-secondary/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/15 transition-colors" />
            )}
          </div>
        ))}
      </div>

      <Button onClick={handleSubmitTemplate} disabled={disabled || viralLoading} className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90" size="sm">
        {viralLoading
          ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{isPT ? "A buscar vídeos virais..." : "Searching viral videos..."}</>
          : activeTemplate?.id === "viral-modeling"
            ? <><ChevronRight className="h-4 w-4 mr-1.5" />{isPT ? "Buscar vídeos virais" : "Search viral videos"}</>
            : <><ChevronRight className="h-4 w-4 mr-1.5" />{isPT ? "Gerar conteúdo" : "Generate content"}</>}
      </Button>
    </div>
  );
}
