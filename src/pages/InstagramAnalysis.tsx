import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Instagram, Loader2, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";

type AnalysisItem = { aspect: string; current: string; suggestion: string };

const InstagramAnalysis = () => {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisItem[] | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [hasPrereqs, setHasPrereqs] = useState<boolean | null>(null);
  const [showManualFallback, setShowManualFallback] = useState(false);

  // Manual fallback fields
  const [manualData, setManualData] = useState({
    profileName: "",
    bio: "",
    highlights: "",
    hasCta: "",
    pinnedPosts: "",
    feedDescription: "",
    profilePhotoDescription: "",
  });

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

  const handleAnalyze = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setAnalysis(null);
    setScreenshot(null);
    setShowManualFallback(false);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-instagram", {
        body: { username: username.replace("@", "").trim() },
      });

      if (error) throw error;

      if (data.fallback) {
        setShowManualFallback(true);
        toast({ title: "Instagram inacessível", description: "Preencha os dados manualmente para a análise.", variant: "destructive" });
      } else {
        setAnalysis(data.analysis);
        if (data.screenshot) setScreenshot(data.screenshot);
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro na análise", description: e.message || "Tente novamente.", variant: "destructive" });
      setShowManualFallback(true);
    } finally {
      setLoading(false);
    }
  };

  const handleManualAnalyze = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-instagram", {
        body: {
          username: username.replace("@", "").trim(),
          manualData,
        },
      });
      if (error) throw error;
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
          <p className="text-muted-foreground">Analise seu perfil com base no seu StoryBrand e arquétipos.</p>
        </div>

        {/* Input */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label htmlFor="username">@ do Instagram</Label>
                <Input
                  id="username"
                  placeholder="seuperfil"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button onClick={handleAnalyze} disabled={loading || !username.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Instagram className="h-4 w-4 mr-2" />}
                Analisar Perfil
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Manual fallback */}
        {showManualFallback && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados do Perfil (Manual)</CardTitle>
              <p className="text-sm text-muted-foreground">Não foi possível acessar o Instagram automaticamente. Preencha os dados abaixo.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Nome do perfil</Label>
                  <Input value={manualData.profileName} onChange={e => setManualData(p => ({ ...p, profileName: e.target.value }))} />
                </div>
                <div>
                  <Label>CTA na bio</Label>
                  <Input placeholder="Ex: Link na bio, Agende agora..." value={manualData.hasCta} onChange={e => setManualData(p => ({ ...p, hasCta: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Bio</Label>
                <Textarea value={manualData.bio} onChange={e => setManualData(p => ({ ...p, bio: e.target.value }))} />
              </div>
              <div>
                <Label>Destaques (separados por vírgula)</Label>
                <Input value={manualData.highlights} onChange={e => setManualData(p => ({ ...p, highlights: e.target.value }))} />
              </div>
              <div>
                <Label>Posts fixados (descrição)</Label>
                <Input value={manualData.pinnedPosts} onChange={e => setManualData(p => ({ ...p, pinnedPosts: e.target.value }))} />
              </div>
              <div>
                <Label>Aparência do feed</Label>
                <Textarea placeholder="Descreva cores, estilo, tipos de post..." value={manualData.feedDescription} onChange={e => setManualData(p => ({ ...p, feedDescription: e.target.value }))} />
              </div>
              <div>
                <Label>Foto de perfil</Label>
                <Input placeholder="Descreva sua foto de perfil..." value={manualData.profilePhotoDescription} onChange={e => setManualData(p => ({ ...p, profilePhotoDescription: e.target.value }))} />
              </div>
              <Button onClick={handleManualAnalyze} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Analisar com Dados Manuais
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Analisando perfil... Isso pode levar até 30 segundos.</p>
          </div>
        )}

        {/* Screenshot */}
        {screenshot && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Screenshot do Perfil</CardTitle></CardHeader>
            <CardContent>
              <img src={`data:image/png;base64,${screenshot}`} alt="Screenshot do perfil" className="rounded-lg max-w-full mx-auto border" />
            </CardContent>
          </Card>
        )}

        {/* Results */}
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
