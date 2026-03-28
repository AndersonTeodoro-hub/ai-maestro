import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleApiKey } from "@/hooks/useGoogleApiKey";
import { useCharacter } from "@/contexts/CharacterContext";
import { Loader2, Video, Download, X, Users, Coins } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Props = { prompt: string };

export function GenerateVideoButton({ prompt }: Props) {
  const apiKey = useGoogleApiKey();
  const navigate = useNavigate();
  const { identityBlock, activeCharacterName } = useCharacter();
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [credits, setCredits] = useState<{ balance: number; cost: number } | null>(null);
  const [noCredits, setNoCredits] = useState(false);

  const buildFinalPrompt = (): string => {
    if (!identityBlock) return prompt;
    return `${identityBlock}\n\n── SCENE DIRECTION ──\n${prompt}`;
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setVideoUrl(null);
    setNoCredits(false);
    setProgress("A enviar prompt para Veo3...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      setProgress("A gerar vídeo (pode demorar 1-3 min)...");
      const finalPrompt = buildFinalPrompt();

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ prompt: finalPrompt, apiKey: apiKey || undefined, aspectRatio }),
        }
      );

      const data = await resp.json();

      if (data.error === "insufficient_credits") {
        setNoCredits(true);
        setError(data.message);
        return;
      }
      if (data.error === "no_video_backend") {
        setError(data.message);
        return;
      }
      if (data.error) {
        setError(data.error);
        toast.error(data.error);
        return;
      }

      if (data.video?.data) {
        setVideoUrl(`data:${data.video.mimeType};base64,${data.video.data}`);
        if (data.credits) setCredits(data.credits);
        toast.success(`Vídeo gerado em ${data.generationTime}s!`);
      } else if (data.video?.uri) {
        setVideoUrl(data.video.uri);
        if (data.credits) setCredits(data.credits);
        toast.success(`Vídeo gerado em ${data.generationTime}s!`);
      } else {
        setError("Vídeo gerado mas sem dados. Tenta novamente.");
      }
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
    a.download = `savvyowl-veo3-${Date.now()}.mp4`;
    a.click();
  };

  return (
    <div className="mt-1">
      {!videoUrl && !loading && !showOptions && !noCredits && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            onClick={() => setShowOptions(true)}
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 border-purple-400/30 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
          >
            <Video className="h-3 w-3" />Gerar Vídeo (Veo3){!apiKey && " · 10 créditos"}
          </Button>
          {activeCharacterName && (
            <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />{activeCharacterName}
            </span>
          )}
        </div>
      )}

      {showOptions && !loading && !videoUrl && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {([
              { value: "9:16", label: "9:16", desc: "Reels" },
              { value: "16:9", label: "16:9", desc: "YouTube" },
              { value: "1:1", label: "1:1", desc: "Feed" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAspectRatio(opt.value)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  aspectRatio === opt.value
                    ? "bg-purple-600 text-white"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {opt.label} <span className="opacity-60">{opt.desc}</span>
              </button>
            ))}
          </div>
          <Button
            onClick={() => { setShowOptions(false); handleGenerate(); }}
            size="sm"
            className="text-xs gap-1.5 bg-purple-600 text-white hover:bg-purple-700"
          >
            <Video className="h-3 w-3" />Gerar
          </Button>
          <button
            onClick={() => setShowOptions(false)}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      )}

      {noCredits && (
        <div className="bg-secondary/30 rounded-lg p-3 text-xs space-y-2 mt-1">
          <p className="text-muted-foreground">{error}</p>
          <Button
            onClick={() => navigate("/dashboard/settings")}
            size="sm"
            className="text-xs gap-1.5 bg-purple-600 text-white"
          >
            <Coins className="h-3 w-3" />Carregar créditos nas Definições
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
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            className="rounded-lg max-w-full max-h-[400px] border border-border/50"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Button onClick={handleDownload} size="sm" variant="outline" className="text-xs gap-1">
              <Download className="h-3 w-3" />Download MP4
            </Button>
            <Button onClick={() => { setVideoUrl(null); setError(null); }} size="sm" variant="ghost" className="text-xs gap-1 text-muted-foreground">
              <X className="h-3 w-3" />Fechar
            </Button>
            <Button onClick={handleGenerate} disabled={loading} size="sm" variant="outline" className="text-xs gap-1">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Video className="h-3 w-3" />}
              Gerar outra
            </Button>
          </div>
          {activeCharacterName && (
            <p className="text-[10px] text-green-600/70 dark:text-green-400/70 mt-1">
              Identity lock: {activeCharacterName}
            </p>
          )}
          {credits && !apiKey && (
            <p className="text-[10px] text-muted-foreground/60 mt-1.5 flex items-center gap-1">
              <Coins className="h-2.5 w-2.5" />
              {credits.balance} créditos restantes
            </p>
          )}
        </div>
      )}
    </div>
  );
}
