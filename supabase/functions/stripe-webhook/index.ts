// stripe-webhook — zero external imports, uses native Deno crypto for signature verification

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TG1KaKg016ceaDVbTqFq1CW": "starter",
  "price_1TG1NMKg016ceaDVQFtsygnH": "pro",
  "price_1TIfPOKg016ceaDVBGyj6Kgw": "studio",
};

const PLAN_CREDITS: Record<string, number> = {
  free: 10,
  starter: 60,
  pro: 180,
  studio: 500,
};

const log = (step: string, d?: unknown) =>
  console.log(`[WEBHOOK] ${step}${d ? " " + JSON.stringify(d) : ""}`);

// Stripe webhook signature verification using Web Crypto
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = sigHeader.split(",");
    const timestamp = parts.find(p => p.startsWith("t="))?.slice(2) ?? "";
    const sig = parts.find(p => p.startsWith("v1="))?.slice(3) ?? "";
    if (!timestamp || !sig) return false;

    const signed = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
    const computed = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    return computed === sig;
  } catch {
    return false;
  }
}

// Supabase REST helpers
async function updateProfile(userId: string, data: Record<string, unknown>, supabaseUrl: string, serviceKey: string) {
  return fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

async function getProfileByCustomer(customerId: string, supabaseUrl: string, serviceKey: string) {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/profiles?stripe_customer_id=eq.${customerId}&select=id,plan`,
    {
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
    }
  );
  const data = await resp.json();
  return data?.[0] ?? null;
}

async function insertTransaction(tx: Record<string, unknown>, supabaseUrl: string, serviceKey: string) {
  return fetch(`${supabaseUrl}/rest/v1/credit_transactions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tx),
  });
}

Deno.serve(async (req) => {
  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const body = await req.text();
    const sigHeader = req.headers.get("stripe-signature") ?? "";

    if (!await verifyStripeSignature(body, sigHeader, webhookSecret)) {
      log("Invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    const event = JSON.parse(body);
    log("Event", { type: event.type, id: event.id });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan;
      const pack = session.metadata?.pack;
      const credits = parseInt(session.metadata?.credits ?? "0");
      const customerId = session.customer;

      if (userId && plan && session.mode === "subscription") {
        const planCredits = PLAN_CREDITS[plan] ?? 10;
        await updateProfile(userId, { plan, stripe_customer_id: customerId, credits_balance: planCredits }, supabaseUrl, serviceKey);
        await insertTransaction({ user_id: userId, amount: planCredits, type: "purchase", description: `Subscrição ${plan} — ${planCredits} créditos`, stripe_session_id: session.id }, supabaseUrl, serviceKey);
        log("Subscription activated", { userId, plan, planCredits });
      }

      if (userId && pack && session.mode === "payment" && credits > 0) {
        // Get current balance
        const resp = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=credits_balance`, {
          headers: { "Authorization": `Bearer ${serviceKey}`, "apikey": serviceKey }
        });
        const profiles = await resp.json();
        const current = profiles?.[0]?.credits_balance ?? 0;
        const newBalance = current + credits;
        await updateProfile(userId, { credits_balance: newBalance, stripe_customer_id: customerId }, supabaseUrl, serviceKey);
        await insertTransaction({ user_id: userId, amount: credits, type: "purchase", description: `Pack ${pack} — ${credits} créditos`, stripe_session_id: session.id }, supabaseUrl, serviceKey);
        log("Credit pack purchased", { userId, pack, credits, newBalance });
      }
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const priceId = sub.items?.data?.[0]?.price?.id ?? "";
      const plan = PRICE_TO_PLAN[priceId] ?? "free";
      const credits = PLAN_CREDITS[plan] ?? 10;
      const profile = await getProfileByCustomer(sub.customer, supabaseUrl, serviceKey);
      if (profile) {
        await updateProfile(profile.id, { plan, credits_balance: credits }, supabaseUrl, serviceKey);
        await insertTransaction({ user_id: profile.id, amount: credits, type: "purchase", description: `Atualização plano ${plan}` }, supabaseUrl, serviceKey);
        log("Subscription updated", { plan, credits });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const profile = await getProfileByCustomer(event.data.object.customer, supabaseUrl, serviceKey);
      if (profile) {
        await updateProfile(profile.id, { plan: "free", credits_balance: 10 }, supabaseUrl, serviceKey);
        log("Downgraded to free", { userId: profile.id });
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      if (invoice.billing_reason === "subscription_cycle") {
        const profile = await getProfileByCustomer(invoice.customer, supabaseUrl, serviceKey);
        if (profile) {
          const credits = PLAN_CREDITS[profile.plan] ?? 10;
          await updateProfile(profile.id, { credits_balance: credits }, supabaseUrl, serviceKey);
          await insertTransaction({ user_id: profile.id, amount: credits, type: "purchase", description: `Renovação mensal ${profile.plan}` }, supabaseUrl, serviceKey);
          log("Monthly renewal", { plan: profile.plan, credits });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    log("ERROR", { msg: e instanceof Error ? e.message : String(e) });
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
