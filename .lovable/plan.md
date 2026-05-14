## Objetivo
Eliminar repetição na linha editorial via 4 mudanças cirúrgicas em Edge Functions (sem frontend).

## Mudanças

### 1. `supabase/functions/process-content-generation-job/index.ts`
- **1a)** Trocar o EXEMPLO BOM/RUIM de "natação/disciplina" pelo novo exemplo sobre "preço vs. clareza de diferenciação".
- **1b)** Adicionar constante `FEED_POST_TYPES` (4 tipos: EDUCACIONAL, DESMISTIFICAÇÃO, POSICIONAMENTO, ANÁLISE DE MERCADO OU CASO) imediatamente antes de `const FEED_DAYS = [1, 3, 5, 7];`.
- **1c)** Alterar assinatura: `buildFeedSystemPrompt(rotationOffset: number = 0)`.
- **1d)** Substituir o bloco hardcoded "POST 1..4" dentro do system prompt por loop `${[0,1,2,3].map(...)}` usando `FEED_POST_TYPES[(i + rotationOffset) % 4]`.
- **1e)** Após `const rotationBlock = renderRotationBlock(rotationHint);`, calcular `const rotationOffset = (previousWeeks?.length || 0) % 4;`.
- **1f)** Atualizar a chamada `buildFeedSystemPrompt()` para `buildFeedSystemPrompt(rotationOffset)`.

### 2. `supabase/functions/_shared/professionRules.ts`
- Em `renderMarketTrendsBlock`, quando `trends` for vazio/nulo, retornar bloco instruindo o LLM a usar caso real nomeado (do conhecimento de treinamento) em vez de string vazia.

### 3. `supabase/functions/fetch-market-trends/index.ts`
- No system prompt, adicionar exceção para nichos de tecnologia (IA, software, SaaS) — permitir empresas internacionais relevantes (OpenAI, Google, Meta, etc.) e regulação/startups brasileiras de tech — imediatamente antes da linha "⚠️ FORMATO DE SAÍDA".

## Validação
- Confirmar localização exata dos blocos com `code--view` antes de editar.
- Deploy das 2 funções afetadas (`process-content-generation-job`, `fetch-market-trends`); `professionRules.ts` é shared e segue junto no deploy de quem importa.

## Efeito esperado
- Fim do template "natação/disciplina" replicado.
- Rotação semanal do tipo de post no Dia 1 (4 semanas = 4 aberturas distintas).
- Quando não há tendências cacheadas, LLM ainda produz post de análise com caso real nomeado.
- Nichos de tech voltam a retornar tendências relevantes.
