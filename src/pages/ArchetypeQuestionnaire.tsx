import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Lock, RefreshCw, Pencil, Trash2 } from "lucide-react";

const QUESTIONS_PER_PAGE = 12;

type QStatus = "draft" | "submitted" | "locked";

const ArchetypeQuestionnaire = () => {
  const { user, balances, refreshSubscription } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | undefined>>({});
  const [touchedIds, setTouchedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<QStatus>("draft");
  const [showReanalysisDialog, setShowReanalysisDialog] = useState(false);
  const loadedRef = useRef(false);

  const isLocked = status === "locked";
  const reanalysisCredits = balances?.reanalysis_credits ?? 0;

  useEffect(() => {
    if (loadedRef.current) return;
    const load = async () => {
      const { data: qs } = await supabase.from("archetype_questions").select("*").order("question_number");
      if (qs) {
        setQuestions(qs);
        // Start with undefined — no option visually selected
        const defaults: Record<string, number | undefined> = {};
        qs.forEach(q => { defaults[q.id] = undefined; });
        if (user) {
          const { data: ans } = await supabase.from("archetype_answers").select("question_id, score").eq("user_id", user.id);
          if (ans && ans.length > 0) {
            const saved = new Set<string>();
            ans.forEach(a => { defaults[a.question_id] = a.score; saved.add(a.question_id); });
            setTouchedIds(saved);
          }
        }
        setAnswers(defaults);
        loadedRef.current = true;
      }
      if (user) {
        const { data: latestReport } = await supabase
          .from("reports").select("status").eq("user_id", user.id)
          .order("version", { ascending: false }).limit(1).single();
        if (latestReport && latestReport.status === "completed") {
          setStatus("locked");
        }
      }
    };
    load();
  }, [user]);

  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
  const pageQuestions = questions.slice(page * QUESTIONS_PER_PAGE, (page + 1) * QUESTIONS_PER_PAGE);
  const answeredCount = touchedIds.size;
  const progress = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const saveAnswers = useCallback(async () => {
    if (!user || isLocked) return;
    setSaving(true);
    // Only save touched answers (with actual values)
    const upserts = Array.from(touchedIds)
      .filter(qid => answers[qid] !== undefined)
      .map(qid => ({
        user_id: user.id,
        version: 1,
        question_id: qid,
        score: answers[qid]!,
      }));
    if (upserts.length > 0) {
      await supabase.from("archetype_answers").upsert(upserts, { onConflict: "user_id,version,question_id" });
    }
    setSaving(false);
    toast({ title: "Respostas salvas!" });
  }, [user, answers, isLocked, touchedIds]);

  const handleFinish = async () => {
    await saveAnswers();
    // First-time completion: offer the optional sales-narrative intro.
    // If the user already has a sales_narrative record (filled or skipped before),
    // go straight to results.
    let goIntro = false;
    if (user) {
      const { data } = await supabase
        .from("sales_narrative_questionnaires")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      goIntro = !data;
    }
    navigate(goIntro ? "/sales-narrative-intro" : "/results");
  };

  const handleReanalysis = async (mode: "edit" | "reset") => {
    if (!user || reanalysisCredits < 1) return;
    await supabase.rpc("consume_credit", {
      p_credit_type: "reanalysis",
      p_amount: -1,
      p_description: `Reanálise: ${mode === "edit" ? "editar questionário de arquétipos" : "refazer do zero"}`,
    });
    if (mode === "reset") {
      const defaults: Record<string, number | undefined> = {};
      questions.forEach(q => { defaults[q.id] = undefined; });
      setAnswers(defaults);
      setTouchedIds(new Set());
      await supabase.from("archetype_answers").delete().eq("user_id", user.id);
    }
    // Não sobrescrever o relatório anterior. A nova geração criará uma nova versão
    // (ver Results.tsx), preservando o histórico.
    setStatus("draft");
    setShowReanalysisDialog(false);
    setPage(0);
    loadedRef.current = false; // allow reload
    await refreshSubscription();
    toast({ title: mode === "edit" ? "Questionário desbloqueado para edição" : "Questionário reiniciado" });
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">Questionário de Arquétipos</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Página {page + 1} de {totalPages} · {answeredCount}/72 respondidas
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isLocked && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowReanalysisDialog(true)}
                disabled={reanalysisCredits < 1}
              >
                <RefreshCw className="h-3 w-3" />
                <span className="hidden sm:inline">Refazer</span> ({reanalysisCredits})
              </Button>
            )}
            {isLocked && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                <Lock className="h-3 w-3 mr-1" /> Bloqueado
              </Badge>
            )}
          </div>
        </div>

        {/* Locked banner */}
        {isLocked && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/60">
            <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Suas respostas estão em uso. Para editar, consuma 1 crédito de reanálise.
            </p>
          </div>
        )}

        {/* Progress */}
        <div className="space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[11px] text-muted-foreground text-right">{progress}%</p>
        </div>

        {/* Questions */}
        <div className="space-y-3">
          {pageQuestions.map(q => (
            <Card key={q.id} className="border-border/60">
              <CardContent className="pt-4 pb-3.5">
                <p className="text-sm font-medium mb-3 leading-relaxed">
                  <span className="text-muted-foreground mr-1.5 text-xs">{q.question_number}.</span>
                  {q.statement}
                </p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => {
                        if (!isLocked) {
                          setAnswers(prev => ({ ...prev, [q.id]: n }));
                          setTouchedIds(prev => new Set(prev).add(q.id));
                        }
                      }}
                      disabled={isLocked}
                      className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-all ${
                        answers[q.id] === n
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted border border-border/40"
                      } ${isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between mt-1.5 px-0.5">
                  <span className="text-[10px] text-muted-foreground">Discordo totalmente</span>
                  <span className="text-[10px] text-muted-foreground">Concordo totalmente</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={async () => { if (!isLocked) await saveAnswers(); setPage(p => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={page === 0 || saving}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          {page < totalPages - 1 ? (
            <Button size="sm" onClick={async () => { if (!isLocked) await saveAnswers(); setPage(p => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={saving}>
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : !isLocked ? (
            <Button size="sm" onClick={handleFinish} disabled={answeredCount < questions.length || saving}>
              Calcular arquétipos
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate("/results")}>
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
              <Pencil className="h-4 w-4" /> Editar respostas existentes
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={() => handleReanalysis("reset")}>
              <Trash2 className="h-4 w-4" /> Recomeçar do zero
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
