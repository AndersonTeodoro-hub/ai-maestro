// generate-image — plan-based Gemini model routing + Flux 2 Pro via fal.ai + credits system
// Uses Deno.serve() + native fetch only (no external imports)

// Plan-based model routing for visual consistency (Gemini engine)
const PLAN_MODELS: Record<string, string[]> = {
  free:    ["gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"],
  starter: ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"],
  pro:     ["gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"],
};

const GEMINI_CREDIT_COST = 1;
const FLUX_CREDIT_COST = 2;

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
    const falApiKey  = Deno.env.get("FAL_API_KEY") || "";

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
    const { prompt, apiKey: userApiKey, referenceImageUrl, engine, action, requestId: pollRequestId } = body;

    // ── FLUX POLL ACTION — frontend polls for fal.ai result ──
    if (engine === "flux" && action === "poll" && pollRequestId) {
      const { statusUrl, responseUrl } = body;
      if (!statusUrl || !responseUrl) {
        return json({ status: "FAILED", error: "Missing statusUrl/responseUrl" });
      }

      const statusResp = await fetch(statusUrl, {
        headers: { Authorization: `Key ${falApiKey}` },
      });
      if (!statusResp.ok) return json({ status: "PENDING" });
      const status = await statusResp.json();

      if (status.status === "COMPLETED") {
        const resultResp = await fetch(responseUrl, {
          headers: { Authorization: `Key ${falApiKey}` },
        });
        const result = await resultResp.json();
        const imageUrl = result.images?.[0]?.url;
        if (!imageUrl) return json({ status: "FAILED", error: "No image in result" });
        return json({ status: "COMPLETED", imageUrl });
      }
      if (status.status === "FAILED") {
        return json({ status: "FAILED", error: JSON.stringify(status.error || status).substring(0, 300) });
      }
      return json({ status: status.status || "PENDING" });
    }

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

    // ── FLUX ENGINE ──
    if (engine === "flux") {
      if (!falApiKey) return json({ error: "Serviço Flux não configurado." }, 503);

      if (!usingOwnKey && balance < FLUX_CREDIT_COST) {
        return json({
          error: "insufficient_credits",
          message: `Sem créditos suficientes (tens ${balance}, precisas de ${FLUX_CREDIT_COST}). Carrega créditos nas Definições.`,
          balance,
          cost: FLUX_CREDIT_COST,
        }, 402);
      }

      // Build Flux request
      const falBody: Record<string, unknown> = {
        prompt,
        image_size: "landscape_16_9",
        num_images: 1,
      };
      if (referenceImageUrl) {
        falBody.image_url = referenceImageUrl;
      }

      console.log(`[IMG-FLUX] Submitting Flux 2 Pro`);

      const submitResp = await fetch("https://queue.fal.run/fal-ai/flux/v2/pro", {
        method: "POST",
        headers: { Authorization: `Key ${falApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(falBody),
      });

      if (!submitResp.ok) {
        const err = await submitResp.text();
        throw new Error(`fal.ai Flux ${submitResp.status}: ${err.substring(0, 400)}`);
      }

      const submitData = await submitResp.json();
      const requestId = submitData.request_id;
      if (!requestId) throw new Error("No request_id from fal.ai");

      // Deduct credits
      if (!usingOwnKey) {
        const newBalance = balance - FLUX_CREDIT_COST;
        await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
          body: JSON.stringify({ credits_balance: newBalance }),
        });
        await fetch(`${supabaseUrl}/rest/v1/credit_transactions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ user_id: user.id, amount: -FLUX_CREDIT_COST, type: "spend", description: "Imagem (Flux 2 Pro)" }),
        });
        console.log(`[IMG-FLUX] ✅ Submitted ${requestId} | ${balance} → ${newBalance}`);

        return json({
          status: "SUBMITTED",
          requestId,
          statusUrl: submitData.status_url,
          responseUrl: submitData.response_url,
          credits: { balance: newBalance, cost: FLUX_CREDIT_COST },
          backend: "flux-v2-pro",
          plan,
        });
      }

      console.log(`[IMG-FLUX] ✅ Submitted ${requestId} (own key)`);
      return json({
        status: "SUBMITTED",
        requestId,
        statusUrl: submitData.status_url,
        responseUrl: submitData.response_url,
        credits: null,
        backend: "flux-v2-pro",
        plan,
      });
    }

    // ── GEMINI ENGINE (default) ──
    // If reference image provided, fetch it as base64 for img2img
    let referenceImageBase64: string | null = null;
    let referenceImageMime = "image/png";
    if (referenceImageUrl) {
      try {
        const imgResp = await fetch(referenceImageUrl);
        if (imgResp.ok) {
          const buffer = await imgResp.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
          }
          referenceImageBase64 = btoa(binary);
          referenceImageMime = imgResp.headers.get("content-type") || "image/png";
          console.log(`[IMG] Reference image loaded (${Math.round(buffer.byteLength / 1024)}KB)`);
        }
      } catch (e) {
        console.log(`[IMG] Failed to load reference image: ${e}`);
      }
    }

    // Credit check (server-side generation only)
    if (!usingOwnKey && balance < GEMINI_CREDIT_COST) {
      return json({
        error: "insufficient_credits",
        message: `Sem créditos suficientes (tens ${balance}, precisas de ${GEMINI_CREDIT_COST}). Carrega créditos nas Definições.`,
        balance,
        cost: GEMINI_CREDIT_COST,
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
      // Build parts: reference image (if available) + text prompt
      const parts: unknown[] = [];
      if (referenceImageBase64) {
        parts.push({
          text: "REFERENCE IMAGE — This is the canonical appearance of the character. Generate a new image that matches this person EXACTLY: same face, same skin texture, same features. Only change what the prompt explicitly requests (pose, scene, clothing)."
        });
        parts.push({
          inlineData: { mimeType: referenceImageMime, data: referenceImageBase64 }
        });
        parts.push({ text: prompt });
      } else {
        parts.push({ text: prompt });
      }

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
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
      newBalance = balance - GEMINI_CREDIT_COST;
      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
        body: JSON.stringify({ credits_balance: newBalance }),
      });
      await fetch(`${supabaseUrl}/rest/v1/credit_transactions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: user.id, amount: -GEMINI_CREDIT_COST, type: "spend", description: `Imagem (${usedModel})` }),
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
      credits: usingOwnKey ? null : { balance: newBalance, cost: GEMINI_CREDIT_COST },
      backend: usedModel,
      plan,
    });

  } catch (e) {
    console.error("[IMG] Error:", e);
    return json({ error: "Erro interno: " + (e as Error).message }, 500);
  }
});
