import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const log = (step: string, details?: any) => {
  console.log(`[STRIPE-WEBHOOK] ${step}`, details ? JSON.stringify(details) : "");
};

// Versões recentes da API Stripe (billing flexível) movem
// current_period_start/end do nível da assinatura pro nível de cada item de
// cobrança (subscription.items.data[].current_period_start/end) — o campo no
// nível principal vem undefined. new Date(undefined * 1000).toISOString()
// lança "Invalid time value" e derruba o webhook inteiro (era exatamente o
// erro reportado pela Stripe: 100% de falha em customer.subscription.updated,
// bloqueando renovação de créditos de clientes reais). Tenta os dois lugares;
// sem nenhum, retorna null em vez de quebrar a entrega do evento.
function getSubscriptionPeriod(subscription: Stripe.Subscription): { start: number | null; end: number | null } {
  const item = subscription.items?.data?.[0] as any;
  const start = (subscription as any).current_period_start ?? item?.current_period_start ?? null;
  const end = (subscription as any).current_period_end ?? item?.current_period_end ?? null;
  return { start, end };
}

function toIsoOrNull(unixSeconds: number | null): string | null {
  return typeof unixSeconds === "number" && Number.isFinite(unixSeconds)
    ? new Date(unixSeconds * 1000).toISOString()
    : null;
}

async function provisionBalances(userId: string, plan: any) {
  log("Provisioning balances", { userId, planSlug: plan.slug });

  // Preserve portrait_credits_extra (purchased separately)
  const { data: currentBalance } = await supabase
    .from("user_balances")
    .select("portrait_credits_extra")
    .eq("user_id", userId)
    .single();

  await supabase.from("user_balances").upsert(
    {
      user_id: userId,
      weekly_cycles: plan.weekly_cycles,
      reanalysis_credits: plan.reanalysis_credits,
      portrait_credits_included: plan.portrait_credits,
      portrait_credits_extra: currentBalance?.portrait_credits_extra ?? 0,
      regeneration_credits: plan.regeneration_credits,
    },
    { onConflict: "user_id" }
  );

  const creditTypes = [
    { type: "weekly_cycle", amount: plan.weekly_cycles },
    { type: "reanalysis", amount: plan.reanalysis_credits },
    { type: "portrait", amount: plan.portrait_credits },
    { type: "regeneration", amount: plan.regeneration_credits },
  ];

  for (const ct of creditTypes) {
    if (ct.amount > 0) {
      await supabase.from("credit_logs").insert({
        user_id: userId,
        credit_type: ct.type,
        amount: ct.amount,
        description: `Provisionamento do plano ${plan.name}`,
      });
    }
  }
}

async function handlePortraitPackPurchase(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const packCredits = parseInt(session.metadata?.pack_credits || "0", 10);
  const packId = session.metadata?.pack_id;

  if (!userId || !packCredits) {
    log("Portrait pack: missing metadata", session.metadata);
    return;
  }

  const { data: currentBalance } = await supabase
    .from("user_balances")
    .select("portrait_credits_extra")
    .eq("user_id", userId)
    .single();

  const currentExtra = currentBalance?.portrait_credits_extra ?? 0;

  await supabase.from("user_balances").upsert(
    {
      user_id: userId,
      portrait_credits_extra: currentExtra + packCredits,
    },
    { onConflict: "user_id" }
  );

  await supabase.from("credit_logs").insert({
    user_id: userId,
    credit_type: "portrait_extra",
    amount: packCredits,
    description: `Compra de pacote de retratos (${packCredits} créditos)`,
  });

  log("Portrait pack purchased", { userId, packCredits, packId });
}

async function handleSemanaExtra(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  if (!userId) {
    log("Semana extra: missing user_id", session.metadata);
    return;
  }

  const { data: currentBalance } = await supabase
    .from("user_balances")
    .select("weekly_cycles")
    .eq("user_id", userId)
    .single();

  const currentCycles = currentBalance?.weekly_cycles ?? 0;

  await supabase.from("user_balances").upsert(
    {
      user_id: userId,
      weekly_cycles: currentCycles + 1,
    },
    { onConflict: "user_id" }
  );

  await supabase.from("credit_logs").insert({
    user_id: userId,
    credit_type: "weekly_cycle",
    amount: 1,
    description: "Compra de semana extra de conteúdo",
  });

  log("Semana extra purchased", { userId });
}

async function handleUpgrade(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const toPlan = session.metadata?.to_plan;

  if (!userId || !toPlan) {
    log("Upgrade: missing metadata", session.metadata);
    return;
  }

  const { data: targetPlan } = await supabase
    .from("plans")
    .select("*")
    .eq("slug", toPlan)
    .eq("active", true)
    .single();

  if (!targetPlan) {
    log("Upgrade: target plan not found", { toPlan });
    return;
  }

  // Update subscription record
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  const subscriptionData: any = {
    user_id: userId,
    plan_id: targetPlan.id,
    stripe_customer_id: session.customer as string,
    status: "active",
    current_period_start: new Date().toISOString(),
  };

  if (session.mode === "subscription") {
    subscriptionData.stripe_subscription_id = session.subscription as string;
  }

  if (existingSub) {
    await supabase
      .from("subscriptions")
      .update(subscriptionData)
      .eq("id", existingSub.id);
  } else {
    await supabase.from("subscriptions").insert(subscriptionData);
  }

  await provisionBalances(userId, targetPlan);
  log("Upgrade completed", { userId, toPlan });
}

serve(async (req) => {
  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    let event: Stripe.Event;
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (webhookSecret && sig) {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }

    log("Event received", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metaType = session.metadata?.type;

        if (metaType === "portrait_pack") {
          await handlePortraitPackPurchase(session);
          break;
        }

        if (metaType === "semana_extra") {
          await handleSemanaExtra(session);
          break;
        }

        if (metaType === "upgrade") {
          await handleUpgrade(session);
          break;
        }

        // Default: plan purchase
        const userId = session.metadata?.user_id;
        const planSlug = session.metadata?.plan_slug;
        const planId = session.metadata?.plan_id;

        if (!userId || !planSlug || !planId) {
          log("Missing metadata", session.metadata);
          break;
        }

        const { data: plan } = await supabase
          .from("plans")
          .select("*")
          .eq("id", planId)
          .single();

        if (!plan) {
          log("Plan not found", { planId });
          break;
        }

        const subscriptionData: any = {
          user_id: userId,
          plan_id: planId,
          stripe_customer_id: session.customer as string,
          status: "active",
          current_period_start: new Date().toISOString(),
        };

        if (plan.billing_type === "one_time") {
          subscriptionData.stripe_subscription_id = null;
          subscriptionData.current_period_end = null;
        } else {
          subscriptionData.stripe_subscription_id = session.subscription as string;
        }

        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .limit(1)
          .single();

        if (existingSub) {
          await supabase
            .from("subscriptions")
            .update(subscriptionData)
            .eq("id", existingSub.id);
        } else {
          await supabase.from("subscriptions").insert(subscriptionData);
        }

        await provisionBalances(userId, plan);
        log("Checkout completed", { userId, planSlug });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("*, plans(*)")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (!sub) {
          log("Subscription not found for invoice", { subscriptionId });
          break;
        }

        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        const invoicePeriod = getSubscriptionPeriod(stripeSubscription);
        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            current_period_start: toIsoOrNull(invoicePeriod.start),
            current_period_end: toIsoOrNull(invoicePeriod.end),
          })
          .eq("id", sub.id);

        if (sub.plans) {
          await provisionBalances(sub.user_id, sub.plans);
        }

        log("Invoice paid, credits reprovisioned", { userId: sub.user_id });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);

        log("Subscription canceled", { subscriptionId: subscription.id });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const status = subscription.status === "active" ? "active" : subscription.status === "past_due" ? "past_due" : subscription.status;
        const updatedPeriod = getSubscriptionPeriod(subscription);

        await supabase
          .from("subscriptions")
          .update({
            status,
            current_period_start: toIsoOrNull(updatedPeriod.start),
            current_period_end: toIsoOrNull(updatedPeriod.end),
          })
          .eq("stripe_subscription_id", subscription.id);

        log("Subscription updated", { subscriptionId: subscription.id, status });
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
