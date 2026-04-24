import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const trainingId = url.searchParams.get("training_id");
    const token = url.searchParams.get("token");
    const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");

    if (!trainingId || !token || !WEBHOOK_SECRET) {
      return new Response("Bad Request", { status: 400, headers: corsHeaders });
    }
    const expected = await hmacHex(WEBHOOK_SECRET, trainingId);
    if (!safeEqual(expected, token)) {
      console.warn(`[portrait-webhook] invalid token for training=${trainingId}`);
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = await req.json().catch(() => ({}));
    const status = String(payload?.status ?? "");
    const output = payload?.output ?? null;
    const error = payload?.error ?? null;

    console.log(`[portrait-webhook] training=${trainingId} replicate_status=${status}`);

    const { data: training } = await supabaseAdmin
      .from("portrait_trainings")
      .select("id, user_id, was_free, status")
      .eq("id", trainingId)
      .single();

    if (!training) {
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }

    if (status === "succeeded") {
      // Replicate trainer returns { weights: "https://...tar", version: "owner/name:hash" } in output
      const weights = output?.weights ?? null;
      const version = output?.version ?? null;
      await supabaseAdmin
        .from("portrait_trainings")
        .update({
          status: "ready",
          lora_weights_url: version || weights,
          completed_at: new Date().toISOString(),
        })
        .eq("id", trainingId);
      console.log(`[portrait-webhook] training=${trainingId} READY weights=${(version || weights || "").slice(0, 80)}`);
    } else if (status === "failed" || status === "canceled") {
      await supabaseAdmin
        .from("portrait_trainings")
        .update({
          status: "failed",
          error_message: typeof error === "string" ? error.slice(0, 500) : JSON.stringify(error).slice(0, 500),
          completed_at: new Date().toISOString(),
        })
        .eq("id", trainingId);

      // Refund credits if it wasn't free
      if (!training.was_free) {
        const { data: bal } = await supabaseAdmin
          .from("user_balances")
          .select("portrait_credits_extra")
          .eq("user_id", training.user_id)
          .single();
        await supabaseAdmin
          .from("user_balances")
          .update({ portrait_credits_extra: (bal?.portrait_credits_extra ?? 0) + 4 })
          .eq("user_id", training.user_id);
        await supabaseAdmin.from("credit_logs").insert({
          user_id: training.user_id,
          credit_type: "portrait",
          amount: 4,
          description: `Reembolso de treino falho (${trainingId})`,
        });
      }
      console.log(`[portrait-webhook] training=${trainingId} FAILED — refunded=${!training.was_free}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[portrait-webhook] error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
