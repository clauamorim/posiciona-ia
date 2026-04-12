import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Lock, RefreshCw, Pencil, Trash2 } from "lucide-react";

const QUESTIONS_PER_PAGE = 12;
const scoreLabels = ["", "Discordo totalmente", "Discordo", "Neutro", "Concordo", "Concordo totalmente"];

type QStatus = "draft" | "submitted" | "locked";

const ArchetypeQuestionnaire = () => {
  const { user, balances, refreshSubscription } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<QStatus>("draft");
  const [showReanalysisDialog, setShowReanalysisDialog] = useState(false);

  const isLocked = status === "locked";
  const reanalysisCredits = balances?.reanalysis_credits ?? 0;

  useEffect(() => {
    const load = async () => {
      const { data: qs } = await supabase.from("archetype_questions").select("*").order("question_number");
      if (qs) {
        setQuestions(qs);
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

      if (user) {
        const { data: report } = await supabase
          .from("reports")
          .select("status")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .limit(1);
        if (report && report.length > 0) {
          setStatus("locked");
        }
      }
    };
    load();
  }, [user]);

  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
  const pageQuestions = questions.slice(page * QUESTIONS_PER_PAGE, (page + 1) * QUESTIONS_PER_PAGE);
  const answeredCount = questions.length > 0 ? Object.keys(answers).length : 0;
  const progress = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const saveAnswers = useCallback(async () => {
    if (!user || isLocked) return;
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
  }, [user, answers, isLocked]);

  const handleFinish = async () => {
    await saveAnswers();
    navigate("/results");
  };

  const handleReanalysis = async (mode: "edit" | "reset") => {
    if (!user || reanalysisCredits < 1) return;

    await supabase.from("user_balances").update({ reanalysis_credits: reanalysisCredits - 1 }).eq("user_id", user.id);
    await supabase.from("credit_logs").insert({
      user_id: user.id,
      credit_type: "reanalysis",
      amount: -1,
      description: `Reanálise: ${mode === "edit" ? "editar questionário de arquétipos" : "refazer do zero"}`,
    });

    if (mode === "reset") {
      // Reset all answers to default 3
      const defaults: Record<string, number> = {};
      questions.forEach(q => { defaults[q.id] = 3; });
      setAnswers(defaults);
      // Delete existing answers
      await supabase.from("archetype_answers").delete().eq("user_id", user.id);
    }

    setStatus("draft");
    setShowReanalysisDialog(false);
    setPage(0);
    await refreshSubscription();
    toast({ title: mode === "edit" ? "Questionário desbloqueado para edição" : "Questionário reiniciado" });
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display">Questionário de Arquétipos</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Página {page + 1} de {totalPages} • {answeredCount}/72 respondidas
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLocked && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowReanalysisDialog(true)}
                disabled={reanalysisCredits < 1}
              >
                <RefreshCw className="h-3 w-3" />
                Refazer análise ({reanalysisCredits})
              </Button>
            )}
            {isLocked && (
              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                <Lock className="h-3 w-3 mr-1" /> Bloqueado
              </Badge>
            )}
          </div>
        </div>

        {isLocked && (
          <Card className="border-red-200 bg-red-500/5">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Lock className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Questionário bloqueado</p>
                <p className="text-xs text-muted-foreground">
                  Este questionário foi bloqueado após a geração da estratégia. Use "Refazer análise" para desbloquear (consome 1 crédito).
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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
                    onValueChange={([val]) => {
                      if (!isLocked) setAnswers(prev => ({ ...prev, [q.id]: val }));
                    }}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                    disabled={isLocked}
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
          <Button variant="outline" onClick={async () => { if (!isLocked) await saveAnswers(); setPage(p => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={page === 0 || saving}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          {page < totalPages - 1 ? (
            <Button onClick={async () => { if (!isLocked) await saveAnswers(); setPage(p => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={saving}>
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : !isLocked ? (
            <Button onClick={handleFinish} disabled={answeredCount < questions.length || saving}>
              Calcular Arquétipos ✓
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate("/results")}>
              Ver Resultados
            </Button>
          )}
        </div>
      </div>

      {/* Reanalysis Dialog */}
      <Dialog open={showReanalysisDialog} onOpenChange={setShowReanalysisDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refazer análise</DialogTitle>
            <DialogDescription>
              Isso consumirá 1 crédito de reanálise. Você tem {reanalysisCredits} crédito{reanalysisCredits !== 1 ? "s" : ""} disponível{reanalysisCredits !== 1 ? "is" : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button className="w-full gap-2" onClick={() => handleReanalysis("edit")}>
              <Pencil className="h-4 w-4" /> Editar questionários existentes
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={() => handleReanalysis("reset")}>
              <Trash2 className="h-4 w-4" /> Refazer do zero
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReanalysisDialog(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ArchetypeQuestionnaire;
