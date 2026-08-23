import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { corsHeaders } from "../_shared/cors.ts";

// Cancela toda assinatura não-cancelada e apaga o customer na Stripe antes
// de excluir a conta — senão a cobrança recorrente continua rodando pra
// sempre sem ninguém pra parar. Best-effort: falha na Stripe é logada mas
// não impede a exclusão da conta em si (a pessoa pediu pra sumir do banco;
// resolver cobrança pendente vira acompanhamento manual se a Stripe falhar).
async function cleanupStripeForUser(adminClient: any, userId: string, email: string | null | undefined) {
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) return;
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

  const { data: subs } = await adminClient
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId);

  const customerIds = new Set<string>((subs ?? []).map((s: any) => s.stripe_customer_id).filter(Boolean));

  if (customerIds.size === 0 && email) {
    const found = await stripe.customers.list({ email, limit: 5 });
    for (const c of found.data) customerIds.add(c.id);
  }

  for (const customerId of customerIds) {
    try {
      const allSubs = await stripe.subscriptions.list({ customer: customerId, limit: 100 });
      for (const sub of allSubs.data) {
        if (sub.status !== "canceled" && sub.status !== "incomplete_expired") {
          await stripe.subscriptions.cancel(sub.id);
        }
      }
      await stripe.customers.del(customerId);
    } catch (stripeErr) {
      console.error(`admin-manage-user: falha ao limpar Stripe do customer ${customerId} (user ${userId}):`, stripeErr);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await anonClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { action, userId, newPassword } = await req.json();

    if (!userId || !action) {
      return new Response(JSON.stringify({ error: "Missing action or userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set_password") {
      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
        return new Response(JSON.stringify({ error: "A senha deve ter ao menos 6 caracteres." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_user") {
      const { data: targetUser } = await adminClient.auth.admin.getUserById(userId);
      await cleanupStripeForUser(adminClient, userId, targetUser?.user?.email);

      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;

      // Fecha o(s) pedido(s) de exclusão LGPD deste usuário — sem isso ficam
      // marcados como pendentes pra sempre em /admin/exclusoes-lgpd mesmo
      // depois da conta já ter sido apagada de verdade.
      await adminClient
        .from("account_deletion_requests")
        .update({ processed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("processed_at", null);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "confirm_email") {
      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_users") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      const emailMap: Record<string, string> = {};
      const lastSignInMap: Record<string, string | null> = {};
      for (const u of users) {
        emailMap[u.id] = u.email || "";
        lastSignInMap[u.id] = u.last_sign_in_at || null;
      }
      return new Response(JSON.stringify({ emailMap, lastSignInMap }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
