import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPANSION_SYSTEM_PROMPT = `You are SavvyOwl's Character Expansion Engine. You receive a brief, casual character description from a user and expand it into an exhaustive, hyper-detailed character identity specification for AI image and video generation consistency.

CONTEXT: This specification will be injected into EVERY prompt sent to image generators (NanoBanana, Midjourney, Flux) and video generators (Veo3, Runway, Kling) to maintain absolute visual consistency across hundreds of generations. Every detail you define becomes a FIXED CONSTANT.

CRITICAL RULES:
1. Respond ONLY with valid JSON. No markdown, no backticks, no preamble, no explanation.
2. Every field must be filled with rich, specific, photographic-level detail.
3. Make creative but REALISTIC choices — real humans have asymmetries, imperfections, specific features.
4. Everything must be internally consistent (age matches skin, body matches lifestyle, etc).
5. Generate ALL descriptions in ENGLISH regardless of input language.
6. Be specific with measurements, colors (include hex), textures, spatial relationships.
7. Add realistic imperfections: skin texture variations, facial asymmetries, subtle marks.
8. The "reference" field should cross-reference 2 known people to triangulate appearance.
9. The "nano_banana_prompt" must be a COMPLETE self-contained image generation prompt (150-250 words).
10. Wardrobe should feel real — brand-level detail, wear patterns, fabric textures.

OUTPUT FORMAT (strict JSON):
{
  "name": "internal reference name",
  "summary": "one-line visual description in USER'S ORIGINAL LANGUAGE for UI display",
  "identity": { "gender": "...", "age": "...", "ethnicity_skin": "...", "reference": "..." },
  "face": { "shape": "...", "forehead": "...", "eyes": "...", "eyebrows": "...", "nose": "...", "mouth": "...", "jaw_chin": "...", "ears": "...", "skin_marks": "..." },
  "hair": { "color": "...", "type_texture": "...", "length": "...", "style": "...", "facial_hair": "..." },
  "body": { "height_build": "...", "posture": "...", "hands": "...", "movement_style": "...", "physical_asymmetries": "..." },
  "default_wardrobe": { "style_archetype": "...", "typical_top": "...", "typical_bottom": "...", "footwear": "...", "accessories": "...", "wardrobe_state": "..." },
  "voice_behavior": { "voice_quality": "...", "emotional_baseline": "...", "micro_expressions": "...", "mannerisms": "..." },
  "nano_banana_prompt": "Complete self-contained portrait photography prompt with ALL physical details, camera, lighting, style.",
  "negative_prompt": "Comprehensive exclusion list."
}`;

const REFINEMENT_SYSTEM_PROMPT = `You are SavvyOwl's Character Refinement Engine. You receive:
1. An existing character JSON specification
2. A user's adjustment request in natural language

YOUR TASK: Update the character JSON to reflect the request while maintaining consistency across ALL fields.

RULES:
1. Respond ONLY with the complete updated JSON. No markdown, no backticks, no preamble.
2. When changing one attribute, cascade to related fields (e.g., hair color change → update nano_banana_prompt too).
3. Preserve ALL fields not affected by the change.
4. All descriptions in ENGLISH regardless of input language.
5. The nano_banana_prompt must be fully regenerated to reflect updates.
6. Maintain the same JSON structure exactly.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("authorization");
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, characterId, input, adjustment } = await req.json();

    // ── EXPAND ──
    if (action === "expand") {
      if (!input?.trim()) {
        return new Response(JSON.stringify({ error: "Character description required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[CHARACTER] Expanding for user ${user.id}: "${input.substring(0, 50)}..."`);

      const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: EXPANSION_SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: `CHARACTER REQUEST FROM USER:\n"${input}"\n\nExpand this into a complete character identity specification. Fill every field with rich photographic-level detail.`,
          }],
        }),
      });

      if (!claudeResp.ok) {
        const err = await claudeResp.text();
        console.error("[CHARACTER] Claude API error:", err);
        return new Response(JSON.stringify({ error: "AI expansion failed. Try again." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const claudeData = await claudeResp.json();
      const text = claudeData.content?.map((b: any) => b.type === "text" ? b.text : "").join("") || "";
      const clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

      let expanded;
      try {
        expanded = JSON.parse(clean);
      } catch {
        console.error("[CHARACTER] JSON parse failed:", clean.substring(0, 200));
        return new Response(JSON.stringify({ error: "Failed to parse character data. Try again." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save to DB
      const { data: character, error: dbError } = await adminClient
        .from("characters")
        .insert({
          user_id: user.id,
          original_input: input.trim(),
          expanded,
          status: "pending",
          history: [{ action: "created", input: input.trim(), timestamp: new Date().toISOString() }],
        })
        .select()
        .single();

      if (dbError) {
        console.error("[CHARACTER] DB error:", dbError);
        return new Response(JSON.stringify({ error: "Failed to save character" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log usage
      await adminClient.from("usage_logs").insert({
        user_id: user.id, mode: "character_expand",
        model: "claude-sonnet-4-20250514", cost_eur: 0.02,
        tokens_input: claudeData.usage?.input_tokens || 0,
        tokens_output: claudeData.usage?.output_tokens || 0,
      });

      console.log(`[CHARACTER] Created: ${character.id}`);
      return new Response(JSON.stringify({ character }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── REFINE ──
    if (action === "refine") {
      if (!characterId || !adjustment?.trim()) {
        return new Response(JSON.stringify({ error: "characterId and adjustment required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: char } = await adminClient
        .from("characters")
        .select("*")
        .eq("id", characterId)
        .eq("user_id", user.id)
        .single();

      if (!char) {
        return new Response(JSON.stringify({ error: "Character not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (char.status === "locked") {
        return new Response(JSON.stringify({ error: "Cannot refine a locked character. Unlock first." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[CHARACTER] Refining ${characterId}: "${adjustment.substring(0, 50)}..."`);

      const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: REFINEMENT_SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: `CURRENT CHARACTER SPECIFICATION:\n${JSON.stringify(char.expanded, null, 2)}\n\nUSER'S ADJUSTMENT REQUEST:\n"${adjustment}"\n\nApply this adjustment. Cascade changes to all affected fields. Return the complete updated JSON.`,
          }],
        }),
      });

      if (!claudeResp.ok) {
        return new Response(JSON.stringify({ error: "AI refinement failed. Try again." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const claudeData = await claudeResp.json();
      const text = claudeData.content?.map((b: any) => b.type === "text" ? b.text : "").join("") || "";
      const clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

      let refined;
      try {
        refined = JSON.parse(clean);
      } catch {
        return new Response(JSON.stringify({ error: "Failed to parse refined data. Try again." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newHistory = [...(char.history || []), { action: "refined", input: adjustment.trim(), timestamp: new Date().toISOString() }];

      const { data: updated, error: dbError } = await adminClient
        .from("characters")
        .update({ expanded: refined, history: newHistory })
        .eq("id", characterId)
        .select()
        .single();

      if (dbError) {
        return new Response(JSON.stringify({ error: "Failed to save refinement" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("usage_logs").insert({
        user_id: user.id, mode: "character_refine",
        model: "claude-sonnet-4-20250514", cost_eur: 0.03,
        tokens_input: claudeData.usage?.input_tokens || 0,
        tokens_output: claudeData.usage?.output_tokens || 0,
      });

      return new Response(JSON.stringify({ character: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LOCK ──
    if (action === "lock") {
      const { data: updated, error } = await adminClient
        .from("characters")
        .update({
          status: "locked",
          locked_at: new Date().toISOString(),
          history: adminClient.rpc ? undefined : undefined, // handled below
        })
        .eq("id", characterId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error || !updated) {
        return new Response(JSON.stringify({ error: "Failed to lock character" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Append to history
      const newHistory = [...(updated.history || []), { action: "locked", timestamp: new Date().toISOString() }];
      await adminClient.from("characters").update({ history: newHistory }).eq("id", characterId);

      return new Response(JSON.stringify({ character: { ...updated, status: "locked", history: newHistory } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UNLOCK ──
    if (action === "unlock") {
      const { data: char } = await adminClient.from("characters").select("*").eq("id", characterId).eq("user_id", user.id).single();
      if (!char) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const newHistory = [...(char.history || []), { action: "unlocked", timestamp: new Date().toISOString() }];
      const { data: updated } = await adminClient
        .from("characters")
        .update({ status: "pending", locked_at: null, history: newHistory })
        .eq("id", characterId)
        .select()
        .single();

      return new Response(JSON.stringify({ character: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LIST ──
    if (action === "list") {
      const { data: characters } = await adminClient
        .from("characters")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify({ characters: characters || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE ──
    if (action === "delete") {
      await adminClient.from("characters").delete().eq("id", characterId).eq("user_id", user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: expand, refine, lock, unlock, list, delete" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[CHARACTER] Error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
