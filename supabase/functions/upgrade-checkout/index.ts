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

// Upgrade prices (one-time, with R$197 discount applied within 7 days)
const UPGRADE_PRICES: Record<string, string> = {
  presenca_mensal: "price_1TLs1lCzHWisuWdYvQkurROV",   // R$ 100
  autoridade_total: "price_1TLs31CzHWisuWdY4Xeop1ag",  // R$ 300
};

// Normal subscription prices (for upgrades after 7 days)
const NORMAL_PRICES: Record<string, string> = {
  presenca_mensal: "price_1TJq2KCzHWisuWdYr9Bs21qI",
  autoridade_total: "price_1TJq35CzHWisuWdYwABQJNVc",
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

    const { target_plan } = await req.json();
    if (!target_plan || !["presenca_mensal", "autoridade_total"].includes(target_plan)) {
      throw new Error("target_plan inválido");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get current subscription
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("*, plans(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) throw new Error("Nenhum plano ativo encontrado");

    const currentSlug = (sub as any).plans?.slug;

    // Validate upgrade path
    if (currentSlug === "autoridade_total") {
      throw new Error("Você já está no plano mais completo");
    }

    if (currentSlug === "presenca_mensal" && target_plan === "presenca_mensal") {
      throw new Error("Você já está neste plano");
    }

    // For Presença → Autoridade: use Stripe subscription update with proration
    if (currentSlug === "presenca_mensal" && target_plan === "autoridade_total") {
      if (!sub.stripe_subscription_id) {
        throw new Error("Assinatura Stripe não encontrada para upgrade");
      }

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      const currentItemId = stripeSubscription.items.data[0]?.id;
      if (!currentItemId) throw new Error("Item de assinatura não encontrado");

      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        items: [
          { id: currentItemId, deleted: true },
          { price: NORMAL_PRICES.autoridade_total },
        ],
        proration_behavior: "always_invoice",
      });

      // Get target plan
      const { data: targetPlan } = await supabaseAdmin
        .from("plans")
        .select("*")
        .eq("slug", "autoridade_total")
        .eq("active", true)
        .single();

      if (targetPlan) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ plan_id: targetPlan.id })
          .eq("id", sub.id);

        // Provision new balances (additive for extras)
        const { data: currentBalance } = await supabaseAdmin
          .from("user_balances")
          .select("portrait_credits_extra")
          .eq("user_id", user.id)
          .single();

        await supabaseAdmin.from("user_balances").upsert(
          {
            user_id: user.id,
            weekly_cycles: targetPlan.weekly_cycles,
            reanalysis_credits: targetPlan.reanalysis_credits,
            portrait_credits_included: targetPlan.portrait_credits,
            portrait_credits_extra: currentBalance?.portrait_credits_extra ?? 0,
            regeneration_credits: targetPlan.regeneration_credits,
          },
          { onConflict: "user_id" }
        );
      }

      return new Response(JSON.stringify({ success: true, message: "Upgrade realizado com sucesso! A diferença será cobrada proporcionalmente." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // For Semana de Conteúdo → upgrade
    if (currentSlug !== "semana_conteudo") {
      throw new Error("Upgrade inválido para o plano atual");
    }

    // Check if within 7 days of purchase
    const purchaseDate = new Date(sub.created_at);
    const now = new Date();
    const daysSincePurchase = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
    const withinDiscount = daysSincePurchase <= 7;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://posiciona.ia.br";

    let sessionParams: any;

    if (withinDiscount) {
      // One-time payment with discounted price (R$197 already deducted)
      sessionParams = {
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: UPGRADE_PRICES[target_plan], quantity: 1 }],
        mode: "payment",
        success_url: `${origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/dashboard`,
        metadata: {
          user_id: user.id,
          type: "upgrade",
          from_plan: currentSlug,
          to_plan: target_plan,
        },
      };
    } else {
      // Normal subscription checkout (no discount)
      sessionParams = {
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: NORMAL_PRICES[target_plan], quantity: 1 }],
        mode: "subscription",
        success_url: `${origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/dashboard`,
        metadata: {
          user_id: user.id,
          type: "upgrade",
          from_plan: currentSlug,
          to_plan: target_plan,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

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
