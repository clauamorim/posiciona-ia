

# Camada Comercial do ArcheBrand — Plano de Implementação

Este é um projeto grande que será implementado em fases sequenciais para evitar quebrar o app existente.

---

## Análise da Estrutura Atual

**Tabelas existentes reutilizáveis:**
- `profiles` — dados do usuário (já tem `is_blocked`)
- `user_credits` — saldo de créditos (atualmente genérico, `balance` integer)
- `user_roles` — RBAC (admin/user)
- `business_questionnaires` — tem `is_complete` boolean (expandiremos com status draft/submitted/locked)
- `reports` — conteúdo estratégico + editorial_weeks
- `archetype_answers`, `archetype_scores`, `user_top_archetypes` — cálculos de arquétipos

**O que será preservado intacto:** toda a lógica interna dos módulos (questionários, arquétipos, StoryBrand, Instagram, editorial, retratos, posts).

---

## Fase 1: Banco de Dados — Novas Tabelas e Colunas

### Nova tabela: `plans`
Define os 3 planos disponíveis.

| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| name | text (ex: "Semana de Conteúdo") |
| slug | text unique (semana_conteudo, presenca_mensal, autoridade_total) |
| price_cents | integer |
| billing_type | text (one_time, monthly) |
| weekly_cycles | integer (1, 4, 4) |
| reanalysis_credits | integer (0, 1, 2) |
| portrait_credits | integer (0, 0, 5) |
| regeneration_credits | integer (3, 12, 20) |
| stripe_price_id | text nullable |
| active | boolean default true |

### Nova tabela: `subscriptions`
Vínculo do usuário com o plano ativo.

| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| user_id | uuid NOT NULL |
| plan_id | uuid FK → plans |
| stripe_customer_id | text nullable |
| stripe_subscription_id | text nullable |
| status | text (active, canceled, past_due, trialing) |
| current_period_start | timestamptz |
| current_period_end | timestamptz |
| created_at / updated_at | timestamptz |

### Nova tabela: `user_balances`
Saldos granulares do usuário (substitui a lógica genérica de `user_credits`).

| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| user_id | uuid NOT NULL unique |
| weekly_cycles | integer default 0 |
| reanalysis_credits | integer default 0 |
| portrait_credits_included | integer default 0 |
| portrait_credits_extra | integer default 0 |
| regeneration_credits | integer default 0 |
| updated_at | timestamptz |

### Nova tabela: `credit_logs`
Histórico de movimentações.

| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| user_id | uuid NOT NULL |
| credit_type | text (weekly_cycle, reanalysis, portrait, regeneration, portrait_extra) |
| amount | integer (positivo=adição, negativo=consumo) |
| description | text |
| created_at | timestamptz |

### Alteração na tabela `business_questionnaires`
- Adicionar coluna `status` text default 'draft' (valores: draft, submitted, locked)
- Manter `is_complete` para compatibilidade

### RLS em todas as novas tabelas
- `plans`: SELECT para todos autenticados
- `subscriptions`: SELECT/INSERT/UPDATE own, admin SELECT/UPDATE all
- `user_balances`: SELECT own, admin SELECT/UPDATE all
- `credit_logs`: SELECT own, admin SELECT all, INSERT via edge function (service role)

---

## Fase 2: Integração Stripe

### Pré-requisito
Ativar Stripe via ferramenta `stripe--enable` (cria produtos, preços e edge functions de checkout/webhook).

### Edge function: `stripe-checkout`
- Recebe `{ plan_slug }` + auth do usuário
- Cria/recupera `stripe_customer_id`
- Cria sessão de checkout (one-time para semana_conteudo, subscription para os outros)
- Retorna URL do checkout

### Edge function: `stripe-webhook`
- Recebe eventos `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated/deleted`
- No `checkout.session.completed`: cria/atualiza `subscriptions`, provisiona saldos em `user_balances`
- No `invoice.paid` (renovação mensal): re-provisiona saldos mensais
- No `customer.subscription.deleted`: marca subscription como canceled

### Página: `src/pages/CheckoutSuccess.tsx`
- Página de sucesso pós-pagamento
- Verifica se a subscription foi criada
- Redireciona para dashboard

---

## Fase 3: Landing Page

### Arquivo: `src/pages/LandingPage.tsx`
Página pública, sem DashboardLayout, com:

1. **Hero**: headline + subtítulo + CTA → "/pricing" ou scroll para planos
2. **Como Funciona**: 7 etapas visuais com ícones
3. **Benefícios**: 5 cards (clareza, coerência, conteúdo, agilidade, constância)
4. **Planos**: 3 cards com preço, features, CTA de checkout
5. **FAQ**: accordion com 5 perguntas

### Rota `/` → LandingPage (público)
- Se logado com plano ativo → redirect para `/dashboard`
- A rota `/` atual vira a landing; o redirect para dashboard muda para lógica condicional

### Arquivo: `src/pages/PricingPage.tsx`
Seção de planos separada (também acessível como standalone)

---

## Fase 4: Controle de Acesso

### AuthContext expandido
Adicionar ao contexto:
- `subscription: { plan_slug, status, balances }` 
- `hasActivePlan: boolean`

### ProtectedRoute expandido
- Nova prop `requirePlan?: boolean`
- Se `requirePlan` e sem plano ativo → redirect para `/pricing`

### Aplicar `requirePlan` nas rotas:
- `/business-questionnaire`, `/archetype-questionnaire`, `/results`, `/storybrand`, `/report`, `/editorial`, `/instagram-analysis`, `/portraits`, `/history`, `/post-editor`

### Página: `src/pages/ChoosePlan.tsx`
- Mostrada quando o usuário está autenticado mas sem plano
- Cards dos 3 planos com CTA de checkout

---

## Fase 5: Bloqueios e Regras de Uso

### Questionários (BusinessQuestionnaire.tsx)
- Carregar `status` (draft/submitted/locked)
- Se `locked`: campos readonly, botões de edição desabilitados
- Ao clicar "Finalizar": status → submitted
- Após geração do StoryBrand: status → locked
- Admin pode chamar edge function para destravar

### StoryBrand (StoryBrand.tsx + BusinessQuestionnaire.tsx)
- Botão "Gerar StoryBrand" consome 1 crédito de reanálise (exceto na primeira vez)
- Verificar saldo antes; mostrar aviso de consumo
- Se saldo = 0: botão disabled + mensagem "Compre créditos"

### Linha Editorial (EditorialPage.tsx)
- Trocar `user_credits.balance` por `user_balances.weekly_cycles`
- Cada semana consome 1 weekly_cycle
- Sem saldo → botão disabled

### Retratos (PortraitGenerator.tsx + generate-portrait edge function)
- Verificar `portrait_credits_included + portrait_credits_extra`
- Consumir incluídos primeiro, depois extras
- Sem créditos → bloquear + CTA para comprar
- Edge function valida saldo antes de gerar

### Posts / Regeneração
- Contar regenerações; consumir `regeneration_credits`
- Sem saldo → bloquear regeneração

---

## Fase 6: Diretriz Estética dos Retratos

### `generate-portrait/index.ts` — Atualizar prompt
Substituir o prompt atual por diretriz realista:
- "Professional, realistic photographic portrait"
- "Sophisticated, modern, elegant, contemporary"
- "Subtle translation of archetypes through: posture, expression, body language, lighting, framing, color palette, visual texture, refined wardrobe styling"
- "Do NOT create caricatures, fantasy, cosplay, theatrical costumes, obvious thematic accessories, stereotyped objects, or literal archetype interpretation"
- "The image must look like a real professional photoshoot, not AI-generated art"

---

## Fase 7: Dashboard Atualizado

### `src/pages/Dashboard.tsx`
Adicionar cards:
- Plano atual + status da assinatura
- Saldos: ciclos semanais, reanálises, retratos (incluídos + extras), regenerações
- Status dos questionários (draft/submitted/locked)
- Status dos arquétipos e StoryBrand
- Botão upgrade de plano
- Botão comprar créditos extras

---

## Fase 8: Painel Admin Expandido

### `src/pages/admin/AdminUsers.tsx`
Expandir para mostrar/editar por usuário:
- Plano ativo + status
- Todos os saldos (editar manualmente)
- Destravar questionários
- Liberar nova geração StoryBrand
- Resetar saldos

### `src/pages/admin/AdminCreditLogs.tsx` (nova página)
- Visualizar logs de consumo (tabela `credit_logs`)
- Filtros por usuário, tipo, data

---

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar plans, subscriptions, user_balances, credit_logs, adicionar status a business_questionnaires, RLS |
| `src/pages/LandingPage.tsx` | Criar — landing pública |
| `src/pages/PricingPage.tsx` | Criar — planos e preços |
| `src/pages/CheckoutSuccess.tsx` | Criar — pós-pagamento |
| `src/pages/ChoosePlan.tsx` | Criar — escolha de plano para logados sem plano |
| `src/contexts/AuthContext.tsx` | Expandir — subscription + balances |
| `src/components/ProtectedRoute.tsx` | Expandir — requirePlan |
| `src/App.tsx` | Adicionar rotas |
| `src/pages/Dashboard.tsx` | Expandir — plano, saldos, status |
| `src/pages/BusinessQuestionnaire.tsx` | Adicionar lógica de lock |
| `src/pages/EditorialPage.tsx` | Trocar créditos por weekly_cycles |
| `src/pages/PortraitGenerator.tsx` | Adicionar verificação de créditos de retrato |
| `supabase/functions/generate-portrait/index.ts` | Validar saldo + atualizar prompt estético |
| `src/pages/admin/AdminUsers.tsx` | Expandir — plano, saldos, destravar |
| `src/pages/admin/AdminCreditLogs.tsx` | Criar — logs de consumo |
| `src/components/DashboardLayout.tsx` | Ajustar navegação |
| Stripe edge functions | Criar via integração Stripe |

---

## Ordem de Execução

Dado o tamanho, a implementação será feita em várias mensagens na seguinte ordem:

1. **Stripe + DB**: Ativar Stripe, criar tabelas, inserir dados dos planos, criar edge functions de checkout/webhook
2. **Landing + Pricing + Checkout Success**: Páginas públicas
3. **Auth + Acesso**: Expandir AuthContext, ProtectedRoute, ChoosePlan
4. **Bloqueios + Créditos**: Questionários, StoryBrand, editorial, retratos, posts
5. **Dashboard + Admin**: Expandir dashboard e painel admin
6. **Prompt dos retratos**: Atualizar diretriz estética

