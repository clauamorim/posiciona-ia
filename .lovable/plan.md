## Mudanças em `supabase/functions/fetch-market-trends/index.ts`

**1. Modelo**
- `const MODEL = "claude-sonnet-4-5"` → `"claude-sonnet-4-6"`.

**2. Cache persistido (substitui `new Map()`)**

Nova tabela via migration:
```sql
CREATE TABLE public.market_trends_cache (
  key text PRIMARY KEY,
  trends jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.market_trends_cache ENABLE ROW LEVEL SECURITY;
-- Sem políticas públicas: somente service_role (edge function) acessa.
CREATE INDEX idx_market_trends_cache_expires ON public.market_trends_cache(expires_at);
```

Sem RLS pública — a edge function usa `SUPABASE_SERVICE_ROLE_KEY`, que faz bypass. Isso mantém o cache invisível para clientes.

**3. Lógica na edge function**
- Remover `cache: Map`, `CacheEntry`, `TTL_MS` em ms (passa a usar timestamp).
- Criar client Supabase com service role no topo.
- Antes de chamar Claude: `select trends, expires_at from market_trends_cache where key = ? and expires_at > now()`. Se hit → retornar `{ trends, cached: true }`.
- Após `fetchTrends`: `upsert` em `market_trends_cache` com `key`, `trends`, `expires_at = now() + 24h`. Falha de upsert é logada mas não quebra a resposta.
- TTL continua 24h.

**Observação**: cache só é gravado quando `trends.length > 0`, para não "cravar" array vazio por 24h em caso de falha pontual da Claude. (Ou gravar sempre — me diga se prefere.)

Nada além desses 2 arquivos é tocado (migration + index.ts). Sem mudanças de versão, sem mudanças no fluxo de geração.