import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Calendar, Camera, Loader2, ShoppingCart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import PreCheckoutModal from "@/components/PreCheckoutModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SEMANA_EXTRA_LABELS: Record<string, string> = {
  semana_conteudo: "R$ 87",
  presenca_mensal: "R$ 77",
  autoridade_total: "R$ 67",
};

const SEMANA_EXTRA_PRICES: Record<string, string> = {
  semana_conteudo: "87",
  presenca_mensal: "77",
  autoridade_total: "67",
};

interface PreCheckoutState {
  type: "semana_extra" | "portrait_pack";
  name: string;
  price: string;
  packId?: string;
}

const ExtrasSection = () => {
  const { user, subscription } = useAuth();
  const [loadingSemana, setLoadingSemana] = useState(false);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [preCheckout, setPreCheckout] = useState<PreCheckoutState | null>(null);

  const planSlug = subscription?.plan_slug || "semana_conteudo";
  const hasDiscount = planSlug !== "semana_conteudo";

  const { data: packs } = useQuery({
    queryKey: ["portrait-packs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("portrait_packs")
        .select("*")
        .eq("active", true)
        .order("credits", { ascending: true });
      return data || [];
    },
  });

  const handleBuySemanaExtra = async () => {
    setLoadingSemana(true);
    try {
      const { data, error } = await supabase.functions.invoke("extras-checkout", {
        body: { type: "semana_extra" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setLoadingSemana(false);
  };

  const handleBuyPack = async (packId: string) => {
    setLoadingPack(packId);
    try {
      const { data, error } = await supabase.functions.invoke("portrait-pack-checkout", {
        body: { pack_id: packId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setLoadingPack(null);
  };

  const handlePreCheckoutConfirm = () => {
    if (!preCheckout) return;
    if (preCheckout.type === "semana_extra") {
      handleBuySemanaExtra();
    } else if (preCheckout.type === "portrait_pack" && preCheckout.packId) {
      handleBuyPack(preCheckout.packId);
    }
  };

  const getPackPrice = (pack: any) => {
    if (pack.stripe_price_ids && typeof pack.stripe_price_ids === "object") {
      const tierPrices: Record<string, number> = {
        semana_conteudo: pack.price_cents,
      };
      if (pack.credits === 5) {
        tierPrices.presenca_mensal = 6400;
        tierPrices.autoridade_total = 5900;
      } else if (pack.credits === 10) {
        tierPrices.presenca_mensal = 10900;
        tierPrices.autoridade_total = 9900;
      } else if (pack.credits === 15) {
        tierPrices.presenca_mensal = 15400;
        tierPrices.autoridade_total = 13900;
      }
      return tierPrices[planSlug] || pack.price_cents;
    }
    return pack.price_cents;
  };

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Extras disponíveis</p>

      {/* Semana Extra */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Semana Extra de Conteúdo</p>
              <p className="text-xs text-muted-foreground">+1 ciclo editorial de 7 dias</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="font-bold text-sm">{SEMANA_EXTRA_LABELS[planSlug] || "R$ 87"}</span>
              {hasDiscount && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="ml-2 text-[10px] cursor-help">Preço especial</Badge>
                    </TooltipTrigger>
                    <TooltipContent>Desconto exclusivo do seu plano atual.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Button
              size="sm"
              onClick={() =>
                setPreCheckout({
                  type: "semana_extra",
                  name: "Semana Extra de Conteúdo",
                  price: SEMANA_EXTRA_PRICES[planSlug] || "87",
                })
              }
              disabled={loadingSemana}
            >
              {loadingSemana ? <Loader2 className="h-4 w-4 animate-spin" /> : "Comprar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Portrait Packs */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(packs || []).map((pack: any) => {
          const priceCents = getPackPrice(pack);
          const showDiscount = hasDiscount && priceCents < pack.price_cents;
          const priceStr = (priceCents / 100).toFixed(0);
          return (
            <Card key={pack.id}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold text-sm">{pack.name}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{pack.credits} retratos</p>
                  <p className="text-[10px] text-muted-foreground/70">Cada retrato é 1 imagem editorial gerada pela IA.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">R$ {priceStr}</span>
                  {showDiscount && (
                    <>
                      <span className="text-xs text-muted-foreground line-through">R$ {(pack.price_cents / 100).toFixed(0)}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="text-[10px] cursor-help">Especial</Badge>
                          </TooltipTrigger>
                          <TooltipContent>Desconto exclusivo do seu plano atual.</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    setPreCheckout({
                      type: "portrait_pack",
                      name: pack.name,
                      price: priceStr,
                      packId: pack.id,
                    })
                  }
                  disabled={loadingPack === pack.id}
                >
                  {loadingPack === pack.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Comprar</>}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pre-checkout modal for extras */}
      {preCheckout && (
        <PreCheckoutModal
          open={!!preCheckout}
          onOpenChange={(v) => { if (!v) setPreCheckout(null); }}
          productName={preCheckout.name}
          price={preCheckout.price}
          billingType="one_time"
          description={
            preCheckout.type === "semana_extra"
              ? "+1 ciclo editorial de 7 dias"
              : undefined
          }
          onConfirm={handlePreCheckoutConfirm}
          loading={loadingSemana || !!loadingPack}
        />
      )}
    </div>
  );
};

export default ExtrasSection;
