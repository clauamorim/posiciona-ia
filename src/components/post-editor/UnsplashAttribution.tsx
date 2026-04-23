import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import type { PhotographerInfo } from "@/lib/postAutoLayout";

interface UnsplashAttributionProps {
  photographer: PhotographerInfo | null;
  onDismiss: () => void;
  /** ms até auto-dismiss. Default 5000. */
  autoDismissMs?: number;
}

/**
 * Banner discreto exibindo crédito ao fotógrafo do Unsplash.
 * Auto-dismiss em 5s; também pode ser fechado manualmente.
 * Aparece no canto inferior direito da tela.
 */
const UnsplashAttribution: React.FC<UnsplashAttributionProps> = ({
  photographer, onDismiss, autoDismissMs = 5000,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 250);
    }, autoDismissMs);
    return () => clearTimeout(t);
  }, [photographer, autoDismissMs, onDismiss]);

  if (!photographer) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-[200] transition-all duration-200 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 max-w-sm rounded-lg border border-border bg-card text-card-foreground shadow-lg px-3 py-2.5">
        <div className="flex-1 text-xs leading-relaxed">
          <span className="text-muted-foreground">Foto por </span>
          <a
            href={photographer.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline-offset-2 hover:underline text-foreground"
          >
            {photographer.name}
          </a>
          <span className="text-muted-foreground"> em </span>
          <a
            href={photographer.unsplashUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline-offset-2 hover:underline text-foreground inline-flex items-center gap-0.5"
          >
            Unsplash <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onDismiss, 250);
          }}
          className="p-1 rounded hover:bg-muted transition-colors"
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

export default UnsplashAttribution;
