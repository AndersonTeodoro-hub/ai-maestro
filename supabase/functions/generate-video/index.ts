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

    if (!falApiKey) return json({ error: "Serviço de vídeo não configurado." }, 503);

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
    const { prompt, aspectRatio, duration, model, referenceImageUrl, narrationUrl, silentVideo, action, requestId: pollRequestId, modelEndpoint: pollEndpoint } = body;

    // ── POLL ACTION — frontend polls for result ──
    if (action === "poll" && pollRequestId) {
      // Use the stored URLs from submit, or construct from base path
      const statusUrl = body.statusUrl;
      const responseUrl = body.responseUrl;
      
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
        const videoUrl = result.video?.url || result.video_url || result.output?.video?.url;
        return json({ status: "COMPLETED", videoUrl });
      }
      if (status.status === "FAILED") {
        return json({ status: "FAILED", error: JSON.stringify(status.error || status).substring(0, 300) });
      }
      return json({ status: status.status || "PENDING" });
    }

    // ── LIPSYNC ACTION — submit LatentSync job ──
    if (action === "lipsync") {
      const { videoUrl: lsVideoUrl, audioUrl: lsAudioUrl } = body;
      if (!lsVideoUrl || !lsAudioUrl) {
        return json({ error: "videoUrl e audioUrl são obrigatórios para lip-sync" }, 400);
      }

      const LIPSYNC_COST = 3;

      const lsProfileResp = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=credits_balance`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
      );
      const lsProfiles = await lsProfileResp.json();
      const lsBalance = lsProfiles?.[0]?.credits_balance ?? 0;
      if (lsBalance < LIPSYNC_COST) {
        return json({ error: "insufficient_credits", message: `Sem créditos (tens ${lsBalance}, precisas ${LIPSYNC_COST}).`, balance: lsBalance, cost: LIPSYNC_COST }, 402);
      }

      const lsSubmitResp = await fetch("https://queue.fal.run/fal-ai/sync-lipsync/v2", {
        method: "POST",
        headers: { Authorization: `Key ${falApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: lsVideoUrl, audio_url: lsAudioUrl }),
      });
      if (!lsSubmitResp.ok) {
        const err = await lsSubmitResp.text();
        throw new Error(`LatentSync ${lsSubmitResp.status}: ${err.substring(0, 400)}`);
      }

      const lsSubmitData = await lsSubmitResp.json();
      const lsRequestId = lsSubmitData.request_id;
      if (!lsRequestId) throw new Error("Sem request_id do LatentSync");

      const lsNewBalance = lsBalance - LIPSYNC_COST;
      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ credits_balance: lsNewBalance }),
      });
      await fetch(`${supabaseUrl}/rest/v1/credit_transactions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: userId, amount: -LIPSYNC_COST, type: "spend", description: "Lip-sync LatentSync" }),
      });

      console.log(`[LIPSYNC] Submitted ${lsRequestId} | ${lsBalance} → ${lsNewBalance}`);

      return json({
        status: "SUBMITTED",
        requestId: lsRequestId,
        statusUrl: lsSubmitData.status_url,
        responseUrl: lsSubmitData.response_url,
        credits: { balance: lsNewBalance, cost: LIPSYNC_COST },
      });
    }

    // ── SUBMIT ACTION — submit job and return immediately ──
    if (!prompt) return json({ error: "Prompt is required" }, 400);

    const ar = aspectRatio || "9:16";
    const dur = parseInt(duration) || 8;
    const selectedModel = model || "veo3-fast";

    const FAL_MODELS: Record<string, { endpoint: string; credits: number; label: string }> = {
      "veo3-fast":       { endpoint: "fal-ai/veo3/fast",                  credits: 15, label: "Veo3 Fast" },
      "veo3-fast-i2v":   { endpoint: "fal-ai/veo3/fast/image-to-video",  credits: 15, label: "Veo3 Fast I2V" },
      "veo3":            { endpoint: "fal-ai/veo3",                       credits: 20, label: "Veo3" },
      "wan26-t2v-flash": { endpoint: "wan/v2.6/text-to-video",            credits: 8,  label: "Wan 2.6 T2V" },
      "wan26-t2v":       { endpoint: "wan/v2.6/text-to-video",            credits: 8,  label: "Wan 2.6 T2V" },
      "wan26-i2v-flash": { endpoint: "wan/v2.6/image-to-video",           credits: 8,  label: "Wan 2.6 I2V" },
      "wan26-i2v":       { endpoint: "wan/v2.6/image-to-video",           credits: 8,  label: "Wan 2.6 I2V" },
      "wan26-r2v-flash": { endpoint: "wan/v2.6/reference-to-video/flash", credits: 8,  label: "Wan 2.6 R2V Flash" },
      "wan26-r2v":       { endpoint: "wan/v2.6/reference-to-video",       credits: 8,  label: "Wan 2.6 R2V" },
      "kling":           { endpoint: "fal-ai/kling-video/v2.1/pro",       credits: 10, label: "Kling 2.1 Pro" },
    };

    const modelConfig = FAL_MODELS[selectedModel] || FAL_MODELS["veo3-fast"];
    const LIPSYNC_COST = narrationUrl ? 3 : 0;
    const CREDIT_COST = modelConfig.credits + LIPSYNC_COST;

    // Check credits
    const profileResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=credits_balance,plan`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
    );
    const profiles = await profileResp.json();
    const profile = profiles?.[0];
    const balance = profile?.credits_balance ?? 0;

    if (balance < CREDIT_COST) {
      return json({ error: "insufficient_credits", message: `Sem créditos (tens ${balance}, precisas ${CREDIT_COST}).`, balance, cost: CREDIT_COST }, 402);
    }

    const modelEndpoint = modelConfig.endpoint;
    const isWan26 = selectedModel.startsWith("wan26");
    const isR2V = selectedModel.includes("r2v");
    const isI2V = selectedModel.includes("i2v");

    console.log(`[FAL] Submit ${modelConfig.label} ${dur}s ${ar}`);

    // Build request body
    const falBody: Record<string, unknown> = { prompt, aspect_ratio: ar };
    if (isWan26) {
      falBody.duration = String(dur);
      falBody.resolution = "720p";
      if (isR2V && referenceImageUrl) {
        // R2V expects image_urls (array) and prompt with "Character1"
        falBody.image_urls = [referenceImageUrl];
        // Prepend character reference to prompt if not already there
        if (!falBody.prompt?.toString().includes("Character1")) {
          falBody.prompt = `Character1 ${prompt}`;
        }
      } else if (isI2V && referenceImageUrl) {
        falBody.image_url = referenceImageUrl;
      }
    } else {
      falBody.duration = dur;
      if (referenceImageUrl) falBody.image_url = referenceImageUrl;
      // Veo3: always generate with audio so the character produces natural lip/speech movements.
      // Sync Lipsync 2.0 will replace the generic audio with ElevenLabs voice when available.
      if (selectedModel.startsWith("veo3")) {
        falBody.generate_audio = true;
      }
    }

    // Submit to fal.ai queue
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

    // Deduct credits immediately (before polling)
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

    console.log(`[FAL] Submitted ${requestId} | ${balance} → ${newBalance}`);

    // Return immediately with request_id + fal URLs — frontend will poll
    return json({
      status: "SUBMITTED",
      requestId,
      modelEndpoint,
      statusUrl: submitData.status_url,
      responseUrl: submitData.response_url,
      credits: { balance: newBalance, cost: CREDIT_COST },
    });

  } catch (e) {
    console.error("[FAL] Error:", e);
    return json({ error: "Erro: " + (e as Error).message }, 500);
  }
});
