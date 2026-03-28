import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Subscription plans
const SUBSCRIPTION_PRICES: Record<string, string> = {
  starter: "price_1TG1KaKg016ceaDVbTqFq1CW",
  pro: "price_1TG1NMKg016ceaDVQFtsygnH",
};

// One-time credit packs
const CREDIT_PACK_PRICES: Record<string, string> = {
  pack_s: "price_1TG1OiKg016ceaDVYWhCa8st",
  pack_m: "price_1TG1QCKg016ceaDVLsAC6Za1",
  pack_l: "price_1TG1RUKg016ceaDVKYrWhI6V",
};

// Credits granted per pack
const PACK_CREDITS: Record<string, number> = {
  pack_s: 50,
  pack_m: 150,
  pack_l: 400,
};

// Credits granted per subscription plan (monthly)
const PLAN_CREDITS: Record<string, number> = {
  free: 10,
  starter: 150,
  pro: 500,
};

const logStep = (step: string, details?: unknown) => {
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
    const { action, plan, pack } = body;

    // Look up or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://savvyowl.vercel.app";

    // ── Subscription checkout ──────────────────────────────────────────────────
    if (action === "create-checkout") {
      const priceId = SUBSCRIPTION_PRICES[plan];
      if (!priceId) throw new Error(`Invalid plan: ${plan}`);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${origin}/dashboard/settings?checkout=success`,
        cancel_url: `${origin}/dashboard/settings?checkout=cancel`,
        metadata: { user_id: user.id, plan },
      });

      logStep("Subscription checkout created", { sessionId: session.id, plan });
      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Credit pack checkout ───────────────────────────────────────────────────
    if (action === "buy-credits") {
      const priceId = CREDIT_PACK_PRICES[pack];
      if (!priceId) throw new Error(`Invalid pack: ${pack}`);

      const credits = PACK_CREDITS[pack];
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "payment",
        success_url: `${origin}/dashboard/settings?checkout=success&credits=${credits}`,
        cancel_url: `${origin}/dashboard/settings?checkout=cancel`,
        metadata: { user_id: user.id, pack, credits: String(credits) },
      });

      logStep("Credit pack checkout created", { sessionId: session.id, pack, credits });
      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Customer portal ────────────────────────────────────────────────────────
    if (action === "create-portal") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single();

      if (!profile?.stripe_customer_id) throw new Error("No Stripe customer found");

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
