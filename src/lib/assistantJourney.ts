import { supabase } from "@/integrations/supabase/client";

export type JourneyState = {
  currentStep: string;
  completedSteps: string[];
  routeHint: string | null;
};

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard (visão geral da jornada)",
  "/business-questionnaire": "Diagnóstico do negócio",
  "/narrative-preview": "Prévia da Narrativa (StoryBrand resumido, gerado após o diagnóstico)",
  "/personal-questionnaire": "Sua História (questionário pessoal)",
  "/archetype-questionnaire": "Questionário de Arquétipos",
  "/results": "Tela de Resultados (aguardando relatório)",
  "/report": "Relatório Estratégico",
  "/storybrand": "Narrativa (StoryBrand)",
  "/instagram-analysis": "Análise do Instagram",
  "/editorial": "Linha Editorial",
  "/post-editor": "Editor de Posts",
  "/portraits": "Retratos com IA",
  "/my-designs": "Meus Designs",
  "/my-gallery": "Minha Galeria",
  "/choose-plan": "Escolha de Plano",
  "/help": "Página de Ajuda",
};

export function getRouteLabel(pathname: string): string | null {
  // match exact or prefix
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  for (const key of Object.keys(ROUTE_LABELS)) {
    if (pathname.startsWith(key + "/")) return ROUTE_LABELS[key];
  }
  return null;
}

export async function buildJourneyContext(userId: string, currentRoute: string): Promise<string> {
  const [
    bqRes,
    pqRes,
    snRes,
    answersRes,
    reportRes,
    igRes,
    portraitRes,
    archetypesRes,
    profileRes,
    balanceRes,
  ] = await Promise.all([
    supabase.from("business_questionnaires").select("is_complete").eq("user_id", userId).order("version", { ascending: false }).limit(1),
    supabase.from("personal_questionnaires").select("status").eq("user_id", userId).order("version", { ascending: false }).limit(1),
    supabase.from("sales_narrative_questionnaires").select("status").eq("user_id", userId).order("version", { ascending: false }).limit(1),
    supabase.from("archetype_answers").select("question_id").eq("user_id", userId),
    supabase.from("reports").select("status, editorial_weeks, content").eq("user_id", userId).order("version", { ascending: false }).limit(1),
    supabase.from("instagram_analyses").select("id").eq("user_id", userId).limit(1),
    supabase.from("portrait_generations").select("id").eq("user_id", userId).limit(1),
    supabase.from("user_top_archetypes").select("archetype_name, rank").eq("user_id", userId).order("rank", { ascending: true }).limit(3),
    supabase.from("profiles").select("profession, niche, full_name").eq("user_id", userId).maybeSingle(),
    supabase.from("user_balances").select("weekly_cycles, reanalysis_credits, portrait_credits_included, portrait_credits_extra, regeneration_credits").eq("user_id", userId).maybeSingle(),
  ]);

  const businessComplete = bqRes.data?.[0]?.is_complete ?? false;
  const personalSubmitted = pqRes.data?.[0]?.status === "submitted";
  const salesNarrativeSubmitted = snRes.data?.[0]?.status === "submitted";
  const uniqueQuestions = new Set(answersRes.data?.map((a: any) => a.question_id) ?? []);
  const archetypesDone = uniqueQuestions.size === 72;
  const reportData = reportRes.data?.[0];
  const hasReport = reportData?.status === "completed";
  const hasInstagram = (igRes.data?.length ?? 0) > 0;
  const hasPortraits = (portraitRes.data?.length ?? 0) > 0;

  let hasEditorial = !!(reportData?.editorial_weeks && (reportData.editorial_weeks as any[]).length > 0);
  if (!hasEditorial && reportData?.content) {
    try {
      let c: any = reportData.content;
      if (typeof c === "string") c = JSON.parse(c);
      if (c && Array.isArray(c.editorial) && c.editorial.length > 0) hasEditorial = true;
    } catch {}
  }

  const completed: string[] = [];
  if (businessComplete) completed.push("Diagnóstico");
  if (personalSubmitted) completed.push("Sua História");
  if (archetypesDone) completed.push("Arquétipos");
  if (salesNarrativeSubmitted) completed.push("Narrativa de Vendas (opcional)");
  if (hasReport) completed.push("Relatório");
  if (hasInstagram) completed.push("Análise do Instagram");
  if (hasEditorial) completed.push("Linha Editorial");
  if (hasPortraits) completed.push("Retratos");

  let nextStep = "Diagnóstico";
  if (!businessComplete) nextStep = "Diagnóstico";
  else if (!personalSubmitted) nextStep = "Sua História";
  else if (!archetypesDone) nextStep = "Arquétipos";
  else if (!hasReport) nextStep = "Aguardar geração do Relatório";
  else if (!hasEditorial) nextStep = "Linha Editorial";
  else if (!hasPortraits) nextStep = "Retratos com IA";
  else nextStep = "Continuar produzindo conteúdo";

  // Arquétipos do usuário (rank 1=primário, 2=secundário, 3=terciário)
  const archetypes = archetypesRes.data ?? [];
  const primary = archetypes.find((a: any) => a.rank === 1)?.archetype_name;
  const secondary = archetypes.find((a: any) => a.rank === 2)?.archetype_name;
  const tertiary = archetypes.find((a: any) => a.rank === 3)?.archetype_name;

  // Perfil
  const profile = profileRes.data;
  const profession = profile?.profession;
  const niche = profile?.niche;
  const firstName = profile?.full_name?.split(" ")[0];

  // Saldos
  const bal = balanceRes.data;
  const balanceLines: string[] = [];
  if (bal) {
    balanceLines.push(`Saldo de créditos: ${bal.weekly_cycles ?? 0} ciclos semanais, ${bal.reanalysis_credits ?? 0} reanálises, ${(bal.portrait_credits_included ?? 0) + (bal.portrait_credits_extra ?? 0)} retratos, ${bal.regeneration_credits ?? 0} ajustes de conteúdo.`);
  }

  const archetypeLines: string[] = [];
  if (primary || secondary || tertiary) {
    const parts: string[] = [];
    if (primary) parts.push(`primário ${primary}`);
    if (secondary) parts.push(`secundário ${secondary}`);
    if (tertiary) parts.push(`terciário ${tertiary}`);
    archetypeLines.push(`Arquétipos do usuário: ${parts.join(", ")}.`);
  }

  const profileLines: string[] = [];
  if (firstName) profileLines.push(`Primeiro nome: ${firstName}.`);
  if (profession) profileLines.push(`Profissão: ${profession}.`);
  if (niche) profileLines.push(`Nicho: ${niche}.`);

  const routeLabel = getRouteLabel(currentRoute);

  const lines: string[] = [
    routeLabel ? `Página atual: ${routeLabel}` : `Rota atual: ${currentRoute}`,
    ...profileLines,
    ...archetypeLines,
    ...balanceLines,
    `Etapas concluídas: ${completed.length > 0 ? completed.join(", ") : "nenhuma ainda"}`,
    `Próximo passo recomendado: ${nextStep}`,
  ];

  return lines.join("\n");
}
