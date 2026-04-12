import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Sparkles, ChevronDown, Calendar, Video, Image, Smartphone, ImageIcon, PenTool, FileText, RefreshCw
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const FORMAT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  reels: { label: "Reels", icon: <Video className="h-3 w-3" />, color: "bg-pink-500/10 text-pink-600 border-pink-200" },
  carrossel: { label: "Carrossel", icon: <Image className="h-3 w-3" />, color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  stories: { label: "Stories", icon: <Smartphone className="h-3 w-3" />, color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  post: { label: "Post", icon: <ImageIcon className="h-3 w-3" />, color: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
};

const EditorialPage = () => {
  const navigate = useNavigate();
  const { user, balances, refreshSubscription } = useAuth();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingWeek, setGeneratingWeek] = useState(false);
  const [regeneratingPost, setRegeneratingPost] = useState<string | null>(null);

  const weeklyCycles = balances?.weekly_cycles ?? 0;
  const regenerationCredits = balances?.regeneration_credits ?? 0;

  useEffect(() => {
    if (!user) return;
    supabase
      .from("reports")
      .select("*")
      .eq("user_id", user.id)
      .order("version", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        setReport(data);
        setLoading(false);
      });
  }, [user]);

  const content = report?.content;
  const isStructured = typeof content === "object" && content !== null && content.archetypes;
  const editorialWeeks: any[][] = report?.editorial_weeks || [];
  const allWeeks = [
    ...(isStructured && content.editorial ? [content.editorial] : []),
    ...editorialWeeks,
  ];

  const handleGenerateWeek = async () => {
    if (!user || weeklyCycles < 1) {
      toast({ title: "Créditos insuficientes", description: "Você não tem ciclos semanais disponíveis.", variant: "destructive" });
      return;
    }
    setGeneratingWeek(true);
    try {
      const { data: bq } = await supabase.from("business_questionnaires").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single();
      const { data: profile } = await supabase.from("profiles").select("niche").eq("user_id", user.id).single();
      const { data: topArchetypes } = await supabase.from("user_top_archetypes").select("*").eq("user_id", user.id).order("rank", { ascending: true }).limit(3);

      const archetypes = {
        primary: topArchetypes?.[0],
        secondary: topArchetypes?.[1],
        tertiary: topArchetypes?.[2],
      };

      const { data, error } = await supabase.functions.invoke("generate-content-week", {
        body: { business: bq, niche: profile?.niche || "", archetypes, previousWeeks: allWeeks },
      });

      if (error) throw error;

      const updatedWeeks = [...editorialWeeks, data.editorial];
      await supabase.from("reports").update({ editorial_weeks: updatedWeeks }).eq("user_id", user.id).eq("version", report.version);

      await supabase
        .from("user_balances")
        .update({ weekly_cycles: weeklyCycles - 1 })
        .eq("user_id", user.id);

      await supabase.from("credit_logs").insert({
        user_id: user.id,
        credit_type: "weekly_cycle",
        amount: -1,
        description: `Geração da semana ${allWeeks.length + 1} de conteúdo editorial`,
      });

      setReport({ ...report, editorial_weeks: updatedWeeks });
      await refreshSubscription();
      toast({ title: "Nova semana gerada com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao gerar conteúdo", description: err.message, variant: "destructive" });
    }
    setGeneratingWeek(false);
  };

  const handleRegeneratePost = async (weekIndex: number, dayIndex: number) => {
    if (!user || regenerationCredits < 1) {
      toast({ title: "Créditos insuficientes", description: "Você não tem créditos de regeneração.", variant: "destructive" });
      return;
    }

    const key = `${weekIndex}-${dayIndex}`;
    setRegeneratingPost(key);

    try {
      const week = allWeeks[weekIndex];
      const day = week[dayIndex];

      const { data: bq } = await supabase.from("business_questionnaires").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single();
      const { data: profile } = await supabase.from("profiles").select("niche").eq("user_id", user.id).single();
      const { data: topArchetypes } = await supabase.from("user_top_archetypes").select("*").eq("user_id", user.id).order("rank", { ascending: true }).limit(3);

      // Collect all existing posts to avoid duplication
      const existingPosts = allWeeks.flat();

      const { data, error } = await supabase.functions.invoke("regenerate-single-post", {
        body: {
          format: day.format,
          theme: day.theme,
          dayNumber: day.day || dayIndex + 1,
          business: bq,
          niche: profile?.niche || "",
          archetypes: { primary: topArchetypes?.[0], secondary: topArchetypes?.[1], tertiary: topArchetypes?.[2] },
          existingPosts,
        },
      });

      if (error) throw error;

      const isFirstWeek = isStructured && content.editorial && weekIndex === 0;

      if (isFirstWeek) {
        // Update content.editorial
        const newEditorial = [...content.editorial];
        newEditorial[dayIndex] = data.post;
        const newContent = { ...content, editorial: newEditorial };
        await supabase.from("reports").update({ content: newContent }).eq("user_id", user.id).eq("version", report.version);
        setReport({ ...report, content: newContent });
      } else {
        // Update editorial_weeks
        const adjustedWeekIndex = isStructured && content.editorial ? weekIndex - 1 : weekIndex;
        const newWeeks = [...editorialWeeks];
        newWeeks[adjustedWeekIndex] = [...newWeeks[adjustedWeekIndex]];
        newWeeks[adjustedWeekIndex][dayIndex] = data.post;
        await supabase.from("reports").update({ editorial_weeks: newWeeks }).eq("user_id", user.id).eq("version", report.version);
        setReport({ ...report, editorial_weeks: newWeeks });
      }

      // Consume credit
      await supabase.from("user_balances").update({ regeneration_credits: regenerationCredits - 1 }).eq("user_id", user.id);
      await supabase.from("credit_logs").insert({
        user_id: user.id,
        credit_type: "regeneration",
        amount: -1,
        description: `Regeneração de post: ${day.theme}`,
      });

      await refreshSubscription();
      toast({ title: "Post regenerado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao regenerar post", description: err.message, variant: "destructive" });
    }
    setRegeneratingPost(null);
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
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold font-display">Linha editorial não disponível</h2>
          <p className="text-muted-foreground mt-1">Gere suas análises primeiro para ter acesso à linha editorial.</p>
        </div>
      </DashboardLayout>
    );
  }

  const generateButton = (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={handleGenerateWeek} disabled={generatingWeek || weeklyCycles < 1} size="lg" className="gap-2">
        {generatingWeek ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {generatingWeek ? "Gerando..." : allWeeks.length === 0 ? "Gerar primeira semana de conteúdo" : "Gerar +7 dias de conteúdo"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {weeklyCycles > 0
          ? `${weeklyCycles} ciclo${weeklyCycles > 1 ? "s" : ""} semanal${weeklyCycles > 1 ? "is" : ""} disponível${weeklyCycles > 1 ? "is" : ""}`
          : "Sem ciclos semanais disponíveis."}
      </p>
    </div>
  );

  if (allWeeks.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold font-display">Linha Editorial</h1>
            <p className="text-sm text-muted-foreground mt-1">Planejamento semanal de conteúdo</p>
          </div>
          <div className="flex flex-col items-center justify-center h-48 text-center gap-4">
            <Calendar className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma semana de conteúdo gerada ainda.</p>
            {generateButton}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold font-display">Linha Editorial</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Planejamento semanal de conteúdo
              {regenerationCredits > 0 && (
                <span className="ml-2">· {regenerationCredits} regeneração{regenerationCredits > 1 ? "ões" : ""} disponível{regenerationCredits > 1 ? "is" : ""}</span>
              )}
            </p>
          </div>
        </div>

        <div className="bg-muted/30 rounded-2xl p-6 md:p-8">
          <Tabs defaultValue="week-0" className="w-full">
            {allWeeks.length > 1 && (
              <TabsList className="mb-4 flex-wrap h-auto">
                {allWeeks.map((_, i) => (
                  <TabsTrigger key={i} value={`week-${i}`}>Semana {i + 1}</TabsTrigger>
                ))}
              </TabsList>
            )}
            {allWeeks.map((week, wi) => (
              <TabsContent key={wi} value={`week-${wi}`}>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {(week || []).map((day: any, di: number) => {
                    const fmt = FORMAT_CONFIG[day.format?.toLowerCase()] || FORMAT_CONFIG.post;
                    const regenKey = `${wi}-${di}`;
                    return (
                      <Card key={di} className="flex flex-col">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-muted-foreground">DIA {day.day || di + 1}</span>
                            <Badge variant="outline" className={`text-xs gap-1 ${fmt.color}`}>
                              {fmt.icon} {fmt.label}
                            </Badge>
                          </div>
                          <CardTitle className="text-base font-display leading-tight">{day.theme}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-3 pt-0">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Legenda</h4>
                            <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">{day.caption}</p>
                          </div>
                          {day.card_copy?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                {day.format?.toLowerCase() === "carrossel" ? "Conteúdo dos Slides" : "Copy do Post"}
                              </h4>
                              <div className="space-y-1.5">
                                {day.card_copy.map((copy: string, idx: number) => (
                                  <div key={idx} className="flex gap-2 items-start">
                                    {day.format?.toLowerCase() === "carrossel" && (
                                      <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">Slide {idx + 1}</Badge>
                                    )}
                                    <p className="text-xs leading-relaxed text-foreground/80">{copy}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">CTA</h4>
                            <p className="text-xs font-medium text-primary">{day.cta}</p>
                          </div>
                          {day.script && (
                            <Collapsible>
                              <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                                <ChevronDown className="h-3 w-3" /> {day.format?.toLowerCase() === "reels" ? "Ver roteiro" : "Ver detalhes"}
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="mt-2 p-3 rounded-lg bg-background text-xs leading-relaxed whitespace-pre-wrap border">
                                  {day.script}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                          <div className="flex gap-2 mt-2">
                            {(day.format?.toLowerCase() === "carrossel" || day.format?.toLowerCase() === "post") && day.card_copy?.length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 gap-2"
                                onClick={() => navigate(`/post-editor?week=${wi}&day=${di}`)}
                              >
                                <PenTool className="h-3 w-3" /> Criar Post
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => handleRegeneratePost(wi, di)}
                              disabled={regeneratingPost === regenKey || regenerationCredits < 1}
                              title={regenerationCredits < 1 ? "Sem créditos de regeneração" : "Gerar novo post"}
                            >
                              {regeneratingPost === regenKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                              Gerar novo
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <div className="mt-8">
            {generateButton}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EditorialPage;
