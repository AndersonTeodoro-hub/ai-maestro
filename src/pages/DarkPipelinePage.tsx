import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCharacter } from "@/contexts/CharacterContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Check, Loader2, Video, Copy,
  Download, Users, Sparkles, FileText, Clapperboard,
  Film, Image, Clock, Coins, RefreshCw,
} from "lucide-react";

type Step = "theme" | "title" | "script" | "character" | "scenes" | "generate";

interface SceneData {
  index: number;
  prompt: string;
  description: string;
  videoUrl?: string;
  generating?: boolean;
  error?: string;
}

interface PipelineState {
  theme: string;
  titles: string[];
  selectedTitle: string;
  wordCount: number;
  script: string;
  characterId: string | null;
  characterName: string | null;
  referenceImageUrl: string | null;
  sceneDuration: 8 | 15;
  sceneCount: number;
  scenes: SceneData[];
  aspectRatio: string;
}

const STEPS: { key: Step; label: string; icon: any }[] = [
  { key: "theme", label: "Tema", icon: Sparkles },
  { key: "title", label: "Título", icon: FileText },
  { key: "script", label: "Roteiro", icon: FileText },
  { key: "character", label: "Personagem", icon: Users },
  { key: "scenes", label: "Cenas", icon: Clapperboard },
  { key: "generate", label: "Gerar", icon: Film },
];

async function callChat(message: string, token: string): Promise<string> {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
        mode: "quick",
      }),
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
  const { user } = useAuth();
  const { characters, activeCharacter, selectCharacter, referenceImageUrl } = useCharacter();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("theme");
  const [loading, setLoading] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineState>({
    theme: "",
    titles: [],
    selectedTitle: "",
    wordCount: 500,
    script: "",
    characterId: null,
    characterName: null,
    referenceImageUrl: null,
    sceneDuration: 8,
    sceneCount: 5,
    scenes: [],
    aspectRatio: "9:16",
  });

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
      toast.error(e.message || "Erro ao gerar títulos");
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
      const reply = await callChat(
        `Escreve um roteiro completo para vídeo com o título: "${pipeline.selectedTitle}".
Tema original: "${pipeline.theme}"

REGRAS DE ESTRUTURA:
- Exatamente ${pipeline.wordCount} palavras (pode variar ±10%)
- Em Português do Brasil
- Apenas o texto de narração puro — SEM indicações de cena, SEM timestamps, SEM [corte], SEM (pausa)

ESTRUTURA OBRIGATÓRIA DO ROTEIRO:

1. HOOK (primeiros 5-8 segundos / ~30 palavras):
   Frase de abertura que PRENDE imediatamente. Deve criar urgência, curiosidade ou emoção forte.
   Exemplos de padrão: "O que você vai ouvir agora pode mudar...", "Existe algo que poucos sabem sobre...", "Pare tudo o que está fazendo e preste atenção..."

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
   Os CTAs devem ser adaptados ao nicho:
   
   · Se RELIGIOSO: CTAs em forma de missão espiritual / bênção:
     "Eu quero que você compartilhe esse vídeo com 7 pessoas que precisam dessa oração. Cada uma delas será abençoada, e em nome de Jesus, essas bênçãos retornarão em dobro para sua vida."
     "Se essa palavra tocou seu coração, se inscreva nesse canal. Deus tem uma mensagem nova para você todos os dias."
     "Deixe nos comentários 'eu recebo' para que essa oração se manifeste na sua vida."
   
   · Se DARK/MISTÉRIO: CTAs em forma de pacto com o espectador:
     "Se você está acompanhando até aqui, deixe seu like — isso me ajuda a trazer mais histórias como essa."
     "Compartilhe com alguém que gosta de mistérios — mas cuidado, depois de saber isso, não dá para voltar atrás."
     "Nos comentários, me diz: você acredita que isso realmente aconteceu?"
   
   · Se EDUCAÇÃO: CTAs em forma de comunidade de conhecimento:
     "Se você aprendeu algo novo, compartilhe com alguém que precisa saber disso."
     "Inscreva-se para não perder as próximas descobertas que vão mudar sua forma de ver o mundo."
   
   · Se MOTIVAÇÃO: CTAs em forma de compromisso pessoal:
     "Compartilhe esse vídeo com alguém que está passando por um momento difícil. Às vezes uma mensagem muda tudo."
     "Se inscreva e ative o sininho — nosso compromisso é trazer uma palavra de transformação todos os dias."
   
   · Se OUTRO nicho: adapta o CTA ao tema de forma criativa e emocional.
   
   REGRA CRÍTICA: Os CTAs NÃO podem parecer genéricos ou robotizados. Devem fluir naturalmente dentro da narração como se fossem parte da história/mensagem. O espectador deve sentir que compartilhar é um ATO DE VALOR, não uma obrigação.

4. CONCLUSÃO (últimos ~50 palavras):
   Encerramento emocional forte que conecta com o início.
   Inclui o último CTA mais poderoso — o pedido de compartilhamento como missão.
   Termina com uma frase de impacto que fica na mente do espectador.`,
        token
      );
      setPipeline((p) => ({ ...p, script: reply }));
      setStep("script");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar roteiro");
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 4: Generate scene prompts from script ──
  const handleGenerateScenes = async () => {
    if (!pipeline.script) return;
    setLoading(true);
    try {
      const token = await getToken();
      const charBlock = pipeline.characterName
        ? `O personagem principal é: ${pipeline.characterName}. Mantém a mesma pessoa em todas as cenas.`
        : "";
      const reply = await callChat(
        `Analisa este roteiro e divide-o em exatamente ${pipeline.sceneCount} cenas visuais para geração de vídeo IA.

ROTEIRO:
${pipeline.script}

${charBlock}

Para cada cena, gera:
1. Descrição curta da cena (1 frase em PT)
2. Prompt completo em inglês para geração de vídeo IA (3-5 frases detalhadas, incluindo ambiente, iluminação, câmera, ação)

Formato OBRIGATÓRIO (uma cena por bloco):
CENA 1:
DESC: [descrição em PT]
PROMPT: [prompt em inglês]

CENA 2:
DESC: [descrição em PT]
PROMPT: [prompt em inglês]

...e assim por diante até CENA ${pipeline.sceneCount}.
Sem texto adicional fora deste formato.`,
        token
      );

      // Parse scenes
      const sceneBlocks = reply.split(/CENA\s*\d+\s*:/i).filter((b) => b.trim());
      const scenes: SceneData[] = sceneBlocks.slice(0, pipeline.sceneCount).map((block, i) => {
        const descMatch = block.match(/DESC:\s*(.+?)(?=PROMPT:|$)/si);
        const promptMatch = block.match(/PROMPT:\s*(.+)/si);
        return {
          index: i + 1,
          description: descMatch?.[1]?.trim() || `Cena ${i + 1}`,
          prompt: promptMatch?.[1]?.trim() || block.trim(),
        };
      });

      // Fill if we got fewer than expected
      while (scenes.length < pipeline.sceneCount) {
        scenes.push({
          index: scenes.length + 1,
          description: `Cena ${scenes.length + 1}`,
          prompt: "Atmospheric dark scene with mysterious lighting",
        });
      }

      setPipeline((p) => ({ ...p, scenes }));
      setStep("scenes");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar cenas");
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

      // Build prompt with character identity if available
      let fullPrompt = scene.prompt;
      if (pipeline.characterName && activeCharacter) {
        // The identity block will be built by the video function
      }

      const model = pipeline.sceneDuration <= 8 ? "veo3-fast" : (pipeline.referenceImageUrl ? "wan26-r2v-flash" : "wan26-t2v-flash");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            prompt: fullPrompt,
            aspectRatio: pipeline.aspectRatio,
            duration: pipeline.sceneDuration,
            model,
            referenceImageUrl: pipeline.referenceImageUrl || undefined,
          }),
        }
      );

      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      const videoUrl = data.video?.uri || data.video?.url;
      setPipeline((p) => ({
        ...p,
        scenes: p.scenes.map((s, i) =>
          i === sceneIndex ? { ...s, videoUrl, generating: false } : s
        ),
      }));
      toast.success(`Cena ${sceneIndex + 1} gerada!`);
    } catch (e: any) {
      setPipeline((p) => ({
        ...p,
        scenes: p.scenes.map((s, i) =>
          i === sceneIndex ? { ...s, generating: false, error: e.message } : s
        ),
      }));
      toast.error(`Cena ${sceneIndex + 1}: ${e.message}`);
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
    toast.success("Todos os prompts copiados!");
  };

  // ── Character selection ──
  const handleSelectCharacter = (charId: string, charName: string) => {
    selectCharacter(charId);
    const char = characters.find((c) => c.id === charId);
    setPipeline((p) => ({
      ...p,
      characterId: charId,
      characterName: charName,
      referenceImageUrl: char?.referenceImageUrl || null,
    }));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Header */}
      <header className="h-12 flex items-center justify-between border-b border-border px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/chat")} className="gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />Voltar
          </Button>
          <Film className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-semibold text-foreground">Dark Pipeline Pro</span>
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
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">

          {/* ── STEP: THEME ── */}
          {step === "theme" && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <Sparkles className="h-10 w-10 text-purple-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground">Define o Tema</h2>
                <p className="text-xs text-muted-foreground">Qual é o tema do teu vídeo?</p>
              </div>
              <textarea
                value={pipeline.theme}
                onChange={(e) => setPipeline((p) => ({ ...p, theme: e.target.value }))}
                placeholder="Ex: oração do salmo 91, mistérios do oceano, 5 hábitos milionários, receita de bolo fitness..."
                rows={3}
                className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-400/40 resize-none"
              />
              <Button
                onClick={handleGenerateTitles}
                disabled={!pipeline.theme.trim() || loading}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? "A gerar títulos..." : "Gerar 5 Títulos"}
              </Button>
            </div>
          )}

          {/* ── STEP: TITLE ── */}
          {step === "title" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <FileText className="h-10 w-10 text-purple-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground">Escolhe o Título</h2>
                <p className="text-xs text-muted-foreground">Tema: {pipeline.theme}</p>
              </div>
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateTitles}
                disabled={loading}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className="h-3 w-3" />Gerar novos títulos
              </Button>
              <div className="pt-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Palavras no roteiro</p>
                <div className="flex gap-2">
                  {[300, 500, 800, 1200].map((w) => (
                    <button
                      key={w}
                      onClick={() => setPipeline((p) => ({ ...p, wordCount: w }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        pipeline.wordCount === w
                          ? "bg-purple-600 text-white"
                          : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {w}
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
                {loading ? "A gerar roteiro..." : `Gerar Roteiro (${pipeline.wordCount} palavras)`}
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
                  <RefreshCw className="h-3 w-3" />Regenerar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(pipeline.script); toast.success("Roteiro copiado!"); }}
                  className="gap-1.5 text-xs"
                >
                  <Copy className="h-3 w-3" />Copiar
                </Button>
              </div>
              <Button
                onClick={() => setStep("character")}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <ArrowRight className="h-4 w-4" />Escolher Personagem
              </Button>
            </div>
          )}

          {/* ── STEP: CHARACTER ── */}
          {step === "character" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <Users className="h-10 w-10 text-purple-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground">Personagem</h2>
                <p className="text-xs text-muted-foreground">Escolhe um personagem existente ou avança sem personagem</p>
              </div>

              {/* Existing characters */}
              {characters.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Personagens guardados</p>
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
                <Sparkles className="h-3.5 w-3.5" />Criar Novo Personagem no Character Engine
              </Button>

              {/* Config: duration, scenes, aspect ratio */}
              <div className="border-t border-border/50 pt-4 space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Configuração das cenas</p>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground mb-1">Duração por cena</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPipeline((p) => ({ ...p, sceneDuration: 8 }))}
                        className={`flex-1 p-2 rounded-lg border text-center transition-all ${
                          pipeline.sceneDuration === 8 ? "border-purple-500 bg-purple-500/10" : "border-border/50"
                        }`}
                      >
                        <span className="text-sm font-bold block">8s</span>
                        <span className="text-[9px] text-muted-foreground">10 créd</span>
                      </button>
                      <button
                        onClick={() => setPipeline((p) => ({ ...p, sceneDuration: 15 }))}
                        className={`flex-1 p-2 rounded-lg border text-center transition-all ${
                          pipeline.sceneDuration === 15 ? "border-purple-500 bg-purple-500/10" : "border-border/50"
                        }`}
                      >
                        <span className="text-sm font-bold block">15s</span>
                        <span className="text-[9px] text-muted-foreground">{pipeline.referenceImageUrl ? "7" : "5"} créd</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground mb-1">Total de cenas</p>
                    <div className="flex gap-1">
                      {[3, 5, 7, 10].map((n) => (
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

                {/* Cost estimate */}
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Custo estimado:</span>
                    <span className="text-purple-500 font-bold">
                      {pipeline.sceneCount * (pipeline.sceneDuration <= 8 ? 10 : (pipeline.referenceImageUrl ? 7 : 5))} créditos
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {pipeline.sceneCount} cenas × {pipeline.sceneDuration <= 8 ? 10 : (pipeline.referenceImageUrl ? 7 : 5)} créd = vídeo total de ~{pipeline.sceneCount * pipeline.sceneDuration}s
                  </p>
                </div>
              </div>

              <Button
                onClick={handleGenerateScenes}
                disabled={loading}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
                {loading ? "A gerar cenas..." : "Gerar Cenas"}
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
                  <Copy className="h-3 w-3" />Copiar todos os prompts
                </Button>
                <Button
                  onClick={() => setStep("generate")}
                  size="sm"
                  className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700"
                >
                  <Video className="h-3 w-3" />Gerar vídeos na SavvyOwl
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
                <h2 className="text-lg font-bold text-foreground">Gerar Vídeos</h2>
                <p className="text-xs text-muted-foreground">Clica em cada cena para gerar o vídeo</p>
              </div>

              {pipeline.characterName && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-[10px] text-green-700 dark:text-green-400 flex items-center gap-1.5">
                  <Users className="h-3 w-3 shrink-0" />
                  Personagem: <strong>{pipeline.characterName}</strong>
                  {pipeline.referenceImageUrl && " · Referência visual ativa"}
                </div>
              )}

              {/* Scene generation cards */}
              {pipeline.scenes.map((scene, i) => (
                <div key={i} className="rounded-xl border border-border/60 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-secondary/30">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-purple-500">Cena {scene.index}</span>
                      <span className="text-[10px] text-muted-foreground">{scene.description}</span>
                    </div>
                    {scene.videoUrl && <Check className="h-3.5 w-3.5 text-green-500" />}
                  </div>
                  <div className="p-3">
                    {scene.videoUrl ? (
                      <div className="space-y-2">
                        <video src={scene.videoUrl} controls className="rounded-lg max-w-full max-h-[250px] border border-border/50" />
                        <a
                          href={scene.videoUrl}
                          download={`${pipeline.selectedTitle}-cena${scene.index}.mp4`}
                          className="inline-flex items-center gap-1 text-[10px] text-purple-500 hover:underline"
                        >
                          <Download className="h-3 w-3" />Download
                        </a>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleGenerateVideo(i)}
                        disabled={scene.generating}
                        size="sm"
                        className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700"
                      >
                        {scene.generating ? (
                          <><Loader2 className="h-3 w-3 animate-spin" />A gerar...</>
                        ) : (
                          <><Video className="h-3 w-3" />Gerar Cena {scene.index} · {pipeline.sceneDuration <= 8 ? 10 : (pipeline.referenceImageUrl ? 7 : 5)} créditos</>
                        )}
                      </Button>
                    )}
                    {scene.error && (
                      <p className="text-[10px] text-destructive mt-1">{scene.error}</p>
                    )}
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
                <ArrowLeft className="h-3 w-3" />Voltar ao passo anterior
              </button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
