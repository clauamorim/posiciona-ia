import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Save, Lock, RefreshCw, Pencil, Trash2, HelpCircle, Check, AlertTriangle, Loader2, Mic, PenLine } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuestionnaireAutosave, SaveStatusLabel } from "@/hooks/useQuestionnaireAutosave";
import { InlineHelpButton } from "@/components/assistant/InlineHelpButton";
import { QuestionnaireStatusBadge } from "@/components/questionnaire/QuestionnaireStatusBadge";
import { InterviewMode } from "@/components/questionnaire/InterviewMode";

const fields = [
  { key: "company_name", label: "Nome da empresa ou negócio", type: "input", placeholder: "Ex: Studio Bella", help: "Pode ser o nome fantasia, nome pessoal ou como você é conhecida(o) no mercado.", max: 120 },
  { key: "services", label: "Serviços ou produtos oferecidos", type: "textarea", placeholder: "Descreva seus principais serviços ou produtos", help: "Liste os principais serviços/produtos que você oferece.", max: 600 },
  { key: "target_audience", label: "Público-alvo", type: "textarea", placeholder: "Quem são seus clientes ideais?", help: "Descreva quem é seu cliente ideal: idade, gênero, profissão, nível de renda, interesses e dores.", max: 400 },
  { key: "external_problems", label: "Problemas externos que resolve", type: "textarea", placeholder: "Que problemas práticos você resolve para o cliente?", help: "Problemas externos são dificuldades práticas e visíveis.", max: 600 },
  { key: "internal_problems", label: "Problemas internos do cliente", type: "textarea", placeholder: "Como o cliente se sente antes de contratar você?", help: "São os sentimentos e frustrações do cliente.", max: 600 },
  { key: "empathic_statements", label: "Declarações empáticas", type: "textarea", placeholder: "Frases que mostram que você entende o cliente", help: "Frases que demonstram empatia e criam conexão.", max: 800 },
  { key: "authority_proofs", label: "Provas de autoridade", type: "textarea", placeholder: "Certificações, cases, depoimentos, números", help: "O que prova que você é qualificada(o)?", max: 800 },
  { key: "hiring_steps", label: "Etapas para contratar", type: "textarea", placeholder: "Quais os passos para o cliente contratar seu serviço?", help: "Descreva o passo a passo simples para contratar você.", max: 400 },
  { key: "client_fears", label: "Medos do cliente", type: "textarea", placeholder: "O que impede o cliente de agir?", help: "Quais medos impedem o cliente de comprar?", max: 600 },
  { key: "main_cta", label: "Principal chamada para ação", type: "input", placeholder: "Ex: Agende sua consultoria gratuita", help: "A ação principal que você quer que o cliente tome.", max: 120 },
  { key: "negative_consequences", label: "Consequências negativas evitadas", type: "textarea", placeholder: "O que acontece se o cliente NÃO agir?", help: "O que acontece se o cliente não agir?", max: 600 },
  { key: "promised_transformations", label: "Conquistas e transformações prometidas", type: "textarea", placeholder: "Como a vida do cliente muda após seu serviço?", help: "Descreva a transformação que você entrega.", max: 600 },
];

// Agrupamento visual em 4 blocos temáticos (3 perguntas cada, respeitando a ordem original).
// IMPORTANTE: as keys das perguntas e a ordem dentro de cada bloco são preservadas.
const blocks = [
  { title: "Negócio e público", subtitle: "Quem você é e para quem trabalha.", range: [0, 3] as const },
  { title: "Dores e empatia", subtitle: "O que seu cliente sente — e como você demonstra entender.", range: [3, 6] as const },
  { title: "Autoridade e jornada", subtitle: "Por que confiar em você e como começar.", range: [6, 9] as const },
  { title: "Ação e transformação", subtitle: "O convite, o risco de não agir e o resultado prometido.", range: [9, 12] as const },
];

// Mapeia step antigo (0-11) para bloco novo (0-3). Mantém compatibilidade visual.
const stepToBlock = (s: number) => Math.min(blocks.length - 1, Math.max(0, Math.floor(s / 3)));

const interviewFields = fields.map(f => ({ key: f.key, label: f.label }));

type QStatus = "draft" | "submitted" | "locked";

const BusinessQuestionnaire = () => {
  const { user, balances, refreshSubscription } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [status, setStatus] = useState<QStatus>("draft");
  const [showReanalysisDialog, setShowReanalysisDialog] = useState(false);
  const [mode, setMode] = useState<"form" | "interview">("form");
  // Monta o chat só após a hidratação (1º clique) e mantém montado depois,
  // para a conversa sobreviver à alternância entre os modos.
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [profile, setProfile] = useState<{ profession?: string; niche?: string }>({});
  const insertingRef = useRef(false);

  const isLocked = status === "locked";
  const isSubmitted = status === "submitted";
  const isEditable = status === "draft";
  const reanalysisCredits = balances?.reanalysis_credits ?? 0;
  const storageKey = user ? `posiciona-bq-draft-${user.id}` : "posiciona-bq-draft";

  // Persist current answers (used by autosave & manual flush).
  const persist = useCallback(async (overrides?: { complete?: boolean }): Promise<{ ok: boolean; error?: string }> => {
    if (!user || isLocked) return { ok: false, error: "locked" };
    const complete = overrides?.complete ?? false;
    const newStatus: QStatus = complete ? "submitted" : (isSubmitted ? "submitted" : "draft");
    const payload: any = {
      user_id: user.id,
      ...answers,
      is_complete: complete || isComplete,
      status: newStatus,
    };
    try {
      if (existingId) {
        const { error } = await supabase.from("business_questionnaires").update(payload).eq("id", existingId);
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      }
      // Evita inserts paralelos duplicados
      if (insertingRef.current) return { ok: true };
      insertingRef.current = true;
      const { data, error } = await supabase.from("business_questionnaires").insert(payload).select("id").single();
      insertingRef.current = false;
      if (error) return { ok: false, error: error.message };
      if (data) setExistingId(data.id);
      return { ok: true };
    } catch (e: any) {
      insertingRef.current = false;
      return { ok: false, error: e?.message || "save failed" };
    }
  }, [user, isLocked, isSubmitted, isComplete, answers, existingId]);

  const { status: saveStatus, flush, clearLocalBackup, readLocalBackup } = useQuestionnaireAutosave({
    userId: user?.id,
    answers,
    enabled: isEditable && hydrated,
    storageKey,
    saveFn: () => persist(),
  });

  // Hidrata do banco e mescla com backup local se existir.
  // Só hidrata UMA vez. Sem o guard `hydrated`, mudar de aba/janela revalida
  // a sessão do Supabase, gera um novo objeto `user` (mesmo id, referência
  // nova), o effect re-roda, e sobrescreve as respostas digitadas que ainda
  // não foram salvas no banco.
  useEffect(() => {
    if (!user?.id || hydrated) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("business_questionnaires")
        .select("*")
        .eq("user_id", user.id)
        .order("version", { ascending: false })
        .limit(1);
      if (cancelled) return;

      let dbAnswers: Record<string, string> = {};
      let dbStatus: QStatus = "draft";
      let dbComplete = false;
      let dbId: string | null = null;
      if (data?.[0]) {
        dbId = data[0].id;
        dbStatus = (data[0].status as QStatus) || "draft";
        dbComplete = data[0].is_complete || false;
        fields.forEach(f => { dbAnswers[f.key] = (data[0] as any)[f.key] || ""; });
      } else {
        fields.forEach(f => { dbAnswers[f.key] = ""; });
      }

      // Recupera backup local se for rascunho e tiver mais conteúdo
      if (dbStatus === "draft") {
        try {
          const raw = localStorage.getItem(`posiciona-bq-draft-${user.id}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            const local = parsed?.answers as Record<string, string> | undefined;
            if (local) {
              const localFilled = Object.values(local).filter(v => (v || "").trim().length > 0).length;
              const dbFilled = Object.values(dbAnswers).filter(v => (v || "").trim().length > 0).length;
              if (localFilled > dbFilled) {
                dbAnswers = { ...dbAnswers, ...local };
                toast({ title: "Rascunho recuperado", description: "Restauramos respostas que ainda não tinham sido sincronizadas." });
              }
            }
          }
        } catch { /* ignore */ }
      }

      setExistingId(dbId);
      setIsComplete(dbComplete);
      setStatus(dbStatus);
      setAnswers(dbAnswers);
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id, hydrated]);

  // Profissão/nicho personalizam as perguntas do modo entrevista.
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("profession, niche").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setProfile({ profession: data.profession || undefined, niche: data.niche || undefined }); });
  }, [user?.id]);

  const submit = useCallback(async () => {
    if (!user || isLocked) return;
    setSubmitting(true);
    const flushed = await flush();
    if (!flushed) {
      setSubmitting(false);
      toast({ title: "Não foi possível salvar", description: "Verifique sua conexão e tente novamente.", variant: "destructive" });
      return;
    }
    const res = await persist({ complete: true });
    setSubmitting(false);
    if (!res.ok) {
      toast({ title: "Não foi possível enviar", description: res.error || "Tente novamente.", variant: "destructive" });
      return;
    }
    setIsComplete(true);
    setStatus("submitted");
    clearLocalBackup();
    toast({ title: "Diagnóstico concluído!", description: "Veja a primeira versão da sua narrativa." });
    navigate("/narrative-preview");
  }, [user, isLocked, flush, persist, clearLocalBackup, navigate]);

  const goToStep = useCallback(async (target: number) => {
    if (isEditable) await flush();
    setStep(target);
  }, [isEditable, flush]);


  const handleReanalysis = async (mode: "edit" | "reset") => {
    if (!user || reanalysisCredits < 1) return;
    await supabase.rpc("consume_credit", {
      p_credit_type: "reanalysis",
      p_amount: -1,
      p_description: `Reanálise: ${mode === "edit" ? "editar questionário de negócio" : "refazer do zero"}`,
    });
    if (mode === "reset") {
      const cleared: Record<string, string> = {};
      fields.forEach(f => { cleared[f.key] = ""; });
      setAnswers(cleared);
    }
    if (existingId) {
      await supabase.from("business_questionnaires").update({ status: "draft", is_complete: false }).eq("id", existingId);
    }
    const { data: latestReport } = await supabase.from("reports").select("version")
      .eq("user_id", user.id).order("version", { ascending: false }).limit(1).single();
    if (latestReport) {
      await supabase.from("reports").update({ status: "pending", content: null, error_message: null, editorial_weeks: [] })
        .eq("user_id", user.id).eq("version", latestReport.version);
    }
    setStatus("draft");
    setIsComplete(false);
    setShowReanalysisDialog(false);
    setStep(0);
    await refreshSubscription();
    toast({ title: mode === "edit" ? "Questionário desbloqueado para edição" : "Questionário reiniciado" });
  };

  // `step` agora representa o índice do BLOCO (0..3), não mais da pergunta individual.
  const blockIndex = stepToBlock(step);
  const currentBlock = blocks[blockIndex];
  const blockFields = fields.slice(currentBlock.range[0], currentBlock.range[1]);
  const progress = Math.round(((blockIndex + 1) / blocks.length) * 100);
  const filledCount = fields.filter(f => (answers[f.key] || "").trim().length > 0).length;
  const allFilled = filledCount === fields.length;
  const filledInBlock = blockFields.filter(f => (answers[f.key] || "").trim().length > 0).length;

  return (
    <DashboardLayout>
      <SeoHead title="Questionário do Negócio · Posiciona" description="Diagnóstico do seu negócio." path="/business-questionnaire" />
      <div className="max-w-2xl lg:max-w-[1100px] mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">Diagnóstico do Negócio</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {filledCount}/{fields.length} respondidas · ~8 min
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(isLocked || isSubmitted) && (
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>
                  Você tem {reanalysisCredits} crédito{reanalysisCredits !== 1 ? "s" : ""} de reanálise disponível{reanalysisCredits !== 1 ? "is" : ""}
                </TooltipContent>
              </Tooltip>
            )}
            <QuestionnaireStatusBadge
              status={isLocked ? "in_use" : isSubmitted ? "completed" : "in_progress"}
            />
          </div>
        </div>

        {/* Persuasion callout — only when still editable */}
        {isEditable && (
          <div className="border-l-2 border-primary/40 bg-primary/5 px-4 py-3 rounded-r-md">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Quanto mais detalhadas e específicas forem suas respostas, mais precisa será a análise estratégica e mais persuasiva será a linha editorial gerada para o seu negócio.
            </p>
          </div>
        )}

        {/* Locked banner */}
        {isLocked && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/60">
            <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Suas respostas estão sendo usadas nas análises. Para editar, consuma 1 crédito de reanálise.
            </p>
          </div>
        )}

        {/* Mode toggle */}
        {isEditable && hydrated && (
          <div className="flex gap-1.5 p-1 bg-muted rounded-lg">
            <button
              onClick={() => { setMode("interview"); setInterviewStarted(true); }}
              className={`flex-1 h-9 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                mode === "interview" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mic className="h-3.5 w-3.5" /> Responder conversando
              <span className="text-[9px] font-semibold uppercase tracking-wider bg-primary/10 text-primary rounded px-1 py-0.5">novo</span>
            </button>
            <button
              onClick={() => setMode("form")}
              className={`flex-1 h-9 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                mode === "form" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <PenLine className="h-3.5 w-3.5" /> Preencher digitando
            </button>
          </div>
        )}

        {/* Progress + tabs por bloco */}
        <div className="space-y-2">
          <Progress value={progress} className="h-1.5" />
          <div className={`flex gap-1.5 ${mode === "interview" && isEditable ? "hidden" : ""}`}>
            {blocks.map((b, i) => (
              <button
                key={b.title}
                onClick={() => goToStep(i * 3)}
                className={`flex-1 h-9 rounded-md text-[11px] font-medium transition-all px-2 ${
                  i === blockIndex
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Bloco {i + 1}
              </button>
            ))}
          </div>
          {isEditable && saveStatus !== "idle" && (
            <div className={`flex items-center gap-1.5 text-[11px] ${saveStatus === "error" ? "text-destructive" : "text-muted-foreground"}`}>
              {saveStatus === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
              {saveStatus === "saved" && <Check className="h-3 w-3 text-success" />}
              {saveStatus === "error" && <AlertTriangle className="h-3 w-3" />}
              <span>{SaveStatusLabel(saveStatus)}</span>
            </div>
          )}
        </div>

        {/* Interview mode */}
        {interviewStarted && isEditable && (
          <div className={mode === "interview" ? "" : "hidden"}>
            <InterviewMode
              kind="business"
              intro="Vamos fazer o diagnóstico do seu negócio em formato de conversa."
              fields={interviewFields}
              answers={answers}
              profession={profile.profession}
              niche={profile.niche}
              onExtract={extracted => setAnswers(prev => ({ ...prev, ...extracted }))}
              onFinish={() => {
                setMode("form");
                setStep(0);
                toast({
                  title: "Hora de revisar",
                  description: "Confira os 4 blocos, ajuste o que quiser e conclua.",
                });
              }}
            />
          </div>
        )}

        {/* Bloco atual */}
        <Card className={`border-primary/10 ${mode === "interview" && isEditable ? "hidden" : ""}`}>
          <CardContent className="pt-5 pb-5 space-y-5">
            <div>
              <p className="text-xs text-primary/60 font-semibold uppercase tracking-wider mb-1">
                Bloco {blockIndex + 1} de {blocks.length}
              </p>
              <h2 className="text-base md:text-lg font-display font-semibold leading-snug">
                {currentBlock.title}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {currentBlock.subtitle}
              </p>
            </div>

            <div className="space-y-5">
              {blockFields.map((field, idxInBlock) => {
                const globalIdx = currentBlock.range[0] + idxInBlock;
                return (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                      <span className="text-muted-foreground text-xs mr-1">{globalIdx + 1}.</span>
                      <span>{field.label}</span>
                      {field.help && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                              <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="text-sm max-w-xs" side="top">
                            {field.help}
                          </PopoverContent>
                        </Popover>
                      )}
                      <InlineHelpButton
                        className="ml-auto"
                        questionContext={`Diagnóstico do Negócio · Bloco ${blockIndex + 1} (${currentBlock.title}) — "${field.label}"`}
                      />
                    </label>
                    {field.type === "input" ? (
                      <Input
                        value={answers[field.key] || ""}
                        onChange={e => setAnswers(prev => ({ ...prev, [field.key]: e.target.value.slice(0, field.max) }))}
                        placeholder={field.placeholder}
                        disabled={isLocked || isSubmitted}
                        maxLength={field.max}
                        className="bg-background"
                      />
                    ) : (
                      <Textarea
                        value={answers[field.key] || ""}
                        onChange={e => setAnswers(prev => ({ ...prev, [field.key]: e.target.value.slice(0, field.max) }))}
                        placeholder={field.placeholder}
                        rows={3}
                        disabled={isLocked || isSubmitted}
                        maxLength={field.max}
                        className="bg-background resize-none text-sm"
                      />
                    )}
                    <p className={`text-[11px] text-right ${(answers[field.key] || "").length >= field.max ? "text-amber-600" : "text-muted-foreground"}`}>
                      {(answers[field.key] || "").length}/{field.max}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-muted-foreground italic">
              {filledInBlock}/{blockFields.length} respondidas neste bloco
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              {blockIndex === 0 ? <span /> : (
                <Button variant="ghost" size="sm" onClick={() => goToStep((blockIndex - 1) * 3)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
              )}

              <div className="flex items-center gap-2">
                {isEditable && (
                  <Button variant="ghost" size="sm" onClick={() => flush()} disabled={saveStatus === "saving"} className="text-muted-foreground">
                    <Save className="h-3.5 w-3.5 mr-1" /> {saveStatus === "saving" ? "..." : "Salvar"}
                  </Button>
                )}
                {blockIndex < blocks.length - 1 ? (
                  <Button size="sm" onClick={() => goToStep((blockIndex + 1) * 3)}>
                    Próximo bloco <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : isEditable ? (
                  <Button size="sm" onClick={submit} disabled={!allFilled || submitting || saveStatus === "saving"}>
                    {submitting ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Enviando…</> : "Concluir diagnóstico"}
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
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

export default BusinessQuestionnaire;
