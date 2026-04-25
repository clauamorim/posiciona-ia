## Objetivo

Reestruturar a Linha Editorial para gerar **dois tracks paralelos por semana**:

- **Feed**: exatamente **4 posts** (mix de carrossel, post único e reels)
- **Stories**: exatamente **7 sugestões** (uma por dia)
- **Espelhamento de tema**: nos dias em que há post de feed, o story do mesmo dia aborda o mesmo tema
- **Conteúdo pessoal**: pode aparecer no feed ou stories, com **predominância nos stories**

E **prevenir todos os erros previsíveis** (timeout, truncamento de JSON, parser quebrando em estrutura aninhada, falha parcial em uma das etapas).

---

## 1. Nova estrutura de dados (`reports.editorial_weeks` JSONB)

Cada semana passa a ter 7 dias, e cada dia tem 2 sub-objetos:

```jsonc
{
  "week_index": 1,
  "days": [
    {
      "day": 1,
      "feed": {
        "format": "carrossel" | "post" | "reels",
        "theme": "...",
        "caption": "...",
        "cta": "...",
        "card_copy": ["...", "..."],   // só carrossel
        "script": "...",                // só reels
        "is_personal": false
      } | null,                          // null nos 3 dias sem feed
      "story": {
        "theme": "...",
        "frames": ["...", "...", "..."], // 3-5 frames sugeridos
        "is_personal": true,
        "mirrors_feed": false            // true quando espelha o tema do feed do mesmo dia
      }
    }
    // ... 7 dias
  ]
}
```

**Distribuição obrigatória por semana** (instruída no prompt):
- 4 dias com `feed` preenchido + `story` (3 desses stories espelham o tema do feed; 1 é pessoal espelhando o feed pessoal, se houver)
- 3 dias com `feed: null` + `story` (livres, predominância pessoal)
- Total stories pessoais: **mínimo 4 dos 7**
- Posts pessoais no feed: **0 ou 1 por semana** (predominância nos stories)

---

## 2. Geração em 2 estágios (anti-timeout)

**Arquivo:** `supabase/functions/process-content-generation-job/index.ts`

Em vez de uma chamada Claude gerando ~11k tokens (risco de timeout 170s + truncamento), dividir em duas chamadas sequenciais:

**Estágio A — Feed (4 posts)**
- Prompt focado só nas 4 peças de feed.
- Saída esperada: ~4-5k tokens.
- `max_tokens: 6000`.
- Persiste resultado parcial em `content_generation_jobs.result` com `{ stage: "feed_done", feed: [...] }`.

**Estágio B — Stories (7)**
- Recebe o array de feed do Estágio A como contexto enxuto (apenas `day`, `theme`, `format`, `is_personal`).
- Prompt instrui: "para os dias X, Y, Z (que têm feed), o story DEVE espelhar o tema do feed correspondente. Para os outros 3 dias, criar stories livres com predominância pessoal".
- Saída esperada: ~3-4k tokens.
- `max_tokens: 5000`.
- Combina feed + stories no shape final e grava em `reports.editorial_weeks`.

**Vantagens:**
- Cada chamada fica bem abaixo do timeout (cada ~30-60s).
- Se o Estágio B falhar, mantém o feed gerado e marca status `completed_partial` → usuário pode retomar só os stories.
- Diminui risco de truncamento de JSON pela metade.

---

## 3. Parser JSON robusto para estruturas aninhadas

**Arquivo:** `supabase/functions/_shared/jsonExtract.ts`

O parser atual usa regex de `firstBrace`/`lastBrace` que pode falhar em estruturas profundas. Adicionar uma estratégia de **contador balanceado de chaves** que respeita strings e escapes (já existe parcialmente no `repairAndParse`, mas vamos torná-la a estratégia primária para extração).

Adicionar também:
- Função `extractJsonArray(raw)` específica para casos onde a LLM devolve `[ {...}, {...} ]`.
- Validação de schema mínimo: `isValidWeek(value)` que confere se tem `days` array com 7 itens e cada um tem chaves `day`, `feed`, `story`.

---

## 4. Sanitização recursiva

**Arquivo:** `supabase/functions/_shared/editorialSanitize.ts`

Atualizar `sanitizePost` (e criar `sanitizeDay`) para descer em:
- `day.feed.theme/caption/cta/script` + `day.feed.card_copy[]`
- `day.story.theme` + `day.story.frames[]`

`countFrameworkLeaks` e `countWeekLeaks` precisam considerar a nova estrutura (somar leaks de feed + story em cada dia).

---

## 5. Regeneração granular

**Arquivo:** `supabase/functions/regenerate-single-post/index.ts`

Aceitar novos parâmetros:
- `target: "feed" | "story"` (qual dos dois regenerar nesse dia)
- `day_index: number`

Comportamento:
- Se `target=feed`: regenera só o `day.feed` mantendo o `day.story`. Se o story atual tinha `mirrors_feed: true`, marca aviso de "story pode estar desalinhado, considere regenerar".
- Se `target=story`: regenera só `day.story`, recebendo o `day.feed` (se existir) como contexto para espelhamento.
- Custo de crédito: 1 `regeneration_credit` por target (mantém o modelo atual).

---

## 6. UI — `EditorialPage.tsx`

Reescrever a renderização de cada dia para layout de **duas colunas**:

```
┌─────────────────────────────────────────────────┐
│ Dia 1                                           │
├──────────────────────┬──────────────────────────┤
│ FEED                 │ STORIES                  │
│ [carrossel: tema X]  │ [3 frames: tema X]       │
│ caption / cta        │ (espelha o feed)         │
│ [Regenerar feed]     │ [Regenerar story]        │
└──────────────────────┴──────────────────────────┘
```

- Dias sem feed mostram coluna esquerda vazia com badge "Sem post no feed".
- Badge `Pessoal` continua aparecendo onde aplicável.
- Mobile: empilhar feed acima, story abaixo.
- Botão `Editar no Editor Visual` continua só no feed (stories não vão pro editor por enquanto).
- Botão `Gerar capa` (reels) continua igual.

---

## 7. Export PDF

**Arquivo:** `src/lib/pdfExport.ts` + componente da Linha Editorial

Atualizar a árvore DOM oculta usada para PDF para refletir as duas colunas. Cada dia vira uma seção `[data-pdf-section]` com os dois blocos lado a lado (em telas grandes do PDF) ou empilhados.

---

## 8. Versionamento e migração de dados antigos

**Arquivo:** `src/lib/generatorVersion.ts` e `_shared/generatorVersion.ts`

Bump para `2026-04-25-v6`. Adicionar nota de histórico:
> v6: divisão da linha editorial em Feed (4 posts) + Stories (7 sugestões), com geração em 2 estágios para evitar timeout e parser robusto para estrutura aninhada.

**Conteúdo legado** (estrutura antiga): `isOutdated` continua retornando true → UI mostra banner "Linha editorial atualizada — regenere gratuitamente" usando o crédito de versão obsoleta (já existe esse fluxo).

A leitura é **tolerante**: se `editorial_weeks[i].days[j]` não existir mas existir o shape antigo, renderiza no formato antigo até o usuário regenerar. Sem migration destrutiva.

---

## 9. Mitigação de erros — checklist completo

| Risco | Mitigação |
|---|---|
| Timeout 170s na edge function | Geração em 2 estágios (cada ≤60s típico) |
| `max_tokens` truncando JSON | Cada estágio fica em 5-6k tokens, bem abaixo do limite |
| Parser quebrando em JSON aninhado | Contador balanceado de chaves + validação de schema |
| Estágio B falha após A OK | Status `completed_partial`; UI permite retomar só os stories sem cobrar crédito de novo |
| Claude esquecer espelhamento | Estágio B recebe feed como contexto explícito + instrução literal "DEVE espelhar tema" |
| Sanitização perdendo campos novos | `sanitizeDay` recursivo cobrindo feed + story.frames |
| Regeneração desalinhar feed↔story | Aviso na UI + opção de regenerar o par junto |
| Rate limit Anthropic | Reduzir bloco de frameworks de ~3k → ~800 tokens (resumo denso, não cita PDFs) |
| Conteúdo legado quebrar a UI | Renderização tolerante: detecta shape antigo e renderiza no formato v5 até regenerar |

---

## 10. Arquivos editados

**Backend:**
- `supabase/functions/process-content-generation-job/index.ts` — 2 estágios, prompts novos
- `supabase/functions/regenerate-single-post/index.ts` — parâmetro `target`
- `supabase/functions/_shared/jsonExtract.ts` — parser balanceado + `isValidWeek`
- `supabase/functions/_shared/editorialSanitize.ts` — `sanitizeDay` recursivo
- `supabase/functions/_shared/generatorVersion.ts` — bump v6

**Frontend:**
- `src/lib/generatorVersion.ts` — bump v6 + histórico
- `src/pages/EditorialPage.tsx` — layout 2 colunas, botões granulares, leitura tolerante a shape antigo
- `src/lib/pdfExport.ts` — não muda (usa `[data-pdf-section]`)
- Componente de PDF da Linha Editorial — render dos 2 tracks

**Banco:**
- Sem migration destrutiva. `editorial_weeks` continua JSONB livre. Leitura tolerante.

---

## 11. O que NÃO muda

- Modelo Claude Sonnet 4.5.
- Custo: 1 weekly_cycle por semana (igual ao atual).
- Custo de regeneração: 1 regeneration_credit por target.
- PDFs de referência (StoryBrand, Made to Stick, Obviously Awesome) — só os textos densos enviados como contexto.
- Sistema de jobs assíncrono (queue + worker + polling).
- Sanitização de rótulos de framework continua obrigatória.

---

## Resultado esperado

- Cada semana entrega **4 peças de feed estruturadas** + **7 stories acionáveis**, com coerência temática nos dias compartilhados.
- Tempo de geração total por semana: **~60-100s** (vs. risco de >170s de uma chamada só).
- Zero perda de trabalho em caso de falha parcial (Estágio A salvo, B retomável).
- Conteúdo antigo continua visível e oferece upgrade gratuito para a v6.

## Reversibilidade

Alta — apenas o shape do `editorial_weeks` muda, e a leitura é tolerante. Se precisar reverter, basta voltar a versão v5 no `generatorVersion.ts` e o frontend renderiza no shape antigo.
