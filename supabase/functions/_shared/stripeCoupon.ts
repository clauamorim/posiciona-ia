import Stripe from "https://esm.sh/stripe@18.5.0";

// Cupom é resolvido pelo NOME visível (não pelo ID interno) — mesmo padrão
// já usado em stripe-checkout. Lança erro se um código foi informado mas
// não existe ou não está mais válido; retorna undefined se nada foi
// informado (compra segue sem desconto).
export async function resolveCouponId(
  stripe: Stripe,
  couponCode: string | undefined | null,
): Promise<string | undefined> {
  const code = (couponCode || "").trim();
  if (!code) return undefined;

  const coupons = await stripe.coupons.list({ limit: 100 });
  const coupon = coupons.data.find(
    (c) => c.name?.toUpperCase() === code.toUpperCase() && c.valid,
  );
  if (!coupon) throw new Error("Cupom inválido ou expirado");
  return coupon.id;
}
