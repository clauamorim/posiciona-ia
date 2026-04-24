## Causa raiz
Logs confirmam: `Framework leaks detected (7) → retry com prompt estrito → Http: connection closed before message completed`. A combinação serial (geração + retry da semana inteira) estoura o tempo limite da Edge Function.

## Etapa 1 — `supabase/functions/generate-content-week/index.ts`
1. Trocar modelo de `google/gemini-2.5-flash` para `google/gemini-3-flash-preview` (mais rápido).
2. Retry anti-vazamento cirúrgico: regenerar somente os dias com leaks (não a semana inteira).
3. Adicionar `AbortController` com timeout explícito (90s principal, 45s retry).
4. Reduzir `max_tokens` de 8000 para 6000.

## Etapa 2 — `src/pages/EditorialPage.tsx`
1. Mostrar progresso textual durante a espera ("Gerando seus 7 posts… pode levar até 2 minutos").
2. Tratar 504 / "connection closed" / "Failed to fetch" com mensagem específica em português.
3. Garantir que toasts de erro usem `data?.error` da Edge Function.

## Deploy
Redeploy de `generate-content-week`.

## Fora de escopo
Arquitetura assíncrona (fila + polling/Realtime) — só se o problema persistir após as etapas 1 e 2.
