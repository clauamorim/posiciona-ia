import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const DISMISS_KEY = "posiciona-readonly-banner-dismissed";

export const ReadOnlyBanner = () => {
  const { isReadOnly, expirationReason } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  if (!isReadOnly || dismissed) return null;

  const handleDismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  const isExpired = expirationReason === "subscription_expired";
  const message = isExpired
    ? "Sua assinatura está vencida. Atualize seu cartão para retomar o acesso."
    : "Sua semana de conteúdo foi entregue. Você está em modo leitura.";
  const linkLabel = isExpired ? "Atualizar pagamento" : "Continuar produzindo";

  return (
    <div className="bg-warning/10 border-b border-warning/30 px-4 py-2.5 flex items-center gap-3 text-sm">
      <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
      <p className="flex-1 text-foreground">
        <span>{message}</span>{" "}
        <Link to="/assinatura-expirada" className="font-semibold text-warning hover:underline">
          {linkLabel}
        </Link>
      </p>
      <button
        onClick={handleDismiss}
        aria-label="Dispensar aviso"
        className="text-muted-foreground hover:text-foreground p-1 -m-1"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
