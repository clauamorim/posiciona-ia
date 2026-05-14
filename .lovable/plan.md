# Plano: Acesso read-only, comunicação de créditos, página de Conta e admin LGPD

Quatro partes em um único deploy. Aditivo — não toca em webhook, `consume_credit`, schema de plans/subscriptions/balances, nem nos fluxos de geração.

## Parte 1 — `hasActivePlan` correto + estado read-only

**`src/contexts/AuthContext.tsx`**
- `UserSubscription` ganha `billing_type: string | null`. `loadSubscription` passa a buscar `billing_type` no join com `plans`.
- Calcular `planAccessLevel: "full" | "read_only" | "none"`:
  - sem subscription ou status ≠ active → none
  - recorrente vencido (`current_period_end < now`) → read_only
  - one-time com `balances.weekly_cycles === 0` → read_only
  - caso contrário → full
- Derivar `hasActivePlan = planAccessLevel !== "none"`, `isReadOnly`, `expirationReason` ("subscription_expired" | "one_time_exhausted" | null). Expor os 3 no `AuthContextType` e no `value`.

**`src/components/ProtectedRoute.tsx`**
- Nova prop `requireFullAccess?: boolean`. Quando true e `isReadOnly`, redireciona para `/assinatura-expirada`.

**`src/pages/SubscriptionExpired.tsx` (nova, rota `/assinatura-expirada`)**
- Variante por `expirationReason`:
  - subscription_expired: CTA "Atualizar pagamento" → `stripe-customer-portal`. Link "Ver meus conteúdos gerados" → `/history`.
  - one_time_exhausted: CTAs "Comprar mais 1 semana de conteúdo" e "Assinar Presença Mensal" reaproveitando `stripe-checkout` por slug + link `/history`.
- Wrap em `DashboardLayout`.

**`src/App.tsx`**
- Rotas novas `/assinatura-expirada` e `/conta` (ambas requirePlan).
- `requireFullAccess` aplicado nas rotas (lista confirmada): `/business-questionnaire`, `/personal-questionnaire`, `/archetype-questionnaire`, `/sales-narrative`, `/sales-narrative-intro`, `/stories-de-venda`, `/post-editor`.
- Gating fino (botão, não rota) em `/editorial` e `/portraits`: usar `isReadOnly` para desabilitar os botões "Gerar semana" / "Gerar retrato" e mostrar tooltip "Disponível com assinatura ativa".

## Parte 2 — Banner persistente de read-only

**`src/components/DashboardLayout.tsx`**
- No topo do `<main>` (acima do header mobile), renderizar `<ReadOnlyBanner />` quando `isReadOnly`.
- Componente novo `src/components/ReadOnlyBanner.tsx`:
  - Variante por `expirationReason`.
  - subscription_expired: "Sua assinatura está vencida. Atualize seu cartão para retomar o acesso." + link "Atualizar pagamento" → `/assinatura-expirada`.
  - one_time_exhausted: "Sua semana de conteúdo foi entregue. Você está em modo leitura." + link "Continuar produzindo" → `/assinatura-expirada`.
  - Botão `X` que grava em `sessionStorage` (`posiciona-readonly-banner-dismissed`); reaparece a cada nova sessão.

## Parte 3 — Comunicação da política de créditos

**`src/pages/Dashboard.tsx`** — abaixo de cada linha de crédito de plano (`weekly_cycles`, `reanalysis_credits`, `regeneration_credits`, `portrait_credits_included`): "Renova em {data}. Créditos não usados expiram." (oculto quando one-time). Rodapé: "Créditos comprados separadamente (semanas avulsas, pacotes de retrato) não expiram."

**`src/pages/PortraitGenerator.tsx`** — no bloco "X inclusos · Y extras" adicionar tooltip/legenda: "Inclusos renovam mensalmente. Extras não expiram."

## Parte 4 — Página de Conta

**`src/pages/Conta.tsx` (nova)** + item "Conta" (`User`) no `DashboardLayout`, grupo "Conta", logo acima de "Plano e Créditos", href `/conta`.

Quatro seções:
1. **Seus dados** — email readonly + nota "contate o suporte"; profissão e nicho lidos de `profiles` com link "editar Diagnóstico" → `/business-questionnaire`.
2. **Segurança** — senha atual / nova / confirmar. Validar nova ≥ 8 chars e match. `signInWithPassword` para revalidar; em sucesso `auth.updateUser({ password })`. Toasts.
3. **Assinatura** — nome do plano, status (full/read-only/sem plano), próxima renovação formatada, "Gerenciar assinatura" → `stripe-customer-portal`.
4. **Zona de perigo** — botão vermelho "Excluir conta" → AlertDialog exigindo digitar `EXCLUIR`. Confirma → `delete-account-request`, `signOut()`, navigate `/` com toast LGPD (15 dias).

## Parte 5 — Edge functions

**`supabase/functions/stripe-customer-portal/index.ts`** — auth via JWT, busca subscription + `stripe_customer_id`, cria `billingPortal.sessions.create({ customer, return_url: origin + "/conta" })`, retorna `{ url }`. Comentário no topo: **"Requer Stripe Customer Portal ativado em Settings → Billing → Customer Portal → Activate. Sem isso a chamada falha em produção."**

**`supabase/functions/delete-account-request/index.ts`** — auth via JWT, lê email de `auth.users` (service role) + profession/niche de `profiles`. Insere em `account_deletion_requests`. Atualiza `profiles.account_deletion_requested_at = now()`. Comentário: "configurar envio de email para contato@posiciona.ia.br quando canal de email estiver disponível". Retorna `{ success: true }`.

## Parte 6 — Admin LGPD

**`src/pages/admin/AdminUsers.tsx` (ou novo `AdminDeletionRequests.tsx`)**
- Nova seção/card "Solicitações de exclusão de conta (LGPD)" listando `account_deletion_requests` ordenadas por `requested_at DESC` filtradas por user_id sem `deleted_at` (ou todas, com flag visual). Colunas: email, profession, niche, requested_at, user_id.
- Sidebar admin (`DashboardLayout` adminGroups): novo item "Exclusões LGPD" com badge mostrando contagem de pendentes (query simples ao montar layout para admins).

## Parte 7 — Migration

```sql
ALTER TABLE public.profiles
  ADD COLUMN account_deletion_requested_at timestamptz NULL;

CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  profession text,
  niche text,
  requested_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own deletion request"
  ON public.account_deletion_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own deletion request"
  ON public.account_deletion_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all deletion requests"
  ON public.account_deletion_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
```

## Arquivos

**Novos**: `src/pages/Conta.tsx`, `src/pages/SubscriptionExpired.tsx`, `src/components/ReadOnlyBanner.tsx`, `src/pages/admin/AdminDeletionRequests.tsx`, `supabase/functions/stripe-customer-portal/index.ts`, `supabase/functions/delete-account-request/index.ts`, 1 migration.

**Editados**: `src/contexts/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`, `src/App.tsx`, `src/components/DashboardLayout.tsx`, `src/pages/Dashboard.tsx`, `src/pages/PortraitGenerator.tsx`, `src/pages/EditorialPage.tsx` (gating do botão de geração).

## Pré-deploy obrigatório
**Stripe Customer Portal precisa ser ativado manualmente** em Settings → Billing → Customer Portal → Activate; senão "Gerenciar assinatura" e "Atualizar pagamento" falham em produção.

## Não alterar
Webhook Stripe, `consume_credit`, schemas existentes, fluxos de geração editorial / stories / retratos, sistema de questionários.
