import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { History, FileText, Instagram, Camera, Download, Eye, ArrowRight, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PortraitPreviewDialog } from "@/components/PortraitPreviewDialog";
import jsPDF from "jspdf";

type AnalysisItem = { aspect: string; current: string; suggestion: string };

const HistoryPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [reports, setReports] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [portraits, setPortraits] = useState<any[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setProgress(20);
    const [reportsRes, analysesRes, portraitsRes] = await Promise.all([
      supabase.from("reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("instagram_analyses").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("portrait_generations").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setProgress(80);
    setReports(reportsRes.data || []);
    setAnalyses(analysesRes.data || []);
    setPortraits(portraitsRes.data || []);
    setProgress(100);
    setTimeout(() => setLoading(false), 300);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData, location.key]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const downloadPortrait = (url: string, index: number) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `retrato-marca-${index + 1}.png`;
    link.click();
  };

  const downloadAnalysisPDF = (analysis: any) => {
    const items: AnalysisItem[] = Array.isArray(analysis.analysis) ? analysis.analysis : [];
    if (items.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    doc.setFontSize(18);
    doc.text("Análise do Instagram", margin, y);
    y += 8;
    if (analysis.username) {
      doc.setFontSize(12);
      doc.text(`@${analysis.username}`, margin, y);
      y += 8;
    }
    doc.setFontSize(10);
    doc.text(formatDate(analysis.created_at), margin, y);
    y += 12;

    for (const item of items) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(item.aspect, margin, y);
      y += 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Situação Atual:", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const currentLines = doc.splitTextToSize(item.current, maxWidth);
      doc.text(currentLines, margin, y);
      y += currentLines.length * 5 + 4;
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.text("Sugestão:", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const suggestionLines = doc.splitTextToSize(item.suggestion, maxWidth);
      doc.text(suggestionLines, margin, y);
      y += suggestionLines.length * 5 + 10;
    }

    doc.save(`analise-instagram${analysis.username ? `-${analysis.username}` : ""}.pdf`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" /> Histórico
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Relatórios, análises e retratos gerados</p>
        </div>

        {loading && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">Carregando histórico...</p>
          </div>
        )}

        {!loading && (
          <Tabs defaultValue="reports">
            <TabsList>
              <TabsTrigger value="reports" className="gap-1">
                <FileText className="h-4 w-4" /> Relatórios
              </TabsTrigger>
              <TabsTrigger value="analyses" className="gap-1">
                <Instagram className="h-4 w-4" /> Análises Instagram
              </TabsTrigger>
              <TabsTrigger value="portraits" className="gap-1">
                <Camera className="h-4 w-4" /> Retratos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reports" className="mt-4">
              {reports.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum relatório encontrado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map(r => {
                    const isCompleted = r.status === "completed";
                    return (
                    <Card key={r.id} className={`${isCompleted ? "cursor-pointer hover:border-primary/40" : ""} transition-colors`} onClick={() => isCompleted && setSelectedReport(r)}>
                      <CardContent className="flex items-center justify-between py-4">
                        <div>
                          <p className="font-medium font-display">Versão {r.version}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(r.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={r.status === "completed" ? "default" : r.status === "error" ? "destructive" : "secondary"}>
                            {r.status === "completed" ? "Completo" : r.status === "error" ? "Erro" : "Pendente"}
                          </Badge>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="analyses" className="mt-4">
              {analyses.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Instagram className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma análise encontrada.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {analyses.map((a: any) => {
                    const items: AnalysisItem[] = Array.isArray(a.analysis) ? a.analysis : [];
                    return (
                      <Card key={a.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setSelectedAnalysis(a)}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium font-display">{a.username ? `@${a.username}` : "Perfil Instagram"}</p>
                              <p className="text-sm text-muted-foreground">{formatDate(a.created_at)} • {items.length} aspectos analisados</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); downloadAnalysisPDF(a); }}>
                                <Download className="h-4 w-4" />
                              </Button>
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="portraits" className="mt-4">
              {portraits.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Camera className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum retrato gerado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {portraits.map((p: any) => {
                    const imgs = Array.isArray(p.portraits) ? p.portraits : [];
                    return imgs.map((img: string, i: number) => (
                      <div key={`${p.id}-${i}`} className="space-y-2 group">
                        <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted relative">
                          <img src={img} alt="Retrato" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <button
                            onClick={() => downloadPortrait(img, i)}
                            className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm border border-border rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-xs text-center text-muted-foreground">{formatDate(p.created_at)}</p>
                      </div>
                    ));
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={!!selectedAnalysis} onOpenChange={(open) => !open && setSelectedAnalysis(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Instagram className="h-5 w-5" />
              {selectedAnalysis?.username ? `@${selectedAnalysis.username}` : "Análise do Instagram"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{selectedAnalysis && formatDate(selectedAnalysis.created_at)}</p>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {selectedAnalysis && (Array.isArray(selectedAnalysis.analysis) ? selectedAnalysis.analysis : []).map(
              (item: AnalysisItem, i: number) => (
                <Card key={i}>
                  <CardHeader className="pb-2"><CardTitle className="text-base">{item.aspect}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Situação Atual</p>
                      <p className="text-sm">{item.current}</p>
                    </div>
                    <div className="flex justify-center"><ArrowRight className="h-4 w-4 text-primary" /></div>
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Sugestão</p>
                      <p className="text-sm">{item.suggestion}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            )}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => selectedAnalysis && downloadAnalysisPDF(selectedAnalysis)}>
                <Download className="h-4 w-4" /> Baixar PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ver Relatório */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Relatório — Versão {selectedReport?.version}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{selectedReport && formatDate(selectedReport.created_at)}</p>
          </DialogHeader>
          {selectedReport?.content && (() => {
            const c = typeof selectedReport.content === "string" ? JSON.parse(selectedReport.content) : selectedReport.content;
            return (
              <div className="space-y-4 mt-2 text-sm">
                {/* Archetypes */}
                {c.archetypes && (
                  <div>
                    <h3 className="font-semibold mb-2">Arquétipos</h3>
                    {["primary", "secondary", "tertiary"].map(rank => {
                      const a = c.archetypes[rank];
                      if (!a) return null;
                      return (
                        <div key={rank} className="mb-2 p-2 bg-muted/30 rounded-lg">
                          <p className="font-medium">{rank === "primary" ? "Primário" : rank === "secondary" ? "Secundário" : "Terciário"}: {a.name}</p>
                          <p className="text-muted-foreground text-xs">{a.description}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Tone */}
                {c.tone_of_voice?.summary && (
                  <div>
                    <h3 className="font-semibold mb-1">Tom de Voz</h3>
                    <p className="text-muted-foreground">{c.tone_of_voice.summary}</p>
                  </div>
                )}
                {/* Narrativa da Marca */}
                {c.storybrand && (
                  <div>
                    <h3 className="font-semibold mb-1">Narrativa da Marca</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(c.storybrand).map(([k, v]) => (
                        <div key={k} className="p-2 bg-muted/30 rounded text-xs">
                          <p className="font-medium capitalize">{k.replace(/_/g, " ")}</p>
                          <p className="text-muted-foreground">{Array.isArray(v) ? (v as string[]).join(", ") : String(v)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedReport(null); navigate("/report"); }}>
                    Ver relatório completo
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default HistoryPage;
