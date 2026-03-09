import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get auth token
    const authHeader = req.headers.get("authorization");
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Check user from anon key auth
    const anonClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );
    
    const { data: { user } } = await anonClient.auth.getUser();

    const { messages, mode, conversationId } = await req.json();
    const model = MODEL_MAP[mode] || MODEL_MAP.quick;

    // Check plan limits if user is authenticated
    if (user) {
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("plan, monthly_budget_eur")
        .eq("id", user.id)
        .single();

      if (profile) {
        // Check mode restrictions for free plan
        if (profile.plan === "free" && mode !== "quick") {
          return new Response(
            JSON.stringify({ error: "Upgrade to Starter or Pro to use this mode." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check monthly request limit
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count } = await supabaseClient
          .from("usage_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", startOfMonth.toISOString());

        const limit = PLAN_LIMITS[profile.plan] || PLAN_LIMITS.free;
        if ((count || 0) >= limit) {
          return new Response(
            JSON.stringify({ error: "You've reached your monthly limit. Upgrade to continue." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Build messages with system prompt
    const systemPrompt = mode === "creator"
      ? CREATOR_SYSTEM_PROMPT
      : "You are PromptOS AI, a helpful and concise assistant. Keep answers clear, actionable, and well-formatted.";

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Call AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Something went wrong. Try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a transform stream to capture usage and append metadata
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
          
          // Parse SSE to extract content and usage
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

          // Pass through the chunk
          await writer.write(value);
        }

        // Estimate cost from content length if no usage data
        const tokensInput = usageData?.prompt_tokens || Math.ceil(JSON.stringify(messages).length / 4);
        const tokensOutput = usageData?.completion_tokens || Math.ceil(fullContent.length / 4);
        
        // Cost estimation (rough approximation for Gemini models)
        let costUsd = 0;
        if (model.includes("flash")) {
          costUsd = (tokensInput * 0.00015 + tokensOutput * 0.0006) / 1000;
        } else {
          costUsd = (tokensInput * 0.005 + tokensOutput * 0.015) / 1000;
        }
        const costEur = costUsd * 0.92;

        // Send metadata as final SSE event
        const metadata = {
          model,
          cost_eur: +costEur.toFixed(6),
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
        };
        await writer.write(encoder.encode(`data: ${JSON.stringify({ metadata })}\n\n`));
        await writer.write(encoder.encode("data: [DONE]\n\n"));

        // Log usage if user is authenticated
        if (user && conversationId) {
          await supabaseClient.from("usage_logs").insert({
            user_id: user.id,
            conversation_id: conversationId,
            tokens_input: tokensInput,
            tokens_output: tokensOutput,
            cost_eur: +costEur.toFixed(6),
            model,
            mode: mode || "quick",
          });
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
