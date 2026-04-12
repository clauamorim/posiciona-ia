import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, FileText, Users, Target, Heart, BookOpen, Compass, Zap, Megaphone, Star, Shield, Copy, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const DETAIL_ITEMS = [
  { key: "hero", label: "O Personagem (Cliente)", icon: Users },
  { key: "external_problem", label: "Problema Externo", icon: Target },
  { key: "internal_problem", label: "Problema Interno", icon: Heart },
  { key: "philosophical_problem", label: "Problema Filosófico", icon: BookOpen },
  { key: "guide", label: "O Guia (Marca)", icon: Compass },
  { key: "plan", label: "O Plano", icon: Zap },
  { key: "cta", label: "Chamada para Ação", icon: Megaphone },
  { key: "success", label: "O Sucesso", icon: Star },
  { key: "failure", label: "O Fracasso Evitado", icon: Shield },
];

const StoryBrand = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("reports")
      .select("*")
      .eq("user_id", user.id)
      .order("version", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { setReport(data); setLoading(false); });
  }, [user]);

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  const content = report?.content;
  const storybrand = typeof content === "object" && content !== null ? content.storybrand : null;

  if (!storybrand) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">StoryBrand não disponível</h2>
          <p className="text-muted-foreground text-sm max-w-md">
            {report?.status === "generating"
              ? "Seu relatório está sendo gerado. Aguarde..."
              : "Complete os questionários para gerar sua narrativa de marca."}
          </p>
          {report?.status === "generating" && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
          {!report && (
            <Button variant="outline" onClick={() => navigate("/archetype-questionnaire")}>
              Ir para Questionários
            </Button>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // Build executive summary
  const summaryParts = [
    storybrand.hero && `Seu cliente ${storybrand.hero}`,
    storybrand.external_problem && `enfrenta o problema de ${typeof storybrand.external_problem === 'string' ? storybrand.external_problem.toLowerCase() : ''}`,
    storybrand.guide && `e encontra em você ${typeof storybrand.guide === 'string' ? storybrand.guide.toLowerCase() : 'um guia'}`,
  ].filter(Boolean);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Narrativa de Marca</h1>
            <p className="text-sm text-muted-foreground mt-1">Sua jornada StoryBrand aplicada ao posicionamento</p>
          </div>
        </div>

        {/* Summary */}
        {summaryParts.length > 0 && (
          <Card className="border-primary/15 bg-primary/[0.02]">
            <CardContent className="py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Resumo executivo</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{summaryParts.join(", ")}.</p>
            </CardContent>
          </Card>
        )}

        {/* Detail blocks */}
        <div className="space-y-3">
          {DETAIL_ITEMS.map(item => {
            const val = storybrand[item.key];
            if (!val) return null;
            const Icon = item.icon;
            const textContent = Array.isArray(val) ? val.join("\n") : val;
            return (
              <Card key={item.key}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-primary">
                      <Icon className="h-4 w-4" />
                      <h3 className="font-semibold text-sm">{item.label}</h3>
                    </div>
                    <button
                      onClick={() => copyText(textContent)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Copiar"
                    >
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {Array.isArray(val)
                      ? val.map((v: string, i: number) => <span key={i} className="block">{i + 1}. {v}</span>)
                      : val}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Next step */}
        <Card className="border-primary/15">
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Próximo passo</p>
              <p className="text-sm font-medium mt-0.5">Veja como sua narrativa se conecta ao conteúdo</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/editorial")} className="gap-1.5 flex-shrink-0">
              Ver linha editorial <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StoryBrand;
