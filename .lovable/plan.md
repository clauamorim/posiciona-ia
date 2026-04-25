## Objetivo

Corrigir o erro `undefined is not an object (evaluating 'Se.format')` que aparece ao regenerar um post da Linha Editorial, e ajustar o comportamento dos botões de regeneração às regras V6:

- **Posts de feed**: têm botão "Regenerar". Ao regenerar o feed, o **story do mesmo dia também é regenerado automaticamente** (sem botão próprio), garantindo que continue alinhado ao tema novo.
- **Stories sem post de feed correspondente** (dias livres): recebem botão próprio "Regenerar story".
- **Stories que espelham um feed** (`mirrors_feed: true` ou simplesmente: dia que tem `feed != null`): **não recebem botão**. Eles só são atualizados quando o feed daquele dia é regenerado.

---

## 1. Causa do erro atual

Em `src/pages/EditorialPage.tsx`, a função `handleRegeneratePost` (linha 321) ainda lê o post no shape v5 (`week[dayIndex].format`, `week[dayIndex].theme`), mas a semana agora vive no shape v6 (`week.days[dayIndex].feed.format`). Quando ela tenta acessar `.format` num objeto v6, recebe `undefined` e a edge function `regenerate-single-post` quebra na hora de montar o prompt.

---

## 2. Refatoração de `handleRegeneratePost`

**Arquivo:** `src/pages/EditorialPage.tsx`

Substituir por `handleRegenerateItem(weekIndex, dayIndex, target)` onde `target ∈ {"feed","story"}`:

- Lê `week.days[dayIndex]` no shape v6.
- Monta payload com:
  - `target`
  - `day_index`
  - `current_feed` (quando target=story, para o LLM espelhar se necessário; mas no nosso caso stories que espelham feed nunca chamam essa função, então só usado para contexto leve)
  - `current_day_theme`, `previousWeeks` resumidas, `storybrand`, `personalContext`, etc.
- Chama a edge function `regenerate-single-post`.

**Comportamento de espelhamento automático:**
- Se `target === "feed"` e `day.feed != null`:
  1. Chama a edge function pedindo um novo `feed`.
  2. Em seguida, dispara uma segunda chamada interna pedindo um novo `story` daquele dia, passando o `feed` recém-gerado como contexto e instruindo "espelhar tema do feed".
  3. As duas atualizações são gravadas juntas em `editorial_weeks` numa única operação `update`.
  4. Custo: **1 crédito** apenas (o par feed+story conta como uma regeneração lógica).
- Se `target === "story"` (só permitido quando `day.feed == null`):
  1. Uma chamada simples regenerando só o story livre.
  2. Custo: 1 crédito.

Estado de loading vira `${wi}-${di}-${target}` para o spinner ser específico ao botão clicado.

---

## 3. UI — botões granulares

**Arquivo:** `src/pages/EditorialPage.tsx`

- **Coluna feed** (quando `day.feed` existe): mantém o botão `Regenerar` (label: "Regenerar"). Tooltip/microcopy curta: "O story deste dia será atualizado junto." Sem botão extra.
- **Coluna story**:
  - Se `day.feed != null` (story espelha feed): **sem botão** — apenas o badge "Mesmo tema do feed" continua visível (já existe).
  - Se `day.feed == null` (story livre / pessoal): mostrar botão `Regenerar story` ao lado do conteúdo.
- Estado `regeneratingKey` cobre ambos os casos.

---

## 4. Edge function — `regenerate-single-post`

**Arquivo:** `supabase/functions/regenerate-single-post/index.ts`

Já aceita `target` (implementado na v6). Confirmar/ajustar:

- Quando `target=feed`, retorna `{ feed: {...} }` no shape novo.
- Quando `target=story`, retorna `{ story: {...} }` no shape novo, recebendo `mirror_feed: { theme, format }` opcional para espelhar.
- Validar payload e retornar 400 com mensagem clara se faltar `target` ou `day_index`.

O frontend faz **duas chamadas sequenciais** quando precisa regenerar feed+story; a edge não precisa orquestrar isso.

---

## 5. Custo de créditos

- Regenerar feed (que arrasta o story junto): **1 `regeneration_credit`**.
- Regenerar story livre: **1 `regeneration_credit`**.
- A segunda chamada (story que segue o feed) é marcada com flag `paired: true` no payload e a edge function **não decrementa crédito** quando recebe essa flag — o débito acontece só na chamada primária.

---

## 6. Mensagens de erro

- Se a edge retornar 400/500, mostrar toast com mensagem amigável e **não** corromper o estado da semana (manter o conteúdo antigo).
- Logar `console.error` com o payload enviado para facilitar debug futuro.

---

## 7. Arquivos editados

- `src/pages/EditorialPage.tsx` — refator de `handleRegeneratePost` para `handleRegenerateItem`, novo botão "Regenerar story" condicional, encadeamento feed→story.
- `supabase/functions/regenerate-single-post/index.ts` — aceitar flag `paired` para não cobrar crédito duplicado; validar payload v6.

---

## 8. O que NÃO muda

- Shape v6 da semana.
- Geração inicial em 2 estágios.
- Sanitização recursiva.
- Custo e modelo do Claude.
- UI dos dias sem alterações estruturais (apenas o botão de story aparece condicionalmente).

---

## Resultado esperado

- Erro `Se.format` resolvido — leitura no shape v6 correto.
- Regenerar feed atualiza feed + story do mesmo dia automaticamente, mantendo coerência temática.
- Stories que espelham feed nunca exibem botão próprio (não confundem o usuário).
- Stories independentes (dias sem feed) ganham botão dedicado.

## Reversibilidade

Alta — mudanças confinadas ao handler de regeneração e à condicional do botão de story. Sem migração de dados.
