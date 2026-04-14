import { useEffect, useState, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Download, FileText, Palette, Type, MessageSquare,
  Target, Crown, Shield, Heart,
  Users, Zap, BookOpen, Compass, Star, Megaphone,
  Shirt, Gem, Scissors, Eye, Ban, AlertTriangle, RefreshCw
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getReportFallbackText, parseReportContent } from "@/lib/reportParser";
import { normalizeReportContent } from "@/lib/reportParser";

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

const Report = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [topArchetypes, setTopArchetypes] = useState<any[]>([]);
  const [regenerating, setRegenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!user) return;
    // Fetch report and top archetypes in parallel
    Promise.all([
      supabase.from("reports").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single(),
      supabase.from("user_top_archetypes").select("*").eq("user_id", user.id).order("rank", { ascending: true }).limit(3),
    ]).then(([reportRes, archRes]) => {
      setReport(reportRes.data);
      setTopArchetypes(archRes.data || []);
      setLoading(false);
    });
  }, [user]);

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
      // Search across all LLM archetype slots for matching name
      for (const key of rankKeys) {
        const llm = llmArchetypes[key];
        if (llm && llm.name && llm.name.toLowerCase() === arch.archetype_name.toLowerCase()) {
          description = llm.description || "";
          application = llm.application || "";
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
      };
    });
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
      const { data: reportData, error } = await supabase.functions.invoke("generate-report", {
        body: { business: bqData, niche: profile?.niche || "", archetypes, gender: profile?.gender || "Não informado" },
      });
      if (error) throw error;
      const normalizedContent = normalizeReportContent(reportData?.report) as any;
      // Create new version instead of updating existing
      const newVersion = (report?.version || 1) + 1;
      await supabase.from("reports").insert({
        user_id: user.id,
        content: normalizedContent,
        status: "completed",
        version: newVersion,
      });
      setReport({ ...report, content: normalizedContent, status: "completed", version: newVersion });
      toast({ title: "Relatório regenerado com sucesso!" });
    } catch (err: any) {
      console.error("Regenerate error:", err);
      toast({ title: "Erro ao regenerar", description: err.message, variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    try {
      const { exportSectionBasedPDF } = await import("@/lib/pdfExport");
      await exportSectionBasedPDF(reportRef.current, "posiciona-relatorio.pdf");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erro ao gerar PDF", description: "Tente novamente.", variant: "destructive" });
    }
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

  if (!report || report.status !== "completed") {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold font-display">Nenhum relatório disponível</h2>
          <p className="text-muted-foreground mt-1">
            {report?.status === "generating" ? "Seu relatório está sendo gerado..." : "Complete os questionários e gere seu relatório na página de resultados."}
          </p>
          {report?.status === "generating" && <Loader2 className="h-6 w-6 animate-spin text-primary mt-4" />}
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
              <p className="text-sm text-muted-foreground">Gerado em {new Date(report.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
            <Button onClick={handleDownloadPDF} className="gap-2"><Download className="h-4 w-4" /> Baixar PDF</Button>
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
            <p className="text-sm text-muted-foreground mt-1">Gerado em {new Date(report.created_at).toLocaleDateString("pt-BR")}</p>
          </div>
          <div className="flex gap-2" data-hide-pdf>
            <Button onClick={handleDownloadPDF} variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> Baixar PDF</Button>
          </div>
        </div>

        {/* Missing sections warning */}
        {hasMissingSections && (<div data-hide-pdf>
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
        )}

        {/* SECTION: Archetypes — from user_top_archetypes table */}
        <section>
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
          <section className="bg-muted/30 rounded-2xl p-6 md:p-8 break-inside-avoid">
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
          <section>
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
                    <h3 className="font-bold font-display text-sm uppercase tracking-wider text-muted-foreground mb-2">Estilo Visual & Figurino</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed">{content.visual_identity.style}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* SECTION: Tone of Voice */}
        {content.tone_of_voice && (
          <section className="bg-muted/30 rounded-2xl p-6 md:p-8 break-inside-avoid">
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
          <section className="bg-muted/30 rounded-2xl p-6 md:p-8 break-inside-avoid">
            <div className="flex items-center gap-2 mb-6">
              <Shirt className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Figurino Estratégico</h2>
            </div>
            {content.figurino.resumo && (
              <p className="text-sm leading-relaxed mb-6">{content.figurino.resumo}</p>
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {content.figurino.pecas_chave?.length > 0 && (
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 mb-3 text-primary">
                      <Shirt className="h-4 w-4" />
                      <h3 className="font-bold font-display text-sm">Peças-chave</h3>
                    </div>
                    <ul className="space-y-1.5">{content.figurino.pecas_chave.map((p: string, i: number) => <li key={i} className="text-sm text-foreground/80">• {p}</li>)}</ul>
                  </CardContent>
                </Card>
              )}
              {content.figurino.cores_roupa?.length > 0 && (
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 mb-3 text-primary">
                      <Palette className="h-4 w-4" />
                      <h3 className="font-bold font-display text-sm">Cores de Roupa</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">{content.figurino.cores_roupa.map((c: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{c}</Badge>)}</div>
                  </CardContent>
                </Card>
              )}
              {content.figurino.sapatos?.length > 0 && (
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 mb-3 text-primary">
                      <Compass className="h-4 w-4" />
                      <h3 className="font-bold font-display text-sm">Sapatos</h3>
                    </div>
                    <ul className="space-y-1.5">{content.figurino.sapatos.map((s: string, i: number) => <li key={i} className="text-sm text-foreground/80">• {s}</li>)}</ul>
                  </CardContent>
                </Card>
              )}
              {content.figurino.acessorios?.length > 0 && (
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 mb-3 text-primary">
                      <Gem className="h-4 w-4" />
                      <h3 className="font-bold font-display text-sm">Acessórios</h3>
                    </div>
                    <ul className="space-y-1.5">{content.figurino.acessorios.map((a: string, i: number) => <li key={i} className="text-sm text-foreground/80">• {a}</li>)}</ul>
                  </CardContent>
                </Card>
              )}
              {content.figurino.cabelo && (
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 mb-3 text-primary">
                      <Scissors className="h-4 w-4" />
                      <h3 className="font-bold font-display text-sm">Cabelo</h3>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{content.figurino.cabelo}</p>
                  </CardContent>
                </Card>
              )}
              {content.figurino.maquiagem_grooming && (
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 mb-3 text-primary">
                      <Eye className="h-4 w-4" />
                      <h3 className="font-bold font-display text-sm">Maquiagem / Grooming</h3>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{content.figurino.maquiagem_grooming}</p>
                  </CardContent>
                </Card>
              )}
              {content.figurino.evitar?.length > 0 && (
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 mb-3 text-destructive">
                      <Ban className="h-4 w-4" />
                      <h3 className="font-bold font-display text-sm">Evitar</h3>
                    </div>
                    <ul className="space-y-1.5">{content.figurino.evitar.map((e: string, i: number) => <li key={i} className="text-sm text-foreground/80">• {e}</li>)}</ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* SECTION: Símbolos dos Arquétipos */}
        {content.simbolos && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Símbolos dos Arquétipos</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {(["primary", "secondary", "tertiary"] as const).map((rank, idx) => {
                const s = content.simbolos[rank];
                if (!s) return null;
                const labels = ["Primário", "Secundário", "Terciário"];
                return (
                  <Card key={rank} className="relative overflow-hidden border-2 border-primary/20 hover:border-primary/40 transition-colors break-inside-avoid">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-accent" />
                    <CardContent className="pt-8 pb-6">
                      <Badge variant="outline" className="mb-2 text-xs">{labels[idx]}</Badge>
                      <h3 className="text-lg font-bold font-display mb-1">{s.nome}</h3>
                      <p className="text-2xl mb-3">{s.simbolo}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-2"><span className="font-semibold">Significado:</span> {s.significado}</p>
                      <p className="text-sm p-3 rounded-lg bg-primary/5 text-foreground/80"><span className="font-semibold">Aplicação:</span> {s.aplicacao}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* SECTION: StoryBrand */}
        {content.storybrand && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Estratégia StoryBrand</h2>
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
    </DashboardLayout>
  );
};

export default Report;
