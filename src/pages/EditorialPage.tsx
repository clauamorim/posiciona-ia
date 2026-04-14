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
  ImageIcon, PenTool, FileText, RefreshCw, Copy, Download
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { parseReportContent, normalizeReportContent } from "@/lib/reportParser";

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
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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
      const [{ data: bq }, { data: profile }, { data: topArchetypes }, { data: reportData }] = await Promise.all([
        supabase.from("business_questionnaires").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single(),
        supabase.from("profiles").select("niche").eq("user_id", user.id).single(),
        supabase.from("user_top_archetypes").select("*").eq("user_id", user.id).order("rank", { ascending: true }).limit(3),
        supabase.from("reports").select("content").eq("user_id", user.id).eq("status", "completed").order("version", { ascending: false }).limit(1).single(),
      ]);

      const reportContent = normalizeReportContent(reportData?.content) as Record<string, any> | null;
      const archetypes = { primary: topArchetypes?.[0], secondary: topArchetypes?.[1], tertiary: topArchetypes?.[2] };
      const { data, error } = await supabase.functions.invoke("generate-content-week", {
        body: {
          business: bq, niche: profile?.niche || "", archetypes, previousWeeks: allWeeks,
          storybrand: reportContent?.storybrand || null,
          tone_of_voice: reportContent?.tone_of_voice || null,
        },
      });
      if (error) throw error;

      const updatedWeeks = [...editorialWeeks, data.editorial];
      await supabase.from("reports").update({ editorial_weeks: updatedWeeks }).eq("user_id", user.id).eq("version", report.version);

      // Credit deduction is handled by the edge function — just refresh balances
      await refreshSubscription();

      setReport({ ...report, editorial_weeks: updatedWeeks });
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
      const [{ data: bq }, { data: profile }, { data: topArchetypes }, { data: reportData }] = await Promise.all([
        supabase.from("business_questionnaires").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single(),
        supabase.from("profiles").select("niche").eq("user_id", user.id).single(),
        supabase.from("user_top_archetypes").select("*").eq("user_id", user.id).order("rank", { ascending: true }).limit(3),
        supabase.from("reports").select("content").eq("user_id", user.id).eq("status", "completed").order("version", { ascending: false }).limit(1).single(),
      ]);
      const reportContent = reportData?.content as Record<string, any> | null;
      const existingPosts = allWeeks.flat();
      const { data, error } = await supabase.functions.invoke("regenerate-single-post", {
        body: {
          format: day.format, theme: day.theme, dayNumber: day.day || dayIndex + 1,
          business: bq, niche: profile?.niche || "",
          archetypes: { primary: topArchetypes?.[0], secondary: topArchetypes?.[1], tertiary: topArchetypes?.[2] },
          existingPosts,
          storybrand: reportContent?.storybrand || null,
          tone_of_voice: reportContent?.tone_of_voice || null,
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
        
        for (let di = 0; di < (week || []).length; di++) {
          const day = week[di];
          const fmt = FORMAT_CONFIG[day.format?.toLowerCase()] || FORMAT_CONFIG.post;
          const card = document.createElement("div");
          card.style.cssText = "background:white;border-radius:12px;padding:16px;border:1px solid #e5e1db;break-inside:avoid;";

          let html = `<div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;">Dia ${day.day || di + 1}</span>
            <span style="font-size:10px;font-weight:600;color:#6b7280;">${fmt.label}</span>
          </div>
          <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:#1a1a2e;">${day.theme || ""}</h3>`;

          if (day.caption) {
            html += `<div style="margin-bottom:6px;">
              <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:2px;">Legenda</p>
              <p style="font-size:11px;color:#374151;line-height:1.5;">${day.caption}</p>
            </div>`;
          }

          if (day.cta) {
            html += `<div style="margin-bottom:6px;">
              <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:2px;">CTA</p>
              <p style="font-size:11px;font-weight:600;color:#7c3aed;">${day.cta}</p>
            </div>`;
          }

          if (day.card_copy?.length > 0) {
            html += `<div style="margin-top:6px;padding:8px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
              <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Conteúdo</p>
              ${day.card_copy.map((c: string) => `<p style="font-size:11px;color:#374151;line-height:1.4;margin-bottom:4px;">${c}</p>`).join("")}
            </div>`;
          }

          if (day.script && (day.format?.toLowerCase() === "reels" || day.format?.toLowerCase() === "stories")) {
            html += `<div style="margin-top:6px;padding:8px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
              <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Roteiro</p>
              <p style="font-size:11px;color:#374151;line-height:1.4;white-space:pre-wrap;">${day.script}</p>
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
      <div className="space-y-6" ref={contentRef}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Linha Editorial</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {allWeeks.length} semana{allWeeks.length > 1 ? "s" : ""} de conteúdo
              {regenerationCredits > 0 && ` · ${regenerationCredits} regeneraç${regenerationCredits > 1 ? "ões" : "ão"}`}
            </p>
          </div>
          <Button onClick={handleDownloadPDF} variant="outline" size="sm" className="gap-2" disabled={downloadingPDF} data-hide-pdf>
            {downloadingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Baixar PDF
          </Button>
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
                    <Card key={di} className="flex flex-col break-inside-avoid">
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

                        {day.script && (day.format?.toLowerCase() === "reels" || day.format?.toLowerCase() === "stories") && (
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
                        <div className="flex flex-wrap gap-2 pt-1" data-hide-pdf>
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
                          {day.format?.toLowerCase() === "reels" && (
                            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={() => navigate(`/post-editor?week=${wi}&day=${di}&format=reels-cover`)}>
                              <Image className="h-3 w-3" /> Gerar capa
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

        <div className="flex justify-center pt-2" data-hide-pdf>
          {generateButton}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EditorialPage;
