import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Download, Loader2, Volume2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useElevenLabsKey } from "@/hooks/useElevenLabsKey";
import { useGoogleApiKey } from "@/hooks/useGoogleApiKey";
import { toast } from "sonner";

interface Props {
  text: string;
}

const DEFAULT_VOICES = [
  { id: "Charon", name: "Charon (Male, Informative)" },
  { id: "Kore", name: "Kore (Female, Firm)" },
  { id: "Puck", name: "Puck (Male, Upbeat)" },
  { id: "Zephyr", name: "Zephyr (Female, Bright)" },
  { id: "Gacrux", name: "Gacrux (Male, Mature)" },
  { id: "Aoede", name: "Aoede (Female, Breezy)" },
  { id: "Algieba", name: "Algieba (Male, Smooth)" },
];

export function GenerateVoiceButton({ text }: Props) {
  const elevenLabs = useElevenLabsKey();
  const { googleApiKey } = useGoogleApiKey();
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showVoices, setShowVoices] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(() => {
    try {
      const stored = localStorage.getItem("savvyowl_tts_voice");
      return stored ? JSON.parse(stored) : DEFAULT_VOICES[0];
    } catch { return DEFAULT_VOICES[0]; }
  });

  const useElevenLabs = elevenLabs.hasKey && elevenLabs.hasVoice;

  const generate = async () => {
    setLoading(true);
    setError(null);
    setAudioUrl(null);

    try {
      const body: any = {
        text,
        voiceId: useElevenLabs ? elevenLabs.voiceId : selectedVoice.id,
        provider: useElevenLabs ? "elevenlabs" : "gemini",
      };
      if (useElevenLabs) body.elevenLabsKey = elevenLabs.apiKey;
      if (googleApiKey) body.googleApiKey = googleApiKey;

      const { data, error: fnError } = await supabase.functions.invoke("generate-voice", { body });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      if (data?.audio) {
        const mimeType = data.mimeType || "audio/mpeg";
        // Handle raw PCM from Gemini (L16)
        if (mimeType.includes("L16") || mimeType.includes("pcm")) {
          const raw = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
          const wavHeader = createWavHeader(raw.length, 24000, 1, 16);
          const wavData = new Uint8Array(wavHeader.length + raw.length);
          wavData.set(wavHeader, 0);
          wavData.set(raw, wavHeader.length);
          const blob = new Blob([wavData], { type: "audio/wav" });
          setAudioUrl(URL.createObjectURL(blob));
        } else {
          const byteChars = atob(data.audio);
          const byteArray = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
          const blob = new Blob([byteArray], { type: mimeType });
          setAudioUrl(URL.createObjectURL(blob));
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate voice");
    } finally {
      setLoading(false);
    }
  };

  const selectVoice = (voice: typeof DEFAULT_VOICES[0]) => {
    setSelectedVoice(voice);
    localStorage.setItem("savvyowl_tts_voice", JSON.stringify(voice));
    setShowVoices(false);
    toast.success(`Voz ${voice.name} selecionada`);
  };

  return (
    <div className="mt-2 space-y-2">
      {!audioUrl && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            onClick={generate}
            disabled={loading}
            variant="outline"
            size="sm"
            className="gap-2 text-xs border-orange-400/30 text-orange-500 hover:bg-orange-500/10"
          >
            {loading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Gerando narracao...</>
            ) : (
              <><Mic className="h-3.5 w-3.5" />Gerar Narracao{useElevenLabs ? ` (${elevenLabs.voiceName})` : ""}</>
            )}
          </Button>
          {!useElevenLabs && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-orange-400/70 gap-1"
                onClick={() => setShowVoices(!showVoices)}
              >
                {selectedVoice.name.split(" (")[0]}<ChevronDown className="h-3 w-3" />
              </Button>
              {showVoices && (
                <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 min-w-[200px] max-h-48 overflow-y-auto">
                  {DEFAULT_VOICES.map(v => (
                    <button
                      key={v.id}
                      onClick={() => selectVoice(v)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${selectedVoice.id === v.id ? "text-orange-400 font-medium" : "text-foreground/70"}`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {audioUrl && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-400/20">
          <Volume2 className="h-4 w-4 text-orange-400 shrink-0" />
          <audio controls src={audioUrl} className="flex-1 h-8" />
          <a href={audioUrl} download="narracao-savvyowl.mp3" className="shrink-0">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-orange-400"><Download className="h-3.5 w-3.5" />MP3</Button>
          </a>
          <Button variant="ghost" size="sm" className="text-xs text-orange-400" onClick={() => { setAudioUrl(null); }}>
            Nova
          </Button>
        </div>
      )}
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
