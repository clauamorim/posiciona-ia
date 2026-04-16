

# Fix: Erro 500 no stripe-checkout

## Causa raiz
O parâmetro `consent_collection: { terms_of_service: "required" }` exige que a URL dos Termos de Serviço esteja configurada no Dashboard da Stripe (Settings > Public details). Como isso ainda não foi feito, a Stripe rejeita a criação da sessão.

## Solução

### 1. Remover `consent_collection` das edge functions
Remover o bloco `consent_collection: { terms_of_service: "required" }` de `stripe-checkout`, `extras-checkout` e `portrait-pack-checkout`. O aceite legal já é coletado no `PreCheckoutModal` antes do redirecionamento — não é necessário duplicar na Stripe.

Manter o `custom_text.submit` (mensagem curta informativa), pois esse campo funciona sem configuração extra no Dashboard.

### 2. Adicionar logging de erro
Adicionar `console.error` no catch das edge functions para facilitar debugging futuro nos logs.

### 3. Integrar PreCheckoutModal no upgrade
Atualmente o upgrade não passa pelo `PreCheckoutModal`. Integrar o modal também no fluxo de upgrade para consistência jurídica.

### Arquivos alterados
- `supabase/functions/stripe-checkout/index.ts` — remover `consent_collection`, adicionar logging
- `supabase/functions/extras-checkout/index.ts` — idem
- `supabase/functions/portrait-pack-checkout/index.ts` — idem
- `src/pages/ChoosePlan.tsx` — integrar PreCheckoutModal no fluxo de upgrade

