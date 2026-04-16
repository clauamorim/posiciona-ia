import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Instagram, Loader2, AlertTriangle, CheckCircle2, ArrowRight, Upload, X, Image, Download, Copy, Check } from "lucide-react";
import jsPDF from "jspdf";
import { compressImage } from "@/lib/imageUtils";

type AnalysisItem = { aspect: string; current: string; suggestion: string };
type BioOption = { text: string; char_count: number; rationale?: string };

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const BIO_HARD_LIMIT = 150;

const InstagramAnalysis = () => {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisItem[] | null>(null);
  const [bioOptions, setBioOptions] = useState<BioOption[]>([]);
  const [analysisDate, setAnalysisDate] = useState<string | null>(null);
  const [hasPrereqs, setHasPrereqs] = useState<boolean | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
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
        const raw = latestAnalysis.data.analysis as any;
        // Backwards-compatible: old rows are arrays; new rows are { items, bio_options }
        const items: AnalysisItem[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.items) ? raw.items : [];
        const bios: BioOption[] = Array.isArray(raw?.bio_options) ? raw.bio_options : [];
        if (items.length > 0 || bios.length > 0) {
          setAnalysis(items);
          setBioOptions(bios);
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

      const items: AnalysisItem[] = Array.isArray(data.analysis) ? data.analysis : [];
      const bios: BioOption[] = Array.isArray(data.bio_options) ? data.bio_options : [];

      setAnalysis(items);
      setBioOptions(bios);
      setAnalysisDate(new Date().toISOString());

      if (user) {
        await supabase.from("instagram_analyses").insert({
          user_id: user.id,
          username: username.replace("@", "").trim() || null,
          analysis: { items, bio_options: bios } as any,
        });
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro na análise", description: e.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyBio = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const downloadPDF = () => {
    if (!analysis && bioOptions.length === 0) return;
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

    // Bio options first
    if (bioOptions.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Sugestões de Bio (≤150 caracteres)", margin, y);
      y += 8;
      bioOptions.forEach((bio, i) => {
        if (!bio.text) return;
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Opção ${i + 1} (${bio.text.length}/150)`, margin, y);
        y += 5;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(bio.text, maxWidth);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 6;
      });
      y += 4;
    }

    const filtered = (analysis || []).filter(
      (item) => !/^bio$/i.test(item.aspect.trim())
    );

    for (const item of filtered) {
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

  // Hide raw "Bio" item from the analysis grid since we render the dedicated bio block
  const displayedAnalysis = (analysis || []).filter(
    (item) => !/^bio$/i.test(item.aspect.trim())
  );

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

        {(analysis || bioOptions.length > 0) && !loading && (
          <div className="space-y-6">
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

            {/* Dedicated Bio block */}
            {bioOptions.filter((b) => b.text).length > 0 && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold">Sugestões de Bio</h3>
                  <p className="text-xs text-muted-foreground">3 opções otimizadas para o limite de 150 caracteres do Instagram.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {bioOptions.filter((b) => b.text).map((bio, i) => {
                    const count = bio.text.length;
                    const within = count <= BIO_HARD_LIMIT;
                    return (
                      <Card key={i} className="border-primary/20">
                        <CardContent className="pt-5 pb-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Opção {i + 1}</span>
                            <span className={`text-xs font-mono ${within ? "text-emerald-600" : "text-destructive"}`}>
                              {count}/150
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{bio.text}</p>
                          {bio.rationale && (
                            <p className="text-xs text-muted-foreground italic">{bio.rationale}</p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={() => copyBio(bio.text, i)}
                          >
                            {copiedIdx === i ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedIdx === i ? "Copiado" : "Copiar bio"}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {displayedAnalysis.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {displayedAnalysis.map((item, i) => (
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
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default InstagramAnalysis;
