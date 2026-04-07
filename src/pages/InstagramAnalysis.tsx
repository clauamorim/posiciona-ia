import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Instagram, Loader2, AlertTriangle, CheckCircle2, ArrowRight, Upload, X, Image } from "lucide-react";

type AnalysisItem = { aspect: string; current: string; suggestion: string };

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const InstagramAnalysis = () => {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisItem[] | null>(null);
  const [hasPrereqs, setHasPrereqs] = useState<boolean | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const [arcRes, repRes] = await Promise.all([
        supabase.from("user_top_archetypes").select("id").eq("user_id", user.id).limit(1),
        supabase.from("reports").select("id").eq("user_id", user.id).eq("status", "completed").limit(1),
      ]);
      setHasPrereqs((arcRes.data?.length ?? 0) > 0 && (repRes.data?.length ?? 0) > 0);
    };
    check();
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "Arquivo muito grande", description: "O tamanho máximo é 5MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result);
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
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-instagram", {
        body: { username: username.replace("@", "").trim() || undefined, screenshot: imageBase64 },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setAnalysis(data.analysis);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro na análise", description: e.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (hasPrereqs === null) {
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
        <div className="space-y-4 text-center py-20">
          <AlertTriangle className="h-12 w-12 text-warning mx-auto" />
          <h1 className="text-2xl font-bold font-display">Pré-requisitos Necessários</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Para analisar seu Instagram, você precisa primeiro completar os questionários e gerar suas análises (Arquétipos + StoryBrand).
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display">Análise do Instagram</h1>
          <p className="text-muted-foreground">Faça upload de um print do seu perfil para análise com base no seu StoryBrand e arquétipos.</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Image upload */}
            <div>
              <Label>Screenshot do perfil *</Label>
              <p className="text-xs text-muted-foreground mb-2">Tire um print da página principal do seu perfil no Instagram e faça o upload aqui (máx. 5MB).</p>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="rounded-lg border max-h-64 object-contain" />
                  <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={clearImage}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Image className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Clique para selecionar uma imagem</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            {/* Optional username */}
            <div>
              <Label htmlFor="username">@ do Instagram (opcional)</Label>
              <Input
                id="username"
                placeholder="seuperfil"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button onClick={handleAnalyze} disabled={loading || !imageBase64} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Analisar Perfil
            </Button>
          </CardContent>
        </Card>

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Analisando perfil... Isso pode levar até 30 segundos.</p>
          </div>
        )}

        {analysis && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold font-display">Resultados da Análise</h2>
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
