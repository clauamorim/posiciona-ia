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

/**
 * Extrai a URL do .safetensors da LoRA do payload da Fal.
 * O trainer fal-ai/flux-lora-portrait-trainer retorna:
 *   { diffusers_lora_file: { url, file_name, ... }, config_file: {...} }
 * Mantemos fallback pro shape antigo (Replicate) por se um webhook em voo chegar
 * durante a transição.
 */
function extractLoraUrl(output: any): string | null {
  if (!output || typeof output !== "object") return null;
  // Fal portrait trainer
  if (output.diffusers_lora_file?.url) return output.diffusers_lora_file.url;
  // Replicate (legacy, idempotência durante migração)
  if (typeof output.weights === "string") return output.weights;
  if (typeof output.version === "string") return output.version;
  return null;
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
    // Fal envia { request_id, gateway_request_id, status: "OK"|"ERROR", payload, error? }
    // Replicate envia { status: "succeeded"|"failed"|"canceled", output, error }
    // Detectamos o shape e normalizamos.
    const isFal = "request_id" in payload || "gateway_request_id" in payload;
    let normalizedStatus: "succeeded" | "failed" | "other";
    let output: any = null;
    let error: any = null;

    if (isFal) {
      const falStatus = String(payload?.status ?? "").toUpperCase();
      output = payload?.payload ?? null;
      error = payload?.error ?? null;
      if (falStatus === "OK") normalizedStatus = "succeeded";
      else if (falStatus === "ERROR") normalizedStatus = "failed";
      else normalizedStatus = "other";
    } else {
      const repStatus = String(payload?.status ?? "");
      output = payload?.output ?? null;
      error = payload?.error ?? null;
      if (repStatus === "succeeded") normalizedStatus = "succeeded";
      else if (repStatus === "failed" || repStatus === "canceled") normalizedStatus = "failed";
      else normalizedStatus = "other";
    }

    console.log(`[portrait-webhook] training=${trainingId} provider=${isFal ? "fal" : "replicate"} status=${normalizedStatus}`);

    const { data: training } = await supabaseAdmin
      .from("portrait_trainings")
      .select("id, user_id, was_free, status")
      .eq("id", trainingId)
      .single();

    if (!training) {
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }

    if (normalizedStatus === "succeeded") {
      const loraUrl = extractLoraUrl(output);
      if (!loraUrl) {
        console.error(`[portrait-webhook] training=${trainingId} succeeded but no LoRA URL in output:`, JSON.stringify(output).slice(0, 400));
        await supabaseAdmin
          .from("portrait_trainings")
          .update({ status: "failed", error_message: "no-lora-url-in-output", completed_at: new Date().toISOString() })
          .eq("id", trainingId);
      } else {
        await supabaseAdmin
          .from("portrait_trainings")
          .update({
            status: "ready",
            lora_weights_url: loraUrl,
            completed_at: new Date().toISOString(),
          })
          .eq("id", trainingId);
        console.log(`[portrait-webhook] training=${trainingId} READY lora=${loraUrl.slice(0, 80)}`);
      }
    } else if (normalizedStatus === "failed") {
      await supabaseAdmin
        .from("portrait_trainings")
        .update({
          status: "failed",
          error_message: typeof error === "string" ? error.slice(0, 500) : JSON.stringify(error).slice(0, 500),
          completed_at: new Date().toISOString(),
        })
        .eq("id", trainingId);

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
