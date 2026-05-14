import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Sparkles, Info } from "lucide-react";

interface Field {
  key: string;
  label: string;
  placeholder: string;
  help?: string;
}

const fields: Field[] = [
  { key: "previous_profession", label: "Qual era sua profissão ou situação antes do trabalho que faz hoje?", placeholder: "Ex: analista financeira em multinacional, professora concursada" },
  { key: "career_turn", label: "Qual foi a virada que te trouxe até aqui?", placeholder: "O que você decidiu mudar e que novo caminho escolheu?" },
  { key: "negative_comments", label: "Que críticas ou comentários negativos você ouviu nessa virada?", placeholder: 'Ex: "você é louca de largar CLT", "isso é modinha", "vai dar errado"', help: "Coloque entre aspas as frases literais — elas geram identificação imediata na audiência." },
  { key: "audience_objections", label: "Quais são as 3 principais objeções/dúvidas do seu cliente antes de fechar?", placeholder: '"não tenho tempo agora", "tá caro", "não vai funcionar pra mim"', help: "Fale as frases literais que você escuta — em primeira pessoa, como o cliente diria." },
  { key: "proof_cases", label: "Liste 1 a 3 casos reais que pode citar como prova", placeholder: "Nome (pode ser fictício), contexto antes e resultado depois. Um por linha.", help: "Ex: Marina, advogada com 0 clientes em 6 meses, fechou 4 contratos em 30 dias." },
  { key: "personal_expressions", label: "Tem alguma palavra, expressão ou jeito de falar que é muito seu?", placeholder: "Algum bordão, gíria, palavra recorrente?" },
  { key: "forbidden_topics", label: "Tem algum tema ou assunto que você JAMAIS tocaria?", placeholder: "Política, religião, vida amorosa, dieta — qualquer coisa fora dos limites." },
  { key: "start_year_motivation", label: "Em que ano você começou esse trabalho e o que te motivou a dar o primeiro passo?", placeholder: "Ex: 2019, depois de um burnout. Queria autonomia e trabalhar com algo que me movia." },
];

const SalesNarrativeQuestionnaire = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("sales_narrative_questionnaires")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      const init: Record<string, string> = {};
      fields.forEach(f => { init[f.key] = (data as any)?.[f.key] || ""; });
      setAnswers(init);
      setIsComplete(Boolean(data?.is_complete));
      setHydrated(true);
    })();
  }, [user]);

  const persist = async (complete: boolean) => {
    if (!user) return false;
    const payload: any = {
      user_id: user.id,
      ...answers,
      is_complete: complete || isComplete,
      status: complete ? "submitted" : "draft",
    };
    const { error } = await supabase
      .from("sales_narrative_questionnaires")
      .upsert(payload, { onConflict: "user_id" });
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSaveAndExit = async () => {
    setSaving(true);
    const ok = await persist(false);
    setSaving(false);
    if (ok) {
      toast({ title: "Rascunho salvo" });
      navigate("/dashboard");
    }
  };

  const handleSaveAndGenerate = async () => {
    setSubmitting(true);
    const ok = await persist(true);
    setSubmitting(false);
    if (ok) {
      setIsComplete(true);
      toast({ title: "História de venda salva", description: "Agora você pode gerar suas sequências." });
      navigate("/stories-de-venda");
    }
  };

  if (!hydrated) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">História de Venda</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Questionário opcional · ~10 min</p>
          </div>
          <Badge variant="outline" className={isComplete ? "bg-success/10 text-success border-success/20" : "bg-amber-500/10 text-amber-600 border-amber-200"}>
            {isComplete ? "Completo" : "Em preenchimento"}
          </Badge>
        </div>

        <div className="border-l-2 border-primary/40 bg-primary/5 px-4 py-3 rounded-r-md flex items-start gap-3">
          <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Este questionário é <strong>opcional</strong> e leva uns 10 minutos. Ele alimenta o módulo
            <strong> Stories de Venda</strong> e também enriquece sua linha editorial com voz mais autêntica.
            Pule se quiser usar só a linha editorial padrão.
          </p>
        </div>

        <Card className="border-primary/10">
          <CardContent className="pt-5 pb-5 space-y-5">
            {fields.map(f => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-sm font-medium block">{f.label}</label>
                {f.help && <p className="text-xs text-muted-foreground italic">{f.help}</p>}
                <Textarea
                  value={answers[f.key] || ""}
                  onChange={e => setAnswers(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  rows={3}
                  className="bg-background resize-none text-sm"
                />
              </div>
            ))}

            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/40">
              <Button variant="outline" onClick={handleSaveAndExit} disabled={saving || submitting} className="flex-1">
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                Salvar e voltar depois
              </Button>
              <Button onClick={handleSaveAndGenerate} disabled={saving || submitting} className="flex-1">
                {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                Salvar e gerar minha primeira sequência
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SalesNarrativeQuestionnaire;
