import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, FileText, Users, Target, Heart, BookOpen, Compass, Zap, Megaphone, Star, Shield, Copy, ArrowRight, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { parseReportContent } from "@/lib/reportParser";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CleanText } from "@/components/CleanText";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils";

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
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

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

  const toggleItem = (key: string) => {
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    DETAIL_ITEMS.forEach(item => { all[item.key] = true; });
    setOpenItems(all);
  };

  const collapseAll = () => setOpenItems({});

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  if (loading) {
    return (
      <DashboardLayout>
      <SeoHead title="Narrativa da Marca · Posiciona" description="Sua narrativa StoryBrand estruturada." path="/storybrand" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  const { contentObject, hasStorybrand } = parseReportContent(report?.content);
  const storybrand = contentObject?.storybrand;

  if (!hasStorybrand || !storybrand) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Narrativa da Marca não disponível</h2>
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

  const getPreviewText = (val: any): string => {
    const text = Array.isArray(val) ? val[0] : val;
    if (typeof text !== "string") return "";
    const clean = text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
    return clean.length > 120 ? clean.slice(0, 120) + "…" : clean;
  };

  const anyOpen = Object.values(openItems).some(Boolean);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <SectionHeader
            title="Narrativa da Marca"
            subtitle="Sua jornada StoryBrand aplicada ao posicionamento"
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={anyOpen ? collapseAll : expandAll}
          >
            {anyOpen ? "Recolher tudo" : "Expandir tudo"}
          </Button>
        </div>

        {/* Summary */}
        {summaryParts.length > 0 && (
          <Card className="border-primary/20 bg-primary/[0.04]">
            <CardContent className="py-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">Resumo executivo</p>
              <p className="text-sm text-foreground/85 leading-relaxed font-medium">
                <CleanText as="span">{summaryParts.join(", ") + "."}</CleanText>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Detail blocks — Collapsible */}
        <div className="space-y-2">
          {DETAIL_ITEMS.map(item => {
            const val = storybrand[item.key];
            if (!val) return null;
            const Icon = item.icon;
            const textContent = Array.isArray(val) ? val.join("\n") : val;
            const isOpen = !!openItems[item.key];

            return (
              <Collapsible key={item.key} open={isOpen} onOpenChange={() => toggleItem(item.key)}>
                <Card className={cn(
                  "transition-colors",
                  isOpen && "border-primary/15"
                )}>
                  <CardContent className="py-0">
                    <CollapsibleTrigger className="w-full py-3.5 flex items-center gap-3 text-left group">
                      <div className="flex items-center gap-2 text-primary flex-shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="font-semibold text-sm flex-1">{item.label}</h3>
                      {!isOpen && (
                        <span className="text-xs text-muted-foreground truncate max-w-[40%] hidden sm:block">
                          {getPreviewText(val)}
                        </span>
                      )}
                      <ChevronDown className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0",
                        isOpen && "rotate-180"
                      )} />
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="pb-4 pt-1 border-t border-border/50">
                        <div className="flex justify-end mb-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); copyText(textContent); }}
                            className="p-1 rounded-md hover:bg-muted transition-colors"
                            title="Copiar"
                          >
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="text-sm text-foreground/80 leading-relaxed">
                          {Array.isArray(val)
                            ? val.map((v: string, i: number) => (
                                <span key={i} className="block mb-1">
                                  {i + 1}. <CleanText as="span">{v}</CleanText>
                                </span>
                              ))
                            : <CleanText as="span">{val}</CleanText>}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>
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
