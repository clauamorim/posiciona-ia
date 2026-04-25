## Objetivo

Eliminar os 504 do `generate-report` e a cobrança duplicada do Claude (US$ 0,36 perdidos por geração que falha) migrando a função para o **mesmo padrão job/worker/polling** já usado e validado em `process-content-generation-job` (Linha Editorial).

---

## Causa raiz (confirmada nos logs)

- `generate-report` é **síncrono**: HTTP fica aberto enquanto Claude responde.
- Edge Function tem **timeout duro de 150s**. Logs mostram `execution_time_ms ≈ 150200`.
- `claudeClient.ts` tem **retry interno** (2s + 5s + 10s) em 504/529/5xx → cada retry é uma nova chamada **paga** ao Claude.
- Resultado: Claude retorna 504 → função tenta de novo → segundo 504 → terceiro → estoura 150s → frontend perde a conexão → não atualiza status no banco → React faz polling/re-render → dispara **outra** geração. Loop infinito + cobrança a cada tentativa.

A Linha Editorial não tem esse problema porque já usa worker em background com `EdgeRuntime.waitUntil`.

---

## Mudanças

### 1. Nova tabela `report_generation_jobs`
Migration nova:

```sql
create table public.report_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  report_id uuid not null,
  report_version int not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued', -- queued | processing | completed | failed
  result jsonb,
  error_message text,
  progress_message text,
  attempts int not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.report_generation_jobs enable row level security;

create policy "Users view own report jobs" on public.report_generation_jobs
  for select using (auth.uid() = user_id);
create policy "Users insert own report jobs" on public.report_generation_jobs
  for insert with check (auth.uid() = user_id);
create policy "Users update own report jobs" on public.report_generation_jobs
  for update using (auth.uid() = user_id);
create policy "Admins view all report jobs" on public.report_generation_jobs
  for select using (has_role(auth.uid(), 'admin'::app_role));
create policy "Admins update all report jobs" on public.report_generation_jobs
  for update using (has_role(auth.uid(), 'admin'::app_role));
create policy "Admins delete report jobs" on public.report_generation_jobs
  for delete using (has_role(auth.uid(), 'admin'::app_role));
```

Espelha a `content_generation_jobs` que já funciona.

### 2. Refatorar `supabase/functions/generate-report/index.ts` → enqueuer
Vira função leve que apenas:
- Valida payload (business, niche, archetypes, gender).
- Cria registro em `report_generation_jobs` com status `queued` e payload completo.
- Dispara o worker via `supabase.functions.invoke("process-report-generation-job", { body: { jobId } })` em fire-and-forget (sem await).
- Retorna `{ jobId }` com status **202** imediatamente (< 1 segundo).

Sem chamar Claude. Sem 150s. Sem 504.

### 3. Nova função `supabase/functions/process-report-generation-job/index.ts` (worker)
Espelha `process-content-generation-job`:
- Recebe `{ jobId }` no body.
- Confirma com 202 imediato.
- Processa em background via `EdgeRuntime.waitUntil(processJob(jobId))`.
- Idempotência: se job já está `processing`/`completed`/`failed`, ignora.
- Atualiza `progress_message` em etapas: "Carregando contexto…" → "Gerando estratégia… pode levar até 2 minutos" → "Salvando…" → "Concluído!".
- Move toda a lógica atual do `generate-report` (system prompt, user prompt, contexto pessoal, `renderBrandscriptFramework`, `callClaude`, `extractJsonFromLLM`, `isValidReport`).
- Em sucesso: grava `content` + `status = completed` em `reports` E em `report_generation_jobs.result`.
- Em falha: grava `error_message` em ambas as tabelas; `reports.status = error`.

`config.toml`: adicionar bloco `[functions.process-report-generation-job]` se necessário (segue o padrão dos outros workers — provavelmente nenhuma config especial é precisa, segue o default).

### 4. Nova função `supabase/functions/get-report-generation-job/index.ts` (polling)
Endpoint leve que recebe `?jobId=...`, valida JWT, retorna `{ status, progress_message, error_message, result }` da tabela. Espelha `get-content-generation-job`.

### 5. Reduzir custo de retries no `claudeClient.ts` para reports
Trocar a estratégia de retry: hoje retenta **3 vezes** em qualquer 5xx, gastando crédito a cada tentativa. Para `generate-report`:
- Adicionar opção `disableRetries?: boolean` em `CallClaudeOptions`.
- Worker chama Claude com `disableRetries: true` e faz **1 retry manual** apenas quando o erro é parsing/JSON inválido (não quando é 504/timeout).
- Se Claude responder 504/timeout, o worker grava o erro e **para** — sem queimar mais tokens. Usuário pode clicar "Tentar novamente" se quiser.

Custo cai de ~US$0,36 (3 tentativas) para ~US$0,12 (1 tentativa) em caso de falha.

### 6. Reduzir `max_tokens` de 10000 → 8000 no report
10000 tokens de output = chamadas mais longas = mais chance de 504. 8000 ainda cobre o JSON gerado (medindo um output válido típico, fica ~6500 tokens). Reduz latência média ~15-20%.

### 7. Atualizar `src/pages/Results.tsx` para o padrão de polling

Trocar o `await supabase.functions.invoke("generate-report", ...)` (síncrono) por:

```ts
// 1. Enfileira o job
const { data: queue } = await supabase.functions.invoke("generate-report", {
  body: { business: bqData, niche, archetypes, gender, reportId, reportVersion }
});
const jobId = queue.jobId;

// 2. Polling a cada 3s (timeout total de 5min)
const startedAt = Date.now();
while (Date.now() - startedAt < 5 * 60_000) {
  await new Promise(r => setTimeout(r, 3000));
  const { data: job } = await supabase.functions.invoke("get-report-generation-job", {
    body: { jobId }
  });
  setProgressMessage(job.progress_message);
  if (job.status === "completed") { /* hidrata UI a partir de reports.content */ break; }
  if (job.status === "failed") throw new Error(job.error_message);
}
```

Adicionar:
- Mensagens de progresso dinâmicas vindo do `progress_message` do job (substitui o `STAGE_LABELS` estático para a fase `generating_report`).
- Barra de progresso visual indeterminada (já tem `Progress` em `src/components/ui/progress.tsx`).
- Se polling estourar 5min, mostra erro e botão "Tentar novamente" (cria novo jobId).
- Cleanup do polling se o usuário sair da página (AbortController + cleanup do useEffect).

### 8. Realtime opcional (futuro, não nesta entrega)
Marcar a tabela `report_generation_jobs` para realtime para evitar polling. Nesta entrega fica polling simples (3s) — mesmo padrão da Linha Editorial.

### 9. Memória
Atualizar `mem://logica/fluxo-geracao-automatica-estrategia` documentando que a geração de relatório agora é assíncrona via job/worker, com polling a cada 3s e timeout de 5min no cliente.

### 10. Deploy
- Migration nova (tabela `report_generation_jobs`).
- Deploy de `generate-report` (refatorada como enqueuer), `process-report-generation-job` (nova) e `get-report-generation-job` (nova).
- Atualização de `claudeClient.ts` (opção `disableRetries`).
- Atualização de `src/pages/Results.tsx` (polling).

---

## O que **não** muda

- Qualidade do prompt e do JSON gerado: **idêntica**. Toda a lógica do `generate-report` é movida para o worker, sem alteração de prompt.
- Frameworks injetados como texto denso (sem PDFs) — mantidos como está.
- Versionamento de relatório via `max(version)` — mantido.
- Status final em `reports` (`pending` / `generating` / `completed` / `error`) — mantido. A tabela de jobs é só telemetria do processamento.
- Linha Editorial e demais funções Claude — não alteradas.

## Impacto esperado

- **504s eliminados**: HTTP fica aberto < 1s no enqueue, polling < 100ms cada.
- **Cobrança duplicada eliminada**: 1 chamada ao Claude por tentativa (era até 3). Falha do Claude não dispara retry caro.
- **Loop infinito de geração eliminado**: status fica em `reports.status = error` se falhar; frontend mostra erro com botão de retry, não dispara automático.
- **UX melhor**: progresso visível ao usuário ("Gerando…", "Salvando…", "Concluído"), em vez de spinner travado por 2 minutos.
- **Margem para growth**: arquitetura suporta picos sem timeout (worker pode rodar até 400s).
