import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Save, Sparkles, ShieldAlert, HelpCircle, Heart, Briefcase, Compass, BookOpen, Loader2, Check, AlertTriangle, Mic, PenLine } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InlineHelpButton } from "@/components/assistant/InlineHelpButton";
import { QuestionnaireStatusBadge } from "@/components/questionnaire/QuestionnaireStatusBadge";
import { InterviewMode } from "@/components/questionnaire/InterviewMode";
import { useQuestionnaireAutosave, SaveStatusLabel } from "@/hooks/useQuestionnaireAutosave";

type QStatus = "draft" | "submitted";

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

const personalBlocks: Block[] = [
  {
    title: "Quem você é fora do trabalho",
    subtitle: "Suas paixões e bastidores da vida pessoal alimentam histórias que conectam.",
    icon: Heart,
    fields: [
      { key: "hobby", label: "Seu maior hobby", placeholder: "Ex: artes marciais, fotografia analógica, jardinagem urbana...", help: "Algo que você faz por puro prazer, sem relação com trabalho." },
      { key: "pets", label: "Pets ou animais que ama", placeholder: "Tem cachorro, gato, ou nenhum bicho? Conte um pouco sobre eles." },
      { key: "sports", label: "Esportes ou atividade física", placeholder: "O que você pratica e por quê?" },
      { key: "dependents", label: "Filhos ou dependentes", placeholder: "Tem filhos? Cuida de alguém? Como isso molda sua rotina?" },
      { key: "sunday_morning", label: "Como é seu domingo de manhã ideal", placeholder: "Pinte a cena: onde, com quem, fazendo o quê." },
    ],
  },
  {
    title: "Bastidores profissionais",
    subtitle: "Momentos reais do seu trabalho — vitórias, falhas e rituais — viram conteúdo autêntico.",
    icon: Briefcase,
    fields: [
      { key: "proud_moment", label: "Momento profissional do qual mais se orgulha", placeholder: "Conte um caso específico, com detalhes." },
      { key: "failure_lesson", label: "Uma falha que te ensinou algo", placeholder: "Algo que deu errado e mudou sua forma de trabalhar." },
      { key: "work_routine", label: "Como é um dia típico de trabalho seu", placeholder: "Horários, ambientes, ritmos." },
      { key: "pre_meeting_ritual", label: "Algum ritual antes de atender clientes", placeholder: "Café, música, respiração, leitura — qualquer coisa." },
      { key: "unblock_method", label: "Como você sai de um bloqueio criativo ou mental", placeholder: "O que faz quando trava?" },
    ],
  },
  {
    title: "Valores e visão",
    subtitle: "O que você defende e o que quer despertar nas pessoas.",
    icon: Compass,
    fields: [
      { key: "defended_belief", label: "Uma crença que você defende publicamente", placeholder: "Algo no qual acredita com convicção." },
      { key: "social_cause", label: "Causa social ou tema que te mobiliza", placeholder: "Pode ser educação, meio ambiente, saúde mental..." },
      { key: "desired_feeling", label: "O que você quer que as pessoas sintam ao consumir seu conteúdo", placeholder: "Inspiração, segurança, provocação, calma...?" },
      { key: "guiding_belief", label: "Uma frase ou ideia que guia suas decisões", placeholder: "Mantra pessoal, citação favorita, princípio." },
    ],
  },
  {
    title: "Memórias que moldaram você",
    subtitle: "Histórias do passado dão profundidade aos posts em formato storytelling.",
    icon: BookOpen,
    fields: [
      { key: "formative_story", label: "Uma história da sua vida que te formou como profissional", placeholder: "Pode ser da infância, juventude ou início de carreira." },
      { key: "biggest_influence", label: "Alguém que te influenciou profundamente", placeholder: "Pessoa real, autor, mentor, familiar — e por quê." },
      { key: "advice_to_20yo", label: "Um conselho que daria pra você de 20 anos", placeholder: "Com base no que aprendeu até hoje." },
    ],
  },
];

// "Voz da Marca" — mesmas colunas de personal_questionnaires (mesmas chaves),
// reenquadradas para marca institucional. Espelho de
// _shared/buildClaudeContext.ts INSTITUTIONAL_VOICE_LABELS e de
// questionnaire-interview/index.ts INSTITUTIONAL_VOICE_FIELDS — mudou aqui,
// mudar lá também.
const institutionalBlocks: Block[] = [
  {
    title: "Cultura e cotidiano da marca",
    subtitle: "Como a marca é por dentro alimenta bastidores autênticos, não genéricos.",
    icon: Heart,
    fields: [
      { key: "hobby", label: "Algo que a marca faz muito bem e com orgulho, além de vender", placeholder: "Um jeito de atender, uma prática interna, uma tradição da equipe...", help: "Algo que diferencia a marca por dentro, não um argumento de venda." },
      { key: "pets", label: "Como é a equipe por trás da marca", placeholder: "Quantas pessoas, quem faz o quê, clima do time." },
      { key: "sports", label: "Hábito ou disciplina que a marca cultiva internamente", placeholder: "Reuniões, rituais, práticas que mantêm o time afiado." },
      { key: "dependents", label: "Quem depende da marca funcionar bem", placeholder: "Clientes fixos, parceiros, comunidade — quem sente quando algo sai do previsto." },
      { key: "sunday_morning", label: "Como é uma semana bem-sucedida para a marca", placeholder: "Pinte a cena: o que está acontecendo quando tudo vai bem." },
    ],
  },
  {
    title: "Bastidores da entrega",
    subtitle: "Casos reais de operação — acertos, falhas e rituais — viram conteúdo autêntico.",
    icon: Briefcase,
    fields: [
      { key: "proud_moment", label: "Resultado ou entrega da qual a marca mais se orgulha", placeholder: "Conte um caso específico, com detalhes (nome pode ser fictício)." },
      { key: "failure_lesson", label: "Um erro ou desafio que ensinou algo", placeholder: "Algo que deu errado e mudou a forma de operar." },
      { key: "work_routine", label: "Como é um dia típico de operação", placeholder: "Horários, ferramentas, ritmos, etapas." },
      { key: "pre_meeting_ritual", label: "Algum ritual antes de atender um cliente", placeholder: "Reunião de alinhamento, checklist, preparação — qualquer coisa." },
      { key: "unblock_method", label: "Como a equipe resolve um imprevisto", placeholder: "O que fazem quando algo trava?" },
    ],
  },
  {
    title: "Valores e propósito",
    subtitle: "O que a marca defende e o que quer despertar nos clientes.",
    icon: Compass,
    fields: [
      { key: "defended_belief", label: "Uma crença que a marca defende publicamente sobre o mercado", placeholder: "Algo em que a equipe acredita com convicção." },
      { key: "social_cause", label: "Causa ou tema que a marca apoia ou mobiliza", placeholder: "Pode ser educação, meio ambiente, saúde mental..." },
      { key: "desired_feeling", label: "O que a marca quer que o cliente sinta ao interagir com ela", placeholder: "Confiança, alívio, orgulho, clareza...?" },
      { key: "guiding_belief", label: "Uma frase ou princípio que guia as decisões da marca", placeholder: "Mantra interno, princípio de atendimento, valor inegociável." },
    ],
  },
  {
    title: "Marcos que moldaram a marca",
    subtitle: "A história da marca dá profundidade aos posts em formato storytelling.",
    icon: BookOpen,
    fields: [
      { key: "formative_story", label: "Um marco que definiu quem a marca é hoje", placeholder: "Pode ser a fundação, uma virada, um cliente que mudou tudo." },
      { key: "biggest_influence", label: "Uma marca, pessoa ou referência que influencia como constroem isso", placeholder: "Referência real — e por quê." },
      { key: "advice_to_20yo", label: "Um conselho que dariam para a marca no primeiro dia", placeholder: "Com base no que aprenderam até hoje." },
    ],
  },
];

// Chaves são as mesmas nas duas variantes — a mesma coluna do banco vale
// tanto para "hobby" (pessoal) quanto para o item institucional equivalente.
const allFieldKeys = personalBlocks.flatMap(b => b.fields.map(f => f.key));

const PersonalQuestionnaire = () => {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [blockIndex, setBlockIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [status, setStatus] = useState<QStatus>("draft");
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState<"form" | "interview">("form");
  // Monta o chat só após a hidratação (1º clique) e mantém montado depois,
  // para a conversa sobreviver à alternância entre os modos.
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [profile, setProfile] = useState<{ profession?: string; niche?: string }>({});
  const isInstitutional = activeWorkspace?.brand_type === "institucional";
  const [consentHighlight, setConsentHighlight] = useState(false);
  const insertingRef = useRef(false);
  const consentRef = useRef<HTMLDivElement | null>(null);

  const blocks = isInstitutional ? institutionalBlocks : personalBlocks;
  const currentBlock = blocks[blockIndex];
  const isLast = blockIndex === blocks.length - 1;
  const isFirst = blockIndex === 0;
  const interviewFields = useMemo(
    () => blocks.flatMap(b => b.fields.map(f => ({ key: f.key, label: f.label }))),
    [blocks],
  );
  const isSubmitted = status === "submitted";
  // Rascunho local por PERFIL — não vaza entre perfis da mesma conta.
  const storageKey = activeWorkspace ? `posiciona-pq-draft-${activeWorkspace.id}` : "posiciona-pq-draft";

  const persist = useCallback(async (overrides?: { complete?: boolean }): Promise<{ ok: boolean; error?: string }> => {
    if (!user || !activeWorkspace) return { ok: false, error: "no-user" };
    const complete = overrides?.complete ?? false;
    const newStatus: QStatus = complete ? "submitted" : (isSubmitted ? "submitted" : "draft");
    const fieldPayload: Record<string, string> = {};
    allFieldKeys.forEach(k => { fieldPayload[k] = (answers[k] || "").trim(); });
    const payload: any = {
      user_id: user.id,
      workspace_id: activeWorkspace.id,
      ...fieldPayload,
      is_complete: complete,
      status: newStatus,
    };
    try {
      if (existingId) {
        const { error } = await supabase.from("personal_questionnaires").update(payload).eq("id", existingId);
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      }
      if (insertingRef.current) return { ok: true };
      insertingRef.current = true;
      const { data, error } = await supabase.from("personal_questionnaires").insert(payload).select("id").single();
      insertingRef.current = false;
      if (error) return { ok: false, error: error.message };
      if (data) setExistingId(data.id);
      return { ok: true };
    } catch (e: any) {
      insertingRef.current = false;
      return { ok: false, error: e?.message || "save failed" };
    }
  }, [user, activeWorkspace, answers, existingId, isSubmitted]);

  const isEditable = !isSubmitted;
  const hydratedWorkspaceRef = useRef<string | null>(null);

  const { status: saveStatus, flush, clearLocalBackup } = useQuestionnaireAutosave({
    userId: user?.id,
    answers,
    enabled: isEditable && hydrated,
    storageKey,
    saveFn: () => persist(),
  });

  useEffect(() => {
    // Recarrega quando o perfil ativo troca (switcher). O guard por
    // workspace evita o re-hidratar espúrio ao trocar de aba (novo objeto
    // user, mesmo id) que sobrescreveria respostas não salvas.
    if (!user?.id || !activeWorkspace) return;
    if (hydratedWorkspaceRef.current === activeWorkspace.id) return;
    const workspaceId = activeWorkspace.id;
    setHydrated(false);
    setConsent(false);
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("personal_questionnaires")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("version", { ascending: false })
        .limit(1);
      if (cancelled) return;

      let dbAnswers: Record<string, string> = {};
      let dbStatus: QStatus = "draft";
      let dbId: string | null = null;
      if (data?.[0]) {
        dbId = data[0].id;
        dbStatus = (data[0].status as QStatus) || "draft";
        allFieldKeys.forEach(k => { dbAnswers[k] = (data[0] as any)[k] || ""; });
        if (data[0].status === "submitted") setConsent(true);
      } else {
        allFieldKeys.forEach(k => { dbAnswers[k] = ""; });
      }

      if (dbStatus === "draft") {
        try {
          const raw = localStorage.getItem(`posiciona-pq-draft-${workspaceId}`);
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
      setStatus(dbStatus);
      setAnswers(dbAnswers);
      setHydrated(true);
      hydratedWorkspaceRef.current = workspaceId;
    })();
    return () => { cancelled = true; };
  }, [user?.id, activeWorkspace]);

  // Profissão/nicho personalizam as perguntas do modo entrevista.
  // (isInstitutional agora vem do WorkspaceContext — perfil ativo.)
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("profession, niche").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setProfile({ profession: data.profession || undefined, niche: data.niche || undefined }); });
  }, [user?.id]);

  const filledCount = useMemo(
    () => allFieldKeys.filter(k => (answers[k] || "").trim().length > 0).length,
    [answers]
  );
  const totalFields = allFieldKeys.length;
  const progress = Math.round((filledCount / totalFields) * 100);
  const minRequiredPerBlock = 3;
  const filledInCurrentBlock = currentBlock.fields.filter(f => (answers[f.key] || "").trim().length > 0).length;
  const minTotalRequired = blocks.length * minRequiredPerBlock;
  const canFinish = consent && filledCount >= minTotalRequired;

  const submit = useCallback(async () => {
    if (!user) return;
    if (!consent) {
      // Leva o usuário até o checkbox (no celular ele está fora da tela) e o destaca.
      toast({ title: "Falta o aceite", description: "Marque a caixa \"Entendo e autorizo\" no aviso destacado para concluir.", variant: "destructive" });
      consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setConsentHighlight(true);
      window.setTimeout(() => setConsentHighlight(false), 3500);
      return;
    }
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
    setStatus("submitted");
    clearLocalBackup();
    toast({
      title: isInstitutional ? "A voz da marca foi salva" : "Sua história foi salva",
      description: "Sua estratégia completa está sendo liberada.",
    });
    // Oferta única da História de Venda (opcional) — se já existe registro
    // (respondida ou pulada antes), vai direto à recompensa em /results.
    const { data: salesRecord } = await supabase
      .from("sales_narrative_questionnaires")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    navigate(salesRecord ? "/results" : "/sales-narrative-intro");
  }, [user, consent, flush, persist, clearLocalBackup, navigate]);

  const handleNext = async () => {
    if (isEditable) await flush();
    setBlockIndex(i => Math.min(i + 1, blocks.length - 1));
  };

  const goToBlock = useCallback(async (target: number) => {
    if (isEditable) await flush();
    setBlockIndex(target);
  }, [isEditable, flush]);

  const Icon = currentBlock.icon;

  return (
    <DashboardLayout>
      <SeoHead
        title={isInstitutional ? "Voz da Marca · Posiciona" : "Questionário Pessoal · Posiciona"}
        description="Personalidade de marca e voz."
        path="/personal-questionnaire"
      />
      <div className="max-w-2xl lg:max-w-[1100px] mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">{isInstitutional ? "Voz da Marca" : "Sua História"}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {filledCount}/{totalFields} respondidas · ~12 min
            </p>
          </div>
          <QuestionnaireStatusBadge status={isSubmitted ? "completed" : "in_progress"} />
        </div>

        {/* Persuasion / context */}
        <div className="border-l-2 border-primary/40 bg-primary/5 px-4 py-3 rounded-r-md">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isInstitutional
              ? 'Suas respostas alimentam a IA com matéria-prima real da marca — cultura, bastidores, valores. Posts de storytelling institucional tecerão paralelos entre a operação da marca e as dores do cliente. Quanto mais específico, mais autêntico o conteúdo.'
              : 'Suas respostas alimentam a IA com matéria-prima humana — hobbies, valores, memórias. Posts de storytelling tecerão paralelos entre a sua vida e as dores do seu cliente, ao estilo "do tatame ao tribunal". Quanto mais específico, mais autêntico o conteúdo.'}
          </p>
        </div>

        {/* Privacy warning */}
        <div
          ref={consentRef}
          className={`flex items-start gap-3 p-4 rounded-lg bg-amber-500/5 border transition-all duration-300 ${
            consentHighlight ? "border-amber-500 ring-2 ring-amber-500/50 animate-pulse" : "border-amber-200/40"
          }`}
        >
          <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <p className="text-xs text-foreground/80 leading-relaxed">
              <strong>Aviso de uso público:</strong> trechos das respostas podem aparecer em posts publicados nas suas redes. Não responda nada que você não queira ver compartilhado. Você pode deixar campos sensíveis em branco — apenas as 3 perguntas mais relevantes de cada bloco são obrigatórias.
            </p>
            {!isSubmitted && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
                <span className="text-xs text-muted-foreground">Entendo e autorizo o uso dessas respostas na geração da minha linha editorial.</span>
              </label>
            )}
          </div>
        </div>

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

        {/* Progress */}
        <div className="space-y-2">
          <Progress value={progress} className="h-1.5" />
          <div className={`flex gap-1.5 ${mode === "interview" && isEditable ? "hidden" : ""}`}>
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
              kind="personal"
              intro={isInstitutional ? "Vamos construir a voz da marca em formato de conversa." : "Vamos construir sua história em formato de conversa."}
              fields={interviewFields}
              answers={answers}
              profession={profile.profession}
              niche={profile.niche}
              onExtract={extracted => setAnswers(prev => ({ ...prev, ...extracted }))}
              onFinish={() => {
                setMode("form");
                setBlockIndex(0);
                toast({
                  title: "Hora de revisar",
                  description: "Confira os 4 blocos, ajuste o que quiser e conclua.",
                });
              }}
            />
          </div>
        )}

        {/* Current block */}
        <Card className={`border-primary/10 ${mode === "interview" && isEditable ? "hidden" : ""}`}>
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

            <div className="space-y-4">
              {currentBlock.fields.map(field => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                    <span>{field.label}</span>
                    {field.help && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
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
                      questionContext={`${isInstitutional ? "Voz da Marca" : "Sua História"} · Bloco ${blockIndex + 1} (${currentBlock.title}) — "${field.label}"`}
                    />
                  </label>
                  <Textarea
                    value={answers[field.key] || ""}
                    onChange={e => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    rows={2}
                    disabled={isSubmitted}
                    className="bg-background resize-none text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="text-[11px] text-muted-foreground italic">
              {filledInCurrentBlock}/{currentBlock.fields.length} respondidas neste bloco · mínimo recomendado: {minRequiredPerBlock}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              {isFirst ? <span /> : (
                <Button variant="ghost" size="sm" onClick={() => goToBlock(blockIndex - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
              )}

              <div className="flex items-center gap-2">
                {!isSubmitted && (
                  <Button variant="ghost" size="sm" onClick={() => flush()} disabled={saveStatus === "saving"} className="text-muted-foreground">
                    <Save className="h-3.5 w-3.5 mr-1" /> {saveStatus === "saving" ? "..." : "Salvar"}
                  </Button>
                )}
                {!isLast ? (
                  <Button size="sm" onClick={handleNext}>
                    Próximo bloco <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : !isSubmitted ? (
                  <Button size="sm" onClick={submit} disabled={filledCount < minTotalRequired || submitting || saveStatus === "saving"}>
                    {submitting ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Enviando…</> : <><Sparkles className="h-3.5 w-3.5 mr-1" /> Concluir e liberar estratégia</>}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => navigate("/results")}>
                    Ver Resultados <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>

            {!isSubmitted && isLast && !canFinish && (
              <p className="text-[11px] text-amber-600 text-center">
                {filledCount < minTotalRequired
                  ? `Responda ao menos ${minRequiredPerBlock} perguntas em cada bloco para concluir.`
                  : "Falta só marcar o aceite de uso público (aviso no topo da página)."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PersonalQuestionnaire;
