## Objetivo
Reduzir repetição de conteúdo pessoal em stories e desacoplar o editorial da narrativa de vendas, com detecção de sinônimos no anti-repetição de traços.

## Mudança 1 — `supabase/functions/process-content-generation-job/index.ts`

### 1a) Limite de 1 story pessoal por semana
- Em `buildStoriesSystemPrompt`, localizar o bloco "REGRAS DE STORIES" (ou equivalente que define a estrutura das 7 stories).
- Adicionar logo abaixo um bloco "🟥 LIMITE PESSOAL PARA STORIES (CRÍTICO)" com:
  - Máx. 1 das 7 stories pode ser `is_personal=true`.
  - Tipos não-pessoais permitidos para as demais: dúvida frequente, observação técnica do nicho, comentário sobre decisão/erro/acerto comum, dica prática, bastidor de trabalho.
  - Proibir hobby/esporte/família/rotina/ritual matinal em mais de 1 story/semana.
  - Se "bastidor" não estiver sub-representado na semana (ROTAÇÃO DE PILARES), nenhuma story pode ser pessoal.

### 1b) Remover `salesNarrativeContext` dos prompts editoriais
- Em `feedUser`: remover a interpolação `${salesNarrativeContext}` da linha do `Nicho:`.
- Em `storiesUser`: remover a interpolação `${salesNarrativeContext}` da linha do `Nicho:`.
- Manter `fetchSalesNarrative` e `renderSalesNarrativeContext` no shared (continuam usados por `generate-sales-stories`).
- Avaliar se ambas as linhas (`const salesNarrative = ...` e `const salesNarrativeContext = ...`) ficam órfãs em `process-content-generation-job`; se sim, remover ambas juntas.

### 1c) Sinônimos no `detectUsedTraits`
- Após `PT_STOPWORDS`, adicionar:
  - `TRAIT_SYNONYMS` (mapa: natacao, corrida, leitura, meditacao, yoga, caminhada, cachorro, gato, cafe, filho).
  - `expandTraitKeywords(keywords)` que expande cada keyword para o grupo de sinônimos correspondente.
- Em `buildPersonalTraitMap`, trocar:
  - `const kws = extractTraitKeywords(v);` por `const kws = expandTraitKeywords(extractTraitKeywords(v));`

## Validação
- `code--view` em `process-content-generation-job/index.ts` para confirmar nomes/posições exatas de: `buildStoriesSystemPrompt`, bloco "REGRAS DE STORIES", as duas strings `feedUser`/`storiesUser`, `PT_STOPWORDS`, `extractTraitKeywords`, `buildPersonalTraitMap`.
- Deploy de `process-content-generation-job` após as edições.

## Efeito esperado
- Stories pessoais caem de ~3/semana para no máx. 1/semana.
- Sales narrative deixa de "puxar" temas pessoais para feed e stories.
- Detector marca "piscina"/"nado" como uso de "natação" — fechando o loop do anti-repetição.
