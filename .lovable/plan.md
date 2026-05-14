
## Objetivo
Evitar que a mesma tendência de mercado (ex: "Havaianas vs Pé Direito") apareça em semanas consecutivas, replicando o padrão já existente do `used_personal_traits`.

## Mudança 1 — Migration SQL (nova tabela)

Criar `public.used_market_trends`:
- Colunas: `id`, `user_id` (FK auth.users ON DELETE CASCADE), `report_id` (FK reports ON DELETE CASCADE), `week_index`, `trends_used` (JSONB), `created_at`.
- Índice: `(user_id, created_at DESC)`.
- RLS habilitado:
  - SELECT: `auth.uid() = user_id`
  - ALL para service_role.

## Mudança 2 — `supabase/functions/process-content-generation-job/index.ts`

**2a)** Após `fetchRecentlyUsedTraits`, adicionar `fetchRecentlyUsedTrendTitles(userId)` que lê as últimas 2 entradas de `used_market_trends`, achata e deduplica títulos.

**2b)** Após `detectUsedTraits`, adicionar `detectUsedTrends(trends, feed, stories)`: heurística que normaliza corpus (theme/caption/script/card_copy do feed + theme/frames dos stories) e marca uma trend como usada se 2+ palavras-chave (≥4 chars, sem stopwords PT) do título aparecem no corpus.

**2c)** Antes de `renderMarketTrendsBlock(marketTrends)`, filtrar `marketTrends` removendo títulos que casam (substring bidirecional normalizada) com `recentlyUsedTrendTitles`. Logar quantas foram filtradas. Renderizar o bloco com `filteredMarketTrends`.

**2d)** Logo após o try/catch que persiste `used_personal_traits`, adicionar try/catch que chama `detectUsedTrends(filteredMarketTrends, feedFinal, storiesFinal)` e insere em `used_market_trends` (`user_id`, `report_id`, `week_index`, `trends_used`). Falhas são apenas logadas.

## Validação
- Confirmar nomes exatos (`admin`, `userId`, `job.report_id`, `job.week_index`, `feedFinal`, `storiesFinal`, `normalize`, `PT_STOPWORDS`, `MarketTrend`) com `code--view` antes de editar.
- Deploy de `process-content-generation-job` após a migration ser aprovada.

## Efeito esperado
- Semana N+1 não recebe mais as tendências usadas nas 2 semanas anteriores.
- Se sobrarem poucas/nenhuma tendência, o fallback já implementado em `renderMarketTrendsBlock` instrui o LLM a usar caso real nomeado do conhecimento.
- Mesmo padrão arquitetural de `used_personal_traits` (já validado na rotação de traços pessoais).
