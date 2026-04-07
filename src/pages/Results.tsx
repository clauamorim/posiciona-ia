import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { calculateScores, getTop3, ARCHETYPE_COLORS, type ArchetypeScore } from "@/lib/archetypes";
import { Loader2 } from "lucide-react";

const Results = () => {
  const { user } = useAuth();
  const [scores, setScores] = useState<ArchetypeScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: questions }, { data: answersData }] = await Promise.all([
        supabase.from("archetype_questions").select("id, question_number"),
        supabase.from("archetype_answers").select("question_id, score").eq("user_id", user.id),
      ]);
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
      </div>
    </DashboardLayout>
  );
};

export default Results;
