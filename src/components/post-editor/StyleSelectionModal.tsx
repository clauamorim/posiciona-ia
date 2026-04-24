import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Image as ImageIcon, Palette, Loader2, Check } from "lucide-react";
import { fetchBackgroundImage, type PostStyle } from "@/lib/postAutoLayout";

interface StyleSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: string;
  caption?: string;
  format: "square" | "portrait";
  /** Cores da paleta para preview do estilo minimalista (hex). */
  paletteHex: string[];
  niche?: string;
  businessContext?: string;
  onChoose: (style: PostStyle | null) => void;
}

const StyleSelectionModal: React.FC<StyleSelectionModalProps> = ({
  open, onOpenChange, theme, caption, format, paletteHex, niche, businessContext, onChoose,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selected, setSelected] = useState<PostStyle | null>(null);

  // Pré-busca preview do Unsplash em background
  useEffect(() => {
    if (!open || previewUrl) return;
    setLoadingPreview(true);
    fetchBackgroundImage({ theme, caption, format, allowAI: false, niche, businessContext })
      .then(r => { if (r) setPreviewUrl(r.url); })
      .finally(() => setLoadingPreview(false));
  }, [open, theme, caption, format, previewUrl, niche, businessContext]);

  const c1 = paletteHex[0] || "#7c3aed";
  const c2 = paletteHex[1] || c1;
  const minimalGradient = `linear-gradient(135deg, ${c1}, ${c2})`;

  const handleConfirm = () => {
    if (!selected) return;
    onChoose(selected);
    onOpenChange(false);
  };

  const handleSkip = () => {
    onChoose(null);
    onOpenChange(false);
  };

  const previewSize = format === "portrait"
    ? "h-32 sm:h-auto sm:aspect-[9/16]"
    : "h-28 sm:h-auto sm:aspect-square";

  const cards: Array<{
    id: PostStyle; title: string; subtitle: string; cost: string; icon: React.ReactNode;
    preview: React.ReactNode;
  }> = [
    {
      id: "minimal",
      title: "Minimalista",
      subtitle: "Fundo degradê da sua paleta. Logo + tipografia.",
      cost: "Grátis",
      icon: <Palette className="h-4 w-4" />,
      preview: (
        <div className={`w-full ${previewSize} rounded-md overflow-hidden`} style={{ background: minimalGradient }}>
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-white/90">
            <div className="w-10 h-10 rounded-full bg-white/20 mb-3" />
            <div className="h-2 w-3/4 bg-white/30 rounded mb-1.5" />
            <div className="h-2 w-1/2 bg-white/20 rounded" />
          </div>
        </div>
      ),
    },
    {
      id: "unsplash",
      title: "Com foto (Unsplash)",
      subtitle: "Foto profissional relacionada ao tema.",
      cost: "Grátis",
      icon: <ImageIcon className="h-4 w-4" />,
      preview: (
        <div className={`w-full ${previewSize} rounded-md overflow-hidden bg-muted relative`}>
          {loadingPreview ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : previewUrl ? (
            <img src={previewUrl} alt="Preview Unsplash" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
              Sem preview
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
            <div className="w-full">
              <div className="h-2 w-3/4 bg-white/80 rounded mb-1" />
              <div className="h-2 w-1/2 bg-white/60 rounded" />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "ai",
      title: "Com foto IA",
      subtitle: "Imagem única gerada para seu tema.",
      cost: "1 crédito de regeneração",
      icon: <Sparkles className="h-4 w-4" />,
      preview: (
        <div className={`w-full ${previewSize} rounded-md overflow-hidden relative`}
          style={{ background: `linear-gradient(135deg, ${c1}40, ${c2}80, #00000080)` }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90">
            <Sparkles className="h-8 w-8 mb-2 opacity-70" />
            <span className="text-[11px] uppercase tracking-widest opacity-70">Gerar por IA</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Escolha o estilo do post</DialogTitle>
          <DialogDescription>
            Tudo continua editável depois — texto, cores, posições e imagens.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 -mx-1 px-1">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2">
          {cards.map(card => {
            const isSelected = selected === card.id;
            return (
              <button
                key={card.id}
                onClick={() => setSelected(card.id)}
                className={`group text-left rounded-lg border-2 transition-all p-3 space-y-2 ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 bg-card"
                }`}
              >
                {card.preview}
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {card.icon}
                      <span className="font-semibold text-sm">{card.title}</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{card.subtitle}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">{card.cost}</p>
                </div>
              </button>
            );
          })}
        </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between shrink-0">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Pular e abrir editor vazio
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!selected} className="gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Abrir com este estilo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StyleSelectionModal;
