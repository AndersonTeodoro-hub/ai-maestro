import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1T9oNWKg016ceaDVTLnC3PD7": "starter",
  "price_1T9oNrKg016ceaDVfoGdfk6W": "pro",
};

// Credits granted on subscription start/renewal
const PLAN_CREDITS: Record<string, number> = {
  free: 10,
  starter: 200,
  pro: 1000,
};

// One-time credit packs (price_id → credits)
const CREDIT_PACK_PRICES: Record<string, number> = {
  // Add your Stripe price IDs for credit packs here when created
  // "price_credits_50": 50,
  // "price_credits_200": 200,
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${d}`);
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

    // ── Checkout completed: subscription OR credit pack ────────────────────────
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan;
      const customerId = session.customer as string;

      if (userId) {
        if (plan) {
          // Subscription checkout
          const credits = PLAN_CREDITS[plan] ?? 0;
          await supabase
            .from("profiles")
            .update({ plan, stripe_customer_id: customerId, credits_balance: credits })
            .eq("id", userId);
          await supabase.from("credit_transactions").insert({
            user_id: userId,
            amount: credits,
            type: "purchase",
            description: `Subscrição ${plan} — ${credits} créditos`,
            stripe_session_id: session.id,
          });
          logStep("Subscription checkout complete", { userId, plan, credits });
        } else {
          // Credit pack checkout
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          let totalCredits = 0;
          for (const item of lineItems.data) {
            const priceId = item.price?.id || "";
            const creditsForPack = CREDIT_PACK_PRICES[priceId] ?? 0;
            totalCredits += creditsForPack * (item.quantity || 1);
          }
          if (totalCredits > 0) {
            const { data: p } = await supabase.from("profiles").select("credits_balance").eq("id", userId).single();
            const newBalance = (p?.credits_balance ?? 0) + totalCredits;
            await supabase.from("profiles").update({
              stripe_customer_id: customerId,
              credits_balance: newBalance,
              credits_total_purchased: supabase.rpc ? undefined : undefined, // handled below
            }).eq("id", userId);
            await supabase.from("credit_transactions").insert({
              user_id: userId,
              amount: totalCredits,
              type: "purchase",
              description: `Pack de ${totalCredits} créditos`,
              stripe_session_id: session.id,
            });
            logStep("Credit pack purchased", { userId, totalCredits, newBalance });
          }
        }
      }
    }

    // ── Subscription updated (plan change) ────────────────────────────────────
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price.id;
      const plan = PRICE_TO_PLAN[priceId] || "free";

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, credits_balance")
        .eq("stripe_customer_id", customerId)
        .limit(1);

      if (profiles && profiles.length > 0) {
        const userId = profiles[0].id;
        const credits = PLAN_CREDITS[plan] ?? 0;
        // On plan change, reset to new plan's credits (don't stack)
        await supabase.from("profiles").update({ plan, credits_balance: credits }).eq("id", userId);
        await supabase.from("credit_transactions").insert({
          user_id: userId,
          amount: credits,
          type: "purchase",
          description: `Renovação/mudança plano ${plan} — ${credits} créditos`,
        });
        logStep("Subscription updated", { customerId, plan, credits });
      }
    }

    // ── Subscription deleted → downgrade to free ───────────────────────────────
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .limit(1);

      if (profiles && profiles.length > 0) {
        const userId = profiles[0].id;
        await supabase.from("profiles").update({ plan: "free", credits_balance: PLAN_CREDITS.free }).eq("id", userId);
        await supabase.from("credit_transactions").insert({
          user_id: userId,
          amount: PLAN_CREDITS.free,
          type: "bonus",
          description: "Downgrade para free — créditos gratuitos",
        });
        logStep("Subscription deleted → free", { customerId });
      }
    }

    // ── Invoice paid (monthly renewal) ────────────────────────────────────────
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      // Only on recurring renewals (not the first invoice which is covered by checkout.completed)
      if (invoice.billing_reason === "subscription_cycle") {
        const customerId = invoice.customer as string;
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, plan")
          .eq("stripe_customer_id", customerId)
          .limit(1);

        if (profiles && profiles.length > 0) {
          const { id: userId, plan } = profiles[0];
          const credits = PLAN_CREDITS[plan] ?? 0;
          await supabase.from("profiles").update({ credits_balance: credits }).eq("id", userId);
          await supabase.from("credit_transactions").insert({
            user_id: userId,
            amount: credits,
            type: "purchase",
            description: `Renovação mensal ${plan} — ${credits} créditos`,
          });
          logStep("Monthly renewal — credits reset", { customerId, plan, credits });
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
