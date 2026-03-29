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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const falApiKey = Deno.env.get("FAL_API_KEY");

    if (!falApiKey) {
      return json({ error: "Serviço de vídeo não configurado. Contacta o suporte." }, 503);
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!userResp.ok) return json({ error: "Unauthorized" }, 401);
    const userData = await userResp.json();
    const userId = userData?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { prompt, aspectRatio, duration, model, referenceImageUrl, narrationUrl } = body;
    if (!prompt) return json({ error: "Prompt is required" }, 400);

    const ar = aspectRatio || "9:16";
    const dur = parseInt(duration) || 8;
    const selectedModel = model || "veo3-fast";

    // ── MODEL REGISTRY ──
    const FAL_MODELS: Record<string, { endpoint: string; credits: number; label: string }> = {
      "veo3-fast":       { endpoint: "fal-ai/veo3/fast",                  credits: 10, label: "Veo3 Fast" },
      "veo3":            { endpoint: "fal-ai/veo3",                       credits: 15, label: "Veo3" },
      "wan26-t2v-flash": { endpoint: "wan/v2.6/text-to-video",            credits: 5,  label: "Wan 2.6 T2V" },
      "wan26-t2v":       { endpoint: "wan/v2.6/text-to-video",            credits: 8,  label: "Wan 2.6 T2V" },
      "wan26-i2v-flash": { endpoint: "wan/v2.6/image-to-video",           credits: 5,  label: "Wan 2.6 I2V" },
      "wan26-i2v":       { endpoint: "wan/v2.6/image-to-video",           credits: 8,  label: "Wan 2.6 I2V" },
      "wan26-r2v-flash": { endpoint: "wan/v2.6/reference-to-video/flash", credits: 7,  label: "Wan 2.6 R2V Flash" },
      "wan26-r2v":       { endpoint: "wan/v2.6/reference-to-video",       credits: 10, label: "Wan 2.6 R2V" },
      "kling":           { endpoint: "fal-ai/kling-video/v2.1/pro",       credits: 10, label: "Kling 2.1 Pro" },
    };

    const modelConfig = FAL_MODELS[selectedModel] || FAL_MODELS["veo3-fast"];
    const LIPSYNC_COST = narrationUrl ? 2 : 0;
    const CREDIT_COST = modelConfig.credits + LIPSYNC_COST;

    const profileResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=credits_balance,plan`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
    );
    const profiles = await profileResp.json();
    const profile = profiles?.[0];
    const balance = profile?.credits_balance ?? 0;

    if (balance < CREDIT_COST) {
      return json({
        error: "insufficient_credits",
        message: `Sem créditos suficientes (tens ${balance}, precisas de ${CREDIT_COST}).`,
        balance, cost: CREDIT_COST,
      }, 402);
    }

    const modelEndpoint = modelConfig.endpoint;
    const isWan26 = selectedModel.startsWith("wan26");
    const isR2V = selectedModel.includes("r2v");
    const isI2V = selectedModel.includes("i2v");

    console.log(`[FAL] ${modelConfig.label} (${modelEndpoint}) ${dur}s ${ar}${referenceImageUrl ? " +ref" : ""}`);

    // ── BUILD FAL REQUEST ──
    const falBody: Record<string, unknown> = { prompt, aspect_ratio: ar };

    if (isWan26) {
      falBody.duration = String(dur);
      falBody.resolution = "720p";
      if ((isR2V || isI2V) && referenceImageUrl) {
        falBody.image_url = referenceImageUrl;
      }
    } else {
      falBody.duration = dur;
      if (referenceImageUrl) {
        falBody.image_url = referenceImageUrl;
      }
    }

    const submitResp = await fetch(`https://queue.fal.run/${modelEndpoint}`, {
      method: "POST",
      headers: { Authorization: `Key ${falApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(falBody),
    });

    if (!submitResp.ok) {
      const err = await submitResp.text();
      throw new Error(`fal.ai ${submitResp.status}: ${err.substring(0, 400)}`);
    }

    const submitData = await submitResp.json();
    const requestId = submitData.request_id;
    if (!requestId) throw new Error("No request_id from fal.ai");
    console.log(`[FAL] Request ID: ${requestId}`);

    const maxWait = 300000;
    const pollInterval = 5000;
    let elapsed = 0;

    while (elapsed < maxWait) {
      await new Promise((r) => setTimeout(r, pollInterval));
      elapsed += pollInterval;

      const statusResp = await fetch(
        `https://queue.fal.run/${modelEndpoint}/requests/${requestId}/status`,
        { headers: { Authorization: `Key ${falApiKey}` } }
      );
      if (!statusResp.ok) continue;
      const status = await statusResp.json();
      console.log(`[FAL] ${elapsed / 1000}s: ${status.status}`);

      if (status.status === "COMPLETED") {
        const resultResp = await fetch(
          `https://queue.fal.run/${modelEndpoint}/requests/${requestId}`,
          { headers: { Authorization: `Key ${falApiKey}` } }
        );
        const result = await resultResp.json();
        let videoUrl = result.video?.url || result.video_url || result.output?.video?.url;
        if (!videoUrl) throw new Error(`No video URL: ${JSON.stringify(result).substring(0, 300)}`);

        // ── LIP-SYNC POST-PROCESSING ──
        // If narration audio was provided, apply lip-sync via LatentSync
        let lipsyncApplied = false;
        if (narrationUrl && videoUrl) {
          try {
            console.log(`[FAL] Applying lip-sync via LatentSync...`);

            // Submit lip-sync job
            const lsSubmit = await fetch("https://queue.fal.run/fal-ai/latentsync", {
              method: "POST",
              headers: { Authorization: `Key ${falApiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ video_url: videoUrl, audio_url: narrationUrl }),
            });

            if (!lsSubmit.ok) {
              const lsErr = await lsSubmit.text();
              console.log(`[FAL] LatentSync submit failed: ${lsSubmit.status} ${lsErr.substring(0, 200)}`);
            } else {
              const lsData = await lsSubmit.json();
              const lsRequestId = lsData.request_id;
              console.log(`[FAL] LatentSync request: ${lsRequestId}`);

              // Poll for lip-sync result (3 min max)
              const lsMaxWait = 180000;
              let lsElapsed = 0;
              while (lsElapsed < lsMaxWait) {
                await new Promise((r) => setTimeout(r, 5000));
                lsElapsed += 5000;

                const lsStatus = await fetch(
                  `https://queue.fal.run/fal-ai/latentsync/requests/${lsRequestId}/status`,
                  { headers: { Authorization: `Key ${falApiKey}` } }
                );
                if (!lsStatus.ok) continue;
                const lsStat = await lsStatus.json();
                console.log(`[FAL] LatentSync ${lsElapsed / 1000}s: ${lsStat.status}`);

                if (lsStat.status === "COMPLETED") {
                  const lsResult = await fetch(
                    `https://queue.fal.run/fal-ai/latentsync/requests/${lsRequestId}`,
                    { headers: { Authorization: `Key ${falApiKey}` } }
                  );
                  const lsRes = await lsResult.json();
                  const syncedUrl = lsRes.video?.url || lsRes.output?.video?.url;
                  if (syncedUrl) {
                    videoUrl = syncedUrl;
                    lipsyncApplied = true;
                    console.log(`[FAL] LatentSync OK — lip-sync applied`);
                  }
                  break;
                }
                if (lsStat.status === "FAILED") {
                  console.log(`[FAL] LatentSync failed: ${JSON.stringify(lsStat.error || lsStat).substring(0, 200)}`);
                  break;
                }
              }
              if (!lipsyncApplied) {
                console.log(`[FAL] LatentSync did not complete — returning video without lip-sync`);
              }
            }
          } catch (lsErr) {
            console.error("[FAL] LatentSync error (non-blocking):", lsErr);
          }
        }

        const newBalance = balance - CREDIT_COST;
        await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ credits_balance: newBalance }),
        });
        await fetch(`${supabaseUrl}/rest/v1/credit_transactions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ user_id: userId, amount: -CREDIT_COST, type: "spend", description: `Vídeo ${dur}s ${modelConfig.label}` }),
        });
        await fetch(`${supabaseUrl}/rest/v1/usage_logs`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ user_id: userId, mode: "video_generation", model: `fal-${selectedModel}`, cost_eur: dur * 0.10 }),
        });

        console.log(`[FAL] OK ${modelConfig.label} ${Math.round(elapsed / 1000)}s | ${balance} → ${newBalance}${lipsyncApplied ? " +lipsync" : ""}`);
        return json({
          video: { uri: videoUrl, mimeType: "video/mp4" },
          generationTime: Math.round(elapsed / 1000),
          credits: { balance: newBalance, cost: CREDIT_COST },
          backend: `fal-${selectedModel}`,
          lipsync: lipsyncApplied,
        });
      }

      if (status.status === "FAILED") {
        throw new Error(`Falhou: ${JSON.stringify(status.error || status).substring(0, 300)}`);
      }
    }

    throw new Error("Timeout (5 min)");

  } catch (e) {
    console.error("[FAL] Error:", e);
    return json({ error: "Erro ao gerar vídeo: " + (e as Error).message }, 500);
  }
});
