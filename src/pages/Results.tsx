import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { calculateScores, getTop3, ARCHETYPE_COLORS, type ArchetypeScore } from "@/lib/archetypes";
import { Loader2, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Stage = "calculating" | "saving" | "generating_report" | "done" | "error";

const STAGE_LABELS: Record<Stage, string> = {
  calculating: "Calculando arquétipos...",
  saving: "Salvando resultados...",
  generating_report: "Gerando sua estratégia completa (StoryBrand, figurino, símbolos)...",
  done: "Tudo pronto!",
  error: "Ocorreu um erro.",
};

const Results = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scores, setScores] = useState<ArchetypeScore[]>([]);
  const [stage, setStage] = useState<Stage>("calculating");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      try {
        // 1. Calculate archetypes
        setStage("calculating");
        const [{ data: questions }, { data: answersData }] = await Promise.all([
          supabase.from("archetype_questions").select("id, question_number"),
          supabase.from("archetype_answers").select("question_id, score").eq("user_id", user.id),
        ]);
        if (!questions || !answersData) throw new Error("Erro ao carregar dados dos questionários");

        const answerMap: Record<string, number> = {};
        answersData.forEach(a => { answerMap[a.question_id] = a.score; });
        const calc = calculateScores(questions, answerMap);
        setScores(calc);

        // 2. Save scores
        setStage("saving");
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

        // 3. Check if business questionnaire is complete
        const { data: bqData } = await supabase
          .from("business_questionnaires")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_complete", true)
          .order("version", { ascending: false })
          .limit(1)
          .single();

        if (!bqData) {
          // No business questionnaire — just show results
          setStage("done");
          return;
        }

        // 4. Auto-generate report
        setStage("generating_report");

        const { data: profile } = await supabase
          .from("profiles")
          .select("niche, gender")
          .eq("user_id", user.id)
          .single();

        const archetypes = {
          primary: { archetype_name: top3[0]?.name, score: top3[0]?.score },
          secondary: { archetype_name: top3[1]?.name, score: top3[1]?.score },
          tertiary: { archetype_name: top3[2]?.name, score: top3[2]?.score },
        };

        await supabase.from("reports").upsert({
          user_id: user.id,
          version: 1,
          status: "generating",
        }, { onConflict: "user_id,version" });

        const { data: reportData, error: reportError } = await supabase.functions.invoke("generate-report", {
          body: {
            business: bqData,
            niche: profile?.niche || "",
            archetypes,
            gender: profile?.gender || "Não informado",
          },
        });

        if (reportError) throw reportError;

        await supabase.from("reports").update({
          content: reportData.report,
          status: "completed",
        }).eq("user_id", user.id).eq("version", 1);

        await supabase.from("business_questionnaires").update({ status: "locked" }).eq("user_id", user.id);

        setStage("done");
        toast({ title: "Estratégia gerada com sucesso!" });
      } catch (err: any) {
        console.error("Results error:", err);
        setErrorMsg(err.message || "Erro desconhecido");
        setStage("error");
        // Mark report as error if it was being generated
        await supabase.from("reports").update({
          status: "error",
          error_message: err.message,
        }).eq("user_id", user.id).eq("version", 1);
        toast({ title: "Erro", description: err.message, variant: "destructive" });
      }
    };
    run();
  }, [user]);

  const top3 = getTop3(scores);
  const maxScore = 30;
  const isProcessing = stage !== "done" && stage !== "error";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold font-display">Seus Arquétipos</h1>
          <p className="text-muted-foreground text-sm mt-1">Seus 12 arquétipos de marca calculados</p>
        </div>

        {/* Progress indicator */}
        <Card className="border-primary/30">
          <CardContent className="pt-6 pb-5">
            <div className="flex items-center gap-3">
              {isProcessing ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary shrink-0" />
              ) : stage === "done" ? (
                <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
              ) : (
                <Sparkles className="h-6 w-6 text-destructive shrink-0" />
              )}
              <div>
                <p className="font-semibold text-sm">{STAGE_LABELS[stage]}</p>
                {stage === "error" && errorMsg && (
                  <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
                )}
              </div>
            </div>
            {stage === "done" && (
              <div className="flex gap-3 mt-4">
                <Button onClick={() => navigate("/report")} className="gap-2">
                  Ver Relatório Completo <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => navigate("/storybrand")} className="gap-2">
                  Ver StoryBrand
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top 3 cards */}
        {top3.length > 0 && (
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
        )}

        {/* All archetypes bar chart */}
        {scores.length > 0 && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-bold font-display mb-2">Todos os arquétipos</h3>
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
        )}
      </div>
    </DashboardLayout>
  );
};

export default Results;
