import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Loader2, Sparkles, Image as ImageIcon, Check, ArrowLeft, Upload, Camera } from "lucide-react";
import { fetchImageGallery, generateAIImage, type PhotographerInfo } from "@/lib/postAutoLayout";
import { signedUserUploadUrl } from "@/lib/userGalleryUrl";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { AI_STYLE_OPTIONS, type AIStyleId, getAIStyleById } from "@/lib/aiImageStyles";

interface ImageGalleryPanelProps {
  defaultQuery: string;
  format: "square" | "portrait";
  /** Chamado quando usuário escolhe imagem; recebe URL, info do fotógrafo (Pexels) e opcionalmente fonte ("ai" / "pexels" / "saved"). */
  onPickImage: (url: string, photographer?: PhotographerInfo, source?: "ai" | "pexels" | "saved") => void;
  /** Chamado após geração IA bem-sucedida; retorna false quando o débito falha. */
  onAIGenerated?: () => Promise<boolean | void> | boolean | void;
  /** Saldo atual de créditos de regeneração (para validar antes de chamar a IA). */
  regenerationCredits?: number;
  niche?: string;
  businessContext?: string;
  /** Legenda do post — refina busca/IA. */
  caption?: string;
  /** Corpo do post (card_copy do slide atual ou texto editado). */
  postBody?: string;
}

interface GalleryItem {
  url: string;
  photographer: PhotographerInfo;
}

const ImageGalleryPanel: React.FC<ImageGalleryPanelProps> = ({
  defaultQuery, format, onPickImage, onAIGenerated, regenerationCredits,
  niche, businessContext, caption, postBody,
}) => {
  const { user } = useAuth();
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<GalleryItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  /** Query final efetivamente enviada ao Pexels (após tradução PT→EN + contexto). */
  const [appliedKeywords, setAppliedKeywords] = useState<string>("");

  // Saved images (Unsplash/AI/upload from this user's gallery, photo-only context)
  const [savedImages, setSavedImages] = useState<Array<{ url: string; name: string; source: string }>>([]);

  // AI prompt dialog (duas janelas independentes)
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiStyleOpen, setAiStyleOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(defaultQuery);
  const [selectedAiStyle, setSelectedAiStyle] = useState<AIStyleId | null>(null);
  const [generatingAI, setGeneratingAI] = useState(false);

  useEffect(() => {
    setQuery(defaultQuery);
    setAiPrompt(defaultQuery);
  }, [defaultQuery]);

  // Carrega imagens salvas (apenas fotos: source unsplash/ai/upload e não-logo)
  const loadSavedImages = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_gallery_assets")
      .select("file_path, name, source, is_logo")
      .eq("user_id", user.id)
      .eq("is_logo", false)
      .order("created_at", { ascending: false })
      .limit(24);
    if (!data) return;
    // Bucket privado — sempre URL assinada.
    const mapped = await Promise.all(data.map(async (row: any) => {
      const url = await signedUserUploadUrl(row.file_path);
      return { url, name: row.name || "Imagem salva", source: row.source || "upload" };
    }));
    setSavedImages(mapped.filter((m) => m.url));
  };

  useEffect(() => {
    if (!user) return;
    loadSavedImages();
    const handler = () => loadSavedImages();
    window.addEventListener("posiciona:gallery-updated", handler);
    return () => window.removeEventListener("posiciona:gallery-updated", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const runSearch = async (p = 1, append = false) => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      // Diferencia o input do usuário (userQuery) do tema do post (defaultQuery).
      // Se ele não mexeu no input, manda só o contexto; se digitou algo
      // diferente, isso vira a intenção principal e ainda combinamos com
      // cardCopy (postBody) e nicho para ancorar visualmente.
      const userTyped = query.trim() && query.trim() !== defaultQuery.trim()
        ? query.trim()
        : undefined;
      const { results: list, keywords } = await fetchImageGallery({
        query: defaultQuery, format, page: p,
        niche, businessContext, caption,
        cardCopy: postBody, body: postBody,
        userQuery: userTyped,
      });
      setResults(prev => append ? [...prev, ...list] : list);
      setAppliedKeywords(keywords);
      setPage(p);
      setHasSearched(true);
      if (list.length === 0 && !append) {
        toast({ title: "Nenhuma imagem encontrada", description: "Tente outra palavra-chave." });
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar imagens", description: err?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Auto-search on first mount with default query
  useEffect(() => {
    if (!hasSearched && defaultQuery.trim()) {
      runSearch(1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAIConfirm = async () => {
    if (!aiPrompt.trim() || !selectedAiStyle) return;
    // Validação de saldo antes da chamada
    if (typeof regenerationCredits === "number" && regenerationCredits <= 0) {
      toast({
        title: "Sem créditos de regeneração",
        description: "Compre mais créditos para gerar imagens por IA.",
        variant: "destructive",
      });
      closeAiDialog();
      return;
    }
    setGeneratingAI(true);
    try {
      const userTyped = aiPrompt.trim() && aiPrompt.trim() !== defaultQuery.trim()
        ? aiPrompt.trim()
        : undefined;
      const styleOption = getAIStyleById(selectedAiStyle);
      const result = await generateAIImage({
        query: defaultQuery, format,
        niche, businessContext, caption,
        cardCopy: postBody, body: postBody,
        userQuery: userTyped,
        aiStyleDirective: styleOption?.directive,
      });
      if (!result) {
        toast({ title: "Falha ao gerar imagem por IA", description: "Tente novamente em instantes — nenhum crédito foi debitado.", variant: "destructive" });
        return;
      }
      onPickImage(result.url, undefined, "ai");
      let debitOk = true;
      try {
        const debitResult = await onAIGenerated?.();
        if (typeof debitResult === "boolean" && !debitResult) debitOk = false;
      } catch (e) {
        debitOk = false;
        console.warn("Debit credit failed", e);
      }
      if (!debitOk) {
        toast({ title: "Imagem gerada, mas o crédito não foi debitado", description: "Corrigimos o fluxo para evitar falso sucesso. Tente novamente em instantes.", variant: "destructive" });
        return;
      }
      toast({
        title: result.savedToGallery ? "Imagem IA gerada e salva" : "Imagem IA gerada",
        description: result.savedToGallery
          ? "1 crédito de regeneração utilizado. A imagem já entrou na sua galeria."
          : "1 crédito de regeneração utilizado.",
      });
      closeAiDialog();
    } catch (err: any) {
      toast({ title: "Erro ao gerar IA", description: err?.message || "Nenhum crédito foi debitado.", variant: "destructive" });
    } finally {
      setGeneratingAI(false);
    }
  };

  const closeAiDialog = () => {
    setAiPromptOpen(false);
    setAiStyleOpen(false);
    setSelectedAiStyle(null);
  };

  const openAiDialog = () => {
    setSelectedAiStyle(null);
    setAiPrompt(defaultQuery);
    setAiStyleOpen(false);
    setAiPromptOpen(true);
  };

  const goToStyleStep = () => {
    setAiPromptOpen(false);
    // Aguarda a animação de saída do primeiro dialog antes de abrir o segundo,
    // evitando que o Radix UI bloqueie o overlay/scroll por sobreposição.
    setTimeout(() => setAiStyleOpen(true), 200);
  };

  const backToPromptStep = () => {
    setAiStyleOpen(false);
    setTimeout(() => setAiPromptOpen(true), 200);
  };


  // Mapa de fontes → metadados de exibição (tooltip + ícone).
  // Suporte legado: "UN" / "unsplash" continuam reconhecidos para imagens antigas, mas
  // o produto não usa mais Unsplash como fonte ativa (apenas Pexels, IA, Upload e Retratos).
  const renderSourceBadge = (source: string) => {
    const s = (source || "upload").toLowerCase();
    let label = "Imagem enviada por você";
    let short = "↑";
    let Icon: any = Upload;
    if (s === "ai") { label = "Gerado por IA"; short = "IA"; Icon = Sparkles; }
    else if (s === "pexels") { label = "Pexels"; short = "PX"; Icon = ImageIcon; }
    else if (s === "portrait") { label = "Retrato de marca"; short = "RT"; Icon = Camera; }
    else if (s === "unsplash" || s === "un") { label = "Legacy Unsplash (descontinuado)"; short = "UN"; Icon = ImageIcon; }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="absolute bottom-0.5 right-0.5 px-1 py-px rounded bg-background/90 text-[9px] font-semibold uppercase tracking-wider text-foreground/80 flex items-center gap-0.5">
            <Icon className="h-2.5 w-2.5" />
            {short}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-3">
      {savedImages.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Suas imagens salvas</p>
            <a
              href="/my-gallery"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-medium text-primary hover:underline"
            >
              Ver toda a galeria
            </a>
          </div>
          <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {savedImages.map((item, i) => (
              <button
                key={`${item.url}-${i}`}
                onClick={() => onPickImage(item.url, undefined, "saved")}
                className="aspect-square rounded-md border bg-muted/40 hover:ring-2 hover:ring-primary transition-all overflow-hidden relative"
                title={item.name}
              >
                <img src={item.url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                {renderSourceBadge(item.source)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Buscar no Pexels</p>
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">Grátis</Badge>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); runSearch(1, false); }}
          className="flex gap-1.5"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Palavra-chave"
            className="h-8 text-xs"
          />
          <Button type="submit" variant="outline" size="sm" disabled={loading || !query.trim()} className="h-8 px-2">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
        </form>
        {appliedKeywords && hasSearched && (
          <p className="text-[10px] text-muted-foreground/70 mt-1.5 italic" title="Tradução automática a partir do tema do slide + nicho">
            Buscando por: <span className="font-medium not-italic text-muted-foreground">{appliedKeywords}</span>
          </p>
        )}
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {results.map((item, i) => (
            <button
              key={`${item.url}-${i}`}
              onClick={() => onPickImage(item.url, item.photographer, "pexels")}
              className="aspect-square rounded-md border bg-muted/40 hover:ring-2 hover:ring-primary transition-all overflow-hidden"
              title={`Foto por ${item.photographer.name}`}
            >
              <img src={item.url} alt={item.photographer.name} loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {hasSearched && results.length === 0 && !loading && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-[11px] text-muted-foreground">Nenhuma imagem encontrada.</p>
        </div>
      )}

      {results.length > 0 && results.length % 12 === 0 && (
        <Button
          variant="outline" size="sm" className="w-full h-8 text-xs"
          onClick={() => runSearch(page + 1, true)}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ver mais"}
        </Button>
      )}

      <div className="pt-2 border-t border-border/50">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Não gostou?</p>
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/5">1 crédito</Badge>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={openAiDialog}
          disabled={typeof regenerationCredits === "number" && regenerationCredits <= 0}
          className="gap-2 w-full h-8 text-xs"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Gerar imagem por IA
        </Button>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          Custo: 1 crédito de regeneração
          {typeof regenerationCredits === "number" && ` · saldo: ${regenerationCredits}`}
        </p>
      </div>

      {/* Janela 1 — Descrição do que gerar */}
      <Dialog
        open={aiPromptOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAiPromptOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar imagem por IA</DialogTitle>
            <DialogDescription>
              Descreva o que você quer ver. Custo: 1 crédito de regeneração.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="ex: paisagem minimalista com tons quentes ao pôr do sol"
              className="text-sm"
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={closeAiDialog}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={goToStyleStep}
              disabled={!aiPrompt.trim()}
              className="gap-2"
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Janela 2 — Seleção de estilo visual */}
      <Dialog
        open={aiStyleOpen}
        onOpenChange={(open) => {
          if (generatingAI) return;
          if (!open) {
            setAiStyleOpen(false);
            setSelectedAiStyle(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Escolha o estilo visual</DialogTitle>
            <DialogDescription>
              O estilo orienta a estética da imagem gerada. Selecione um para continuar.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 min-h-0 -mx-1 px-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 py-2">
              {AI_STYLE_OPTIONS.map((opt) => {
                const isSelected = selectedAiStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedAiStyle(opt.id)}
                    className={`group text-left rounded-lg border-2 transition-all p-3 space-y-2 ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 bg-card"
                    }`}
                  >
                    <div
                      className="w-full h-24 rounded-md overflow-hidden relative flex items-end p-2"
                      style={{ background: opt.previewGradient }}
                    >
                      <div className="space-y-1 w-full">
                        <div
                          className="h-1.5 w-3/4 rounded"
                          style={{ background: opt.accent, opacity: 0.85 }}
                        />
                        <div
                          className="h-1.5 w-1/2 rounded"
                          style={{ background: opt.accent, opacity: 0.55 }}
                        />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm leading-tight">{opt.label}</span>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">{opt.blurb}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between shrink-0 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={backToPromptStep}
              disabled={generatingAI}
              className="gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </Button>
            <Button
              size="sm"
              onClick={handleAIConfirm}
              disabled={generatingAI || !selectedAiStyle}
              className="gap-2"
            >
              {generatingAI ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Gerar (1 crédito)</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageGalleryPanel;
