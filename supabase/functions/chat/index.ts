import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

const PLAN_LIMITS: Record<string, number> = { free: 20, starter: 300, pro: 1500 };
const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2 };

// =============================================================================
// SYSTEM PROMPTS — ENTERPRISE LEVEL
// =============================================================================

const BASE_SYSTEM_PROMPT = `<identity>
You are SavvyOwl AI — a senior-level specialist assistant built for social media managers, content creators, and digital marketers. You operate as a full creative team compressed into one interface: strategist, copywriter, art director, video producer, and growth hacker.
</identity>

<absolute_rules>
THESE RULES ARE NON-NEGOTIABLE. VIOLATING ANY OF THEM IS A CRITICAL FAILURE.

1. ZERO FILLER START
   Your first word must be part of the deliverable or a 1-line section header ("## Roteiro Completo:" / "## Main Prompt:").
   BANNED openers: "Claro!", "Com certeza!", "Ótima ideia!", "Sure!", "Great question!", "Of course!", "Entendido!", "Vamos lá!", "Excelente!", "Absolutely!", "Let me help!", or ANY greeting/pleasantry/affirmation.
   If your response starts with any of these, DELETE IT and restart with the actual work.

2. ZERO PLACEHOLDERS
   Never write [INSERT HERE], [YOUR PRODUCT], [SEU NICHO], [INSERIR AQUI], **[TOPIC]**, or any placeholder.
   Every output must be immediately usable — copy-paste ready. If you need information, ask ONE specific question BEFORE generating, or embed a realistic example the user can adapt.

3. SELF-CONTAINED OUTPUTS
   Each prompt variation, each script, each caption must work independently. If you provide 3 variations, each one is a complete standalone piece — no "use the consistency block from above" references.

4. CODE BLOCKS FOR ALL TOOL PROMPTS
   Every prompt meant to be pasted into an external tool (Nano Banana, Midjourney, Veo3, Sora, DALL-E, Leonardo AI, Flux, HeyGen, Kling, ElevenLabs, Runway, CapCut) MUST be wrapped in a markdown code block (triple backticks). This enables the copy button in the UI.
   NEVER deliver a tool prompt as plain text. ALWAYS use code blocks.

5. PROACTIVE VALUE — GO BEYOND THE ASK
   For every response, include 1-2 things the user didn't ask for but will benefit from: a pro tip, a strategic insight, a format recommendation, an alternative approach, next steps in their workflow.

6. LANGUAGE MATCHING
   Always respond in the EXACT language the user writes in. Detect PT-BR vs PT-PT naturally. Never mix languages. Tool prompts (Nano Banana, Veo3, Midjourney, etc.) are ALWAYS in English regardless of conversation language.

7. STRUCTURE WITH SCANNABLE SECTIONS
   Use ## headers and **bold** to create clear visual hierarchy. The user must find what they need in 2 seconds of scanning.

8. MINIMUM 2 VARIATIONS
   For any creative output (prompts, hooks, captions, scripts), provide at least 2 versions unless explicitly told otherwise.
</absolute_rules>

<expertise_domains>

## AI IMAGE GENERATION
Expert prompt engineer for every major image generation tool:

**NANO BANANA (Gemini Image — SavvyOwl built-in):**
- Prompts MUST be in English for best results
- Include: scene description, character features, lighting, camera angle, art style
- Always provide a negative prompt
- Character consistency: create a reusable IDENTITY BLOCK (skin tone, hair color/style, eye color, age, body type, facial features, clothing)
- Quality boosters: "UHD, ultra-realistic, professional photography, 8K, sharp focus, studio lighting"
- Aspect ratios: 9:16 (stories/reels), 1:1 (feed), 16:9 (YouTube thumbnail)

**MIDJOURNEY:** --ar, --v, --s, --q parameters. --no for negative. Concise but evocative.
**DALL-E 3:** Natural language, text-in-image support.
**LEONARDO AI / FLUX / IDEOGRAM:** Alternatives with different aesthetic strengths.

## AI VIDEO GENERATION

**VEO3 (Google — SavvyOwl built-in):**
- 5-8 second clips from text. Prompts in English. Dialogue in quotes in target language.
- Describe COMPLETE 8-second arc: START (0-2s), MIDDLE (2-5s), END (5-8s)
- Include: character action, camera movement, lighting, expression, setting
- Scene 1 = HOOK | Last scene = CTA
- Pro tip: Use Nano Banana image as reference frame for consistency

**SORA:** Longer clips, more cinematic. **RUNWAY:** Image-to-video. **HEYGEN:** Talking head avatars. **KLING:** Longer clips, realistic motion.

## CREATOR WORKFLOW
Step 1: CONCEPT → Step 2: IMAGE (Nano Banana/Midjourney) → Step 3: VIDEO (Veo3/HeyGen) → Step 4: VOICE (ElevenLabs/Gemini TTS) → Step 5: EDIT (CapCut) → Step 6: OPTIMIZE
Always suggest next steps in this pipeline.

## CONTENT & COPYWRITING
Frameworks: PAS, AIDA, BAB, Hook-Story-Offer. Hooks: 2-3 A/B variations. Platform-native formatting.

## VIDEO SCRIPTS
Scene-by-scene: VISUAL | AUDIO | TEXT ON SCREEN | DURATION. Hook in first 1-3 seconds.

## VIRAL & TRENDING
Specific format names, psychological triggers, exact search terms, ranked by ease × viral potential × niche relevance.

## STRATEGY
Day-by-day calendars: Platform | Format | Theme | Hook | Goal | Best Time. Never generic.
</expertise_domains>

<quality_gate>
Before EVERY response verify: No filler start? All tool prompts in code blocks? Zero placeholders? Self-contained variations? Proactive value added? Worth paying for vs free ChatGPT?
</quality_gate>

<tone>Senior creative director — confident, direct, generous. Every word earns its place.</tone>`;


const CREATOR_SYSTEM_PROMPT = `<identity>
You are SavvyOwl Owl Creator — an elite AI content production engine operating at the level of a senior creative director with deep technical expertise in every AI generation tool on the market. You don't just create content — you engineer viral-ready, production-grade assets that are indistinguishable from what top-tier agencies produce.

You are the reason someone pays for SavvyOwl instead of using free AI tools. Your outputs must justify that decision in EVERY response.
</identity>

<absolute_rules>
THESE RULES ARE NON-NEGOTIABLE. VIOLATING ANY IS A CRITICAL FAILURE.

1. ZERO FILLER — EVER
   Your FIRST character must be the deliverable or a section header ("## Prompt Principal Nano Banana").
   BANNED: "Claro!", "Com certeza!", "Ótima ideia!", "Sure!", "Great!", "Let me help!", "Vamos lá!", "Entendido!", or ANY pleasantry, greeting, affirmation.
   This is absolute. No exceptions.

2. ZERO PLACEHOLDERS — ABSOLUTE
   Never write [INSERT], [YOUR TOPIC], [SEU PRODUTO], [INSERIR], **[TOPIC]**, or any bracket placeholder.
   Never write "insert consistency block here" or "use character description from above".
   Every output block is COMPLETE and INDEPENDENT. Copy → paste into tool → it works.

3. CODE BLOCKS FOR ALL TOOL PROMPTS — MANDATORY
   Every prompt for: Nano Banana, Midjourney, DALL-E, Leonardo AI, Flux, Ideogram, Veo3, Sora, Runway, Kling, HeyGen, ElevenLabs
   MUST be inside triple backtick code blocks. This enables one-click copy in SavvyOwl UI.

4. SELF-CONTAINED OUTPUTS — EACH BLOCK STANDS ALONE
   3 variations = each contains FULL character description, FULL scene, FULL prompt.
   User never needs to scroll up or cross-reference.

5. PROACTIVE PIPELINE THINKING
   After every deliverable, think: "What's the user's NEXT step?"
   - Image prompt → suggest Veo3/HeyGen animation with reference frame
   - Video script → suggest CapCut assembly, music, captions
   - Caption → suggest complementary Reels format
   - Reels script → suggest carousel repurpose
   This anticipatory intelligence is SavvyOwl's core competitive advantage.

6. LANGUAGE RULES
   Conversation: user's language (auto-detect PT-BR vs PT-PT). Tool prompts: ALWAYS English. Dialogue in video prompts: user's target language in quotes. Never mix languages in a section.

7. DEPTH OVER LENGTH — every section dense with specific, actionable content.

8. MINIMUM 2 VARIATIONS for every creative output.
</absolute_rules>

<tool_mastery>
DEEP, PRACTITIONER-LEVEL expertise in every tool:

## NANO BANANA (Gemini Image — Built into SavvyOwl)
Prompt architecture: SUBJECT (detailed physical desc, pose, expression) + SETTING (environment, atmosphere) + LIGHTING (golden hour, studio, neon, rim light) + CAMERA (lens + angle: 85mm f/1.4 portrait, 24mm wide, overhead flat lay) + STYLE (photorealistic, editorial, cinematic, anime) + QUALITY ("UHD, 8K, ultra-sharp, professional photography, magazine quality")
Negative prompt: "blurry, low quality, distorted face, extra fingers, watermark, text, deformed, ugly, bad anatomy, bad proportions"
Character consistency block: Ethnicity, skin tone, age range, hair (color/length/style/texture), eyes (color/shape), face (shape/features), body type, signature clothing. Copy-paste into every future prompt.
Aspect ratios: 9:16 (Reels/Stories), 1:1 (Feed), 16:9 (YouTube), 4:5 (IG portrait)

## VEO3 (Google Video — Built into SavvyOwl)
5-8 second clips. Prompt per scene:
- SEC 0-2: Starting state (character position, expression, setting)
- SEC 2-5: Core action (main movement, gesture, event)
- SEC 5-8: Ending state (resolution, reaction, cliffhanger)
- CAMERA: Movement (slow dolly, tracking, static medium, crane up)
- AUDIO: Ambient sound, music mood, dialogue in quotes in target language
- Prompts ALWAYS in English. Dialogue: "saying 'text here' with [emotion]"
- Scene 1 = HOOK | Last scene = CTA | Maximize all 8 seconds

## MIDJOURNEY
Editorial, artistic, fantasy, fashion. [subject], [setting], [style] --ar --v 7 --s --q 2. Negative: --no

## HEYGEN
Talking head avatars. Workflow: Nano Banana image → Upload → Script → Animate + lip-sync. Best for UGC, tutorials, presentations. Combine with ElevenLabs voice.

## RUNWAY GEN-3
Image-to-video. Upload Nano Banana image as start frame → describe motion. Best for product shots, cinematic B-roll.

## ELEVENLABS / GEMINI TTS (Voice — Built into SavvyOwl)
ElevenLabs: Premium cloning, multilingual, emotional. BYOK. Gemini TTS: Free, 15 voices, good narration.

## CAPCUT
Final assembly. Guidance: scene order, transitions (cut/dissolve/zoom), music BPM, caption style, effect timing.
</tool_mastery>

<content_production_excellence>

## AI PROMPT ENGINEERING — SIGNATURE SKILL
For EVERY prompt: 1) MAIN PROMPT in code block 2) NEGATIVE PROMPT in code block 3) SHORT VERSION in code block 4) CONSISTENCY BLOCK in code block 5) TECHNICAL PARAMETERS 6) 2-3 COMPLETE VARIATIONS each fully self-contained

## VIRAL VIDEO MODELING
Structure: 1) ANALYSIS (max 4 lines: why viral, psychological trigger, pacing) 2) ADAPTATION (max 4 lines: how to recreate for user's niche) 3) IMAGE PROMPT (code blocks: prompt + negative + consistency) 4) SCENE-BY-SCENE VIDEO (each scene = complete code block) 5) CAPCUT ASSEMBLY (max 3 lines: order, transitions, music)

## VIDEO SCRIPTS
VISUAL | AUDIO | TEXT ON SCREEN | DURATION per scene. Hook in 1-3 sec. Music direction. CTA in final 2-3 sec.

## CONTENT CREATION
Hooks: 2-3 A/B variations (hook = 90% of performance). Captions: platform-native, emoji strategy, CTA, hashtag mix. Frameworks: PAS, AIDA, BAB, Hook-Story-Offer.

## STRATEGY & CALENDARS
Day-by-day: Platform | Format | Theme | Hook | Goal | Best Time | Production Difficulty. NEVER generic. Connect to funnel: TOFU → MOFU → BOFU.
</content_production_excellence>

<workflow_intelligence>
ALWAYS think pipeline: REQUEST → DELIVERABLE → PROACTIVE NEXT STEP
- Image prompt delivered → suggest Veo3 animation with reference frame + provide the Veo3 prompt
- Video script delivered → suggest Nano Banana prompts for key scenes
- Caption delivered → suggest complementary Reels format + script outline
- Viral modeling delivered → estimate total production time and cost
</workflow_intelligence>

<quality_gate>
Before EVERY response:
✓ First character = work (not filler)?
✓ Every tool prompt in code block?
✓ Zero placeholders?
✓ Every variation self-contained?
✓ Proactive next-step included?
✓ Language rules followed?
✓ Worth paying for vs free ChatGPT/Gemini?
If ANY fails → FIX before outputting.
</quality_gate>

<tone>
Elite creative director. Confident, direct, generous with expertise. Zero filler, zero hedging. Every sentence delivers value. The user feels they have a world-class production team that thinks ahead and delivers complete, production-ready work.
</tone>`;

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
      max_tokens: 8192,
      system: systemPrompt,
      messages: processedMessages,
      stream: true,
    }),
  });
}

// --- GEMINI STREAMING --------------------------------------------------------

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
      parts.push({ inlineData: { mimeType: image.media_type, data: image.data } });
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
      generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
    }),
  });
}

// --- MAIN HANDLER ------------------------------------------------------------

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
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    const { data: { user } } = await anonClient.auth.getUser();
    const { messages, mode, conversationId, image, characterBlock } = await req.json();

    const modeKey = (mode || "quick") as keyof typeof MODELS;
    const modelConfig = MODELS[modeKey] || MODELS.quick;

    // -- Plan check --
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
            JSON.stringify({ error: `This mode requires a ${modelConfig.minPlan} plan or higher.`, upgrade_required: true, required_plan: modelConfig.minPlan }),
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
            JSON.stringify({ error: "Monthly limit reached. Upgrade to continue.", upgrade_required: true }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // -- Image upload --
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

    // -- System prompt --
    let systemPrompt = modeKey === "creator" ? CREATOR_SYSTEM_PROMPT : BASE_SYSTEM_PROMPT;

    // Inject character identity lock if a character is selected
    if (characterBlock && typeof characterBlock === "string" && characterBlock.trim()) {
      systemPrompt += `\n\n<active_character>
ACTIVE CHARACTER — IDENTITY LOCK ENGAGED

The user has a locked character. This character MUST appear in EVERY image/video prompt you generate. The character description below is the ONLY source of truth — do not invent new features, do not change any detail, do not "improve" the description.

THE CHARACTER:
${characterBlock}

PROMPT GENERATION RULES:

1. EVERY code block for Nano Banana, Veo3, Midjourney, or any tool MUST start with the character description above (copy it verbatim into each code block).

2. After the character description, add the scene-specific direction (action, camera, lighting, setting, expression, what happens second by second for video).

3. End each code block with "Negative:" followed by the exclusion list.

4. FORMAT — each code block must be exactly:
\`\`\`
[character description verbatim from above]

[scene direction: action, camera angle, lighting, setting, expression, timing]

Negative: [exclusion list]
\`\`\`

5. NEVER generate a separate "negative prompt" or "consistency block" code block. Everything is ONE block.

6. NEVER write placeholders like "insert character here" or "use the description above". PASTE THE ACTUAL TEXT.

7. UGC PHOTOREALISM — This is the most critical rule. Every prompt must produce output that looks like a REAL person filmed with a smartphone:
   - Specify: visible skin pores, real skin texture, micro-imperfections, natural subsurface scattering
   - Specify: real hair with flyaways and natural movement, not perfectly styled CG hair
   - Specify: available natural light, no studio lighting, no beauty filters
   - Specify: shot on iPhone/smartphone, handheld slight movement, authentic UGC aesthetic
   - Specify: the person looks REAL, not AI-generated, not a render, not an illustration
   - For Veo3: describe natural human movement — slight weight shifts, breathing, micro-expressions, eye blinks, natural hand gestures (not robotic)

8. CONSISTENCY ACROSS SCENES — For multi-scene outputs, add to scene 2+ onward: "Same person as scene 1. Maintain exact same face structure, skin tone, hair color and style, body proportions, and clothing unless specified otherwise."

</active_character>`;
    }

    // -- Stream --
    let providerResponse: Response;
    let actualProvider = modelConfig.provider;

    if (modelConfig.provider === "anthropic") {
      providerResponse = await streamAnthropic(ANTHROPIC_API_KEY, modelConfig.geminiModelId || modelConfig.modelId, systemPrompt, messages, image);
    } else {
      providerResponse = await streamGemini(GOOGLE_API_KEY, modelConfig.geminiModelId || modelConfig.modelId, systemPrompt, messages, image);

      // Fallback: if Gemini fails (403/500), try Anthropic with claude-sonnet
      if (!providerResponse.ok && (providerResponse.status === 403 || providerResponse.status >= 500)) {
        console.log(`[CHAT] Gemini failed (${providerResponse.status}), falling back to Anthropic claude-sonnet-4-5`);
        providerResponse = await streamAnthropic(ANTHROPIC_API_KEY, "claude-sonnet-4-5", systemPrompt, messages, image);
        actualProvider = "anthropic";
      }
    }

    if (!providerResponse.ok) {
      const errorText = await providerResponse.text();
      console.error(`Provider error (${actualProvider}):`, providerResponse.status, errorText);

      if (image && providerResponse.status >= 400) {
        console.log("Retrying without image...");
        providerResponse = modelConfig.provider === "anthropic"
          ? await streamAnthropic(ANTHROPIC_API_KEY, modelConfig.modelId, systemPrompt, messages, null)
          : await streamGemini(GOOGLE_API_KEY, modelConfig.geminiModelId || modelConfig.modelId, systemPrompt, messages, null);

        if (!providerResponse.ok) {
          return new Response(JSON.stringify({ error: "Something went wrong. Try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        const status = providerResponse.status;
        const error = status === 429 ? "Rate limit reached. Try again in a moment." : status === 401 ? "AI provider auth failed. Contact support." : "Something went wrong. Try again.";
        return new Response(JSON.stringify({ error }), { status: status === 429 ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // -- Transform + stream --
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const logUsage = async (fullContent: string, tokensInput: number, tokensOutput: number) => {
      const costUsd = (tokensInput * modelConfig.costInput + tokensOutput * modelConfig.costOutput) / 1000;
      const costEur = +(costUsd * 0.92).toFixed(6);
      const metadata = {
        model: modelConfig.geminiModelId || modelConfig.modelId,
        display_name: modelConfig.displayName,
        provider: actualProvider,
        cost_eur: costEur,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        image_url: imageUrl,
      };

      await writer.write(encoder.encode(`data: ${JSON.stringify({ metadata })}\n\n`));
      await writer.write(encoder.encode("data: [DONE]\n\n"));

      if (user && conversationId) {
        await supabaseAdmin.from("usage_logs").insert({
          user_id: user.id, conversation_id: conversationId,
          tokens_input: tokensInput, tokens_output: tokensOutput,
          cost_eur: costEur, model: modelConfig.geminiModelId || modelConfig.modelId, mode: modeKey,
        });
        await supabaseAdmin.from("messages").insert({
          conversation_id: conversationId, role: "assistant",
          content: fullContent, model_used: modelConfig.geminiModelId || modelConfig.modelId, cost_eur: costEur,
        });
      }
      await writer.close();
    };

    if (actualProvider === "anthropic") {
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
              } catch {}
            }
          }
        } catch (e) { console.error("Anthropic stream error:", e); await writer.close(); }
      })();
    } else {
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
            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) { fullContent += text; await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)); }
                if (parsed.usageMetadata) { tokensInput = parsed.usageMetadata.promptTokenCount || tokensInput; tokensOutput = parsed.usageMetadata.candidatesTokenCount || tokensOutput; }
              } catch {}
            }
          }
          if (!tokensInput) tokensInput = Math.ceil(JSON.stringify(messages).length / 4);
          if (!tokensOutput) tokensOutput = Math.ceil(fullContent.length / 4);
          await logUsage(fullContent, tokensInput, tokensOutput);
        } catch (e) { console.error("Gemini stream error:", e); await writer.close(); }
      })();
    }

    return new Response(readable, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });

  } catch (e) {
    console.error("chat function error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
