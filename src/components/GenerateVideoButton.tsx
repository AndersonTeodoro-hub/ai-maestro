import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCharacter } from "@/contexts/CharacterContext";
import { Loader2, Video, Download, X, Users, Coins } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Props = { prompt: string };

// Duration → backend model mapping (hidden from user)
// 8s → Veo3 Fast (best for short dialogue/action)
// 15s → Wan 2.6 (best for longer UGC, stories, products)
// With reference image: auto-upgrades to R2V/I2V for character consistency
function resolveModel(duration: number, hasRef: boolean): { model: string; credits: number } {
  if (duration <= 8) {
    return { model: "veo3-fast", credits: 10 };
  }
  // 15s
  if (hasRef) {
    return { model: "wan26-i2v-flash", credits: 7 };
  }
  return { model: "wan26-t2v-flash", credits: 5 };
}

export function GenerateVideoButton({ prompt }: Props) {
  const navigate = useNavigate();
  const { identityBlock, activeCharacterName, referenceImageUrl } = useCharacter();
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [duration, setDuration] = useState(8);
  const [credits, setCredits] = useState<{ balance: number; cost: number } | null>(null);
  const [noCredits, setNoCredits] = useState(false);

  const hasRef = !!referenceImageUrl;
  const { model: resolvedModel, credits: creditCost } = resolveModel(duration, hasRef);

  const buildFinalPrompt = (): string => {
    if (!identityBlock) return prompt;
    return `${identityBlock}\n\n── SCENE DIRECTION ──\n${prompt}`;
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setVideoUrl(null);
    setNoCredits(false);
    setProgress(`A gerar vídeo de ${duration}s...`);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const finalPrompt = buildFinalPrompt();
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`;

      // Step 1: Submit
      const resp = await fetch(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: finalPrompt,
          aspectRatio,
          duration,
          model: resolvedModel,
          referenceImageUrl: hasRef ? referenceImageUrl : undefined,
        }),
      });

      const data = await resp.json();

      if (data.error === "insufficient_credits") {
        setNoCredits(true);
        setError(data.message);
        return;
      }
      if (data.error) {
        setError(data.error);
        toast.error(data.error);
        return;
      }
      if (data.status !== "SUBMITTED") {
        setError("Falha ao submeter vídeo");
        return;
      }

      const { requestId, statusUrl, responseUrl } = data;
      if (data.credits) setCredits(data.credits);
      setProgress(`A gerar vídeo de ${duration}s (pode demorar 1-3 min)...`);

      // Step 2: Poll
      const maxWait = 600000;
      let elapsed = 0;
      while (elapsed < maxWait) {
        await new Promise((r) => setTimeout(r, 5000));
        elapsed += 5000;

        const pollResp = await fetch(baseUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "poll", requestId, statusUrl, responseUrl }),
        });
        const pollData = await pollResp.json();

        if (pollData.status === "COMPLETED" && pollData.videoUrl) {
          setVideoUrl(pollData.videoUrl);
          toast.success(`Vídeo gerado em ${Math.round(elapsed / 1000)}s!`);
          return;
        }
        if (pollData.status === "FAILED") {
          setError(pollData.error || "Geração falhou");
          toast.error("Erro ao gerar vídeo");
          return;
        }
      }
      setError("Timeout — tenta novamente");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setError(msg);
      toast.error("Erro ao gerar vídeo");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `savvyowl-video-${Date.now()}.mp4`;
    a.click();
  };

  return (
    <div className="mt-1">
      {/* Trigger */}
      {!videoUrl && !loading && !showOptions && !noCredits && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            onClick={() => setShowOptions(true)}
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 border-purple-400/30 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
          >
            <Video className="h-3 w-3" />Gerar Vídeo SavvyOwl
          </Button>
          {activeCharacterName && (
            <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />{activeCharacterName}
            </span>
          )}
        </div>
      )}

      {/* Options panel */}
      {showOptions && !loading && !videoUrl && (
        <div className="bg-secondary/30 rounded-xl p-3 space-y-3 border border-border/50">
          {/* Duration */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Duração</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDuration(8)}
                className={`flex-1 p-2.5 rounded-lg border text-center transition-all ${
                  duration === 8
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-border/50 hover:border-purple-400/40"
                }`}
              >
                <span className="text-lg font-bold text-foreground block">8s</span>
                <span className="text-[10px] text-muted-foreground">Rápido · 10 créditos</span>
              </button>
              <button
                onClick={() => setDuration(15)}
                className={`flex-1 p-2.5 rounded-lg border text-center transition-all ${
                  duration === 15
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-border/50 hover:border-purple-400/40"
                }`}
              >
                <span className="text-lg font-bold text-foreground block">15s</span>
                <span className="text-[10px] text-muted-foreground">
                  Longo · {hasRef ? "7" : "5"} créditos
                </span>
              </button>
            </div>
          </div>

          {/* Aspect ratio */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Formato</p>
            <div className="flex gap-1">
              {([
                { value: "9:16", label: "9:16", desc: "Reels/TikTok" },
                { value: "16:9", label: "16:9", desc: "YouTube" },
                { value: "1:1", label: "1:1", desc: "Feed" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAspectRatio(opt.value)}
                  className={`px-2.5 py-1.5 rounded text-[10px] font-medium transition-all ${
                    aspectRatio === opt.value
                      ? "bg-purple-600 text-white"
                      : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {opt.label} <span className="opacity-60">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Character reference info */}
          {activeCharacterName && hasRef && duration === 15 && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-[10px] text-green-700 dark:text-green-400 flex items-center gap-1.5">
              <Users className="h-3 w-3 shrink-0" />
              Vídeo com consistência visual de <strong>{activeCharacterName}</strong>
            </div>
          )}

          {/* Generate */}
          <div className="flex gap-2 items-center">
            <Button
              onClick={() => { setShowOptions(false); handleGenerate(); }}
              size="sm"
              className="text-xs gap-1.5 bg-purple-600 text-white hover:bg-purple-700"
            >
              <Video className="h-3 w-3" />
              Gerar Vídeo · {creditCost} créditos
            </Button>
            <button
              onClick={() => setShowOptions(false)}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {noCredits && (
        <div className="bg-secondary/30 rounded-lg p-3 text-xs space-y-2 mt-1">
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => navigate("/dashboard/settings")} size="sm" className="text-xs gap-1.5 bg-purple-600 text-white">
            <Coins className="h-3 w-3" />Carregar créditos
          </Button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{progress}</span>
        </div>
      )}

      {error && !noCredits && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}

      {videoUrl && (
        <div className="mt-2">
          <video src={videoUrl} controls autoPlay loop className="rounded-lg max-w-full max-h-[400px] border border-border/50" />
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Button onClick={handleDownload} size="sm" variant="outline" className="text-xs gap-1">
              <Download className="h-3 w-3" />Download MP4
            </Button>
            <Button onClick={() => { setVideoUrl(null); setError(null); setShowOptions(true); }} size="sm" variant="ghost" className="text-xs gap-1 text-muted-foreground">
              <X className="h-3 w-3" />Fechar
            </Button>
          </div>
          {activeCharacterName && (
            <p className="text-[10px] text-green-600/70 dark:text-green-400/70 mt-1">
              Personagem: {activeCharacterName}
            </p>
          )}
          {credits && (
            <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
              <Coins className="h-2.5 w-2.5" />{credits.balance} créditos restantes
            </p>
          )}
        </div>
      )}
    </div>
  );
}
