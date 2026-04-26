# Correção do erro "+7 dias" — truncamento da resposta do Claude

## Diagnóstico

Os logs do worker `process-content-generation-job` mostram que o erro **não é de rede/Safari**. O Claude está atingindo o limite de `max_tokens: 6000` durante a geração do feed (Stage A — 4 posts com legendas longas e carrosséis), retornando um JSON **truncado** que o parser não consegue recuperar. Resultado: o job falha com "Incomplete AI response", o crédito é estornado e o usuário vê o erro genérico no celular (e provavelmente também aconteceria no desktop com a mesma frequência — só passou despercebido).

## Mudanças propostas

### 1. `supabase/functions/_shared/claudeClient.ts`
- Expor o `stop_reason` retornado pela API (`"end_turn"` vs `"max_tokens"`) junto com o texto, para o caller saber explicitamente quando a resposta foi cortada.
- Manter retro-compatibilidade: a função continua retornando string por padrão, com uma variante `callClaudeWithMeta` que devolve `{ text, stopReason }`.

### 2. `supabase/functions/process-content-generation-job/index.ts`
- **Aumentar `max_tokens`** de 6000 para **8500** no Stage A (feed) — margem confortável para 4 posts + carrosséis.
- **Detectar truncamento** via `stop_reason === "max_tokens"` e logar com clareza.
- **Recuperação parcial robusta**: usar um scanner de chaves balanceadas (já existe lógica similar em `_shared/jsonExtract.ts`) para extrair os posts completos do array, mesmo que o último esteja cortado.
- **Sucesso parcial**: se ao menos **2 posts** forem recuperados, prosseguir para o Stage B (Stories) e preencher os posts faltantes com placeholders marcados, em vez de falhar o job inteiro e estornar o crédito.
- Mensagem de progresso atualizada para refletir recuperação parcial quando ocorrer.

### 3. UX no cliente — `src/pages/EditorialPage.tsx`
- No `catch` final do polling, detectar mensagens contendo "Incomplete AI response" / "max_tokens" e exibir um toast mais claro: *"A geração ficou densa demais e foi interrompida. Toque novamente em Gerar +7 dias — costuma funcionar na segunda tentativa."*
- Sem mudanças na lógica de cobrança (o worker já estorna em falha real).

## Fora de escopo
- Não vou mexer em retries de rede/Safari nem em `ensureFreshSession` — os logs confirmam que o problema é backend, não cliente.
- Não vou trocar o modelo Claude (sonnet-4-5 segue adequado).

## Arquivos a editar
- `supabase/functions/_shared/claudeClient.ts`
- `supabase/functions/process-content-generation-job/index.ts`
- `src/pages/EditorialPage.tsx`