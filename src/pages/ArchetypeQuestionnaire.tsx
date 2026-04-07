import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight } from "lucide-react";

const QUESTIONS_PER_PAGE = 12;
const scoreLabels = ["", "Discordo totalmente", "Discordo", "Neutro", "Concordo", "Concordo totalmente"];

const ArchetypeQuestionnaire = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: qs } = await supabase.from("archetype_questions").select("*").order("question_number");
      if (qs) {
        setQuestions(qs);
        // Initialize all questions with default score 3
        const defaults: Record<string, number> = {};
        qs.forEach(q => { defaults[q.id] = 3; });
        if (user) {
          const { data: ans } = await supabase.from("archetype_answers").select("question_id, score").eq("user_id", user.id);
          if (ans) {
            ans.forEach(a => { defaults[a.question_id] = a.score; });
          }
        }
        setAnswers(defaults);
      }
    };
    load();
  }, [user]);

  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
  const pageQuestions = questions.slice(page * QUESTIONS_PER_PAGE, (page + 1) * QUESTIONS_PER_PAGE);
  const answeredCount = questions.length > 0 ? Object.keys(answers).length : 0;
  const progress = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const saveAnswers = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    const upserts = Object.entries(answers).map(([question_id, score]) => ({
      user_id: user.id,
      version: 1,
      question_id,
      score,
    }));
    await supabase.from("archetype_answers").upsert(upserts, { onConflict: "user_id,version,question_id" });
    setSaving(false);
    toast({ title: "Respostas salvas!" });
  }, [user, answers]);

  const handleFinish = async () => {
    await saveAnswers();
    navigate("/results");
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display">Questionário de Arquétipos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Página {page + 1} de {totalPages} • {answeredCount}/72 respondidas
          </p>
        </div>

        <Progress value={progress} className="h-2" />

        <div className="space-y-4">
          {pageQuestions.map(q => (
            <Card key={q.id} className="transition-shadow hover:shadow-sm">
              <CardContent className="pt-5 pb-4">
                <p className="text-sm font-medium mb-3">
                  <span className="text-muted-foreground mr-2">{q.question_number}.</span>
                  {q.statement}
                </p>
                <div className="px-2">
                  <Slider
                    value={[answers[q.id] || 3]}
                    onValueChange={([val]) => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <span key={n} className={`text-[10px] ${answers[q.id] === n ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                        {n}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-center text-muted-foreground mt-1">
                    {scoreLabels[answers[q.id] || 3]}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={async () => { await saveAnswers(); setPage(p => p - 1); }} disabled={page === 0 || saving}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          {page < totalPages - 1 ? (
            <Button onClick={async () => { await saveAnswers(); setPage(p => p + 1); }} disabled={saving}>
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={answeredCount < questions.length || saving}>
              Calcular Arquétipos ✓
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ArchetypeQuestionnaire;
