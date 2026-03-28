const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_IMAGE_LIMIT = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // SAVVYOWL_GOOGLE_KEY é a chave própria do SavvyOwl para o free tier
    // Guarda-la como secret: supabase secrets set SAVVYOWL_GOOGLE_KEY=<key>
    const savvyOwlKey = Deno.env.get("SAVVYOWL_GOOGLE_KEY") || Deno.env.get("GOOGLE_API_KEY") || "";

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    // Verify user via Supabase REST
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!userResp.ok) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userData = await userResp.json();
    const userId = userData?.id;
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { prompt, apiKey } = body;
    if (!prompt) return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Determine which API key to use
    let activeKey = apiKey || null;
    let usingFreeCredits = false;

    if (!activeKey) {
      // Check free tier usage
      const usageResp = await fetch(
        `${supabaseUrl}/rest/v1/usage_logs?user_id=eq.${userId}&mode=eq.image_generation&select=id`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, Prefer: "count=exact" } }
      );
      const countHeader = usageResp.headers.get("content-range") || "";
      const usedImages = parseInt(countHeader.split("/")[1] || "0") || 0;

      if (usedImages >= FREE_IMAGE_LIMIT) {
        return new Response(JSON.stringify({
          error: "free_limit_reached",
          message: `Usaste as tuas ${FREE_IMAGE_LIMIT} imagens gratuitas. Adiciona a tua Google API Key nas Definições para continuar a gerar imagens sem limite.`,
          used: usedImages,
          limit: FREE_IMAGE_LIMIT,
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      activeKey = savvyOwlKey;
      usingFreeCredits = true;
      console.log(`[NANO-BANANA] Free tier: ${usedImages}/${FREE_IMAGE_LIMIT} used for user ${userId}`);
    }

    console.log(`[NANO-BANANA] Generating with ${usingFreeCredits ? "SavvyOwl key (free)" : "user key"}`);

    // Nano Banana models — dedicated image generation models, ordered by preference
    const models = [
      "gemini-2.5-flash-image",
      "gemini-3.1-flash-image-preview",
      "gemini-3-pro-image-preview",
    ];

    let response: Response | null = null;
    let usedModel = models[0];

    for (const model of models) {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;
      response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });

      if (response.ok) {
        usedModel = model;
        console.log(`[NANO-BANANA] Success with model: ${model}`);
        break;
      }
      console.log(`[NANO-BANANA] Model ${model} failed (${response.status}), trying next...`);
    }

    // Fallback: Claude Sonnet (text description if all Nano Banana models fail)
    if (!response || !response.ok) {
      const errText = await response!.text();
      console.error("[NANO-BANANA] All models failed, trying Claude fallback:", errText.substring(0, 200));

      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
      if (anthropicKey) {
        try {
          const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
            body: JSON.stringify({
              model: "claude-sonnet-4-5",
              max_tokens: 1024,
              messages: [{ role: "user", content: `The user requested an image with this prompt: "${prompt}"\n\nNano Banana image generation is temporarily unavailable. Please respond with a detailed description of what the image would look like, formatted as a message to the user explaining the situation and describing the intended image in detail.` }],
            }),
          });
          if (claudeResp.ok) {
            const claudeData = await claudeResp.json();
            const text = claudeData.content?.[0]?.text || "";
            return new Response(JSON.stringify({ image: null, text, freeCredits: null, backend: "claude-fallback" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } catch (claudeErr) {
          console.error("[NANO-BANANA] Claude fallback error:", claudeErr);
        }
      }

      let userMessage = "Image generation failed";
      try { const errJson = JSON.parse(errText); if (errJson.error?.message) userMessage = errJson.error.message; } catch {}
      return new Response(JSON.stringify({ error: userMessage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate?.content?.parts) {
      return new Response(JSON.stringify({ error: "No image generated. Try a different prompt." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let imageData: { data: string; mimeType: string } | null = null;
    let textResponse = "";

    for (const part of candidate.content.parts) {
      if (part.inlineData) imageData = { data: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" };
      if (part.text) textResponse += part.text;
    }

    if (!imageData) {
      return new Response(JSON.stringify({
        error: "The model returned text but no image. Try adding 'Generate an image of' at the start.",
        text: textResponse,
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Log usage
    await fetch(`${supabaseUrl}/rest/v1/usage_logs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: userId, mode: "image_generation", model: usedModel, cost_eur: usingFreeCredits ? 0 : 0.04 }),
    });

    // Get remaining free credits
    let remaining = null;
    if (usingFreeCredits) {
      const usageResp2 = await fetch(
        `${supabaseUrl}/rest/v1/usage_logs?user_id=eq.${userId}&mode=eq.image_generation&select=id`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, Prefer: "count=exact" } }
      );
      const countHeader2 = usageResp2.headers.get("content-range") || "";
      const newCount = parseInt(countHeader2.split("/")[1] || "0") || 0;
      remaining = FREE_IMAGE_LIMIT - newCount;
    }

    console.log(`[NANO-BANANA] Image generated successfully with ${usedModel}${usingFreeCredits ? ` (${remaining} free remaining)` : ""}`);

    return new Response(JSON.stringify({
      image: imageData,
      text: textResponse,
      freeCredits: usingFreeCredits ? { remaining, limit: FREE_IMAGE_LIMIT } : null,
      backend: usedModel,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("[NANO-BANANA] Error:", e);
    return new Response(JSON.stringify({ error: "Internal error: " + (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
