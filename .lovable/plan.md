

# Pre-Checkout Flow and Legal Alignment

## Current State
- `ChoosePlan.tsx` has plan cards with a global `LegalConsentCheckbox` and coupon input at the top, but clicking a plan button immediately redirects to Stripe -- there is no intermediary summary/confirmation step.
- `ExtrasSection.tsx` (semana extra, portrait packs) also redirects directly to Stripe with no confirmation.
- The `LegalConsentCheckbox` component already exists and is reusable.
- Three edge functions handle Stripe checkout: `stripe-checkout`, `extras-checkout`, `portrait-pack-checkout`.

## Plan

### 1. Create `PreCheckoutModal` component
A new reusable dialog/drawer component (`src/components/PreCheckoutModal.tsx`) that opens **before** any Stripe redirect. It receives:
- `productName`, `price`, `description`, `billingType` ("one_time" | "recurring"), `period` (e.g. "/mes"), `onConfirm`, `onCancel`, `loading`

The modal displays:
- **"Resumo da contratacao"** heading (serif font)
- Product name, value (R$), billing type label, renewal info, cancellation info
- Institutional text block: "Plano recorrente com renovacao automatica ate cancelamento, quando aplicavel. Ao prosseguir, voce concorda com os Termos de Servico e a Politica de Privacidade do Posiciona." (with links opening in new tab)
- For one-time products: adjusted text without renewal mention
- `LegalConsentCheckbox` with validation (reuse existing component)
- Subtle trust line: "Pagamento processado com seguranca pela Stripe." in `#A09CC0`
- CTA button: "Continuar para pagamento"
- Dark theme styling consistent with the app

### 2. Integrate in `ChoosePlan.tsx`
- Remove the global `LegalConsentCheckbox` and `checkoutConsent` state from the page level
- When user clicks a plan button, instead of calling `handleCheckout` directly, open `PreCheckoutModal` with the selected plan's details
- The modal's `onConfirm` triggers the existing `handleCheckout`/`handleUpgrade` logic
- Same for upgrade flow

### 3. Integrate in `ExtrasSection.tsx`
- When user clicks "Comprar" on Semana Extra or Portrait Pack, open `PreCheckoutModal` with the product details (one-time billing)
- The modal's `onConfirm` triggers the existing checkout functions

### 4. Edge Function: Add `custom_text` to Stripe sessions
In `stripe-checkout/index.ts`, `extras-checkout/index.ts`, and `portrait-pack-checkout/index.ts`, add a short `custom_text.terms_of_service_acceptance` or `custom_text.submit` message to the Stripe Checkout session params. Keep it minimal, e.g.:
```
custom_text: {
  submit: { message: "Pagamento processado pela Stripe. Termos e privacidade em posiciona.ia.br" }
}
```
Also add `consent_collection.terms_of_service: "required"` with the Stripe session pointing to the Posiciona URLs. This requires setting the URLs in Stripe's account settings (documented via code comments).

### 5. Code comments for Stripe Dashboard config
Add clear comments in the edge functions noting that the following must be configured in Stripe Dashboard (Settings > Public details):
- Terms of Service URL: `https://posiciona.ia.br/termos-de-servico`
- Privacy Policy URL: `https://posiciona.ia.br/politica-de-privacidade`
- Support email: `contato@posiciona.ia.br`

### Files changed
- **New**: `src/components/PreCheckoutModal.tsx`
- **Edit**: `src/pages/ChoosePlan.tsx` -- integrate modal, remove page-level consent
- **Edit**: `src/components/ExtrasSection.tsx` -- integrate modal
- **Edit**: `supabase/functions/stripe-checkout/index.ts` -- add `custom_text`
- **Edit**: `supabase/functions/extras-checkout/index.ts` -- add `custom_text`
- **Edit**: `supabase/functions/portrait-pack-checkout/index.ts` -- add `custom_text`

