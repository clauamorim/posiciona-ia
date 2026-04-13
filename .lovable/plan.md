

## Plano: Atualização da Lógica Comercial Completa

### Resumo
Atualizar textos dos planos, implementar upgrade com abatimento, extras com preço por plano, cupons, semana extra de conteúdo, e preparar price_ids para Stripe — tudo reaproveitando a estrutura existente.

---

### 1. Criar Prices Novos no Stripe (ferramenta Stripe)

Os produtos já existem. Precisamos criar novos prices para os extras com preço variável por plano e para a semana extra:

**Retratos (prices por plano):**
| Pack | Semana (atual) | Presença | Autoridade |
|------|------|----------|------------|
| Mini (5) | R$ 69 ✅ já existe | R$ 64 | R$ 59 |
| Pro (10) | R$ 119 ✅ já existe | R$ 109 | R$ 99 |
| Max (15) | R$ 169 ✅ já existe | R$ 154 | R$ 139 |

→ 6 novos prices vinculados aos 3 produtos de retrato existentes.

**Semana extra de conteúdo — novo produto + 3 prices:**
| Plano | Preço |
|-------|-------|
| Semana de Conteúdo | R$ 87 |
| Presença Mensal | R$ 77 |
| Autoridade Total | R$ 67 |

→ 1 novo produto + 3 prices.

**Upgrade com abatimento — 2 prices one-time:**
| Upgrade | Valor |
|---------|-------|
| Semana → Presença | R$ 100 |
| Semana → Autoridade | R$ 300 |

→ 2 novos prices vinculados aos produtos Presença Mensal e Autoridade Total.

**Cupons Stripe — 2 cupons:**
- `POSICIONA20` — 20% off, duration "once"
- `POSICIONA50` — 50% off, duration "once"

### 2. Migração mínima do banco

Adicionar na tabela `portrait_packs`:
- coluna `stripe_price_ids jsonb DEFAULT '{}'` — mapa `{semana_conteudo: "price_...", presenca_mensal: "price_...", autoridade_total: "price_..."}` para guardar price_id por plano.

Nenhuma tabela nova. Nenhuma outra alteração de schema.

A configuração dos extras (semana extra + upgrades) ficará centralizada num mapa de configuração dentro da edge function — sem tabela, pois são poucos itens fixos.

### 3. Edge Functions

**a) `stripe-checkout` — atualizar:**
- Aceitar campo opcional `coupon_code` no body
- Para planos recorrentes, se `coupon_code` informado, buscar o cupom no Stripe via `stripe.coupons.retrieve()` ou usar `discounts` na sessão
- Passar `allow_promotion_codes: true` ou `discounts: [{ coupon }]` na sessão

**b) `portrait-pack-checkout` — atualizar:**
- Em vez de usar `pack.stripe_price_id` fixo, consultar o plano ativo do usuário
- Escolher o `stripe_price_id` correto do mapa `pack.stripe_price_ids[plan_slug]` (fallback para `pack.stripe_price_id` padrão)

**c) Nova edge function `extras-checkout`:**
- Aceita `{ type: "semana_extra" }`
- Consulta plano ativo do usuário
- Escolhe price_id correto de um mapa hardcoded
- Cria sessão Stripe payment
- Metadata: `{ type: "semana_extra", user_id, plan_slug }`

**d) Nova edge function `upgrade-checkout`:**
- Aceita `{ target_plan: "presenca_mensal" | "autoridade_total" }`
- Verifica plano atual = semana_conteudo
- Verifica se está dentro de 7 dias da compra (via `subscriptions.created_at`)
- Se dentro de 7 dias: usa price de upgrade (R$100 ou R$300), mode=payment
- Se fora de 7 dias: usa price normal do plano alvo, mode=subscription
- Para Presença→Autoridade: usa Stripe Subscription Update com proration (não cria nova sessão)
- Metadata: `{ type: "upgrade", user_id, from_plan, to_plan }`

**e) `stripe-webhook` — atualizar:**
- Adicionar handler para `type: "semana_extra"` → incrementar `weekly_cycles` em +1
- Adicionar handler para `type: "upgrade"` → atualizar subscription com novo plan_id, reprovisionar balances
- Na renovação (`invoice.paid`) do Autoridade Total: garantir que adiciona 5 retratos e 20 regenerações mensalmente (já funciona via provisionBalances, mas conferir que não zera extras)
- **Corrigir `provisionBalances`**: não sobrescrever `portrait_credits_extra` (créditos avulsos devem ser mantidos)

### 4. Frontend

**a) `ChoosePlan.tsx` — reescrever textos:**
- Atualizar features, descriptions e footer conforme a nova copy
- Adicionar campo de cupom (input + botão "Aplicar") apenas para planos recorrentes
- Passar `coupon_code` ao `stripe-checkout`
- Se usuário já tem plano ativo, mostrar opções de upgrade em vez de compra

**b) `LandingPage.tsx` — atualizar textos dos planos:**
- Mesma nova copy, mesmas features

**c) `Dashboard.tsx` — adicionar seção de upgrade:**
- Se plano = semana_conteudo, mostrar card de upgrade com valor e CTA
- Se plano = presenca_mensal, mostrar opção de upgrade para Autoridade Total

**d) `PortraitGenerator.tsx` — atualizar diálogo de compra de packs:**
- Exibir preço correto conforme plano ativo (badge "preço especial do seu plano")
- Manter os mesmos cards visuais

**e) Novo componente `ExtrasSection.tsx`:**
- Seção reutilizável para Dashboard ou página dedicada
- Cards: packs de retrato + semana extra de conteúdo
- Preço mostrado conforme plano ativo do usuário (buscar do backend, não hardcoded no frontend)
- Badge "preço especial" quando plano >= presença_mensal

### 5. Arquivos editados/criados

| Arquivo | Ação |
|---------|------|
| `src/pages/ChoosePlan.tsx` | Atualizar textos + campo cupom + lógica upgrade |
| `src/pages/LandingPage.tsx` | Atualizar textos dos planos |
| `src/pages/Dashboard.tsx` | Adicionar seção upgrade + extras |
| `src/pages/PortraitGenerator.tsx` | Preço dinâmico nos packs |
| `src/components/ExtrasSection.tsx` | Novo — cards de extras reutilizável |
| `supabase/functions/stripe-checkout/index.ts` | Suporte a cupom |
| `supabase/functions/portrait-pack-checkout/index.ts` | Price por plano |
| `supabase/functions/extras-checkout/index.ts` | Novo — semana extra |
| `supabase/functions/upgrade-checkout/index.ts` | Novo — lógica de upgrade |
| `supabase/functions/stripe-webhook/index.ts` | Handlers para extras/upgrade/renovação |
| Migração SQL | Adicionar `stripe_price_ids` à `portrait_packs` |

### Observações
- Nenhuma tabela nova criada
- Price_ids reais serão inseridos via migração SQL e criados via ferramenta Stripe
- Frontend nunca decide preço — sempre consulta backend
- Cupons só nos planos recorrentes
- Créditos avulsos (extras) nunca são zerados na renovação

