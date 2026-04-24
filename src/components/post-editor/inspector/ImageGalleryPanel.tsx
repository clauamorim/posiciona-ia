import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Sparkles, Image as ImageIcon } from "lucide-react";
import { fetchImageGallery, generateAIImage, type PhotographerInfo } from "@/lib/postAutoLayout";
import { signedUserUploadUrl } from "@/lib/userGalleryUrl";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ImageGalleryPanelProps {
  defaultQuery: string;
  format: "square" | "portrait";
  /** Chamado quando usuário escolhe imagem; recebe URL, info do fotógrafo (Unsplash) e opcionalmente fonte ("ai" / "unsplash" / "saved"). */
  onPickImage: (url: string, photographer?: PhotographerInfo, source?: "ai" | "unsplash" | "saved") => void;
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

  // Saved images (Unsplash/AI/upload from this user's gallery, photo-only context)
  const [savedImages, setSavedImages] = useState<Array<{ url: string; name: string; source: string }>>([]);

  // AI prompt dialog
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(defaultQuery);
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
      const list = await fetchImageGallery({
        query: query.trim(), format, page: p,
        niche, businessContext, caption, body: postBody,
      });
      setResults(prev => append ? [...prev, ...list] : list);
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
    if (!aiPrompt.trim()) return;
    // Validação de saldo antes da chamada
    if (typeof regenerationCredits === "number" && regenerationCredits <= 0) {
      toast({
        title: "Sem créditos de regeneração",
        description: "Compre mais créditos para gerar imagens por IA.",
        variant: "destructive",
      });
      setAiPromptOpen(false);
      return;
    }
    setGeneratingAI(true);
    try {
      const result = await generateAIImage({
        query: aiPrompt.trim(), format,
        niche, businessContext, caption, body: postBody,
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
      setAiPromptOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao gerar IA", description: err?.message || "Nenhum crédito foi debitado.", variant: "destructive" });
    } finally {
      setGeneratingAI(false);
    }
  };

  return (
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
                {item.source !== "upload" && (
                  <span className="absolute bottom-0.5 right-0.5 px-1 py-px rounded bg-background/80 text-[8px] font-semibold uppercase tracking-wider text-foreground/70">
                    {item.source === "ai" ? "IA" : "UN"}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Buscar no Unsplash</p>
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
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {results.map((item, i) => (
            <button
              key={`${item.url}-${i}`}
              onClick={() => onPickImage(item.url, item.photographer, "unsplash")}
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
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Não gostou?</p>
        <Button
          variant="outline" size="sm"
          onClick={() => setAiPromptOpen(true)}
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

      <AlertDialog open={aiPromptOpen} onOpenChange={setAiPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar imagem por IA</AlertDialogTitle>
            <AlertDialogDescription>
              Descreva o que você quer ver. Custo: 1 crédito de regeneração.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="ex: paisagem minimalista com tons quentes ao pôr do sol"
              className="text-sm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generatingAI}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleAIConfirm(); }}
              disabled={generatingAI || !aiPrompt.trim()}
            >
              {generatingAI ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Gerando…</> : "Gerar (1 crédito)"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ImageGalleryPanel;
