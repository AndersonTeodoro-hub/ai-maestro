import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { streamChat, ChatMessage, ChatImage } from "@/lib/chat-stream";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Plus, MessageSquare, Zap, Brain, Pen, Sparkles, ChevronDown, Lock, Menu, ImagePlus, X } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer";
import ReactMarkdown from "react-markdown";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

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

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

export default function Chat() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversationId, setConversationId] = useState<string | null>(searchParams.get("id"));
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [input, setInput] = useState(searchParams.get("prompt") || "");
  const [mode, setMode] = useState<Mode>("quick");
  const [isLoading, setIsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  const { data: conversations } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, title, mode, created_at")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      return data || [];
    },
  });

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

  // Cleanup preview URL on unmount
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
    // Reset file input so same file can be re-selected
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
        // Remove "data:image/png;base64," prefix
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
      // Convert image to base64
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
        // Show local preview immediately
        image_url: currentImage?.preview || null,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Insert user message (image_url will be set by edge function)
      await supabase.from("messages").insert({
        conversation_id: convId,
        role: "user",
        content: text || t("chat.imageUpload"),
      });

      // Trigger install prompt after first message
      if (!sentFirstMessage.current) {
        sentFirstMessage.current = true;
        window.dispatchEvent(new CustomEvent("install-prompt-trigger"));
      }

      let assistantSoFar = "";
      const allMessages = [...messages, { role: userMsg.role, content: userMsg.content }].map((m) => ({
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
          // Update user message with stored image_url if returned
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
    setDrawerOpen(false);
  };
  const selectConversation = (id: string) => {
    setConversationId(id);
    setSearchParams({ id }, { replace: true });
    setDrawerOpen(false);
  };

  const ConversationList = () => (
    <div className="space-y-1 p-2">
      {conversations?.map((c) => (
        <button
          key={c.id}
          onClick={() => selectConversation(c.id)}
          className={`w-full text-left p-2.5 rounded-lg text-sm transition-all duration-200 truncate min-h-[44px] ${
            conversationId === c.id
              ? "bg-primary/10 text-primary border border-primary/20"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground border border-transparent"
          }`}
        >
          <MessageSquare className="h-3 w-3 inline mr-2" />
          {c.title}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem-4rem)] md:h-[calc(100vh-3.5rem)]">
      {/* Mobile conversation drawer trigger */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[80vh]">
          <div className="p-3">
            <Button onClick={startNewChat} className="w-full glow-primary" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t("chat.newChat")}
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <ConversationList />
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* Desktop conversation sidebar */}
      <div className="w-64 border-r border-border bg-[hsl(var(--surface-1))] flex-col shrink-0 hidden md:flex">
        <div className="p-3">
          <Button onClick={startNewChat} className="w-full glow-primary" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("chat.newChat")}
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <ConversationList />
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-border bg-[hsl(var(--surface-1))]/50">
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" onClick={() => setDrawerOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Button onClick={startNewChat} size="sm" variant="ghost" className="min-h-[44px]">
            <Plus className="mr-1 h-4 w-4" />
            {t("chat.newChat")}
          </Button>
        </div>

        {mode === "creator" && (
          <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-sm text-primary flex items-center gap-2">
            <Pen className="h-4 w-4" />
            {t("chat.contentCreatorBanner")}
          </div>
        )}

        <ScrollArea className="flex-1 p-4">
          <div className="max-w-3xl mx-auto md:max-w-3xl space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 glow-primary">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2 text-tracking-tight">{t("chat.startConversation")}</h2>
                <p className="text-muted-foreground max-w-md">{t("chat.startConversationDesc")}</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-full md:max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-border text-foreground rounded-br-md"
                    : "bg-[hsl(var(--surface-2))] border-l-2 border-primary text-foreground rounded-bl-md"
                }`}>
                  {/* Render image if present */}
                  {msg.role === "user" && msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt="Uploaded"
                      className="max-w-[300px] w-full border border-border mb-2"
                      loading="lazy"
                    />
                  )}
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                   {msg.role === "assistant" && msg.model_used && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="bg-secondary px-2 py-0.5 rounded-full">
                        {msg.model_used?.split("/").pop()} • €{(msg.cost_eur || 0).toFixed(4)}
                      </span>
                    </div>
                  )}
                  {msg.role === "assistant" && msg.optimized_content && (
                    <Collapsible className="mt-2">
                      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full group">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span>{t("chat.optimizedBy")}</span>
                        {msg.model_recommended && (
                          <span className="text-muted-foreground/70">• {msg.model_recommended.split("/").pop()}</span>
                        )}
                        <ChevronDown className="h-3 w-3 ml-auto transition-transform group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 bg-accent/5 border border-border/50 rounded-lg p-3 space-y-2 text-xs">
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
                              <pre className="mt-2 bg-muted/50 border border-border/30 rounded-md p-2.5 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
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

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-[hsl(var(--surface-2))] border-l-2 border-primary rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-primary thinking-dot" />
                    <div className="h-2 w-2 rounded-full bg-primary thinking-dot" />
                    <div className="h-2 w-2 rounded-full bg-primary thinking-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Image preview */}
        {pendingImage && (
          <div className="border-t border-border px-3 md:px-4 pt-2 bg-background">
            <div className="max-w-3xl mx-auto relative inline-block">
              <img
                src={pendingImage.preview}
                alt="Preview"
                className="max-w-[200px] max-h-[120px] border border-border object-cover"
              />
              <button
                onClick={removePendingImage}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:opacity-80 transition-opacity"
                aria-label={t("chat.removeImage")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-border p-3 md:p-4 bg-background">
          <div className="max-w-3xl mx-auto space-y-2 md:space-y-0 md:flex md:gap-3 md:items-end">
            {/* Mode selector */}
            <div className="flex bg-[hsl(var(--surface-1))] rounded-xl p-1 border border-border overflow-x-auto shrink-0">
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap min-h-[44px] md:min-h-0 ${
                      isOpusLocked
                        ? "text-muted-foreground/40 cursor-not-allowed"
                        : mode === key
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isOpusLocked ? <Lock className="h-3 w-3" /> : <val.icon className="h-3 w-3" />}
                    {val.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 md:gap-3 flex-1">
              {/* Image upload button */}
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
                className="shrink-0 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title={t("chat.imageUpload")}
              >
                <ImagePlus className="h-5 w-5" />
              </Button>
              <div className="flex-1 relative">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder={t("chat.typeMessage")}
                  className="bg-[hsl(var(--surface-2))] border-border focus-visible:border-primary focus-visible:ring-primary/30 pr-12 min-h-[44px]"
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={() => handleSend()}
                disabled={isLoading || (!input.trim() && !pendingImage)}
                size="icon"
                className="glow-primary shrink-0 min-h-[44px] min-w-[44px]"
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
