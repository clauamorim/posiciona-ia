// Endpoint leve para o frontend fazer polling do status de um job assíncrono
// de geração do relatório estratégico.
//
// Inclui WATCHDOG: se um job está em queued/processing mas não recebe
// update há mais de STALE_MINUTES, marca como failed automaticamente.
// Isso destrava a UI quando o worker morre por wall-clock limit da Edge
// Function (catch nunca dispara, status fica processing pra sempre).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Se um job está processing/queued e não recebe update há mais que isso,
// consideramos que o worker morreu (wall-clock kill, OOM, redeploy, etc.).
const STALE_MINUTES = 4;

const STALE_USER_MESSAGE =
  "A geração foi interrompida antes de concluir. Tente novamente — se receber esta mensagem mais de uma vez, fale com o suporte.";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // jobId pode vir via body (supabase.functions.invoke) ou query string.
    let jobId: string | null = null;
    const url = new URL(req.url);
    jobId = url.searchParams.get("jobId");
    if (!jobId && req.method !== "GET") {
      const body = await req.json().catch(() => ({}));
      jobId = body?.jobId ?? null;
    }
    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // RLS garante que o usuário só veja os próprios jobs
    const { data: job, error } = await userClient
      .from("report_generation_jobs")
      .select("id, user_id, report_id, status, progress_message, result, error_message, attempts, started_at, updated_at, created_at, finished_at")
      .eq("id", jobId)
      .maybeSingle();

    if (error) {
      console.error("get-report-generation-job select error:", error);
      return new Response(JSON.stringify({ error: "Erro ao consultar status" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!job) {
      return new Response(JSON.stringify({ error: "Job não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- WATCHDOG ---------------------------------------------------------
    // Se o job está vivo no banco mas o worker parou de bater (updated_at
    // antigo), marca como falho para que a UI saia do limbo e mostre erro.
    if (job.status === "queued" || job.status === "processing") {
      const lastBeat = new Date(job.updated_at).getTime();
      const ageMin = (Date.now() - lastBeat) / 60000;
      if (ageMin > STALE_MINUTES) {
        console.warn(`[watchdog] job ${jobId} stale ${ageMin.toFixed(1)}min — marcando como failed`);
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await admin
          .from("report_generation_jobs")
          .update({
            status: "failed",
            error_message: STALE_USER_MESSAGE,
            progress_message: null,
            finished_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          // proteção contra race: só atualiza se ainda estiver vivo
          .in("status", ["queued", "processing"]);
        await admin
          .from("reports")
          .update({ status: "error", error_message: STALE_USER_MESSAGE })
          .eq("id", job.report_id)
          .in("status", ["pending", "generating"]);

        return new Response(JSON.stringify({
          status: "failed",
          error_message: STALE_USER_MESSAGE,
          progress_message: null,
          attempts: job.attempts,
          created_at: job.created_at,
          finished_at: new Date().toISOString(),
          stale: true,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      status: job.status,
      progress_message: job.progress_message,
      result: job.result,
      error_message: job.error_message,
      attempts: job.attempts,
      created_at: job.created_at,
      finished_at: job.finished_at,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("get-report-generation-job error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
