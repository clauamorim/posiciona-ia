// ============================================================
// STRIPE DASHBOARD CONFIGURATION REQUIRED:
// Settings > Public details:
//   - Terms of Service URL: https://posiciona.ia.br/termos-de-servico
//   - Privacy Policy URL: https://posiciona.ia.br/politica-de-privacidade
//   - Support email: contato@posiciona.ia.br
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { plan_slug, coupon_code } = await req.json();
    if (!plan_slug) throw new Error("plan_slug is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: plan, error: planError } = await supabaseAdmin
      .from("plans")
      .select("*")
      .eq("slug", plan_slug)
      .eq("active", true)
      .single();

    if (planError || !plan) throw new Error("Plan not found");
    if (!plan.stripe_price_id) throw new Error("Plan has no Stripe price configured");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const mode = plan.billing_type === "one_time" ? "payment" : "subscription";
    const origin = req.headers.get("origin") || "https://posiciona.ia.br";

    // Build session params
    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      mode,
      success_url: `${origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/choose-plan`,
      metadata: {
        user_id: user.id,
        plan_slug: plan.slug,
        plan_id: plan.id,
      },
      custom_text: {
        submit: {
          message: "Pagamento processado pela Stripe. Termos e privacidade em posiciona.ia.br",
        },
      },
    };

    // Apply coupon for recurring plans only
    if (coupon_code && mode === "subscription") {
      const coupons = await stripe.coupons.list({ limit: 100 });
      const coupon = coupons.data.find(
        (c) => c.name?.toUpperCase() === coupon_code.toUpperCase() && c.valid
      );
      if (coupon) {
        sessionParams.discounts = [{ coupon: coupon.id }];
      } else {
        throw new Error("Cupom inválido ou expirado");
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("stripe-checkout error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
