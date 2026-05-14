# Plano: Questionário de História de Venda + Stories de Venda + Integração Editorial

Três frentes, todas independentes do fluxo atual quando o questionário novo está vazio (zero regressão).

---

## 1. Banco de dados (1 migration)

**`sales_narrative_questionnaires`** (1 registro por usuário, sem versionamento):
- `user_id`, `previous_profession`, `career_turn`, `negative_comments`, `audience_objections`, `proof_cases`, `personal_expressions`, `forbidden_topics`, `start_year_motivation`
- `status` ('draft'/'submitted'), `is_complete` (bool default false), timestamps
- RLS: dono CRUD próprio; admin SELECT all

**`sales_story_sequences`** (histórico):
- `user_id`, `sequence_type` (CHECK in 7 valores), `offer_context`, `stories` (jsonb), `generated_at`, `created_at`
- RLS: dono SELECT/INSERT/DELETE; admin SELECT all

---

## 2. Backend

### 2a. `_shared/salesStoryPrompts.ts` (novo)
- `SALES_STORY_SYSTEM_PROMPT` com os 7 templates literais da spec
- `buildSalesStoryUserPrompt(narrative, business, personal, sequence_type, offer_context)`

### 2b. `generate-sales-stories/index.ts` (nova edge function)
- Valida JWT + body Zod `{ sequence_type, offer_context }`
- Verifica que `sales_narrative_questionnaires.is_complete = true`
- Lê narrative + business + personal (highest version)
- `consume_credit('regeneration', -1, 'Stories de venda')` — reaproveita pool de ajustes (MVP)
- `callClaude` (modelo padrão, max_tokens 3000)
- `extractJson` → `{ stories: [...] }` → INSERT em `sales_story_sequences` → retorna

### 2c. Integração com linha editorial (sem quebrar nada)

**`_shared/narrativePrinciples.ts`** — append seção "VOZ DO CRIADOR (quando narrativa de venda estiver preenchida)" com regras: expressões pessoais orgânicas, forbidden_topics inviolável, objeções literais entre aspas.

**`process-content-generation-job/index.ts`**:
1. Adicionar leitura opcional de `sales_narrative_questionnaires` ao lado das demais (try/catch defensivo)
2. Se existir e `is_complete=true`, injetar no **user prompt** (não no system, para não inflar tokens quando vazio) o bloco `## NARRATIVA DE VENDA DO CRIADOR (use quando aplicável)` com apenas os campos não-vazios
3. Adicionar ao system prompt (após princípios narrativos) instruções condicionais: usar expressões naturalmente, jamais tocar em forbidden_topics, usar objeções literais entre aspas, citar proof_cases reais, posts de jornada/origem a cada 4-6 semanas

**Garantia de não-regressão**: registro inexistente ou incompleto → prompt sai exatamente como hoje.

CORS via `_shared/cors.ts`. Sem alteração em `supabase/config.toml`.

---

## 3. Frontend

### 3a. Rotas em `src/App.tsx` (ProtectedRoute requirePlan)
- `/sales-narrative` → `SalesNarrativeQuestionnaire`
- `/stories-de-venda` → `SalesStoriesPage`

### 3b. `pages/SalesNarrativeQuestionnaire.tsx`
- Estrutura visual espelhada de `PersonalQuestionnaire.tsx`
- Banner topo: opcional, ~10 min, alimenta Stories de Venda **e enriquece a linha editorial**
- 8 textareas opcionais com labels/placeholders/helps da spec
- Autosave debounced (status `draft`)
- Botões: "Salvar e gerar minha primeira sequência" (`is_complete=true`, `status='submitted'`, → `/stories-de-venda`) | "Salvar e voltar depois" (→ `/dashboard`)

### 3c. `pages/SalesStoriesPage.tsx`
- Se narrativa não preenchida: banner + CTA "Preencher agora"
- **Lista de sequências geradas — cada card mostra:**
  - Tipo amigável (ex.: "Quebrando objeções com narrativa")
  - Data de geração
  - **`offer_context` informado** (ex.: "Mentoria de 3 meses") — destaque visual para diferenciar sequências
  - Preview das primeiras ~12 palavras do Story 1
- Botão "Gerar nova sequência" → Dialog:
  - RadioGroup com 7 opções (label + 1 linha de descrição)
  - Textarea: "O que você está vendendo nessa sequência?"
  - Botão "Gerar sequência" → invoca edge function
- Visualização da sequência: stories numerados, badge de tipo (abertura/desenvolvimento/CTA), Copiar individual + "Copiar sequência inteira"

### 3d. `components/DashboardLayout.tsx`
- Item "Stories de Venda" no grupo "Sua jornada", **após "Linha Editorial"**, ícone `MessageSquareQuote` (evita colisão com `Sparkles` de "Sua História")

---

## 4. Créditos (MVP)

Reaproveitar `regeneration_credits`. 1 crédito por sequência via `consume_credit` RPC existente.

**Trade-off conhecido a revisitar em 30-60 dias**: 1 crédito gera 9 stories (Bio) vs 1 post editorial — risco de esvaziar pool de ajustes mais rápido. Se virar gargalo nos dados de uso, criar `sales_story_credits` separado ou cobrar 2 créditos por sequências longas. Documentar como follow-up no memory após implementação.

---

## 5. NÃO tocar

- `PersonalQuestionnaire`, `BusinessQuestionnaire`, `ArchetypeQuestionnaire`
- Estrutura de `reports`, `editorial_weeks`, `report_generation_jobs`
- `generate-content-week`, `regenerate-single-post` (apenas `process-content-generation-job` recebe injeção condicional)
- Auth, Stripe, ProtectedRoute

---

## Resumo de arquivos

```text
Migration
├── sales_narrative_questionnaires (+ RLS)
└── sales_story_sequences (+ CHECK + RLS)

Edge functions
├── _shared/salesStoryPrompts.ts                 (novo)
├── _shared/narrativePrinciples.ts               (append VOZ DO CRIADOR)
├── generate-sales-stories/index.ts              (novo)
└── process-content-generation-job/index.ts      (lê narrative opcional + bloco/instruções condicionais)

Frontend
├── App.tsx                                       (+2 rotas)
├── components/DashboardLayout.tsx                (+1 nav item após Linha Editorial)
├── pages/SalesNarrativeQuestionnaire.tsx        (novo)
└── pages/SalesStoriesPage.tsx                   (novo, cards com offer_context visível + preview)
```

Plano aprovado? Posso implementar.
