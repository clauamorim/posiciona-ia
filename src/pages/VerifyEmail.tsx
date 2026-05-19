import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const RESEND_COOLDOWN = 60;
const POLL_INTERVAL = 5000;

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const email = searchParams.get("email") || user?.email || "";

  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const cooldownRef = useRef<number | null>(null);

  // Cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => {
      if (cooldownRef.current) window.clearTimeout(cooldownRef.current);
    };
  }, [cooldown]);

  // Polling for email verification
  useEffect(() => {
    let cancelled = false;
    const interval = window.setInterval(async () => {
      if (cancelled) return;
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user?.email_confirmed_at) {
          cancelled = true;
          window.clearInterval(interval);
          toast.success("E-mail confirmado! Redirecionando...");
          navigate("/complete-profile", { replace: true });
        }
      } catch {
        /* ignore */
      }
    }, POLL_INTERVAL);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [navigate]);

  const handleResend = async () => {
    if (!email || cooldown > 0 || resending) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) {
        if (error.message?.toLowerCase().includes("rate")) {
          toast.error("Aguarde um momento antes de tentar novamente.");
        } else {
          toast.error(error.message || "Não foi possível reenviar o e-mail.");
        }
      } else {
        toast.success("E-mail reenviado. Confira sua caixa de entrada.");
        setCooldown(RESEND_COOLDOWN);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao reenviar e-mail.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout>
      <div className="text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">Verifique seu e-mail</h1>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            {email ? (
              <>
                Enviamos um link de confirmação para{" "}
                <strong className="text-foreground break-all">{email}</strong>.
              </>
            ) : (
              <>Enviamos um link de confirmação para seu e-mail.</>
            )}
            <br />
            Acesse sua caixa de entrada e clique no link para ativar sua conta.
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Não encontrou? Verifique também a pasta de spam.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="text-sm text-muted-foreground">
            Não recebeu?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={!email || cooldown > 0 || resending}
              className="underline text-foreground hover:text-primary disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
            >
              {cooldown > 0
                ? `Reenviar em ${cooldown}s`
                : resending
                ? "Reenviando..."
                : "Reenviar e-mail"}
            </button>
          </div>

          <Button variant="outline" onClick={() => navigate("/")}>
            Voltar para a página inicial
          </Button>
        </div>

        <div className="text-xs text-muted-foreground flex items-center justify-center gap-2 flex-wrap">
          <span>Abrir caixa:</span>
          <a
            href="https://mail.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground underline-offset-2 hover:underline"
          >
            Gmail
          </a>
          <span aria-hidden>·</span>
          <a
            href="https://outlook.live.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground underline-offset-2 hover:underline"
          >
            Outlook
          </a>
          <span aria-hidden>·</span>
          <a
            href="https://mail.yahoo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground underline-offset-2 hover:underline"
          >
            Yahoo
          </a>
        </div>

        <div className="pt-8 text-left space-y-3 text-xs text-muted-foreground">
          <details className="group">
            <summary className="cursor-pointer font-medium text-foreground/80 hover:text-foreground">
              Não recebi o e-mail. E agora?
            </summary>
            <p className="mt-2 leading-relaxed">
              Aguarde 1-2 minutos e verifique a pasta de spam. Se ainda assim não chegar, use
              "Reenviar e-mail" ou entre em contato:{" "}
              <a
                href="mailto:contato@posiciona.ia.br"
                className="underline hover:text-foreground"
              >
                contato@posiciona.ia.br
              </a>
              .
            </p>
          </details>
          <details className="group">
            <summary className="cursor-pointer font-medium text-foreground/80 hover:text-foreground">
              Digitei o e-mail errado.
            </summary>
            <p className="mt-2 leading-relaxed">
              Clique em "Voltar para a página inicial" e refaça o cadastro com o e-mail correto.
            </p>
          </details>
        </div>

        <div className="pt-4">
          <Link
            to="/login"
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Já confirmou? Fazer login
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmail;
