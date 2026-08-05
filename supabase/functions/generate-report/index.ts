// 2026-04-25-v6: refatorado para arquitetura assíncrona job/worker.
// Esta função agora APENAS enfileira o job e retorna jobId em <1s.
// O processamento pesado (chamada Claude + parsing) roda em
// `process-report-generation-job` (worker em background com EdgeRuntime.waitUntil).
// Resolve: 504 Gateway Timeout, cobranças duplicadas e loops de geração.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyWorkspaceOwnership } from "../_shared/workspaceAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { business, niche, archetypes, gender, reportId, reportVersion, workspaceId, force } = await req.json();

    if (!business || !archetypes) {
      return new Response(JSON.stringify({ error: "Dados obrigatórios faltando" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // workspaceId/reportId vêm do corpo (input do cliente) — esta função roda
    // com service role e ignora RLS, então a posse precisa ser checada em
    // código, senão um usuário autenticado qualquer poderia gerar relatório
    // usando dados de OUTRA conta só passando o UUID alheio.
    if (workspaceId && !(await verifyWorkspaceOwnership(userId, workspaceId))) {
      return new Response(JSON.stringify({ error: "Sem acesso a este perfil." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (reportId) {
      const { data: reportOwner } = await admin
        .from("reports").select("id").eq("id", reportId).eq("user_id", userId).maybeSingle();
      if (!reportOwner) {
        return new Response(JSON.stringify({ error: "Relatório não encontrado." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Localiza o relatório alvo (preferindo o que o frontend passou)
    let targetReportId = reportId as string | undefined;
    let targetReportVersion = reportVersion as number | undefined;

    if (!targetReportId) {
      // Fallback defensivo — os dois chamadores hoje sempre enviam reportId.
      let fallbackQuery = admin.from("reports").select("id, version, status");
      fallbackQuery = workspaceId
        ? fallbackQuery.eq("workspace_id", workspaceId)
        : fallbackQuery.eq("user_id", userId);
      const { data: latestReport } = await fallbackQuery
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestReport && ["pending", "generating", "error"].includes(latestReport.status)) {
        targetReportId = latestReport.id;
        targetReportVersion = latestReport.version;
      } else {
        return new Response(JSON.stringify({ error: "Relatório alvo não encontrado. Crie o registro antes de gerar." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Reusa job ativo recente (idempotência) para o mesmo relatório
    const { data: activeJobs } = await admin
      .from("report_generation_jobs")
      .select("id, status, created_at")
      .eq("user_id", userId)
      .eq("report_id", targetReportId)
      .in("status", ["queued", "processing"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (activeJobs && activeJobs.length > 0) {
      const existing = activeJobs[0];
      const createdAt = new Date(existing.created_at).getTime();
      if (Date.now() - createdAt < 5 * 60 * 1000) {
        return new Response(JSON.stringify({ jobId: existing.id, status: existing.status, reused: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Trava de segurança: se este relatório já falhou, não dispara outra chamada paga
    // à IA automaticamente. Só um fluxo explicitamente manual pode enviar force=true.
    if (!force) {
      const { data: failedJobs } = await admin
        .from("report_generation_jobs")
        .select("id, error_message, created_at")
        .eq("user_id", userId)
        .eq("report_id", targetReportId)
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(1);

      if (failedJobs && failedJobs.length > 0) {
        return new Response(JSON.stringify({
          error: failedJobs[0].error_message || "A geração anterior falhou e foi pausada para evitar novas cobranças.",
          jobId: failedJobs[0].id,
          status: "failed",
          blocked: true,
        }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Cria o job
    const { data: jobInsert, error: jobInsertErr } = await admin
      .from("report_generation_jobs")
      .insert({
        user_id: userId,
        workspace_id: workspaceId ?? null,
        report_id: targetReportId,
        report_version: targetReportVersion ?? 1,
        status: "queued",
        progress_message: "Na fila…",
        payload: {
          business,
          niche: niche || "",
          archetypes,
          gender: gender || "Não informado",
        },
      })
      .select("id")
      .single();

    if (jobInsertErr || !jobInsert) {
      console.error("Falha ao criar job:", jobInsertErr);
      return new Response(JSON.stringify({ error: "Não foi possível enfileirar a geração. Tente novamente." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobId = jobInsert.id;

    // Dispara o worker em background (fire-and-forget)
    const workerUrl = `${SUPABASE_URL}/functions/v1/process-report-generation-job`;
    const fireWorker = fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ jobId }),
    }).catch((e) => {
      console.error("Falha ao disparar worker:", e);
    });

    // @ts-ignore — EdgeRuntime existe no runtime Supabase
    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      // @ts-ignore
      EdgeRuntime.waitUntil(fireWorker);
    }

    return new Response(JSON.stringify({ jobId, status: "queued" }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("generate-report enqueue error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
