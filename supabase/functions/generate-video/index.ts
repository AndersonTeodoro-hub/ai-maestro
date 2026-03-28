import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CREDITS = { video: 10 };
const MAX_POLL_TIME = 300;
const POLL_INTERVAL = 10;

// ── Vertex AI JWT helper ───────────────────────────────────────────────────────

async function getVertexAccessToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);
  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const header = enc({ alg: "RS256", typ: "JWT" });
  const payload = enc({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  });

  const pemKey = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----\n?/, "")
    .replace(/\n?-----END PRIVATE KEY-----\n?/, "")
    .replace(/\n/g, "");
  const keyData = Uint8Array.from(atob(pemKey), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
  const signingInput = `${header}.${payload}`;
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${signingInput}.${sig}`;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) throw new Error(`Vertex token failed: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

// ── Vertex AI Veo3 ─────────────────────────────────────────────────────────────

async function generateWithVertexVeo3(
  prompt: string,
  negativePrompt: string | undefined,
  aspectRatio: string,
  duration: number,
  saJson: string,
  projectId: string
): Promise<{ uri?: string; data?: string; mimeType: string; elapsed: number }> {
  const accessToken = await getVertexAccessToken(saJson);
  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/veo-3.0-generate-preview:predictLongRunning`;

  const reqBody: Record<string, unknown> = {
    instances: [{
      prompt,
      ...(negativePrompt && { negativePrompt }),
    }],
    parameters: {
      aspectRatio,
      sampleCount: 1,
      durationSeconds: duration,
      personGeneration: "allow_all",
      safetyFilterLevel: "block_few",
    },
  };

  const startResp = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
  });

  if (!startResp.ok) {
    const err = await startResp.text();
    throw new Error(`Vertex Veo3 start error ${startResp.status}: ${err.substring(0, 400)}`);
  }

  const operationData = await startResp.json();
  const operationName = operationData.name;
  if (!operationName) throw new Error("No operation name from Vertex Veo3");

  console.log(`[VEO3-VERTEX] Operation: ${operationName}`);

  // Poll
  let elapsed = 0;
  while (elapsed < MAX_POLL_TIME) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL * 1000));
    elapsed += POLL_INTERVAL;

    const pollUrl = `https://us-central1-aiplatform.googleapis.com/v1/${operationName}`;
    const pollResp = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!pollResp.ok) {
      console.log(`[VEO3-VERTEX] Poll error at ${elapsed}s`);
      continue;
    }

    const pollData = await pollResp.json();
    console.log(`[VEO3-VERTEX] Poll ${elapsed}s: done=${pollData.done}`);

    if (pollData.done) {
      if (pollData.error) throw new Error(`Veo3 failed: ${pollData.error.message}`);
      const videos = pollData.response?.predictions || pollData.response?.generateVideoResponse?.generatedSamples || [];
      const video = videos[0];
      if (!video) throw new Error("No video in Vertex response");
      return {
        uri: video.gcsUri || video.uri || undefined,
        data: video.bytesBase64Encoded || undefined,
        mimeType: "video/mp4",
        elapsed,
      };
    }
  }
  throw new Error("Vertex Veo3 timed out (5 min)");
}

// ── Gemini Veo3 fallback (user-supplied key) ───────────────────────────────────

async function generateWithGeminiVeo3(
  prompt: string,
  negativePrompt: string | undefined,
  aspectRatio: string,
  duration: number,
  apiKey: string
): Promise<{ uri?: string; data?: string; mimeType: string; elapsed: number }> {
  const modelId = "veo-3.0-generate-preview";
  const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateVideos`;

  const requestBody: Record<string, unknown> = {
    prompt,
    config: {
      aspectRatio,
      numberOfVideos: 1,
      durationSeconds: duration,
      ...(negativePrompt && { negativePrompt }),
    },
  };

  const startResp = await fetch(generateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(requestBody),
  });

  if (!startResp.ok) {
    const err = await startResp.text();
    throw new Error(`Gemini Veo3 start error: ${err.substring(0, 300)}`);
  }

  const operationData = await startResp.json();
  const operationName = operationData.name;
  if (!operationName) throw new Error("No operation name from Gemini Veo3");

  let elapsed = 0;
  while (elapsed < MAX_POLL_TIME) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL * 1000));
    elapsed += POLL_INTERVAL;

    const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}`;
    const pollResp = await fetch(pollUrl, { headers: { "x-goog-api-key": apiKey } });
    if (!pollResp.ok) continue;

    const pollData = await pollResp.json();
    console.log(`[VEO3-GEMINI] Poll ${elapsed}s: done=${pollData.done}`);

    if (pollData.done) {
      if (pollData.error) throw new Error(`Veo3 failed: ${pollData.error.message}`);
      const videos = pollData.response?.generateVideoResponse?.generatedSamples || pollData.result?.generatedVideos || [];
      const video = videos[0]?.video || videos[0];
      return { uri: video?.uri, data: video?.bytesBase64Encoded, mimeType: "video/mp4", elapsed };
    }
  }
  throw new Error("Gemini Veo3 timed out (5 min)");
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { prompt, apiKey, negativePrompt, aspectRatio, duration } = await req.json();
    if (!prompt) return json({ error: "Prompt is required" }, 400);

    const usingOwnKey = !!apiKey;
    const saJson = Deno.env.get("VERTEX_SERVICE_ACCOUNT_JSON");
    const vertexProject = Deno.env.get("VERTEX_PROJECT_ID") || "gen-lang-client-0464073001";

    // If no server SA and no user key → error
    if (!usingOwnKey && !saJson) {
      return json({
        error: "no_video_backend",
        message: "A geração de vídeo via servidor está a ser configurada. Adiciona a tua Google API Key nas Definições para gerar vídeos agora.",
      }, 503);
    }

    // Credit check
    const { data: profile } = await adminClient
      .from("profiles")
      .select("credits_balance, plan")
      .eq("id", user.id)
      .single();

    const balance = profile?.credits_balance ?? 0;
    const cost = CREDITS.video;

    if (!usingOwnKey && balance < cost) {
      return json({
        error: "insufficient_credits",
        message: `Sem créditos suficientes para vídeo (tens ${balance}, precisas de ${cost}). Carrega créditos nas Definições.`,
        balance,
        cost,
      }, 402);
    }

    const ar = aspectRatio || "9:16";
    const dur = parseInt(duration) || 8;

    let result: { uri?: string; data?: string; mimeType: string; elapsed: number };
    let usedBackend = "unknown";

    if (usingOwnKey) {
      console.log(`[VEO3] User-supplied key`);
      result = await generateWithGeminiVeo3(prompt, negativePrompt, ar, dur, apiKey);
      usedBackend = "veo3-gemini-user";
    } else {
      console.log(`[VEO3] Vertex AI`);
      result = await generateWithVertexVeo3(prompt, negativePrompt, ar, dur, saJson!, vertexProject);
      usedBackend = "veo3-vertex";
    }

    // Deduct credits
    if (!usingOwnKey) {
      await adminClient
        .from("profiles")
        .update({ credits_balance: balance - cost })
        .eq("id", user.id);
      await adminClient.from("credit_transactions").insert({
        user_id: user.id,
        amount: -cost,
        type: "spend",
        description: `Vídeo ${dur}s (${usedBackend})`,
      });
    }

    await adminClient.from("usage_logs").insert({
      user_id: user.id,
      mode: "video_generation",
      model: usedBackend,
      cost_eur: usingOwnKey ? 0 : 1.20,
    });

    const newBalance = usingOwnKey ? balance : balance - cost;
    console.log(`[VEO3] ✅ ${usedBackend} in ${result.elapsed}s | balance: ${balance} → ${newBalance}`);

    return json({
      video: { uri: result.uri, data: result.data, mimeType: result.mimeType },
      generationTime: result.elapsed,
      credits: { balance: newBalance, cost: usingOwnKey ? 0 : cost },
      backend: usedBackend,
    });
  } catch (e) {
    console.error("[VEO3] Error:", e);
    return json({ error: "Internal error: " + (e as Error).message }, 500);
  }
});
