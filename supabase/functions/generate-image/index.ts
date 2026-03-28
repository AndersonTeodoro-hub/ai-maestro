// generate-image — plan-based Gemini model routing + credits system
// Uses Deno.serve() + native fetch only (no external imports)

// Plan-based model routing for visual consistency
// Pro gets best Gemini 3 Pro Image for maximum character consistency
const PLAN_MODELS: Record<string, string[]> = {
  free:    ["gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"],
  starter: ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"],
  pro:     ["gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"],
};

const CREDIT_COST = 1;

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleKey  = Deno.env.get("GOOGLE_API_KEY") || "";

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    // Verify user
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!userResp.ok) return json({ error: "Unauthorized" }, 401);
    const user = await userResp.json();
    if (!user?.id) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { prompt, apiKey: userApiKey } = body;
    if (!prompt) return json({ error: "Prompt is required" }, 400);

    // Get profile: plan + credits
    const profileResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=credits_balance,plan`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
    );
    const profiles = await profileResp.json();
    const profile = profiles?.[0];
    const plan = profile?.plan ?? "free";
    const balance = profile?.credits_balance ?? 0;
    const usingOwnKey = !!userApiKey;

    // Credit check (server-side generation only)
    if (!usingOwnKey && balance < CREDIT_COST) {
      return json({
        error: "insufficient_credits",
        message: `Sem créditos suficientes (tens ${balance}, precisas de ${CREDIT_COST}). Carrega créditos nas Definições.`,
        balance,
        cost: CREDIT_COST,
      }, 402);
    }

    const activeKey = usingOwnKey ? userApiKey : googleKey;
    const models = PLAN_MODELS[plan] ?? PLAN_MODELS.free;
    console.log(`[IMG] plan=${plan} model=${models[0]} ownKey=${usingOwnKey}`);

    // Try models in order (plan-appropriate → fallbacks)
    let imageData: { data: string; mimeType: string } | null = null;
    let textResponse = "";
    let usedModel = models[0];
    let lastError = "";

    for (const model of models) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          }),
        }
      );

      if (!resp.ok) {
        lastError = await resp.text();
        console.log(`[IMG] ${model} → ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      for (const part of data.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData) {
          imageData = { data: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" };
          usedModel = model;
        }
        if (part.text) textResponse += part.text;
      }

      if (imageData) { console.log(`[IMG] ✅ ${model}`); break; }
    }

    if (!imageData) {
      return json({ error: `Geração falhou: ${lastError.substring(0, 200)}` }, 500);
    }

    // Deduct credits for server-side generation
    let newBalance = balance;
    if (!usingOwnKey) {
      newBalance = balance - CREDIT_COST;
      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
        body: JSON.stringify({ credits_balance: newBalance }),
      });
      await fetch(`${supabaseUrl}/rest/v1/credit_transactions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: user.id, amount: -CREDIT_COST, type: "spend", description: `Imagem (${usedModel})` }),
      });
    }

    // Log usage
    await fetch(`${supabaseUrl}/rest/v1/usage_logs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: user.id, mode: "image_generation", model: usedModel, cost_eur: usingOwnKey ? 0 : 0.02 }),
    });

    console.log(`[IMG] ✅ ${usedModel} plan=${plan} bal:${balance}→${newBalance}`);

    return json({
      image: imageData,
      text: textResponse,
      credits: usingOwnKey ? null : { balance: newBalance, cost: CREDIT_COST },
      backend: usedModel,
      plan,
    });

  } catch (e) {
    console.error("[IMG] Error:", e);
    return json({ error: "Erro interno: " + (e as Error).message }, 500);
  }
});
