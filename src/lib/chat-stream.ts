const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function streamChat({
  messages,
  mode,
  conversationId,
  onDelta,
  onDone,
  onError,
}: {
  messages: ChatMessage[];
  mode: string;
  conversationId: string;
  onDelta: (text: string) => void;
  onDone: (response: { model: string; cost_eur: number; tokens_input: number; tokens_output: number }) => void;
  onError: (error: string) => void;
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages, mode, conversationId }),
    });

    if (resp.status === 429) {
      onError("You're sending too many requests. Please wait a moment and try again.");
      return;
    }
    if (resp.status === 402) {
      onError("Usage limit reached. Please upgrade your plan to continue.");
      return;
    }
    if (!resp.ok || !resp.body) {
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        onError(json.error || "Something went wrong. Try again.");
      } catch {
        onError("Something went wrong. Try again.");
      }
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;
    let metadata: any = null;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          
          // Check for metadata (sent as last event before [DONE])
          if (parsed.metadata) {
            metadata = parsed.metadata;
            continue;
          }

          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Flush remaining
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.metadata) { metadata = parsed.metadata; continue; }
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {}
      }
    }

    onDone(metadata || { model: "unknown", cost_eur: 0, tokens_input: 0, tokens_output: 0 });
  } catch (e) {
    onError("Something went wrong. Try again.");
  }
}
