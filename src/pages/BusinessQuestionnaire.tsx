import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Save, Lock, RefreshCw, Pencil, Trash2, HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const fields = [
  { key: "company_name", label: "Nome da empresa ou negócio", type: "input", placeholder: "Ex: Studio Bella", help: "Pode ser o nome fantasia, nome pessoal ou como você é conhecida(o) no mercado." },
  { key: "services", label: "Serviços ou produtos oferecidos", type: "textarea", placeholder: "Descreva seus principais serviços ou produtos", help: "Liste os principais serviços/produtos que você oferece. Exemplo: consultoria de imagem, design de interiores, aulas de yoga." },
  { key: "target_audience", label: "Público-alvo", type: "textarea", placeholder: "Quem são seus clientes ideais?", help: "Descreva quem é seu cliente ideal: idade, gênero, profissão, nível de renda, interesses e dores. Quanto mais específico, melhor a estratégia." },
  { key: "external_problems", label: "Problemas externos que resolve", type: "textarea", placeholder: "Que problemas práticos você resolve para o cliente?", help: "Problemas externos são dificuldades práticas e visíveis. Exemplo: 'Não consegue se vestir bem para reuniões', 'Não sabe montar treinos sozinho'." },
  { key: "internal_problems", label: "Problemas internos do cliente", type: "textarea", placeholder: "Como o cliente se sente antes de contratar você?", help: "São os sentimentos e frustrações do cliente. Exemplo: 'Se sente insegura com a própria imagem', 'Tem medo de parecer amador'." },
  { key: "empathic_statements", label: "Declarações empáticas", type: "textarea", placeholder: "Frases que mostram que você entende o cliente", help: "Frases que demonstram empatia. Exemplo: 'Eu sei como é difícil se posicionar quando ninguém parece notar seu trabalho'. Isso cria conexão." },
  { key: "authority_proofs", label: "Provas de autoridade", type: "textarea", placeholder: "Certificações, cases, depoimentos, números", help: "O que prova que você é qualificada(o)? Certificações, anos de experiência, número de clientes atendidos, depoimentos ou resultados concretos." },
  { key: "hiring_steps", label: "Etapas para contratar", type: "textarea", placeholder: "Quais os passos para o cliente contratar seu serviço?", help: "Descreva o passo a passo simples para contratar você. Exemplo: '1) Agende uma conversa, 2) Receba o diagnóstico, 3) Comece o acompanhamento'." },
  { key: "client_fears", label: "Medos do cliente em relação ao setor", type: "textarea", placeholder: "O que impede o cliente de agir?", help: "Quais medos impedem o cliente de comprar? Exemplo: 'Medo de gastar dinheiro e não ter resultado', 'Medo de ser julgado'." },
  { key: "main_cta", label: "Principal chamada para ação", type: "input", placeholder: "Ex: Agende sua consultoria gratuita", help: "A ação principal que você quer que o cliente tome. Deve ser clara e direta. Exemplo: 'Agende agora', 'Comece seu diagnóstico', 'Fale comigo no WhatsApp'." },
  { key: "negative_consequences", label: "Consequências negativas evitadas", type: "textarea", placeholder: "O que acontece se o cliente NÃO agir?", help: "O que acontece se o cliente não agir? Exemplo: 'Continua invisível no mercado', 'Perde oportunidades para a concorrência'. Ajuda a criar urgência." },
  { key: "promised_transformations", label: "Conquistas ou transformações prometidas", type: "textarea", placeholder: "Como a vida do cliente muda após seu serviço?", help: "Descreva a transformação que você entrega. Exemplo: 'Se torna referência no nicho', 'Dobra o faturamento em 6 meses', 'Sente confiança ao se apresentar'." },
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
    if (complete) navigate("/archetype-questionnaire");
  }, [user, answers, existingId, navigate, isLocked]);

  const handleReanalysis = async (mode: "edit" | "reset") => {
    if (!user || reanalysisCredits < 1) return;

    // Consume credit
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

    // Unlock questionnaire
    if (existingId) {
      await supabase.from("business_questionnaires").update({ status: "draft", is_complete: false }).eq("id", existingId);
    }

    // Reset report so Results.tsx will regenerate it
    await supabase.from("reports").update({ status: "pending", content: null, error_message: null })
      .eq("user_id", user.id).eq("version", 1);

    setStatus("draft");
    setIsComplete(false);
    setShowReanalysisDialog(false);
    setStep(0);
    await refreshSubscription();
    toast({ title: mode === "edit" ? "Questionário desbloqueado para edição" : "Questionário reiniciado" });
  };

  const field = fields[step];
  const progress = Math.round(((step + 1) / fields.length) * 100);
  const allFilled = fields.every(f => (answers[f.key] || "").trim().length > 0);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Questionário do Negócio</h1>
            <p className="text-muted-foreground text-sm mt-1">Pergunta {step + 1} de {fields.length}</p>
          </div>
          <div className="flex items-center gap-2">
            {(isLocked || isSubmitted) && (
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
            <Badge
              variant="outline"
              className={
                isLocked
                  ? "bg-red-500/10 text-red-600 border-red-200"
                  : isSubmitted
                    ? "bg-amber-500/10 text-amber-600 border-amber-200"
                    : "bg-green-500/10 text-green-600 border-green-200"
              }
            >
              {isLocked && <Lock className="h-3 w-3 mr-1" />}
              {isLocked ? "Em uso nas análises" : isSubmitted ? "Concluído" : "Rascunho"}
            </Badge>
          </div>
        </div>

        {isLocked && (
          <Card className="border-border bg-muted/30">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Concluído — suas respostas já estão sendo usadas nas análises.</p>
                <p className="text-xs text-muted-foreground">
                  Para atualizar os resultados, faça uma nova análise usando 1 crédito de reanálise.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Progress value={progress} className="h-2" />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              {field.label}
              {field.help && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="text-sm max-w-xs" side="top">
                    {field.help}
                  </PopoverContent>
                </Popover>
              )}
            </CardTitle>
            <CardDescription>Etapa {step + 1}/{fields.length}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {field.type === "input" ? (
              <Input
                value={answers[field.key] || ""}
                onChange={e => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                disabled={isLocked || isSubmitted}
              />
            ) : (
              <Textarea
                value={answers[field.key] || ""}
                onChange={e => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                rows={4}
                disabled={isLocked || isSubmitted}
              />
            )}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              {isEditable && (
                <Button variant="ghost" size="sm" onClick={() => save(false)} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
                </Button>
              )}
              {step < fields.length - 1 ? (
                <Button onClick={() => { if (isEditable) save(false); setStep(s => s + 1); }}>
                  Próximo <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : isEditable ? (
                <Button onClick={() => save(true)} disabled={!allFilled}>
                  Concluir questionário
                </Button>
              ) : (
                <div />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          {fields.map((f, i) => (
            <button
              key={f.key}
              onClick={() => setStep(i)}
              className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : (answers[f.key] || "").trim()
                    ? "bg-green-500/10 text-green-600 border border-green-200"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </button>
          ))}
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

export default BusinessQuestionnaire;
