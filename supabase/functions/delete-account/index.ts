import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Verify the user's token
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    console.log(`[DELETE-ACCOUNT] Deleting user: ${userId}`);

    // Delete user data in order (respecting foreign keys)
    // 1. Get conversation IDs for this user
    const { data: convos } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("user_id", userId);

    const convoIds = convos?.map((c) => c.id) || [];

    // 2. Delete messages for those conversations
    if (convoIds.length > 0) {
      await supabaseAdmin.from("messages").delete().in("conversation_id", convoIds);
    }

    // 3. Delete conversations
    await supabaseAdmin.from("conversations").delete().eq("user_id", userId);

    // 4. Delete usage_logs
    await supabaseAdmin.from("usage_logs").delete().eq("user_id", userId);

    // 5. Delete prompts
    await supabaseAdmin.from("prompts").delete().eq("user_id", userId);

    // 6. Delete profile
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // 7. Delete auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error(`[DELETE-ACCOUNT] Failed to delete auth user: ${deleteError.message}`);
      throw deleteError;
    }

    console.log(`[DELETE-ACCOUNT] Successfully deleted user: ${userId}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[DELETE-ACCOUNT] ERROR: ${msg}`);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
