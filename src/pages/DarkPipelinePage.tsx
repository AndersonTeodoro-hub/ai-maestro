import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCharacter } from "@/contexts/CharacterContext";
import { useElevenLabsKey } from "@/hooks/useElevenLabsKey";
import { supabase } from "@/integrations/supabase/client";
import { buildStyleBlock } from "@/lib/dark-pipeline/style-engine";
import { getNicheScriptPrompt } from "@/lib/dark-pipeline/niche-prompts";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, ArrowRight, Check, Loader2, Video, Copy,
  Download, Users, Sparkles, FileText, Clapperboard,
  Film, Image, Clock, Coins, RefreshCw, Mic, Volume2, ChevronDown,
  Palette, Plus, Trash2, Pencil, X, UserPlus,
} from "lucide-react";

type Step = "niche" | "style" | "theme" | "title" | "script" | "character" | "scenes" | "generate";

interface StyleCharacter {
  id: string;
  name: string;
  physicalDescription: string;
  isPrimary?: boolean;
}

interface StyleProfile {
  id: string;
  user_id: string;
  niche: string;
  name: string;
  visual_description: string;
  color_palette: string | null;
  atmosphere: string | null;
  scene_types: string | null;
  characters: StyleCharacter[];
  character_images: Record<string, string> | null;
  created_at: string;
}

interface SceneData {
  index: number;
  prompt: string;
  description: string;
  videoUrl?: string;
  generating?: boolean;
  error?: string;
  narrationText?: string;
  audioUrl?: string;
  lipsyncVideoUrl?: string;
  lipsyncStatus?: "pending" | "processing" | "done" | "error";
}

interface PipelineState {
  niche: string;
  styleProfileId: string | null;
  styleProfile: StyleProfile | null;
  theme: string;
  titles: string[];
  selectedTitle: string;
  wordCount: number;
  script: string;
  characterId: string | null;
  characterName: string | null;
  characterVoiceId: string | null;
  referenceImageUrl: string | null;
  sceneDuration: 15;
  sceneCount: number;
  scenes: SceneData[];
  aspectRatio: string;
  speechLang: string;
}

const NICHE_IDS = [
  { id: "biblicas", emoji: "✝️" },
  { id: "motivacional", emoji: "🔥" },
  { id: "curiosidades", emoji: "🧠" },
  { id: "historias-reais", emoji: "📖" },
  { id: "corpo-humano", emoji: "🫀" },
];

const SPEECH_LANGS = [
  { id: "pt-BR", label: "Português (BR)", prompt: "em português do Brasil" },
  { id: "pt-PT", label: "Português (PT)", prompt: "em português de Portugal" },
  { id: "en",    label: "English",         prompt: "in English" },
  { id: "es",    label: "Español",         prompt: "en español" },
];

function getDefaultSpeechLang(lang: string): string {
  if (lang.startsWith("pt")) return "pt-BR";
  if (lang.startsWith("es")) return "es";
  if (lang.startsWith("en")) return "en";
  return "pt-BR";
}

function getSpeechLangPrompt(id: string): string {
  return SPEECH_LANGS.find((l) => l.id === id)?.prompt ?? "em português do Brasil";
}

const STEP_KEYS: { key: Step; icon: any }[] = [
  { key: "niche", icon: Sparkles },
  { key: "style", icon: Palette },
  { key: "theme", icon: Sparkles },
  { key: "title", icon: FileText },
  { key: "script", icon: FileText },
  { key: "character", icon: Users },
  { key: "scenes", icon: Clapperboard },
  { key: "generate", icon: Film },
];

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

  // The chat function returns SSE stream, not JSON
  const contentType = resp.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream")) {
    // Read SSE stream and collect all text chunks
    const reader = resp.body?.getReader();
    if (!reader) throw new Error("No response stream");
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      // Parse SSE lines: data: {"choices":[{"delta":{"content":"text"}}]}
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed.choices?.[0]?.delta?.content || "";
          fullText += text;
        } catch {
          // skip non-JSON lines
        }
      }
    }
    return fullText.trim();
  }

  // Fallback: regular JSON response (error cases)
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data.reply || data.message || data.content || JSON.stringify(data);
}

export default function DarkPipelinePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { characters, activeCharacter, selectCharacter, referenceImageUrl, identityBlock, wanT2VBlock, negativePrompt } = useCharacter();
  const elevenLabs = useElevenLabsKey();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const NICHES = NICHE_IDS.map((n) => ({ ...n, label: t(`dp.niches.${n.id}`) }));
  const STEPS = STEP_KEYS.map((s) => ({ ...s, label: t(`dp.steps.${s.key}`) }));

  // Persist pipeline state in localStorage
  const STORAGE_KEY = "savvyowl_dark_pipeline";
  const [step, setStep] = useState<Step>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).step || "niche";
    } catch {}
    return "niche";
  });
  const [loading, setLoading] = useState(false);

  // Voice generation state
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [sceneAudiosGenerating, setSceneAudiosGenerating] = useState(false);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [narrationStorageUrl, setNarrationStorageUrl] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).narrationStorageUrl || null;
    } catch {}
    return null;
  });
  const [audioDuration, setAudioDuration] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).audioDuration || null;
    } catch {}
    return null;
  });
  const [showVoiceOptions, setShowVoiceOptions] = useState(false);
  const [selectedTtsVoice, setSelectedTtsVoice] = useState(() => {
    try {
      const stored = localStorage.getItem("savvyowl_tts_voice");
      return stored ? JSON.parse(stored) : { id: "Charon", name: "Charon (Masculino)" };
    } catch { return { id: "Charon", name: "Charon (Masculino)" }; }
  });

  const TTS_VOICES = [
    { id: "Charon", name: "Charon (Masculino, Sério)" },
    { id: "Gacrux", name: "Gacrux (Masculino, Maduro)" },
    { id: "Algieba", name: "Algieba (Masculino, Suave)" },
    { id: "Puck", name: "Puck (Masculino, Animado)" },
    { id: "Kore", name: "Kore (Feminino, Firme)" },
    { id: "Zephyr", name: "Zephyr (Feminino, Luminosa)" },
    { id: "Aoede", name: "Aoede (Feminino, Leve)" },
  ];

  const useElevenLabsVoice = elevenLabs.hasKey && elevenLabs.hasVoice;
  const [pipeline, setPipeline] = useState<PipelineState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved).pipeline;
        if (parsed?.theme) {
          // Reset generating flags — polling dies on page reload
          if (parsed.scenes?.length) {
            parsed.scenes = parsed.scenes.map((s: any) => ({ ...s, generating: false, error: undefined }));
          }
          return parsed;
        }
      }
    } catch {}
    return {
      niche: "",
      styleProfileId: null,
      styleProfile: null,
      theme: "",
      titles: [],
      selectedTitle: "",
      wordCount: 450,
      script: "",
      characterId: null,
      characterName: null,
      characterVoiceId: null,
      referenceImageUrl: null,
      sceneDuration: 15,
      sceneCount: 5,
      scenes: [],
      aspectRatio: "9:16",
      speechLang: getDefaultSpeechLang(i18n.language),
    };
  });

  // Save state to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      step,
      pipeline,
      narrationStorageUrl,
      audioDuration,
    }));
  }, [step, pipeline, narrationStorageUrl, audioDuration]);

  // Ref to always read latest pipeline in async callbacks (avoids stale closure)
  const pipelineRef = useRef(pipeline);
  useEffect(() => { pipelineRef.current = pipeline; }, [pipeline]);

  // Re-select character from localStorage after page reload or navigation
  // Without this, identityBlock is null because activeCharacter resets to null on mount
  useEffect(() => {
    if (pipeline.characterId && characters.length > 0 && !activeCharacter) {
      const found = characters.find((c) => c.id === pipeline.characterId);
      if (found) {
        selectCharacter(pipeline.characterId);
        console.log(`[PIPELINE] Re-selected character "${found.name}" from saved state`);
      }
    }
  }, [pipeline.characterId, characters, activeCharacter, selectCharacter]);

  // ── Style Profile state ──
  const [styleProfiles, setStyleProfiles] = useState<StyleProfile[]>([]);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleFormOpen, setStyleFormOpen] = useState(false);
  const [styleForm, setStyleForm] = useState({ name: "", visual_description: "", color_palette: "", atmosphere: "", scene_types: "" });
  const [styleFormChars, setStyleFormChars] = useState<StyleCharacter[]>([]);
  const [charFormOpen, setCharFormOpen] = useState(false);
  const [charEditIndex, setCharEditIndex] = useState<number | null>(null);
  const [charForm, setCharForm] = useState({ name: "", physicalDescription: "" });
  const [charImageGenerating, setCharImageGenerating] = useState<Record<string, boolean>>({});
  const [charImageUrls, setCharImageUrls] = useState<Record<string, string>>({});

  // Load style profiles when niche changes
  useEffect(() => {
    if (!pipeline.niche || !user?.id) return;
    const load = async () => {
      setStyleLoading(true);
      const { data } = await supabase
        .from("style_profiles" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("niche", pipeline.niche)
        .order("created_at", { ascending: false });
      setStyleProfiles((data as any as StyleProfile[]) || []);
      setStyleLoading(false);
    };
    load();
  }, [pipeline.niche, user?.id]);

  const handleCreateStyleProfile = async () => {
    if (!user?.id || !styleForm.name.trim() || !styleForm.visual_description.trim()) return;
    setStyleLoading(true);
    try {
      const { data, error } = await supabase
        .from("style_profiles" as any)
        .insert({
          user_id: user.id,
          niche: pipeline.niche,
          name: styleForm.name.trim(),
          visual_description: styleForm.visual_description.trim(),
          color_palette: styleForm.color_palette.trim() || null,
          atmosphere: styleForm.atmosphere.trim() || null,
          scene_types: styleForm.scene_types.trim() || null,
          characters: styleFormChars,
          character_images: {},
        } as any)
        .select()
        .single();
      if (error) throw error;
      const created = data as any as StyleProfile;
      setStyleProfiles((prev) => [created, ...prev]);
      setPipeline((p) => ({ ...p, styleProfileId: created.id, styleProfile: created }));
      setStyleFormOpen(false);
      setStyleForm({ name: "", visual_description: "", color_palette: "", atmosphere: "", scene_types: "" });
      setStyleFormChars([]);
      toast.success(t("dp.style.created"));
      setStep("theme");
    } catch (e: any) {
      toast.error(e.message || t("dp.style.createError"));
    } finally {
      setStyleLoading(false);
    }
  };

  const handleDeleteStyleProfile = async (id: string) => {
    const { error } = await supabase.from("style_profiles" as any).delete().eq("id", id);
    if (error) { toast.error(t("dp.style.deleteError")); return; }
    setStyleProfiles((prev) => prev.filter((p) => p.id !== id));
    if (pipeline.styleProfileId === id) {
      setPipeline((p) => ({ ...p, styleProfileId: null, styleProfile: null }));
    }
    toast.success(t("dp.style.deleted"));
  };

  const handleSelectStyleProfile = (sp: StyleProfile) => {
    setPipeline((p) => ({ ...p, styleProfileId: sp.id, styleProfile: sp }));
    setStep("theme");
  };

  const handleOpenCharForm = (editIdx?: number) => {
    if (editIdx !== undefined) {
      const c = styleFormChars[editIdx];
      setCharForm({ name: c.name, physicalDescription: c.physicalDescription });
      setCharEditIndex(editIdx);
    } else {
      setCharForm({ name: "", physicalDescription: "" });
      setCharEditIndex(null);
    }
    setCharFormOpen(true);
  };

  const handleSaveChar = () => {
    if (!charForm.name.trim() || !charForm.physicalDescription.trim()) return;
    const newChar: StyleCharacter = {
      id: charEditIndex !== null ? styleFormChars[charEditIndex].id : crypto.randomUUID(),
      name: charForm.name.trim(),
      physicalDescription: charForm.physicalDescription.trim(),
    };
    if (charEditIndex !== null) {
      setStyleFormChars((prev) => prev.map((c, i) => i === charEditIndex ? newChar : c));
    } else {
      setStyleFormChars((prev) => [...prev, newChar]);
    }
    setCharFormOpen(false);
    setCharForm({ name: "", physicalDescription: "" });
    setCharEditIndex(null);
  };

  const handleTogglePrimary = (idx: number) => {
    setStyleFormChars((prev) => prev.map((c, i) => ({
      ...c,
      isPrimary: i === idx ? !c.isPrimary : false,
    })));
  };

  const handleGenerateCharImage = async (charIdx: number) => {
    const char = styleFormChars[charIdx];
    if (!char || !user?.id) return;

    setCharImageGenerating((prev) => ({ ...prev, [char.id]: true }));
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`;

      // Build prompt with style context
      const styleCtx = styleForm.visual_description
        ? `Visual style: ${styleForm.visual_description}. ${styleForm.color_palette ? `Colors: ${styleForm.color_palette}.` : ""} ${styleForm.atmosphere ? `Atmosphere: ${styleForm.atmosphere}.` : ""}`
        : "";
      const imgPrompt = `${styleCtx} ${char.physicalDescription}. Character reference sheet, full body, front view, neutral pose, cinematic lighting, photorealistic, highly detailed, 4K.`.trim();

      // Submit to Flux
      const submitResp = await fetch(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt: imgPrompt, engine: "flux" }),
      });
      const submitData = await submitResp.json();
      if (submitData.error) throw new Error(submitData.error === "insufficient_credits" ? submitData.message : submitData.error);
      if (submitData.status !== "SUBMITTED") throw new Error("Falha ao submeter");

      const { statusUrl, responseUrl } = submitData;
      toast.info(t("dp.style.imageGenerating", { name: char.name }));

      // Poll for result
      const maxWait = 120000;
      const pollInterval = 3000;
      let elapsed = 0;
      while (elapsed < maxWait) {
        await new Promise((r) => setTimeout(r, pollInterval));
        elapsed += pollInterval;

        const pollResp = await fetch(baseUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ engine: "flux", action: "poll", requestId: "poll", statusUrl, responseUrl }),
        });
        const pollData = await pollResp.json();

        if (pollData.status === "COMPLETED" && pollData.imageUrl) {
          // Upload to Supabase Storage
          const imgResp = await fetch(pollData.imageUrl);
          const imgBlob = await imgResp.blob();
          const safeName = char.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
          const profileId = pipeline.styleProfileId || "draft";
          const storagePath = `style-references/${user.id}/${profileId}/${safeName}.png`;

          await supabase.storage
            .from("character-references")
            .upload(storagePath, imgBlob, { contentType: "image/png", upsert: true });

          const { data: urlData } = supabase.storage
            .from("character-references")
            .getPublicUrl(storagePath);

          const publicUrl = urlData?.publicUrl || pollData.imageUrl;
          setCharImageUrls((prev) => ({ ...prev, [char.id]: publicUrl }));

          // Update character_images in DB if profile already exists
          if (pipeline.styleProfileId && pipeline.styleProfileId !== "draft") {
            const currentImages = pipeline.styleProfile?.character_images || {};
            const updatedImages = { ...currentImages, [char.id]: publicUrl };
            await supabase
              .from("style_profiles" as any)
              .update({ character_images: updatedImages } as any)
              .eq("id", pipeline.styleProfileId);
            setPipeline((p) => ({
              ...p,
              styleProfile: p.styleProfile ? { ...p.styleProfile, character_images: updatedImages } : p.styleProfile,
            }));
          }

          toast.success(t("dp.style.imageGenerated", { name: char.name }));
          setCharImageGenerating((prev) => ({ ...prev, [char.id]: false }));
          return;
        }
        if (pollData.status === "FAILED") {
          throw new Error(pollData.error || t("dp.style.imageFailed"));
        }
      }
      throw new Error(t("dp.style.imageTimeout"));
    } catch (e: any) {
      toast.error(e.message || t("dp.style.imageError"));
      setCharImageGenerating((prev) => ({ ...prev, [char.id]: false }));
    }
  };

  const handleRemoveChar = (idx: number) => {
    setStyleFormChars((prev) => prev.filter((_, i) => i !== idx));
  };

  // Reset pipeline (new project)
  const handleNewProject = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStep("niche");
    setPipeline({
      niche: "", styleProfileId: null, styleProfile: null, theme: "", titles: [], selectedTitle: "", wordCount: 450, script: "",
      characterId: null, characterName: null, characterVoiceId: null,
      referenceImageUrl: null, sceneDuration: 15, sceneCount: 5, scenes: [], aspectRatio: "9:16", speechLang: getDefaultSpeechLang(i18n.language),
    });
    setVoiceUrl(null);
    setNarrationStorageUrl(null);
    setAudioDuration(null);
    toast.success(t("dp.newProjectStarted"));
  };

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  };

  // ── STEP 1: Generate titles from theme ──
  const handleGenerateTitles = async () => {
    if (!pipeline.theme.trim()) return;
    setLoading(true);
    try {
      const token = await getToken();
      const reply = await callChat(
        `Gera exatamente 5 títulos para vídeo sobre o tema: "${pipeline.theme}".
Nicho: ${pipeline.niche || "geral"}

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
      setPipeline((p) => ({ ...p, titles }));
      setStep("title");
    } catch (e: any) {
      toast.error(e.message || t("dp.theme.error"));
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 2: Generate script from title ──
  const handleGenerateScript = async () => {
    if (!pipeline.selectedTitle) return;
    setLoading(true);
    try {
      const token = await getToken();

      // Use niche-specific prompt if available, fallback to generic
      const nichePrompt = getNicheScriptPrompt(
        pipeline.niche,
        pipeline.selectedTitle,
        pipeline.theme,
        pipeline.wordCount,
      );

      const genericPrompt = `Escreve um roteiro completo para vídeo com o título: "${pipeline.selectedTitle}".
Tema original: "${pipeline.theme}"

REGRAS DE ESTRUTURA:
- Exatamente ${pipeline.wordCount} palavras (pode variar ±10%)
- Em Português do Brasil
- Apenas o texto de narração puro — SEM indicações de cena, SEM timestamps, SEM [corte], SEM (pausa)

ESTRUTURA OBRIGATÓRIA DO ROTEIRO:
1. HOOK (primeiros 5-8 segundos / ~30 palavras): Frase de abertura que PRENDE imediatamente.
2. DESENVOLVIMENTO (corpo principal): Narração imersiva, envolvente, com ritmo emocional.
3. CTAs NATIVOS (2-3, distribuídos dentro do roteiro de forma NATURAL).
4. CONCLUSÃO (últimos ~50 palavras): Encerramento emocional forte.

REGRA ABSOLUTA DE OUTPUT:
- Retorna APENAS o texto de narração. NADA MAIS.
- SEM título, SEM cabeçalho, SEM markdown, SEM menções a ferramentas.
- O output deve ser EXCLUSIVAMENTE o texto que será narrado em voz alta.`;

      const reply = await callChat(nichePrompt || genericPrompt, token);
      setPipeline((p) => ({ ...p, script: reply }));
      setStep("script");
    } catch (e: any) {
      toast.error(e.message || t("dp.script.error"));
    } finally {
      setLoading(false);
    }
  };

  // ── Voice generation ──
  const handleGenerateVoice = async () => {
    if (!pipeline.script.trim()) return;
    setVoiceLoading(true);
    setVoiceError(null);
    setVoiceUrl(null);
    setNarrationStorageUrl(null);

    try {
      // Priority: 1) Character voice ID → 2) Global ElevenLabs → 3) TTS
      const hasCharVoice = !!pipeline.characterVoiceId && elevenLabs.hasKey;
      const useEL = hasCharVoice || useElevenLabsVoice;

      const voiceBody: any = {
        text: pipeline.script,
        voiceId: hasCharVoice ? pipeline.characterVoiceId : (useElevenLabsVoice ? elevenLabs.voiceId : selectedTtsVoice.id),
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
          const raw = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
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

        // Get audio duration to auto-calculate scene count
        const audio = new Audio(blobUrl);
        audio.addEventListener("loadedmetadata", () => {
          const dur = Math.ceil(audio.duration);
          setAudioDuration(dur);
          // Auto-calculate scene count based on audio duration
          const autoScenes = Math.ceil(dur / pipeline.sceneDuration);
          setPipeline((p) => ({ ...p, sceneCount: autoScenes }));
          console.log(`[VOICE] Audio duration: ${dur}s → ${autoScenes} cenas de ${pipeline.sceneDuration}s`);
        });

        // Upload to Supabase Storage for lip-sync pipeline
        if (user?.id) {
          try {
            const ext = mimeType.includes("wav") ? "wav" : "mp3";
            const storagePath = `narrations/${user.id}/${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from("character-references")
              .upload(storagePath, blob, { contentType: mimeType, upsert: true });

            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from("character-references")
                .getPublicUrl(storagePath);
              if (urlData?.publicUrl) {
                setNarrationStorageUrl(urlData.publicUrl);
                console.log("[VOICE] Narration uploaded for lip-sync:", urlData.publicUrl);
              }
            }
          } catch (uploadErr) {
            console.log("[VOICE] Storage upload failed (non-blocking):", uploadErr);
          }
        }

        toast.success(t("dp.narration.generated"));
      }
    } catch (e: any) {
      setVoiceError(e.message || t("dp.narration.error"));
      toast.error(t("dp.narration.error"));
    } finally {
      setVoiceLoading(false);
    }
  };

  // ── Per-scene audio generation ──
  const generateSceneAudios = async (scenes: SceneData[]) => {
    if (!user?.id) return;
    const scenesWithText = scenes.filter((s) => s.narrationText?.trim());
    if (scenesWithText.length === 0) return;

    setSceneAudiosGenerating(true);
    const hasCharVoice = !!pipeline.characterVoiceId && elevenLabs.hasKey;
    const useEL = hasCharVoice || useElevenLabsVoice;

    for (const scene of scenesWithText) {
      try {
        const voiceBody: any = {
          text: scene.narrationText,
          voiceId: hasCharVoice
            ? pipeline.characterVoiceId
            : useElevenLabsVoice
              ? elevenLabs.voiceId
              : selectedTtsVoice.id,
          provider: useEL ? "elevenlabs" : "gemini",
        };
        if (useEL) voiceBody.elevenLabsKey = elevenLabs.apiKey;

        const { data, error: fnError } = await supabase.functions.invoke("generate-voice", { body: voiceBody });
        if (fnError || data?.error) {
          const errMsg: string = fnError?.message || data?.error || "";
          if (errMsg.includes("voice_not_found")) {
            toast.error(t("dp.narration.voiceNotFound"));
            setSceneAudiosGenerating(false);
            return;
          }
          console.warn(`[SCENE AUDIO] Cena ${scene.index} falhou:`, errMsg);
          continue;
        }
        if (!data?.audio) continue;

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

        const ext = mimeType.includes("wav") ? "wav" : "mp3";
        const storagePath = `narrations/${user.id}/scene_${scene.index}_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("character-references")
          .upload(storagePath, blob, { contentType: mimeType, upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("character-references")
            .getPublicUrl(storagePath);
          if (urlData?.publicUrl) {
            const audioUrl = urlData.publicUrl;
            setPipeline((p) => ({
              ...p,
              scenes: p.scenes.map((s) =>
                s.index === scene.index ? { ...s, audioUrl } : s
              ),
            }));
            console.log(`[SCENE AUDIO] Cena ${scene.index} pronta:`, audioUrl);
          }
        }
      } catch (err) {
        console.warn(`[SCENE AUDIO] Erro cena ${scene.index}:`, err);
      }
    }
    setSceneAudiosGenerating(false);
    toast.success(t("dp.narration.audioReady"));
  };

  // ── STEP 4: Generate scene prompts from script ──
  const handleGenerateScenes = async () => {
    if (!pipeline.script) return;

    // Safety: if character is selected but identityBlock is not loaded yet, warn and abort
    if (pipeline.characterId && !identityBlock) {
      toast.error(t("dp.scenes.identityNotLoaded"));
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      // Build character identity for scene prompts
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
        : pipeline.characterName
          ? `O personagem principal é: ${pipeline.characterName}. Mantém a mesma pessoa em todas as cenas.`
          : "";
      const hasNarrationForScenes = !!narrationStorageUrl || !!voiceUrl;
      const silentRule = hasNarrationForScenes
        ? `   - OBRIGATÓRIO no final de CADA prompt: "No dialogue, no speech, no voiceover, no narration, no text on screen. Silent cinematic footage only. Audio will be added separately."`
        : `   - O vídeo DEVE ter áudio nativo: sons ambiente, diálogos ${getSpeechLangPrompt(pipeline.speechLang)} se o personagem falar, sons naturais da cena. O áudio faz parte do vídeo.`;

      // Build style block from style profile (if selected)
      const styleBlock = pipeline.styleProfile
        ? buildStyleBlock(pipeline.styleProfile)
        : "";
      const styleSection = styleBlock
        ? `\nESTILO VISUAL OBRIGATÓRIO:\n"""\n${styleBlock}\n"""\n- Cada prompt de cena DEVE seguir este estilo visual. Iluminação, cores, atmosfera e composição devem reflectir o estilo definido acima.\n`
        : "";

      const reply = await callChat(
        `Analisa este roteiro e divide-o em exatamente ${pipeline.sceneCount} cenas visuais para geração de vídeo IA.

ROTEIRO:
${pipeline.script}

${charSection}
${styleSection}
Para cada cena, gera:
1. Descrição curta da cena (1 frase em PT)
2. Prompt completo em inglês para geração de vídeo IA (3-5 frases). O prompt deve descrever:
   - O que o personagem FAZ na cena (acção, expressão, gestos)
   - Ambiente e cenário detalhado
   - Iluminação específica
   - Movimento de câmera (close-up, medium shot, wide, etc.)
   - "Photorealistic, shot on iPhone 15 Pro, handheld, available light, UGC aesthetic"
   - NÃO incluas a descrição física do personagem no prompt (é adicionada automaticamente)
${styleBlock ? "   - OBRIGATÓRIO: segue o estilo visual definido acima (paleta de cores, atmosfera, composição)" : ""}
${silentRule}

Formato OBRIGATÓRIO (uma cena por bloco):
CENA 1:
DESC: [descrição em PT]
PROMPT: [prompt em inglês]

CENA 2:
DESC: [descrição em PT]
PROMPT: [prompt em inglês]

...e assim por diante até CENA ${pipeline.sceneCount}.
Sem texto adicional fora deste formato.`,
        token,
        identityBlock,
        identityBlock ? "deep" : "quick"
      );

      // Parse scenes — split on "CENA N:" pattern, filter only blocks with DESC/PROMPT
      const sceneBlocks = reply.split(/CENA\s*\d+\s*:/i).filter((b) => b.trim());
      const scenes: SceneData[] = [];
      for (const block of sceneBlocks) {
        const descMatch = block.match(/DESC:\s*(.+?)(?=PROMPT:|$)/si);
        const promptMatch = block.match(/PROMPT:\s*([\s\S]+?)(?=CENA\s*\d+|$)/si);
        // Only accept blocks that have both DESC and PROMPT
        if (descMatch && promptMatch) {
          scenes.push({
            index: scenes.length + 1,
            description: descMatch[1].trim(),
            prompt: promptMatch[1].trim().replace(/\n{3,}/g, "\n\n"), // clean excessive newlines
          });
        }
        if (scenes.length >= pipeline.sceneCount) break;
      }

      // Fill if we got fewer than expected
      while (scenes.length < pipeline.sceneCount) {
        scenes.push({
          index: scenes.length + 1,
          description: `Cena ${scenes.length + 1}`,
          prompt: "Atmospheric dark scene with mysterious lighting",
        });
      }

      // ── Divide narration text per scene ──
      // Split script into sentences (by . ! ? followed by space/newline)
      // then distribute proportionally across scenes
      if (pipeline.script && scenes.length > 0) {
        const sentences = pipeline.script
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const total = sentences.length;
        const perScene = Math.ceil(total / scenes.length);
        for (let i = 0; i < scenes.length; i++) {
          const start = i * perScene;
          const end = Math.min(start + perScene, total);
          scenes[i].narrationText = sentences.slice(start, end).join(" ");
        }
      }

      setPipeline((p) => ({ ...p, scenes }));
      setStep("scenes");

      // Generate per-scene audio in background if narration exists
      if (hasNarrationForScenes) {
        generateSceneAudios(scenes); // fire-and-forget — audioUrl atualiza por cena
      }
    } catch (e: any) {
      toast.error(e.message || t("dp.scenes.error"));
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 6: Generate video for a scene ──
  const handleGenerateVideo = async (sceneIndex: number) => {
    const scene = pipeline.scenes[sceneIndex];
    if (!scene) return;

    setPipeline((p) => ({
      ...p,
      scenes: p.scenes.map((s, i) =>
        i === sceneIndex ? { ...s, generating: true, error: undefined } : s
      ),
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

      // ── MODEL SELECTION — R2V if primary character has reference image, otherwise T2V ──
      const primaryChar = pipeline.styleProfile?.characters?.find((c: StyleCharacter) => c.isPrimary);
      const primaryCharImageUrl = primaryChar
        ? (pipeline.styleProfile?.character_images as any)?.[primaryChar.id] || charImageUrls[primaryChar.id]
        : null;
      const model = primaryCharImageUrl ? "wan26-r2v-flash" : "wan26-t2v-flash";
      const videoDuration = primaryCharImageUrl ? 10 : pipeline.sceneDuration;

      // ── BUILD PROMPT — always Wan 2.6 T2V (dense prose identity) ──
      const promptAlreadyHasIdentity = scene.prompt.includes("FIXED CHARACTER") || scene.prompt.includes("same person in every frame");

      // Style block from style profile (prepended for visual consistency)
      const videoStyleBlock = pipeline.styleProfile
        ? buildStyleBlock(pipeline.styleProfile)
        : "";

      let finalPrompt: string;
      if (promptAlreadyHasIdentity) {
        finalPrompt = videoStyleBlock
          ? `${videoStyleBlock} ${scene.prompt}`
          : scene.prompt;
      } else {
        const identity = wanT2VBlock || "";
        const style = videoStyleBlock ? `${videoStyleBlock} ` : "";
        finalPrompt = identity
          ? `${identity} ${style}SCENE: ${scene.prompt}`
          : `${style}${scene.prompt}`;
      }

      // Step 1: Submit job
      const submitBody: Record<string, unknown> = {
        prompt: finalPrompt,
        aspectRatio: pipeline.aspectRatio,
        duration: videoDuration,
        model,
      };
      if (primaryCharImageUrl && model === "wan26-r2v-flash") {
        submitBody.referenceImageUrl = primaryCharImageUrl;
      }
      const submitResp = await fetch(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(submitBody),
      });

      const submitData = await submitResp.json();
      if (submitData.error) throw new Error(submitData.error);
      if (submitData.status !== "SUBMITTED") throw new Error("Falha ao submeter");

      const { requestId, statusUrl, responseUrl } = submitData;

      // Step 2: Poll for result (from frontend — no timeout issue)
      const maxWait = 600000; // 10 min max
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
          const rawVideoUrl = pollData.videoUrl;

          // Check if this scene has per-scene audio ready for lip-sync
          // Use pipelineRef to read latest state (avoids stale closure — audioUrl set asynchronously)
          const audioUrl = pipelineRef.current.scenes[sceneIndex]?.audioUrl;

          if (audioUrl) {
            // Mark scene: video ready, lip-sync in progress
            setPipeline((p) => ({
              ...p,
              scenes: p.scenes.map((s, i) =>
                i === sceneIndex
                  ? { ...s, videoUrl: rawVideoUrl, generating: true, lipsyncStatus: "processing" }
                  : s
              ),
            }));
            toast.info(t("dp.generate.sceneLipsync", { index: sceneIndex + 1 }));

            // Submit lip-sync job
            const lsSubmitResp = await fetch(baseUrl, {
              method: "POST",
              headers,
              body: JSON.stringify({ action: "lipsync", videoUrl: rawVideoUrl, audioUrl }),
            });
            const lsSubmitData = await lsSubmitResp.json();
            if (lsSubmitData.error) throw new Error(lsSubmitData.error);
            if (lsSubmitData.status !== "SUBMITTED") throw new Error("Falha ao submeter lip-sync");

            const { requestId: lsRequestId, statusUrl: lsStatusUrl, responseUrl: lsResponseUrl } = lsSubmitData;

            // Poll lip-sync result
            let lsElapsed = 0;
            while (lsElapsed < maxWait) {
              await new Promise((r) => setTimeout(r, pollInterval));
              lsElapsed += pollInterval;

              const lsPollResp = await fetch(baseUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({ action: "poll", requestId: lsRequestId, statusUrl: lsStatusUrl, responseUrl: lsResponseUrl }),
              });
              const lsPollData = await lsPollResp.json();

              if (lsPollData.status === "COMPLETED" && lsPollData.videoUrl) {
                setPipeline((p) => ({
                  ...p,
                  scenes: p.scenes.map((s, i) =>
                    i === sceneIndex
                      ? { ...s, videoUrl: lsPollData.videoUrl, lipsyncVideoUrl: lsPollData.videoUrl, generating: false, lipsyncStatus: "done" }
                      : s
                  ),
                }));
                toast.success(t("dp.generate.sceneLipsyncDone", { index: sceneIndex + 1, seconds: Math.round((elapsed + lsElapsed) / 1000) }));
                refreshProfile();
                return;
              }

              if (lsPollData.status === "FAILED") {
                // Lip-sync failed — preserve raw video, don't throw
                setPipeline((p) => ({
                  ...p,
                  scenes: p.scenes.map((s, i) =>
                    i === sceneIndex ? { ...s, generating: false, lipsyncStatus: "error" } : s
                  ),
                }));
                toast.warning(t("dp.generate.sceneLipsyncFailed", { index: sceneIndex + 1 }));
                refreshProfile();
                return;
              }
            }

            // Lip-sync timeout — preserve raw video
            setPipeline((p) => ({
              ...p,
              scenes: p.scenes.map((s, i) =>
                i === sceneIndex ? { ...s, generating: false, lipsyncStatus: "error" } : s
              ),
            }));
            toast.warning(t("dp.generate.sceneLipsyncTimeout", { index: sceneIndex + 1 }));
            refreshProfile();
            return;
          }

          // No audioUrl — set video normally (no lip-sync)
          setPipeline((p) => ({
            ...p,
            scenes: p.scenes.map((s, i) =>
              i === sceneIndex ? { ...s, videoUrl: rawVideoUrl, generating: false } : s
            ),
          }));
          toast.success(t("dp.generate.sceneGenerated", { index: sceneIndex + 1, seconds: Math.round(elapsed / 1000) }));
          refreshProfile();
          return;
        }

        if (pollData.status === "FAILED") {
          // Refund credits
          try {
            await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify({ action: "refund", model }) });
            refreshProfile();
            toast.warning(t("dp.generate.sceneFailed", { index: sceneIndex + 1 }));
          } catch {}
          throw new Error(pollData.error || t("dp.generate.failed"));
        }

        // Still pending — continue polling
      }

      throw new Error(t("dp.generate.timeout"));
    } catch (e: any) {
      setPipeline((p) => ({
        ...p,
        scenes: p.scenes.map((s, i) =>
          i === sceneIndex ? { ...s, generating: false, error: e.message } : s
        ),
      }));
      toast.error(t("dp.generate.sceneError", { index: sceneIndex + 1, error: e.message }));
    }
  };

  // ── Copy all prompts ──
  const handleExportPrompts = () => {
    const lines = [
      `# ${pipeline.selectedTitle}`,
      `## Tema: ${pipeline.theme}`,
      `## Duração: ${pipeline.sceneDuration}s por cena | Formato: ${pipeline.aspectRatio}`,
      pipeline.characterName ? `## Personagem: ${pipeline.characterName}` : "",
      "",
      "---",
      "",
      "## ROTEIRO",
      pipeline.script,
      "",
      "---",
      "",
      "## CENAS",
      ...pipeline.scenes.map((s) => [
        `### Cena ${s.index}: ${s.description}`,
        `**Prompt:** ${s.prompt}`,
        "",
      ]).flat(),
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(lines);
    toast.success(t("dp.scenes.allCopied"));
  };

  // ── Character selection ──
  const handleSelectCharacter = async (charId: string, charName: string) => {
    selectCharacter(charId);
    const char = characters.find((c) => c.id === charId);

    // Fetch voice ID from DB
    let voiceId: string | null = null;
    const { data, error } = await supabase
      .from("characters")
      .select("elevenlabs_voice_id")
      .eq("id", charId)
      .single();
    
    if (data?.elevenlabs_voice_id) {
      voiceId = data.elevenlabs_voice_id;
      toast.success(t("dp.character.voiceDetected", { name: charName }));
    }

    setPipeline((p) => ({
      ...p,
      characterId: charId,
      characterName: charName,
      characterVoiceId: voiceId,
      referenceImageUrl: char?.referenceImageUrl || null,
    }));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Header */}
      <header className="h-12 flex items-center justify-between border-b border-border px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/chat")} className="gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />{t("dp.back")}
          </Button>
          <Film className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-semibold text-foreground">{t("dp.title")}</span>
        </div>
        <div className="flex items-center gap-2">
          {step !== "theme" && (
            <Button variant="ghost" size="sm" onClick={handleNewProject} className="text-[10px] text-muted-foreground">
              <RefreshCw className="h-3 w-3 mr-1" />{t("dp.newProject")}
            </Button>
          )}
          {/* Credits balance */}
          <div className="flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 rounded-full px-2.5 py-1">
            <Coins className="h-3 w-3 text-purple-500" />
            <span className="text-[11px] font-bold text-purple-500">{profile?.credits_balance ?? 0}</span>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`h-1.5 rounded-full transition-all ${
                  i <= currentStepIndex ? "bg-purple-500 w-6" : "bg-border w-3"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">

          {/* ── STEP: NICHE ── */}
          {step === "niche" && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <Sparkles className="h-10 w-10 text-purple-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground">{t("dp.niche.title")}</h2>
                <p className="text-xs text-muted-foreground">{t("dp.niche.subtitle")}</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {NICHES.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setPipeline((p) => ({ ...p, niche: n.label }));
                      setStep("style");
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                      pipeline.niche === n.label
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-border/50 bg-secondary/20 hover:bg-secondary/40"
                    }`}
                  >
                    <span className="text-2xl">{n.emoji}</span>
                    <span className="text-sm font-medium text-foreground">{n.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: STYLE ── */}
          {step === "style" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <Palette className="h-10 w-10 text-purple-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground">{t("dp.style.title")}</h2>
                <p className="text-xs text-muted-foreground">Nicho: {pipeline.niche}</p>
              </div>

              {/* Loading */}
              {styleLoading && !styleFormOpen && (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-purple-500" /></div>
              )}

              {/* Existing profiles */}
              {!styleFormOpen && !styleLoading && styleProfiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("dp.style.existing")}</p>
                  {styleProfiles.map((sp) => (
                    <div
                      key={sp.id}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        pipeline.styleProfileId === sp.id
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-border/50 bg-secondary/20 hover:bg-secondary/40"
                      }`}
                      onClick={() => handleSelectStyleProfile(sp)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{sp.name}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-2">{sp.visual_description}</p>
                          {sp.characters?.length > 0 && (
                            <p className="text-[10px] text-purple-400 mt-1">{sp.characters.length} {t("dp.style.characters_count")}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteStyleProfile(sp.id); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create new button */}
              {!styleFormOpen && !styleLoading && (
                <Button
                  variant="outline"
                  onClick={() => setStyleFormOpen(true)}
                  className="w-full gap-2 text-sm"
                >
                  <Plus className="h-4 w-4" />{t("dp.style.createNew")}
                </Button>
              )}

              {/* Skip button */}
              {!styleFormOpen && !styleLoading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep("theme")}
                  className="w-full text-xs text-muted-foreground"
                >
                  {t("dp.style.skip")}
                </Button>
              )}

              {/* ── CREATE FORM ── */}
              {styleFormOpen && (
                <div className="space-y-3 border border-purple-500/20 rounded-xl p-4 bg-purple-500/5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{t("dp.style.formTitle")}</p>
                    <button onClick={() => { setStyleFormOpen(false); setStyleFormChars([]); }} className="p-1 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("dp.style.nameLabel")}</label>
                    <input
                      value={styleForm.name}
                      onChange={(e) => setStyleForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={t("dp.style.namePlaceholder")}
                      className="w-full mt-1 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-400/40"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("dp.style.visualLabel")}</label>
                    <textarea
                      value={styleForm.visual_description}
                      onChange={(e) => setStyleForm((f) => ({ ...f, visual_description: e.target.value }))}
                      placeholder={t("dp.style.visualPlaceholder")}
                      rows={3}
                      className="w-full mt-1 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-400/40 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("dp.style.paletteLabel")}</label>
                    <input
                      value={styleForm.color_palette}
                      onChange={(e) => setStyleForm((f) => ({ ...f, color_palette: e.target.value }))}
                      placeholder={t("dp.style.palettePlaceholder")}
                      className="w-full mt-1 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-400/40"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("dp.style.atmosphereLabel")}</label>
                    <input
                      value={styleForm.atmosphere}
                      onChange={(e) => setStyleForm((f) => ({ ...f, atmosphere: e.target.value }))}
                      placeholder={t("dp.style.atmospherePlaceholder")}
                      className="w-full mt-1 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-400/40"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("dp.style.sceneTypesLabel")}</label>
                    <input
                      value={styleForm.scene_types}
                      onChange={(e) => setStyleForm((f) => ({ ...f, scene_types: e.target.value }))}
                      placeholder={t("dp.style.sceneTypesPlaceholder")}
                      className="w-full mt-1 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-400/40"
                    />
                  </div>

                  {/* ── CHARACTERS SECTION ── */}
                  <div className="border-t border-border/50 pt-3 mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("dp.style.charsTitle")}</p>
                      {!charFormOpen && (
                        <button onClick={() => handleOpenCharForm()} className="flex items-center gap-1 text-[10px] text-purple-500 hover:text-purple-400">
                          <UserPlus className="h-3 w-3" />{t("dp.style.addChar")}
                        </button>
                      )}
                    </div>

                    {/* Character list */}
                    {styleFormChars.length > 0 && !charFormOpen && (
                      <div className="space-y-2 mb-2">
                        {styleFormChars.map((c, i) => (
                          <div key={c.id} className="p-2.5 rounded-lg bg-secondary/30 border border-border/50 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-medium text-foreground">{c.name}</p>
                                  {c.isPrimary && <span className="text-[9px] bg-purple-600 text-white px-1.5 py-0.5 rounded-full">{t("dp.style.primary")}</span>}
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-1">{c.physicalDescription}</p>
                              </div>
                              <div className="flex items-center gap-1 ml-2 shrink-0">
                                <button onClick={() => handleTogglePrimary(i)} title={t("dp.style.markPrimary")}
                                  className={`p-1 rounded transition-colors ${c.isPrimary ? "text-purple-500" : "text-muted-foreground hover:text-purple-500"}`}>
                                  <Users className="h-3 w-3" />
                                </button>
                                <button onClick={() => handleOpenCharForm(i)} className="p-1 text-muted-foreground hover:text-purple-500">
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button onClick={() => handleRemoveChar(i)} className="p-1 text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            {/* Image preview or generate button */}
                            {charImageUrls[c.id] || (pipeline.styleProfile?.character_images as any)?.[c.id] ? (
                              <div className="flex items-center gap-2">
                                <img
                                  src={charImageUrls[c.id] || (pipeline.styleProfile?.character_images as any)?.[c.id]}
                                  alt={c.name}
                                  className="h-16 w-16 rounded-lg object-cover border border-border/50"
                                />
                                <div className="flex-1">
                                  <p className="text-[9px] text-green-500">{t("dp.style.refGenerated")}</p>
                                  <button
                                    onClick={() => handleGenerateCharImage(i)}
                                    disabled={charImageGenerating[c.id]}
                                    className="text-[9px] text-muted-foreground hover:text-purple-500 mt-0.5"
                                  >
                                    {charImageGenerating[c.id] ? t("dp.style.generating") : t("dp.style.regenerate")}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGenerateCharImage(i)}
                                disabled={charImageGenerating[c.id]}
                                className="gap-1.5 text-[10px] w-full"
                              >
                                {charImageGenerating[c.id] ? (
                                  <><Loader2 className="h-3 w-3 animate-spin" />{t("dp.style.generatingImage")}</>
                                ) : (
                                  <><Image className="h-3 w-3" />{t("dp.style.generateImage")}</>
                                )}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {styleFormChars.length === 0 && !charFormOpen && (
                      <p className="text-[10px] text-muted-foreground/60 mb-2">{t("dp.style.noChars")}</p>
                    )}

                    {/* Character form */}
                    {charFormOpen && (
                      <div className="space-y-2 p-3 rounded-lg bg-secondary/20 border border-border/50">
                        <p className="text-xs font-semibold text-foreground">{charEditIndex !== null ? t("dp.style.editChar") : t("dp.style.newChar")} {t("dp.steps.character").toLowerCase()}</p>
                        <input
                          value={charForm.name}
                          onChange={(e) => setCharForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder={t("dp.style.charNamePlaceholder")}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-400/40"
                        />
                        <textarea
                          value={charForm.physicalDescription}
                          onChange={(e) => setCharForm((f) => ({ ...f, physicalDescription: e.target.value }))}
                          placeholder={t("dp.style.charDescPlaceholder")}
                          rows={3}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-400/40 resize-none"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveChar} disabled={!charForm.name.trim() || !charForm.physicalDescription.trim()} className="gap-1 text-xs bg-purple-600 hover:bg-purple-700">
                            <Check className="h-3 w-3" />{charEditIndex !== null ? t("dp.style.saveChar") : t("dp.style.addCharBtn")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setCharFormOpen(false); setCharEditIndex(null); }} className="text-xs">
                            {t("dp.style.cancel")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Save profile */}
                  <Button
                    onClick={handleCreateStyleProfile}
                    disabled={!styleForm.name.trim() || !styleForm.visual_description.trim() || styleLoading}
                    className="w-full gap-2 bg-purple-600 hover:bg-purple-700 mt-2"
                  >
                    {styleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {styleLoading ? t("dp.style.creating") : t("dp.style.createAndNext")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: THEME ── */}
          {step === "theme" && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <Sparkles className="h-10 w-10 text-purple-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground">{t("dp.theme.title")}</h2>
                <p className="text-xs text-muted-foreground">{t("dp.theme.subtitle", { niche: pipeline.niche })}</p>
              </div>
              <textarea
                value={pipeline.theme}
                onChange={(e) => setPipeline((p) => ({ ...p, theme: e.target.value }))}
                placeholder={t("dp.theme.placeholder")}
                rows={3}
                className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-400/40 resize-none"
              />
              <Button
                onClick={handleGenerateTitles}
                disabled={!pipeline.theme.trim() || loading}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? t("dp.theme.generating") : t("dp.theme.generate")}
              </Button>
            </div>
          )}

          {/* ── STEP: TITLE ── */}
          {step === "title" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <FileText className="h-10 w-10 text-purple-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground">{t("dp.titleStep.title")}</h2>
                <p className="text-xs text-muted-foreground">{t("dp.titleStep.subtitle", { theme: pipeline.theme })}</p>
              </div>
              {/* AI-generated titles */}
              <div className="space-y-2">
                {pipeline.titles.map((title, i) => (
                  <button
                    key={i}
                    onClick={() => setPipeline((p) => ({ ...p, selectedTitle: title }))}
                    className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${
                      pipeline.selectedTitle === title
                        ? "border-purple-500 bg-purple-500/10 text-foreground"
                        : "border-border/50 bg-secondary/20 text-muted-foreground hover:bg-secondary/40"
                    }`}
                  >
                    <span className="text-purple-500 font-mono text-xs mr-2">{i + 1}.</span>
                    {title}
                  </button>
                ))}
              </div>

              {/* Custom title */}
              <div className="border-t border-border/50 pt-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t("dp.titleStep.customTitle")}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t("dp.titleStep.customPlaceholder")}
                    className="flex-1 rounded-xl border border-border bg-secondary/30 px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-400/40"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                        setPipeline((p) => ({ ...p, selectedTitle: (e.target as HTMLInputElement).value.trim() }));
                      }
                    }}
                    onChange={(e) => {
                      if (e.target.value.trim()) {
                        setPipeline((p) => ({ ...p, selectedTitle: e.target.value }));
                      }
                    }}
                    value={pipeline.titles.includes(pipeline.selectedTitle) ? "" : pipeline.selectedTitle}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateTitles}
                disabled={loading}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className="h-3 w-3" />{t("dp.titleStep.refreshTitles")}
              </Button>
              <div className="pt-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Duração do vídeo</p>
                <div className="flex gap-2">
                  {[{ min: 1, words: 150 }, { min: 2, words: 300 }, { min: 3, words: 450 }, { min: 5, words: 750 }].map((opt) => (
                    <button
                      key={opt.min}
                      onClick={() => setPipeline((p) => ({ ...p, wordCount: opt.words }))}
                      className={`flex-1 p-2 rounded-lg border text-center transition-all ${
                        pipeline.wordCount === opt.words
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-border/50 hover:bg-secondary/40"
                      }`}
                    >
                      <span className="text-sm font-bold block">{opt.min}min</span>
                      <span className="text-[9px] text-muted-foreground">~{opt.words} palavras</span>
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={handleGenerateScript}
                disabled={!pipeline.selectedTitle || loading}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? "A gerar roteiro..." : `Gerar Roteiro (${Math.round(pipeline.wordCount / 150)}min · ~${pipeline.wordCount} palavras)`}
              </Button>
            </div>
          )}

          {/* ── STEP: SCRIPT ── */}
          {step === "script" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <FileText className="h-10 w-10 text-purple-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground">{pipeline.selectedTitle}</h2>
                <p className="text-xs text-muted-foreground">{pipeline.script.split(/\s+/).length} palavras</p>
              </div>
              <textarea
                value={pipeline.script}
                onChange={(e) => setPipeline((p) => ({ ...p, script: e.target.value }))}
                rows={12}
                className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-foreground leading-relaxed focus:outline-none focus:border-purple-400/40 resize-y"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateScript}
                  disabled={loading}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className="h-3 w-3" />{t("dp.script.regenerate")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(pipeline.script); toast.success(t("dp.script.copied")); }}
                  className="gap-1.5 text-xs"
                >
                  <Copy className="h-3 w-3" />{t("dp.script.copy")}
                </Button>
              </div>

              <Button
                onClick={() => setStep("character")}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <ArrowRight className="h-4 w-4" />Escolher Personagem & Configurar
              </Button>
            </div>
          )}

          {/* ── STEP: CHARACTER ── */}
          {step === "character" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <Users className="h-10 w-10 text-purple-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground">{t("dp.character.title")}</h2>
                <p className="text-xs text-muted-foreground">{t("dp.character.subtitle")}</p>
              </div>

              {/* Existing characters */}
              {characters.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t("dp.character.saved")}</p>
                  {characters.map((char) => (
                    <button
                      key={char.id}
                      onClick={() => handleSelectCharacter(char.id, char.name)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        pipeline.characterId === char.id
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-border/50 bg-secondary/20 hover:bg-secondary/40"
                      }`}
                    >
                      <Users className="h-5 w-5 text-purple-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground block">{char.name}</span>
                        <span className="text-[10px] text-muted-foreground truncate block">{char.summary}</span>
                      </div>
                      {char.referenceImageUrl && (
                        <span className="text-[9px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-full">ref ✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Create new */}
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard/characters")}
                className="w-full gap-2 text-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />{t("dp.character.createNew")}
              </Button>

              {/* Config: duration, scenes, aspect ratio */}
              <div className="border-t border-border/50 pt-4 space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Configuração das cenas</p>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground mb-1">Duração por cena</p>
                    <div className="flex gap-2">
                      <div className="flex-1 p-2 rounded-lg border border-purple-500 bg-purple-500/10 text-center">
                        <span className="text-sm font-bold block">
                          {pipeline.styleProfile?.characters?.some((c: StyleCharacter) => c.isPrimary && ((pipeline.styleProfile?.character_images as any)?.[c.id] || charImageUrls[c.id])) ? "10s" : "15s"}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {pipeline.styleProfile?.characters?.some((c: StyleCharacter) => c.isPrimary && ((pipeline.styleProfile?.character_images as any)?.[c.id] || charImageUrls[c.id])) ? "Wan R2V · 8 créd" : "Wan T2V · 8 créd"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground mb-1">Total de cenas</p>
                    {audioDuration ? (
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 text-center">
                        <span className="text-lg font-bold text-purple-500">{pipeline.sceneCount}</span>
                        <p className="text-[9px] text-muted-foreground">
                          Auto · {Math.floor(audioDuration / 60)}:{String(audioDuration % 60).padStart(2, "0")} de áudio ÷ {pipeline.sceneDuration}s
                        </p>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        {[3, 5, 7, 10, 15, 20].map((n) => (
                          <button
                            key={n}
                            onClick={() => setPipeline((p) => ({ ...p, sceneCount: n }))}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                              pipeline.sceneCount === n ? "bg-purple-600 text-white" : "bg-secondary/50 text-muted-foreground"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Formato</p>
                  <div className="flex gap-1">
                    {[
                      { v: "9:16", l: "9:16 Reels" },
                      { v: "16:9", l: "16:9 YouTube" },
                      { v: "1:1", l: "1:1 Feed" },
                    ].map((o) => (
                      <button
                        key={o.v}
                        onClick={() => setPipeline((p) => ({ ...p, aspectRatio: o.v }))}
                        className={`px-3 py-1.5 rounded text-[10px] font-medium transition-all ${
                          pipeline.aspectRatio === o.v ? "bg-purple-600 text-white" : "bg-secondary/50 text-muted-foreground"
                        }`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">{t("pipeline.speechLang")}</p>
                  <div className="flex gap-1 flex-wrap">
                    {SPEECH_LANGS.map((l) => (
                      <button key={l.id} onClick={() => setPipeline((p) => ({ ...p, speechLang: l.id }))}
                        className={`px-3 py-1.5 rounded text-[10px] font-medium transition-all ${pipeline.speechLang === l.id ? "bg-purple-600 text-white" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cost estimate */}
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Custo estimado:</span>
                    <span className="text-purple-500 font-bold">
                      {pipeline.sceneCount * 8} créditos
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Teu saldo:</span>
                    <span className={`font-bold ${(profile?.credits_balance ?? 0) >= pipeline.sceneCount * 8 ? "text-green-500" : "text-destructive"}`}>
                      {profile?.credits_balance ?? 0} créditos
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {pipeline.sceneCount} cenas × 8 créd = vídeo total de ~{pipeline.sceneCount * pipeline.sceneDuration}s
                  </p>
                </div>
              </div>

              {/* ── NARRAÇÃO ── */}
              <div className="rounded-xl border border-orange-400/20 bg-orange-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-orange-400" />
                  <p className="text-sm font-semibold text-foreground">Gerar Narração</p>
                  {pipeline.characterVoiceId && (
                    <span className="text-[9px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded-full font-medium">
                      Voz do personagem ✓
                    </span>
                  )}
                </div>

                {/* Priority 1: Character has voice ID */}
                {pipeline.characterVoiceId ? (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2.5 text-xs">
                    <p className="text-green-700 dark:text-green-400">
                      <strong>{pipeline.characterName}</strong> tem voz configurada no ElevenLabs. A narração será gerada com a voz do personagem.
                    </p>
                  </div>
                ) : useElevenLabsVoice ? (
                  /* Priority 2: Global ElevenLabs configured */
                  <div className="bg-orange-500/10 border border-orange-400/20 rounded-lg p-2.5 text-xs">
                    <p className="text-orange-700 dark:text-orange-400">
                      Voz ElevenLabs: <strong>{elevenLabs.voiceName}</strong>
                    </p>
                  </div>
                ) : (
                  /* Priority 3: TTS voices */
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Voz da narração</p>
                    <div className="flex gap-1 flex-wrap">
                      {TTS_VOICES.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setSelectedTtsVoice(v);
                            localStorage.setItem("savvyowl_tts_voice", JSON.stringify(v));
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                            selectedTtsVoice.id === v.id
                              ? "bg-orange-500 text-white"
                              : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          {v.name.split(" (")[0]}
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-1.5">
                      Para voz personalizada, configura o ElevenLabs nas <button onClick={() => navigate("/dashboard/settings")} className="text-orange-400 underline">Definições</button> ou associa uma voz ao personagem nos <button onClick={() => navigate("/dashboard/characters")} className="text-orange-400 underline">Personagens</button>
                    </p>
                  </div>
                )}

                {/* Generate button */}
                {!voiceUrl && (
                  <Button
                    onClick={handleGenerateVoice}
                    disabled={voiceLoading || !pipeline.script.trim()}
                    size="sm"
                    className="gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {voiceLoading ? (
                      <><Loader2 className="h-3 w-3 animate-spin" />A gerar narração...</>
                    ) : (
                      <><Mic className="h-3 w-3" />Gerar Narração{pipeline.characterVoiceId ? ` (Voz do ${pipeline.characterName})` : useElevenLabsVoice ? ` (${elevenLabs.voiceName})` : ` (${selectedTtsVoice.name.split(" (")[0]})`}</>
                    )}
                  </Button>
                )}

                {voiceError && <p className="text-[10px] text-destructive">{voiceError}</p>}

                {/* Audio player — voiceUrl (session blob) or narrationStorageUrl (persists on reload) */}
                {(voiceUrl || narrationStorageUrl) && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-orange-500/10 border border-orange-400/20">
                      <Volume2 className="h-4 w-4 text-orange-400 shrink-0" />
                      <audio controls src={voiceUrl || narrationStorageUrl!} className="flex-1 h-8" />
                    </div>
                    <div className="flex gap-2">
                      {voiceUrl && (
                        <a href={voiceUrl} download={`${pipeline.selectedTitle || "narracao"}-savvyowl.mp3`}>
                          <Button variant="outline" size="sm" className="gap-1 text-xs text-orange-400 border-orange-400/30">
                            <Download className="h-3 w-3" />Download MP3
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => { setVoiceUrl(null); setVoiceError(null); setNarrationStorageUrl(null); setAudioDuration(null); }} className="text-xs text-muted-foreground">
                        <RefreshCw className="h-3 w-3 mr-1" />Gerar nova
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleGenerateScenes}
                disabled={loading}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
                {loading ? t("dp.scenes.generating") : t("dp.scenes.generateScenes")}
              </Button>
            </div>
          )}

          {/* ── STEP: SCENES ── */}
          {step === "scenes" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <Clapperboard className="h-10 w-10 text-purple-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground">{pipeline.selectedTitle}</h2>
                <p className="text-xs text-muted-foreground">{pipeline.scenes.length} cenas · {pipeline.sceneDuration}s cada · {pipeline.aspectRatio}</p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleExportPrompts} variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Copy className="h-3 w-3" />{t("dp.scenes.copyAll")}
                </Button>
                <Button
                  onClick={() => setStep("generate")}
                  size="sm"
                  className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700"
                >
                  <Video className="h-3 w-3" />{t("dp.scenes.generateVideos")}
                </Button>
              </div>

              {/* Scene cards */}
              {pipeline.scenes.map((scene, i) => (
                <div key={i} className="rounded-xl border border-border/60 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-secondary/30">
                    <span className="text-[11px] font-semibold text-purple-500">Cena {scene.index}</span>
                    <span className="text-[10px] text-muted-foreground">{pipeline.sceneDuration}s</span>
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-foreground font-medium">{scene.description}</p>
                    <details className="text-[11px]">
                      <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Ver prompt completo</summary>
                      <pre className="mt-1 p-2 bg-secondary/20 rounded-lg text-[10px] text-muted-foreground whitespace-pre-wrap break-words">{scene.prompt}</pre>
                    </details>
                    <textarea
                      value={scene.prompt}
                      onChange={(e) => {
                        const newPrompt = e.target.value;
                        setPipeline((p) => ({
                          ...p,
                          scenes: p.scenes.map((s, idx) => idx === i ? { ...s, prompt: newPrompt } : s),
                        }));
                      }}
                      rows={2}
                      className="w-full rounded-lg border border-border/50 bg-secondary/10 px-2 py-1.5 text-[11px] text-foreground focus:outline-none focus:border-purple-400/30 resize-y"
                      placeholder="Edita o prompt se quiseres..."
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const alreadyHasIdentity = scene.prompt.includes("FIXED CHARACTER") || scene.prompt.includes("same person in every frame");
                        const fullPrompt = identityBlock && !alreadyHasIdentity
                          ? `${identityBlock}\n\nSCENE: ${scene.prompt}`
                          : scene.prompt;
                        navigator.clipboard.writeText(fullPrompt);
                        toast.success(t("dp.scenes.promptCopied", { index: scene.index }));
                      }}
                      className="gap-1 text-[10px] text-muted-foreground hover:text-purple-500"
                    >
                      <Copy className="h-3 w-3" />{t("dp.scenes.copyPrompt")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── STEP: GENERATE ── */}
          {step === "generate" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <Film className="h-10 w-10 text-purple-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground">{t("dp.generate.title")}</h2>
                <p className="text-xs text-muted-foreground">Clica em cada cena para gerar o vídeo</p>
              </div>

              {pipeline.characterName && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-[10px] text-green-700 dark:text-green-400 flex items-center gap-1.5">
                  <Users className="h-3 w-3 shrink-0" />
                  Personagem: <strong>{pipeline.characterName}</strong>
                  {pipeline.referenceImageUrl && " · Referência visual ativa"}
                </div>
              )}

              {/* Banner: per-scene audios generating in background */}
              {sceneAudiosGenerating && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2 text-[10px] text-orange-400 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  A gerar áudios das cenas em background para lip-sync automático...
                </div>
              )}

              {/* Scene generation cards */}
              {pipeline.scenes.map((scene, i) => (
                <div key={i} className="rounded-xl border border-border/60 overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-secondary/30">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-purple-500">Cena {scene.index}</span>
                      <span className="text-[10px] text-muted-foreground">{scene.description}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Audio ready indicator */}
                      {scene.audioUrl && (
                        <span className="text-[9px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Mic className="h-2.5 w-2.5" />áudio
                        </span>
                      )}
                      {/* Completion badge */}
                      {scene.lipsyncStatus === "done" ? (
                        <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Mic className="h-2.5 w-2.5" /><Check className="h-2.5 w-2.5" />lip-sync
                        </span>
                      ) : scene.videoUrl && !scene.generating ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : null}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-3">
                    {scene.generating ? (
                      /* ── In progress ── */
                      <div className="flex items-center gap-2 py-1">
                        <Loader2 className="h-4 w-4 animate-spin text-purple-400 shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          {scene.lipsyncStatus === "processing"
                            ? "A sincronizar voz..."
                            : "A gerar vídeo..."}
                        </span>
                      </div>
                    ) : scene.videoUrl ? (
                      /* ── Done ── */
                      <div className="space-y-2">
                        <video src={scene.videoUrl} controls className="rounded-lg max-w-full max-h-[250px] border border-border/50" />
                        {scene.lipsyncStatus === "done" && (
                          <div className="flex items-center gap-1 text-[10px] text-green-500">
                            <Mic className="h-3 w-3" />Voz sincronizada com o vídeo
                          </div>
                        )}
                        {scene.lipsyncStatus === "error" && (
                          <div className="text-[10px] text-amber-500">
                            Lip-sync falhou — vídeo sem sincronização de voz
                          </div>
                        )}
                        <a
                          href={scene.videoUrl}
                          download={`${pipeline.selectedTitle}-cena${scene.index}.mp4`}
                          className="inline-flex items-center gap-1 text-[10px] text-purple-500 hover:underline"
                        >
                          <Download className="h-3 w-3" />Download
                        </a>
                      </div>
                    ) : (
                      /* ── Not started ── */
                      <Button
                        onClick={() => handleGenerateVideo(i)}
                        disabled={scene.generating}
                        size="sm"
                        className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700"
                      >
                        <Video className="h-3 w-3" />
                        Gerar Cena {scene.index}
                        {scene.audioUrl
                          ? ` · ${8 + 3} créditos (+ lip-sync)`
                          : ` · 8 créditos`}
                      </Button>
                    )}

                    {scene.error && (
                      <p className="text-[10px] text-destructive mt-1">{scene.error}</p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const alreadyHasIdentity = scene.prompt.includes("FIXED CHARACTER") || scene.prompt.includes("same person in every frame");
                        const fullPrompt = identityBlock && !alreadyHasIdentity
                          ? `${identityBlock}\n\nSCENE: ${scene.prompt}`
                          : scene.prompt;
                        navigator.clipboard.writeText(fullPrompt);
                        toast.success(t("dp.scenes.promptCopied", { index: scene.index }));
                      }}
                      className="gap-1 text-[10px] text-muted-foreground hover:text-purple-500 mt-1"
                    >
                      <Copy className="h-3 w-3" />{t("dp.generate.copyPrompt")}
                    </Button>
                  </div>
                </div>
              ))}

              {/* Summary */}
              <div className="border-t border-border/50 pt-3">
                <div className="flex gap-2">
                  <Button onClick={handleExportPrompts} variant="outline" size="sm" className="gap-1.5 text-xs">
                    <Copy className="h-3 w-3" />Exportar prompts
                  </Button>
                  <Button onClick={() => setStep("scenes")} variant="ghost" size="sm" className="text-xs">
                    <ArrowLeft className="h-3 w-3 mr-1" />Editar cenas
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── BACK NAVIGATION ── */}
          {step !== "theme" && (
            <div className="pt-2">
              <button
                onClick={() => {
                  const idx = currentStepIndex;
                  if (idx > 0) setStep(STEPS[idx - 1].key);
                }}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />{t("dp.generate.backStep")}
              </button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

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
