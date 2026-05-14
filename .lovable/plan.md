## MVP anti-alucinação — sem mexer no questionário de negócio

Sete arquivos, um único deploy. Sem migration. Tudo em código.

---

### 1. `supabase/functions/_shared/claudeClient.ts`
Trocar `DEFAULT_CLAUDE_MODEL` de `"claude-sonnet-4-5"` para `"claude-sonnet-4-6"`. Atualizar comentário acima da constante. Sem fallback.

### 2. `supabase/functions/_shared/buildClaudeContext.ts`

**`renderPersonalContext`** — substituir o parágrafo de uso:
> Reservar 1–2 dias e usar como tempero nos demais

por:
> Use estes dados APENAS quando o post estiver explicitamente marcado como pessoal (`is_personal=true`). Nos demais posts, NÃO insira menções pessoais.

**Nova função `renderVerifiableFactsBlock(business)`** — duas formas:

- Se houver pelo menos um campo entre `verifiable_facts`, `mini_cases`, `signature_phrases`: renderiza bloco "FATOS VERIFICÁVEIS (FONTE DA VERDADE)" com os campos preenchidos e a regra "todo número, caso, métrica ou exemplo concreto DEVE vir literalmente desta lista. Se não houver fato pertinente, reescreva como pergunta/hipótese."
- Se nenhum campo existir: renderiza bloco "FATOS VERIFICÁVEIS — Sem fatos cadastrados. TODOS os exemplos numéricos, casos e métricas devem ser formulados como pergunta ou hipótese. NUNCA afirme como fato concreto algo que não está no contexto."

Como o questionário ainda não tem esses campos, na prática o segundo branch é o que vai disparar — funciona como guarda-corpo até a próxima iteração adicionar os campos.

### 3. `supabase/functions/_shared/editorialPillars.ts` (novo)

```ts
export const EDITORIAL_PILLARS = [
  { id: "metodo",        label: "Método",            description: "..." },
  { id: "mito",          label: "Mito vs. realidade", description: "..." },
  { id: "mercado",       label: "Análise de mercado", description: "..." },
  { id: "caso",          label: "Caso real",          description: "..." },
  { id: "posicionamento",label: "Posicionamento",     description: "..." },
  { id: "bastidor",      label: "Bastidor pessoal",   description: "..." },
] as const;

export type PillarId = typeof EDITORIAL_PILLARS[number]["id"];

export function renderPillarsBlock(): string { /* descrição densa dos 6 */ }

export function getPillarRotationHint(
  previousPillarsByWeek: PillarId[][]
): {
  counts: Record<PillarId, number>;
  underrepresented: PillarId[];   // contagem nas últimas 4 semanas ≤ 1
  overrepresented: PillarId[];    // contagem nas últimas 4 semanas ≥ 4
};
```

`getPillarRotationHint` lê só as últimas 4 semanas. Limiares: sub ≤1, sobre ≥4 (ajustável). "Bastidor pessoal" recebe limite mais agressivo (sobre ≥2).

### 4. `supabase/functions/_shared/editorialSanitize.ts`

Em `sanitizePost`: aceitar `cleaned.pillar`. Se string e dentro dos 6 ids → mantém. Se ausente → `pillar: "legacy"`. Se string desconhecida → `pillar: "legacy"` + log warn. Não bloqueia, não rejeita.

### 5. `supabase/functions/process-content-generation-job/index.ts`

**Imports:** adicionar `renderVerifiableFactsBlock`, `EDITORIAL_PILLARS`, `renderPillarsBlock`, `getPillarRotationHint`, `PillarId`.

**`previousSummary`:** mudar de `${theme} (${format})` para `[${pillar || "legacy"}] ${theme} (${format})`. Coletar paralelamente `previousPillarsByWeek: PillarId[][]` (uma sublista por semana, contendo só os pilares dos posts de feed).

**Cálculo de rotação + bloco do prompt:**
```
const rotation = getPillarRotationHint(previousPillarsByWeek);
const rotationBlock = `
# ROTAÇÃO DE PILARES — REGRA OBRIGATÓRIA
Pilares já cobertos nas últimas 4 semanas: <counts formatado>
Pilares SUB-REPRESENTADOS (priorize esta semana): <list>
Pilares SOBRE-REPRESENTADOS (evite esta semana): <list>
REGRA: os 4 posts desta semana DEVEM usar 4 pilares DIFERENTES entre si. Nenhum pilar pode aparecer 2x na mesma semana.`;
```
Injetado no `feedUser` junto aos demais blocos.

**`buildFeedSystemPrompt()`:**
- Adicionar regra de OUTPUT: cada objeto deve ter campo obrigatório `"pillar": "metodo" | "mito" | "mercado" | "caso" | "posicionamento" | "bastidor"`. Atualizar exemplo do array.
- Trocar a seção E (Humanização) por: "O pilar 'Bastidor pessoal' aparece NO MÁXIMO 1 vez por semana e SOMENTE se estiver na lista de pilares sub-representados. Se não estiver, nenhum post é pessoal (`is_personal=false` em todos)."
- Nova seção "ESTRATÉGIA DE PROFUNDIDADE": cada post didático deve ter 3 camadas explícitas — **tese → evidência (do bloco FATOS VERIFICÁVEIS, ou hipótese sinalizada) → aplicação prática**. Sem evidência factual, formular evidência como pergunta/hipótese explícita.
- Checklist final: adicionar bullet "Cada número, case ou exemplo concreto neste post existe literalmente no bloco FATOS VERIFICÁVEIS? Se não, reescreva como pergunta ou hipótese."

**`buildStoriesSystemPrompt`:**
- Trocar "pelo menos 4 dos 7 stories devem ter is_personal=true" por: "no máximo 3 dos 7 stories pessoais. Os demais são análise, dica ou quebra de mito alinhados ao pilar do feed do dia ou ao pilar sub-representado da semana."

**Injeção de contexto:**
- `feedUser` e `storiesUser`: inserir `${verifiableFactsBlock}` logo após o bloco "# NEGÓCIO" e antes do `${storybrandContext}`.
- `feedSystem` e `storiesSystem`: concatenar `+ renderPillarsBlock()` no final (antes do `renderEditorialFrameworks()`).
- `feedUser`: inserir `${rotationBlock}` antes do "# TEMAS JÁ PUBLICADOS".

**Persistência:** `sanitizePost` agora carrega `pillar`. `FeedPost` interface ganha `pillar?: string`. Placeholder de dia faltante recebe `pillar: "legacy"`. `previousSummary` lê `d?.feed?.pillar`.

### 6. `supabase/functions/regenerate-single-post/index.ts`

- Importar `renderVerifiableFactsBlock`, `renderPillarsBlock`.
- Receber `pillar` no payload (opcional, vindo do post original).
- `userPrompt` (feed): inserir `${verifiableFactsBlock}` após "# NEGÓCIO"; se `pillar` veio, adicionar bloco "# PILAR DESTE POST — mantenha coerência: <label> — <description>".
- `systemPrompt` (feed): exigir `"pillar": "<id>"` no OUTPUT JSON, default ao pillar recebido. Adicionar checklist "cada número/case existe nos FATOS? Se não, reescreva como hipótese."
- `enrichedSystemPrompt` para feed e story: concatenar `+ renderPillarsBlock()`.
- Regra storytelling: se `pillar !== "bastidor"`, forçar `is_personal=false`.
- Story branch: também injetar `verifiableFactsBlock` no `storyUser` (regra anti-alucinação vale para stories também).

### 7. Bump de versão

- `supabase/functions/_shared/generatorVersion.ts`: `EDITORIAL_GENERATOR_VERSION = "2026-05-14-v8"`.
- `src/lib/generatorVersion.ts`: mesma constante + nova entrada no Histórico:
  > `2026-05-14-v8`: Sonnet 4.6 + bloco FATOS VERIFICÁVEIS (anti-alucinação) + 6 pilares editoriais com rotação anti-repetição + storytelling pessoal calibrado (máx 1 feed / 3 stories) + estratégia de profundidade tese→evidência→aplicação. Posts ganham campo `pillar`. Conteúdo anterior fica marcado como desatualizado.

---

## Resumo dos arquivos tocados

```text
supabase/functions/_shared/
  ├── claudeClient.ts                  (modelo)
  ├── buildClaudeContext.ts            (renderVerifiableFactsBlock + ajuste personal)
  ├── editorialPillars.ts              (NOVO — 6 pilares + rotação)
  ├── editorialSanitize.ts             (campo pillar)
  └── generatorVersion.ts              (bump v8)
supabase/functions/process-content-generation-job/index.ts
supabase/functions/regenerate-single-post/index.ts
src/lib/generatorVersion.ts            (bump v8 + histórico)
```

Não toco: questionário de negócio (frontend e DB), client.ts, types.ts, fluxo de créditos, persistência de semanas, fetch de tendências, sanitizer de stories.

## Riscos

- **Posts existentes sem `pillar`** → sanitizer marca como `"legacy"`, rotação ignora-os no cálculo (ou conta como "sem pilar"). Próximas semanas começam a popular.
- **Rotação no início** → primeiras 1–2 semanas todos os pilares estão vazios → `underrepresented` lista todos os 6 → modelo escolhe 4 livremente. Comportamento esperado.
- **`claude-sonnet-4-6` indisponível** → você confirmou que está em produção; sem fallback.