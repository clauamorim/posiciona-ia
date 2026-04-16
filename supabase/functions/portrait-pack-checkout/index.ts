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
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { pack_id } = await req.json();
    if (!pack_id) throw new Error("pack_id is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: pack, error: packError } = await supabaseAdmin
      .from("portrait_packs")
      .select("*")
      .eq("id", pack_id)
      .eq("active", true)
      .single();

    if (packError || !pack) throw new Error("Pack not found");

    // Get user's active plan to determine tiered pricing
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let priceId = pack.stripe_price_id; // default price

    if (sub) {
      const { data: plan } = await supabaseAdmin
        .from("plans")
        .select("slug")
        .eq("id", sub.plan_id)
        .single();

      if (plan?.slug && pack.stripe_price_ids && typeof pack.stripe_price_ids === "object") {
        const tierPrice = (pack.stripe_price_ids as Record<string, string>)[plan.slug];
        if (tierPrice) {
          priceId = tierPrice;
        }
      }
    }

    if (!priceId) throw new Error("Pack has no Stripe price configured");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://posiciona.ia.br";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/portraits`,
      metadata: {
        user_id: user.id,
        type: "portrait_pack",
        pack_id: pack.id,
        pack_credits: String(pack.credits),
      },
      custom_text: {
        submit: {
          message: "Pagamento processado pela Stripe. Termos e privacidade em posiciona.ia.br",
        },
      },
      consent_collection: {
        terms_of_service: "required",
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
