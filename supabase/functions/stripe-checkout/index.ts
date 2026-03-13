import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICES: Record<string, string> = {
  starter: "price_1T9oNWKg016ceaDVTLnC3PD7",
  pro: "price_1T9oNrKg016ceaDVfoGdfk6W",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-CHECKOUT] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Unauthorized");
    const user = userData.user;
    logStep("Authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.json();
    const { action, plan } = body;

    if (action === "create-checkout") {
      const priceId = PRICES[plan];
      if (!priceId) throw new Error(`Invalid plan: ${plan}`);

      // Look up or create Stripe customer
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId: string | undefined;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }

      const origin = req.headers.get("origin") || "https://id-preview--c61db60d-9395-47a5-a12f-fab9aa279a04.lovable.app";

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${origin}/dashboard/settings?checkout=success`,
        cancel_url: `${origin}/dashboard/settings?checkout=cancel`,
        metadata: { user_id: user.id, plan },
      });

      logStep("Checkout session created", { sessionId: session.id });
      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create-portal") {
      // Get stripe_customer_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single();

      if (!profile?.stripe_customer_id) throw new Error("No Stripe customer found");

      const origin = req.headers.get("origin") || "https://id-preview--c61db60d-9395-47a5-a12f-fab9aa279a04.lovable.app";
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${origin}/dashboard/settings`,
      });

      logStep("Portal session created");
      return new Response(JSON.stringify({ url: portalSession.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
