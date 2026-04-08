import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { calculateScores, getTop3, ARCHETYPE_COLORS, type ArchetypeScore } from "@/lib/archetypes";
import { Loader2, Sparkles, ArrowRight, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Results = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scores, setScores] = useState<ArchetypeScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: questions }, { data: answersData }, { data: reportData }] = await Promise.all([
        supabase.from("archetype_questions").select("id, question_number"),
        supabase.from("archetype_answers").select("question_id, score").eq("user_id", user.id),
        supabase.from("reports").select("status").eq("user_id", user.id).order("version", { ascending: false }).limit(1),
      ]);

      if (reportData?.[0]) {
        setReportStatus(reportData[0].status);
      }

      if (questions && answersData) {
        const answerMap: Record<string, number> = {};
        answersData.forEach(a => { answerMap[a.question_id] = a.score; });
        const calc = calculateScores(questions, answerMap);
        setScores(calc);

        const upserts = calc.map(s => ({
          user_id: user.id,
          version: 1,
          archetype_name: s.name,
          total_score: s.score,
        }));
        await supabase.from("archetype_scores").upsert(upserts, { onConflict: "user_id,version,archetype_name" });

        const top3 = getTop3(calc);
        const topUpserts = top3.map(t => ({
          user_id: user.id,
          version: 1,
          archetype_name: t.name,
          rank: t.rank,
          score: t.score,
        }));
        await supabase.from("user_top_archetypes").upsert(topUpserts, { onConflict: "user_id,version,rank" });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleGenerateStoryBrand = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const [{ data: bq }, { data: profile }, { data: topArchetypes }] = await Promise.all([
        supabase.from("business_questionnaires").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single(),
        supabase.from("profiles").select("niche").eq("user_id", user.id).single(),
        supabase.from("user_top_archetypes").select("*").eq("user_id", user.id).order("rank", { ascending: true }).limit(3),
      ]);

      const archetypes = {
        primary: topArchetypes?.[0],
        secondary: topArchetypes?.[1],
        tertiary: topArchetypes?.[2],
      };

      await supabase.from("reports").upsert({
        user_id: user.id,
        version: 1,
        status: "generating",
      }, { onConflict: "user_id,version" });

      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { business: bq, niche: profile?.niche || "", archetypes },
      });

      if (error) throw error;

      await supabase.from("reports").update({
        content: data.report,
        status: "completed",
      }).eq("user_id", user.id).eq("version", 1);

      // Lock both questionnaires
      await Promise.all([
        supabase.from("business_questionnaires").update({ status: "locked" }).eq("user_id", user.id),
        // archetype answers don't have status field, but business Q gets locked
      ]);

      setReportStatus("completed");
      toast({ title: "StoryBrand gerado com sucesso!" });
      navigate("/storybrand");
    } catch (err: any) {
      await supabase.from("reports").update({
        status: "error",
        error_message: err.message,
      }).eq("user_id", user.id).eq("version", 1);
      toast({ title: "Erro ao gerar StoryBrand", description: err.message, variant: "destructive" });
    }
    setGenerating(false);
  };

  const top3 = getTop3(scores);
  const maxScore = 30;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold font-display">Seus Arquétipos</h1>
          <p className="text-muted-foreground text-sm mt-1">Seus 12 arquétipos de marca calculados</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {top3.map(t => (
            <Card key={t.name} className="border-2 relative overflow-hidden" style={{ borderColor: ARCHETYPE_COLORS[t.name] }}>
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: ARCHETYPE_COLORS[t.name] }} />
              <CardContent className="pt-6 text-center">
                <Badge variant="outline" className="mb-2">{t.classification}</Badge>
                <h3 className="text-xl font-bold font-display">{t.name}</h3>
                <p className="text-3xl font-bold mt-2" style={{ color: ARCHETYPE_COLORS[t.name] }}>
                  {t.score}<span className="text-sm text-muted-foreground">/{maxScore}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Todos os arquétipos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scores.map(s => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="text-sm w-28 font-medium">{s.name}</span>
                <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(s.score / maxScore) * 100}%`,
                      background: ARCHETYPE_COLORS[s.name],
                    }}
                  />
                </div>
                <span className="text-sm font-semibold w-8 text-right">{s.score}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* StoryBrand generation section */}
        {reportStatus === "completed" ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">Sua estratégia StoryBrand já foi gerada!</p>
              <Button onClick={() => navigate("/storybrand")} className="gap-2" size="lg">
                Ver StoryBrand <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Arquétipos calculados! Gere sua análise StoryBrand personalizada.
              </p>
              <Button onClick={handleGenerateStoryBrand} disabled={generating} className="gap-2" size="lg">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Gerando StoryBrand..." : "Gerar Estratégia StoryBrand"}
              </Button>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Após gerar, os questionários serão bloqueados para edição.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Results;
