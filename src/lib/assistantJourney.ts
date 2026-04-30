import { supabase } from "@/integrations/supabase/client";

export type JourneyState = {
  currentStep: string;
  completedSteps: string[];
  routeHint: string | null;
};

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard (visão geral da jornada)",
  "/business-questionnaire": "Diagnóstico do negócio",
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
  const [bqRes, pqRes, answersRes, reportRes, igRes, portraitRes] = await Promise.all([
    supabase.from("business_questionnaires").select("is_complete").eq("user_id", userId).order("version", { ascending: false }).limit(1),
    supabase.from("personal_questionnaires").select("status").eq("user_id", userId).order("version", { ascending: false }).limit(1),
    supabase.from("archetype_answers").select("question_id").eq("user_id", userId),
    supabase.from("reports").select("status, editorial_weeks, content").eq("user_id", userId).order("version", { ascending: false }).limit(1),
    supabase.from("instagram_analyses").select("id").eq("user_id", userId).limit(1),
    supabase.from("portrait_generations").select("id").eq("user_id", userId).limit(1),
  ]);

  const businessComplete = bqRes.data?.[0]?.is_complete ?? false;
  const personalSubmitted = pqRes.data?.[0]?.status === "submitted";
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

  const routeLabel = getRouteLabel(currentRoute);

  return [
    routeLabel ? `Página atual: ${routeLabel}` : `Rota atual: ${currentRoute}`,
    `Etapas concluídas: ${completed.length > 0 ? completed.join(", ") : "nenhuma ainda"}`,
    `Próximo passo recomendado: ${nextStep}`,
  ].join("\n");
}
