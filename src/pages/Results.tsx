import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { calculateScores, getTop3, ARCHETYPE_COLORS, type ArchetypeScore } from "@/lib/archetypes";
import { Loader2, CheckCircle2, Sparkles, ArrowRight, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { normalizeReportContent } from "@/lib/reportParser";

type Stage = "calculating" | "saving" | "generating_report" | "done" | "error";

const STAGE_LABELS: Record<Stage, string> = {
  calculating: "Calculando arquétipos...",
  saving: "Salvando resultados...",
  generating_report: "Gerando sua estratégia completa (narrativa de marca, figurino, símbolos)...",
  done: "Tudo pronto!",
  error: "Ocorreu um erro.",
};

// Polling: 3s entre checks, timeout total de 5min
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

const RANK_LABELS: Record<string, { subtitle: string; size: string }> = {
  "Primário": { subtitle: "Arquétipo dominante — define o tom central da sua marca", size: "md:col-span-1" },
  "Secundário": { subtitle: "Complemento estratégico — enriquece sua comunicação", size: "md:col-span-1" },
  "Terciário": { subtitle: "Apoio sutil — adiciona profundidade e nuance", size: "md:col-span-1" },
};

const Results = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scores, setScores] = useState<ArchetypeScore[]>([]);
  const [stage, setStage] = useState<Stage>("calculating");
  const [errorMsg, setErrorMsg] = useState("");
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [archetypeDetails, setArchetypeDetails] = useState<Record<string, any>>({});
  const [progressMessage, setProgressMessage] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const onSignout = () => { cancelled = true; };
    window.addEventListener("app:signout", onSignout);

    const pollJob = async (jobId: string): Promise<any> => {
      const startedAt = Date.now();
      while (!cancelled) {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          throw new Error("Tempo limite excedido aguardando a estratégia. Tente novamente.");
        }
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        if (cancelled) return null;

        const { data: jobStatus, error: pollError } = await supabase.functions.invoke("get-report-generation-job", {
          body: { jobId },
        });
        if (cancelled) return null;
        if (pollError) {
          console.warn("Polling error (segue tentando):", pollError);
          continue;
        }
        if (jobStatus?.progress_message) setProgressMessage(jobStatus.progress_message);
        if (jobStatus?.status === "completed") return jobStatus.result?.report;
        if (jobStatus?.status === "failed") {
          throw new Error(jobStatus.error_message || "Não foi possível gerar a estratégia.");
        }
      }
      return null;
    };

    const run = async () => {
      try {
        const { data: latestReport } = await supabase
          .from("reports").select("id, status, version, content, error_message")
          .eq("user_id", user.id)
          .order("version", { ascending: false }).limit(1).maybeSingle();

        const [{ data: questions }, { data: answersData }] = await Promise.all([
          supabase.from("archetype_questions").select("id, question_number"),
          supabase.from("archetype_answers").select("question_id, score").eq("user_id", user.id),
        ]);
        if (cancelled) return;
        if (!questions || !answersData) throw new Error("Erro ao carregar dados dos questionários");

        const answerMap: Record<string, number> = {};
        answersData.forEach(a => { answerMap[a.question_id] = a.score; });
        const calc = calculateScores(questions, answerMap);
        setScores(calc);

        if (latestReport?.content) {
          const normalized = normalizeReportContent(latestReport.content) as any;
          if (normalized?.archetypes) setArchetypeDetails(normalized.archetypes);
        }

        if (latestReport?.status === "completed" && latestReport?.content) {
          setStage("done");
          return;
        }

        if (latestReport?.status === "error") {
          setErrorMsg(latestReport.error_message || "A geração anterior falhou. Tente novamente.");
          setStage("error");
          return;
        }

        // Se já existe um job ativo para o relatório atual, RETOMAR o polling
        // em vez de reiniciar o cálculo + reenfileirar.
        if (latestReport?.id) {
          const { data: activeJobs } = await supabase
            .from("report_generation_jobs")
            .select("id, status, progress_message")
            .eq("user_id", user.id)
            .eq("report_id", latestReport.id)
            .in("status", ["queued", "processing"])
            .order("created_at", { ascending: false })
            .limit(1);
          if (cancelled) return;

          if (activeJobs && activeJobs.length > 0) {
            const existing = activeJobs[0];
            if (existing.progress_message) setProgressMessage(existing.progress_message);
            setStage("generating_report");
            const finalReport = await pollJob(existing.id);
            if (cancelled || finalReport == null) return;
            const normalizedReportContent = normalizeReportContent(finalReport) as any;
            if (normalizedReportContent?.archetypes) setArchetypeDetails(normalizedReportContent.archetypes);
            setStage("done");
            setProgressMessage("");
            toast({ title: "Estratégia gerada com sucesso!" });
            return;
          }
        }

        setStage("saving");
        const upserts = calc.map(s => ({
          user_id: user.id, version: 1, archetype_name: s.name, total_score: s.score,
        }));
        await supabase.from("archetype_scores").upsert(upserts, { onConflict: "user_id,version,archetype_name" });

        const top3 = getTop3(calc);
        const topUpserts = top3.map(t => ({
          user_id: user.id, version: 1, archetype_name: t.name, rank: t.rank, score: t.score,
        }));
        await supabase.from("user_top_archetypes").upsert(topUpserts, { onConflict: "user_id,version,rank" });

        const { data: bqData } = await supabase
          .from("business_questionnaires").select("*").eq("user_id", user.id)
          .eq("is_complete", true).order("version", { ascending: false }).limit(1).maybeSingle();

        if (!bqData) { setStage("done"); return; }
        if (cancelled) return;

        setStage("generating_report");
        const { data: profile } = await supabase.from("profiles").select("niche, gender").eq("user_id", user.id).maybeSingle();

        const archetypes = {
          primary: { archetype_name: top3[0]?.name, score: top3[0]?.score },
          secondary: { archetype_name: top3[1]?.name, score: top3[1]?.score },
          tertiary: { archetype_name: top3[2]?.name, score: top3[2]?.score },
        };

        let reportVersion: number;
        let reportRowId: string | null = null;
        if (latestReport && latestReport.status === "generating") {
          // Reutiliza versão apenas quando a geração ainda está em andamento (retry de job travado).
          reportVersion = latestReport.version;
          const { data: existing } = await supabase.from("reports")
            .update({ status: "generating", content: null, error_message: null })
            .eq("user_id", user.id).eq("version", reportVersion)
            .select("id").single();
          reportRowId = existing?.id || null;
        } else {
          // Sempre cria nova versão (inclusive após reanálise/refazer questionário),
          // preservando o relatório anterior no histórico.
          reportVersion = (latestReport?.version || 0) + 1;
          const { data: inserted } = await supabase.from("reports").insert({
            user_id: user.id, version: reportVersion, status: "generating", error_message: null,
          }).select("id").single();
          reportRowId = inserted?.id || null;
        }
        if (cancelled) return;

        // 1. Enfileira o job (resposta em <1s)
        const { data: queueData, error: queueError } = await supabase.functions.invoke("generate-report", {
          body: {
            business: bqData,
            niche: profile?.niche || "",
            archetypes,
            gender: profile?.gender || "Não informado",
            reportId: reportRowId,
            reportVersion,
          },
        });
        if (cancelled) return;
        if (queueError) throw queueError;
        const jobId = queueData?.jobId;
        if (!jobId) throw new Error("Falha ao enfileirar geração da estratégia.");

        // 2. Polling até completar/falhar/timeout
        const finalReport = await pollJob(jobId);
        if (cancelled || finalReport == null) return;

        const normalizedReportContent = normalizeReportContent(finalReport) as any;
        if (normalizedReportContent?.archetypes) setArchetypeDetails(normalizedReportContent.archetypes);

        setStage("done");
        setProgressMessage("");
        toast({ title: "Estratégia gerada com sucesso!" });
      } catch (err: any) {
        if (cancelled) return;
        console.error("Results error:", err);
        const rawMsg = (err?.message || "") + " " + (err?.context?.body ? JSON.stringify(err.context.body) : "");
        const lower = rawMsg.toLowerCase();
        const rateLimited = /rate limit|overloaded|429|529|alta demanda|temporariamente indispon/.test(lower);
        const message = rateLimited
          ? "A IA está com alta demanda agora. Aguarde alguns segundos e tente novamente."
          : (err.message || "Erro desconhecido");
        setIsRateLimited(rateLimited);
        setErrorMsg(message);
        setStage("error");
        setProgressMessage("");
        toast({
          title: rateLimited ? "Alta demanda na IA" : "Erro",
          description: rateLimited ? "Tente novamente em alguns segundos." : err.message,
          variant: "destructive",
        });
      }
    };
    run();
    return () => {
      cancelled = true;
      window.removeEventListener("app:signout", onSignout);
    };
  }, [user]);

  const top3 = getTop3(scores);
  const maxScore = 30;
  const isProcessing = stage !== "done" && stage !== "error";

  const getArchetypeLlmData = (archName: string) => {
    const rankKeys = ["primary", "secondary", "tertiary"];
    for (const key of rankKeys) {
      const llm = archetypeDetails[key];
      if (llm?.name?.toLowerCase() === archName.toLowerCase()) return llm;
    }
    return null;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">Seus Arquétipos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Mapa completo da personalidade da sua marca</p>
        </div>

        {/* Status */}
        <Card className={`${stage === "error" ? "border-destructive/30" : "border-primary/15"}`}>
          <CardContent className="py-4 flex items-center gap-3">
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
            ) : stage === "done" ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            ) : (
              <Sparkles className="h-5 w-5 text-destructive shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {stage === "generating_report" && progressMessage ? progressMessage : STAGE_LABELS[stage]}
              </p>
              {stage === "generating_report" && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Continuamos gerando em segundo plano. Você pode sair desta tela e voltar quando quiser.
                </p>
              )}
              {stage === "error" && errorMsg && (
                <p className="text-xs text-muted-foreground mt-0.5">{errorMsg}</p>
              )}
            </div>
            {stage === "done" && (
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" onClick={() => navigate("/report")} className="gap-1.5">
                  Relatório <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/storybrand")}>
                  Narrativa
                </Button>
              </div>
            )}
            {stage === "generating_report" && (
              <Button size="sm" variant="outline" onClick={() => navigate("/dashboard")} className="flex-shrink-0">
                Ir para o Dashboard
              </Button>
            )}
            {stage === "error" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0 max-w-xs">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <span>Geração pausada para evitar nova cobrança automática.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top 3 */}
        {top3.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            {top3.map((t, idx) => {
              const llm = getArchetypeLlmData(t.name);
              const color = ARCHETYPE_COLORS[t.name];
              return (
                <Card key={t.name} className="relative overflow-hidden" style={{ borderColor: color + "30" }}>
                  <div className="absolute top-0 left-0 w-1 h-full" style={{ background: color }} />
                  <CardContent className="pt-4 pb-4 pl-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{t.classification}</Badge>
                      <span className="text-xl font-bold" style={{ color }}>{t.score}<span className="text-xs text-muted-foreground font-normal">/{maxScore}</span></span>
                    </div>
                    <h3 className="text-lg font-display font-semibold">{t.name}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {RANK_LABELS[t.classification]?.subtitle || ""}
                    </p>
                    {llm?.characteristics?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {llm.characteristics.slice(0, 4).map((c: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{c}</Badge>
                        ))}
                      </div>
                    )}
                    {llm?.brands?.length > 0 && (
                      <div className="pt-1">
                        <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Marcas de referência</p>
                        <p className="text-xs text-foreground/80">{llm.brands.join(" · ")}</p>
                      </div>
                    )}
                    {llm?.people?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Personalidades</p>
                        <p className="text-xs text-foreground/80">{llm.people.join(" · ")}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Full ranking */}
        {scores.length > 0 && (
          <Card className="border-border/60">
            <CardContent className="py-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ranking completo</p>
              {scores.map((s, i) => {
                const isTop = i < 3;
                return (
                  <div key={s.name} className={`flex items-center gap-3 py-1 ${isTop ? "" : "opacity-70"}`}>
                    <span className={`text-xs w-24 font-medium truncate ${isTop ? "text-foreground" : "text-muted-foreground"}`}>{s.name}</span>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(s.score / maxScore) * 100}%`, background: ARCHETYPE_COLORS[s.name] }}
                      />
                    </div>
                    <span className={`text-xs font-semibold w-6 text-right ${isTop ? "" : "text-muted-foreground"}`}>{s.score}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Results;
