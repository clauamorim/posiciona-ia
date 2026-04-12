import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Download, FileText, Palette, Type, MessageSquare,
  Target, Crown, Shield, Heart,
  Users, Zap, BookOpen, Compass, Star, Megaphone,
  Shirt, Gem, Scissors, Eye, Ban
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getReportFallbackText, parseReportContent } from "@/lib/reportParser";

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

  const { contentObject, isStructuredReport, hasEditorial } = parseReportContent(report?.content);
  const content = contentObject ?? {};
  const fallbackText = getReportFallbackText(report?.content);
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

  const handleDownloadPDF = async () => {
    try {
    const jsPDF = (await import("jspdf")).jsPDF;
    const doc = new jsPDF();
    let y = 20;

    const addTitle = (text: string) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(text, 20, y);
      y += 10;
    };
    const addSubtitle = (text: string) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(text, 20, y);
      y += 7;
    };
    const addBody = (text: string) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(text, 170);
      for (const line of lines) {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(line, 20, y);
        y += 5;
      }
      y += 3;
    };

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Posiciona - Relatório de Posicionamento", 20, y);
    y += 15;

    if (isStructuredReport) {
      addTitle("Arquétipos de Marca");
      const archetypeData = getArchetypeData();
      if (archetypeData) {
        archetypeData.forEach(a => {
          addSubtitle(`${a.label}: ${a.name}`);
          if (a.description) addBody(a.description);
          if (a.application) addBody(a.application);
        });
      } else {
        ["primary", "secondary", "tertiary"].forEach(rank => {
          const a = content.archetypes?.[rank];
          if (a) { addSubtitle(`${rank === "primary" ? "Primário" : rank === "secondary" ? "Secundário" : "Terciário"}: ${a.name}`); addBody(a.description || ""); addBody(a.application || ""); }
        });
      }

      addTitle("Identidade Visual");
      content.visual_identity?.palette?.forEach((c: any) => { addBody(`${c.name}: ${c.hex} — ${c.usage}`); });
      if (content.visual_identity?.typography) { addSubtitle("Tipografia"); addBody(`Display: ${content.visual_identity.typography.display || ""}`); addBody(`Corpo: ${content.visual_identity.typography.body || ""}`); }
      if (content.visual_identity?.style) { addSubtitle("Estilo Visual"); addBody(content.visual_identity.style); }

      addTitle("Tom de Voz");
      if (content.tone_of_voice?.summary) addBody(content.tone_of_voice.summary);
      if (content.tone_of_voice?.communication_style) addBody(content.tone_of_voice.communication_style);

      addTitle("Estratégia StoryBrand");
      STORYBRAND_ITEMS.forEach(item => {
        const val = content.storybrand?.[item.key];
        if (val) { addSubtitle(item.label); addBody(Array.isArray(val) ? val.join(", ") : val); }
      });

      // Figurino
      if (content.figurino) {
        addTitle("Figurino Estratégico");
        if (content.figurino.resumo) addBody(content.figurino.resumo);
        if (content.figurino.pecas_chave?.length) { addSubtitle("Peças-chave"); content.figurino.pecas_chave.forEach((p: string) => addBody(`• ${p}`)); }
        if (content.figurino.cores_roupa?.length) { addSubtitle("Cores de Roupa"); addBody(content.figurino.cores_roupa.join(", ")); }
        if (content.figurino.acessorios?.length) { addSubtitle("Acessórios"); content.figurino.acessorios.forEach((a: string) => addBody(`• ${a}`)); }
        if (content.figurino.cabelo) { addSubtitle("Cabelo"); addBody(content.figurino.cabelo); }
        if (content.figurino.maquiagem_grooming) { addSubtitle("Maquiagem / Grooming"); addBody(content.figurino.maquiagem_grooming); }
        if (content.figurino.evitar?.length) { addSubtitle("Evitar"); content.figurino.evitar.forEach((e: string) => addBody(`• ${e}`)); }
      }

      // Símbolos
      if (content.simbolos) {
        addTitle("Símbolos dos Arquétipos");
        ["primary", "secondary", "tertiary"].forEach(rank => {
          const s = content.simbolos[rank];
          if (s) { addSubtitle(`${s.nome} — ${s.simbolo}`); addBody(`Significado: ${s.significado}`); addBody(`Aplicação: ${s.aplicacao}`); }
        });
      }

      allWeeks.forEach((week, wi) => {
        addTitle(`Linha Editorial — Semana ${wi + 1}`);
        week.forEach((day: any) => {
          addSubtitle(`Dia ${day.day}: ${day.theme} (${day.format})`);
          addBody(`Legenda: ${day.caption}`);
          if (day.card_copy?.length > 0) {
            addSubtitle(day.format?.toLowerCase() === "carrossel" ? "Conteúdo dos Slides:" : "Copy do Post:");
            day.card_copy.forEach((copy: string, idx: number) => {
              addBody(day.format?.toLowerCase() === "carrossel" ? `Slide ${idx + 1}: ${copy}` : copy);
            });
          }
          addBody(`CTA: ${day.cta}`);
          if (day.script) addBody(`Roteiro: ${day.script}`);
        });
      });
    } else {
      addBody(fallbackText);
    }

    doc.save("posiciona-relatorio.pdf");
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
      <div className="space-y-10">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Suas Análises</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerado em {new Date(report.created_at).toLocaleDateString("pt-BR")}</p>
          </div>
          <Button onClick={handleDownloadPDF} variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> Baixar PDF</Button>
        </div>

        {/* SECTION: Archetypes — from user_top_archetypes table */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Crown className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold font-display">Seus Arquétipos de Marca</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {archetypeData ? archetypeData.map((a) => (
              <Card key={a.name} className="relative overflow-hidden border-2 border-primary/20 hover:border-primary/40 transition-colors">
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
                <Card key={rank} className="relative overflow-hidden border-2 border-primary/20 hover:border-primary/40 transition-colors">
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
          <section className="bg-muted/30 rounded-2xl p-6 md:p-8">
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
          <section className="bg-muted/30 rounded-2xl p-6 md:p-8">
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
          <section className="bg-muted/30 rounded-2xl p-6 md:p-8">
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
                  <Card key={rank} className="relative overflow-hidden border-2 border-primary/20 hover:border-primary/40 transition-colors">
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
                  <Card key={item.key} className="hover:shadow-md transition-shadow">
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
