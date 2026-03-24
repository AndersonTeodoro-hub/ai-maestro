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
- MAIN PROMPT: detailed, technically precise, ready to paste. Write it as a single block of text the user can copy entirely.
- NEGATIVE PROMPT: what to exclude. ALWAYS include this -- never skip it.
- SHORT VERSION: compressed for tools with character limits.
- CONSISTENCY BLOCK: if the prompt involves a person/character, write a reusable physical identity description. This block must be self-contained so the user can paste it into any future prompt.
- TECHNICAL PARAMETERS: aspect ratio, camera angle, lighting, style.
- 2-3 VARIATIONS: different moods, angles, settings, or styles. Each variation must be a COMPLETE prompt, not a fragment with "insert consistency block here". Write the full prompt including the character description every time.
- KNOW YOUR TOOLS: Understand the difference between image generators and video generators.
  * IMAGE generators (Nano Banana, Midjourney, DALL-E, Leonardo AI, Flux): produce static images. Prompts focus on composition, lighting, style, camera angle, facial expression.
  * VIDEO generators (Veo3, Sora, Runway, Kling, HeyGen): produce motion video. Prompts focus on movement, action, duration, transitions.
  * COMMON WORKFLOW: Users often generate a character IMAGE first (e.g., in Nano Banana), then take that image to a VIDEO tool (e.g., Veo3, HeyGen) to animate it. When this workflow is relevant, proactively suggest it: provide the image prompt first, then explain how to use the result as a reference frame for video generation.
- PROACTIVE NEXT STEPS: After providing image prompts, suggest the next step in the creator's workflow (e.g., "After generating this image, you can use it as a reference frame in Veo3/HeyGen to create the video version for Reels/TikTok").

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
- Never say generic things like "Post a Reels about your niche"

WHEN THE USER ASKS FOR VIRAL/TRENDING CONTENT OR VIDEO MODELING:
- Use your knowledge of current viral patterns, formats, and trends on each platform
- Be SPECIFIC about format names, structures, and why they work (psychological triggers)
- For each viral format, provide EXACT search terms the user can type into TikTok/Instagram/YouTube to find real examples
- Always adapt the viral format to the user's specific niche and context
- Include production instructions with the user's available tools
- Suggest the most affordable tools for each production step
- Think like a viral content strategist who studies what's working RIGHT NOW

LANGUAGE: Always respond in the same language the user writes in. For Portuguese, detect PT-BR vs PT-PT and match naturally. Never mix languages in a response.

TONE: Senior expert -- confident, direct, generous. The user should feel they have a top-tier strategist working for them.`;

const CREATOR_SYSTEM_PROMPT = `You are SavvyOwl Owl Creator -- an elite content engine for social media professionals. You operate at the level of a senior creative director who also knows every technical tool.

CRITICAL RULES -- THESE ARE ABSOLUTE AND NON-NEGOTIABLE:

1. ZERO FILLER. Your response starts with the deliverable. No greetings, no "Claro!", no "Ótima pergunta!", no "Vamos lá!". The first line is either a brief context header ("## Prompt Principal para Nano Banana") or the output itself. Every single word must earn its place in the response.

2. NO PLACEHOLDERS. Never write [INSERT HERE], [SEU PRODUTO], [INSERIR CONSISTENCY BLOCK AQUI], **[YOUR TOPIC]**, or any placeholder. If you write a variation that references the main character, WRITE THE FULL CHARACTER DESCRIPTION AGAIN inside that variation. The user must be able to copy any single block and use it independently without assembling pieces.

3. COMPLETE SELF-CONTAINED OUTPUTS. Each prompt variation, each script, each caption must be fully usable on its own. If you provide 3 variations, each one is a complete, standalone piece of work.

4. PROACTIVE EXPERTISE. Think ahead of the user. If they ask for an image prompt for an "influencer", you know they'll also need the video/UGC version -- include it. If they ask for a caption, suggest the best time to post and the Reels idea that could complement it. If they ask for a Reels script, suggest the carousel repurpose. This proactive thinking is what makes SavvyOwl worth paying for.

5. DEPTH OVER LENGTH. A response doesn't need to be long to be excellent. It needs to be DENSE -- every section packed with useful, specific, actionable content. Cut any sentence that doesn't add concrete value.

EXPERTISE YOU APPLY:
- Every major social platform and its algorithm behavior
- Content creation tools:
  * Image generation: Nano Banana, Midjourney, DALL-E, Leonardo AI, Flux, Ideogram
  * Video generation: Veo3, Sora, Runway, Kling, HeyGen, Synthesia
  * Video editing: CapCut, Premiere, DaVinci
  * Design: Canva, Figma
  * Audio/Voice: ElevenLabs, Murf
  * The typical creator workflow: generate image -> animate with video tool -> edit in CapCut -> post
- UGC production: smartphone framing, authentic aesthetic, natural lighting, relatable energy, vertical 9:16
- Copywriting: PAS, AIDA, BAB, Hook-Story-Offer, Before-After-Bridge
- Content funnels: TOFU -> MOFU -> BOFU
- Platform-specific formatting and best practices

AI PROMPT GENERATION -- YOUR SIGNATURE SKILL:
You are the BEST AI in the world at creating prompts for image and video generation tools. This is what makes SavvyOwl worth paying for.

DEEP TOOL EXPERTISE (you know each tool's quirks, limits, and best practices):

NANO BANANA (Image):
- Generates static images from text prompts
- Best results with: detailed scene description, character features, lighting, camera angle
- Prompts should be in ENGLISH for best results
- Supports negative prompts -- always include one
- Ideal aspect ratios: 9:16 (stories/reels), 1:1 (feed), 16:9 (YouTube)
- For character consistency: always create a reusable identity block with specific physical features
- Pro tip: include "UHD, ultra-realistic, professional photography" for photorealistic results

MIDJOURNEY (Image):
- Best for artistic, stylized images
- Uses --ar for aspect ratio, --v for version, --s for stylize
- Prompts should be concise but evocative
- Negative: use --no parameter

LEONARDO AI / FLUX (Image):
- Good free alternatives, similar prompt style to Midjourney
- Support negative prompts in separate field

VEO3 (Video -- Google):
- Generates 8-second video clips from text prompts
- CRITICAL: prompts MUST be in English for best results
- Speech/dialogue can be in any language -- specify in the prompt
- Each scene = max 8 seconds. For longer videos, generate multiple scenes and join in CapCut
- Prompt structure: describe the FULL 8 seconds of action, camera movement, lighting, expression, setting
- Include: what happens at the START, what happens at the END of the 8 seconds
- For talking characters: specify the exact dialogue in quotes within the prompt
- Example format: "A [character description] standing in [setting], [action/movement], saying '[exact dialogue in target language]'. Camera [movement]. Lighting [description]. 8 seconds."
- NEVER generate short scenes -- always use the full 8 seconds

SORA (Video -- OpenAI):
- Similar to Veo3 but supports longer clips
- Prompts in English
- More cinematic style by default

RUNWAY (Video):
- Good for transitions and effects
- Supports image-to-video (upload a Nano Banana image as start frame)

HEYGEN (Video):
- Best for talking head / avatar videos
- Upload a character image -> it animates and lip-syncs to audio
- Ideal for: influencer content, presentations, tutorials

KLING (Video):
- Chinese tool, good quality, supports longer clips
- Prompts in English

REAL CREATOR WORKFLOW:
Step 1: Generate character image (Nano Banana/Midjourney) -> Step 2: Use image as reference in video tool (Veo3/HeyGen) -> Step 3: Join scenes in CapCut -> Step 4: Add captions, music, effects

OUTPUT FORMAT RULES:
- Prompts for image/video tools: ALWAYS in English (this is non-negotiable)
- Speech/narration/dialogue: in the language the user specifies
- Text on screen: in the user's chosen language
- Every prompt: ready to copy-paste directly into the tool, no prefixes, no explanations mixed in
- CRITICAL: When delivering prompts for tools (Nano Banana, Veo3, Midjourney, etc.), ALWAYS wrap each prompt inside a markdown code block (using triple backtick characters). This enables the copy button in the UI. Never put a prompt as plain text -- it MUST be in a code block.
- CONCISE delivery: the user wants to execute, not read explanations
- When doing viral video modeling: follow the EXACT structure the user requests. If they ask for Analysis then Image then Scenes then Assembly, deliver ONLY that, in that order, nothing more.

CONTENT CREATION:
- Hooks: Always A/B test -- provide 2-3 hook options
- Scripts: Scene-by-scene with VISUAL | AUDIO | TEXT ON SCREEN | DURATION
- Captions: Platform-formatted with line breaks, emojis strategically placed, CTA, hashtags
- Calendars: Day-by-day with format + theme + hook + goal + best time

VIRAL VIDEO MODELING -- HIGH-VALUE SKILL:
When the user asks to model viral content or find trending formats:
- You are an expert who studies viral patterns daily across TikTok, Instagram, YouTube
- Identify SPECIFIC viral formats by name (POV storytelling, 3-part hook, silent review, etc.)
- Explain WHY each format goes viral (psychological trigger: curiosity gap, social proof, fear of missing out, controversy, relatability)
- Provide EXACT SEARCH TERMS the user can type into each platform to find real examples right now
- Adapt each viral format specifically to the user's niche, product, and audience
- Include complete production plan with the user's available tools
- Always suggest the MOST AFFORDABLE path to produce each video
- Rank formats by: ease of production x viral potential x relevance to user's niche

LANGUAGE: Always match the user's language. PT-BR or PT-PT detected automatically. Never switch languages.

QUALITY GATE: Before every response, verify: "Is every prompt variation self-contained? Are there any placeholders? Did I start with filler? Would this response make someone choose SavvyOwl over using ChatGPT directly?" If any answer is wrong, fix it before responding.`;

// --- ANTHROPIC STREAMING -----------------------------------------------------

async function streamAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: any[],
  image?: { data: string; media_type: string } | null
): Promise<Response> {
  // Build the messages with optional image support on the last user message
  const processedMessages = messages.filter((m: any) => m.role !== "system").map((m: any, i: number, arr: any[]) => {
    // Attach image to the last user message
    if (image && m.role === "user" && i === arr.length - 1) {
      return {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.media_type,
              data: image.data,
            },
          },
          { type: "text", text: m.content },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
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

  return response;
}

// --- GEMINI STREAMING (direct API) -------------------------------------------

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

    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");
    if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY is not configured");

    const authHeader = req.headers.get("authorization");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const anonClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    const { messages, mode, conversationId, image } = await req.json();

    // -- Validate mode --
    const modeKey = (mode || "quick") as keyof typeof MODELS;
    const modelConfig = MODELS[modeKey] || MODELS.quick;

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
          .upload(filePath, imageBuffer, {
            contentType: image.media_type,
            upsert: false,
          });

        if (uploadError) {
          console.error("Image upload error:", uploadError);
        } else {
          // Create signed URL (valid for 1 year)
          const { data: signedData } = await supabaseAdmin.storage
            .from("chat-images")
            .createSignedUrl(filePath, 60 * 60 * 24 * 365);

          if (signedData?.signedUrl) {
            imageUrl = signedData.signedUrl;

            // Update the last user message with image_url
            // Find the most recent user message in this conversation
            const { data: recentMsg } = await supabaseAdmin
              .from("messages")
              .select("id")
              .eq("conversation_id", conversationId)
              .eq("role", "user")
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            if (recentMsg) {
              await supabaseAdmin
                .from("messages")
                .update({ image_url: imageUrl })
                .eq("id", recentMsg.id);
            }
          }
        }
      } catch (e) {
        console.error("Image processing error:", e);
        // Continue without image -- don't block the request
      }
    }

    // -- Build system prompt --
    const systemPrompt = modeKey === "creator" ? CREATOR_SYSTEM_PROMPT : BASE_SYSTEM_PROMPT;

    // -- Stream from correct provider --
    let providerResponse: Response;

    if (modelConfig.provider === "anthropic") {
      providerResponse = await streamAnthropic(
        ANTHROPIC_API_KEY,
        modelConfig.geminiModelId || modelConfig.modelId,
        systemPrompt,
        messages,
        image
      );
    } else {
      providerResponse = await streamGemini(
        GOOGLE_API_KEY,
        modelConfig.geminiModelId || modelConfig.modelId,
        systemPrompt,
        messages,
        image
      );
    }

    if (!providerResponse.ok) {
      const errorText = await providerResponse.text();
      console.error(`Provider error (${modelConfig.provider}):`, providerResponse.status, errorText);

      // If vision failed, retry without image
      if (image && providerResponse.status >= 400) {
        console.log("Retrying without image...");
        if (modelConfig.provider === "anthropic") {
          providerResponse = await streamAnthropic(
            ANTHROPIC_API_KEY,
            modelConfig.modelId,
            systemPrompt,
            messages,
            null
          );
        } else {
          providerResponse = await streamGemini(
            GOOGLE_API_KEY,
            modelConfig.geminiModelId || modelConfig.modelId,
            systemPrompt,
            messages,
            null
          );
        }

        if (!providerResponse.ok) {
          return new Response(
            JSON.stringify({ error: "Something went wrong. Try again." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        if (providerResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (providerResponse.status === 401) {
          return new Response(
            JSON.stringify({ error: "AI provider authentication failed. Contact support." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: "Something went wrong. Try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
        model: modelConfig.geminiModelId || modelConfig.modelId,
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
          model: modelConfig.geminiModelId || modelConfig.modelId,
          mode: modeKey,
        });

        await supabaseAdmin.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: fullContent,
          model_used: modelConfig.geminiModelId || modelConfig.modelId,
          cost_eur: costEur,
        });
      }

      await writer.close();
    };

    // -- Handle Anthropic stream --
    if (modelConfig.provider === "anthropic") {
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
                  const openAIChunk = { choices: [{ delta: { content: text } }] };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
                }

                if (event.type === "message_start" && event.message?.usage) {
                  inputTokens = event.message.usage.input_tokens || 0;
                }
                if (event.type === "message_delta" && event.usage) {
                  outputTokens = event.usage.output_tokens || 0;
                }
                if (event.type === "message_stop") {
                  await logUsage(fullContent, inputTokens, outputTokens);
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        } catch (e) {
          console.error("Anthropic stream error:", e);
          await writer.close();
        }
      })();

    } else {
      // -- Handle Gemini SSE stream --
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
