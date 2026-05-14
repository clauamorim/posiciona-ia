import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, SkipForward } from "lucide-react";

const SalesNarrativeIntro = () => {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <SeoHead title="Narrativa de Vendas · Posiciona" description="Construa sua narrativa de vendas." path="/sales-narrative-intro" />
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">
            Antes de ver seus resultados — quer personalizar ainda mais?
          </h1>
        </div>

        <Card className="border-primary/20">
          <CardContent className="pt-6 pb-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Você completou os 3 questionários principais. Em instantes vamos gerar
              seus arquétipos e estratégia.
            </p>
            <p>
              Antes disso, tem um questionário <strong className="text-foreground">OPCIONAL (~10 min)</strong> que personaliza muito
              mais o seu conteúdo:
            </p>
            <ul className="space-y-2 pl-1">
              <li className="flex gap-2"><span className="text-primary">·</span><span><strong className="text-foreground">Suas expressões pessoais</strong> — pra IA escrever no seu jeito de falar</span></li>
              <li className="flex gap-2"><span className="text-primary">·</span><span><strong className="text-foreground">Objeções literais da sua audiência</strong> — pra criar posts que rebatem direto</span></li>
              <li className="flex gap-2"><span className="text-primary">·</span><span><strong className="text-foreground">Casos reais</strong> — pra citar como prova social</span></li>
              <li className="flex gap-2"><span className="text-primary">·</span><span><strong className="text-foreground">Assuntos que você não quer tocar</strong> — pra IA nunca passar do limite</span></li>
            </ul>
            <p>
              Esses dados enriquecem <strong className="text-foreground">TODA a sua linha editorial semanal</strong> E desbloqueiam
              o módulo <strong className="text-foreground">Stories de Venda</strong>.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            size="lg"
            className="flex-1 gap-2"
            onClick={() => navigate("/sales-narrative?from=intro")}
          >
            <Sparkles className="h-4 w-4" />
            Fazer agora (~10 min)
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => navigate("/results")}
          >
            <SkipForward className="h-4 w-4" />
            Pular — posso fazer depois
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SalesNarrativeIntro;
