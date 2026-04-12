import { useEffect, useState } from "react";
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
  ImageIcon, PenTool, FileText, RefreshCw, Copy
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { parseReportContent } from "@/lib/reportParser";

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
    supabase.from("reports").select("*").eq("user_id", user.id)
      .order("version", { ascending: false }).limit(1).single()
      .then(({ data }) => { setReport(data); setLoading(false); });
  }, [user]);

  const { contentObject, hasEditorial } = parseReportContent(report?.content);
  const content = contentObject ?? {};
  const structuredEditorial = Array.isArray(content.editorial) ? content.editorial : [];
  const editorialWeeks: any[][] = Array.isArray(report?.editorial_weeks) ? report.editorial_weeks : [];
  const allWeeks = [
    ...(hasEditorial && structuredEditorial.length > 0 ? [structuredEditorial] : []),
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

      const archetypes = { primary: topArchetypes?.[0], secondary: topArchetypes?.[1], tertiary: topArchetypes?.[2] };
      const { data, error } = await supabase.functions.invoke("generate-content-week", {
        body: { business: bq, niche: profile?.niche || "", archetypes, previousWeeks: allWeeks },
      });
      if (error) throw error;

      const updatedWeeks = [...editorialWeeks, data.editorial];
      await supabase.from("reports").update({ editorial_weeks: updatedWeeks }).eq("user_id", user.id).eq("version", report.version);
      await supabase.from("user_balances").update({ weekly_cycles: weeklyCycles - 1 }).eq("user_id", user.id);
      await supabase.from("credit_logs").insert({
        user_id: user.id, credit_type: "weekly_cycle", amount: -1,
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
      const existingPosts = allWeeks.flat();
      const { data, error } = await supabase.functions.invoke("regenerate-single-post", {
        body: {
          format: day.format, theme: day.theme, dayNumber: day.day || dayIndex + 1,
          business: bq, niche: profile?.niche || "",
          archetypes: { primary: topArchetypes?.[0], secondary: topArchetypes?.[1], tertiary: topArchetypes?.[2] },
          existingPosts,
        },
      });
      if (error) throw error;

      const isFirstWeek = structuredEditorial.length > 0 && weekIndex === 0;
      if (isFirstWeek) {
        const newEditorial = [...structuredEditorial];
        newEditorial[dayIndex] = data.post;
        const newContent = { ...content, editorial: newEditorial };
        await supabase.from("reports").update({ content: newContent }).eq("user_id", user.id).eq("version", report.version);
        setReport({ ...report, content: newContent });
      } else {
        const adjustedWeekIndex = structuredEditorial.length > 0 ? weekIndex - 1 : weekIndex;
        const newWeeks = [...editorialWeeks];
        newWeeks[adjustedWeekIndex] = [...newWeeks[adjustedWeekIndex]];
        newWeeks[adjustedWeekIndex][dayIndex] = data.post;
        await supabase.from("reports").update({ editorial_weeks: newWeeks }).eq("user_id", user.id).eq("version", report.version);
        setReport({ ...report, editorial_weeks: newWeeks });
      }

      await supabase.from("user_balances").update({ regeneration_credits: regenerationCredits - 1 }).eq("user_id", user.id);
      await supabase.from("credit_logs").insert({
        user_id: user.id, credit_type: "regeneration", amount: -1, description: `Regeneração de post: ${day.theme}`,
      });
      await refreshSubscription();
      toast({ title: "Post regenerado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao regenerar post", description: err.message, variant: "destructive" });
    }
    setRegeneratingPost(null);
  };

  const copyCaption = (caption: string) => {
    navigator.clipboard.writeText(caption);
    toast({ title: "Legenda copiada!" });
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
        <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Linha editorial não disponível</h2>
          <p className="text-muted-foreground text-sm">Gere suas análises primeiro para ter acesso à linha editorial.</p>
        </div>
      </DashboardLayout>
    );
  }

  const generateButton = (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={handleGenerateWeek} disabled={generatingWeek || weeklyCycles < 1} className="gap-2">
        {generatingWeek ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {generatingWeek ? "Gerando..." : allWeeks.length === 0 ? "Gerar primeira semana" : "Gerar +7 dias"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        {weeklyCycles > 0 ? `${weeklyCycles} ciclo${weeklyCycles > 1 ? "s" : ""} disponível${weeklyCycles > 1 ? "is" : ""}` : "Sem ciclos disponíveis"}
      </p>
    </div>
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
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Linha Editorial</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {allWeeks.length} semana{allWeeks.length > 1 ? "s" : ""} de conteúdo
              {regenerationCredits > 0 && ` · ${regenerationCredits} regeneraç${regenerationCredits > 1 ? "ões" : "ão"}`}
            </p>
          </div>
        </div>

        <Tabs defaultValue="week-0" className="w-full">
          {allWeeks.length > 1 && (
            <TabsList className="mb-4 flex-wrap h-auto bg-muted/50">
              {allWeeks.map((_, i) => (
                <TabsTrigger key={i} value={`week-${i}`} className="text-xs">Semana {i + 1}</TabsTrigger>
              ))}
            </TabsList>
          )}

          {allWeeks.map((week, wi) => (
            <TabsContent key={wi} value={`week-${wi}`}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(week || []).map((day: any, di: number) => {
                  const fmt = FORMAT_CONFIG[day.format?.toLowerCase()] || FORMAT_CONFIG.post;
                  const regenKey = `${wi}-${di}`;
                  return (
                    <Card key={di} className="flex flex-col">
                      <CardContent className="py-4 flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dia {day.day || di + 1}</span>
                          <Badge variant="outline" className={`text-[10px] gap-1 ${fmt.color}`}>
                            {fmt.icon} {fmt.label}
                          </Badge>
                        </div>

                        <h3 className="text-sm font-semibold leading-tight">{day.theme}</h3>

                        {/* Caption preview */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Legenda</p>
                          <p className="text-xs text-foreground/70 leading-relaxed line-clamp-3">{day.caption}</p>
                        </div>

                        {day.cta && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">CTA</p>
                            <p className="text-xs font-medium text-primary">{day.cta}</p>
                          </div>
                        )}

                        {/* Carousel content (collapsible) */}
                        {day.card_copy?.length > 0 && (
                          <Collapsible>
                            <CollapsibleTrigger className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                              <ChevronDown className="h-3 w-3" /> Ver conteúdo completo
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 space-y-1.5 p-3 rounded-lg bg-muted/30 border">
                                {day.card_copy.map((copy: string, idx: number) => (
                                  <p key={idx} className="text-xs text-foreground/70 leading-relaxed">{copy}</p>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {day.script && (
                          <Collapsible>
                            <CollapsibleTrigger className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                              <ChevronDown className="h-3 w-3" /> Ver roteiro
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 p-3 rounded-lg bg-muted/30 border text-xs leading-relaxed whitespace-pre-wrap">
                                {day.script}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {day.caption && (
                            <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={() => copyCaption(day.caption)}>
                              <Copy className="h-3 w-3" /> Copiar legenda
                            </Button>
                          )}
                          {(day.format?.toLowerCase() === "carrossel" || day.format?.toLowerCase() === "post") && day.card_copy?.length > 0 && (
                            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={() => navigate(`/post-editor?week=${wi}&day=${di}`)}>
                              <PenTool className="h-3 w-3" /> Criar post
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2"
                            onClick={() => handleRegeneratePost(wi, di)}
                            disabled={regeneratingPost === regenKey || regenerationCredits < 1}
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

        <div className="flex justify-center pt-2">
          {generateButton}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EditorialPage;
