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

async function provisionBalances(userId: string, plan: any) {
  log("Provisioning balances", { userId, planSlug: plan.slug });

  await supabase.from("user_balances").upsert(
    {
      user_id: userId,
      weekly_cycles: plan.weekly_cycles,
      reanalysis_credits: plan.reanalysis_credits,
      portrait_credits_included: plan.portrait_credits,
      regeneration_credits: plan.regeneration_credits,
    },
    { onConflict: "user_id" }
  );

  // Log the provisioning
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

async function getUserIdFromCustomerEmail(customerEmail: string): Promise<string | null> {
  const { data } = await supabase.auth.admin.listUsers();
  const user = data?.users?.find((u: any) => u.email === customerEmail);
  return user?.id || null;
}

serve(async (req) => {
  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    // For now, parse the event directly (webhook secret can be added later)
    let event: Stripe.Event;
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }

    log("Event received", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const planSlug = session.metadata?.plan_slug;
        const planId = session.metadata?.plan_id;

        if (!userId || !planSlug || !planId) {
          log("Missing metadata", session.metadata);
          break;
        }

        // Fetch plan details
        const { data: plan } = await supabase
          .from("plans")
          .select("*")
          .eq("id", planId)
          .single();

        if (!plan) {
          log("Plan not found", { planId });
          break;
        }

        // Create/update subscription
        const subscriptionData: any = {
          user_id: userId,
          plan_id: planId,
          stripe_customer_id: session.customer as string,
          status: "active",
          current_period_start: new Date().toISOString(),
        };

        if (plan.billing_type === "one_time") {
          // One-time: no end date, no stripe_subscription_id
          subscriptionData.stripe_subscription_id = null;
          subscriptionData.current_period_end = null;
        } else {
          subscriptionData.stripe_subscription_id = session.subscription as string;
          // End date will be updated by invoice.paid
        }

        // Upsert: if user already has a subscription, update it
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

        // Provision balances
        await provisionBalances(userId, plan);

        log("Checkout completed", { userId, planSlug });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        // Find the subscription in our DB
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("*, plans(*)")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (!sub) {
          log("Subscription not found for invoice", { subscriptionId });
          break;
        }

        // Update period
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          })
          .eq("id", sub.id);

        // Re-provision monthly credits
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

        await supabase
          .from("subscriptions")
          .update({
            status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
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
