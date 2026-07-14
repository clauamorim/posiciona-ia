import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Sparkles, Info, ChevronLeft, ChevronRight, Compass, Users, Award, Mic, PenLine } from "lucide-react";
import { QuestionnaireStatusBadge } from "@/components/questionnaire/QuestionnaireStatusBadge";
import { InlineHelpButton } from "@/components/assistant/InlineHelpButton";
import { InterviewMode } from "@/components/questionnaire/InterviewMode";

interface Field {
  key: string;
  label: string;
  placeholder: string;
  help?: string;
}

interface Block {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  fields: Field[];
}

// IMPORTANT: keys preservadas exatamente como antes. Apenas agrupamento visual.
const blocks: Block[] = [
  {
    title: "Sua virada",
    subtitle: "O ponto de partida e a decisão que te trouxe até aqui.",
    icon: Compass,
    fields: [
      { key: "previous_profession", label: "Qual era sua profissão ou situação antes do trabalho que faz hoje?", placeholder: "Ex: analista financeira em multinacional, professora concursada" },
      { key: "career_turn", label: "Qual foi a virada que te trouxe até aqui?", placeholder: "O que você decidiu mudar e que novo caminho escolheu?" },
      { key: "start_year_motivation", label: "Em que ano você começou esse trabalho e o que te motivou a dar o primeiro passo?", placeholder: "Ex: 2019, depois de um burnout. Queria autonomia e trabalhar com algo que me movia." },
    ],
  },
  {
    title: "Vozes da audiência",
    subtitle: "As frases reais que você ouve — de críticos e de clientes.",
    icon: Users,
    fields: [
      { key: "negative_comments", label: "Que críticas ou comentários negativos você ouviu nessa virada?", placeholder: 'Ex: "você é louca de largar CLT", "isso é modinha", "vai dar errado"', help: "Coloque entre aspas as frases literais — elas geram identificação imediata na audiência." },
      { key: "audience_objections", label: "Quais são as 3 principais objeções/dúvidas do seu cliente antes de fechar?", placeholder: '"não tenho tempo agora", "tá caro", "não vai funcionar pra mim"', help: "Fale as frases literais que você escuta — em primeira pessoa, como o cliente diria." },
    ],
  },
  {
    title: "Prova e identidade",
    subtitle: "Resultados reais e o que torna sua voz única.",
    icon: Award,
    fields: [
      { key: "proof_cases", label: "Liste 1 a 3 casos reais que pode citar como prova", placeholder: "Nome (pode ser fictício), contexto antes e resultado depois. Um por linha.", help: "Ex: Marina, advogada com 0 clientes em 6 meses, fechou 4 contratos em 30 dias." },
      { key: "personal_expressions", label: "Tem alguma palavra, expressão ou jeito de falar que é muito seu?", placeholder: "Algum bordão, gíria, palavra recorrente?" },
      { key: "forbidden_topics", label: "Tem algum tema ou assunto que você JAMAIS tocaria?", placeholder: "Política, religião, vida amorosa, dieta — qualquer coisa fora dos limites." },
    ],
  },
];

const allFields = blocks.flatMap(b => b.fields);
const interviewFields = allFields.map(f => ({ key: f.key, label: f.label }));

const SalesNarrativeQuestionnaire = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromIntro = searchParams.get("from") === "intro";
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [blockIndex, setBlockIndex] = useState(0);
  const [mode, setMode] = useState<"form" | "interview">("form");
  // Monta o chat só após a hidratação (1º clique) e mantém montado depois,
  // para a conversa sobreviver à alternância entre os modos.
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [profile, setProfile] = useState<{ profession?: string; niche?: string }>({});
  // Esta página não tem autosave: sinaliza quando há extração da entrevista
  // pendente de persistir (o effect abaixo salva com o estado já mesclado).
  const [pendingSave, setPendingSave] = useState(false);

  const currentBlock = blocks[blockIndex];
  const isFirst = blockIndex === 0;
  const isLast = blockIndex === blocks.length - 1;

  useEffect(() => {
    // Só hidrata UMA vez por id de usuário. Sem o guard `hydrated`, mudar de
    // aba/janela revalida a sessão do Supabase, gera um novo objeto `user`
    // (mesmo id, referência nova), o effect re-roda, e sobrescreve as
    // respostas já digitadas que ainda não foram salvas no banco.
    if (!user?.id || hydrated) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("sales_narrative_questionnaires")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const init: Record<string, string> = {};
      allFields.forEach(f => { init[f.key] = (data as any)?.[f.key] || ""; });
      setAnswers(init);
      setIsComplete(Boolean(data?.is_complete));
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

  // Roda após o render com as respostas da entrevista já mescladas no estado,
  // garantindo que o persist salve o snapshot completo.
  useEffect(() => {
    if (!pendingSave || !hydrated) return;
    setPendingSave(false);
    persist(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSave]);

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
      if (fromIntro) {
        toast({ title: "História de venda salva", description: "Vamos seguir para seus resultados." });
        navigate("/results");
      } else {
        toast({ title: "História de venda salva", description: "Agora você pode gerar suas sequências." });
        navigate("/stories-de-venda");
      }
    }
  };

  const goToBlock = async (target: number) => {
    await persist(false);
    setBlockIndex(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!hydrated) {
    return (
      <DashboardLayout>
        <SeoHead title="Narrativa de Vendas · Posiciona" description="Construa sua narrativa de vendas." path="/sales-narrative" />
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  const filledTotal = allFields.filter(f => (answers[f.key] || "").trim().length > 0).length;
  const progress = Math.round((filledTotal / allFields.length) * 100);
  const Icon = currentBlock.icon;
  const filledInBlock = currentBlock.fields.filter(f => (answers[f.key] || "").trim().length > 0).length;

  return (
    <DashboardLayout>
      <SeoHead title="Narrativa de Vendas · Posiciona" description="Construa sua narrativa de vendas." path="/sales-narrative" />
      <div className="max-w-2xl lg:max-w-[1100px] mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">História de Venda</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Opcional · {filledTotal}/{allFields.length} respondidas · ~10 min
            </p>
          </div>
          <QuestionnaireStatusBadge status={isComplete ? "completed" : "in_progress"} />
        </div>

        <div className="border-l-2 border-primary/40 bg-primary/5 px-4 py-3 rounded-r-md flex items-start gap-3">
          <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Este questionário é <strong>opcional</strong> e leva uns 10 minutos. Ele alimenta o módulo
            <strong> Stories de Venda</strong> e também enriquece sua linha editorial com voz mais autêntica.
            Pule se quiser usar só a linha editorial padrão.
          </p>
        </div>

        {/* Mode toggle */}
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

        {/* Progress + Tabs */}
        <div className="space-y-2">
          <Progress value={progress} className="h-1.5" />
          <div className={`flex gap-1.5 ${mode === "interview" ? "hidden" : ""}`}>
            {blocks.map((b, i) => (
              <button
                key={b.title}
                onClick={() => goToBlock(i)}
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
        </div>

        {/* Interview mode */}
        {interviewStarted && (
          <div className={mode === "interview" ? "" : "hidden"}>
            <InterviewMode
              kind="sales"
              intro="Vamos construir sua história de venda em formato de conversa."
              fields={interviewFields}
              answers={answers}
              profession={profile.profession}
              niche={profile.niche}
              onExtract={extracted => {
                setAnswers(prev => ({ ...prev, ...extracted }));
                setPendingSave(true);
              }}
              onFinish={() => {
                setMode("form");
                setBlockIndex(0);
                toast({
                  title: "Hora de revisar",
                  description: "Confira os 3 blocos, ajuste o que quiser e salve.",
                });
              }}
            />
          </div>
        )}

        <Card className={`border-primary/10 ${mode === "interview" ? "hidden" : ""}`}>
          <CardContent className="pt-5 pb-5 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
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
            </div>

            {currentBlock.fields.map(f => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                  <span>{f.label}</span>
                  <InlineHelpButton
                    className="ml-auto"
                    questionContext={`História de Venda · Bloco ${blockIndex + 1} (${currentBlock.title}) — "${f.label}"`}
                  />
                </label>
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

            <div className="text-[11px] text-muted-foreground italic">
              {filledInBlock}/{currentBlock.fields.length} respondidas neste bloco
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              {isFirst ? <span /> : (
                <Button variant="ghost" size="sm" onClick={() => goToBlock(blockIndex - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
              )}
              {!isLast ? (
                <Button size="sm" onClick={() => goToBlock(blockIndex + 1)}>
                  Próximo bloco <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" size="sm" onClick={handleSaveAndExit} disabled={saving || submitting}>
                    {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                    Salvar e voltar depois
                  </Button>
                  <Button size="sm" onClick={handleSaveAndGenerate} disabled={saving || submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                    Salvar e gerar sequência
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SalesNarrativeQuestionnaire;
