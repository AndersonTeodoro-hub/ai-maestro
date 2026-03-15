import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "login";

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "Google OAuth not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Always derive project URL from current request origin to avoid stale/mismatched env values.
    const projectUrl = new URL(req.url).origin;

    // The callback URL is this same function with action=callback
    const callbackUrl = `${projectUrl}/functions/v1/google-auth?action=callback`;

    if (action === "login") {
      // Step 1: Redirect to Google consent screen
      const redirectUri = url.searchParams.get("redirect_uri") || "https://savvyowl.app/dashboard";

      // Encode state with redirect_uri and CSRF nonce
      const nonce = crypto.randomUUID();
      const state = btoa(JSON.stringify({ redirect_uri: redirectUri, nonce }));

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: callbackUrl,
        response_type: "code",
        scope: "openid email profile",
        state,
        access_type: "offline",
        prompt: "select_account",
      });

      return new Response(null, {
        status: 302,
        headers: {
          Location: `${GOOGLE_AUTH_URL}?${params.toString()}`,
          ...corsHeaders,
        },
      });
    }

    if (action === "callback") {
      // Step 2: Handle Google callback
      const code = url.searchParams.get("code");
      const stateParam = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        return new Response(`<html><body><h1>Authentication cancelled</h1><p>${error}</p></body></html>`, {
          status: 400,
          headers: { "Content-Type": "text/html" },
        });
      }

      if (!code || !stateParam) {
        return new Response(`<html><body><h1>Missing parameters</h1></body></html>`, {
          status: 400,
          headers: { "Content-Type": "text/html" },
        });
      }

      // Decode state to get original redirect_uri
      let stateData: { redirect_uri: string; nonce: string };
      try {
        stateData = JSON.parse(atob(stateParam));
      } catch {
        return new Response(`<html><body><h1>Invalid state</h1></body></html>`, {
          status: 400,
          headers: { "Content-Type": "text/html" },
        });
      }

      // Exchange code for tokens
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: callbackUrl,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        console.error("Token exchange error:", tokenData);
        return new Response(`<html><body><h1>Token exchange failed</h1><p>${tokenData.error_description || tokenData.error}</p></body></html>`, {
          status: 400,
          headers: { "Content-Type": "text/html" },
        });
      }

      // Get user info from Google
      const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoRes.json();

      if (!userInfo.email) {
        return new Response(`<html><body><h1>Could not get email from Google</h1></body></html>`, {
          status: 400,
          headers: { "Content-Type": "text/html" },
        });
      }

      // Use project URL derived from request origin for all backend API calls.
      const supabaseAdmin = createClient(projectUrl, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Check if user exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u) => u.email === userInfo.email
      );

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        // Update user metadata if needed
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            full_name: userInfo.name,
            avatar_url: userInfo.picture,
          },
        });
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: userInfo.email,
          email_confirm: true,
          user_metadata: {
            full_name: userInfo.name,
            avatar_url: userInfo.picture,
          },
        });

        if (createError || !newUser.user) {
          console.error("Create user error:", createError);
          return new Response(`<html><body><h1>Could not create user</h1><p>${createError?.message}</p></body></html>`, {
            status: 500,
            headers: { "Content-Type": "text/html" },
          });
        }

        userId = newUser.user.id;
      }

      // Generate session tokens for the user
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: userInfo.email,
      });

      if (sessionError || !sessionData) {
        console.error("Generate link error:", sessionError);
        return new Response(`<html><body><h1>Could not generate session</h1><p>${sessionError?.message}</p></body></html>`, {
          status: 500,
          headers: { "Content-Type": "text/html" },
        });
      }

      // Extract the token from the magic link and verify it to get a session
      const linkUrl = new URL(sessionData.properties?.action_link || "");
      const token = linkUrl.searchParams.get("token");
      const tokenType = linkUrl.searchParams.get("type");

      if (!token) {
        return new Response(`<html><body><h1>Could not extract token</h1></body></html>`, {
          status: 500,
          headers: { "Content-Type": "text/html" },
        });
      }

      // Verify the OTP to get actual session tokens
      const verifyRes = await fetch(`${projectUrl}/auth/v1/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        },
        body: JSON.stringify({
          token_hash: token,
          type: tokenType || "magiclink",
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyData.access_token || !verifyData.refresh_token) {
        console.error("Verify error:", verifyData);
        return new Response(`<html><body><h1>Could not verify session</h1><p>${JSON.stringify(verifyData)}</p></body></html>`, {
          status: 500,
          headers: { "Content-Type": "text/html" },
        });
      }

      // Redirect to frontend with tokens in hash
      const finalRedirect = stateData.redirect_uri || "https://savvyowl.app/dashboard";
      const hashParams = new URLSearchParams({
        access_token: verifyData.access_token,
        refresh_token: verifyData.refresh_token,
        type: "google_oauth",
      });

      return new Response(null, {
        status: 302,
        headers: {
          Location: `${finalRedirect}#${hashParams.toString()}`,
        },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Google auth error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
