import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { streamChat, ChatMessage } from "@/lib/chat-stream";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Plus, MessageSquare, Zap, Brain, Pen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Mode = "quick" | "deep" | "creator";

const modeLabels: Record<Mode, { label: string; icon: typeof Zap; desc: string }> = {
  quick: { label: "Quick", icon: Zap, desc: "Fast & affordable" },
  deep: { label: "Deep Think", icon: Brain, desc: "Best quality" },
  creator: { label: "ContentCreator AI", icon: Pen, desc: "Optimized for content" },
};

export default function Chat() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversationId, setConversationId] = useState<string | null>(searchParams.get("id"));
  const [messages, setMessages] = useState<(ChatMessage & { model_used?: string; cost_eur?: number })[]>([]);
  const [input, setInput] = useState(searchParams.get("prompt") || "");
  const [mode, setMode] = useState<Mode>("quick");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Conversation list
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

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("role, content, model_used, cost_eur")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as any);
    })();
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-send prompt from URL
  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (prompt && !isLoading) {
      setInput("");
      searchParams.delete("prompt");
      setSearchParams(searchParams, { replace: true });
      handleSend(prompt);
    }
  }, []);

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
    if (!text || isLoading) return;
    if (!overrideInput) setInput("");

    // Check plan mode restrictions
    if (profile?.plan === "free" && mode !== "quick") {
      toast.error("Upgrade to Starter or Pro to use this mode.");
      return;
    }

    setIsLoading(true);
    let convId = conversationId;

    try {
      if (!convId) {
        convId = await createConversation();
        setConversationId(convId);

        // Update title from first message
        const title = text.slice(0, 50) + (text.length > 50 ? "..." : "");
        await supabase.from("conversations").update({ title }).eq("id", convId);
      }

      const userMsg: ChatMessage & { model_used?: string; cost_eur?: number } = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);

      // Save user message
      await supabase.from("messages").insert({
        conversation_id: convId,
        role: "user",
        content: text,
      });

      let assistantSoFar = "";
      const allMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

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

      await streamChat({
        messages: allMessages,
        mode,
        conversationId: convId,
        onDelta: upsertAssistant,
        onDone: async (meta) => {
          // Save assistant message
          await supabase.from("messages").insert({
            conversation_id: convId!,
            role: "assistant",
            content: assistantSoFar,
            model_used: meta.model,
            cost_eur: meta.cost_eur,
          });

          // Update last message with metadata
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, model_used: meta.model, cost_eur: meta.cost_eur } : m
            )
          );

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
      toast.error("Something went wrong. Try again.");
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setInput("");
    setSearchParams({}, { replace: true });
  };

  const selectConversation = (id: string) => {
    setConversationId(id);
    setSearchParams({ id }, { replace: true });
  };

  const modeDisplayName = (m: string) => {
    if (m === "quick") return "Quick ⚡";
    if (m === "deep") return "Deep Think 🧠";
    return "ContentCreator ✍️";
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Conversation sidebar */}
      <div className="w-64 border-r border-border bg-card/50 flex flex-col shrink-0 hidden md:flex">
        <div className="p-3">
          <Button onClick={startNewChat} className="w-full" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {conversations?.map((c) => (
              <button
                key={c.id}
                onClick={() => selectConversation(c.id)}
                className={`w-full text-left p-2.5 rounded-lg text-sm transition-colors truncate ${
                  conversationId === c.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                <MessageSquare className="h-3 w-3 inline mr-2" />
                {c.title}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Creator mode banner */}
        {mode === "creator" && (
          <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-sm text-primary flex items-center gap-2">
            <Pen className="h-4 w-4" />
            ContentCreator AI — optimized for captions, scripts, and copy
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Start a conversation</h2>
                <p className="text-muted-foreground max-w-md">
                  Choose a mode and type your message. PromptOS will route it to the best AI automatically.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border"
                  }`}
                >
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
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl px-4 py-3">
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

        {/* Input */}
        <div className="border-t border-border p-4 bg-background">
          <div className="max-w-3xl mx-auto flex gap-3 items-end">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-[180px] bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(modeLabels).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <val.icon className="h-3 w-3" />
                      {val.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Type your message..."
                className="bg-card border-border pr-12"
                disabled={isLoading}
              />
            </div>
            <Button onClick={() => handleSend()} disabled={isLoading || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
