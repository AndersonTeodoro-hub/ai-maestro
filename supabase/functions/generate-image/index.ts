import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Credit costs per operation
const CREDITS = { image: 1 };

// ── Vertex AI Imagen 3 ─────────────────────────────────────────────────────────

async function getVertexAccessToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);

  // Build JWT header + payload
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
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signingInput = `${header}.${payload}`;
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${signingInput}.${sig}`;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) {
    throw new Error(`Vertex token exchange failed: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

async function generateWithVertexImagen(
  prompt: string,
  saJson: string,
  projectId: string
): Promise<{ data: string; mimeType: string }> {
  const accessToken = await getVertexAccessToken(saJson);
  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-002:predict`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1",
        safetyFilterLevel: "block_few",
        personGeneration: "allow_all",
      },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Vertex Imagen error ${resp.status}: ${err.substring(0, 400)}`);
  }

  const data = await resp.json();
  const prediction = data.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error(`No image in Vertex response: ${JSON.stringify(data).substring(0, 300)}`);
  }
  return { data: prediction.bytesBase64Encoded, mimeType: prediction.mimeType || "image/png" };
}

// ── Gemini API fallback ────────────────────────────────────────────────────────

async function generateWithGemini(
  prompt: string,
  apiKey: string
): Promise<{ data: string; mimeType: string }> {
  const models = [
    "gemini-2.5-flash-preview-05-20",
    "gemini-2.0-flash-exp",
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-image-preview",
  ];

  let lastError = "";
  for (const modelId of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Generate an image: " + prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    });

    if (!resp.ok) {
      lastError = await resp.text();
      console.log(`[IMG] Gemini ${modelId} → ${resp.status}: ${lastError.substring(0, 100)}`);
      continue;
    }

    const data = await resp.json();
    for (const part of data.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return { data: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" };
      }
    }
    lastError = "No image in response";
  }
  throw new Error(`All Gemini models failed: ${lastError.substring(0, 200)}`);
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

    const { prompt, apiKey } = await req.json();
    if (!prompt) return json({ error: "Prompt is required" }, 400);

    const usingOwnKey = !!apiKey;

    // Credit check (skip if user brings own key)
    const { data: profile } = await adminClient
      .from("profiles")
      .select("credits_balance, plan")
      .eq("id", user.id)
      .single();

    const balance = profile?.credits_balance ?? 0;
    const cost = CREDITS.image;

    if (!usingOwnKey && balance < cost) {
      return json({
        error: "insufficient_credits",
        message: `Sem créditos suficientes (tens ${balance}, precisas de ${cost}). Carrega créditos nas Definições.`,
        balance,
        cost,
      }, 402);
    }

    // Determine backend
    const saJson = Deno.env.get("VERTEX_SERVICE_ACCOUNT_JSON");
    const vertexProject = Deno.env.get("VERTEX_PROJECT_ID") || "gen-lang-client-0464073001";
    const serverGoogleKey = Deno.env.get("GOOGLE_API_KEY") || "";

    let imageData: { data: string; mimeType: string };
    let usedBackend = "unknown";

    if (usingOwnKey) {
      console.log(`[IMG] User-supplied API key`);
      imageData = await generateWithGemini(prompt, apiKey);
      usedBackend = "gemini-user";
    } else if (saJson) {
      console.log(`[IMG] Vertex AI Imagen 3`);
      try {
        imageData = await generateWithVertexImagen(prompt, saJson, vertexProject);
        usedBackend = "vertex-imagen3";
      } catch (vertexErr) {
        console.warn(`[IMG] Vertex failed → Gemini fallback: ${vertexErr}`);
        imageData = await generateWithGemini(prompt, serverGoogleKey);
        usedBackend = "gemini-fallback";
      }
    } else {
      console.log(`[IMG] Gemini server key (no Vertex SA)`);
      imageData = await generateWithGemini(prompt, serverGoogleKey);
      usedBackend = "gemini-server";
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
        description: `Imagem (${usedBackend})`,
      });
    }

    await adminClient.from("usage_logs").insert({
      user_id: user.id,
      mode: "image_generation",
      model: usedBackend,
      cost_eur: usingOwnKey ? 0 : 0.02,
    });

    const newBalance = usingOwnKey ? balance : balance - cost;
    console.log(`[IMG] ✅ ${usedBackend} | balance: ${balance} → ${newBalance}`);

    return json({
      image: imageData,
      text: "",
      credits: { balance: newBalance, cost: usingOwnKey ? 0 : cost },
      backend: usedBackend,
    });
  } catch (e) {
    console.error("[IMG] Error:", e);
    return json({ error: "Internal error: " + (e as Error).message }, 500);
  }
});
