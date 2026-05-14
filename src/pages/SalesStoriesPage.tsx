import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, MessageSquareQuote, ChevronLeft, Sparkles } from "lucide-react";

type SequenceType =
  | "transformacao"
  | "criticas_julgamentos"
  | "objecao_narrativa"
  | "objecao_direto"
  | "bastidores_atendimentos"
  | "bastidores_entregas"
  | "apresentacao_bio";

const SEQUENCE_LABELS: Record<SequenceType, string> = {
  transformacao: "Jornada de transformação pessoal",
  criticas_julgamentos: "Enfrentando críticas e julgamentos",
  objecao_narrativa: "Quebrando objeções com narrativa",
  objecao_direto: "Quebrando objeções direto ao ponto",
  bastidores_atendimentos: "Bastidores de atendimentos",
  bastidores_entregas: "Bastidores de entregas",
  apresentacao_bio: "Apresentação pessoal / Bio",
};

const SEQUENCE_DESCRIPTIONS: Record<SequenceType, string> = {
  transformacao: "Gerar identificação e conduzir para venda.",
  criticas_julgamentos: "Vulnerabilidade combinada com autoridade.",
  objecao_narrativa: "Desconstruir crença com profundidade narrativa.",
  objecao_direto: "Rápido, assertivo, com CTA imediato.",
  bastidores_atendimentos: "Prova social pelo trabalho do dia.",
  bastidores_entregas: "Volume e variedade de público atendido.",
  apresentacao_bio: "História completa para conexão profunda.",
};

const TIPO_BADGE: Record<string, string> = {
  abertura: "bg-primary/15 text-primary border-primary/30",
  desenvolvimento: "bg-muted text-muted-foreground border-border",
  cta: "bg-success/15 text-success border-success/30",
};

interface StoryItem {
  ordem: number;
  texto: string;
  tipo: string;
}

interface Sequence {
  id: string;
  sequence_type: string;
  offer_context: string;
  stories: StoryItem[];
  generated_at: string;
}

const previewOf = (stories: StoryItem[]) => {
  const first = stories?.[0]?.texto || "";
  const words = first.split(/\s+/).slice(0, 14).join(" ");
  return words + (first.split(/\s+/).length > 14 ? "…" : "");
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });

export default function SalesStoriesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [hasNarrative, setHasNarrative] = useState(false);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [selected, setSelected] = useState<Sequence | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [seqType, setSeqType] = useState<SequenceType>("transformacao");
  const [offer, setOffer] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: narrative }, { data: seqs }] = await Promise.all([
        supabase.from("sales_narrative_questionnaires")
          .select("is_complete").eq("user_id", user.id).maybeSingle(),
        supabase.from("sales_story_sequences")
          .select("*").eq("user_id", user.id)
          .order("generated_at", { ascending: false }),
      ]);
      setHasNarrative(!!narrative?.is_complete);
      setSequences((seqs || []) as any);
      setLoading(false);
    })();
  }, [user]);

  const handleGenerate = async () => {
    if (offer.trim().length < 3) {
      toast({ title: "Descreva a oferta", description: "Mínimo 3 caracteres.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-sales-stories", {
        body: { sequence_type: seqType, offer_context: offer.trim() },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Erro ao gerar.");
      }
      const seq = (data as any).sequence as Sequence;
      setSequences((prev) => [seq, ...prev]);
      setSelected(seq);
      setDialogOpen(false);
      setOffer("");
      toast({ title: "Sequência gerada", description: "Pronta para copiar e postar." });
    } catch (e: any) {
      toast({ title: "Não foi possível gerar", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copyText = async (text: string, label = "Texto") => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copiado` });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const copyAll = (seq: Sequence) => {
    const text = seq.stories
      .sort((a, b) => a.ordem - b.ordem)
      .map((s) => `Story ${s.ordem} (${s.tipo}):\n${s.texto}`)
      .join("\n\n---\n\n");
    copyText(text, "Sequência inteira");
  };

  if (loading) {
    return (
      <DashboardLayout>
      <SeoHead title="Stories de Venda · Posiciona" description="Roteiros de stories para apresentar e vender seus serviços." path="/stories-de-venda" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Detail view
  if (selected) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="-ml-2">
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar para sequências
          </Button>

          <div className="space-y-2">
            <Badge variant="outline">{SEQUENCE_LABELS[selected.sequence_type as SequenceType]}</Badge>
            <h1 className="text-3xl font-display">{selected.offer_context}</h1>
            <p className="text-sm text-muted-foreground">
              Gerada em {formatDate(selected.generated_at)} · {selected.stories.length} stories
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => copyAll(selected)} variant="outline">
              <Copy className="h-4 w-4 mr-2" /> Copiar sequência inteira
            </Button>
          </div>

          <div className="space-y-3">
            {[...selected.stories].sort((a, b) => a.ordem - b.ordem).map((s) => (
              <Card key={s.ordem}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Story {s.ordem}</span>
                      <Badge variant="outline" className={TIPO_BADGE[s.tipo] || ""}>{s.tipo}</Badge>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => copyText(s.texto, `Story ${s.ordem}`)}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-base leading-relaxed">{s.texto}</p>
                </CardContent>
              </Card>
            ))}
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
            <h1 className="text-3xl font-display flex items-center gap-2">
              <MessageSquareQuote className="h-7 w-7 text-primary" />
              Stories de Venda
            </h1>
            <p className="text-muted-foreground mt-1 max-w-xl">
              Sequências prontas de stories para conversão direta, baseadas em 7 templates testados.
            </p>
          </div>
          {hasNarrative && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Sparkles className="h-4 w-4 mr-2" /> Gerar nova sequência
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova sequência de stories</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 py-2">
                  <div className="space-y-2">
                    <Label>Tipo de sequência</Label>
                    <RadioGroup value={seqType} onValueChange={(v) => setSeqType(v as SequenceType)}>
                      {(Object.keys(SEQUENCE_LABELS) as SequenceType[]).map((k) => (
                        <label
                          key={k}
                          htmlFor={`seq-${k}`}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                        >
                          <RadioGroupItem value={k} id={`seq-${k}`} className="mt-0.5" />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{SEQUENCE_LABELS[k]}</div>
                            <div className="text-xs text-muted-foreground">{SEQUENCE_DESCRIPTIONS[k]}</div>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="offer">O que você está vendendo nessa sequência?</Label>
                    <Textarea
                      id="offer"
                      placeholder="Ex.: Mentoria individual de 3 meses, R$ 4.500"
                      value={offer}
                      onChange={(e) => setOffer(e.target.value)}
                      rows={3}
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground">
                      Esse contexto guia o CTA final da sequência. Custa 1 crédito de ajuste.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={generating}>
                    Cancelar
                  </Button>
                  <Button onClick={handleGenerate} disabled={generating}>
                    {generating ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando…</>
                    ) : (
                      <>Gerar sequência</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {!hasNarrative ? (
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-display">Antes de gerar, conte sua história de venda</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Os stories são montados a partir de fatos reais que você compartilha (objeções literais
                  da audiência, expressões pessoais, casos de prova). Sem esse questionário, a IA inventa
                  contexto — e isso quebra a conversão.
                </p>
              </div>
              <Button onClick={() => navigate("/sales-narrative")}>Preencher agora</Button>
            </CardContent>
          </Card>
        ) : sequences.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <MessageSquareQuote className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground">
                Nenhuma sequência ainda. Gere a primeira a partir de um dos 7 templates.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sequences.map((seq) => (
              <Card
                key={seq.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => setSelected(seq)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-xs">
                      {SEQUENCE_LABELS[seq.sequence_type as SequenceType] || seq.sequence_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(seq.generated_at)}</span>
                  </div>
                  <CardTitle className="text-base font-medium leading-snug pt-1">
                    {seq.offer_context}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {previewOf(seq.stories as StoryItem[])}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    {(seq.stories as StoryItem[])?.length || 0} stories
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {hasNarrative && (
          <div className="text-xs text-muted-foreground/70 pt-2">
            <Link to="/sales-narrative" className="underline hover:text-foreground">
              Atualizar minha história de venda
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
