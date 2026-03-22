import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SAVVYOWL_GOOGLE_KEY = Deno.env.get("GOOGLE_API_KEY") || "";
const FREE_IMAGE_LIMIT = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, apiKey } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which API key to use
    let activeKey = apiKey || null;
    let usingFreeCredits = false;

    if (!activeKey) {
      // Check free tier usage
      const { count } = await adminClient
        .from("usage_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("mode", "image_generation");

      const usedImages = count || 0;

      if (usedImages >= FREE_IMAGE_LIMIT) {
        return new Response(JSON.stringify({
          error: "free_limit_reached",
          message: `Usaste as tuas ${FREE_IMAGE_LIMIT} imagens gratuitas. Adiciona a tua Google API Key nas Definicoes para continuar a gerar imagens sem limite.`,
          used: usedImages,
          limit: FREE_IMAGE_LIMIT,
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      activeKey = SAVVYOWL_GOOGLE_KEY;
      usingFreeCredits = true;
      console.log(`[NANO-BANANA] Free tier: ${usedImages}/${FREE_IMAGE_LIMIT} used for user ${user.id}`);
    }

    console.log(`[NANO-BANANA] Generating with ${usingFreeCredits ? "SavvyOwl key (free)" : "user key"}`);

    // Models from official Google docs (March 2026)
    const models = [
      { id: "gemini-2.0-flash-exp", modalities: ["TEXT", "IMAGE"] },
      { id: "gemini-2.0-flash", modalities: ["TEXT", "IMAGE"] },
    ];

    let response = null;
    let usedModel = models[0].id;

    for (const model of models) {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${activeKey}`;

      response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Generate an image: " + prompt }] }],
          generationConfig: {
            responseModalities: model.modalities,
          },
        }),
      });

      if (response.ok) {
        usedModel = model.id;
        console.log(`[NANO-BANANA] Success with model: ${model.id}`);
        break;
      }
      const errText = await response.text();
      console.log(`[NANO-BANANA] Model ${model.id} failed: ${errText.substring(0, 200)}`);
    }

    if (!response || !response.ok) {
      const errText = await response.text();
      console.error("[NANO-BANANA] API error:", errText);
      let userMessage = "Image generation failed";
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) userMessage = errJson.error.message;
      } catch {}
      return new Response(JSON.stringify({ error: userMessage }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate?.content?.parts) {
      return new Response(JSON.stringify({ error: "No image generated. Try a different prompt." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imageData = null;
    let textResponse = "";

    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        imageData = {
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType || "image/png",
        };
      }
      if (part.text) {
        textResponse += part.text;
      }
    }

    if (!imageData) {
      return new Response(JSON.stringify({
        error: "The model returned text but no image. Try adding 'Generate an image of' at the start.",
        text: textResponse,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log usage (for free tier tracking and analytics)
    await adminClient.from("usage_logs").insert({
      user_id: user.id,
      mode: "image_generation",
      model: usedModel,
      cost_eur: usingFreeCredits ? 0 : 0.04,
    });

    // Get remaining free credits
    let remaining = null;
    if (usingFreeCredits) {
      const { count } = await adminClient
        .from("usage_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("mode", "image_generation");
      remaining = FREE_IMAGE_LIMIT - (count || 0);
    }

    console.log(`[NANO-BANANA] Image generated successfully${usingFreeCredits ? ` (${remaining} free remaining)` : ""}`);

    return new Response(JSON.stringify({
      image: imageData,
      text: textResponse,
      freeCredits: usingFreeCredits ? { remaining, limit: FREE_IMAGE_LIMIT } : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[NANO-BANANA] Error:", e);
    return new Response(JSON.stringify({ error: "Internal error: " + (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
