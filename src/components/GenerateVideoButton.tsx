import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleApiKey } from "@/hooks/useGoogleApiKey";
import { Loader2, Video, Download, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  prompt: string;
};

export function GenerateVideoButton({ prompt }: Props) {
  const apiKey = useGoogleApiKey();
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("9:16");

  // Veo3 requires API key - no free tier for video
  if (!apiKey) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setVideoUrl(null);
    setProgress("A enviar prompt para Veo3...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      setProgress("A gerar video (pode demorar 1-3 min)...");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            prompt,
            apiKey,
            aspectRatio,
          }),
        }
      );

      const data = await resp.json();

      if (data.error) {
        setError(data.error);
        toast.error(data.error);
        return;
      }

      if (data.video?.data) {
        const url = `data:${data.video.mimeType};base64,${data.video.data}`;
        setVideoUrl(url);
        toast.success(`Video gerado em ${data.generationTime}s!`);
      } else if (data.video?.uri) {
        setVideoUrl(data.video.uri);
        toast.success(`Video gerado em ${data.generationTime}s!`);
      } else {
        setError("Video gerado mas sem dados. Tenta novamente.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to generate video");
      toast.error("Erro ao gerar video");
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
      {!videoUrl && !loading && !showOptions && (
        <Button
          onClick={() => setShowOptions(true)}
          size="sm"
          variant="outline"
          className="text-xs gap-1.5 border-purple-400/30 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
        >
          <Video className="h-3 w-3" />Gerar Video (Veo3)
        </Button>
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

      {loading && (
        <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{progress}</span>
        </div>
      )}

      {error && (
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
        </div>
      )}
    </div>
  );
}
