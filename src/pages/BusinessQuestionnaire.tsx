import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Save, Sparkles, Loader2, Lock, AlertTriangle } from "lucide-react";

const fields = [
  { key: "company_name", label: "Nome da empresa ou negócio", type: "input", placeholder: "Ex: Studio Bella" },
  { key: "services", label: "Serviços ou produtos oferecidos", type: "textarea", placeholder: "Descreva seus principais serviços ou produtos" },
  { key: "target_audience", label: "Público-alvo", type: "textarea", placeholder: "Quem são seus clientes ideais?" },
  { key: "external_problems", label: "Problemas externos que resolve", type: "textarea", placeholder: "Que problemas práticos você resolve para o cliente?" },
  { key: "internal_problems", label: "Problemas internos do cliente", type: "textarea", placeholder: "Como o cliente se sente antes de contratar você?" },
  { key: "empathic_statements", label: "Declarações empáticas", type: "textarea", placeholder: "Frases que mostram que você entende o cliente" },
  { key: "authority_proofs", label: "Provas de autoridade", type: "textarea", placeholder: "Certificações, cases, depoimentos, números" },
  { key: "hiring_steps", label: "Etapas para contratar", type: "textarea", placeholder: "Quais os passos para o cliente contratar seu serviço?" },
  { key: "client_fears", label: "Medos do cliente em relação ao setor", type: "textarea", placeholder: "O que impede o cliente de agir?" },
  { key: "main_cta", label: "Principal chamada para ação", type: "input", placeholder: "Ex: Agende sua consultoria gratuita" },
  { key: "negative_consequences", label: "Consequências negativas evitadas", type: "textarea", placeholder: "O que acontece se o cliente NÃO agir?" },
  { key: "promised_transformations", label: "Conquistas ou transformações prometidas", type: "textarea", placeholder: "Como a vida do cliente muda após seu serviço?" },
];

type QStatus = "draft" | "submitted" | "locked";

const BusinessQuestionnaire = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [status, setStatus] = useState<QStatus>("draft");
  const [generatingStoryBrand, setGeneratingStoryBrand] = useState(false);

  const isLocked = status === "locked";
  const isSubmitted = status === "submitted";
  const isEditable = status === "draft";

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

  const handleGenerateStoryBrand = async () => {
    if (!user) return;
    setGeneratingStoryBrand(true);
    try {
      const { data: bq } = await supabase.from("business_questionnaires").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single();
      const { data: profile } = await supabase.from("profiles").select("niche").eq("user_id", user.id).single();
      const { data: topArchetypes } = await supabase.from("user_top_archetypes").select("*").eq("user_id", user.id).order("rank", { ascending: true }).limit(3);

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

      // Lock questionnaire after successful generation
      if (existingId) {
        await supabase.from("business_questionnaires").update({ status: "locked" }).eq("id", existingId);
        setStatus("locked");
      }

      toast({ title: "StoryBrand gerado com sucesso!" });
      navigate("/storybrand");
    } catch (err: any) {
      await supabase.from("reports").update({
        status: "error",
        error_message: err.message,
      }).eq("user_id", user.id).eq("version", 1);
      toast({ title: "Erro ao gerar StoryBrand", description: err.message, variant: "destructive" });
    }
    setGeneratingStoryBrand(false);
  };

  const field = fields[step];
  const progress = Math.round(((step + 1) / fields.length) * 100);
  const allFilled = fields.every(f => (answers[f.key] || "").trim().length > 0);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display">Questionário do Negócio</h1>
            <p className="text-muted-foreground text-sm mt-1">Pergunta {step + 1} de {fields.length}</p>
          </div>
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
            {isLocked ? "Bloqueado" : isSubmitted ? "Enviado" : "Rascunho"}
          </Badge>
        </div>

        {isLocked && (
          <Card className="border-red-200 bg-red-500/5">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Lock className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Questionário bloqueado</p>
                <p className="text-xs text-muted-foreground">
                  Este questionário foi bloqueado após a geração do StoryBrand. Contate o administrador para desbloquear.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Progress value={progress} className="h-2" />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">{field.label}</CardTitle>
            <CardDescription>Etapa {step + 1}/{fields.length}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {field.type === "input" ? (
              <Input
                value={answers[field.key] || ""}
                onChange={e => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                disabled={isLocked}
              />
            ) : (
              <Textarea
                value={answers[field.key] || ""}
                onChange={e => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                rows={4}
                disabled={isLocked}
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
                  Finalizar ✓
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

        {isComplete && !isLocked && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">Questionário completo! Gere sua análise StoryBrand.</p>
              <Button onClick={handleGenerateStoryBrand} disabled={generatingStoryBrand} className="gap-2" size="lg">
                {generatingStoryBrand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generatingStoryBrand ? "Gerando StoryBrand..." : "Gerar StoryBrand"}
              </Button>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Após gerar, o questionário será bloqueado para edição.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BusinessQuestionnaire;
