import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";

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

const BusinessQuestionnaire = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

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
          const existing: Record<string, string> = {};
          fields.forEach(f => { existing[f.key] = (data[0] as any)[f.key] || ""; });
          setAnswers(existing);
        }
      });
  }, [user]);

  const save = useCallback(async (complete = false) => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      ...answers,
      is_complete: complete,
    };
    if (existingId) {
      await supabase.from("business_questionnaires").update(payload).eq("id", existingId);
    } else {
      const { data } = await supabase.from("business_questionnaires").insert(payload).select("id").single();
      if (data) setExistingId(data.id);
    }
    setSaving(false);
    toast({ title: complete ? "Questionário completo!" : "Salvo automaticamente" });
    if (complete) navigate("/archetype-questionnaire");
  }, [user, answers, existingId, navigate]);

  const field = fields[step];
  const progress = Math.round(((step + 1) / fields.length) * 100);
  const allFilled = fields.every(f => (answers[f.key] || "").trim().length > 0);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display">Questionário do Negócio</h1>
          <p className="text-muted-foreground text-sm mt-1">Pergunta {step + 1} de {fields.length}</p>
        </div>

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
              />
            ) : (
              <Textarea
                value={answers[field.key] || ""}
                onChange={e => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                rows={4}
              />
            )}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button variant="ghost" size="sm" onClick={() => save(false)} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
              </Button>
              {step < fields.length - 1 ? (
                <Button onClick={() => { save(false); setStep(s => s + 1); }}>
                  Próximo <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={() => save(true)} disabled={!allFilled}>
                  Finalizar ✓
                </Button>
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
                    ? "bg-success/10 text-success border border-success/20"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default BusinessQuestionnaire;
