## Diagnóstico (corrigido após nova análise)

Confirmações:

1. **PDFs**: Já foram removidos — o job `process-content-generation-job` **não envia mais PDFs em base64** ao Claude. Só os princípios narrativos por texto inline.
2. **Tendências de mercado**: Ativas. Chama `fetch-market-trends` antes do prompt e injeta um bloco em feed e stories.
3. **Regras éticas advogado/médico**: **Funcionando.** Tinha errado na resposta anterior; `detectProfession` + `getEthicalRulesBlock` são chamados nas linhas 347-348 e injetados nos system prompts do feed (linha 372) e stories (linha 500). Cobre advogados, ramos do direito, médicos e várias especialidades.

### Causa real do 429 ("Muitas solicitações ao mesmo tempo")

O `claudeClient.ts` já tem backoff (2s → 5s → 10s) para 429/5xx, **mas** as duas chamadas no job passam `disableRetries: true` (linhas 392 e 517). Resultado: na primeira resposta 429 da Anthropic, o job estoura imediatamente sem tentar de novo. Os 25-30s que o job leva para falhar são só tempo de prompt + resposta, não retries.

A flag foi colocada provavelmente para evitar custo duplicado em truncamento (`max_tokens`), mas 429 não consome tokens — o retry é seguro nesse caso.

## Mudanças

### 1. `supabase/functions/_shared/claudeClient.ts`

- Tornar a granularidade do retry mais inteligente: criar opção `disableRetriesOn` (default: nada) e manter `disableRetries` só como atalho. Ou, mais simples e suficiente: **sempre permitir retry em 429** mesmo quando `disableRetries: true` — porque 429 é retorno antes do consumo de tokens e é exatamente o caso em que retry é seguro e desejado.
- Quando 429, ler o header `retry-after` (segundos) ou `anthropic-ratelimit-input-tokens-reset` se presente, e usar como delay (clamp 5s..60s). Senão, usar tabela de fallback `[3000, 8000, 20000, 40000]`.
- Ajustar `userMessage` do 429 para: `"O serviço de IA está com muita demanda agora. Aguarde cerca de 1 minuto e tente novamente — seu crédito não foi consumido."`.

### 2. `supabase/functions/process-content-generation-job/index.ts`

- Manter `disableRetries: true` (proteção contra cobrança em loop por truncamento), mas confiar na nova lógica do client que **continua tentando em 429** mesmo com `disableRetries`.
- Adicionar pausa curta (~2s) entre o estágio A (feed) e o estágio B (stories) para reduzir picos no input-TPM da Anthropic.
- Padronizar o `console.error` de cada estágio falho com o status HTTP, para ficar fácil distinguir 429 de falha de parsing nos logs.

### 3. `src/pages/EditorialPage.tsx`

- Quando o job retornar `failed` com `error_message` começando com "Muitas solicitações" ou "O serviço de IA está com muita demanda", trocar o card vermelho fixo por um card neutro com:
  - Mensagem clara
  - Botão "Tentar novamente" (reusa o handler já existente de gerar semana)
  - Subtítulo: "Seu crédito não foi consumido."

## Não muda

- Modelo Claude, prompts, conjunto de frameworks (StoryBrand / Made to Stick / Obviously Awesome)
- Lógica de detecção de profissão e regras éticas (já está OK)
- `fetch-market-trends` (já está OK)
- Devolução de crédito em falha (já funciona — confirmado no banco: usuário ainda tem 3 ciclos)
- Estrutura assíncrona com `content_generation_jobs` e polling

## Validação

Após o deploy:
1. Disparar a primeira semana com a conta atual
2. Conferir nos logs do `process-content-generation-job`: se ocorrer 429, deve aparecer `Claude 429 — retry 1/4 em Xms` e o job deve concluir
3. Conferir o card de erro no front se o limite persistir, com botão "Tentar novamente" funcionando
