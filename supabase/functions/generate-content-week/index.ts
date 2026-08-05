import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { EDITORIAL_GENERATOR_VERSION, isOutdatedVersion } from "../_shared/generatorVersion.ts";
import { sanitizeWeek } from "../_shared/editorialSanitize.ts";
import { verifyWorkspaceOwnership } from "../_shared/workspaceAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function parseStoredReportContent(rawContent: unknown): Record<string, any> | null {
  if (!rawContent) return null;
  if (typeof rawContent === "object" && rawContent !== null && !Array.isArray(rawContent)) {
    return rawContent as Record<string, any>;
  }
  if (typeof rawContent !== "string") return null;

  try {
    const parsed = JSON.parse(rawContent);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, any>
      : null;
  } catch {
    return null;
  }
}

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { business, niche, previousWeeks, storybrand, tone_of_voice, weekNumber, freeRegeneration, replaceWeekIndex, workspaceId } = await req.json();

    // workspaceId vem do corpo (input do cliente) — esta função roda com
    // service role e ignora RLS, então a posse precisa ser checada em código.
    if (workspaceId && !(await verifyWorkspaceOwnership(user.id, workspaceId))) {
      return new Response(JSON.stringify({ error: "Sem acesso a este perfil." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Free regeneration path: sanitize the saved week without calling the AI =====
    if (freeRegeneration) {
      let reportQuery = supabase.from("reports").select("editorial_weeks, content, version");
      reportQuery = workspaceId ? reportQuery.eq("workspace_id", workspaceId) : reportQuery.eq("user_id", user.id);
      const { data: reportRow, error: reportError } = await reportQuery
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (reportError || !reportRow) {
        return new Response(JSON.stringify({ error: "Relatório não encontrado para atualização gratuita." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const parsedContent = parseStoredReportContent(reportRow.content);
      const structuredArr = Array.isArray(parsedContent?.editorial) ? parsedContent.editorial : [];
      const weeks: any[][] = Array.isArray(reportRow.editorial_weeks) ? reportRow.editorial_weeks : [];
      const allWeeks = [...(structuredArr.length > 0 ? [structuredArr] : []), ...weeks];
      const target = typeof replaceWeekIndex === "number" ? allWeeks[replaceWeekIndex] : null;

      if (!Array.isArray(target) || target.length === 0) {
        return new Response(JSON.stringify({ error: "Semana alvo não encontrada para regeneração gratuita." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isWeekOutdated = target.some((d: any) => isOutdatedVersion(d?.generator_version));
      if (!isWeekOutdated) {
        return new Response(JSON.stringify({ error: "Esta semana já está atualizada." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sanitizedOnly = sanitizeWeek(target as any[]).map((d: any) => ({
        ...d,
        generator_version: EDITORIAL_GENERATOR_VERSION,
      }));

      return new Response(JSON.stringify({ editorial: sanitizedOnly, generator_version: EDITORIAL_GENERATOR_VERSION, sanitized_only: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ===== Paid path: enfileira um job assíncrono e retorna jobId em <2s =====
    // O processamento pesado (chamada Gemini + sanitização + retry) roda no
    // worker `process-content-generation-job` para não estourar o timeout
    // da Edge Function HTTP.

    const { data: balanceData } = await supabase
      .from("user_balances")
      .select("weekly_cycles")
      .eq("user_id", user.id)
      .single();

    if (!balanceData || balanceData.weekly_cycles < 1) {
      return new Response(JSON.stringify({ error: "Créditos de ciclos semanais insuficientes. Adquira mais créditos para continuar gerando conteúdo." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bloqueia geração sem o Questionário Pessoal — humanização obrigatória.
    let pqQuery = supabase.from("personal_questionnaires").select("status");
    pqQuery = workspaceId ? pqQuery.eq("workspace_id", workspaceId) : pqQuery.eq("user_id", user.id);
    const { data: pqRow } = await pqQuery
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pqRow || pqRow.status !== "submitted") {
      return new Response(JSON.stringify({
        error: "Conte sua história primeiro: preencha o Questionário Pessoal para humanizar sua linha editorial.",
        redirect: "/personal-questionnaire",
      }), {
        status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Localiza o relatório alvo (mais recente, completed)
    let targetReportQuery = supabase.from("reports").select("id, editorial_weeks").eq("status", "completed");
    targetReportQuery = workspaceId ? targetReportQuery.eq("workspace_id", workspaceId) : targetReportQuery.eq("user_id", user.id);
    const { data: targetReport, error: targetReportErr } = await targetReportQuery
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (targetReportErr || !targetReport) {
      return new Response(JSON.stringify({ error: "Relatório não encontrado. Conclua o diagnóstico primeiro." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica se já existe job ativo para o mesmo relatório (evita duplicação)
    // report_id já identifica o perfil de forma única — filtro extra por
    // workspace_id/user_id é só defesa em profundidade.
    let activeJobsQuery = supabase.from("content_generation_jobs").select("id, status, created_at").eq("report_id", targetReport.id);
    activeJobsQuery = workspaceId ? activeJobsQuery.eq("workspace_id", workspaceId) : activeJobsQuery.eq("user_id", user.id);
    const { data: activeJobs } = await activeJobsQuery
      .in("status", ["queued", "processing"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (activeJobs && activeJobs.length > 0) {
      const existing = activeJobs[0];
      // Se ainda é recente (<5min), reusa
      const createdAt = new Date(existing.created_at).getTime();
      if (Date.now() - createdAt < 5 * 60 * 1000) {
        return new Response(JSON.stringify({ jobId: existing.id, status: existing.status, reused: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Cria o job
    const currentWeeks: any[] = Array.isArray(targetReport.editorial_weeks) ? targetReport.editorial_weeks : [];
    // Garante monotonicidade: pega o maior _week_index/week_index existente + 1.
    // Evita colisões quando o array tem buracos ou foi reindexado (ex: backfill manual).
    const existingIndices: number[] = currentWeeks
      .map((w: any) => {
        const wi = w?._week_index ?? w?.week_index;
        return typeof wi === "number" ? wi : -1;
      })
      .filter((n: number) => n >= 0);
    const nextWeekIndex = Math.max(...existingIndices, -1) + 1;
    const { data: jobInsert, error: jobInsertErr } = await supabase
      .from("content_generation_jobs")
      .insert({
        user_id: user.id,
        workspace_id: workspaceId ?? null,
        report_id: targetReport.id,
        week_index: nextWeekIndex,
        status: "queued",
        progress_message: "Na fila…",
        payload: {
          business: business || null,
          niche: niche || "",
          previousWeeks: previousWeeks || [],
          storybrand: storybrand || null,
          tone_of_voice: tone_of_voice || null,
          weekNumber: weekNumber || (nextWeekIndex + 1),
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
    const workerUrl = `${SUPABASE_URL}/functions/v1/process-content-generation-job`;
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
  } catch (error) {
    console.error("generate-content-week error:", error);
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
    const userMessage = typeof (error as any)?.userMessage === "string" && (error as any).userMessage.trim()
      ? (error as any).userMessage
      : null;
    const rawMessage = error instanceof Error ? error.message : "";
    // Não vaza mensagens técnicas tipo "AI API error: 500 - ..." para o usuário.
    const looksTechnical = /AI API error|fetch failed|JSON|TypeError|SyntaxError/i.test(rawMessage);
    const message = userMessage
      ?? (looksTechnical || !rawMessage
        ? "Não foi possível gerar a semana agora. Tente novamente em alguns segundos."
        : rawMessage);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
