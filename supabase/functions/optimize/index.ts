import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

const FLASH_COST_INPUT = 0.0001;
const FLASH_COST_OUTPUT = 0.0004;
const PRO_COST_INPUT = 0.007;
const PRO_COST_OUTPUT = 0.021;
const GEMINI_MODEL = "gemini-2.5-flash";

async function callGemini(apiKey: string, systemPrompt: string, userContent: string): Promise<string> {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw new Error("RATE_LIMIT");
    if (status === 402) throw new Error("CREDITS_EXHAUSTED");
    const errText = await response.text();
    console.error("Gemini API error:", status, errText);
    throw new Error(`AI_ERROR_${status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY is not configured");

    const { user_message, conversation_context, user_plan } = await req.json();

    if (!user_message || typeof user_message !== "string") {
      return new Response(
        JSON.stringify({ error: "user_message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const plan = user_plan || "free";

    let classifierInput = user_message;
    if (conversation_context?.length) {
      const ctx = conversation_context
        .slice(-3)
        .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
        .join("\n");
      classifierInput = `Contexto da conversa:\n${ctx}\n\nPedido actual:\n${user_message}`;
    }

    // STEP 1: Classification
    const classificationRaw = await callGemini(GOOGLE_API_KEY, CLASSIFIER_SYSTEM_PROMPT, classifierInput);

    let classification;
    try {
      classification = JSON.parse(classificationRaw.trim());
    } catch {
      classification = {
        task_type: "simple",
        complexity: "low",
        estimated_output_tokens: 500,
        recommended_model: "gemini-flash",
        reasoning: "Failed to parse classification, defaulting to flash",
      };
    }

    if (plan === "free") {
      classification.recommended_model = "gemini-flash";
    }

    // STEP 2: Prompt Optimization
    const optimizedPrompt = await callGemini(GOOGLE_API_KEY, OPTIMIZER_SYSTEM_PROMPT, user_message);

    const inputTokensOriginal = Math.ceil(user_message.length / 4);
    const inputTokensOptimized = Math.ceil(optimizedPrompt.length / 4);
    const outputTokens = classification.estimated_output_tokens || 500;

    const costWithoutOptimization =
      (inputTokensOriginal * PRO_COST_INPUT + outputTokens * PRO_COST_OUTPUT) / 1000;

    const isFlash = classification.recommended_model === "gemini-flash";
    const costInput = isFlash ? FLASH_COST_INPUT : PRO_COST_INPUT;
    const costOutput = isFlash ? FLASH_COST_OUTPUT : PRO_COST_OUTPUT;
    const costWithOptimization =
      (inputTokensOptimized * costInput + outputTokens * costOutput) / 1000;

    const tokensSaved = Math.max(0, inputTokensOriginal - inputTokensOptimized);

    return new Response(
      JSON.stringify({
        original_prompt: user_message,
        optimized_prompt: optimizedPrompt.trim(),
        classification,
        estimated_savings: {
          tokens_saved_estimate: tokensSaved,
          cost_without_optimization: +costWithoutOptimization.toFixed(6),
          cost_with_optimization: +costWithOptimization.toFixed(6),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("optimize error:", e);

    const message = e instanceof Error ? e.message : "Unknown error";
    let status = 500;
    let error = "Something went wrong. Try again.";

    if (message === "RATE_LIMIT") { status = 429; error = "Rate limit exceeded. Please try again later."; }
    else if (message === "CREDITS_EXHAUSTED") { status = 402; error = "AI credits exhausted. Please add more credits."; }

    return new Response(
      JSON.stringify({ error }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
