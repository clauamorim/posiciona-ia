import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Building2, Brain, FileText, ArrowRight, CreditCard, Calendar,
  Camera, RefreshCw, Sparkles, Repeat, BarChart3, Target, Instagram,
  CheckCircle2, Clock, Circle, ArrowUp, Loader2
} from "lucide-react";
import ExtrasSection from "@/components/ExtrasSection";

type JourneyStep = {
  label: string;
  status: "done" | "in_progress" | "pending";
  href: string;
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
  const [loadingUpgrade, setLoadingUpgrade] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [profileRes, bqRes, answersRes, reportRes, igRes, portraitRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("business_questionnaires").select("is_complete").eq("user_id", user.id).order("version", { ascending: false }).limit(1),
        supabase.from("archetype_answers").select("question_id").eq("user_id", user.id),
        supabase.from("reports").select("status, editorial_weeks").eq("user_id", user.id).eq("status", "completed").limit(1),
        supabase.from("instagram_analyses").select("id").eq("user_id", user.id).limit(1),
        supabase.from("portrait_generations").select("id").eq("user_id", user.id).limit(1),
      ]);
      setProfile(profileRes.data);
      setBusinessComplete(bqRes.data?.[0]?.is_complete ?? false);
      const uniqueQuestions = new Set(answersRes.data?.map(a => a.question_id) ?? []);
      setArchetypeCount(uniqueQuestions.size);
      const reportData = reportRes.data?.[0];
      setHasReport(!!reportData);
      setHasEditorial(!!(reportData?.editorial_weeks && (reportData.editorial_weeks as any[]).length > 0));
      setHasInstagram((igRes.data?.length ?? 0) > 0);
      setHasPortraits((portraitRes.data?.length ?? 0) > 0);
    };
    load();
  }, [user]);

  const archetypesDone = archetypeCount === 72;

  const getSubtitle = () => {
    if (!businessComplete) return "Comece pelo diagnóstico do seu negócio para desbloquear sua estratégia.";
    if (!archetypesDone) return "Complete o questionário de arquétipos para revelar a essência da sua marca.";
    if (!hasReport) return "Seus questionários estão completos. Hora de gerar sua estratégia.";
    if (!hasEditorial) return "Sua estratégia está pronta. Gere sua primeira semana de conteúdo.";
    if (!hasPortraits) return "Seus conteúdos estão prontos. Que tal gerar seus retratos de marca?";
    return "Sua estratégia está completa. Continue produzindo com consistência.";
  };

  const getNextStep = () => {
    if (!businessComplete) return { label: "Preencher questionário do negócio", href: "/business-questionnaire", icon: Building2 };
    if (!archetypesDone) return { label: "Completar questionário de arquétipos", href: "/archetype-questionnaire", icon: Brain };
    if (!hasReport) return { label: "Ver meus arquétipos", href: "/results", icon: BarChart3 };
    if (!hasEditorial) return { label: "Gerar linha editorial", href: "/editorial", icon: Calendar };
    if (!hasPortraits) return { label: "Gerar retratos de marca", href: "/portraits", icon: Camera };
    return { label: "Criar conteúdos", href: "/editorial", icon: Calendar };
  };

  const nextStep = getNextStep();

  const journeySteps: JourneyStep[] = [
    { label: "Diagnóstico", status: businessComplete ? "done" : "in_progress", href: "/business-questionnaire" },
    { label: "Arquétipos", status: archetypesDone ? "done" : businessComplete ? "in_progress" : "pending", href: "/archetype-questionnaire" },
    { label: "StoryBrand", status: hasReport ? "done" : "pending", href: "/storybrand" },
    { label: "Instagram", status: hasInstagram ? "done" : "pending", href: "/instagram-analysis" },
    { label: "Editorial", status: hasEditorial ? "done" : hasReport ? "in_progress" : "pending", href: "/editorial" },
    { label: "Conteúdos", status: hasEditorial ? "done" : "pending", href: "/editorial" },
    { label: "Retratos", status: hasPortraits ? "done" : "pending", href: "/portraits" },
  ];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "done") return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (status === "in_progress") return <Clock className="h-4 w-4 text-primary" />;
    return <Circle className="h-4 w-4 text-muted-foreground/30" />;
  };

  const handleUpgrade = async (targetPlan: string) => {
    setLoadingUpgrade(targetPlan);
    try {
      const { data, error } = await supabase.functions.invoke("upgrade-checkout", {
        body: { target_plan: targetPlan },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      } else if (data?.success) {
        toast({ title: "Upgrade realizado!", description: data.message });
        window.location.reload();
      }
    } catch (err: any) {
      toast({ title: "Erro no upgrade", description: err.message, variant: "destructive" });
    }
    setLoadingUpgrade(null);
  };

  const currentSlug = subscription?.plan_slug;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Hero interno */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Olá, {profile?.full_name || "Usuário"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 leading-relaxed max-w-lg">
            {getSubtitle()}
          </p>
        </div>

        {/* Próximo passo */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
          <CardContent className="py-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <nextStep.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Seu próximo passo</p>
                <p className="font-medium text-sm">{nextStep.label}</p>
              </div>
            </div>
            <Link to={nextStep.href}>
              <Button size="sm" className="gap-1.5">
                Continuar <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Upgrade section */}
        {currentSlug === "semana_conteudo" && (
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="py-5 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowUp className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Upgrade disponível</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Faça upgrade em até 7 dias da compra e desconte os R$ 197 já pagos.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Button size="sm" onClick={() => handleUpgrade("presenca_mensal")} disabled={loadingUpgrade === "presenca_mensal"}>
                  {loadingUpgrade === "presenca_mensal" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ArrowUp className="h-3.5 w-3.5 mr-1.5" />}
                  Presença Mensal — R$ 100*
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleUpgrade("autoridade_total")} disabled={loadingUpgrade === "autoridade_total"}>
                  {loadingUpgrade === "autoridade_total" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ArrowUp className="h-3.5 w-3.5 mr-1.5" />}
                  Autoridade Total — R$ 300*
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">*Valor com abatimento dos R$ 197 (válido nos primeiros 7 dias). Após esse prazo, será cobrado o valor cheio como assinatura mensal.</p>
            </CardContent>
          </Card>
        )}

        {currentSlug === "presenca_mensal" && (
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="py-5 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowUp className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Upgrade disponível</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Passe para o Autoridade Total e ganhe 5 retratos inclusos, 2 reanálises e 20 regenerações por mês.
              </p>
              <Button size="sm" onClick={() => handleUpgrade("autoridade_total")} disabled={loadingUpgrade === "autoridade_total"}>
                {loadingUpgrade === "autoridade_total" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ArrowUp className="h-3.5 w-3.5 mr-1.5" />}
                Upgrade para Autoridade Total — R$ 497/mês
              </Button>
              <p className="text-[10px] text-muted-foreground">A diferença será cobrada proporcionalmente ao período restante.</p>
            </CardContent>
          </Card>
        )}

        {/* Plano + Créditos */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="py-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seu Plano</p>
                </div>
                {hasActivePlan && (
                  <Badge className="bg-success/10 text-success border-success/20 text-[10px] hover:bg-success/10">Ativo</Badge>
                )}
              </div>
              {subscription ? (
                <>
                  <p className="text-lg font-semibold">{subscription.plan_name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    Válido até {formatDate(subscription.current_period_end)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Nenhum plano ativo</p>
                  <Link to="/choose-plan">
                    <Button size="sm" variant="outline" className="gap-1.5 mt-1">
                      Escolher plano <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seus Créditos</p>
              </div>
              {balances ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { icon: Calendar, value: balances.weekly_cycles, label: "Ciclos de conteúdo", desc: "semanas de conteúdo restantes" },
                    { icon: RefreshCw, value: balances.reanalysis_credits, label: "Reanálises de perfil", desc: "atualizações de diagnóstico" },
                    { icon: Camera, value: balances.portrait_credits_included + balances.portrait_credits_extra, label: "Retratos disponíveis", desc: `${balances.portrait_credits_included} inclusos + ${balances.portrait_credits_extra} extras` },
                    { icon: Repeat, value: balances.regeneration_credits, label: "Regenerações", desc: "de posts restantes" },
                  ].map((item, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/40 space-y-0.5">
                      <p className="text-xl font-semibold">{item.value}</p>
                      <p className="text-[11px] font-medium text-foreground/80">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum saldo disponível</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Extras section */}
        {hasActivePlan && <ExtrasSection />}

        {/* Jornada */}
        <Card>
          <CardContent className="py-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Progresso da jornada</p>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {journeySteps.map((step, i) => (
                <Link key={i} to={step.href} className="flex flex-col items-center gap-1.5 min-w-[70px] group">
                  <StatusIcon status={step.status} />
                  <span className={`text-[10px] font-medium text-center leading-tight ${
                    step.status === "done" ? "text-success" :
                    step.status === "in_progress" ? "text-primary" :
                    "text-muted-foreground/50"
                  }`}>
                    {step.label}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Entregas disponíveis */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Entregas disponíveis</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: BarChart3, label: "Arquétipos", status: hasReport ? "Disponível" : "Pendente", href: "/results", done: hasReport },
              { icon: Target, label: "StoryBrand", status: hasReport ? "Disponível" : "Pendente", href: "/storybrand", done: hasReport },
              { icon: Instagram, label: "Análise do Instagram", status: hasInstagram ? "Disponível" : "Pendente", href: "/instagram-analysis", done: hasInstagram },
              { icon: Calendar, label: "Linha Editorial", status: hasEditorial ? "Disponível" : hasReport ? "Pronto para gerar" : "Pendente", href: "/editorial", done: hasEditorial },
              { icon: FileText, label: "Conteúdos", status: hasEditorial ? "Disponível" : "Pendente", href: "/editorial", done: hasEditorial },
              { icon: Camera, label: "Retratos de Marca", status: hasPortraits ? "Disponível" : "Pendente", href: "/portraits", done: hasPortraits },
            ].map((item, i) => (
              <Link key={i} to={item.href}>
                <Card className="hover:shadow-sm transition-shadow cursor-pointer h-full">
                  <CardContent className="py-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      item.done ? "bg-success/10" : "bg-muted"
                    }`}>
                      <item.icon className={`h-4 w-4 ${item.done ? "text-success" : "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.label}</p>
                      <p className={`text-[11px] ${item.done ? "text-success" : "text-muted-foreground"}`}>{item.status}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
