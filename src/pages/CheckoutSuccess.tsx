import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { SeoHead } from "@/components/SeoHead";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

const CheckoutSuccess = () => {
  const { user, refreshSubscription } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  const goToDashboard = async () => {
    // O checkout redireciona pra cá antes do webhook da Stripe necessariamente
    // ter terminado de provisionar o plano/créditos — sem isso o dashboard
    // mostra estado antigo até a pessoa dar refresh manual.
    await refreshSubscription();
    navigate("/dashboard");
  };

  useEffect(() => {
    // Melhor esforço logo na entrada — o refresh de verdade acontece de novo
    // antes de navegar, dando mais tempo pro webhook processar.
    refreshSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;

    const dedupeKey = `purchase_event_sent_${sessionId}`;
    if (localStorage.getItem(dedupeKey)) return;

    supabase.functions
      .invoke("checkout-session-details", { body: { session_id: sessionId } })
      .then(({ data, error }) => {
        if (error || data?.error) {
          console.error("checkout-session-details error:", error ?? data?.error);
          return;
        }
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: "purchase",
          transaction_id: data.transaction_id,
          value: data.value,
          currency: data.currency,
          email: data.email,
          name: data.name,
        });
        localStorage.setItem(dedupeKey, "1");
      });
  }, [searchParams]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          goToDashboard();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <SeoHead title="Pagamento confirmado · Posiciona" description="Seu plano foi ativado." path="/checkout-success" />
      <div className="min-h-dvh bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Pagamento confirmado!</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Seu plano foi ativado com sucesso. Você já pode acessar o dashboard e começar seu diagnóstico inicial.
            </p>
          </div>
          <Button className="gap-2" onClick={goToDashboard}>
            Ir para o Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground">
            Redirecionando em {countdown}s...
          </p>
        </CardContent>
      </Card>
    </div>
    </>

  );
};

export default CheckoutSuccess;
