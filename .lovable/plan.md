

# Plano: Corrigir validação de cupom no checkout

## Problema
O código usa `stripe.coupons.retrieve(coupon_code)` que espera o **ID do cupom** (ex: `suTWUv7R`), mas o usuário digita o **nome** (ex: `POSICIONA50`). Isso causa erro no Stripe.

## Solução
Alterar `supabase/functions/stripe-checkout/index.ts` para buscar cupons por nome usando `stripe.coupons.list()` e encontrar o cupom correspondente.

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/stripe-checkout/index.ts` | Substituir `stripe.coupons.retrieve()` por `stripe.coupons.list()` + filtro por nome |

### Trecho a alterar (linhas ~72-82)

**Antes:**
```typescript
const coupon = await stripe.coupons.retrieve(coupon_code);
if (coupon && coupon.valid) {
  sessionParams.discounts = [{ coupon: coupon.id }];
}
```

**Depois:**
```typescript
const coupons = await stripe.coupons.list({ limit: 100 });
const coupon = coupons.data.find(
  (c) => c.name?.toUpperCase() === coupon_code.toUpperCase() && c.valid
);
if (coupon) {
  sessionParams.discounts = [{ coupon: coupon.id }];
} else {
  throw new Error("Cupom inválido ou expirado");
}
```

