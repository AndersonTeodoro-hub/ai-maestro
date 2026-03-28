import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TG1KaKg016ceaDVbTqFq1CW": "starter",
  "price_1TG1NMKg016ceaDVQFtsygnH": "pro",
};

const PLAN_CREDITS: Record<string, number> = {
  free: 10,
  starter: 150,
  pro: 500,
};

const PACK_CREDITS: Record<string, number> = {
  "price_1TG1OiKg016ceaDVYWhCa8st": 50,
  "price_1TG1QCKg016ceaDVLsAC6Za1": 150,
  "price_1TG1RUKg016ceaDVKYrWhI6V": 400,
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? " - " + JSON.stringify(details) : ""}`);
};

serve(async (req) => {
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey || !webhookSecret) throw new Error("Missing Stripe secrets");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No stripe-signature header");

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    logStep("Event received", { type: event.type, id: event.id });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // ── Subscription checkout completed ────────────────────────────────────────
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan;
      const pack = session.metadata?.pack;
      const customerId = session.customer as string;

      if (!userId) { logStep("No user_id in metadata"); return new Response(JSON.stringify({ received: true })); }

      if (plan && session.mode === "subscription") {
        // Subscription purchase
        const credits = PLAN_CREDITS[plan] ?? 10;
        await supabase.from("profiles").update({
          plan,
          stripe_customer_id: customerId,
          credits_balance: credits,
        }).eq("id", userId);
        await supabase.from("credit_transactions").insert({
          user_id: userId, amount: credits, type: "purchase",
          description: `Subscrição ${plan} — ${credits} créditos`,
          stripe_session_id: session.id,
        });
        logStep("Subscription activated", { userId, plan, credits });
      }

      if (pack && session.mode === "payment") {
        // Credit pack purchase
        const packCredits = parseInt(session.metadata?.credits || "0");
        const { data: profile } = await supabase.from("profiles")
          .select("credits_balance").eq("id", userId).single();
        const newBalance = (profile?.credits_balance ?? 0) + packCredits;
        await supabase.from("profiles").update({
          stripe_customer_id: customerId,
          credits_balance: newBalance,
        }).eq("id", userId);
        await supabase.from("credit_transactions").insert({
          user_id: userId, amount: packCredits, type: "purchase",
          description: `Pack ${pack} — ${packCredits} créditos`,
          stripe_session_id: session.id,
        });
        logStep("Credit pack purchased", { userId, pack, packCredits, newBalance });
      }
    }

    // ── Subscription updated (plan change) ────────────────────────────────────
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price.id;
      const plan = PRICE_TO_PLAN[priceId] || "free";
      const credits = PLAN_CREDITS[plan] ?? 10;

      const { data: profiles } = await supabase.from("profiles")
        .select("id").eq("stripe_customer_id", customerId).limit(1);

      if (profiles?.length) {
        const userId = profiles[0].id;
        await supabase.from("profiles").update({ plan, credits_balance: credits }).eq("id", userId);
        await supabase.from("credit_transactions").insert({
          user_id: userId, amount: credits, type: "purchase",
          description: `Mudança/renovação plano ${plan} — ${credits} créditos`,
        });
        logStep("Subscription updated", { customerId, plan, credits });
      }
    }

    // ── Subscription deleted → free ────────────────────────────────────────────
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const { data: profiles } = await supabase.from("profiles")
        .select("id").eq("stripe_customer_id", customerId).limit(1);

      if (profiles?.length) {
        const userId = profiles[0].id;
        await supabase.from("profiles").update({ plan: "free", credits_balance: 10 }).eq("id", userId);
        await supabase.from("credit_transactions").insert({
          user_id: userId, amount: 10, type: "bonus",
          description: "Downgrade para free — 10 créditos gratuitos",
        });
        logStep("Downgraded to free", { customerId });
      }
    }

    // ── Invoice paid (monthly renewal) ────────────────────────────────────────
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.billing_reason === "subscription_cycle") {
        const customerId = invoice.customer as string;
        const { data: profiles } = await supabase.from("profiles")
          .select("id, plan").eq("stripe_customer_id", customerId).limit(1);

        if (profiles?.length) {
          const { id: userId, plan } = profiles[0];
          const credits = PLAN_CREDITS[plan] ?? 10;
          await supabase.from("profiles").update({ credits_balance: credits }).eq("id", userId);
          await supabase.from("credit_transactions").insert({
            user_id: userId, amount: credits, type: "purchase",
            description: `Renovação mensal ${plan} — ${credits} créditos`,
          });
          logStep("Monthly renewal", { customerId, plan, credits });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
