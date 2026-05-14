// ============================================================
// LGPD — Solicitação de exclusão de conta
// TODO: configurar envio de email para contato@posiciona.ia.br
// quando canal de email (Resend ou similar) estiver disponível.
// Por ora a solicitação é registrada na tabela account_deletion_requests
// e o admin a visualiza em /admin/exclusoes-lgpd.
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("User not authenticated");
    const user = userData.user;
    const email = user.email ?? "";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("profession, niche")
      .eq("user_id", user.id)
      .maybeSingle();

    const { error: insertErr } = await supabaseAdmin
      .from("account_deletion_requests")
      .insert({
        user_id: user.id,
        email,
        profession: profile?.profession ?? null,
        niche: profile?.niche ?? null,
      });
    if (insertErr) throw insertErr;

    await supabaseAdmin
      .from("profiles")
      .update({ account_deletion_requested_at: new Date().toISOString() })
      .eq("user_id", user.id);

    // TODO: enviar email para contato@posiciona.ia.br quando canal disponível.

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("delete-account-request error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
