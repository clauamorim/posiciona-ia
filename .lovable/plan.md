

## Plano de Implementação — Correções e Novas Funcionalidades

Este plano aborda os 10 problemas/funcionalidades solicitados:

---

### 1. Botão "Entrar" na Landing Page aparece e desaparece

**Problema**: O `useAuth()` retorna `user` como `null` durante o carregamento inicial, mas brevemente pode flickar entre estados. O nav na LandingPage renderiza "Entrar" ou "Dashboard" com base em `user`, mas durante `isLoading` o estado é indefinido.

**Correção**: Adicionar verificação de `isLoading` no nav da LandingPage — mostrar skeleton/nada enquanto carrega, depois mostrar os botões corretos.

**Arquivo**: `src/pages/LandingPage.tsx` (nav section, ~5 linhas)

---

### 2. Erro na geração de retratos

**Problema**: O `PortraitGenerator` não valida créditos de retrato antes de gerar. Além disso, o `generate-portrait` edge function gera 5 retratos sequencialmente, o que pode causar timeout ou rate limiting.

**Correção**:
- No frontend (`PortraitGenerator.tsx`): verificar `balances.portrait_credits_included + portrait_credits_extra > 0` antes de permitir geração. Cada geração consome 1 crédito de retrato (incluso primeiro, depois extra).
- No edge function (`generate-portrait/index.ts`): gerar **1 retrato por chamada** (não 5), usando 1 estilo aleatório. Isso evita timeout e permite controle granular de créditos.
- Atualizar `user_balances` e registrar em `credit_logs` a cada geração.

**Arquivos**: `src/pages/PortraitGenerator.tsx`, `supabase/functions/generate-portrait/index.ts`

---

### 3. Dados do usuário somem após algum tempo de login

**Problema**: O token de autenticação expira e o `onAuthStateChange` dispara com `session = null`, zerando tudo. O `autoRefreshToken` está habilitado no client, então o token deveria renovar automaticamente. Provavelmente o `onAuthStateChange` recebe `TOKEN_REFRESHED` e recarrega tudo, mas se falhar silenciosamente, os dados somem.

**Correção**: No `AuthContext.tsx`, tratar o evento `TOKEN_REFRESHED` e `SIGNED_OUT` explicitamente. Se a sessão vier null num evento que não seja SIGNED_OUT, tentar `getSession()` antes de zerar tudo. Adicionar try/catch nas chamadas de loadSubscription/loadBalances para não crashar silenciosamente.

**Arquivo**: `src/contexts/AuthContext.tsx`

---

### 4. Checkout fica "Processando" mas não abre a página de pagamento

**Problema**: O `supabase.functions.invoke()` retorna o URL no `data`, mas se houver erro no edge function (ex: CORS, autenticação), o erro não é capturado corretamente. Além disso, `window.open` com popup blocker pode falhar silenciosamente.

**Correção**:
- Mudar de `window.open(data.url, "_blank")` para `window.location.href = data.url` (redireciona na mesma aba, evita popup blocker).
- Adicionar melhor tratamento de erro: verificar `data?.error` explicitamente.
- Aplicar mesma correção no `ChoosePlan.tsx` e `LandingPage.tsx`.

**Arquivos**: `src/pages/LandingPage.tsx`, `src/pages/ChoosePlan.tsx`

---

### 5. Todos os planos permitem criação de retratos (devem ser bloqueados sem crédito)

**Correção**: No `PortraitGenerator.tsx`, verificar `balances.portrait_credits_included + portrait_credits_extra > 0` antes de permitir gerar. Mostrar mensagem clara quando não há créditos, com link para comprar pacotes extras.

**Arquivo**: `src/pages/PortraitGenerator.tsx`

---

### 6. Download em PDF na análise do perfil (Instagram)

**Correção**: Adicionar botão "Baixar PDF" nos resultados da análise do Instagram. Usar jsPDF para gerar PDF formatado com os 7 aspectos analisados (situação atual + sugestão).

**Arquivo**: `src/pages/InstagramAnalysis.tsx`

---

### 7. Adicionar análise do Instagram em "Análises" (histórico)

**Correção**: Criar tabela `instagram_analyses` para salvar análises. Adicionar seção no HistoryPage mostrando análises salvas. Atualizar sidebar "Análises" se necessário.

**Migração**: Nova tabela `instagram_analyses` (user_id, username, analysis jsonb, created_at) com RLS.

**Arquivos**: `src/pages/InstagramAnalysis.tsx`, `src/pages/HistoryPage.tsx`, migração SQL

---

### 8. Salvar análise do perfil e retratos gerados

**Correção**:
- **Análise Instagram**: salvar automaticamente na tabela `instagram_analyses` após geração bem-sucedida.
- **Retratos**: Criar tabela `portrait_generations` (user_id, portraits jsonb, created_at) com RLS. Salvar automaticamente após geração. Adicionar seção no HistoryPage.

**Migração**: Tabelas `instagram_analyses` e `portrait_generations`.

**Arquivos**: `src/pages/InstagramAnalysis.tsx`, `src/pages/PortraitGenerator.tsx`, `src/pages/HistoryPage.tsx`

---

### 9. Implementar venda de pacotes de retrato

**Produtos Stripe a criar**:
- Pack Retrato Mini: 5 retratos, R$ 69
- Pack Retrato Pro: 10 retratos, R$ 119
- Pack Retrato Max: 15 retratos, R$ 169

**Implementação**:
1. Criar 3 produtos + preços no Stripe (via ferramenta)
2. Criar tabela `portrait_packs` (id, name, credits, stripe_price_id, price_cents, active)
3. Criar edge function `portrait-pack-checkout` para iniciar checkout Stripe com mode: "payment"
4. Atualizar `stripe-webhook` para tratar compra de pacote: ao receber `checkout.session.completed` com metadata `type: portrait_pack`, somar créditos em `user_balances.portrait_credits_extra`
5. Criar página/dialog de compra de pacotes extras acessível do Dashboard e do PortraitGenerator
6. No Dashboard: mostrar saldo de retratos inclusos e extras separadamente + botão "Comprar mais retratos"

**Arquivos**: Nova edge function, atualizar `stripe-webhook/index.ts`, `src/pages/PortraitGenerator.tsx`, `src/pages/Dashboard.tsx`, migração SQL

---

### 10. Consumo correto de créditos de retrato (inclusos primeiro, extras depois)

**Correção**: Na lógica de geração de retrato (frontend ou edge function), consumir `portrait_credits_included` primeiro. Quando chegar a 0, consumir `portrait_credits_extra`. Cada retrato gerado = 1 crédito.

**Arquivo**: `src/pages/PortraitGenerator.tsx` e/ou `supabase/functions/generate-portrait/index.ts`

---

### Resumo de Migrações Necessárias

```sql
-- Tabela para salvar análises do Instagram
CREATE TABLE public.instagram_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text,
  analysis jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instagram_analyses ENABLE ROW LEVEL SECURITY;
-- RLS policies (user sees own, admin sees all)

-- Tabela para salvar retratos gerados
CREATE TABLE public.portrait_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  portraits jsonb NOT NULL DEFAULT '[]',
  style_index integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portrait_generations ENABLE ROW LEVEL SECURITY;
-- RLS policies

-- Tabela para pacotes de retrato
CREATE TABLE public.portrait_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL,
  price_cents integer NOT NULL,
  stripe_price_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portrait_packs ENABLE ROW LEVEL SECURITY;
-- SELECT policy for authenticated
```

### Produtos Stripe a Criar
- Pack Retrato Mini (5 retratos, R$ 6900 centavos, one_time)
- Pack Retrato Pro (10 retratos, R$ 11900 centavos, one_time)
- Pack Retrato Max (15 retratos, R$ 16900 centavos, one_time)

### Arquivos Modificados
- `src/contexts/AuthContext.tsx` — robustez no refresh de sessão
- `src/pages/LandingPage.tsx` — fix nav flicker + checkout redirect
- `src/pages/ChoosePlan.tsx` — checkout redirect fix
- `src/pages/PortraitGenerator.tsx` — validação de créditos, salvamento, compra de pacotes
- `src/pages/InstagramAnalysis.tsx` — salvamento + download PDF
- `src/pages/HistoryPage.tsx` — mostrar análises e retratos salvos
- `src/pages/Dashboard.tsx` — saldo separado inclusos/extras + botão comprar
- `supabase/functions/generate-portrait/index.ts` — gerar 1 retrato por vez
- `supabase/functions/stripe-webhook/index.ts` — tratar compra de pacote
- Nova edge function: `supabase/functions/portrait-pack-checkout/index.ts`
- 1 migração SQL (3 tabelas)

