import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ensureReportGenerationStarted } from "@/lib/reportGeneration";
import { Loader2, Users, Target, Heart, BookOpen, Compass, Zap, Megaphone, Star, Shield, ArrowRight, RefreshCw, Sparkles } from "lucide-react";

// Mesma estrutura visual da narrativa completa (src/pages/StoryBrand.tsx),
// para o usuário reencontrar no relatório o esquema que conheceu aqui.
const ITEMS = [
  { key: "hero", label: "O Personagem (Cliente)", icon: Users },
  { key: "external_problem", label: "Problema Externo", icon: Target },
  { key: "internal_problem", label: "Problema Interno", icon: Heart },
  { key: "philosophical_problem", label: "Problema Filosófico", icon: BookOpen },
  { key: "guide", label: "O Guia (Você)", icon: Compass },
  { key: "plan", label: "O Plano", icon: Zap },
  { key: "cta", label: "Chamada para Ação", icon: Megaphone },
  { key: "success", label: "O Sucesso", icon: Star },
  { key: "failure", label: "O Fracasso Evitado", icon: Shield },
] as const;

// Hash simples e estável das respostas para invalidar o cache local quando o
// diagnóstico mudar (não precisa ser criptográfico).
function hashAnswers(answers: Record<string, string>): string {
  const s = JSON.stringify(answers);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return String(h);
}

const NarrativePreview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [storybrand, setStorybrand] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  const cacheKey = user ? `posiciona-sbp-${user.id}` : "posiciona-sbp";

  const load = async (forceRegenerate = false) => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const { data: bq } = await supabase
        .from("business_questionnaires")
        .select("*")
        .eq("user_id", user.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!bq || !bq.is_complete) {
        toast({ title: "Complete o diagnóstico primeiro", description: "A prévia da narrativa nasce das suas respostas." });
        navigate("/business-questionnaire");
        return;
      }

      const answers: Record<string, string> = {};
      [
        "company_name", "services", "target_audience", "external_problems",
        "internal_problems", "empathic_statements", "authority_proofs", "hiring_steps",
        "client_fears", "main_cta", "negative_consequences", "promised_transformations",
      ].forEach(k => { answers[k] = ((bq as any)[k] || "").trim(); });

      const hash = hashAnswers(answers);
      if (!forceRegenerate) {
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached?.hash === hash && cached?.storybrand) {
              setStorybrand(cached.storybrand);
              setLoading(false);
              return;
            }
          }
        } catch { /* ignore */ }
      }

      const { data: profile } = await supabase
        .from("profiles").select("profession, niche").eq("user_id", user.id).maybeSingle();

      const { data, error: fnError } = await supabase.functions.invoke("storybrand-preview", {
        body: { answers, profession: profile?.profession || undefined, niche: profile?.niche || undefined },
      });
      if (fnError) throw new Error(fnError.message || "Falha na conexão");
      if (data?.error) throw new Error(data.error);
      if (!data?.storybrand) throw new Error("Prévia vazia");

      setStorybrand(data.storybrand);
      try { localStorage.setItem(cacheKey, JSON.stringify({ hash, storybrand: data.storybrand })); } catch { /* ignore */ }
    } catch (e: any) {
      setError(e?.message || "Não foi possível gerar a prévia.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id || startedRef.current) return;
    startedRef.current = true;
    load();
    // Com diagnóstico + arquétipos prontos, o relatório completo já pode nascer
    // em segundo plano — quando o usuário terminar o "Sua História", ele estará
    // pronto (a tela de Resultados retoma o polling do job ativo sozinha).
    ensureReportGenerationStarted(user.id).then(r => console.log("[report-bg]", r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <DashboardLayout>
      <SeoHead title="Prévia da Narrativa · Posiciona" description="Primeira versão da sua narrativa StoryBrand." path="/narrative-preview" />
      <div className="max-w-2xl lg:max-w-[900px] mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">Sua narrativa está nascendo</h1>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Prévia</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              Primeira versão da sua história StoryBrand, montada a partir do diagnóstico.
            </p>
          </div>
        </div>

        {loading && (
          <Card className="border-primary/15">
            <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium">Montando a prévia da sua narrativa…</p>
              <p className="text-xs text-muted-foreground">Leva só alguns segundos.</p>
            </CardContent>
          </Card>
        )}

        {!loading && error && (
          <Card className="border-destructive/30">
            <CardContent className="py-6 flex flex-col items-center gap-3 text-center">
              <p className="text-sm">{error}</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => load(true)}>Tentar novamente</Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/personal-questionnaire")}>
                  Seguir sem a prévia <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && storybrand && (
          <>
            {/* Blocos */}
            <div className="space-y-2">
              {ITEMS.map(item => {
                const val = storybrand[item.key];
                if (!val || (Array.isArray(val) && val.length === 0)) return null;
                const Icon = item.icon;
                return (
                  <Card key={item.key} className="border-border/60">
                    <CardContent className="py-3.5 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-primary/70 uppercase tracking-wider mb-1">{item.label}</p>
                        {Array.isArray(val) ? (
                          <div className="text-sm text-foreground/85 leading-relaxed space-y-0.5">
                            {val.map((v: string, i: number) => (
                              <p key={i}>{i + 1}. {v}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-foreground/85 leading-relaxed">{val}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Aviso de prévia + regenerar */}
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Esta é uma versão resumida. A narrativa completa, junto com seus arquétipos e identidade
                de marca, virá no seu Relatório Estratégico.
              </p>
              <Button variant="ghost" size="sm" onClick={() => load(true)} className="text-muted-foreground flex-shrink-0 gap-1.5">
                <RefreshCw className="h-3 w-3" /> Gerar de novo
              </Button>
            </div>

            {/* Próximo passo */}
            <Card className="border-primary/15 bg-primary/[0.04]">
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Próximo passo</p>
                  <p className="text-sm font-medium mt-0.5">Sua História — a matéria-prima humana dos seus posts</p>
                </div>
                <Button size="sm" onClick={() => navigate("/personal-questionnaire")} className="gap-1.5 flex-shrink-0">
                  <Sparkles className="h-3.5 w-3.5" /> Continuar
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NarrativePreview;
