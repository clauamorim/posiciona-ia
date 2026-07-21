import { supabase } from "@/integrations/supabase/client";
import { calculateScores, getTop3 } from "@/lib/archetypes";
import type { BrandType } from "@/contexts/WorkspaceContext";

export type StartResult = "started" | "active" | "completed" | "skipped" | "error-existing" | "failed";

/**
 * Dispara a geração do relatório em SEGUNDO PLANO assim que os dois insumos
 * (arquétipos + diagnóstico) existem — tipicamente logo após concluir o
 * Diagnóstico, enquanto o usuário preenche o "Sua História". Quando ele chegar
 * em /results, o run() de lá encontra o job ativo e apenas retoma o polling.
 *
 * Espelha a preparação de Results.tsx (cálculo de scores, upserts, criação da
 * linha do relatório e enfileiramento) SEM o polling. Se mudar lá, revisar cá.
 *
 * Nunca lança: é fire-and-forget; o Results continua sendo o orquestrador
 * autoritativo caso este disparo falhe.
 */
export async function ensureReportGenerationStarted(
  userId: string,
  workspaceId: string,
  brandType: BrandType,
): Promise<StartResult> {
  try {
    const { data: latestReport } = await supabase
      .from("reports").select("id, status, version")
      .eq("workspace_id", workspaceId)
      .order("version", { ascending: false }).limit(1).maybeSingle();

    if (latestReport?.status === "completed") return "completed";
    // Geração anterior com erro: não re-dispara sozinho (o retry é decisão do
    // usuário na tela de Resultados, onde a mensagem é exibida).
    if (latestReport?.status === "error") return "error-existing";

    if (latestReport?.id) {
      const { data: activeJobs } = await supabase
        .from("report_generation_jobs")
        .select("id").eq("workspace_id", workspaceId).eq("report_id", latestReport.id)
        .in("status", ["queued", "processing"]).limit(1);
      if (activeJobs && activeJobs.length > 0) return "active";
    }

    const [{ data: questions }, { data: answersData }, { data: workspace }] = await Promise.all([
      supabase.from("archetype_questions").select("id, archetype_name").eq("brand_type", brandType),
      supabase.from("archetype_answers").select("question_id, score").eq("workspace_id", workspaceId),
      supabase.from("workspaces").select("niche").eq("id", workspaceId).maybeSingle(),
    ]);
    if (!questions || !answersData || answersData.length < questions.length) return "skipped";

    const { data: bqData } = await supabase
      .from("business_questionnaires").select("*")
      .eq("workspace_id", workspaceId).eq("is_complete", true)
      .order("version", { ascending: false }).limit(1).maybeSingle();
    if (!bqData) return "skipped";

    const answerMap: Record<string, number> = {};
    answersData.forEach(a => { answerMap[a.question_id] = a.score; });
    const calc = calculateScores(questions, answerMap);

    const upserts = calc.map(s => ({
      user_id: userId, workspace_id: workspaceId, version: 1, archetype_name: s.name, total_score: s.score,
    }));
    await supabase.from("archetype_scores").upsert(upserts, { onConflict: "workspace_id,version,archetype_name" });

    const top3 = getTop3(calc);
    const topUpserts = top3.map(t => ({
      user_id: userId, workspace_id: workspaceId, version: 1, archetype_name: t.name, rank: t.rank, score: t.score,
    }));
    await supabase.from("user_top_archetypes").upsert(topUpserts, { onConflict: "workspace_id,version,rank" });

    // gender é da pessoa (conta); niche é do PERFIL — já veio de workspaces acima.
    const { data: profile } = await supabase
      .from("profiles").select("gender").eq("user_id", userId).maybeSingle();

    const archetypes = {
      primary: { archetype_name: top3[0]?.name, score: top3[0]?.score },
      secondary: { archetype_name: top3[1]?.name, score: top3[1]?.score },
      tertiary: { archetype_name: top3[2]?.name, score: top3[2]?.score },
    };

    let reportVersion: number;
    let reportRowId: string | null = null;
    if (latestReport && latestReport.status === "generating") {
      reportVersion = latestReport.version;
      reportRowId = latestReport.id;
    } else {
      reportVersion = (latestReport?.version || 0) + 1;
      const { data: inserted } = await supabase.from("reports").insert({
        user_id: userId, workspace_id: workspaceId, version: reportVersion, status: "generating", error_message: null,
      }).select("id").single();
      reportRowId = inserted?.id || null;
    }
    if (!reportRowId) return "failed";

    const { data: queueData, error: queueError } = await supabase.functions.invoke("generate-report", {
      body: {
        business: bqData,
        niche: workspace?.niche || "",
        archetypes,
        gender: profile?.gender || "Não informado",
        reportId: reportRowId,
        reportVersion,
        workspaceId,
      },
    });
    if (queueError || !queueData?.jobId) return "failed";
    return "started";
  } catch (e) {
    console.warn("ensureReportGenerationStarted:", e);
    return "failed";
  }
}
