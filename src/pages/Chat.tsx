import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { streamChat, ChatMessage, ChatImage } from "@/lib/chat-stream";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Plus, MessageSquare, Zap, Brain, Pen, Sparkles, ChevronDown, Lock, Menu, ImagePlus, X, Bot } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ReactMarkdown from "react-markdown";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ChatSidebar } from "@/components/ChatSidebar";

type Mode = "quick" | "deep" | "creator" | "opus";

type ExtendedMessage = ChatMessage & {
  model_used?: string;
  cost_eur?: number;
  optimized_content?: string | null;
  model_recommended?: string | null;
  task_type?: string | null;
  optimization_savings_eur?: number | null;
  image_url?: string | null;
};

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

export default function Chat() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversationId, setConversationId] = useState<string | null>(searchParams.get("id"));
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [input, setInput] = useState(searchParams.get("prompt") || "");
  const [mode, setMode] = useState<Mode>("quick");
  const [isLoading, setIsLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const sentFirstMessage = useRef(false);

  const modeLabels: Record<Mode, { label: string; icon: typeof Zap; desc: string }> = {
    quick: { label: t("chat.quick"), icon: Zap, desc: t("chat.quickDesc") },
    deep: { label: t("chat.deepThink"), icon: Brain, desc: t("chat.deepThinkDesc") },
    creator: { label: t("chat.contentCreator"), icon: Pen, desc: t("chat.contentCreatorDesc") },
    opus: { label: "Opus", icon: Sparkles, desc: "Claude Opus — maximum power (Pro only)" },
  };

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = window.innerHeight * 0.3;
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
    el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    adjustTextarea();
  }, [input, adjustTextarea]);

  useEffect(() => {
    if (!conversationId) { setMessages([]); return; }
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("role, content, model_used, cost_eur, optimized_content, model_recommended, task_type, optimization_savings_eur, image_url")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as any);
    })();
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (prompt && !isLoading) {
      setInput("");
      searchParams.delete("prompt");
      setSearchParams(searchParams, { replace: true });
      handleSend(prompt);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    };
  }, [pendingImage]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(t("chat.imageTooBig"));
      return;
    }
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage({ file, preview: URL.createObjectURL(file) });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  };

  const fileToBase64 = (file: File): Promise<ChatImage> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve({ data: base64, media_type: file.type });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const createConversation = async (): Promise<string> => {
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user!.id, mode, title: "New Chat" })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  };

  const handleSend = async (overrideInput?: string) => {
    const text = overrideInput || input.trim();
    const hasImage = !!pendingImage;
    if ((!text && !hasImage) || isLoading) return;
    if (!overrideInput) setInput("");

    if (profile?.plan === "free" && mode !== "quick") {
      toast.error(t("chat.upgradeMode"));
      return;
    }

    setIsLoading(true);
    let convId = conversationId;
    let imagePayload: ChatImage | null = null;
    const currentImage = pendingImage;
    setPendingImage(null);

    try {
      if (currentImage) {
        imagePayload = await fileToBase64(currentImage.file);
        URL.revokeObjectURL(currentImage.preview);
      }

      if (!convId) {
        convId = await createConversation();
        setConversationId(convId);
        const title = (text || t("chat.imageUpload")).slice(0, 50) + ((text || "").length > 50 ? "..." : "");
        await supabase.from("conversations").update({ title }).eq("id", convId);
      }

      const userMsg: ExtendedMessage = {
        role: "user",
        content: text || t("chat.imageUpload"),
        image_url: currentImage?.preview || null,
      };
      setMessages((prev) => [...prev, userMsg]);

      await supabase.from("messages").insert({
        conversation_id: convId,
        role: "user",
        content: text || t("chat.imageUpload"),
      });

      if (!sentFirstMessage.current) {
        sentFirstMessage.current = true;
        window.dispatchEvent(new CustomEvent("install-prompt-trigger"));
      }

      let assistantSoFar = "";
      const historyMessages = conversationId ? messages : [];
      const allMessages = [...historyMessages, { role: userMsg.role, content: userMsg.content }].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant" as const, content: assistantSoFar }];
        });
      };

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      await streamChat({
        messages: allMessages,
        mode,
        conversationId: convId,
        accessToken,
        image: imagePayload,
        onDelta: upsertAssistant,
        onDone: async (meta) => {
          await supabase.from("messages").insert({
            conversation_id: convId!,
            role: "assistant",
            content: assistantSoFar,
            model_used: meta.model,
            cost_eur: meta.cost_eur,
          });
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, model_used: meta.model, cost_eur: meta.cost_eur } : m
            )
          );
          if (meta.image_url) {
            setMessages((prev) =>
              prev.map((m) =>
                m.role === "user" && m.image_url === currentImage?.preview
                  ? { ...m, image_url: meta.image_url }
                  : m
              )
            );
          }
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          setIsLoading(false);
        },
        onError: (err) => {
          toast.error(err);
          setIsLoading(false);
        },
      });
    } catch {
      toast.error(t("chat.somethingWrong"));
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setInput("");
    setPendingImage(null);
    setSearchParams({}, { replace: true });
  };

  const selectConversation = (id: string) => {
    setConversationId(id);
    setSearchParams({ id }, { replace: true });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const userInitial = (profile?.full_name || "U").charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-full">
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-[260px] shrink-0 h-full">
        <ChatSidebar
          conversationId={conversationId}
          onSelectConversation={selectConversation}
          onNewChat={startNewChat}
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-background">
        {/* Header */}
        <header className="h-12 flex items-center justify-between border-b border-border px-3 md:px-4 bg-background shrink-0">
          <div className="flex items-center gap-2">
            <div className="md:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[280px]">
                  <ChatSidebar
                    conversationId={conversationId}
                    onSelectConversation={selectConversation}
                    onNewChat={startNewChat}
                    onCloseMobile={() => setMobileOpen(false)}
                  />
                </SheetContent>
              </Sheet>
            </div>
            <button
              onClick={startNewChat}
              className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-secondary"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("chat.newChat")}
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <LanguageSelector />
          </div>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="max-w-[48rem] mx-auto w-full px-4 md:px-6 py-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  {t("chat.startConversation")}
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                  {t("chat.startConversationDesc")}
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 md:gap-4 py-5 ${i > 0 ? "border-t border-border/40" : ""}`}
              >
                {/* Avatar */}
                <div className="shrink-0 mt-0.5">
                  {msg.role === "user" ? (
                    <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
                      <span className="text-[11px] font-semibold text-primary">{userInitial}</span>
                    </div>
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-foreground/8 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-foreground/60" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-xs font-semibold text-foreground/60 mb-1.5">
                    {msg.role === "user" ? (profile?.full_name || "You") : "SavvyOwl"}
                  </p>

                  {msg.role === "user" && msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt="Uploaded"
                      className="max-w-[280px] w-full rounded-lg border border-border mb-3"
                      loading="lazy"
                    />
                  )}

                  <div className="chat-prose text-[0.9375rem] text-foreground">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {msg.role === "assistant" && msg.model_used && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center text-[11px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">
                        €{(msg.cost_eur || 0).toFixed(4)}
                      </span>
                      <span className="text-[11px] text-muted-foreground/50">
                        {msg.model_used.split("/").pop()}
                      </span>
                    </div>
                  )}

                  {msg.role === "assistant" && msg.optimized_content && (
                    <Collapsible className="mt-3">
                      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span>{t("chat.optimizedBy")}</span>
                        {msg.model_recommended && (
                          <span className="text-muted-foreground/50">· {msg.model_recommended.split("/").pop()}</span>
                        )}
                        <ChevronDown className="h-3 w-3 ml-1 transition-transform group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 bg-secondary/40 border border-border/40 rounded-lg p-3 space-y-2 text-xs">
                          {msg.model_recommended && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t("chat.modelUsed")}</span>
                              <span className="text-foreground font-medium">{msg.model_recommended.split("/").pop()}</span>
                            </div>
                          )}
                          {msg.task_type && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t("chat.taskType")}</span>
                              <span className="text-foreground font-medium">{msg.task_type}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("chat.estimatedSavings")}</span>
                            <span className="text-foreground font-medium">
                              {msg.optimization_savings_eur ? `€${msg.optimization_savings_eur.toFixed(4)}` : "—"}
                            </span>
                          </div>
                          <Collapsible>
                            <CollapsibleTrigger className="text-primary hover:text-primary/80 transition-colors text-xs font-medium mt-1">
                              {t("chat.viewOptimizedPrompt")}
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <pre className="mt-2 bg-background border border-border/30 rounded-md p-2.5 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                                {msg.optimized_content}
                              </pre>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </div>
            ))}

            {/* Thinking indicator */}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-3 md:gap-4 py-5 border-t border-border/40">
                <div className="shrink-0 mt-0.5">
                  <div className="h-7 w-7 rounded-full bg-foreground/8 flex items-center justify-center">
                    <Bot className="h-3.5 w-3.5 text-foreground/60" />
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-primary/50 thinking-dot" />
                    <div className="h-2 w-2 rounded-full bg-primary/50 thinking-dot" />
                    <div className="h-2 w-2 rounded-full bg-primary/50 thinking-dot" />
                  </div>
                </div>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="shrink-0 border-t border-border bg-background">
          <div className="max-w-[48rem] mx-auto w-full px-3 md:px-6">
            {/* Mode pills */}
            <div className="flex gap-1 pt-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {(Object.entries(modeLabels) as [Mode, typeof modeLabels.quick][]).map(([key, val]) => {
                const isOpusLocked = key === "opus" && profile?.plan !== "pro";
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (isOpusLocked) {
                        toast.error("Upgrade to Pro to use Claude Opus");
                        return;
                      }
                      setMode(key);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                      isOpusLocked
                        ? "text-muted-foreground/30 cursor-not-allowed"
                        : mode === key
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {isOpusLocked ? <Lock className="h-3 w-3" /> : <val.icon className="h-3 w-3" />}
                    {val.label}
                  </button>
                );
              })}
            </div>

            {/* Pending image */}
            {pendingImage && (
              <div className="pb-2">
                <div className="relative inline-block">
                  <img
                    src={pendingImage.preview}
                    alt="Preview"
                    className="max-w-[180px] max-h-[100px] border border-border object-cover rounded-lg"
                  />
                  <button
                    onClick={removePendingImage}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:opacity-80 transition-opacity shadow-sm"
                    aria-label={t("chat.removeImage")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Textarea + send */}
            <div className="flex items-end gap-2 pb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                capture="environment"
                className="hidden"
                onChange={handleImageSelect}
              />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground rounded-lg"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title={t("chat.imageUpload")}
              >
                <ImagePlus className="h-4 w-4" />
              </Button>

              <div className="flex-1 min-w-0">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("chat.typeMessage")}
                  rows={1}
                  disabled={isLoading}
                  className="w-full resize-none rounded-xl border border-border bg-secondary/30 px-4 py-3 text-[0.9375rem] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/15 transition-colors disabled:opacity-50 leading-relaxed"
                  style={{ minHeight: "48px", maxHeight: "30vh", overflowY: "hidden" }}
                />
              </div>

              <Button
                onClick={() => handleSend()}
                disabled={isLoading || (!input.trim() && !pendingImage)}
                size="icon"
                className="shrink-0 h-9 w-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 transition-opacity"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
