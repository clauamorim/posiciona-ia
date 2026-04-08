import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Users, Target, Heart, BookOpen, Compass, Zap, Megaphone, Star, Shield, Sparkles, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

const DIAGRAM_NODES = [
  { key: "hero", label: "Um Personagem", shortLabel: "Personagem", icon: Users, x: 80, y: 280 },
  { key: "external_problem", label: "Tem um Problema", shortLabel: "Problema", icon: Target, x: 280, y: 120 },
  { key: "guide", label: "Encontra um Guia", shortLabel: "Guia", icon: Compass, x: 480, y: 280 },
  { key: "plan", label: "Que Tem um Plano", shortLabel: "Plano", icon: Zap, x: 680, y: 120 },
  { key: "cta", label: "E o Convida a Agir", shortLabel: "Ação", icon: Megaphone, x: 880, y: 280 },
];

const RESULT_NODES = [
  { key: "success", label: "Que Termina em Sucesso", shortLabel: "Sucesso", icon: Star, x: 1020, y: 120 },
  { key: "failure", label: "E Evita o Fracasso", shortLabel: "Fracasso", icon: Shield, x: 1020, y: 380 },
];

const DETAIL_ITEMS = [
  { key: "hero", label: "O Personagem (Cliente)", icon: Users },
  { key: "external_problem", label: "Problema Externo", icon: Target },
  { key: "internal_problem", label: "Problema Interno", icon: Heart },
  { key: "philosophical_problem", label: "Problema Filosófico", icon: BookOpen },
  { key: "guide", label: "O Guia (Marca)", icon: Compass },
  { key: "plan", label: "O Plano", icon: Zap },
  { key: "cta", label: "Chamada para Ação", icon: Megaphone },
  { key: "success", label: "O Sucesso", icon: Star },
  { key: "failure", label: "O Fracasso", icon: Shield },
];

const StoryBrand = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [hasBusinessQ, setHasBusinessQ] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("reports").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single(),
      supabase.from("business_questionnaires").select("id, is_complete").eq("user_id", user.id).eq("is_complete", true).limit(1),
    ]).then(([{ data: reportData }, { data: bqData }]) => {
      setReport(reportData);
      setHasBusinessQ((bqData?.length ?? 0) > 0);
      setLoading(false);
    });
  }, [user]);

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const [{ data: bq }, { data: profile }, { data: topArchetypes }] = await Promise.all([
        supabase.from("business_questionnaires").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single(),
        supabase.from("profiles").select("niche").eq("user_id", user.id).single(),
        supabase.from("user_top_archetypes").select("*").eq("user_id", user.id).order("rank", { ascending: true }).limit(3),
      ]);

      const archetypes = {
        primary: topArchetypes?.[0],
        secondary: topArchetypes?.[1],
        tertiary: topArchetypes?.[2],
      };

      await supabase.from("reports").upsert({
        user_id: user.id,
        version: 1,
        status: "generating",
      }, { onConflict: "user_id,version" });

      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { business: bq, niche: profile?.niche || "", archetypes },
      });

      if (error) throw error;

      await supabase.from("reports").update({
        content: data.report,
        status: "completed",
      }).eq("user_id", user.id).eq("version", 1);

      await supabase.from("business_questionnaires").update({ status: "locked" }).eq("user_id", user.id);

      setReport({ content: data.report, status: "completed" });
      toast({ title: "StoryBrand gerado com sucesso!" });
    } catch (err: any) {
      await supabase.from("reports").update({
        status: "error",
        error_message: err.message,
      }).eq("user_id", user.id).eq("version", 1);
      toast({ title: "Erro ao gerar StoryBrand", description: err.message, variant: "destructive" });
    }
    setGenerating(false);
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

  const content = report?.content;
  const storybrand = typeof content === "object" && content !== null ? content.storybrand : null;

  if (!storybrand) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-bold font-display">StoryBrand não disponível</h2>
          {hasBusinessQ ? (
            <>
              <p className="text-muted-foreground text-sm max-w-md">
                O questionário do negócio está completo. Gere sua estratégia StoryBrand agora.
              </p>
              <Button onClick={handleGenerate} disabled={generating} className="gap-2" size="lg">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Gerando StoryBrand..." : "Gerar Estratégia StoryBrand"}
              </Button>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Após gerar, o questionário será bloqueado para edição.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Complete o questionário do negócio primeiro.</p>
          )}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-10">
        <div>
          <h1 className="text-3xl font-bold font-display">StoryBrand</h1>
          <p className="text-sm text-muted-foreground mt-1">A jornada narrativa da sua marca</p>
        </div>

        {/* SVG Diagram */}
        <div className="bg-muted/30 rounded-2xl p-4 md:p-8 overflow-x-auto">
          <svg viewBox="0 0 1160 500" className="w-full min-w-[700px] h-auto" style={{ maxHeight: 400 }}>
            {/* Connection lines */}
            <path d="M 130 280 L 280 170" stroke="hsl(var(--primary))" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 330 170 L 480 280" stroke="hsl(var(--primary))" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 530 280 L 680 170" stroke="hsl(var(--primary))" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 730 170 L 880 280" stroke="hsl(var(--primary))" strokeWidth="3" fill="none" strokeLinecap="round" />
            {/* Fork to success/failure */}
            <path d="M 930 260 L 1020 170" stroke="hsl(var(--primary))" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 930 300 L 1020 380" stroke="hsl(var(--muted-foreground))" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="6 4" />

            {/* Main nodes */}
            {DIAGRAM_NODES.map(node => {
              const Icon = node.icon;
              const isActive = activeNode === node.key;
              return (
                <g
                  key={node.key}
                  onClick={() => setActiveNode(activeNode === node.key ? null : node.key)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isActive ? 48 : 44}
                    fill={isActive ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                    className="transition-all duration-200"
                  />
                  <foreignObject x={node.x - 14} y={node.y - 14} width={28} height={28}>
                    <div className="flex items-center justify-center w-full h-full">
                      <Icon className="h-5 w-5 text-background" />
                    </div>
                  </foreignObject>
                  <text
                    x={node.x}
                    y={node.y + 70}
                    textAnchor="middle"
                    className="text-[13px] font-semibold fill-foreground"
                  >
                    {node.shortLabel}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + 88}
                    textAnchor="middle"
                    className="text-[11px] fill-muted-foreground"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}

            {/* Result nodes */}
            {RESULT_NODES.map(node => {
              const Icon = node.icon;
              const isActive = activeNode === node.key;
              const isSuccess = node.key === "success";
              return (
                <g
                  key={node.key}
                  onClick={() => setActiveNode(activeNode === node.key ? null : node.key)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isActive ? 42 : 38}
                    fill={isSuccess
                      ? (isActive ? "hsl(var(--primary))" : "hsl(142, 56%, 40%)")
                      : (isActive ? "hsl(var(--primary))" : "hsl(0, 0%, 40%)")}
                    className="transition-all duration-200"
                  />
                  <foreignObject x={node.x - 12} y={node.y - 12} width={24} height={24}>
                    <div className="flex items-center justify-center w-full h-full">
                      <Icon className="h-4 w-4 text-background" />
                    </div>
                  </foreignObject>
                  <text
                    x={node.x}
                    y={node.y + (isSuccess ? 58 : 58)}
                    textAnchor="middle"
                    className="text-[12px] font-semibold fill-foreground"
                  >
                    {node.shortLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Detail Cards */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {DETAIL_ITEMS.map(item => {
            const val = storybrand[item.key];
            if (!val) return null;
            const Icon = item.icon;
            const isActive = activeNode === item.key;
            return (
              <Card
                key={item.key}
                className={`hover:shadow-md transition-all ${isActive ? "ring-2 ring-primary border-primary" : ""}`}
                onClick={() => setActiveNode(activeNode === item.key ? null : item.key)}
              >
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <Icon className="h-5 w-5" />
                    <h3 className="font-bold font-display text-sm">{item.label}</h3>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {Array.isArray(val) ? val.map((v: string, i: number) => <span key={i} className="block">{i + 1}. {v}</span>) : val}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StoryBrand;
