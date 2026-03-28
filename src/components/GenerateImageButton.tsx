import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleApiKey } from "@/hooks/useGoogleApiKey";
import { useCharacter } from "@/contexts/CharacterContext";
import { Loader2, ImageIcon, Download, X, Coins, Users } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Props = { prompt: string };

export function GenerateImageButton({ prompt }: Props) {
  const apiKey = useGoogleApiKey();
  const navigate = useNavigate();
  const { identityBlock, negativePrompt, activeCharacterName } = useCharacter();
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<{ balance: number; cost: number } | null>(null);
  const [noCredits, setNoCredits] = useState(false);

  const buildFinalPrompt = (): string => {
    const parts: string[] = [];
    if (identityBlock) { parts.push(identityBlock); parts.push(""); }
    parts.push(prompt);
    if (negativePrompt) { parts.push(""); parts.push(`NEGATIVE PROMPT: ${negativePrompt}`); }
    return parts.join("\n");
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setImageUrl(null);
    setNoCredits(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const finalPrompt = buildFinalPrompt();

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ prompt: finalPrompt, apiKey: apiKey || undefined }),
        }
      );

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
      if (data.image) {
        const url = `data:${data.image.mimeType};base64,${data.image.data}`;
        setImageUrl(url);
        if (data.credits) setCredits(data.credits);
        toast.success("Imagem gerada!");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setError(msg);
      toast.error("Erro ao gerar imagem");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `savvyowl-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="mt-2">
      {!imageUrl && !noCredits && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            onClick={handleGenerate}
            disabled={loading}
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
          >
            {loading ? (
              <><Loader2 className="h-3 w-3 animate-spin" />A gerar imagem...</>
            ) : (
              <><ImageIcon className="h-3 w-3" />Gerar Imagem{!apiKey && " · 1 crédito"}</>
            )}
          </Button>
          {activeCharacterName && (
            <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />{activeCharacterName}
            </span>
          )}
        </div>
      )}

      {noCredits && (
        <div className="bg-secondary/30 rounded-lg p-3 text-xs space-y-2 mt-1">
          <p className="text-muted-foreground">{error}</p>
          <Button
            onClick={() => navigate("/dashboard/settings")}
            size="sm"
            className="text-xs gap-1.5 bg-primary text-primary-foreground"
          >
            <Coins className="h-3 w-3" />Carregar créditos nas Definições
          </Button>
        </div>
      )}

      {error && !noCredits && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}

      {imageUrl && (
        <div className="mt-2">
          <img
            src={imageUrl}
            alt="Generated"
            className="rounded-lg max-w-full max-h-[400px] border border-border/50"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Button onClick={handleDownload} size="sm" variant="outline" className="text-xs gap-1">
              <Download className="h-3 w-3" />Download
            </Button>
            <Button
              onClick={() => { setImageUrl(null); setError(null); }}
              size="sm" variant="ghost" className="text-xs gap-1 text-muted-foreground"
            >
              <X className="h-3 w-3" />Fechar
            </Button>
            <Button onClick={handleGenerate} disabled={loading} size="sm" variant="outline" className="text-xs gap-1">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
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
