import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
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
  ImageIcon, PenTool, FileText, RefreshCw, Copy, Download, AlertTriangle, Wand2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
  const { user, balances, refreshSubscription } = useAuth();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingWeek, setGeneratingWeek] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState<string>("");
  const [regeneratingPost, setRegeneratingPost] = useState<string | null>(null);
  const [regeneratingFreeWeek, setRegeneratingFreeWeek] = useState<number | null>(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
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
  const allWeeksRaw: any[] = [
    ...(hasEditorial && structuredEditorial.length > 0 ? [structuredEditorial] : []),
    ...editorialWeeks,
  ];
  // Sempre normaliza para shape v6 antes de renderizar (tolerante a v5 antigo)
  const allWeeks: WeekV6[] = allWeeksRaw.map((w) => normalizeWeekToV6(w));

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

      // 2) Polling do status (a cada 3s, timeout 4 minutos)
      setGeneratingMessage("Gerando seus 7 posts… pode levar até 2 minutos.");
      const startedAt = Date.now();
      const TIMEOUT_MS = 4 * 60 * 1000;
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
          throw new Error(job.error_message || "Não foi possível gerar a semana. Tente novamente.");
        }
      }

      if (!finalResult?.editorial) {
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
      toast({ title: "Nova semana gerada com sucesso!" });
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
        await supabase.from("user_balances").update({ regeneration_credits: regenerationCredits - 1 }).eq("user_id", user.id);
        const themeForLog = target === "feed" ? (newFeed?.theme || day.feed?.theme || "") : (newStory?.theme || day.story?.theme || "");
        await supabase.from("credit_logs").insert({
          user_id: user.id, credit_type: "regeneration", amount: -1,
          description: `Ajuste de conteúdo (${target}): ${themeForLog}`,
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

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    try {
      const jsPDF = (await import("jspdf")).default;
      const html2canvas = (await import("html2canvas")).default;

      // Create a hidden static container with ALL weeks expanded
      const printContainer = document.createElement("div");
      printContainer.style.cssText = "position:absolute;left:-9999px;top:0;width:900px;background:#f2eeea;padding:24px;font-family:Inter,sans-serif;";
      document.body.appendChild(printContainer);

      // Render all weeks statically
      for (let wi = 0; wi < allWeeks.length; wi++) {
        const week = allWeeks[wi];
        const weekHeader = document.createElement("h2");
        weekHeader.style.cssText = "font-size:18px;font-weight:700;margin:24px 0 12px;color:#1a1a2e;";
        weekHeader.textContent = `Semana ${wi + 1}`;
        printContainer.appendChild(weekHeader);

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
        printContainer.appendChild(grid);
      }

      // Capture sections
      const A4_W = 210, A4_H = 297, M = 12;
      const CW = A4_W - M * 2;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let curY = M;

      // Title
      const titleEl = document.createElement("div");
      titleEl.style.cssText = "padding:16px 0;";
      titleEl.innerHTML = `<h1 style="font-size:22px;font-weight:700;color:#1a1a2e;">Linha Editorial</h1>
        <p style="font-size:12px;color:#6b7280;">${allWeeks.length} semana${allWeeks.length > 1 ? "s" : ""} de conteúdo</p>`;
      printContainer.insertBefore(titleEl, printContainer.firstChild);

      const canvas = await html2canvas(printContainer, {
        scale: 2, useCORS: true, backgroundColor: "#f2eeea", logging: false, windowWidth: 900,
      });

      document.body.removeChild(printContainer);

      const wPx = canvas.width;
      const hPx = canvas.height;
      const sf = CW / wPx;
      const hMM = hPx * sf;

      if (hMM <= A4_H - M * 2) {
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", M, M, CW, hMM);
      } else {
        // Split across pages
        const pageH = A4_H - M * 2;
        const pagesNeeded = Math.ceil(hMM / pageH);
        const sliceHPx = Math.floor(wPx * (pageH / CW));

        for (let p = 0; p < pagesNeeded; p++) {
          if (p > 0) pdf.addPage();
          const srcY = p * sliceHPx;
          const srcH = Math.min(sliceHPx, hPx - srcY);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = wPx;
          sliceCanvas.height = srcH;
          const ctx = sliceCanvas.getContext("2d")!;
          ctx.drawImage(canvas, 0, srcY, wPx, srcH, 0, 0, wPx, srcH);
          const sliceHMM = srcH * sf;
          pdf.addImage(sliceCanvas.toDataURL("image/jpeg", 0.92), "JPEG", M, M, CW, sliceHMM);
        }
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
            {weeklyCycles > 0 ? `${weeklyCycles} ciclo${weeklyCycles > 1 ? "s" : ""} disponível${weeklyCycles > 1 ? "is" : ""}` : "Sem ciclos disponíveis"}
          </p>
        </div>
        <Button onClick={handleGenerateWeek} disabled={generatingWeek || weeklyCycles < 1 || personalSubmitted === null} className="gap-2">
          {generatingWeek ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generatingWeek ? "Gerando..." : allWeeks.length === 0 ? "Gerar primeira semana" : "Gerar +7 dias"}
        </Button>
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
          <Button onClick={handleDownloadPDF} variant="outline" size="sm" className="gap-2" disabled={downloadingPDF} data-hide-pdf>
            {downloadingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Baixar PDF
          </Button>
        </div>

        <Tabs value={activeWeek} onValueChange={setActiveWeek} className="w-full">
          {allWeeks.length > 1 && (
            <TabsList className="mb-4 flex-wrap h-auto bg-muted/50">
              {allWeeks.map((_, i) => (
                <TabsTrigger key={i} value={`week-${i}`} className="text-xs">Semana {i + 1}</TabsTrigger>
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
            return (
            <TabsContent key={wi} value={`week-${wi}`}>
              {/* Banner "Atualizar semana (grátis)" temporariamente oculto a pedido. */}
              {false && weekOutdated && isRegenWeek && null}
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
                                <Badge variant="outline" className={`text-[10px] gap-1 ${fmt.color}`}>
                                  {fmt.icon} {fmt.label}
                                </Badge>
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
    </DashboardLayout>
  );
};

export default EditorialPage;
