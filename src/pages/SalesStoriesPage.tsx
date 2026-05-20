import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Copy, MessageSquareQuote, ChevronLeft, Sparkles, ChevronDown,
  AlertTriangle, CheckCircle2, AlertCircle, Eye, MoreVertical, Trash2, Search, Pencil,
} from "lucide-react";

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

const SEQUENCE_EMOJI: Record<SequenceType, string> = {
  transformacao: "🦋",
  criticas_julgamentos: "🛡️",
  objecao_narrativa: "🔍",
  objecao_direto: "⚡",
  bastidores_atendimentos: "🤝",
  bastidores_entregas: "📦",
  apresentacao_bio: "👋",
};

const SEQUENCE_KEYS = Object.keys(SEQUENCE_LABELS) as SequenceType[];

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

const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const daysSince = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

const humanAgo = (iso: string) => {
  const days = daysSince(iso);
  if (days < 30) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  const months = Math.round(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.round(months / 12);
  return `há ${years} ${years === 1 ? "ano" : "anos"}`;
};

export default function SalesStoriesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [hasNarrative, setHasNarrative] = useState(false);
  const [narrativeUpdatedAt, setNarrativeUpdatedAt] = useState<string | null>(null);
  const [regenCredits, setRegenCredits] = useState<number>(0);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [selected, setSelected] = useState<Sequence | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [seqType, setSeqType] = useState<SequenceType>("transformacao");
  const [offer, setOffer] = useState("");
  const [generating, setGenerating] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "alpha">("recent");
  const [filterTemplate, setFilterTemplate] = useState<string>("all");
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Preview dialog
  const [previewSeq, setPreviewSeq] = useState<Sequence | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: narrative }, { data: seqs }, { data: balance }] = await Promise.all([
        supabase.from("sales_narrative_questionnaires")
          .select("is_complete, updated_at").eq("user_id", user.id).maybeSingle(),
        supabase.from("sales_story_sequences")
          .select("*").eq("user_id", user.id)
          .order("generated_at", { ascending: false }),
        supabase.from("user_balances")
          .select("regeneration_credits").eq("user_id", user.id).maybeSingle(),
      ]);
      setHasNarrative(!!narrative?.is_complete);
      setNarrativeUpdatedAt(narrative?.is_complete ? (narrative as any).updated_at : null);
      setSequences((seqs || []) as any);
      setRegenCredits(balance?.regeneration_credits ?? 0);
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
      setRegenCredits((c) => Math.max(0, c - 1));
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

  const concatSequence = (seq: Sequence) =>
    [...seq.stories]
      .sort((a, b) => a.ordem - b.ordem)
      .map((s) => `Story ${s.ordem} (${s.tipo}):\n${s.texto}`)
      .join("\n\n---\n\n");

  const copyAll = (seq: Sequence) => copyText(concatSequence(seq), "Sequência inteira");

  const handleDelete = async (seq: Sequence) => {
    if (!confirm("Excluir esta sequência? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("sales_story_sequences").delete().eq("id", seq.id);
    if (error) {
      toast({ title: "Não foi possível excluir", description: error.message, variant: "destructive" });
      return;
    }
    setSequences((prev) => prev.filter((s) => s.id !== seq.id));
    toast({ title: "Sequência excluída" });
  };

  const filteredSequences = useMemo(() => {
    let list = [...sequences];
    if (filterTemplate !== "all") list = list.filter((s) => s.sequence_type === filterTemplate);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => {
        const offerHit = s.offer_context?.toLowerCase().includes(q);
        const previewHit = previewOf(s.stories as StoryItem[]).toLowerCase().includes(q);
        return offerHit || previewHit;
      });
    }
    list.sort((a, b) => {
      if (sortBy === "alpha") return (a.offer_context || "").localeCompare(b.offer_context || "");
      const ta = new Date(a.generated_at).getTime();
      const tb = new Date(b.generated_at).getTime();
      return sortBy === "oldest" ? ta - tb : tb - ta;
    });
    return list;
  }, [sequences, filterTemplate, search, sortBy]);

  const showFilterBar = sequences.length >= 5;
  const lowCredits = regenCredits <= 1;
  const noCredits = regenCredits <= 0;

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
        <div className="space-y-6 max-w-[1100px] mx-auto">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="-ml-2">
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar para sequências
          </Button>

          <div className="space-y-2">
            <Badge variant="outline">{SEQUENCE_LABELS[selected.sequence_type as SequenceType]}</Badge>
            <h1 className="text-3xl font-display">{selected.offer_context}</h1>
            <p className="text-sm text-muted-foreground">
              Gerada em {formatDate(selected.generated_at)} · {selected.stories.length} stories nesta sequência
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

  const narrativeDays = narrativeUpdatedAt ? daysSince(narrativeUpdatedAt) : null;
  const narrativeStale = narrativeDays !== null && narrativeDays > 60;

  const generateButton = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">
            <Button
              disabled={noCredits}
              onClick={() => setDialogOpen(true)}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              <span>Gerar nova sequência</span>
              <span className={`text-xs opacity-80 ${lowCredits ? "text-warning" : ""}`}>
                · 1 ajuste ({regenCredits} {regenCredits === 1 ? "restante" : "restantes"})
              </span>
            </Button>
          </span>
        </TooltipTrigger>
        {noCredits && (
          <TooltipContent>
            Sem créditos de ajuste. Adquira mais em Plano e Créditos.
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <DashboardLayout>
      <SeoHead title="Stories de Venda · Posiciona" description="Roteiros de stories para apresentar e vender seus serviços." path="/stories-de-venda" />
      <div className="space-y-6 max-w-full lg:max-w-[1100px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-display flex items-center gap-2">
              <MessageSquareQuote className="h-6 w-6 md:h-7 md:w-7 text-primary" />
              Stories de Venda
            </h1>
            <p className="text-muted-foreground mt-1 max-w-xl text-sm md:text-base">
              Sequências de stories que conectam dúvida real do cliente com a sua entrega.
            </p>
          </div>
        </div>

        {/* Narrative status card */}
        {!hasNarrative ? (
          <Card className="border-destructive/40 bg-destructive/10">
            <CardContent className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="font-medium text-sm md:text-base">
                  Você ainda não preencheu sua história de venda.
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Sem isso, as sequências saem genéricas.
                </p>
              </div>
              <Button onClick={() => navigate("/sales-narrative")} size="sm">
                Preencher agora
              </Button>
            </CardContent>
          </Card>
        ) : narrativeStale ? (
          <Card className="border-amber-500/30 bg-amber-500/10">
            <CardContent className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="font-medium text-sm md:text-base">
                  Sua história de venda foi atualizada {humanAgo(narrativeUpdatedAt!)}.
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Sequências mais frescas precisam de matéria-prima atual.
                </p>
              </div>
              <Button onClick={() => navigate("/sales-narrative")} size="sm" variant="outline">
                Atualizar agora
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            <span>História de venda atualizada em {formatShortDate(narrativeUpdatedAt!)}</span>
            <span>·</span>
            <Link to="/sales-narrative" className="underline hover:text-foreground">Revisar</Link>
          </div>
        )}

        {/* 7 templates collapsible */}
        <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <span>Como funciona — ver os 7 templates</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${templatesOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SEQUENCE_KEYS.map((k) => (
                <div key={k} className="rounded-lg border border-border bg-card/50 p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg leading-none">{SEQUENCE_EMOJI[k]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-snug">{SEQUENCE_LABELS[k]}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{SEQUENCE_DESCRIPTIONS[k]}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Generate button row */}
        {hasNarrative && (
          <div className="flex justify-start">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>{generateButton}</DialogTrigger>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova sequência de stories</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 py-2">
                  <div className="space-y-2">
                    <Label>Tipo de sequência</Label>
                    <RadioGroup value={seqType} onValueChange={(v) => setSeqType(v as SequenceType)}>
                      {SEQUENCE_KEYS.map((k) => (
                        <label
                          key={k}
                          htmlFor={`seq-${k}`}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                        >
                          <RadioGroupItem value={k} id={`seq-${k}`} className="mt-0.5" />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{SEQUENCE_EMOJI[k]} {SEQUENCE_LABELS[k]}</div>
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
                  <Button onClick={handleGenerate} disabled={generating || noCredits}>
                    {generating ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando…</>
                    ) : (
                      <>Gerar sequência</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Filter bar */}
        {hasNarrative && showFilterBar && (
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="md:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recente</SelectItem>
                <SelectItem value="oldest">Mais antiga</SelectItem>
                <SelectItem value="alpha">Alfabética</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterTemplate} onValueChange={setFilterTemplate}>
              <SelectTrigger className="md:w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os templates</SelectItem>
                {SEQUENCE_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>{SEQUENCE_EMOJI[k]} {SEQUENCE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Sequences list / empty */}
        {hasNarrative && sequences.length === 0 ? (
          <Card>
            <CardContent className="p-8 md:p-12 text-center space-y-4">
              <div className="text-5xl">🎬</div>
              <h2 className="text-lg md:text-xl font-display">
                Você ainda não criou nenhuma sequência de stories.
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Sequências de stories são roteiros prontos pra postar — você escolhe um dos 7 templates testados e o Posiciona gera 7 stories conectadas à sua história de venda.
              </p>
              <div className="pt-2">
                <Button onClick={() => setDialogOpen(true)} disabled={noCredits}>
                  <Sparkles className="h-4 w-4 mr-2" /> Criar primeira sequência
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : hasNarrative && filteredSequences.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma sequência encontrada com esses filtros.
            </CardContent>
          </Card>
        ) : hasNarrative && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSequences.map((seq) => {
              const type = seq.sequence_type as SequenceType;
              const count = (seq.stories as StoryItem[])?.length || 0;
              return (
                <Card
                  key={seq.id}
                  className="hover:border-primary/40 transition-colors flex flex-col"
                >
                  <CardHeader className="pb-2">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 md:gap-2">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs gap-1 max-w-full md:max-w-[60%] self-start">
                              <span className="shrink-0">{SEQUENCE_EMOJI[type] || "•"}</span>
                              <span className="truncate">{SEQUENCE_LABELS[type] || seq.sequence_type}</span>
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{SEQUENCE_LABELS[type] || seq.sequence_type}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(seq.generated_at)}</span>
                    </div>
                    <CardTitle
                      className="text-base font-medium leading-snug pt-1 cursor-pointer hover:text-primary"
                      onClick={() => setSelected(seq)}
                    >
                      {seq.offer_context}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p
                      className="text-sm text-muted-foreground line-clamp-2 cursor-pointer flex-1"
                      onClick={() => setSelected(seq)}
                    >
                      {previewOf(seq.stories as StoryItem[])}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-2">
                      {count} stories nesta sequência
                    </p>
                    <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={(e) => { e.stopPropagation(); setPreviewSeq(seq); }}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Visualizar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={(e) => { e.stopPropagation(); copyAll(seq); }}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copiar texto
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 ml-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => toast({ title: "Renomear em breve", description: "Esta ação ainda não está disponível." })}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(seq)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview dialog */}
      <Dialog open={!!previewSeq} onOpenChange={(o) => !o && setPreviewSeq(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {previewSeq && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>{SEQUENCE_EMOJI[previewSeq.sequence_type as SequenceType]}</span>
                  <span>{previewSeq.offer_context}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                {[...previewSeq.stories].sort((a, b) => a.ordem - b.ordem).map((s) => (
                  <div key={s.ordem} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Story {s.ordem}</span>
                      <Badge variant="outline" className={`${TIPO_BADGE[s.tipo] || ""} text-[10px]`}>{s.tipo}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{s.texto}</p>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => copyAll(previewSeq)}>
                  <Copy className="h-4 w-4 mr-2" /> Copiar texto
                </Button>
                <Button onClick={() => { setSelected(previewSeq); setPreviewSeq(null); }}>
                  Abrir página completa
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
