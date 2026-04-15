import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Check, Loader2, ArrowUp, Tag, Calendar, RefreshCw, Camera, Repeat } from "lucide-react";
import ExtrasSection from "@/components/ExtrasSection";

const plans = [
  {
    name: "Semana de Conteúdo",
    slug: "semana_conteudo",
    price: "197",
    period: "pagamento único",
    highlight: false,
    billing: "one_time",
    features: [
      "Diagnóstico inicial completo",
      "Guia de posicionamento e narrativa de marca",
      "3 arquétipos principais",
      "Análise inicial do Instagram",
      "1 ciclo editorial de 7 dias",
      "7 conteúdos prontos para publicar",
      "3 créditos de ajuste de conteúdo",
    ],
    notIncluded: ["Retratos não inclusos"],
    upgradeNote: "Faça upgrade em até 7 dias e desconte R$ 197",
  },
  {
    name: "Presença Mensal",
    slug: "presenca_mensal",
    price: "297",
    period: "/mês",
    highlight: true,
    billing: "recurring",
    features: [
      "Tudo do Semana de Conteúdo",
      "4 ciclos semanais por mês",
      "1 reanálise estratégica mensal",
      "12 créditos de ajuste de conteúdo/mês",
      "Preço especial em extras",
    ],
    notIncluded: ["Retratos não inclusos"],
    upgradeNote: null,
  },
  {
    name: "Autoridade Total",
    slug: "autoridade_total",
    price: "497",
    period: "/mês",
    highlight: false,
    billing: "recurring",
    features: [
      "Tudo do Presença Mensal",
      "2 reanálises estratégicas/mês",
      "5 créditos de retrato inclusos/mês",
      "20 créditos de ajuste de conteúdo/mês",
      "Melhor preço em extras",
    ],
    notIncluded: [],
    upgradeNote: null,
  },
];

const ChoosePlan = () => {
  const navigate = useNavigate();
  const { user, subscription, balances, signOut } = useAuth();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [loadingUpgrade, setLoadingUpgrade] = useState<string | null>(null);

  const currentSlug = subscription?.plan_slug;

  const handleCheckout = async (slug: string) => {
    if (!user) return;
    setLoadingSlug(slug);
    try {
      const plan = plans.find(p => p.slug === slug);
      const body: any = { plan_slug: slug };
      if (plan?.billing === "recurring" && couponCode.trim()) {
        body.coupon_code = couponCode.trim();
      }
      const { data, error } = await supabase.functions.invoke("stripe-checkout", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("URL de pagamento não retornada");
      }
    } catch (err: any) {
      toast({ title: "Erro ao iniciar pagamento", description: err.message, variant: "destructive" });
      setLoadingSlug(null);
    }
  };

  const handleUpgrade = async (targetPlan: string) => {
    if (!user) return;
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
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast({ title: "Erro no upgrade", description: err.message, variant: "destructive" });
    }
    setLoadingUpgrade(null);
  };

  const getButtonAction = (p: typeof plans[0]) => {
    if (!currentSlug) {
      return { label: p.slug === "semana_conteudo" ? "Começar agora" : "Assinar", action: () => handleCheckout(p.slug), loading: loadingSlug === p.slug };
    }
    if (currentSlug === p.slug) {
      return { label: "Plano atual", action: () => {}, loading: false, disabled: true };
    }
    if (currentSlug === "autoridade_total") {
      return { label: "—", action: () => {}, loading: false, disabled: true };
    }
    if (currentSlug === "semana_conteudo" && (p.slug === "presenca_mensal" || p.slug === "autoridade_total")) {
      return { label: "Upgrade", action: () => handleUpgrade(p.slug), loading: loadingUpgrade === p.slug, isUpgrade: true };
    }
    if (currentSlug === "presenca_mensal" && p.slug === "autoridade_total") {
      return { label: "Upgrade", action: () => handleUpgrade(p.slug), loading: loadingUpgrade === p.slug, isUpgrade: true };
    }
    return { label: "—", action: () => {}, loading: false, disabled: true };
  };

  const content = (
    <div className="w-full space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {currentSlug ? "Plano e Créditos" : "Escolha seu plano"}
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          {currentSlug
            ? "Gerencie seu plano, veja seus créditos e adquira extras."
            : "Comece com clareza. Evolua com constância. Reforce com imagem."}
        </p>
      </div>

      {/* Credits summary for active subscribers */}
      {currentSlug && balances && (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="py-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seus Créditos</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { icon: Calendar, value: balances.weekly_cycles, label: "Ciclos semanais" },
                { icon: RefreshCw, value: balances.reanalysis_credits, label: "Reanálises" },
                { icon: Camera, value: balances.portrait_credits_included + balances.portrait_credits_extra, label: "Retratos" },
                { icon: Repeat, value: balances.regeneration_credits, label: "Ajustes de conteúdo" },
              ].map((item, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-muted/40 text-center space-y-0.5">
                  <item.icon className="h-4 w-4 mx-auto text-muted-foreground" />
                  <p className="text-xl font-semibold">{item.value}</p>
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coupon input for new subscribers */}
      {!currentSlug && (
        <div className="max-w-sm mx-auto">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              placeholder="Cupom de desconto (planos mensais)"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="text-sm"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 ml-6">Válido apenas para Presença Mensal e Autoridade Total</p>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((p) => {
          const btn = getButtonAction(p);
          const isCurrent = currentSlug === p.slug;
          return (
            <Card
              key={p.slug}
              className={`relative flex flex-col ${
                isCurrent
                  ? "border-success shadow-lg ring-1 ring-success/20"
                  : p.highlight && !currentSlug
                  ? "border-primary shadow-lg ring-1 ring-primary/20"
                  : "border-border/50"
              }`}
            >
              {isCurrent && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-success text-success-foreground">
                  Seu plano
                </Badge>
              )}
              {p.highlight && !currentSlug && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Mais popular
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg font-display">{p.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground">R$ </span>
                  <span className="text-3xl font-bold">{p.price}</span>
                  <span className="text-muted-foreground text-sm">{p.period}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-2 flex-1">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {p.notIncluded.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground/50">
                      <span className="w-4 text-center flex-shrink-0">—</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {p.upgradeNote && !currentSlug && (
                  <p className="text-[10px] text-muted-foreground mt-3 text-center italic">{p.upgradeNote}</p>
                )}

                <Button
                  className="w-full mt-6"
                  variant={btn.isUpgrade ? "default" : isCurrent ? "outline" : p.highlight && !currentSlug ? "default" : "outline"}
                  onClick={btn.action}
                  disabled={btn.disabled || btn.loading}
                >
                  {btn.loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {btn.isUpgrade && !btn.loading && <ArrowUp className="h-4 w-4 mr-1.5" />}
                  {btn.loading ? "Processando..." : btn.label}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Extras — Semana extra + Packs de retrato */}
      {currentSlug && (
        <div className="max-w-3xl mx-auto">
          <ExtrasSection />
        </div>
      )}
    </div>
  );

  // Wrap in DashboardLayout if user has active plan (sidebar navigation)
  if (currentSlug) {
    return (
      <DashboardLayout>
        {content}
      </DashboardLayout>
    );
  }

  // No plan yet — standalone centered page
  return (
    <div className="min-h-screen bg-background flex flex-col px-4 py-12">
      <div className="flex justify-end max-w-4xl w-full mx-auto mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-4xl w-full">
          {content}
        </div>
      </div>
    </div>
  );
};

export default ChoosePlan;
