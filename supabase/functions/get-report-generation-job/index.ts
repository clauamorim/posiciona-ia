// Endpoint leve para o frontend fazer polling do status de um job assíncrono
// de geração de relatório estratégico.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    // Aceita jobId via query string OU body (frontend usa supabase.functions.invoke
    // que envia POST com body JSON).
    let jobId: string | null = null;
    const url = new URL(req.url);
    jobId = url.searchParams.get("jobId");
    if (!jobId) {
      try {
        const body = await req.json();
        jobId = body?.jobId || null;
      } catch {
        /* sem body */
      }
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

    const { data: job, error } = await userClient
      .from("report_generation_jobs")
      .select("status, progress_message, result, error_message, report_id, report_version, created_at, finished_at")
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

    return new Response(JSON.stringify(job), {
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
