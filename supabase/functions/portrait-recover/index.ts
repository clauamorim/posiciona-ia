import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// Recupera um treino Fal cujo webhook não chegou: faz GET no status da request
// e, se concluído, grava lora_weights_url e marca status=ready.
const FAL_TRAINER_PATH = "fal-ai/flux-lora-portrait-trainer";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) {
      return new Response(JSON.stringify({ error: "FAL_KEY ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const trainingId: string | undefined = body.training_id;
    if (!trainingId) {
      return new Response(JSON.stringify({ error: "training_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega o treino e valida ownership (admin pode recuperar qualquer um)
    const { data: training, error: trainErr } = await supabaseAdmin
      .from("portrait_trainings")
      .select("id, user_id, status, replicate_training_id, lora_provider")
      .eq("id", trainingId)
      .single();

    if (trainErr || !training) {
      return new Response(JSON.stringify({ error: "Treino não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin check
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!adminRole;

    if (training.user_id !== user.id && !isAdmin) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (training.lora_provider !== "fal") {
      return new Response(JSON.stringify({ error: "Recuperação suporta apenas treinos Fal" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (training.status === "ready") {
      return new Response(JSON.stringify({ ok: true, already_ready: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestId = training.replicate_training_id;
    if (!requestId) {
      return new Response(JSON.stringify({ error: "request_id ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Status
    const statusUrl = `https://queue.fal.run/${FAL_TRAINER_PATH}/requests/${requestId}/status`;
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${FAL_KEY}` },
    });
    if (!statusRes.ok) {
      const txt = await statusRes.text();
      return new Response(
        JSON.stringify({ error: `fal-status-${statusRes.status}`, detail: txt.slice(0, 300) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const statusJson = await statusRes.json();
    const falStatus = String(statusJson?.status ?? "").toUpperCase();
    console.log(`[portrait-recover] training=${trainingId} fal_status=${falStatus}`);

    if (falStatus !== "COMPLETED" && falStatus !== "OK") {
      return new Response(
        JSON.stringify({ ok: false, status: falStatus, message: "Treino ainda não concluído" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Resultado
    const resultUrl = `https://queue.fal.run/${FAL_TRAINER_PATH}/requests/${requestId}`;
    const resultRes = await fetch(resultUrl, {
      headers: { Authorization: `Key ${FAL_KEY}` },
    });
    if (!resultRes.ok) {
      const txt = await resultRes.text();
      return new Response(
        JSON.stringify({ error: `fal-result-${resultRes.status}`, detail: txt.slice(0, 300) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const resultJson = await resultRes.json();
    const loraUrl: string | undefined = resultJson?.diffusers_lora_file?.url;

    if (!loraUrl) {
      console.error(`[portrait-recover] sem lora url no payload:`, JSON.stringify(resultJson).slice(0, 400));
      await supabaseAdmin
        .from("portrait_trainings")
        .update({
          status: "failed",
          error_message: "no-lora-url-in-recovered-output",
          completed_at: new Date().toISOString(),
        })
        .eq("id", trainingId);
      return new Response(
        JSON.stringify({ ok: false, error: "Resultado sem URL de LoRA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabaseAdmin
      .from("portrait_trainings")
      .update({
        status: "ready",
        lora_weights_url: loraUrl,
        completed_at: new Date().toISOString(),
      })
      .eq("id", trainingId);

    console.log(`[portrait-recover] training=${trainingId} READY lora=${loraUrl.slice(0, 80)}`);

    return new Response(
      JSON.stringify({ ok: true, status: "ready", lora_weights_url: loraUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[portrait-recover] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
