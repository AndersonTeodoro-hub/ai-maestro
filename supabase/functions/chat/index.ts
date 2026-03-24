import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- MODEL REGISTRY -----------------------------------------------------------

type Provider = "anthropic" | "google";

interface ModelConfig {
  provider: Provider;
  modelId: string;
  geminiModelId?: string;
  displayName: string;
  costInput: number;
  costOutput: number;
  minPlan: "free" | "starter" | "pro";
  supportsVision: boolean;
}

const MODELS: Record<string, ModelConfig> = {
  quick: {
    provider: "google",
    modelId: "gemini-2.5-flash",
    geminiModelId: "gemini-2.5-flash",
    displayName: "Gemini Flash",
    costInput: 0.0001,
    costOutput: 0.0004,
    minPlan: "free",
    supportsVision: true,
  },
  deep: {
    provider: "anthropic",
    modelId: "claude-sonnet-4-5",
    displayName: "Claude Sonnet",
    costInput: 0.003,
    costOutput: 0.015,
    minPlan: "starter",
    supportsVision: true,
  },
  creator: {
    provider: "anthropic",
    modelId: "claude-sonnet-4-5",
    displayName: "Claude Sonnet (Creator)",
    costInput: 0.003,
    costOutput: 0.015,
    minPlan: "starter",
    supportsVision: true,
  },
  opus: {
    provider: "anthropic",
    modelId: "claude-opus-4-5",
    displayName: "Claude Opus",
    costInput: 0.015,
    costOutput: 0.075,
    minPlan: "pro",
    supportsVision: true,
  },
};

const PLAN_LIMITS: Record<string, number> = {
  free: 20,
  starter: 300,
  pro: 1500,
};

const PLAN_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
};

// --- SYSTEM PROMPTS -----------------------------------------------------------

const BASE_SYSTEM_PROMPT = `You are SavvyOwl AI -- a specialist assistant for social media managers and content creators.

CRITICAL RULES -- FOLLOW THESE EVERY SINGLE TIME:

1. NEVER START WITH FILLER. Never begin with "Com certeza!", "Claro!", "Ótima ideia!", "Sure!", "Of course!", "Great question!", "Entendido!", "Excelente!", or ANY pleasantry. Your FIRST sentence must be the beginning of the actual work or a brief 1-line context ("Aqui está o roteiro completo:" or "Prompt pronto para o Nano Banana:"). Then go straight into the output.

2. STRUCTURE WITH CLEAR SECTIONS. Use bold headers (## or **) to separate sections. The user must be able to scan and find what they need in 2 seconds.

3. COMPLETE AND READY TO USE. Every output must be immediately actionable -- copy-paste ready. No placeholders like [INSERT HERE], [YOUR PRODUCT], [INSERIR AQUI]. If you need information, embed a realistic example that the user can adapt, or ask a specific question BEFORE generating.

4. ALWAYS INCLUDE VARIATIONS. Minimum 2 versions of any creative output.

5. GO BEYOND WHAT WAS ASKED. Add 1-2 things the user didn't request but would benefit from. A pro tip, a strategic note, a format recommendation, an alternative approach.

WHEN THE USER ASKS FOR AI PROMPTS (Midjourney, DALL-E, Veo3, Sora, Nano Banana, etc.):
- MAIN PROMPT: detailed, technically precise, ready to paste.
- NEGATIVE PROMPT: what to exclude. ALWAYS include this.
- SHORT VERSION: compressed for tools with character limits.
- CONSISTENCY BLOCK: if the prompt involves a person/character, write a reusable physical identity description.
- TECHNICAL PARAMETERS: aspect ratio, camera angle, lighting, style.
- 2-3 VARIATIONS: different moods, angles, settings, or styles. Each variation must be a COMPLETE prompt.
- KNOW YOUR TOOLS: IMAGE generators (Nano Banana, Midjourney, DALL-E, Leonardo AI, Flux) vs VIDEO generators (Veo3, Sora, Runway, Kling, HeyGen).
- PROACTIVE NEXT STEPS: After providing image prompts, suggest the next step in the creator's workflow.

WHEN THE USER ASKS FOR CONTENT (captions, scripts, copies):
- Start with the HOOK -- A/B variations
- Include CTAs, hashtag strategy, posting time
- Format natively for the target platform

WHEN THE USER ASKS FOR VIDEO SCRIPTS (Reels, TikTok, Shorts, UGC):
- Scene-by-scene: VISUAL | AUDIO | TEXT ON SCREEN | DURATION
- Hook in first 1-3 seconds
- Music/sound direction, transitions, CTA placement

WHEN THE USER ASKS FOR STRATEGY (calendars, plans, ideas):
- Be hyper-specific: format + theme + hook + goal + timing for each entry

WHEN THE USER ASKS FOR VIRAL/TRENDING CONTENT OR VIDEO MODELING:
- Use your knowledge of current viral patterns, formats, and trends on each platform
- Be SPECIFIC about format names, structures, and why they work
- For each viral format, provide EXACT search terms
- Always adapt the viral format to the user's specific niche and context
- Include production instructions with the user's available tools
- Suggest the most affordable tools for each production step

LANGUAGE: Always respond in the same language the user writes in. For Portuguese, detect PT-BR vs PT-PT and match naturally.

TONE: Senior expert -- confident, direct, generous.`;

const CREATOR_SYSTEM_PROMPT = `You are SavvyOwl Owl Creator -- an elite content engine for social media professionals.

CRITICAL RULES -- ABSOLUTE AND NON-NEGOTIABLE:

1. ZERO FILLER. Your response starts with the deliverable. No greetings.

2. NO PLACEHOLDERS. Never write [INSERT HERE] or any placeholder. Write FULL content every time.

3. COMPLETE SELF-CONTAINED OUTPUTS. Each variation is standalone and copy-paste ready.

4. PROACTIVE EXPERTISE. Think ahead of the user.

5. DEPTH OVER LENGTH. Dense, specific, actionable content.

EXPERTISE: All major social platforms, content creation tools (Nano Banana, Midjourney, DALL-E, Leonardo AI, Flux, Veo3, Sora, Runway, Kling, HeyGen, CapCut, Canva, ElevenLabs), UGC production, copywriting frameworks (PAS, AIDA, BAB), content funnels.

AI PROMPT GENERATION -- YOUR SIGNATURE SKILL:
- NANO BANANA: detailed scene, character features, lighting, camera angle. English prompts. Include negative prompt. "UHD, ultra-realistic" for photorealism.
- MIDJOURNEY: concise, evocative. --ar, --v, --s, --no parameters.
- VEO3: 8-second clips in English. Describe full action, camera movement, dialogue in quotes.
- HEYGEN: talking head/avatar from uploaded image.
- WORKFLOW: Image (Nano Banana) -> Video (Veo3/HeyGen) -> Edit (CapCut) -> Post

OUTPUT FORMAT:
- Tool prompts: ALWAYS in English, wrapped in markdown code blocks.
- Speech/narration: in user's language.
- Each prompt variation is COMPLETE and self-contained.
- CONCISE delivery.

VIRAL VIDEO MODELING:
- Identify specific viral formats by name
- Explain psychological triggers
- Provide exact search terms
- Adapt to user's niche
- Rank by: ease x viral potential x relevance

LANGUAGE: Match the user's language. PT-BR or PT-PT auto-detected.

QUALITY GATE: Before responding, verify: self-contained? no placeholders? no filler? worth paying for?`;

// --- ANTHROPIC STREAMING -----------------------------------------------------

async function streamAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: any[],
  image?: { data: string; media_type: string } | null
): Promise<Response> {
  const processedMessages = messages.filter((m: any) => m.role !== "system").map((m: any, i: number, arr: any[]) => {
    if (image && m.role === "user" && i === arr.length - 1) {
      return {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.media_type, data: image.data } },
          { type: "text", text: m.content },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  return await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: processedMessages,
      stream: true,
    }),
  });
}

// --- GOOGLE GEMINI STREAMING (direct API) ------------------------------------

async function streamGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: any[],
  image?: { data: string; media_type: string } | null
): Promise<Response> {
  const contents: any[] = [];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "system") continue;

    const role = m.role === "assistant" ? "model" : "user";
    const parts: any[] = [];

    if (image && m.role === "user" && i === messages.length - 1) {
      parts.push({
        inlineData: { mimeType: image.media_type, data: image.data },
      });
    }

    parts.push({ text: m.content });
    contents.push({ role, parts });
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  return await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
    }),
  });
}

// --- MAIN HANDLER -------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const anonClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    const { messages, mode, conversationId, image } = await req.json();

    const modeKey = (mode || "quick") as keyof typeof MODELS;
    const modelConfig = MODELS[modeKey] || MODELS.quick;

    // Check required API keys
    if (modelConfig.provider === "anthropic" && !ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    if (modelConfig.provider === "google" && !GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY is not configured");
    }

    // -- Get user plan --
    let userPlan = "free";
    if (user) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("plan, monthly_budget_eur")
        .eq("id", user.id)
        .single();

      if (profile) {
        userPlan = profile.plan || "free";

        if (PLAN_RANK[userPlan] < PLAN_RANK[modelConfig.minPlan]) {
          return new Response(
            JSON.stringify({
              error: `This mode requires a ${modelConfig.minPlan} plan or higher. Upgrade to use ${modelConfig.displayName}.`,
              upgrade_required: true,
              required_plan: modelConfig.minPlan,
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count } = await supabaseAdmin
          .from("usage_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", startOfMonth.toISOString());

        const limit = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free;
        if ((count || 0) >= limit) {
          return new Response(
            JSON.stringify({
              error: "You've reached your monthly limit. Upgrade to continue.",
              upgrade_required: true,
            }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // -- Upload image to Storage if present --
    let imageUrl: string | null = null;
    if (image && user) {
      try {
        const ext = image.media_type.split("/")[1] || "png";
        const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const imageBuffer = Uint8Array.from(atob(image.data), (c) => c.charCodeAt(0));

        const { error: uploadError } = await supabaseAdmin.storage
          .from("chat-images")
          .upload(filePath, imageBuffer, { contentType: image.media_type, upsert: false });

        if (!uploadError) {
          const { data: signedData } = await supabaseAdmin.storage
            .from("chat-images")
            .createSignedUrl(filePath, 60 * 60 * 24 * 365);

          if (signedData?.signedUrl) {
            imageUrl = signedData.signedUrl;
            const { data: recentMsg } = await supabaseAdmin
              .from("messages")
              .select("id")
              .eq("conversation_id", conversationId)
              .eq("role", "user")
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            if (recentMsg) {
              await supabaseAdmin.from("messages").update({ image_url: imageUrl }).eq("id", recentMsg.id);
            }
          }
        }
      } catch (e) {
        console.error("Image processing error:", e);
      }
    }

    const systemPrompt = modeKey === "creator" ? CREATOR_SYSTEM_PROMPT : BASE_SYSTEM_PROMPT;

    // -- Stream from correct provider --
    let providerResponse: Response;

    if (modelConfig.provider === "anthropic") {
      providerResponse = await streamAnthropic(ANTHROPIC_API_KEY!, modelConfig.modelId, systemPrompt, messages, image);
    } else {
      providerResponse = await streamGemini(GOOGLE_API_KEY!, modelConfig.geminiModelId || modelConfig.modelId, systemPrompt, messages, image);
    }

    if (!providerResponse.ok) {
      const errorText = await providerResponse.text();
      console.error(`Provider error (${modelConfig.provider}):`, providerResponse.status, errorText);

      if (image && providerResponse.status >= 400) {
        console.log("Retrying without image...");
        providerResponse = modelConfig.provider === "anthropic"
          ? await streamAnthropic(ANTHROPIC_API_KEY!, modelConfig.modelId, systemPrompt, messages, null)
          : await streamGemini(GOOGLE_API_KEY!, modelConfig.geminiModelId || modelConfig.modelId, systemPrompt, messages, null);

        if (!providerResponse.ok) {
          return new Response(JSON.stringify({ error: "Something went wrong. Try again." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        const status = providerResponse.status;
        const error = status === 429 ? "Rate limit reached. Please try again in a moment."
          : status === 401 ? "AI provider authentication failed. Contact support."
          : "Something went wrong. Try again.";
        return new Response(JSON.stringify({ error }),
          { status: status === 429 ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // -- Transform + stream to client --
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const logUsage = async (fullContent: string, tokensInput: number, tokensOutput: number) => {
      const costUsd = (tokensInput * modelConfig.costInput + tokensOutput * modelConfig.costOutput) / 1000;
      const costEur = +(costUsd * 0.92).toFixed(6);

      const metadata = {
        model: modelConfig.modelId,
        display_name: modelConfig.displayName,
        provider: modelConfig.provider,
        cost_eur: costEur,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        image_url: imageUrl,
      };

      await writer.write(encoder.encode(`data: ${JSON.stringify({ metadata })}\n\n`));
      await writer.write(encoder.encode("data: [DONE]\n\n"));

      if (user && conversationId) {
        await supabaseAdmin.from("usage_logs").insert({
          user_id: user.id,
          conversation_id: conversationId,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          cost_eur: costEur,
          model: modelConfig.modelId,
          mode: modeKey,
        });

        await supabaseAdmin.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: fullContent,
          model_used: modelConfig.modelId,
          cost_eur: costEur,
        });
      }

      await writer.close();
    };

    if (modelConfig.provider === "anthropic") {
      // -- Anthropic SSE stream --
      const decoder = new TextDecoder();
      let fullContent = "";
      let inputTokens = 0;
      let outputTokens = 0;

      (async () => {
        const reader = providerResponse.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });

            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              try {
                const event = JSON.parse(jsonStr);
                if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                  const text = event.delta.text || "";
                  fullContent += text;
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
                }
                if (event.type === "message_start" && event.message?.usage) inputTokens = event.message.usage.input_tokens || 0;
                if (event.type === "message_delta" && event.usage) outputTokens = event.usage.output_tokens || 0;
                if (event.type === "message_stop") await logUsage(fullContent, inputTokens, outputTokens);
              } catch { /* skip */ }
            }
          }
        } catch (e) {
          console.error("Anthropic stream error:", e);
          await writer.close();
        }
      })();

    } else {
      // -- Gemini SSE stream --
      const decoder = new TextDecoder();
      let fullContent = "";
      let tokensInput = 0;
      let tokensOutput = 0;

      (async () => {
        const reader = providerResponse.body!.getReader();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, newlineIndex).trim();
              buffer = buffer.slice(newlineIndex + 1);

              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  fullContent += text;
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
                }
                if (parsed.usageMetadata) {
                  tokensInput = parsed.usageMetadata.promptTokenCount || tokensInput;
                  tokensOutput = parsed.usageMetadata.candidatesTokenCount || tokensOutput;
                }
              } catch { /* skip */ }
            }
          }

          if (!tokensInput) tokensInput = Math.ceil(JSON.stringify(messages).length / 4);
          if (!tokensOutput) tokensOutput = Math.ceil(fullContent.length / 4);
          await logUsage(fullContent, tokensInput, tokensOutput);
        } catch (e) {
          console.error("Gemini stream error:", e);
          await writer.close();
        }
      })();
    }

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("chat function error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
