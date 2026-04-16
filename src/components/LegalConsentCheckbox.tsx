import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface LegalConsentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  variant?: "signup" | "checkout";
  error?: string;
}

const LegalConsentCheckbox = ({ checked, onCheckedChange, variant = "signup", error }: LegalConsentCheckboxProps) => {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2.5">
        <Checkbox
          id="legal-consent"
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5"
        />
        <Label htmlFor="legal-consent" className="text-xs leading-relaxed text-muted-foreground cursor-pointer select-none">
          {variant === "signup" ? (
            <>
              Ao criar sua conta no Posiciona, você concorda com os{" "}
              <Link to="/termos-de-servico" target="_blank" className="text-gold hover:text-gold-hover underline underline-offset-2">
                Termos de Serviço
              </Link>{" "}
              e com a{" "}
              <Link to="/politica-de-privacidade" target="_blank" className="text-gold hover:text-gold-hover underline underline-offset-2">
                Política de Privacidade
              </Link>.
            </>
          ) : (
            <>
              Ao concluir a assinatura, você concorda com os{" "}
              <Link to="/termos-de-servico" target="_blank" className="text-gold hover:text-gold-hover underline underline-offset-2">
                Termos de Serviço
              </Link>, a{" "}
              <Link to="/politica-de-privacidade" target="_blank" className="text-gold hover:text-gold-hover underline underline-offset-2">
                Política de Privacidade
              </Link>{" "}
              e as condições do plano selecionado.
            </>
          )}
        </Label>
      </div>
      {error && (
        <p className="text-xs text-destructive pl-6">{error}</p>
      )}
    </div>
  );
};

export default LegalConsentCheckbox;
