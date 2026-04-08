import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";

const plans = [
  {
    name: "Semana de Conteúdo",
    slug: "semana_conteudo",
    price: "R$ 197",
    period: "pagamento único",
    highlight: false,
    features: [
      "Diagnóstico inicial completo",
      "Guia de posicionamento",
      "StoryBrand personalizado",
      "3 arquétipos principais",
      "Análise inicial do Instagram",
      "1 ciclo editorial de 7 dias",
      "7 conteúdos prontos",
    ],
  },
  {
    name: "Presença Mensal",
    slug: "presenca_mensal",
    price: "R$ 297",
    period: "/mês",
    highlight: true,
    features: [
      "Diagnóstico inicial completo",
      "4 ciclos semanais por mês",
      "Conteúdos semanais estratégicos",
      "1 reanálise de perfil por mês",
      "Posts, carrosséis e roteiros",
    ],
  },
  {
    name: "Autoridade Total",
    slug: "autoridade_total",
    price: "R$ 497",
    period: "/mês",
    highlight: false,
    features: [
      "Tudo do Presença Mensal",
      "2 reanálises de perfil por mês",
      "Créditos mensais de retrato",
      "20 créditos de regeneração",
    ],
  },
];

const ChoosePlan = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const handleCheckout = async (slug: string) => {
    if (!user) return;
    setLoadingSlug(slug);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { plan_slug: slug },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Erro ao iniciar pagamento", description: err.message, variant: "destructive" });
    }
    setLoadingSlug(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold font-display">Escolha seu plano</h1>
          <p className="text-muted-foreground mt-2">Selecione um plano para acessar a plataforma</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <Card
              key={p.slug}
              className={`relative flex flex-col ${
                p.highlight ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-border/50"
              }`}
            >
              {p.highlight && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Mais popular
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg font-display">{p.name}</CardTitle>
                <div className="mt-2">
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
                </ul>
                <Button
                  className="w-full mt-6"
                  variant={p.highlight ? "default" : "outline"}
                  onClick={() => handleCheckout(p.slug)}
                  disabled={loadingSlug === p.slug}
                >
                  {loadingSlug === p.slug && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {loadingSlug === p.slug ? "Processando..." : "Assinar"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChoosePlan;
