import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Sparkles, ChevronDown, Calendar, Video, Image, Smartphone,
  ImageIcon, PenTool, FileText, RefreshCw, Copy, Download, AlertTriangle, Wand2,
  Trash2, X, CheckSquare
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { parseReportContent, normalizeReportContent } from "@/lib/reportParser";
import { cleanText } from "@/lib/textCleanup";
import { isOutdated, isWeekOutdated, EDITORIAL_GENERATOR_VERSION } from "@/lib/generatorVersion";
import { normalizeWeekToV6, type WeekV6, type DayV6, type FeedPostV6 } from "@/lib/editorialShape";
import StyleSelectionModal from "@/components/post-editor/StyleSelectionModal";
import { MarketTrendsSection } from "@/components/editorial/MarketTrendsSection";
import type { PostStyle } from "@/lib/postAutoLayout";

// Escape HTML to prevent injection in raw innerHTML strings used for PDF
function esc(s: string): string {
  return (s || "").replace(/[&<>"']/g, (c) => (
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  ));
}

const FORMAT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; border: string }> = {
  reels: { label: "Reels", icon: <Video className="h-3 w-3" />, color: "bg-pink-500/10 text-pink-600 border-pink-200", border: "border-l-pink-500" },
  carrossel: { label: "Carrossel", icon: <Image className="h-3 w-3" />, color: "bg-blue-500/10 text-blue-600 border-blue-200", border: "border-l-blue-500" },
  stories: { label: "Stories", icon: <Smartphone className="h-3 w-3" />, color: "bg-amber-500/10 text-amber-600 border-amber-200", border: "border-l-amber-500" },
  post: { label: "Post", icon: <ImageIcon className="h-3 w-3" />, color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", border: "border-l-emerald-500" },
};

// Garante que a sessão local está válida antes de chamar edge functions.
// Se o refresh token foi revogado (ex.: login em outra aba), força logout
// para evitar um 401 silencioso vindo da função.
const ensureFreshSession = async (): Promise<boolean> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session) {
    await supabase.auth.signOut().catch(() => {});
    toast({
      title: "Sessão expirada",
      description: "Faça login novamente para continuar.",
      variant: "destructive",
    });
    return false;
  }

  // Força um refresh do token para garantir que o servidor receberá um JWT
  // válido — evita 401 silencioso quando a sessão local está perto de expirar.
  try {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn("refreshSession falhou, seguindo com a sessão atual:", refreshError);
    }
  } catch (err) {
    console.warn("Erro ao tentar atualizar a sessão:", err);
  }

  return true;
};

const getFunctionErrorMessage = async (error: any, data?: any, fallback = "Ocorreu um erro ao processar sua solicitação.") => {
  if (typeof data?.error === "string" && data.error.trim()) return data.error;

  const context = error?.context;
  if (context) {
    try {
      const responseLike = typeof context.clone === "function" ? context.clone() : context;
      if (typeof responseLike.json === "function") {
        const parsed = await responseLike.json();
        if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error;
      }
    } catch {
      try {
        const responseLike = typeof context.clone === "function" ? context.clone() : context;
        if (typeof responseLike.text === "function") {
          const rawText = await responseLike.text();
          if (rawText?.trim()) {
            try {
              const parsed = JSON.parse(rawText);
              if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error;
            } catch {
              return rawText;
            }
          }
        }
      } catch {
      }
    }
  }

  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return fallback;
};

const EditorialPage = () => {
  const navigate = useNavigate();
  const { user, balances, refreshSubscription, isReadOnly } = useAuth();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingWeek, setGeneratingWeek] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState<string>("");
  const [regeneratingPost, setRegeneratingPost] = useState<string | null>(null);
  const [regeneratingFreeWeek, setRegeneratingFreeWeek] = useState<number | null>(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [deletingWeek, setDeletingWeek] = useState<number | null>(null);
  const [confirmDeleteWeek, setConfirmDeleteWeek] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedWeeks, setSelectedWeeks] = useState<Set<number>>(new Set());
  const contentRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<{ stop: boolean }>({ stop: false });

  // Modal de seleção de estilo antes de abrir o editor
  const [styleModal, setStyleModal] = useState<{
    open: boolean;
    weekIndex: number;
    dayIndex: number;
    isReels: boolean;
    theme: string;
    caption: string;
    format: "square" | "portrait";
  } | null>(null);

  // Paleta de cores derivada do relatório (para preview do estilo minimal)
  const paletteHex: string[] = (() => {
    try {
      const c = parseReportContent(report?.content)?.contentObject as any;
      const palette = c?.visual_identity?.color_palette || c?.palette || [];
      return Array.isArray(palette) ? palette.map((p: any) => (typeof p === "string" ? p : p?.hex)).filter(Boolean) : [];
    } catch { return []; }
  })();

  const handleOpenEditor = (wi: number, di: number, day: any, isReels: boolean) => {
    setStyleModal({
      open: true,
      weekIndex: wi,
      dayIndex: di,
      isReels,
      theme: (day?.theme || day?.caption || "").toString(),
      caption: (day?.caption || "").toString(),
      format: isReels ? "portrait" : "square",
    });
  };

  const handleStyleChosen = (style: PostStyle | null, aiVisualStyle?: string) => {
    if (!styleModal) return;
    const params = new URLSearchParams();
    params.set("week", String(styleModal.weekIndex));
    params.set("day", String(styleModal.dayIndex));
    if (styleModal.isReels) params.set("format", "reels");
    if (style) params.set("style", style);
    if (style === "ai" && aiVisualStyle) params.set("aiVisualStyle", aiVisualStyle);
    navigate(`/post-editor?${params.toString()}`);
    setStyleModal(null);
  };

  const weeklyCycles = balances?.weekly_cycles ?? 0;
  const regenerationCredits = balances?.regeneration_credits ?? 0;
  const [generatingStoriesFor, setGeneratingStoriesFor] = useState<number | null>(null);

  const handleGenerateStoriesOnly = async (weekIndex: number | undefined) => {
    if (!user || !report?.id || typeof weekIndex !== "number") return;
    setGeneratingStoriesFor(weekIndex);
    try {
      if (!(await ensureFreshSession())) return;
      const { data, error } = await supabase.functions.invoke("process-stories-generation-job", {
        body: { week_index: weekIndex, report_id: report.id },
      });
      if (error || data?.error) {
        let msg: string | undefined = data?.error;
        if (!msg && (error as any)?.context?.text) {
          try {
            const body = await (error as any).context.text();
            const parsed = JSON.parse(body);
            msg = parsed?.error;
          } catch { /* noop */ }
        }
        msg = msg || error?.message || "Não foi possível gerar os stories agora.";
        toast({ title: "Falha ao gerar stories", description: msg, variant: "destructive" });
        return;
      }
      const { data: freshReport } = await supabase
        .from("reports").select("*").eq("user_id", user.id)
        .order("version", { ascending: false }).limit(1).single();
      if (freshReport) setReport(freshReport);
      toast({ title: "Stories gerados com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setGeneratingStoriesFor(null);
    }
  };

  const [userNiche, setUserNiche] = useState<string>("");
  const [businessContext, setBusinessContext] = useState<string>("");
  const [personalSubmitted, setPersonalSubmitted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("reports").select("*").eq("user_id", user.id)
      .order("version", { ascending: false }).limit(1).single()
      .then(({ data }) => { setReport(data); setLoading(false); });
    supabase.from("profiles").select("niche").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.niche) setUserNiche(data.niche); });
    supabase.from("business_questionnaires").select("services,target_audience,company_name")
      .eq("user_id", user.id).order("version", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const ctx = [data.company_name, data.services, data.target_audience].filter(Boolean).join(" ");
          setBusinessContext(ctx);
        }
      });
    supabase.from("personal_questionnaires").select("status")
      .eq("user_id", user.id).order("version", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { setPersonalSubmitted(data?.status === "submitted"); });
  }, [user]);

  const { contentObject, hasEditorial } = parseReportContent(report?.content);
  const content = contentObject ?? {};
  const structuredEditorial = Array.isArray(content.editorial) ? content.editorial : [];
  const editorialWeeks: any[] = Array.isArray(report?.editorial_weeks) ? report.editorial_weeks : [];
  // Só prefixa structuredEditorial (semana 1 vinda de content.editorial) se editorial_weeks
  // estiver vazio. Caso contrário, editorial_weeks já contém todas as semanas (incluindo a 1)
  // e prefixar criaria uma "Semana 1" fantasma sem _week_index, dessincronizando UI vs PDF.
  const allWeeksRaw: any[] = editorialWeeks.length > 0
    ? editorialWeeks
    : (hasEditorial && structuredEditorial.length > 0 ? [structuredEditorial] : []);
  // Sempre normaliza para shape v6 antes de renderizar (tolerante a v5 antigo)
  const allWeeks: WeekV6[] = allWeeksRaw.map((w) => normalizeWeekToV6(w));

  // Detecta semanas migradas de versão anterior do relatório.
  const currentReportVersion = (report as any)?.version;
  const olderWeeksCount = editorialWeeks.reduce((acc, w) => {
    const v = w && typeof w === "object" ? (w._meta?.generated_with_report_version) : undefined;
    if (typeof v === "number" && typeof currentReportVersion === "number" && v !== currentReportVersion) {
      return acc + 1;
    }
    return acc;
  }, 0);
  const hasOlderWeeks = olderWeeksCount > 0;

  // Cleanup do polling ao desmontar (evita updates em componente desmontado)
  useEffect(() => {
    return () => {
      pollingRef.current.stop = true;
    };
  }, []);

  // Aba ativa do Tabs de semanas (controlado para abrir sempre na mais recente)
  const [activeWeek, setActiveWeek] = useState<string>("week-0");
  const tabInitializedRef = useRef(false);
  const lastWeekCountRef = useRef(0);
  useEffect(() => {
    const count = allWeeks.length;
    if (count === 0) return;
    // 1ª vez que conhecemos as semanas → abrir na última gerada.
    // Quando uma nova semana é adicionada (count cresce) → saltar para ela.
    if (!tabInitializedRef.current || count > lastWeekCountRef.current) {
      setActiveWeek(`week-${count - 1}`);
      tabInitializedRef.current = true;
    }
    lastWeekCountRef.current = count;
  }, [allWeeks.length]);

  const handleGenerateWeek = async () => {
    if (!user || weeklyCycles < 1) {
      toast({ title: "Créditos insuficientes", description: "Você não tem ciclos semanais disponíveis.", variant: "destructive" });
      return;
    }
    if (personalSubmitted === false) {
      toast({
        title: "Conte sua história primeiro",
        description: "A Linha Editorial precisa do seu Questionário Pessoal para humanizar os posts.",
      });
      navigate("/personal-questionnaire");
      return;
    }
    setGeneratingWeek(true);
    setGeneratingMessage("Iniciando geração…");
    pollingRef.current.stop = false;
    try {
      if (!(await ensureFreshSession())) { setGeneratingWeek(false); setGeneratingMessage(""); return; }
      const [{ data: bq }, { data: profile }, { data: reportData }] = await Promise.all([
        supabase.from("business_questionnaires").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single(),
        supabase.from("profiles").select("niche").eq("user_id", user.id).single(),
        supabase.from("reports").select("content").eq("user_id", user.id).eq("status", "completed").order("version", { ascending: false }).limit(1).single(),
      ]);

      const reportContent = normalizeReportContent(reportData?.content) as Record<string, any> | null;

      // 1) Enfileira o job (responde em <2s)
      const { data: enqueueData, error: enqueueError } = await supabase.functions.invoke("generate-content-week", {
         body: {
          business: bq, niche: profile?.niche || "",
          previousWeeks: allWeeks.map((week) => week.days.map((d) => ({ day: d.day, theme: d.feed?.theme || d.story?.theme || "", format: d.feed?.format || "stories" }))),
          weekNumber: allWeeks.length + 1,
          storybrand: reportContent?.storybrand || null,
          tone_of_voice: reportContent?.tone_of_voice || null,
        },
      });
      if (enqueueError) throw new Error(await getFunctionErrorMessage(enqueueError, enqueueData, "Erro ao iniciar a geração."));
      if (enqueueData?.error) throw new Error(enqueueData.error);
      const jobId: string | undefined = enqueueData?.jobId;
      if (!jobId) throw new Error("Não foi possível iniciar a geração. Tente novamente.");

      // 2) Polling do status (a cada 3s, timeout 7 minutos)
      setGeneratingMessage("Gerando seus 7 posts… pode levar até 2 minutos.");
      const startedAt = Date.now();
      const TIMEOUT_MS = 7 * 60 * 1000;
      const POLL_INTERVAL = 3000;
      let finalResult: any = null;

      while (!pollingRef.current.stop) {
        if (Date.now() - startedAt > TIMEOUT_MS) {
          throw new Error("A geração ainda está em andamento. Recarregue a página em alguns instantes para ver o resultado.");
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        if (pollingRef.current.stop) return;

        // O `supabase.functions.invoke` não passa query params nativamente — fazemos fetch direto.
        const session = (await supabase.auth.getSession()).data.session;
        if (!session) throw new Error("Sessão expirada. Faça login novamente.");
        const projectId = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
        const url = `https://${projectId}.supabase.co/functions/v1/get-content-generation-job?jobId=${encodeURIComponent(jobId)}`;
        const resp = await fetch(url, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
        if (!resp.ok) {
          // erro transitório no polling — continua tentando
          continue;
        }
        const job = await resp.json();
        if (job?.progress_message) setGeneratingMessage(job.progress_message);

        if (job?.status === "completed") {
          finalResult = job.result;
          break;
        }
        if (job?.status === "failed") {
          // Save parcial: feed (Estágio A) foi persistido mas stories (Estágio B) falharam.
          // Mostra aviso amarelo em vez de erro vermelho — usuário ainda tem a semana.
          if (job?.result?.partial === true) {
            finalResult = job.result;
            break;
          }
          throw new Error(job.error_message || "Não foi possível gerar a semana. Tente novamente.");
        }
      }

      if (pollingRef.current.stop) {
        setGeneratingWeek(false);
        setGeneratingMessage("");
        return;
      }

      const isPartial = finalResult?.partial === true
        || finalResult?.stage === "completed_partial";
      if (!finalResult?.editorial && !isPartial) {
        throw new Error("Nenhum conteúdo foi gerado. Tente novamente.");
      }

      // O worker já persistiu em reports.editorial_weeks. Recarrega o report.
      const { data: freshReport } = await supabase
        .from("reports")
        .select("*")
        .eq("user_id", user.id)
        .order("version", { ascending: false })
        .limit(1)
        .single();
      if (freshReport) setReport(freshReport);

      await refreshSubscription();
      if (isPartial) {
        toast({
          title: "Semana parcialmente gerada",
          description: finalResult?.stage_b_error
            ? "Os posts de feed foram salvos, mas os stories falharam. Você pode regenerar os stories depois."
            : "A semana foi salva parcialmente. Verifique o conteúdo e regenere se necessário.",
        });
      } else {
        toast({ title: "Nova semana gerada com sucesso!" });
      }
    } catch (err: any) {
      await refreshSubscription();
      const raw = String(err?.message || "");
      if (/question[áa]rio pessoal|personal_questionnaire|conte sua hist[óo]ria/i.test(raw)) {
        toast({
          title: "Conte sua história primeiro",
          description: "Preencha o Questionário Pessoal antes de gerar a Linha Editorial.",
        });
        navigate("/personal-questionnaire");
      } else {
        const isTimeout = /timeout|timed out|504|connection closed|failed to fetch|networkerror|aborted/i.test(raw);
        const isTruncated = /incomplete ai response|max[_ ]tokens|incompleta na etapa|respondeu de forma incompleta|est[áa]gio a inv[áa]lido/i.test(raw);
        const isRateLimit = /muita demanda|muitas solicita|rate.?limit|429/i.test(raw);
        if (isRateLimit) {
          toast({
            title: "Serviço de IA com muita demanda",
            description: "Aguarde cerca de 1 minuto e toque novamente em gerar. Seu crédito não foi consumido.",
            variant: "destructive",
          });
        } else {
          const description = isTruncated
            ? "A geração ficou densa demais e foi interrompida. Toque novamente em Gerar +7 dias — costuma funcionar na segunda tentativa. Seu crédito foi devolvido."
            : isTimeout
            ? "A geração demorou mais que o esperado. Tente novamente — geralmente funciona na segunda tentativa."
            : (raw || "Não foi possível gerar a semana. Tente novamente.");
          toast({ title: "Erro ao gerar conteúdo", description, variant: "destructive" });
        }
      }
    }
    setGeneratingWeek(false);
    setGeneratingMessage("");
  };

  // Regenera o feed (e o story do mesmo dia em cascata) ou regenera só um story livre.
  // target = "feed" → cobra 1 crédito e atualiza feed + story (se houver).
  // target = "story" → permitido apenas quando day.feed == null. Cobra 1 crédito.
  const handleRegenerateItem = async (
    weekIndex: number,
    dayIndex: number,
    target: "feed" | "story",
    freeMode = false,
    themeOverride?: string,
  ) => {
    if (!user) return;
    if (!freeMode && regenerationCredits < 1) {
      toast({ title: "Créditos insuficientes", description: "Você não tem créditos de ajuste de conteúdo.", variant: "destructive" });
      return;
    }
    const key = `${weekIndex}-${dayIndex}-${target}`;
    setRegeneratingPost(key);
    try {
      if (!(await ensureFreshSession())) { setRegeneratingPost(null); return; }
      const week = allWeeks[weekIndex];
      const day = week.days[dayIndex];

      if (target === "feed" && !day.feed) {
        throw new Error("Este dia não tem post de feed para regenerar.");
      }
      if (target === "story" && day.feed) {
        throw new Error("Stories que espelham o feed são atualizados junto com o feed.");
      }

      const [{ data: bq }, { data: profile }, { data: reportData }] = await Promise.all([
        supabase.from("business_questionnaires").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single(),
        supabase.from("profiles").select("niche").eq("user_id", user.id).single(),
        supabase.from("reports").select("content").eq("user_id", user.id).eq("status", "completed").order("version", { ascending: false }).limit(1).single(),
      ]);
      const reportContent = normalizeReportContent(reportData?.content) as Record<string, any> | null;

      // Apenas temas (sem caption/script/card_copy) para evitar eco da IA.
      const existingPosts = allWeeks.flatMap((w) =>
        w.days.flatMap((d) => [
          d.feed?.theme ? { theme: d.feed.theme } : null,
          d.story?.theme ? { theme: d.story.theme } : null,
        ].filter(Boolean) as { theme: string }[]),
      );

      const currentWeek = allWeeks[weekIndex] as any;
      const weekTrends = Array.isArray(currentWeek?.market_trends) ? currentWeek.market_trends : [];

      const baseBody = {
        business: bq,
        niche: profile?.niche || "",
        existingPosts,
        storybrand: reportContent?.storybrand || null,
        tone_of_voice: reportContent?.tone_of_voice || null,
        freeRegeneration: freeMode,
        marketTrends: weekTrends,
        ...(themeOverride ? { themeOverride } : {}),
      };

      let newFeed = day.feed;
      let newStory = day.story;

      if (target === "feed") {
        // 1) Regenera o feed
        const { data, error } = await supabase.functions.invoke("regenerate-single-post", {
          body: {
            ...baseBody,
            target: "feed",
            format: day.feed!.format,
            theme: day.feed!.theme,
            dayNumber: day.day || dayIndex + 1,
            currentVersion: day.feed!.generator_version || day.generator_version || null,
          },
        });
        if (error) throw new Error(await getFunctionErrorMessage(error, data, "Erro ao atualizar post."));
        if (data?.error) throw new Error(data.error);
        if (!data?.post) throw new Error("Resposta vazia da IA.");
        newFeed = data.post;

        // 2) Regenera o story do mesmo dia espelhando o novo feed (sem cobrar crédito extra).
        try {
          const { data: storyData, error: storyError } = await supabase.functions.invoke("regenerate-single-post", {
            body: {
              ...baseBody,
              target: "story",
              dayNumber: day.day || dayIndex + 1,
              siblingFeed: {
                theme: newFeed!.theme,
                format: newFeed!.format,
                caption: newFeed!.caption,
              },
              freeRegeneration: true, // pareado: não cobra
            },
          });
          if (storyError) throw new Error(await getFunctionErrorMessage(storyError, storyData, "Erro ao atualizar o story do dia."));
          if (storyData?.error) throw new Error(storyData.error);
          if (storyData?.story) newStory = storyData.story;
        } catch (storyErr: any) {
          // Mantém o story antigo se a 2ª chamada falhar — feed já foi atualizado.
          console.error("Falha ao regenerar story pareado:", storyErr);
          toast({
            title: "Feed atualizado, mas o story manteve o conteúdo anterior",
            description: "Você pode tentar regenerar novamente em instantes.",
          });
        }
      } else {
        // target === "story" — story livre (dia sem feed)
        const { data, error } = await supabase.functions.invoke("regenerate-single-post", {
          body: {
            ...baseBody,
            target: "story",
            dayNumber: day.day || dayIndex + 1,
            // siblingFeed omitido → função entende como story livre/pessoal
          },
        });
        if (error) throw new Error(await getFunctionErrorMessage(error, data, "Erro ao atualizar story."));
        if (data?.error) throw new Error(data.error);
        if (!data?.story) throw new Error("Resposta vazia da IA.");
        newStory = data.story;
      }

      // Monta o dia atualizado no shape v6 e grava a semana inteira.
      const updatedDay: DayV6 = {
        day: day.day || dayIndex + 1,
        feed: newFeed,
        story: newStory,
        generator_version: EDITORIAL_GENERATOR_VERSION,
      };
      const updatedWeek: WeekV6 = {
        days: week.days.map((d, i) => (i === dayIndex ? updatedDay : d)),
      };

      const isFirstWeek = structuredEditorial.length > 0 && weekIndex === 0;
      if (isFirstWeek) {
        const newContent = { ...content, editorial: updatedWeek };
        await supabase.from("reports").update({ content: newContent as any }).eq("user_id", user.id).eq("version", report.version);
        setReport({ ...report, content: newContent });
      } else {
        const adjustedWeekIndex = structuredEditorial.length > 0 ? weekIndex - 1 : weekIndex;
        const newWeeks = [...editorialWeeks];
        newWeeks[adjustedWeekIndex] = updatedWeek;
        await supabase.from("reports").update({ editorial_weeks: newWeeks as any }).eq("user_id", user.id).eq("version", report.version);
        setReport({ ...report, editorial_weeks: newWeeks });
      }

      if (!freeMode) {
        const themeForLog = target === "feed" ? (newFeed?.theme || day.feed?.theme || "") : (newStory?.theme || day.story?.theme || "");
        await supabase.rpc("consume_credit", {
          p_credit_type: "regeneration",
          p_amount: -1,
          p_description: `Ajuste de conteúdo (${target}): ${themeForLog}`,
        });
        await refreshSubscription();
      }
      toast({
        title: freeMode
          ? "Conteúdo atualizado sem custo"
          : target === "feed"
            ? "Post e story do dia regenerados!"
            : "Story regenerado com sucesso!",
      });
    } catch (err: any) {
      toast({ title: "Erro ao regenerar conteúdo", description: err.message, variant: "destructive" });
    }
    setRegeneratingPost(null);
  };

  const handleRegenerateWeekFree = async (weekIndex: number) => {
    if (!user) return;
    setRegeneratingFreeWeek(weekIndex);
    try {
      if (!(await ensureFreshSession())) { setRegeneratingFreeWeek(null); return; }
      const [{ data: bq }, { data: profile }, { data: reportData }] = await Promise.all([
        supabase.from("business_questionnaires").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single(),
        supabase.from("profiles").select("niche").eq("user_id", user.id).single(),
        supabase.from("reports").select("content").eq("user_id", user.id).eq("status", "completed").order("version", { ascending: false }).limit(1).single(),
      ]);
      const reportContent = normalizeReportContent(reportData?.content) as Record<string, any> | null;
      const { data, error } = await supabase.functions.invoke("generate-content-week", {
        body: {
          business: bq, niche: profile?.niche || "",
          previousWeeks: allWeeks
            .filter((_, i) => i !== weekIndex)
            .map((w) => w.days.map((d) => ({ day: d.day, theme: d.feed?.theme || d.story?.theme || "", format: d.feed?.format || "stories" }))),
          weekNumber: weekIndex + 1,
          storybrand: reportContent?.storybrand || null,
          tone_of_voice: reportContent?.tone_of_voice || null,
          freeRegeneration: true,
          replaceWeekIndex: weekIndex,
        },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error, data, "Erro ao atualizar semana."));
      if (data?.error) throw new Error(data.error);
      if (!data?.editorial) throw new Error("Resposta vazia da IA.");

      // Replace in the correct slot
      const isFirstWeek = structuredEditorial.length > 0 && weekIndex === 0;
      if (isFirstWeek) {
        const newContent = { ...content, editorial: data.editorial };
        await supabase.from("reports").update({ content: newContent }).eq("user_id", user.id).eq("version", report.version);
        setReport({ ...report, content: newContent });
      } else {
        const adjustedIndex = structuredEditorial.length > 0 ? weekIndex - 1 : weekIndex;
        const newWeeks = [...editorialWeeks];
        newWeeks[adjustedIndex] = data.editorial;
        await supabase.from("reports").update({ editorial_weeks: newWeeks }).eq("user_id", user.id).eq("version", report.version);
        setReport({ ...report, editorial_weeks: newWeeks });
      }
      toast({ title: "Semana atualizada sem custo" });
    } catch (err: any) {
      toast({ title: "Erro ao atualizar semana", description: err.message, variant: "destructive" });
    }
    setRegeneratingFreeWeek(null);
  };

  const copyCaption = (caption: string) => {
    navigator.clipboard.writeText(cleanText(caption));
    toast({ title: "Legenda copiada!" });
  };

  // Resolve o week_index real (preservado mesmo após deleções) ou cai para a posição.
  const getWeekKey = (w: any, idx: number): number => {
    const k = w?._week_index ?? w?.week_index;
    return typeof k === "number" ? k : idx;
  };

  const toggleWeekSelection = (weekKey: number) => {
    setSelectedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  };

  const selectAllWeeks = () => {
    setSelectedWeeks(new Set(allWeeks.map((w, i) => getWeekKey(w, i))));
  };

  const clearSelection = () => setSelectedWeeks(new Set());

  const exitSelectionMode = () => {
    setSelectionMode(false);
    clearSelection();
  };

  const handleDeleteWeek = async (weekKey: number) => {
    if (!user || !report) return;
    setDeletingWeek(weekKey);
    try {
      const { data: r } = await supabase
        .from("reports")
        .select("editorial_weeks")
        .eq("id", report.id)
        .single();

      const weeks: any[] = Array.isArray(r?.editorial_weeks) ? r.editorial_weeks : [];
      // Remove qualquer entrada que combine pelo week_index lógico OU, se a semana não tem
      // esse campo gravado, pela posição no array (fallback para semanas legadas).
      const updated = weeks.filter((w, i) => {
        const wi = w?._week_index ?? w?.week_index;
        if (typeof wi === "number") return wi !== weekKey;
        return i !== weekKey;
      });

      const { error: upErr } = await supabase
        .from("reports")
        .update({ editorial_weeks: updated })
        .eq("id", report.id);
      if (upErr) throw upErr;

      // Limpa embeddings e padrões dessa semana (best-effort, não bloqueia UX)
      await Promise.all([
        supabase.from("post_embeddings").delete()
          .eq("user_id", user.id).eq("week_index", weekKey),
        supabase.from("used_title_patterns").delete()
          .eq("user_id", user.id).eq("week_index", weekKey),
      ]);

      setReport({ ...report, editorial_weeks: updated });
      setSelectedWeeks((prev) => {
        const next = new Set(prev);
        next.delete(weekKey);
        return next;
      });
      toast({
        title: "Semana excluída",
        description: `Semana ${weekKey + 1} removida com sucesso.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao excluir",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDeletingWeek(null);
      setConfirmDeleteWeek(null);
    }
  };

  const handleDownloadPDF = async (filterKeys?: Set<number>) => {
    setDownloadingPDF(true);
    try {
      const jsPDF = (await import("jspdf")).default;
      const html2canvas = (await import("html2canvas")).default;

      const A4_W = 210, A4_H = 297, M = 12;
      const CW = A4_W - M * 2;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let isFirstPage = true;

      // Filtra semanas se filterKeys foi fornecido (modo seleção). Caso contrário, usa todas.
      const weeksToExport: { week: any; key: number }[] = allWeeks
        .map((w, i) => ({ week: w, key: getWeekKey(w, i) }))
        .filter(({ key }) => !filterKeys || filterKeys.has(key))
        .sort((a, b) => a.key - b.key);

      // Render TITLE separately (avoids it being lost in pagination)
      const titleContainer = document.createElement("div");
      titleContainer.style.cssText = "position:absolute;left:-9999px;top:0;width:900px;background:#f2eeea;padding:24px;font-family:Inter,sans-serif;";
      const subtitle = filterKeys
        ? `${weeksToExport.length} semana${weeksToExport.length > 1 ? "s" : ""} selecionada${weeksToExport.length > 1 ? "s" : ""}`
        : `${weeksToExport.length} semana${weeksToExport.length > 1 ? "s" : ""} de conteúdo`;
      titleContainer.innerHTML = `<div style="padding:16px 0;">
        <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 4px;">Linha Editorial</h1>
        <p style="font-size:12px;color:#6b7280;margin:0;">${subtitle}</p>
      </div>`;
      document.body.appendChild(titleContainer);

      const renderToPdf = async (container: HTMLElement) => {
        const canvas = await html2canvas(container, {
          scale: 2, useCORS: true, backgroundColor: "#f2eeea", logging: false, windowWidth: 900,
        });
        const wPx = canvas.width;
        const hPx = canvas.height;
        const sf = CW / wPx;
        const hMM = hPx * sf;

        const addImage = (srcCanvas: HTMLCanvasElement, heightMM: number) => {
          if (!isFirstPage) pdf.addPage();
          isFirstPage = false;
          pdf.addImage(srcCanvas.toDataURL("image/jpeg", 0.92), "JPEG", M, M, CW, heightMM);
        };

        if (hMM <= A4_H - M * 2) {
          addImage(canvas, hMM);
        } else {
          const pageH = A4_H - M * 2;
          const pagesNeeded = Math.ceil(hMM / pageH);
          const sliceHPx = Math.floor(wPx * (pageH / CW));
          for (let p = 0; p < pagesNeeded; p++) {
            const srcY = p * sliceHPx;
            const srcH = Math.min(sliceHPx, hPx - srcY);
            const sliceCanvas = document.createElement("canvas");
            sliceCanvas.width = wPx;
            sliceCanvas.height = srcH;
            const ctx = sliceCanvas.getContext("2d")!;
            ctx.drawImage(canvas, 0, srcY, wPx, srcH, 0, 0, wPx, srcH);
            addImage(sliceCanvas, srcH * sf);
          }
        }
      };

      await renderToPdf(titleContainer);
      document.body.removeChild(titleContainer);

      // Render ONE WEEK AT A TIME (avoids canvas size limit)
      for (const { week, key } of weeksToExport) {
        const weekContainer = document.createElement("div");
        weekContainer.style.cssText = "position:absolute;left:-9999px;top:0;width:900px;background:#f2eeea;padding:24px;font-family:Inter,sans-serif;";
        document.body.appendChild(weekContainer);

        const weekHeader = document.createElement("h2");
        weekHeader.style.cssText = "font-size:18px;font-weight:700;margin:24px 0 12px;color:#1a1a2e;";
        weekHeader.textContent = `Semana ${key + 1}`;
        weekContainer.appendChild(weekHeader);

        const grid = document.createElement("div");
        grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;";

        for (let di = 0; di < week.days.length; di++) {
          const day = week.days[di];
          const feed = day.feed;
          const fmt = FORMAT_CONFIG[(feed?.format || "post").toLowerCase()] || FORMAT_CONFIG.post;
          const card = document.createElement("div");
          card.style.cssText = "background:white;border-radius:12px;padding:16px;border:1px solid #e5e1db;break-inside:avoid;";

          let html = `<div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;">Dia ${day.day || di + 1}</span>
            <span style="font-size:10px;font-weight:600;color:#6b7280;">${feed ? fmt.label : "Sem feed"}</span>
          </div>
          <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:#1a1a2e;">${esc(cleanText(feed?.theme || day.story?.theme || ""))}</h3>`;

          if (feed?.caption) {
            html += `<div style="margin-bottom:6px;">
              <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:2px;">Legenda (Feed)</p>
              <p style="font-size:11px;color:#374151;line-height:1.5;">${esc(cleanText(feed.caption))}</p>
            </div>`;
          }

          if (feed?.cta) {
            html += `<div style="margin-bottom:6px;">
              <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:2px;">CTA</p>
              <p style="font-size:11px;font-weight:600;color:#7c3aed;">${esc(cleanText(feed.cta))}</p>
            </div>`;
          }

          if (feed?.card_copy && feed.card_copy.length > 0) {
            html += `<div style="margin-top:6px;padding:8px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
              <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Conteúdo</p>
              ${feed.card_copy.map((c: string) => `<p style="font-size:11px;color:#374151;line-height:1.4;margin-bottom:4px;">${esc(cleanText(c))}</p>`).join("")}
            </div>`;
          }

          if (feed?.script && (feed.format === "reels")) {
            html += `<div style="margin-top:6px;padding:8px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
              <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Roteiro</p>
              <p style="font-size:11px;color:#374151;line-height:1.4;white-space:pre-wrap;">${esc(feed.script)}</p>
            </div>`;
          }

          if (day.story?.frames?.length) {
            html += `<div style="margin-top:8px;padding:8px;background:#fef3c7;border-radius:8px;border:1px solid #fde68a;">
              <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#92400e;margin-bottom:4px;">Stories${day.story.mirrors_feed ? " (mesmo tema do feed)" : ""}</p>
              ${day.story.frames.map((f: string) => `<p style="font-size:11px;color:#78350f;line-height:1.4;margin-bottom:4px;">${esc(cleanText(f))}</p>`).join("")}
            </div>`;
          }

          card.innerHTML = html;
          grid.appendChild(card);
        }
        weekContainer.appendChild(grid);

        await renderToPdf(weekContainer);
        document.body.removeChild(weekContainer);
      }

      pdf.save("posiciona-linha-editorial.pdf");
    } catch (error) {
      console.error("Error generating editorial PDF:", error);
      toast({ title: "Erro ao gerar PDF", description: "Tente novamente.", variant: "destructive" });
    }
    setDownloadingPDF(false);
  };

  if (loading) {
    return (
      <DashboardLayout>
      <SeoHead title="Linha Editorial · Posiciona" description="Calendário e conteúdo semanal alinhados ao seu posicionamento." path="/editorial" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!report || report.status !== "completed") {
    const isPending = report?.status === "pending" || report?.status === "generating";
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
          {isPending ? <Loader2 className="h-10 w-10 text-primary animate-spin" /> : <FileText className="h-10 w-10 text-muted-foreground" />}
          <h2 className="text-lg font-semibold">Linha editorial não disponível</h2>
          <p className="text-muted-foreground text-sm">
            {isPending ? "Sua estratégia está sendo gerada. Volte em alguns instantes." : "Gere suas análises primeiro para ter acesso à linha editorial."}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const needsPersonal = personalSubmitted === false;

  const generateButton = needsPersonal ? (
    <Card className="border-amber-200/50 bg-amber-500/5">
      <CardContent className="py-5 flex flex-col items-center gap-3 text-center">
        <Sparkles className="h-6 w-6 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-foreground">Conte sua história antes de gerar</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            A Linha Editorial usa suas respostas pessoais (hobbies, valores, memórias) para criar posts em formato storytelling — do tatame ao tribunal. Leva 5 minutos.
          </p>
        </div>
        <Button onClick={() => navigate("/personal-questionnaire")} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Preencher Sua História
        </Button>
      </CardContent>
    </Card>
  ) : (
    <Card className="border-border bg-card">
      <CardContent className="py-4 flex flex-col items-center gap-3">
        <div className="text-center">
          <p className="text-xs font-semibold text-gold">
            {weeklyCycles > 0 ? `${weeklyCycles} ciclo${weeklyCycles > 1 ? "s" : ""} dispon${weeklyCycles > 1 ? "íveis" : "ível"}` : "Sem ciclos disponíveis"}
          </p>
        </div>
        <Button onClick={handleGenerateWeek} disabled={generatingWeek || weeklyCycles < 1 || personalSubmitted === null || isReadOnly} className="gap-2">
          {generatingWeek ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generatingWeek ? "Gerando..." : allWeeks.length === 0 ? "Gerar primeira semana" : "Gerar +7 dias"}
        </Button>
        {isReadOnly && (
          <p className="text-xs text-muted-foreground text-center max-w-xs">Disponível com assinatura ativa.</p>
        )}
        {generatingWeek && (
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            {generatingMessage || "Gerando seus 7 posts personalizados. Isso pode levar até 2 minutos — não feche a aba."}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (allWeeks.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Linha Editorial</h1>
            <p className="text-sm text-muted-foreground mt-1">Planejamento semanal de conteúdo</p>
          </div>
          <div className="flex flex-col items-center justify-center h-48 text-center gap-4">
            <Calendar className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Nenhuma semana de conteúdo gerada ainda.</p>
            {generateButton}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" ref={contentRef}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Linha Editorial</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {allWeeks.length} semana{allWeeks.length > 1 ? "s" : ""} de conteúdo
              {regenerationCredits > 0 && ` · ${regenerationCredits} ajuste${regenerationCredits > 1 ? "s" : ""} de conteúdo`}
            </p>
          </div>
          <div className="flex items-center gap-2" data-hide-pdf>
            {!selectionMode && (
              <Button
                variant="outline" size="sm" className="gap-2"
                onClick={() => setSelectionMode(true)}
                disabled={downloadingPDF || allWeeks.length === 0}
              >
                <CheckSquare className="h-4 w-4" /> Selecionar semanas
              </Button>
            )}
            {!selectionMode && (
              <Button onClick={() => handleDownloadPDF()} variant="outline" size="sm" className="gap-2" disabled={downloadingPDF}>
                {downloadingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Baixar PDF
              </Button>
            )}
          </div>
        </div>

        {selectionMode && (
          <div
            className="flex items-center gap-3 sticky top-0 z-20 bg-background/95 backdrop-blur border-b py-3 -mx-2 px-2 flex-wrap"
            data-hide-pdf
          >
            <span className="text-sm font-medium">
              {selectedWeeks.size} semana{selectedWeeks.size !== 1 ? "s" : ""} selecionada{selectedWeeks.size !== 1 ? "s" : ""}
            </span>
            <Button variant="outline" size="sm" onClick={selectAllWeeks}>Selecionar todas</Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>Limpar</Button>
            <Button
              size="sm"
              onClick={() => handleDownloadPDF(new Set(selectedWeeks))}
              disabled={selectedWeeks.size === 0 || downloadingPDF}
              className="ml-auto gap-2"
            >
              {downloadingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Baixar PDF ({selectedWeeks.size})
            </Button>
            <Button variant="ghost" size="sm" onClick={exitSelectionMode}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {hasOlderWeeks && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle>Semanas geradas antes da última reanálise</AlertTitle>
            <AlertDescription className="text-amber-900 dark:text-amber-200">
              Você tem {olderWeeksCount} semana{olderWeeksCount > 1 ? "s" : ""} geradas com a versão anterior da sua estratégia.
              Use o botão "Atualizar semana" em cada uma para realinhar com seu posicionamento atual.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeWeek} onValueChange={setActiveWeek} className="w-full">
          {allWeeks.length > 1 && (
            <TabsList className="mb-4 flex-wrap h-auto bg-muted/50">
              {allWeeks.map((w, i) => (
                <TabsTrigger key={i} value={`week-${i}`} className="text-xs">
                  Semana {getWeekKey(w, i) + 1}
                </TabsTrigger>
              ))}
            </TabsList>
          )}

          {allWeeks.map((week, wi) => {
            const weekOutdated = isWeekOutdated(week.days as any);
            const isRegenWeek = regeneratingFreeWeek === wi;
            const weekTrends = Array.isArray((week as any).market_trends) ? (week as any).market_trends : [];
            const feedDaysForTrends = week.days
              .map((d: DayV6, di: number) => d.feed ? { dayIndex: di, dayNumber: d.day || di + 1, theme: d.feed.theme || "" } : null)
              .filter(Boolean) as { dayIndex: number; dayNumber: number; theme: string }[];
            const weekKey = getWeekKey(week, wi);
            const isSelected = selectedWeeks.has(weekKey);
            return (
            <TabsContent key={wi} value={`week-${wi}`}>
              <div
                className={`mb-3 flex items-center gap-3 rounded-md border px-3 py-2 ${
                  selectionMode && isSelected
                    ? "border-primary/60 bg-primary/5"
                    : "border-border bg-card/40"
                }`}
              >
                {selectionMode && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleWeekSelection(weekKey)}
                    aria-label={`Selecionar semana ${weekKey + 1}`}
                    data-hide-pdf
                  />
                )}
                <h2 className="text-sm font-semibold tracking-tight flex-1">
                  Semana {weekKey + 1}
                </h2>
                {!isReadOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setConfirmDeleteWeek(weekKey)}
                    disabled={deletingWeek !== null}
                    aria-label={`Excluir semana ${weekKey + 1}`}
                    data-hide-pdf
                  >
                    {deletingWeek === weekKey ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              {/* Banner "Atualizar semana (grátis)" temporariamente oculto a pedido. */}
              {false && weekOutdated && isRegenWeek && null}
              {(week._partial || week._stage_b_failed) && (
                <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm">
                      <strong className="block font-semibold">Stories ainda não foram gerados</strong>
                      <span className="opacity-90">
                        O feed desta semana foi salvo, mas a geração dos stories falhou. Você pode tentar novamente sem custo adicional.
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleGenerateStoriesOnly(week._week_index ?? wi)}
                      disabled={generatingStoriesFor !== null}
                    >
                      {generatingStoriesFor === (week._week_index ?? wi) ? "Gerando stories..." : "Gerar stories"}
                    </Button>
                  </div>
                </div>
              )}
              {(week as any)._dedup_warning === true && (
                <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                  <strong className="block font-semibold mb-1">Repetição detectada nesta semana</strong>
                  <span className="text-sm opacity-90">
                    Alguns posts permaneceram com alta similaridade frente às últimas semanas mesmo após reescrita. Revise os dias destacados em âmbar antes de publicar — você pode regenerá-los individualmente usando crédito de regeneração.
                  </span>
                  {Array.isArray((week as any)._dedup_metrics?.dedup_failed_days) && (week as any)._dedup_metrics.dedup_failed_days.length > 0 && (
                    <span className="block text-xs mt-2 opacity-80">
                      Dias afetados: {(week as any)._dedup_metrics.dedup_failed_days.join(", ")}
                    </span>
                  )}
                </div>
              )}
              {weekTrends.length > 0 && (
                <MarketTrendsSection
                  trends={weekTrends}
                  feedDays={feedDaysForTrends}
                  disabled={regenerationCredits < 1 || regeneratingPost !== null}
                  onCreatePost={async (trend, dayIndex) => {
                    const angle = trend.angle_suggestion || trend.title;
                    await handleRegenerateItem(wi, dayIndex, "feed", false, angle);
                  }}
                />
              )}
              <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                {week.days.map((day: DayV6, di: number) => {
                  const feed = day.feed;
                  const story = day.story;
                  const fmt = FORMAT_CONFIG[(feed?.format || "post").toLowerCase()] || FORMAT_CONFIG.post;
                  const regenKey = `${wi}-${di}`;
                  const dayOutdated = isOutdated({ generator_version: day.generator_version });
                  return (
                    <Card key={di} className="flex flex-col break-inside-avoid border border-border">
                      <CardContent className="py-4 flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dia {day.day || di + 1}</span>
                          {false && dayOutdated && (
                            <Badge variant="outline" className="text-[10px] gap-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900">
                              <AlertTriangle className="h-2.5 w-2.5" /> Desatualizado
                            </Badge>
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          {/* ===== Coluna FEED ===== */}
                          <div className={`rounded-md border p-3 space-y-2 ${feed ? `border-l-[3px] ${fmt.border}` : "border-dashed border-muted"}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Feed</span>
                              {feed ? (
                                <div className="flex items-center gap-1.5">
                                  {(feed as any)._dedup_failed === true && (
                                    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                                      Repetição
                                    </span>
                                  )}
                                  <Badge variant="outline" className={`text-[10px] gap-1 ${fmt.color}`}>
                                    {fmt.icon} {fmt.label}
                                  </Badge>
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">Sem post</span>
                              )}
                            </div>
                            {feed ? (
                              <>
                                <h3 className="text-base lg:text-lg font-semibold leading-tight">{cleanText(feed.theme || "")}</h3>
                                {feed.caption && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Legenda</p>
                                    <p className="text-sm lg:text-[15px] text-foreground/80 leading-relaxed line-clamp-3">{cleanText(feed.caption)}</p>
                                  </div>
                                )}
                                {feed.cta && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">CTA</p>
                                    <p className="text-sm lg:text-[15px] font-medium text-primary">{cleanText(feed.cta)}</p>
                                  </div>
                                )}
                                {feed.card_copy && feed.card_copy.length > 0 && (
                                  <Collapsible>
                                    <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                                      <ChevronDown className="h-3 w-3" /> Ver slides
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <div className="mt-2 space-y-1.5 p-3 rounded-lg bg-muted/30 border">
                                        {feed.card_copy.map((copy: string, idx: number) => (
                                          <p key={idx} className="text-sm lg:text-[15px] text-foreground/80 leading-relaxed">{cleanText(copy)}</p>
                                        ))}
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}
                                {feed.script && feed.format === "reels" && (
                                  <Collapsible>
                                    <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                                      <ChevronDown className="h-3 w-3" /> Ver roteiro
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <div className="mt-2 p-3 rounded-lg bg-muted/30 border text-sm lg:text-[15px] leading-relaxed whitespace-pre-wrap">
                                        {feed.script}
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}
                                <div className="flex flex-wrap gap-1.5 pt-1" data-hide-pdf>
                                  {feed.caption && (
                                    <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={() => copyCaption(feed.caption)}>
                                      <Copy className="h-3 w-3" /> Copiar
                                    </Button>
                                  )}
                                  {(feed.format === "carrossel" || feed.format === "post") && (
                                    <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={() => handleOpenEditor(wi, di, feed, false)}>
                                      <PenTool className="h-3 w-3" /> Criar
                                    </Button>
                                  )}
                                  {feed.format === "reels" && (
                                    <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={() => handleOpenEditor(wi, di, feed, true)}>
                                      <Image className="h-3 w-3" /> Capa
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2"
                                    onClick={() => handleRegenerateItem(wi, di, "feed")}
                                    disabled={regeneratingPost === `${regenKey}-feed` || regenerationCredits < 1}
                                    title="O story deste dia será atualizado junto."
                                  >
                                    {regeneratingPost === `${regenKey}-feed` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                    Regenerar
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">Este dia não tem post no feed — só story.</p>
                            )}
                          </div>

                          {/* ===== Coluna STORIES ===== */}
                          <div className="rounded-md border border-l-[3px] border-l-amber-500 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stories</span>
                              <div className="flex items-center gap-1">
                                {story.mirrors_feed && (
                                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                    Mesmo tema do feed
                                  </Badge>
                                )}
                                {story.is_personal && !story.mirrors_feed && (
                                  <Badge variant="outline" className="text-[10px] bg-pink-50 text-pink-700 border-pink-200">
                                    Pessoal
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {story.theme || story.frames?.length ? (
                              <>
                                <h4 className="text-base lg:text-lg font-semibold leading-tight">{cleanText(story.theme || "")}</h4>
                                {story.frames?.length > 0 && (
                                  <div className="space-y-1.5">
                                    {story.frames.map((f: string, idx: number) => (
                                      <div key={idx} className="flex gap-2 items-start">
                                        <span className="text-[10px] font-semibold text-amber-600 mt-0.5">{idx + 1}.</span>
                                        <p className="text-sm lg:text-[15px] text-foreground/80 leading-relaxed">{cleanText(f)}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">Story ainda não gerado.</p>
                            )}
                            {/* Botão de regenerar story aparece SOMENTE em dias sem post de feed.
                                Stories que espelham o feed são atualizados junto com a regeneração do feed. */}
                            {!feed && (
                              <div className="flex flex-wrap gap-1.5 pt-1" data-hide-pdf>
                                <Button
                                  variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2"
                                  onClick={() => handleRegenerateItem(wi, di, "story")}
                                  disabled={regeneratingPost === `${regenKey}-story` || regenerationCredits < 1}
                                >
                                  {regeneratingPost === `${regenKey}-story` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                  Regenerar story
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          );})}
        </Tabs>

        <div className="flex justify-center pt-2" data-hide-pdf>
          {generateButton}
        </div>
      </div>

      {styleModal && (
        <StyleSelectionModal
          open={styleModal.open}
          onOpenChange={(o) => { if (!o) setStyleModal(null); }}
          theme={styleModal.theme}
          caption={styleModal.caption}
          format={styleModal.format}
          paletteHex={paletteHex}
          niche={userNiche}
          businessContext={businessContext}
          onChoose={handleStyleChosen}
        />
      )}

      <AlertDialog
        open={confirmDeleteWeek !== null}
        onOpenChange={(open) => { if (!open) setConfirmDeleteWeek(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir semana {confirmDeleteWeek !== null ? confirmDeleteWeek + 1 : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá os 7 dias desta semana permanentemente. Os embeddings
              e padrões de detecção também serão limpos para que esse conteúdo não
              influencie futuras gerações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingWeek !== null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmDeleteWeek !== null) handleDeleteWeek(confirmDeleteWeek);
              }}
              disabled={deletingWeek !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingWeek !== null ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Excluindo…</>
              ) : (
                "Excluir semana"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default EditorialPage;
