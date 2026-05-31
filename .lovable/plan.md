## Diagnóstico

Os logs da edge function mostram que a geração **terminou com sucesso** (`DONE generation=d4f49b57… delivered=3/3`), mas levou ~2min29s e o cliente desconectou antes da resposta chegar (`Http: connection closed before message completed`). O cliente `supabase.functions.invoke` tem timeout em torno de 150s e Nano Banana Pro gerando 3 imagens sequenciais extrapola isso. Resultado: retratos foram cobrados/salvos no banco, mas a usuária viu "Edge Function returned a non-2xx status code".

Esse problema vai reincidir sempre — a única correção robusta é desacoplar a geração da resposta HTTP.

## Plano

Migrar o fluxo de retratos para o mesmo padrão assíncrono já usado em `process-report-generation-job` / `portrait-poll`: a edge function valida, cria o job, retorna 202 imediato, e processa em background com `EdgeRuntime.waitUntil`. O front faz polling até `ready`/`failed`.

### 1. `supabase/functions/generate-portrait/index.ts`
- Mover toda a validação (auth, créditos, referências, profile) para a fase síncrona.
- Inserir `portrait_generations` com `status='processing'` antes de qualquer chamada ao Gemini.
- Reservar créditos otimisticamente (decrementar do `user_balances`) — devolver no caminho de falha, igual ao `portrait-webhook` faz hoje.
- Retornar `202 { generation_id, status: "processing" }`.
- Embrulhar o loop de geração + uploads + finalização em `EdgeRuntime.waitUntil(processGeneration(...))`, que ao final atualiza a row para `status='ready'` (ou `failed` + reembolso parcial dos créditos não entregues).

### 2. Novo endpoint `portrait-status` (ou estender `portrait-poll`)
- Recebe `{ generation_id }`, valida ownership.
- Retorna `{ status, portraits, delivered, requested, error_message }` com signed URLs frescas (7d) quando `ready`.
- `portrait-poll` atual é específico do fluxo antigo Fal/LoRA; mais limpo criar `portrait-status` dedicado ao engine Gemini.

### 3. `src/pages/PortraitGenerator.tsx`
- Trocar o `await supabase.functions.invoke("generate-portrait")` por: invoke → recebe `generation_id` → loop de polling a cada 4s (timeout ~5min) chamando `portrait-status`.
- Manter overlay de "Gerando…" ativo durante o polling.
- Em `failed`, mostrar `error_message` retornado pelo backend.
- Se o usuário recarregar a página com uma geração em andamento, oferecer retomar o polling (ler última row `processing` do usuário no mount).

### 4. Reconciliar a geração órfã da usuária
- A geração `d4f49b57-0236-48e3-a361-eeb34a9888fc` está salva como `ready` no banco mas não foi exibida. Como o `HistoryPage` já lê de `portrait_generations`, ela aparecerá no histórico automaticamente — não precisa migration de dados.

## Detalhes técnicos

- `EdgeRuntime.waitUntil` mantém o worker vivo após o response, sem segurar a conexão HTTP — mesmo padrão recomendado no knowledge `lovable-stack-overflow`.
- Cobrança continua "1 crédito por retrato entregue": deduzimos `requestedCount` upfront e creditamos de volta `requested - delivered` no fim do background job.
- Polling no front usa `setTimeout` recursivo (não `setInterval`) para evitar sobreposição de requisições.
- Sem mudanças de schema: `portrait_generations` já tem `status`, `portraits`, `completed_at`, `error_message` (verificar no types.ts antes de implementar).

## Fora de escopo

- Migrar outros fluxos longos (relatórios, conteúdo semanal) — já são assíncronos.
- Mudar o motor de geração ou prompts.
