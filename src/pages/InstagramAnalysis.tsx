import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Instagram, Loader2, AlertTriangle, CheckCircle2, ArrowRight, Upload, X, Image, Download } from "lucide-react";
import jsPDF from "jspdf";
import { compressImage } from "@/lib/imageUtils";

type AnalysisItem = { aspect: string; current: string; suggestion: string };

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const InstagramAnalysis = () => {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisItem[] | null>(null);
  const [analysisDate, setAnalysisDate] = useState<string | null>(null);
  const [hasPrereqs, setHasPrereqs] = useState<boolean | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const [arcRes, repRes, latestAnalysis] = await Promise.all([
        supabase.from("user_top_archetypes").select("id").eq("user_id", user.id).limit(1),
        supabase.from("reports").select("id").eq("user_id", user.id).eq("status", "completed").limit(1),
        supabase.from("instagram_analyses").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single(),
      ]);
      setHasPrereqs((arcRes.data?.length ?? 0) > 0 && (repRes.data?.length ?? 0) > 0);

      if (latestAnalysis.data) {
        const items = Array.isArray(latestAnalysis.data.analysis) ? latestAnalysis.data.analysis as AnalysisItem[] : null;
        if (items && items.length > 0) {
          setAnalysis(items);
          setAnalysisDate(latestAnalysis.data.created_at);
          if (latestAnalysis.data.username) setUsername(latestAnalysis.data.username);
        }
      }
      setLoadingExisting(false);
    };
    init();
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "Arquivo muito grande", description: "O tamanho máximo é 5MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      setImagePreview(result);
      try {
        const compressed = await compressImage(result, 1200, 0.7);
        setImageBase64(compressed);
      } catch {
        setImageBase64(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAnalyze = async () => {
    if (!imageBase64) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-instagram", {
        body: { username: username.replace("@", "").trim() || undefined, screenshot: imageBase64 },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setAnalysis(data.analysis);
      setAnalysisDate(new Date().toISOString());

      if (user && data.analysis) {
        await supabase.from("instagram_analyses").insert({
          user_id: user.id,
          username: username.replace("@", "").trim() || null,
          analysis: data.analysis,
        });
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro na análise", description: e.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!analysis) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    doc.setFontSize(18);
    doc.text("Análise do Instagram", margin, y);
    y += 8;
    if (username) {
      doc.setFontSize(12);
      doc.text(`@${username.replace("@", "")}`, margin, y);
      y += 8;
    }
    doc.setFontSize(10);
    const dateStr = analysisDate
      ? new Date(analysisDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    doc.text(dateStr, margin, y);
    y += 12;

    for (const item of analysis) {
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

    doc.save(`analise-instagram${username ? `-${username.replace("@", "")}` : ""}.pdf`);
  };

  if (hasPrereqs === null || loadingExisting) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!hasPrereqs) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <AlertTriangle className="h-12 w-12 text-warning" />
          <h1 className="text-xl font-semibold">Pré-requisitos Necessários</h1>
          <p className="text-muted-foreground max-w-md text-sm">
            Para analisar seu Instagram, complete os questionários e gere suas análises (Arquétipos + Narrativa da Marca).
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Análise do Instagram</h1>
          <p className="text-sm text-muted-foreground mt-1">Faça upload de um print do seu perfil para análise com base na sua narrativa de marca e arquétipos.</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label className="font-medium">Screenshot do perfil *</Label>
              <p className="text-xs text-muted-foreground mb-3">Envie um print da página principal do seu perfil mostrando bio, foto de perfil e os 9 primeiros posts.</p>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="rounded-lg border max-h-64 object-contain" />
                  <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={clearImage}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-primary/20 rounded-xl p-10 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-12 w-12 text-primary/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground/70">Clique para selecionar uma imagem</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG ou PNG · Máximo 5MB</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            <div>
              <Label htmlFor="username">@ do Instagram (opcional)</Label>
              <Input id="username" placeholder="seuperfil" value={username} onChange={(e) => setUsername(e.target.value)} disabled={loading} />
            </div>

            <Button onClick={handleAnalyze} disabled={loading || !imageBase64} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {analysis ? "Nova Análise" : "Analisar Perfil"}
            </Button>
          </CardContent>
        </Card>

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Analisando perfil... Isso pode levar até 30 segundos.</p>
          </div>
        )}

        {analysis && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-display">Resultados da Análise</h2>
                {analysisDate && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(analysisDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={downloadPDF} className="gap-2">
                <Download className="h-4 w-4" /> Baixar PDF
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {analysis.map((item, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{item.aspect}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Situação Atual</p>
                      <p className="text-sm">{item.current}</p>
                    </div>
                    <div className="flex justify-center">
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Sugestão
                      </p>
                      <p className="text-sm">{item.suggestion}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default InstagramAnalysis;
