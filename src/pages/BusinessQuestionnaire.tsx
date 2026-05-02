import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Save, Lock, RefreshCw, Pencil, Trash2, HelpCircle, Check, AlertTriangle, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuestionnaireAutosave, SaveStatusLabel } from "@/hooks/useQuestionnaireAutosave";

const fields = [
  { key: "company_name", label: "Nome da empresa ou negócio", type: "input", placeholder: "Ex: Studio Bella", help: "Pode ser o nome fantasia, nome pessoal ou como você é conhecida(o) no mercado." },
  { key: "services", label: "Serviços ou produtos oferecidos", type: "textarea", placeholder: "Descreva seus principais serviços ou produtos", help: "Liste os principais serviços/produtos que você oferece." },
  { key: "target_audience", label: "Público-alvo", type: "textarea", placeholder: "Quem são seus clientes ideais?", help: "Descreva quem é seu cliente ideal: idade, gênero, profissão, nível de renda, interesses e dores." },
  { key: "external_problems", label: "Problemas externos que resolve", type: "textarea", placeholder: "Que problemas práticos você resolve para o cliente?", help: "Problemas externos são dificuldades práticas e visíveis." },
  { key: "internal_problems", label: "Problemas internos do cliente", type: "textarea", placeholder: "Como o cliente se sente antes de contratar você?", help: "São os sentimentos e frustrações do cliente." },
  { key: "empathic_statements", label: "Declarações empáticas", type: "textarea", placeholder: "Frases que mostram que você entende o cliente", help: "Frases que demonstram empatia e criam conexão." },
  { key: "authority_proofs", label: "Provas de autoridade", type: "textarea", placeholder: "Certificações, cases, depoimentos, números", help: "O que prova que você é qualificada(o)?" },
  { key: "hiring_steps", label: "Etapas para contratar", type: "textarea", placeholder: "Quais os passos para o cliente contratar seu serviço?", help: "Descreva o passo a passo simples para contratar você." },
  { key: "client_fears", label: "Medos do cliente", type: "textarea", placeholder: "O que impede o cliente de agir?", help: "Quais medos impedem o cliente de comprar?" },
  { key: "main_cta", label: "Principal chamada para ação", type: "input", placeholder: "Ex: Agende sua consultoria gratuita", help: "A ação principal que você quer que o cliente tome." },
  { key: "negative_consequences", label: "Consequências negativas evitadas", type: "textarea", placeholder: "O que acontece se o cliente NÃO agir?", help: "O que acontece se o cliente não agir?" },
  { key: "promised_transformations", label: "Conquistas e transformações prometidas", type: "textarea", placeholder: "Como a vida do cliente muda após seu serviço?", help: "Descreva a transformação que você entrega." },
];

type QStatus = "draft" | "submitted" | "locked";

const BusinessQuestionnaire = () => {
  const { user, balances, refreshSubscription } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [status, setStatus] = useState<QStatus>("draft");
  const [showReanalysisDialog, setShowReanalysisDialog] = useState(false);

  const isLocked = status === "locked";
  const isSubmitted = status === "submitted";
  const isEditable = status === "draft";
  const reanalysisCredits = balances?.reanalysis_credits ?? 0;

  useEffect(() => {
    if (!user) return;
    supabase
      .from("business_questionnaires")
      .select("*")
      .eq("user_id", user.id)
      .order("version", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) {
          setExistingId(data[0].id);
          setIsComplete(data[0].is_complete || false);
          setStatus((data[0].status as QStatus) || "draft");
          const existing: Record<string, string> = {};
          fields.forEach(f => { existing[f.key] = (data[0] as any)[f.key] || ""; });
          setAnswers(existing);
        }
      });
  }, [user]);

  const save = useCallback(async (complete = false) => {
    if (!user || isLocked) return;
    setSaving(true);
    const newStatus = complete ? "submitted" : "draft";
    const payload = {
      user_id: user.id,
      ...answers,
      is_complete: complete,
      status: newStatus,
    };
    if (existingId) {
      await supabase.from("business_questionnaires").update(payload).eq("id", existingId);
    } else {
      const { data } = await supabase.from("business_questionnaires").insert(payload).select("id").single();
      if (data) setExistingId(data.id);
    }
    setSaving(false);
    if (complete) {
      setIsComplete(true);
      setStatus("submitted");
    }
    toast({ title: complete ? "Questionário enviado!" : "Salvo automaticamente" });
    if (complete) navigate("/personal-questionnaire");
  }, [user, answers, existingId, navigate, isLocked]);

  const handleReanalysis = async (mode: "edit" | "reset") => {
    if (!user || reanalysisCredits < 1) return;
    await supabase.from("user_balances").update({ reanalysis_credits: reanalysisCredits - 1 }).eq("user_id", user.id);
    await supabase.from("credit_logs").insert({
      user_id: user.id,
      credit_type: "reanalysis",
      amount: -1,
      description: `Reanálise: ${mode === "edit" ? "editar questionário de negócio" : "refazer do zero"}`,
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

  const field = fields[step];
  const progress = Math.round(((step + 1) / fields.length) * 100);
  const filledCount = fields.filter(f => (answers[f.key] || "").trim().length > 0).length;
  const allFilled = filledCount === fields.length;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">Diagnóstico do Negócio</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {filledCount}/{fields.length} preenchidas
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(isLocked || isSubmitted) && (
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
            <Badge
              variant="outline"
              className={
                isLocked
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : isSubmitted
                    ? "bg-amber-500/10 text-amber-600 border-amber-200"
                    : "bg-success/10 text-success border-success/20"
              }
            >
              {isLocked && <Lock className="h-3 w-3 mr-1" />}
              {isLocked ? "Em uso" : isSubmitted ? "Concluído" : "Rascunho"}
            </Badge>
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

        {/* Progress stepper */}
        <div className="space-y-2">
          <Progress value={progress} className="h-1.5" />
          <div className="flex gap-1.5 flex-wrap">
            {fields.map((f, i) => (
              <button
                key={f.key}
                onClick={() => setStep(i)}
                className={`w-7 h-7 rounded-md text-[11px] font-medium transition-all ${
                  i === step
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : (answers[f.key] || "").trim()
                      ? "bg-success/10 text-success border border-success/20"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Current question */}
        <Card className="border-primary/10">
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-primary/60 font-semibold uppercase tracking-wider mb-1">
                  Etapa {step + 1} de {fields.length}
                </p>
                <h2 className="text-base md:text-lg font-display font-semibold leading-snug flex items-center gap-2">
                  {field.label}
                  {field.help && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="text-sm max-w-xs" side="top">
                        {field.help}
                      </PopoverContent>
                    </Popover>
                  )}
                </h2>
              </div>
            </div>

            {field.type === "input" ? (
              <Input
                value={answers[field.key] || ""}
                onChange={e => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                disabled={isLocked || isSubmitted}
                className="bg-background"
              />
            ) : (
              <Textarea
                value={answers[field.key] || ""}
                onChange={e => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                rows={4}
                disabled={isLocked || isSubmitted}
                className="bg-background resize-none"
              />
            )}

            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>

              <div className="flex items-center gap-2">
                {isEditable && (
                  <Button variant="ghost" size="sm" onClick={() => save(false)} disabled={saving} className="text-muted-foreground">
                    <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "..." : "Salvar"}
                  </Button>
                )}
                {step < fields.length - 1 ? (
                  <Button size="sm" onClick={() => { if (isEditable) save(false); setStep(s => s + 1); }}>
                    Próximo <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : isEditable ? (
                  <Button size="sm" onClick={() => save(true)} disabled={!allFilled}>
                    Concluir diagnóstico
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
