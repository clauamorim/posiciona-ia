## Causa raiz confirmada nos logs

```
Primeira tentativa do Gemini falhou: Tempo limite excedido na chamada à IA (status 504)
Http: connection closed before message completed
```

A combinação **geração Gemini + sanitização + retry** dentro de uma única invocação síncrona estoura o limite de execução da Edge Function (~150s). As otimizações anteriores (modelo mais rápido, retry cirúrgico, AbortController) reduziram o problema mas não o eliminaram — soluções síncronas estão no limite do orçamento de tempo.

A única correção definitiva é **desacoplar a chamada HTTP do processamento pesado**: o frontend dispara um job, recebe um `jobId` em <2s, e faz polling até a conclusão. O processamento pesado roda em background e pode levar 2–3 minutos sem fechar conexão.

---

## Etapa 1 — Schema (migration)

Criar tabela `content_generation_jobs`:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | identificador do job |
| `user_id` | uuid | dono (RLS) |
| `report_id` | uuid | relatório alvo |
| `week_index` | integer | semana sendo gerada |
| `status` | text | `queued` / `processing` / `completed` / `failed` |
| `progress_message` | text | mensagem em PT exibida ao usuário |
| `payload` | jsonb | input para o worker (contexto, modo free/paid) |
| `result` | jsonb | semana gerada (após sucesso) |
| `error_message` | text | erro amigável em PT |
| `attempts` | integer default 0 | contador de tentativas do worker |
| `created_at`, `updated_at`, `started_at`, `finished_at` | timestamptz | rastreamento |

RLS:
- Usuário lê/insere apenas os próprios jobs (`auth.uid() = user_id`).
- Admin lê todos.
- Worker usa service-role (ignora RLS).

Index em `(status, created_at)` para o worker pegar jobs `queued` mais antigos.

---

## Etapa 2 — `supabase/functions/generate-content-week/index.ts` vira **enqueuer**

Refatorar para responder em **<2s**:
1. Validar JWT, ler `user_id`, `report_id`, `week_index`, `mode` (`paid` | `free_outdated`).
2. Validar saldo (`weekly_cycles` ≥ 1 quando `mode = paid`) — sem debitar ainda.
3. Validar contexto mínimo (StoryBrand + tom de voz existem no relatório).
4. Inserir linha em `content_generation_jobs` com `status = queued` e `payload` carregando o que o worker precisa.
5. Devolver `{ jobId, status: "queued" }`.

**Não chama Gemini, não sanitiza, não debita crédito.**

---

## Etapa 3 — Novo worker `supabase/functions/process-content-generation-job/index.ts`

Função invocada em background. Responsabilidades:
1. Marcar job como `processing`, `started_at = now()`, `progress_message = "Carregando contexto…"`.
2. Carregar relatório, contexto e PDFs (whitelist `storybrand`, `madetostick`, `obviouslyawesome` — preserva comportamento atual).
3. Atualizar `progress_message = "Gerando seus 7 posts…"` e chamar Gemini (`google/gemini-3-flash-preview`) com `AbortController` de 120s.
4. Sanitizar resposta com `sanitizeWeek` + `countWeekLeaks`.
5. Se houver leaks, fazer retry **cirúrgico** (apenas dias afetados, em paralelo) com timeout de 60s.
6. Persistir semana em `reports.editorial_weeks` (substituindo a posição da semana correspondente).
7. Debitar 1 `weekly_cycles` em `user_balances` (somente em `mode = paid`).
8. Marcar `status = completed`, `result = <semana sanitizada>`, `finished_at = now()`.
9. Em qualquer erro: `status = failed`, `error_message` em PT amigável, sem debitar crédito.

A função pode ser disparada de duas formas (qual usar é decisão de implementação):
- **(a)** O enqueuer faz `fetch(workerUrl)` com `EdgeRuntime.waitUntil(...)` (fire-and-forget) imediatamente após criar o job — latência mínima, sem cron.
- **(b)** Cron `pg_cron` a cada 30s pegando jobs `queued` mais antigos.

Recomendação: **(a)** como caminho principal e **(b)** como fallback de segurança (pega jobs órfãos de processos que morreram).

---

## Etapa 4 — Endpoint de status `supabase/functions/get-content-generation-job/index.ts`

GET leve, autenticado, parâmetro `?jobId=…`. Retorna:
```json
{
  "status": "queued|processing|completed|failed",
  "progress_message": "Gerando seus 7 posts…",
  "result": null | { ...semana... },
  "error_message": null | "..."
}
```
RLS garante que só o dono vê. Resposta em <500ms.

---

## Etapa 5 — `src/pages/EditorialPage.tsx`

1. **Manter o rótulo do botão "+7 dias"** (preferência explícita do usuário).
2. Refatorar `handleGenerateWeek` e `handleRegenerateWeekFree`:
   - Chamar `generate-content-week` → recebe `jobId`.
   - Iniciar polling de `get-content-generation-job` a cada **3s** (timeout total de 4 minutos).
   - Atualizar UI com `progress_message` retornado pelo worker (ex.: "Gerando seus 7 posts…", "Refinando linguagem…").
   - Em `completed`: atualizar `editorial_weeks` no estado local, recarregar saldo (`refreshSubscription`), toast de sucesso.
   - Em `failed`: toast com `error_message` amigável.
   - Em timeout do polling: toast "A geração ainda está em andamento. Recarregue a página em alguns instantes para ver o resultado."
3. Botão fica em estado loading durante todo o polling (não re-clicável).
4. Limpar polling no `useEffect` de unmount.

---

## Etapa 6 — Deploy

Deploy de:
- `generate-content-week` (refatorado)
- `process-content-generation-job` (novo)
- `get-content-generation-job` (novo)

E migration da nova tabela.

---

## Garantias preservadas

- PDFs enviados continuam restritos à whitelist `storybrand` / `madetostick` / `obviouslyawesome`.
- Sanitização anti-vazamento de framework (`editorialSanitize.ts`) continua aplicada.
- Versionamento `EDITORIAL_GENERATOR_VERSION` continua marcado em cada dia.
- Crédito só é debitado após sucesso (regra atual mantida).
- RLS: usuário só vê os próprios jobs.

## Fora de escopo

- Realtime (Supabase Realtime channel) — polling de 3s é suficiente e mais simples para esta UX. Pode ser uma evolução futura.
- Mudar rótulo do botão (proibido pelo usuário).
- Refatorar `regenerate-single-post` (post único é rápido e não dá timeout — fica como está).
