import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fallback model map (used when optimization fails)
const MODEL_MAP: Record<string, string> = {
  quick: "google/gemini-3-flash-preview",
  deep: "google/gemini-2.5-pro",
  creator: "google/gemini-3-flash-preview",
};

const PLAN_LIMITS: Record<string, number> = {
  free: 20,
  starter: 300,
  pro: 1500,
};

const CREATOR_SYSTEM_PROMPT = `You are ContentCreator AI, an expert assistant for content creators, influencers, and social media managers. You specialize in writing captions, scripts, hooks, email copy, and content strategies. Always write in an engaging, human tone. Ask for the platform and audience if not specified. Output in clean, ready-to-use format.`;

const CLASSIFIER_SYSTEM_PROMPT = `Tu és um classificador de tarefas de IA. Analisa o pedido do utilizador e responde APENAS com um JSON válido, sem markdown, sem explicações.

Classifica:
- task_type: "simple" | "creative" | "analysis" | "code" | "translation" | "complex"
- complexity: "low" | "medium" | "high"
- estimated_output_tokens: número estimado de tokens da resposta (100-4000)
- recommended_model: "gemini-flash" (para tarefas simples, traduções, resumos, perguntas directas) ou "gemini-pro" (para análise profunda, escrita criativa longa, código complexo, raciocínio multi-passo)
- reasoning: uma frase curta explicando a escolha

Regra principal: usa SEMPRE o modelo mais barato que consegue fazer a tarefa bem. gemini-flash é suficiente para 70% dos pedidos.`;

const OPTIMIZER_SYSTEM_PROMPT = `Tu és um optimizador de prompts. O teu trabalho é reescrever o pedido do utilizador para obter melhor resultado com menos tokens.

Regras:
1. Mantém a intenção original EXACTA do utilizador
2. Adiciona formato de resposta esperado (ex: 'Responde em bullet points', 'Limita a 200 palavras')
3. Adiciona contexto relevante se estiver em falta
4. Remove ambiguidade
5. Se o pedido já é claro e específico, melhora apenas ligeiramente ou devolve como está
6. NUNCA mudes o idioma do utilizador
7. O prompt optimizado deve ser mais curto ou igual em tokens, NUNCA mais longo que o dobro do original

Responde APENAS com o prompt optimizado, nada mais.`;

const OPTIMIZATION_MODEL = "google/gemini-3-flash-preview";
const OPTIMIZATION_TIMEOUT_MS = 10_000;

// Fallback cost rates per 1k tokens (EUR)
const FALLBACK_COSTS: Record<string, { input: number; output: number }> = {
  "google/gemini-3-flash-preview": { input: 0.0001, output: 0.0004 },
  "google/gemini-2.5-pro": { input: 0.007, output: 0.021 },
  "google/gemini-2.5-flash": { input: 0.0001, output: 0.0004 },
};

/** Non-streaming AI call with timeout */
async function callAI(apiKey: string, systemPrompt: string, userContent: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPTIMIZATION_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`AI call failed: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timer);
  }
}

interface OptimizationResult {
  optimizedPrompt: string;
  classification: {
    task_type: string;
    complexity: string;
    estimated_output_tokens: number;
    recommended_model: string;
    reasoning: string;
  };
  savingsEur: number;
}

/** Classify and optimize prompt. Returns null on any failure. */
async function classifyAndOptimize(
  apiKey: string,
  userMessage: string,
  conversationContext: { role: string; content: string }[],
  userPlan: string
): Promise<OptimizationResult | null> {
  // Build context for classifier
  let classifierInput = userMessage;
  if (conversationContext.length > 0) {
    const ctx = conversationContext
      .slice(-3)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    classifierInput = `Contexto da conversa:\n${ctx}\n\nPedido actual:\n${userMessage}`;
  }

  // Step 1: Classification
  const classificationRaw = await callAI(apiKey, CLASSIFIER_SYSTEM_PROMPT, classifierInput, OPTIMIZATION_TIMEOUT_MS);
  let classification;
  try {
    classification = JSON.parse(classificationRaw.trim());
  } catch {
    classification = {
      task_type: "simple",
      complexity: "low",
      estimated_output_tokens: 500,
      recommended_model: "gemini-flash",
      reasoning: "Classification parse failed, defaulting to flash",
    };
  }

  // Force flash for free plan
  if (userPlan === "free") {
    classification.recommended_model = "gemini-flash";
  }

  // Step 2: Prompt optimization
  const optimizedPrompt = await callAI(apiKey, OPTIMIZER_SYSTEM_PROMPT, userMessage, OPTIMIZATION_TIMEOUT_MS);

  // Calculate savings estimate
  const inputTokensOriginal = Math.ceil(userMessage.length / 4);
  const inputTokensOptimized = Math.ceil(optimizedPrompt.length / 4);
  const outputTokens = classification.estimated_output_tokens || 500;

  const proCostInput = 0.007;
  const proCostOutput = 0.021;
  const costWithoutOpt = (inputTokensOriginal * proCostInput + outputTokens * proCostOutput) / 1000;

  const isFlash = classification.recommended_model === "gemini-flash";
  const costInput = isFlash ? 0.0001 : proCostInput;
  const costOutput = isFlash ? 0.0004 : proCostOutput;
  const costWithOpt = (inputTokensOptimized * costInput + outputTokens * costOutput) / 1000;

  const savingsEur = +(Math.max(0, costWithoutOpt - costWithOpt) * 0.92).toFixed(6);

  return {
    optimizedPrompt: optimizedPrompt.trim() || userMessage,
    classification,
    savingsEur,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const anonClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    const { messages, mode, conversationId } = await req.json();

    let userPlan = "free";

    // Check plan limits if user is authenticated
    if (user) {
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("plan, monthly_budget_eur")
        .eq("id", user.id)
        .single();

      if (profile) {
        userPlan = profile.plan || "free";

        // Check monthly request limit
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count } = await supabaseClient
          .from("usage_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", startOfMonth.toISOString());

        const limit = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free;
        if ((count || 0) >= limit) {
          return new Response(
            JSON.stringify({ error: "You've reached your monthly limit. Upgrade to continue." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Extract last user message for optimization
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const lastUserContent = lastUserMsg?.content || "";

    // Build conversation context (excluding the last user message)
    const contextMessages = messages.slice(0, -1).slice(-3);

    // Try optimization engine (with full fallback)
    let optimizationResult: OptimizationResult | null = null;
    let resolvedModel: string;
    let finalMessages = [...messages];

    try {
      optimizationResult = await classifyAndOptimize(
        LOVABLE_API_KEY,
        lastUserContent,
        contextMessages,
        userPlan
      );
    } catch (e) {
      console.error("Optimization engine failed, using fallback:", e);
    }

    if (optimizationResult) {
      // Resolve model from registry
      const modelKey = optimizationResult.classification.recommended_model;
      const modelFilter = modelKey === "gemini-flash" ? "%flash%" : "%pro%";

      const { data: registryRow } = await supabaseClient
        .from("model_registry")
        .select("gateway_model_string, cost_per_1k_input, cost_per_1k_output")
        .ilike("model_id", modelFilter)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (registryRow?.gateway_model_string) {
        resolvedModel = registryRow.gateway_model_string;
      } else {
        // Fallback: map recommendation to known model
        resolvedModel = modelKey === "gemini-flash"
          ? "google/gemini-3-flash-preview"
          : "google/gemini-2.5-pro";
      }

      // Replace last user message with optimized prompt
      const lastIdx = finalMessages.length - 1;
      if (finalMessages[lastIdx]?.role === "user") {
        finalMessages[lastIdx] = { ...finalMessages[lastIdx], content: optimizationResult.optimizedPrompt };
      }
    } else {
      // Fallback to mode-based routing
      resolvedModel = MODEL_MAP[mode] || MODEL_MAP.quick;
    }

    // Build system prompt
    const systemPrompt = mode === "creator"
      ? CREATOR_SYSTEM_PROMPT
      : "You are PromptOS AI, a helpful and concise assistant. Keep answers clear, actionable, and well-formatted.";

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...finalMessages,
    ];

    // Call AI Gateway with resolved model
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Something went wrong. Try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream processing
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    (async () => {
      let fullContent = "";
      let usageData: any = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) fullContent += content;
                if (parsed.usage) usageData = parsed.usage;
              } catch {}
            }
          }

          await writer.write(value);
        }

        // Calculate costs
        const tokensInput = usageData?.prompt_tokens || Math.ceil(JSON.stringify(messages).length / 4);
        const tokensOutput = usageData?.completion_tokens || Math.ceil(fullContent.length / 4);

        const costs = FALLBACK_COSTS[resolvedModel] || FALLBACK_COSTS["google/gemini-3-flash-preview"];
        const costUsd = (tokensInput * costs.input + tokensOutput * costs.output) / 1000;
        const costEur = costUsd * 0.92;

        // Send metadata
        const metadata: any = {
          model: resolvedModel,
          cost_eur: +costEur.toFixed(6),
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
        };

        if (optimizationResult) {
          metadata.optimization = {
            task_type: optimizationResult.classification.task_type,
            complexity: optimizationResult.classification.complexity,
            model_recommended: optimizationResult.classification.recommended_model,
            savings_eur: optimizationResult.savingsEur,
            optimized: true,
          };
        }

        await writer.write(encoder.encode(`data: ${JSON.stringify({ metadata })}\n\n`));
        await writer.write(encoder.encode("data: [DONE]\n\n"));

        // Log usage and save optimization data
        if (user && conversationId) {
          await supabaseClient.from("usage_logs").insert({
            user_id: user.id,
            conversation_id: conversationId,
            tokens_input: tokensInput,
            tokens_output: tokensOutput,
            cost_eur: +costEur.toFixed(6),
            model: resolvedModel,
            mode: mode || "quick",
          });

          // Update the user's message with optimization metadata
          if (optimizationResult) {
            // Find the last user message in this conversation and update it
            const { data: lastMsg } = await supabaseClient
              .from("messages")
              .select("id")
              .eq("conversation_id", conversationId)
              .eq("role", "user")
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            if (lastMsg) {
              await supabaseClient
                .from("messages")
                .update({
                  optimized_content: optimizationResult.optimizedPrompt,
                  model_recommended: optimizationResult.classification.recommended_model,
                  task_type: optimizationResult.classification.task_type,
                  optimization_savings_eur: optimizationResult.savingsEur,
                })
                .eq("id", lastMsg.id);
            }
          }
        }
      } catch (e) {
        console.error("Stream processing error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
