import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCharacterEngine, CharacterData } from "@/hooks/useCharacterEngine";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Users, Plus, ArrowLeft, Lock, Unlock, Trash2, Copy, Check,
  ChevronDown, Loader2, Sparkles, Eye, Pencil, Image, Video,
  AlertCircle, UserCircle,
} from "lucide-react";

type View = "library" | "create" | "detail";

const LOADING_MESSAGES = [
  "Analisando descrição...",
  "Definindo geometria facial...",
  "Mapeando textura de pele...",
  "Calibrando proporções...",
  "Selecionando guarda-roupa...",
  "Adicionando imperfeições realistas...",
  "Finalizando identity lock...",
];

const EXAMPLES = [
  "Influencer brasileira de 22 anos, morena, cabelo cacheado, pele canela, sorriso marcante, estilo streetwear",
  "Homem de 35 anos, barba curta, cabelo escuro bagunçado, magro, visual desleixado",
  "Mulher asiática de 28 anos, cabelo liso preto, elegante, executiva, minimalista",
];

function CharacterAvatar({ character, size = 48 }: { character: CharacterData; size?: number }) {
  const d = character.expanded;
  if (!d) return null;

  const hair = d.hair?.color?.toLowerCase() || "";
  const skin = d.identity?.ethnicity_skin?.toLowerCase() || "";
  const eyes = d.face?.eyes?.toLowerCase() || "";

  const hairColor = hair.includes("blond") || hair.includes("loir") ? "#e8c547"
    : hair.includes("red") || hair.includes("ruiv") ? "#c0392b"
    : hair.includes("brown") || hair.includes("castanh") ? "#5d4037"
    : hair.includes("black") || hair.includes("pret") ? "#1a1a2e" : "#6d5b3e";

  const skinTone = skin.includes("light") || skin.includes("fair") || skin.includes("clar") ? "#f5d0b0"
    : skin.includes("olive") ? "#d4a574"
    : skin.includes("dark") || skin.includes("escur") ? "#8d6346"
    : skin.includes("brown") || skin.includes("moreno") ? "#b07d56" : "#dbb89a";

  const eyeColor = eyes.includes("green") || eyes.includes("verde") ? "#2ecc71"
    : eyes.includes("blue") || eyes.includes("azul") ? "#3498db"
    : eyes.includes("hazel") ? "#a0826d" : "#5d4037";

  return (
    <div
      className="rounded-full relative shrink-0 overflow-hidden"
      style={{
        width: size, height: size,
        background: `radial-gradient(circle at 50% 35%, ${skinTone} 35%, ${hairColor} 70%)`,
        boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
      }}
    >
      <div className="absolute rounded-full" style={{ top: "38%", left: "30%", width: "11%", height: "9%", background: eyeColor, boxShadow: `0 0 3px ${eyeColor}` }} />
      <div className="absolute rounded-full" style={{ top: "38%", right: "30%", width: "11%", height: "9%", background: eyeColor, boxShadow: `0 0 3px ${eyeColor}` }} />
      <div className="absolute" style={{ top: "58%", left: "50%", transform: "translateX(-50%)", width: "18%", height: "4%", borderRadius: "0 0 50% 50%", background: `color-mix(in srgb, ${skinTone} 60%, #c0392b)` }} />
      <div
        className="absolute bottom-0.5 right-0.5 rounded-full border-2 border-background"
        style={{
          width: size * 0.18, height: size * 0.18,
          background: character.status === "locked" ? "#22c55e" : "#eab308",
        }}
      />
    </div>
  );
}

function DetailSection({ title, data }: { title: string; data: Record<string, string> | undefined }) {
  if (!data) return null;
  return (
    <Collapsible>
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group">
        <span className="text-xs font-semibold text-primary uppercase tracking-wider">{title}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-1 py-2 space-y-0">
          {Object.entries(data).map(([key, val]) => (
            <div key={key} className="flex gap-2 py-2 border-b border-border/30 last:border-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 min-w-[90px] shrink-0 pt-0.5">
                {key.replace(/_/g, " ")}
              </span>
              <span className="text-xs text-foreground leading-relaxed">{String(val)}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PromptBlock({ label, icon: Icon, color, text }: { label: string; icon: any; color: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/30">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5" style={{ color }} />
          <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <><Check className="h-3 w-3 text-primary" /><span className="text-primary">Copiado</span></> : <><Copy className="h-3 w-3" />Copiar</>}
        </button>
      </div>
      <pre className="p-3 text-[11px] font-mono leading-relaxed text-foreground/80 whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto bg-secondary/10">
        {text}
      </pre>
    </div>
  );
}

export default function CharactersPage() {
  const { t, i18n } = useTranslation();
  const isPT = i18n.language?.startsWith("pt");
  const engine = useCharacterEngine();
  const [view, setView] = useState<View>("library");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [refineInput, setRefineInput] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeChar = engine.characters.find((c) => c.id === activeId) || null;

  useEffect(() => {
    engine.list();
  }, []);

  useEffect(() => {
    if (engine.loading) {
      let i = 0;
      setLoadingMsg(LOADING_MESSAGES[0]);
      const interval = setInterval(() => {
        i = (i + 1) % LOADING_MESSAGES.length;
        setLoadingMsg(LOADING_MESSAGES[i]);
      }, 2200);
      return () => clearInterval(interval);
    }
  }, [engine.loading]);

  const handleExpand = async () => {
    if (!input.trim() || engine.loading) return;
    const char = await engine.expand(input.trim());
    if (char) {
      setActiveId(char.id);
      setView("detail");
      setInput("");
      toast.success(isPT ? "Personagem criado!" : "Character created!");
    }
  };

  const handleRefine = async () => {
    if (!activeId || !refineInput.trim() || engine.loading) return;
    const updated = await engine.refine(activeId, refineInput.trim());
    if (updated) {
      setRefineInput("");
      toast.success(isPT ? "Personagem ajustado!" : "Character refined!");
    }
  };

  const handleLock = async () => {
    if (!activeId) return;
    await engine.lock(activeId);
    toast.success(isPT ? "Personagem bloqueado!" : "Character locked!");
  };

  const handleUnlock = async () => {
    if (!activeId) return;
    await engine.unlock(activeId);
    toast.success(isPT ? "Personagem desbloqueado!" : "Character unlocked!");
  };

  const handleDelete = async () => {
    if (!activeId) return;
    if (!confirm(isPT ? "Apagar este personagem?" : "Delete this character?")) return;
    await engine.remove(activeId);
    setActiveId(null);
    setView("library");
    toast.success(isPT ? "Personagem apagado" : "Character deleted");
  };

  const goBack = () => { setView("library"); setActiveId(null); setShowTechnical(false); };

  // ── LIBRARY VIEW ──
  if (view === "library") {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <header className="h-12 flex items-center justify-between border-b border-border px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{isPT ? "Personagens" : "Characters"}</span>
            {engine.characters.length > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
                {engine.characters.length}
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setView("create")} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            {isPT ? "Novo" : "New"}
          </Button>
        </header>

        <ScrollArea className="flex-1">
          <div className="max-w-[48rem] mx-auto w-full px-4 py-6">
            {engine.characters.length === 0 ? (
              <div className="flex flex-col items-center pt-[8vh] text-center">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <UserCircle className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-foreground mb-1">
                  {isPT ? "Nenhum personagem criado" : "No characters created"}
                </h2>
                <p className="text-xs text-muted-foreground mb-6 max-w-sm">
                  {isPT
                    ? "Descreva um personagem em linguagem natural e a SavvyOwl expande automaticamente todos os detalhes para consistência perfeita."
                    : "Describe a character in natural language and SavvyOwl auto-expands all details for perfect consistency."}
                </p>
                <Button onClick={() => setView("create")} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  {isPT ? "Criar Primeiro Personagem" : "Create First Character"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {engine.characters.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => { setActiveId(char.id); setView("detail"); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/30 transition-all text-left"
                  >
                    <CharacterAvatar character={char} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{char.expanded?.name || "..."}</div>
                      <div className="text-xs text-muted-foreground truncate">{char.expanded?.summary || char.original_input}</div>
                    </div>
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      char.status === "locked"
                        ? "text-green-500 bg-green-500/10"
                        : "text-amber-500 bg-amber-500/10"
                    }`}>
                      {char.status === "locked" ? "🔒 Locked" : "⏳ Pending"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // ── CREATE VIEW ──
  if (view === "create") {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <header className="h-12 flex items-center border-b border-border px-4 shrink-0">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1.5 text-xs mr-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            {isPT ? "Voltar" : "Back"}
          </Button>
          <span className="text-sm font-semibold text-foreground">{isPT ? "Criar Personagem" : "Create Character"}</span>
        </header>

        <ScrollArea className="flex-1">
          <div className="max-w-lg mx-auto w-full px-4 py-8">
            <div className="text-center mb-8">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1">{isPT ? "Criar Personagem" : "Create Character"}</h2>
              <p className="text-xs text-muted-foreground">
                {isPT ? "Descreva em linguagem natural. A SavvyOwl expande tudo automaticamente." : "Describe in natural language. SavvyOwl expands everything automatically."}
              </p>
            </div>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isPT ? "Ex: Crie uma influencer de 20 anos, loira, olhos verdes, corpo curvilíneo, estilo casual moderno..." : "Ex: Create a 20-year-old influencer, blonde, green eyes, curvy, modern casual style..."}
              rows={4}
              className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/15 transition-colors resize-none mb-4"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleExpand(); }}
            />

            <Button onClick={handleExpand} disabled={!input.trim() || engine.loading} className="w-full gap-2 mb-6">
              {engine.loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{loadingMsg}</>
              ) : (
                <><Sparkles className="h-4 w-4" />{isPT ? "Gerar Personagem Completo" : "Generate Complete Character"}</>
              )}
            </Button>

            {engine.error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs mb-4">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {engine.error}
              </div>
            )}

            <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {isPT ? "Exemplos" : "Examples"}
              </p>
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setInput(ex)}
                  className="w-full text-left p-2.5 mb-1.5 rounded-lg bg-secondary/30 hover:bg-secondary/60 hover:border-primary/30 border border-transparent text-xs text-muted-foreground hover:text-foreground transition-all leading-relaxed"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // ── DETAIL VIEW ──
  if (view === "detail" && activeChar) {
    const d = activeChar.expanded;
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <header className="h-12 flex items-center border-b border-border px-4 shrink-0">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1.5 text-xs mr-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            {isPT ? "Voltar" : "Back"}
          </Button>
          <span className="text-sm font-semibold text-foreground truncate">{d?.name || "..."}</span>
        </header>

        <ScrollArea className="flex-1">
          <div className="max-w-[48rem] mx-auto w-full px-4 py-6 space-y-4">

            {/* Header card */}
            <div className="rounded-xl border border-border p-5">
              <div className="flex gap-4 items-start flex-wrap">
                <CharacterAvatar character={activeChar} size={72} />
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-lg font-bold text-foreground">{d?.name}</span>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                      activeChar.status === "locked" ? "text-green-500 bg-green-500/10" : "text-amber-500 bg-amber-500/10"
                    }`}>
                      {activeChar.status === "locked" ? "🔒 Locked" : "⏳ Pending"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{d?.summary}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/50">"{activeChar.original_input}"</p>
                </div>
              </div>

              <div className="flex gap-2 mt-4 flex-wrap">
                {activeChar.status === "pending" ? (
                  <Button size="sm" onClick={handleLock} className="gap-1.5 text-xs">
                    <Lock className="h-3 w-3" /> {isPT ? "Aprovar & Bloquear" : "Approve & Lock"}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleUnlock} className="gap-1.5 text-xs">
                    <Unlock className="h-3 w-3" /> {isPT ? "Desbloquear" : "Unlock"}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowTechnical(!showTechnical)} className="gap-1.5 text-xs">
                  <Eye className="h-3 w-3" /> {showTechnical ? (isPT ? "Esconder Detalhes" : "Hide Details") : (isPT ? "Ver Detalhes" : "Show Details")}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDelete} className="gap-1.5 text-xs text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" /> {isPT ? "Apagar" : "Delete"}
                </Button>
              </div>
            </div>

            {/* Refine (only pending) */}
            {activeChar.status === "pending" && (
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-semibold text-foreground mb-2">
                  <Pencil className="h-3 w-3 inline mr-1.5" />
                  {isPT ? "Ajustar Personagem" : "Refine Character"}
                </p>
                <div className="flex gap-2">
                  <input
                    value={refineInput}
                    onChange={(e) => setRefineInput(e.target.value)}
                    placeholder={isPT ? "Ex: Mude o cabelo para mais curto, adicione sardas..." : "Ex: Make hair shorter, add freckles..."}
                    className="flex-1 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                    onKeyDown={(e) => { if (e.key === "Enter") handleRefine(); }}
                  />
                  <Button size="sm" onClick={handleRefine} disabled={!refineInput.trim() || engine.loading} className="text-xs gap-1.5">
                    {engine.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {isPT ? "Ajustar" : "Refine"}
                  </Button>
                </div>
                {engine.error && (
                  <p className="text-xs text-destructive mt-2">{engine.error}</p>
                )}
              </div>
            )}

            {/* Technical details */}
            {showTechnical && d && (
              <div className="space-y-2">
                <DetailSection title={isPT ? "Identidade" : "Identity"} data={d.identity} />
                <DetailSection title={isPT ? "Rosto" : "Face"} data={d.face} />
                <DetailSection title={isPT ? "Cabelo" : "Hair"} data={d.hair} />
                <DetailSection title={isPT ? "Corpo" : "Body"} data={d.body} />
                <DetailSection title={isPT ? "Guarda-roupa" : "Wardrobe"} data={d.default_wardrobe} />
                <DetailSection title={isPT ? "Voz & Comportamento" : "Voice & Behavior"} data={d.voice_behavior} />
              </div>
            )}

            {/* Prompts */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">
                {isPT ? "Prompts Prontos" : "Ready Prompts"}
              </p>
              <p className="text-xs text-muted-foreground -mt-2">
                {isPT ? "Copie e cole diretamente na ferramenta." : "Copy and paste directly into the tool."}
              </p>

              {d?.nano_banana_prompt && (
                <PromptBlock label="Nano Banana — Imagem" icon={Image} color="#eab308" text={d.nano_banana_prompt} />
              )}

              {d?.negative_prompt && (
                <PromptBlock label="Negative Prompt" icon={AlertCircle} color="#ef4444" text={d.negative_prompt} />
              )}
            </div>

            {/* History */}
            {activeChar.history?.length > 1 && (
              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {isPT ? "Histórico" : "History"}
                </p>
                {activeChar.history.map((h: any, i: number) => (
                  <div key={i} className="flex gap-3 items-start py-1.5 border-b border-border/30 last:border-0 text-xs">
                    <span className={`font-mono text-[10px] uppercase min-w-[60px] ${
                      h.action === "locked" ? "text-green-500" : h.action === "refined" ? "text-amber-500" : "text-blue-500"
                    }`}>{h.action}</span>
                    <span className="text-muted-foreground flex-1">{h.input || "—"}</span>
                    <span className="text-muted-foreground/50 font-mono text-[10px]">
                      {new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return null;
}
