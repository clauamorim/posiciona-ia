import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Building2, Brain, ArrowRight, CreditCard, Calendar,
  Camera, RefreshCw, Sparkles, Repeat, BarChart3, Target, Instagram,
  CheckCircle2, ChevronRight, ChevronDown, Lock
} from "lucide-react";

type JourneyStep = {
  label: string;
  status: "done" | "in_progress" | "pending" | "blocked";
  href: string;
  icon: any;
  statusLabel: string;
};

type PlanLimits = {
  weekly_cycles: number;
  reanalysis_credits: number;
  portrait_credits: number;
  regeneration_credits: number;
};

const Dashboard = () => {
  const { user, subscription, balances, hasActivePlan } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [businessComplete, setBusinessComplete] = useState(false);
  const [archetypeCount, setArchetypeCount] = useState(0);
  const [hasReport, setHasReport] = useState(false);
  const [hasInstagram, setHasInstagram] = useState(false);
  const [hasEditorial, setHasEditorial] = useState(false);
  const [hasPortraits, setHasPortraits] = useState(false);
  const [personalSubmitted, setPersonalSubmitted] = useState(false);
  const [editorialWeeks, setEditorialWeeks] = useState<any[]>([]);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [profileRes, bqRes, answersRes, reportRes, igRes, portraitRes, pqRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("business_questionnaires").select("is_complete").eq("user_id", user.id).order("version", { ascending: false }).limit(1),
        supabase.from("archetype_answers").select("question_id").eq("user_id", user.id),
        supabase.from("reports").select("status, editorial_weeks, content").eq("user_id", user.id).order("version", { ascending: false }).limit(1),
        supabase.from("instagram_analyses").select("id").eq("user_id", user.id).limit(1),
        supabase.from("portrait_generations").select("id").eq("user_id", user.id).limit(1),
        supabase.from("personal_questionnaires").select("status").eq("user_id", user.id).order("version", { ascending: false }).limit(1),
      ]);
      setProfile(profileRes.data);
      setBusinessComplete(bqRes.data?.[0]?.is_complete ?? false);
      const uniqueQuestions = new Set(answersRes.data?.map(a => a.question_id) ?? []);
      setArchetypeCount(uniqueQuestions.size);
      const reportData = reportRes.data?.[0];
      const reportCompleted = reportData?.status === "completed";
      setHasReport(reportCompleted);
      const weeks = (reportData?.editorial_weeks as any[]) || [];
      let contentWeeks: any[] = [];
      if (reportData) {
        try {
          let c: any = reportData.content;
          if (typeof c === "string") c = JSON.parse(c);
          if (c && Array.isArray(c.editorial)) contentWeeks = c.editorial;
        } catch {}
      }
      const allWeeks = weeks.length > 0 ? weeks : contentWeeks;
      setEditorialWeeks(allWeeks);
      setHasEditorial(allWeeks.length > 0);
      setHasInstagram((igRes.data?.length ?? 0) > 0);
      setHasPortraits((portraitRes.data?.length ?? 0) > 0);
      setPersonalSubmitted(pqRes.data?.[0]?.status === "submitted");
    };
    load();
  }, [user]);

  // Load plan limits from subscription
  useEffect(() => {
    if (!subscription?.plan_id) { setPlanLimits(null); return; }
    supabase.from("plans")
      .select("weekly_cycles, reanalysis_credits, portrait_credits, regeneration_credits")
      .eq("id", subscription.plan_id)
      .maybeSingle()
      .then(({ data }) => { if (data) setPlanLimits(data as PlanLimits); });
  }, [subscription?.plan_id]);

  const archetypesDone = archetypeCount === 72;
  const firstName = profile?.full_name?.trim()?.split(/\s+/)[0] || "";

  // Pick first non-empty theme from editorial weeks
  const weeklyTheme = useMemo(() => {
    for (const w of editorialWeeks) {
      const days = (w?.days as any[]) || [];
      for (const d of days) {
        const t = d?.feed?.theme || d?.story?.theme || d?.theme;
        if (t && typeof t === "string" && t.trim()) return t.trim();
      }
    }
    return null;
  }, [editorialWeeks]);

  const getNextStep = () => {
    if (!businessComplete) return {
      label: "Próximo passo: Responder o Diagnóstico",
      description: "Preencha o diagnóstico do negócio para liberar sua estratégia.",
      hint: "Leva cerca de 5 minutos",
      href: "/business-questionnaire",
      icon: Building2,
      cta: "Preencher agora",
      eyebrow: "Próximo passo",
    };
    if (!personalSubmitted) return {
      label: "Próximo passo: Conte sua história",
      description: "Antes dos arquétipos, responda o questionário pessoal para humanizar sua estratégia.",
      hint: "Hobbies, valores e memórias que viram conteúdo autêntico",
      href: "/personal-questionnaire",
      icon: Sparkles,
      cta: "Preencher agora",
      eyebrow: "Próximo passo",
    };
    if (!archetypesDone) return {
      label: "Próximo passo: Questionário de Arquétipos",
      description: "Complete o questionário para revelar a essência da sua marca.",
      hint: "72 afirmações, escala de 1 a 5",
      href: "/archetype-questionnaire",
      icon: Brain,
      cta: "Continuar",
      eyebrow: "Próximo passo",
    };
    if (!hasReport) return {
      label: "Próximo passo: Gerar Estratégia",
      description: "Seus questionários estão completos. Hora de gerar sua estratégia.",
      hint: null,
      href: "/results",
      icon: BarChart3,
      cta: "Gerar agora",
      eyebrow: "Próximo passo",
    };
    if (!hasEditorial) return {
      label: "Próximo passo: gerar sua Linha Editorial",
      description: "Sua estratégia está pronta. Transforme em conteúdo semanal.",
      hint: null,
      href: "/editorial",
      icon: Calendar,
      cta: "Gerar Linha Editorial",
      eyebrow: "Próximo passo",
    };
    // Fully complete
    return {
      label: "Esta semana",
      description: weeklyTheme ? `Tema da semana: ${weeklyTheme}` : "Continue produzindo com consistência.",
      hint: null,
      href: "/editorial",
      icon: Calendar,
      cta: weeklyTheme ? "Ver Linha Editorial" : "Acessar Linha Editorial",
      eyebrow: "Esta semana",
    };
  };

  const nextStep = getNextStep();

  const journeySteps: JourneyStep[] = [
    {
      label: "Diagnóstico", href: "/business-questionnaire", icon: Building2,
      status: businessComplete ? "done" : "in_progress",
      statusLabel: businessComplete ? "Concluído" : "Pronto para preencher"
    },
    {
      label: "Sua História", href: "/personal-questionnaire", icon: Sparkles,
      status: personalSubmitted ? "done" : businessComplete ? "in_progress" : "blocked",
      statusLabel: personalSubmitted ? "Concluído" : businessComplete ? "Pronto para preencher" : "Bloqueado"
    },
    {
      label: "Arquétipos", href: "/archetype-questionnaire", icon: Brain,
      status: archetypesDone ? "done" : (businessComplete && personalSubmitted) ? "in_progress" : "blocked",
      statusLabel: archetypesDone ? "Concluído" : (businessComplete && personalSubmitted) ? "Pronto para preencher" : "Bloqueado"
    },
    {
      label: "Estratégia", href: "/results", icon: Target,
      status: hasReport ? "done" : archetypesDone ? "in_progress" : "blocked",
      statusLabel: hasReport ? "Concluído" : archetypesDone ? "Em análise" : "Bloqueado"
    },
    {
      label: "Instagram", href: "/instagram-analysis", icon: Instagram,
      status: hasInstagram ? "done" : hasReport ? "in_progress" : "blocked",
      statusLabel: hasInstagram ? "Concluído" : hasReport ? "Disponível" : "Bloqueado"
    },
    {
      label: "Editorial", href: "/editorial", icon: Calendar,
      status: hasEditorial ? "done" : (hasReport && personalSubmitted) ? "in_progress" : "blocked",
      statusLabel: hasEditorial ? "Concluído" : (hasReport && personalSubmitted) ? "Disponível" : "Bloqueado"
    },
    {
      label: "Retratos", href: "/portraits", icon: Camera,
      status: hasPortraits ? "done" : hasReport ? "in_progress" : "blocked",
      statusLabel: hasPortraits ? "Concluído" : hasReport ? "Disponível" : "Bloqueado"
    },
  ];

  const completedSteps = journeySteps.filter(s => s.status === "done").length;
  const progressPercent = Math.round((completedSteps / journeySteps.length) * 100);
  const journeyComplete = progressPercent === 100;

  // Journey collapsed state — default collapsed when complete, persisted
  const [journeyOpen, setJourneyOpen] = useState<boolean>(true);
  useEffect(() => {
    const saved = localStorage.getItem("dashboard.journey.expanded");
    if (saved !== null) setJourneyOpen(saved === "true");
    else setJourneyOpen(!journeyComplete);
  }, [journeyComplete]);
  const toggleJourney = (open: boolean) => {
    setJourneyOpen(open);
    localStorage.setItem("dashboard.journey.expanded", String(open));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  };
  const formatRenewDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const contextualSuggestion = (() => {
    if (!hasActivePlan || !balances || !subscription) return null;
    const currentSlug = (subscription as any).plan_slug;
    const totalPortraits = balances.portrait_credits_included + balances.portrait_credits_extra;
    if (currentSlug === "semana_conteudo" && balances.weekly_cycles === 0)
      return { text: "Seu ciclo de conteúdo foi utilizado. Amplie seus recursos" };
    if (totalPortraits === 0 && hasReport)
      return { text: "Sem retratos disponíveis. Adquira mais na página de planos" };
    if (balances.regeneration_credits === 0 && hasEditorial)
      return { text: "Seus ajustes acabaram. Veja opções para continuar" };
    if (currentSlug !== "autoridade_total")
      return { text: "Seu plano pode ser ampliado" };
    return null;
  })();

  const totalPortraits = balances ? balances.portrait_credits_included + balances.portrait_credits_extra : 0;

  const creditDetailed = balances ? [
    { icon: Calendar, value: balances.weekly_cycles, total: planLimits?.weekly_cycles ?? 0, label: "Ciclos", planCredit: true },
    { icon: RefreshCw, value: balances.reanalysis_credits, total: planLimits?.reanalysis_credits ?? 0, label: "Reanálises", planCredit: true },
    { icon: Camera, value: totalPortraits, total: (planLimits?.portrait_credits ?? 0) + balances.portrait_credits_extra, label: "Retratos", planCredit: false },
    { icon: Repeat, value: balances.regeneration_credits, total: planLimits?.regeneration_credits ?? 0, label: "Ajustes", planCredit: true },
  ] : [];

  const progressBarClass = (value: number, total: number) => {
    if (!total) return "[&>div]:bg-primary";
    const pct = (value / total) * 100;
    if (pct < 20) return "[&>div]:bg-destructive";
    if (pct < 50) return "[&>div]:bg-amber-500";
    return "[&>div]:bg-primary";
  };

  return (
    <DashboardLayout>
      <SeoHead title="Dashboard · Posiciona" description="Sua central de posicionamento de marca pessoal." path="/dashboard" />
      <TooltipProvider delayDuration={150}>
      <div className="space-y-5">
        {/* Compact greeting */}
        <div className="space-y-0.5">
          <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">
            {firstName ? `Olá, ${firstName}` : "Olá!"}
          </h1>
        </div>

        {/* NEXT STEP — Hero block */}
        <Card className="border-primary/30 bg-card relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent pointer-events-none" />
          <CardContent className="py-5 px-5 relative z-10">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <nextStep.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-0.5">{nextStep.eyebrow}</p>
                  <p className="font-sans font-semibold text-sm text-foreground leading-snug">{nextStep.label}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{nextStep.description}</p>
              {nextStep.hint && (
                <p className="text-xs text-muted-foreground/60">{nextStep.hint}</p>
              )}
              <Link to={nextStep.href} className="block">
                <Button className="w-full gap-2">
                  {nextStep.cta} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* JOURNEY PROGRESS */}
        <Collapsible open={journeyOpen} onOpenChange={toggleJourney} className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">Sua jornada</p>
            <span className="text-xs text-muted-foreground">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5 bg-secondary" />

          {journeyComplete && (
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full py-2 px-3 rounded-lg bg-success/10 border border-success/20 hover:bg-success/15 transition-colors text-sm">
                <span className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-4 w-4" /> Sua jornada está completa
                </span>
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  {journeyOpen ? "Ocultar" : "Revisar"}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", journeyOpen && "rotate-180")} />
                </span>
              </button>
            </CollapsibleTrigger>
          )}

          <CollapsibleContent className="space-y-1 data-[state=closed]:hidden">
            {(!journeyComplete || journeyOpen) && journeySteps.map((step, i) => (
              <Link
                key={i}
                to={step.href}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-card transition-colors group"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  step.status === "done" ? "bg-success/15" :
                  step.status === "in_progress" ? "bg-warning/15" :
                  "bg-secondary"
                }`}>
                  {step.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : step.status === "in_progress" ? (
                    <step.icon className="h-4 w-4 text-warning" />
                  ) : step.status === "blocked" ? (
                    <Lock className="h-3.5 w-3.5 text-disabled" />
                  ) : (
                    <step.icon className="h-4 w-4 text-disabled" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-sans font-medium ${
                    step.status === "done" ? "text-foreground" :
                    step.status === "in_progress" ? "text-foreground" :
                    "text-disabled"
                  }`}>
                    {step.label}
                  </p>
                  <p className={`text-[11px] ${
                    step.status === "done" ? "text-success" :
                    step.status === "in_progress" ? "text-warning" :
                    "text-disabled"
                  }`}>
                    {step.statusLabel}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* CREDITS — Detailed with progress */}
        {balances && (
          <div className="space-y-2">
            <p className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">Créditos</p>
            <div className="grid grid-cols-2 gap-2">
              {creditDetailed.map((item, i) => {
                const total = item.total || 0;
                const pct = total > 0 ? Math.min(100, Math.round((item.value / total) * 100)) : 0;
                return (
                  <div key={i} className="flex flex-col gap-1 p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-2.5">
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-base font-bold text-foreground">{item.value}</span>
                      <span className="text-[11px] text-muted-foreground truncate">{item.label}</span>
                    </div>
                    {total > 0 && (
                      <>
                        <Progress value={pct} className={cn("h-1 mt-1", progressBarClass(item.value, total))} />
                        <p className="text-[10px] text-muted-foreground/70 leading-tight">{item.value}/{total} disponíveis</p>
                      </>
                    )}
                    {item.planCredit && subscription?.current_period_end && subscription?.billing_type !== "one_time" && (
                      <p className="text-[10px] text-muted-foreground/60 leading-tight">
                        Renova em {formatDate((subscription as any).current_period_end)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-snug pt-1">
              Créditos comprados separadamente (semanas avulsas, pacotes de retrato) não expiram.
            </p>
          </div>
        )}

        {/* PLAN — Compact secondary */}
        {subscription && (
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-3 min-w-0">
              <CreditCard className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-sans font-medium truncate">{(subscription as any).plan_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Válido até {formatDate((subscription as any).current_period_end)}
                </p>
              </div>
            </div>
            <Link to="/choose-plan">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1">
                Gerenciar <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        )}

        {!subscription && (
          <div className="p-4 rounded-lg bg-card border border-border text-center space-y-3">
            <p className="text-sm text-muted-foreground">Nenhum plano ativo</p>
            <Link to="/choose-plan">
              <Button size="sm" className="gap-1.5">
                Escolher plano <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        )}

        {/* Contextual upsell */}
        {contextualSuggestion && (
          <Link to="/choose-plan">
            <div className="flex items-center gap-3 p-3.5 rounded-lg bg-card border border-gold/20 hover:border-gold/40 transition-colors cursor-pointer">
              <Sparkles className="h-4 w-4 text-gold flex-shrink-0" />
              <p className="text-sm text-muted-foreground flex-1">{contextualSuggestion.text}</p>
              <ArrowRight className="h-4 w-4 text-gold flex-shrink-0" />
            </div>
          </Link>
        )}
      </div>
      </TooltipProvider>
    </DashboardLayout>
  );
};

export default Dashboard;
