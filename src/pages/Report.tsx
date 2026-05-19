import { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Loader2, Download, FileText, Palette, Type, MessageSquare,
  Target, Crown, Shield, Heart,
  Users, Zap, BookOpen, Compass, Star, Megaphone,
  Shirt, Gem, Scissors, Eye, Ban, AlertTriangle, RefreshCw, Calendar, ArrowRight, Sparkles, X, ArrowUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getReportFallbackText, parseReportContent } from "@/lib/reportParser";
import { normalizeReportContent } from "@/lib/reportParser";
import { ReportPdfDocument } from "@/components/report/ReportPdfDocument";

const STORYBRAND_ITEMS = [
  { key: "hero", label: "O Herói (Cliente)", icon: <Users className="h-5 w-5" /> },
  { key: "guide", label: "O Guia (Marca)", icon: <Compass className="h-5 w-5" /> },
  { key: "external_problem", label: "Problema Externo", icon: <Target className="h-5 w-5" /> },
  { key: "internal_problem", label: "Problema Interno", icon: <Heart className="h-5 w-5" /> },
  { key: "philosophical_problem", label: "Problema Filosófico", icon: <BookOpen className="h-5 w-5" /> },
  { key: "plan", label: "O Plano", icon: <Zap className="h-5 w-5" /> },
  { key: "cta", label: "Chamada para Ação", icon: <Megaphone className="h-5 w-5" /> },
  { key: "success", label: "O Sucesso", icon: <Star className="h-5 w-5" /> },
  { key: "failure", label: "O Fracasso", icon: <Shield className="h-5 w-5" /> },
];

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1a1a2e" : "#ffffff";
}

const SALES_NARRATIVE_BANNER_KEY = "posiciona:sales-narrative-banner-dismissed";

const Report = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [topArchetypes, setTopArchetypes] = useState<any[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showNarrativeBanner, setShowNarrativeBanner] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showBackTop, setShowBackTop] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    if (typeof window !== "undefined" && localStorage.getItem(SALES_NARRATIVE_BANNER_KEY) === "1") return;
    supabase
      .from("sales_narrative_questionnaires")
      .select("is_complete")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data || !data.is_complete) setShowNarrativeBanner(true);
      });
  }, [user]);

  const dismissNarrativeBanner = () => {
    setShowNarrativeBanner(false);
    try { localStorage.setItem(SALES_NARRATIVE_BANNER_KEY, "1"); } catch {}
  };

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("reports").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single(),
      supabase.from("user_top_archetypes").select("*").eq("user_id", user.id).order("rank", { ascending: true }).limit(3),
      supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
    ]).then(([reportRes, archRes, profRes]) => {
      setReport(reportRes.data);
      setTopArchetypes(archRes.data || []);
      setUserName(profRes.data?.full_name || null);
      setLoading(false);
    });
  }, [user]);

  // Poll while report is being generated, so the user sees updates after switching tabs
  useEffect(() => {
    if (!user || !report) return;
    if (report.status !== "generating" && report.status !== "pending") return;

    let cancelled = false;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("reports")
        .select("*")
        .eq("user_id", user.id)
        .order("version", { ascending: false })
        .limit(1)
        .single();
      if (cancelled || !data) return;
      if (data.status !== report.status || data.updated_at !== report.updated_at) {
        setReport(data);
        if (data.status === "completed") {
          toast({ title: "Relatório pronto", description: "Sua estratégia acabou de ficar disponível." });
        } else if (data.status === "failed") {
          toast({ title: "Falha na geração", description: data.error_message || "Tente regenerar.", variant: "destructive" });
        }
      }
    }, 4000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [user, report?.status, report?.updated_at]);

  const { contentObject, isStructuredReport, hasEditorial, hasFigurino, hasSimbolos } = parseReportContent(report?.content);
  const content = contentObject ?? {};
  const fallbackText = getReportFallbackText(report?.content);
  const hasMissingSections = isStructuredReport && (!hasFigurino || !hasSimbolos);
  const structuredEditorial = Array.isArray(content.editorial) ? content.editorial : [];
  const editorialWeeks: any[][] = Array.isArray(report?.editorial_weeks) ? report.editorial_weeks : [];
  const allWeeks = [
    ...(hasEditorial && structuredEditorial.length > 0 ? [structuredEditorial] : []),
    ...editorialWeeks,
  ];

  // Build archetypes from user_top_archetypes table, with descriptions from LLM content
  const getArchetypeData = () => {
    if (topArchetypes.length === 0) return null;
    const rankKeys = ["primary", "secondary", "tertiary"];
    return topArchetypes.map((arch, i) => {
      // Try to find matching description from LLM content
      const llmArchetypes = content?.archetypes || {};
      let description = "";
      let application = "";
      let llmMatch: any = null;
      for (const key of rankKeys) {
        const llm = llmArchetypes[key];
        if (llm && llm.name && llm.name.toLowerCase() === arch.archetype_name.toLowerCase()) {
          description = llm.description || "";
          application = llm.application || "";
          llmMatch = llm;
          break;
        }
      }
      return {
        name: arch.archetype_name,
        rank: i,
        label: i === 0 ? "Primário" : i === 1 ? "Secundário" : "Terciário",
        score: arch.score,
        description,
        application,
        characteristics: llmMatch?.characteristics || [],
        brands: llmMatch?.brands || [],
        people: llmMatch?.people || [],
      };
    });
  };

  // Helper to find matching LLM archetype
  const findLlmMatch = (archName: string) => {
    const llmArchetypes = content?.archetypes || {};
    const rankKeys = ["primary", "secondary", "tertiary"];
    for (const key of rankKeys) {
      const llm = llmArchetypes[key];
      if (llm && llm.name && llm.name.toLowerCase() === archName.toLowerCase()) {
        return llm;
      }
    }
    return null;
  };

  const handleRegenerate = async () => {
    if (!user) return;
    setRegenerating(true);
    try {
      const [{ data: bqData }, { data: profile }, { data: topArch }] = await Promise.all([
        supabase.from("business_questionnaires").select("*").eq("user_id", user.id).eq("is_complete", true).order("version", { ascending: false }).limit(1).single(),
        supabase.from("profiles").select("niche, gender").eq("user_id", user.id).single(),
        supabase.from("user_top_archetypes").select("*").eq("user_id", user.id).order("rank", { ascending: true }).limit(3),
      ]);
      if (!bqData) { toast({ title: "Questionário de negócio não encontrado", variant: "destructive" }); return; }
      const top3 = topArch || [];
      const archetypes = {
        primary: { archetype_name: top3[0]?.archetype_name, score: top3[0]?.score },
        secondary: { archetype_name: top3[1]?.archetype_name, score: top3[1]?.score },
        tertiary: { archetype_name: top3[2]?.archetype_name, score: top3[2]?.score },
      };
      const newVersion = (report?.version || 1) + 1;
      const { data: inserted, error: insertError } = await supabase.from("reports").insert({
        user_id: user.id,
        status: "generating",
        error_message: null,
        version: newVersion,
      }).select("id, version, status").single();
      if (insertError || !inserted) throw insertError || new Error("Não foi possível criar a nova versão do relatório.");

      const { data: queueData, error } = await supabase.functions.invoke("generate-report", {
        body: {
          business: bqData,
          niche: profile?.niche || "",
          archetypes,
          gender: profile?.gender || "Não informado",
          reportId: inserted.id,
          reportVersion: inserted.version,
          force: true,
        },
      });
      if (error) throw error;
      setReport({ ...report, id: inserted.id, status: "generating", version: inserted.version, error_message: null });
      toast({ title: queueData?.jobId ? "Regeneração iniciada" : "Relatório enviado para geração" });
    } catch (err: any) {
      console.error("Regenerate error:", err);
      toast({ title: "Erro ao regenerar", description: err.message, variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);

    // Mount the PDF document on-demand in a hidden off-screen container,
    // capture it, then unmount — avoids permanently duplicating the report DOM.
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:absolute;left:-9999px;top:0;width:900px;pointer-events:none;";
    document.body.appendChild(host);
    const root = createRoot(host);

    try {
      await new Promise<void>((resolve) => {
        root.render(
          <ReportPdfDocument
            content={content}
            archetypes={archetypeData}
            createdAt={report?.created_at}
            userName={userName}
          />
        );
        // Wait two frames so layout settles before html2canvas captures.
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const { exportSectionBasedPDF } = await import("@/lib/pdfExport");
      await exportSectionBasedPDF(host, "posiciona-relatorio.pdf", "#FAF8F5");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erro ao gerar PDF", description: "Tente novamente.", variant: "destructive" });
    } finally {
      root.unmount();
      host.remove();
      setDownloadingPdf(false);
    }
  };

  // Back-to-top button visibility
  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 800);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const formatGeneratedAt = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const date = d.toLocaleDateString("pt-BR");
    const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `${date} às ${time}`;
  };


  if (loading) {
    return (
      <DashboardLayout>
      <SeoHead title="Relatório · Posiciona" description="Seu relatório completo de posicionamento de marca." path="/report" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!report || (report.status !== "completed" && report.status !== "generating" && report.status !== "pending")) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold font-display">Nenhum relatório disponível</h2>
          <p className="text-muted-foreground mt-1">Complete os questionários e gere seu relatório na página de resultados.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (report.status === "generating" || report.status === "pending") {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
          <h2 className="text-xl font-bold font-display">Gerando seu relatório...</h2>
          <p className="text-muted-foreground mt-1">Sua estratégia está sendo criada. Volte em alguns instantes.</p>
        </div>
      </DashboardLayout>
    );
  }

  // Fallback for old text-based reports
  if (!isStructuredReport) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold font-display">Seu Relatório</h1>
              <p className="text-sm text-muted-foreground">Gerado em {formatGeneratedAt(report.created_at)}</p>
            </div>
            <Button onClick={handleDownloadPDF} disabled={downloadingPdf} className="gap-2">
              {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloadingPdf ? "Gerando PDF..." : "Baixar PDF"}
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6 prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm">{fallbackText}</div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const archetypeData = getArchetypeData();

  return (
    <DashboardLayout>
      <div className="space-y-10" ref={reportRef}>
        {/* Header */}
        <div data-pdf-section className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Seu Relatório</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerado em {formatGeneratedAt(report.created_at)}</p>
          </div>
          <div className="flex gap-2" data-hide-pdf>
            <Button onClick={handleDownloadPDF} disabled={downloadingPdf} variant="outline" size="sm" className="gap-2">
              {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloadingPdf ? "Gerando PDF..." : "Baixar PDF"}
            </Button>
          </div>
        </div>

        {/* Sales Narrative recovery banner */}
        {showNarrativeBanner && (
          <div data-hide-pdf className="relative flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground leading-relaxed flex-1">
              Existe um questionário opcional (~10 min) que enriquece sua linha
              editorial com suas expressões pessoais, objeções reais da sua audiência
              e casos de prova.{" "}
              <button
                onClick={() => navigate("/sales-narrative")}
                className="font-medium text-primary hover:underline"
              >
                Preencher agora
              </button>
            </p>
            <button
              onClick={dismissNarrativeBanner}
              className="text-muted-foreground hover:text-foreground p-0.5 -m-0.5 flex-shrink-0"
              aria-label="Dispensar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* CTA: Linha Editorial — próximo passo */}
        {!report?.content?.is_fallback && (
          <div data-hide-pdf>
            <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
              <CardContent className="pt-6 pb-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                <div className="flex items-start gap-3 flex-1">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold tracking-tight">
                      {(report?.editorial_weeks?.length ?? 0) > 0 ? "Sua Linha Editorial está pronta" : "Próximo passo: sua Linha Editorial"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {(report?.editorial_weeks?.length ?? 0) > 0
                        ? "Acesse as 6 semanas de conteúdo construídas a partir desta estratégia."
                        : "Transforme sua estratégia em 6 semanas de conteúdo prontas para postar."}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate("/editorial")}
                  size="lg"
                  className="gap-2 shrink-0 w-full md:w-auto"
                >
                  {(report?.editorial_weeks?.length ?? 0) > 0 ? "Acessar Linha Editorial" : "Gerar Linha Editorial"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Fallback (modelo simplificado) */}
        {report?.content?.is_fallback && (
          <div data-hide-pdf>
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-400">Versão simplificada</AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                Esta estratégia foi gerada em modo simplificado porque a IA não respondeu a tempo. Como você não tem culpa pela falha, a regeneração para tentar a versão completa é gratuita.
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-3 gap-1.5"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                >
                  {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Regenerar gratuitamente
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Missing sections warning */}
        {hasMissingSections && (
          <div data-hide-pdf>
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-400">Relatório incompleto</AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                Seu relatório foi gerado em uma versão anterior e não inclui {!hasFigurino && !hasSimbolos ? "figurino e símbolos" : !hasFigurino ? "figurino" : "símbolos"}.
                Regenere para incluir essas seções.
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-3 gap-1.5"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                >
                  {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Regenerar relatório
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* SECTION: Archetypes — from user_top_archetypes table */}
        <section data-pdf-section>
          <div className="flex items-center gap-2 mb-4">
            <Crown className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold font-display">Seus Arquétipos de Marca</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3 break-inside-avoid-column">
            {archetypeData ? archetypeData.map((a) => (
              <Card key={a.name} className="relative overflow-hidden border-2 border-primary/20 hover:border-primary/40 transition-colors break-inside-avoid">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-accent" />
                <CardContent className="pt-8 pb-6">
                  <Badge variant="outline" className="mb-3 text-xs">{a.label}</Badge>
                  <h3 className="text-lg font-bold font-display mb-2">{a.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a.description}</p>
                  {a.characteristics?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {a.characteristics.map((c: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  )}
                  {a.brands?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Marcas de referência</p>
                      <p className="text-sm text-foreground/80">{a.brands.join(" · ")}</p>
                    </div>
                  )}
                  {a.people?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Personalidades</p>
                      <p className="text-sm text-foreground/80">{a.people.join(" · ")}</p>
                    </div>
                  )}
                  {a.application && (
                    <p className="text-sm mt-3 p-3 rounded-lg bg-primary/5 text-foreground/80">{a.application}</p>
                  )}
                </CardContent>
              </Card>
            )) : (["primary", "secondary", "tertiary"] as const).map((rank, i) => {
              const a = content.archetypes?.[rank];
              if (!a) return null;
              const labels = ["Primário", "Secundário", "Terciário"];
              return (
                <Card key={rank} className="relative overflow-hidden border-2 border-primary/20 hover:border-primary/40 transition-colors break-inside-avoid">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-accent" />
                  <CardContent className="pt-8 pb-6">
                    <Badge variant="outline" className="mb-3 text-xs">{labels[i]}</Badge>
                    <h3 className="text-lg font-bold font-display mb-2">{a.name}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{a.description}</p>
                    {a.application && (
                      <p className="text-sm mt-3 p-3 rounded-lg bg-primary/5 text-foreground/80">{a.application}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* SECTION: Color Palette */}
        {content.visual_identity?.palette && (
          <section data-pdf-section className="bg-muted/30 rounded-2xl p-6 md:p-8 break-inside-avoid">
            <div className="flex items-center gap-2 mb-6">
              <Palette className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Paleta de Cores</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {content.visual_identity.palette.map((color: any, i: number) => (
                <div key={i} className="group">
                  <div
                    className="aspect-square rounded-xl shadow-md flex flex-col items-center justify-center p-3 transition-transform group-hover:scale-105"
                    style={{ backgroundColor: color.hex, color: getContrastColor(color.hex) }}
                  >
                    <span className="text-xs font-bold opacity-90 mb-1">{color.name}</span>
                    <span className="text-xs font-mono opacity-70">{color.hex}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center leading-tight">{color.usage}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION: Typography & Style */}
        {content.visual_identity && (
          <section data-pdf-section>
            <div className="flex items-center gap-2 mb-4">
              <Type className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Tipografia e Estilo</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {content.visual_identity.typography && (
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <h3 className="font-bold font-display text-sm uppercase tracking-wider text-muted-foreground">Tipografia</h3>
                    {content.visual_identity.typography.display && <p className="text-sm"><span className="font-semibold">Display:</span> {content.visual_identity.typography.display}</p>}
                    {content.visual_identity.typography.body && <p className="text-sm"><span className="font-semibold">Corpo:</span> {content.visual_identity.typography.body}</p>}
                    {content.visual_identity.typography.accent && <p className="text-sm"><span className="font-semibold">Destaque:</span> {content.visual_identity.typography.accent}</p>}
                  </CardContent>
                </Card>
              )}
              {content.visual_identity.style && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-bold font-display text-sm uppercase tracking-wider text-muted-foreground mb-2">Estilo Visual</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed">{content.visual_identity.style}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* SECTION: Tone of Voice */}
        {content.tone_of_voice && (
          <section data-pdf-section className="bg-muted/30 rounded-2xl p-6 md:p-8 break-inside-avoid">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Tom de Voz</h2>
            </div>
            <div className="space-y-4">
              {content.tone_of_voice.summary && <p className="text-sm leading-relaxed">{content.tone_of_voice.summary}</p>}
              {content.tone_of_voice.communication_style && <p className="text-sm leading-relaxed text-foreground/80">{content.tone_of_voice.communication_style}</p>}
              <div className="grid gap-3 md:grid-cols-3 mt-4">
                {content.tone_of_voice.words_to_use?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-green-600 mb-2">✓ Palavras para usar</h4>
                    <div className="flex flex-wrap gap-1.5">{content.tone_of_voice.words_to_use.map((w: string, i: number) => <Badge key={i} variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">{w}</Badge>)}</div>
                  </div>
                )}
                {content.tone_of_voice.words_to_avoid?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2">✗ Palavras para evitar</h4>
                    <div className="flex flex-wrap gap-1.5">{content.tone_of_voice.words_to_avoid.map((w: string, i: number) => <Badge key={i} variant="outline" className="text-xs bg-red-50 border-red-200 text-red-700">{w}</Badge>)}</div>
                  </div>
                )}
                {content.tone_of_voice.emotions_to_evoke?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">♡ Emoções para evocar</h4>
                    <div className="flex flex-wrap gap-1.5">{content.tone_of_voice.emotions_to_evoke.map((w: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{w}</Badge>)}</div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* SECTION: Figurino Estratégico */}
        {content.figurino && (
          <section data-pdf-section className="bg-muted/30 rounded-2xl p-6 md:p-8 break-inside-avoid">
            <div className="flex items-center gap-2 mb-6">
              <Shirt className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Figurino Estratégico</h2>
            </div>
            {content.figurino.resumo && (
              <p className="text-sm leading-relaxed mb-6">{content.figurino.resumo}</p>
            )}
            <Accordion type="multiple" defaultValue={["pecas_chave"]} className="w-full">
              {content.figurino.pecas_chave?.length > 0 && (
                <AccordionItem value="pecas_chave">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-primary">
                      <Shirt className="h-4 w-4" />
                      <span className="font-bold font-display text-sm">Peças-chave</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1.5 pt-1">{content.figurino.pecas_chave.map((p: string, i: number) => <li key={i} className="text-sm text-foreground/80">• {p}</li>)}</ul>
                  </AccordionContent>
                </AccordionItem>
              )}
              {content.figurino.cores_roupa?.length > 0 && (
                <AccordionItem value="cores_roupa">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-primary">
                      <Palette className="h-4 w-4" />
                      <span className="font-bold font-display text-sm">Cores de Roupa</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-wrap gap-1.5 pt-1">{content.figurino.cores_roupa.map((c: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{c}</Badge>)}</div>
                  </AccordionContent>
                </AccordionItem>
              )}
              {content.figurino.sapatos?.length > 0 && (
                <AccordionItem value="sapatos">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-primary">
                      <Compass className="h-4 w-4" />
                      <span className="font-bold font-display text-sm">Sapatos</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1.5 pt-1">{content.figurino.sapatos.map((s: string, i: number) => <li key={i} className="text-sm text-foreground/80">• {s}</li>)}</ul>
                  </AccordionContent>
                </AccordionItem>
              )}
              {content.figurino.acessorios?.length > 0 && (
                <AccordionItem value="acessorios">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-primary">
                      <Gem className="h-4 w-4" />
                      <span className="font-bold font-display text-sm">Acessórios</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1.5 pt-1">{content.figurino.acessorios.map((a: string, i: number) => <li key={i} className="text-sm text-foreground/80">• {a}</li>)}</ul>
                  </AccordionContent>
                </AccordionItem>
              )}
              {content.figurino.cabelo && (
                <AccordionItem value="cabelo">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-primary">
                      <Scissors className="h-4 w-4" />
                      <span className="font-bold font-display text-sm">Cabelo</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-foreground/80 leading-relaxed pt-1">{content.figurino.cabelo}</p>
                  </AccordionContent>
                </AccordionItem>
              )}
              {content.figurino.maquiagem_grooming && (
                <AccordionItem value="maquiagem">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-primary">
                      <Eye className="h-4 w-4" />
                      <span className="font-bold font-display text-sm">Maquiagem / Grooming</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-foreground/80 leading-relaxed pt-1">{content.figurino.maquiagem_grooming}</p>
                  </AccordionContent>
                </AccordionItem>
              )}
              {content.figurino.evitar?.length > 0 && (
                <AccordionItem value="evitar">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-destructive">
                      <Ban className="h-4 w-4" />
                      <span className="font-bold font-display text-sm">Evitar</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1.5 pt-1">{content.figurino.evitar.map((e: string, i: number) => <li key={i} className="text-sm text-foreground/80">• {e}</li>)}</ul>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </section>
        )}

        {/* SECTION: Figurino — new expanded fields */}
        {content.figurino?.looks_completos?.length > 0 && (
          <section data-pdf-section className="break-inside-avoid">
            <div className="flex items-center gap-2 mb-4">
              <Shirt className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Looks Completos</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {content.figurino.looks_completos.map((look: any, i: number) => (
                <Card key={i}>
                  <CardContent className="pt-5 pb-4">
                    <h3 className="font-bold font-display text-sm mb-2">{look.nome}</h3>
                    <ul className="space-y-1 mb-2">{(look.pecas || []).map((p: string, j: number) => <li key={j} className="text-sm text-foreground/80">• {p}</li>)}</ul>
                    {look.ocasiao && <p className="text-xs text-muted-foreground italic">📍 {look.ocasiao}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {(content.figurino?.texturas_tecidos?.length > 0 || content.figurino?.estampas?.length > 0) && (
          <section data-pdf-section className="break-inside-avoid">
            <div className="grid gap-4 md:grid-cols-2">
              {content.figurino.texturas_tecidos?.length > 0 && (
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <h3 className="font-bold font-display text-sm mb-2">Tecidos & Texturas</h3>
                    <div className="flex flex-wrap gap-1.5">{content.figurino.texturas_tecidos.map((t: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{t}</Badge>)}</div>
                  </CardContent>
                </Card>
              )}
              {content.figurino.estampas?.length > 0 && (
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <h3 className="font-bold font-display text-sm mb-2">Estampas</h3>
                    <div className="flex flex-wrap gap-1.5">{content.figurino.estampas.map((e: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{e}</Badge>)}</div>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* SECTION: Símbolos dos Arquétipos — now supports arrays */}
        {content.simbolos && (
          <section data-pdf-section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Símbolos dos Arquétipos</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {(["primary", "secondary", "tertiary"] as const).map((rank, idx) => {
                const symbolData = content.simbolos[rank];
                if (!symbolData) return null;
                const labels = ["Primário", "Secundário", "Terciário"];
                const symbols = Array.isArray(symbolData) ? symbolData : [symbolData];
                return (
                  <Card key={rank} className="relative overflow-hidden border-2 border-primary/20 hover:border-primary/40 transition-colors break-inside-avoid">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-accent" />
                    <CardContent className="pt-8 pb-6">
                      <Badge variant="outline" className="mb-3 text-xs">{labels[idx]}</Badge>
                      {symbols.map((s: any, si: number) => (
                        <div key={si} className={si > 0 ? "mt-4 pt-4 border-t" : ""}>
                          <h3 className="text-lg font-bold font-display mb-1">{s.nome}</h3>
                          <p className="text-2xl mb-2">{s.simbolo}</p>
                          <p className="text-sm text-muted-foreground leading-relaxed mb-1"><span className="font-semibold">Significado:</span> {s.significado}</p>
                          <p className="text-sm p-2 rounded-lg bg-primary/5 text-foreground/80 text-xs"><span className="font-semibold">Aplicação:</span> {s.aplicacao}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* SECTION: StoryBrand */}
        {content.storybrand && (
          <section data-pdf-section>
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Narrativa da Marca</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {STORYBRAND_ITEMS.map(item => {
                const val = content.storybrand[item.key];
                if (!val) return null;
                return (
                  <Card key={item.key} className="hover:shadow-md transition-shadow break-inside-avoid">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-2 mb-2 text-primary">
                        {item.icon}
                        <h3 className="font-bold font-display text-sm">{item.label}</h3>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {Array.isArray(val) ? val.map((v: string, i: number) => <span key={i} className="block">{i + 1}. {v}</span>) : val}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

      </div>

      {/* Hidden PDF-export-only document — text-first layout */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: -9999, top: 0, width: 900, pointerEvents: "none" }}
      >
        <div ref={pdfRef}>
          <ReportPdfDocument
            content={content}
            archetypes={archetypeData}
            createdAt={report?.created_at}
            userName={userName}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Report;
