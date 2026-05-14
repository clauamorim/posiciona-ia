import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, ShoppingBag, History } from "lucide-react";

const SubscriptionExpired = () => {
  const { expirationReason } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const openPortal = async () => {
    setLoading("portal");
    try {
      const { data, error } = await supabase.functions.invoke("stripe-customer-portal");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("URL do portal não retornada");
    } catch (e: any) {
      toast({
        title: "Não foi possível abrir o portal",
        description: e?.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const startCheckout = async (planSlug: string) => {
    setLoading(planSlug);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { plan_slug: planSlug },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast({
        title: "Não foi possível iniciar o checkout",
        description: e?.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const isExpired = expirationReason === "subscription_expired";

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 py-4">
        {isExpired ? (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">
                Sua assinatura está vencida
              </h1>
              <p className="text-muted-foreground">
                O último pagamento não foi processado. Atualize seu cartão para retomar o acesso.
              </p>
            </div>
            <Card>
              <CardContent className="py-6 space-y-4">
                <Button onClick={openPortal} disabled={loading === "portal"} className="w-full gap-2">
                  {loading === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Atualizar pagamento
                </Button>
                <Link to="/history" className="block text-sm text-center text-muted-foreground hover:text-foreground">
                  Ver meus conteúdos gerados
                </Link>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">
                Sua semana de conteúdo foi entregue
              </h1>
              <p className="text-muted-foreground">
                Você continua com acesso de leitura ao que foi gerado. Quer continuar produzindo com estratégia?
              </p>
            </div>
            <Card>
              <CardContent className="py-6 space-y-3">
                <Button
                  onClick={() => startCheckout("semana_conteudo")}
                  disabled={loading !== null}
                  className="w-full gap-2"
                >
                  {loading === "semana_conteudo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
                  Comprar mais 1 semana de conteúdo (R$197)
                </Button>
                <Button
                  onClick={() => startCheckout("presenca_mensal")}
                  disabled={loading !== null}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {loading === "presenca_mensal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Assinar Presença Mensal (R$297/mês)
                </Button>
                <Link to="/history" className="block text-sm text-center text-muted-foreground hover:text-foreground pt-1">
                  <History className="h-3.5 w-3.5 inline mr-1" />
                  Ver meus conteúdos gerados
                </Link>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SubscriptionExpired;
