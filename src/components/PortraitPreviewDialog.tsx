import { useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortraitPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portraits: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onDownload?: (url: string, index: number) => void | Promise<void>;
  downloading?: boolean;
  downloadHint?: string;
  downloadLabel?: string;
}

export const PortraitPreviewDialog = ({
  open,
  onOpenChange,
  portraits,
  index,
  onIndexChange,
  onDownload,
  downloading,
  downloadHint,
  downloadLabel = "Baixar",
}: PortraitPreviewDialogProps) => {
  const total = portraits.length;
  const current = portraits[index];
  const hasMultiple = total > 1;

  const goPrev = () => onIndexChange((index - 1 + total) % total);
  const goNext = () => onIndexChange((index + 1) % total);

  useEffect(() => {
    if (!open || !hasMultiple) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasMultiple, index, total]);

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-card border-border p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Pré-visualização do retrato</DialogTitle>

        <div className="relative bg-muted/40 p-6 sm:p-8">
          <img
            src={current}
            alt={`Retrato ${index + 1}`}
            className="max-h-[75vh] w-auto mx-auto object-contain rounded-lg shadow-lg"
          />

          {hasMultiple && (
            <>
              <button
                onClick={goPrev}
                aria-label="Anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 border border-border backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={goNext}
                aria-label="Próximo"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 border border-border backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-card">
          <div className="text-xs text-muted-foreground">
            {hasMultiple && <span className="mr-3">{index + 1} de {total}</span>}
            {downloadHint && <span>{downloadHint}</span>}
          </div>
          <div className={cn("flex items-center gap-2")}>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {onDownload && (
              <Button
                size="sm"
                onClick={() => onDownload(current, index)}
                disabled={downloading}
                className="gap-2"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloading ? "Salvando..." : downloadLabel}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
