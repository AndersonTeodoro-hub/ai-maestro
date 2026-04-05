// stripe-checkout — uses Stripe REST API directly (no SDK, no external imports)
// This approach works with Supabase Management API deployment

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUBSCRIPTION_PRICES: Record<string, string> = {
  starter: "price_1TG1KaKg016ceaDVbTqFq1CW",
  pro: "price_1TG1NMKg016ceaDVQFtsygnH",
  studio: "price_1TIfPOKg016ceaDVBGyj6Kgw",
};

const CREDIT_PACK_PRICES: Record<string, string> = {
  pack_s: "price_1TG1OiKg016ceaDVYWhCa8st",
  pack_m: "price_1TG1QCKg016ceaDVLsAC6Za1",
  pack_l: "price_1TG1RUKg016ceaDVKYrWhI6V",
};

const PACK_CREDITS: Record<string, number> = {
  pack_s: 15,
  pack_m: 45,
  pack_l: 120,
};

// Stripe REST API helper
async function stripePost(path: string, data: Record<string, string>, apiKey: string) {
  const body = new URLSearchParams(data).toString();
  const resp = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  return resp.json();
}

async function stripeGet(path: string, params: Record<string, string>, apiKey: string) {
  const qs = new URLSearchParams(params).toString();
  const resp = await fetch(`https://api.stripe.com/v1/${path}?${qs}`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
  return resp.json();
}

// Supabase auth helper
async function getUser(authHeader: string, supabaseUrl: string, serviceKey: string) {
  const token = authHeader.replace("Bearer ", "");
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "apikey": serviceKey,
    },
  });
  if (!resp.ok) return null;
  return resp.json();
}

async function getProfile(userId: string, supabaseUrl: string, serviceKey: string) {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=stripe_customer_id`,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!stripeKey) return json({ error: "Stripe not configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "No auth" }, 401);

    const user = await getUser(authHeader, supabaseUrl, serviceKey);
    if (!user?.email) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action, plan, pack } = body;
    const origin = req.headers.get("origin") ?? "https://savvyowl.app";

    // Find existing Stripe customer
    const custSearch = await stripeGet("customers", { email: user.email, limit: "1" }, stripeKey);
    const customerId = custSearch.data?.[0]?.id ?? "";

    if (action === "create-checkout") {
      const priceId = SUBSCRIPTION_PRICES[plan];
      if (!priceId) return json({ error: `Plano inválido: ${plan}` }, 400);

      const sessionData: Record<string, string> = {
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "mode": "subscription",
        "success_url": `${origin}/dashboard/settings?checkout=success`,
        "cancel_url": `${origin}/dashboard/settings?checkout=cancel`,
        "metadata[user_id]": user.id,
        "metadata[plan]": plan,
      };
      if (customerId) {
        sessionData["customer"] = customerId;
      } else {
        sessionData["customer_email"] = user.email;
      }

      const session = await stripePost("checkout/sessions", sessionData, stripeKey);
      console.log(`[CHECKOUT] ${plan} session: ${session.id}`);
      return json({ url: session.url });
    }

    if (action === "buy-credits") {
      const priceId = CREDIT_PACK_PRICES[pack];
      if (!priceId) return json({ error: `Pack inválido: ${pack}` }, 400);
      const credits = PACK_CREDITS[pack];

      const sessionData: Record<string, string> = {
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "mode": "payment",
        "success_url": `${origin}/dashboard/settings?checkout=success&credits=${credits}`,
        "cancel_url": `${origin}/dashboard/settings?checkout=cancel`,
        "metadata[user_id]": user.id,
        "metadata[pack]": pack,
        "metadata[credits]": String(credits),
      };
      if (customerId) {
        sessionData["customer"] = customerId;
      } else {
        sessionData["customer_email"] = user.email;
      }

      const session = await stripePost("checkout/sessions", sessionData, stripeKey);
      console.log(`[CHECKOUT] pack=${pack} credits=${credits} session: ${session.id}`);
      return json({ url: session.url });
    }

    if (action === "create-portal") {
      const profile = await getProfile(user.id, supabaseUrl, serviceKey);
      if (!profile?.stripe_customer_id) return json({ error: "Sem conta Stripe" }, 400);

      const portal = await stripePost("billing_portal/sessions", {
        "customer": profile.stripe_customer_id,
        "return_url": `${origin}/dashboard/settings`,
      }, stripeKey);
      return json({ url: portal.url });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error("[CHECKOUT] Error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
