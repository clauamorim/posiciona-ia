import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import LegalConsentCheckbox from "@/components/LegalConsentCheckbox";

interface PreCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  price: string;
  description?: string;
  billingType: "one_time" | "recurring";
  period?: string;
  onConfirm: () => void;
  loading?: boolean;
}

const PreCheckoutModal = ({
  open,
  onOpenChange,
  productName,
  price,
  description,
  billingType,
  period,
  onConfirm,
  loading,
}: PreCheckoutModalProps) => {
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState("");

  const handleConfirm = () => {
    if (!consent) {
      setConsentError(
        "Você precisa concordar com os Termos de Serviço e a Política de Privacidade para continuar."
      );
      return;
    }
    setConsentError("");
    onConfirm();
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setConsent(false);
      setConsentError("");
    }
    onOpenChange(v);
  };

  const isRecurring = billingType === "recurring";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Resumo da contratação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-sm">{productName}</span>
              <span className="font-bold text-lg">R$ {price}</span>
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                <span className="font-medium text-foreground/80">Cobrança:</span>{" "}
                {isRecurring ? `Recorrente${period ? ` (${period})` : ""}` : "Pagamento único"}
              </p>
              {isRecurring && (
                <>
                  <p>
                    <span className="font-medium text-foreground/80">Renovação:</span>{" "}
                    Automática até cancelamento
                  </p>
                  <p>
                    <span className="font-medium text-foreground/80">Cancelamento:</span>{" "}
                    A qualquer momento, sem multa
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Institutional text */}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isRecurring
              ? "Plano recorrente com renovação automática até cancelamento. "
              : ""}
            Ao prosseguir, você concorda com os{" "}
            <Link
              to="/termos-de-servico"
              target="_blank"
              className="text-gold hover:text-gold-hover underline underline-offset-2"
            >
              Termos de Serviço
            </Link>{" "}
            e a{" "}
            <Link
              to="/politica-de-privacidade"
              target="_blank"
              className="text-gold hover:text-gold-hover underline underline-offset-2"
            >
              Política de Privacidade
            </Link>{" "}
            do Posiciona.
          </p>

          {/* Legal consent */}
          <LegalConsentCheckbox
            checked={consent}
            onCheckedChange={(v) => {
              setConsent(v);
              if (v) setConsentError("");
            }}
            variant="checkout"
            error={consentError}
          />

          {/* Trust line */}
          <div className="flex items-center gap-1.5 justify-center">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              Pagamento processado com segurança pela Stripe.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processando...
              </>
            ) : (
              "Continuar para pagamento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PreCheckoutModal;
