## Plano final consolidado — Humanização da Linha Editorial

### 1. Tabela `personal_questionnaires`
- Migração com colunas: `id`, `user_id`, `version`, `status` ('draft'|'submitted'), `is_complete`, `created_at`, `updated_at`.
- Bloco 1 (Vida pessoal): `hobby`, `pets`, `sports`, `dependents`, `sunday_morning`.
- Bloco 2 (Bastidores profissionais): `proud_moment`, `failure_lesson`, `work_routine`, `pre_meeting_ritual`, `unblock_method`.
- Bloco 3 (Valores e visão): `defended_belief`, `social_cause`, `desired_feeling`, `guiding_belief`.
- Bloco 4 (Memórias): `formative_story`, `biggest_influence`, `advice_to_20yo`.
- RLS padrão (próprio user + admin). Versionamento `max(version)+1`.

### 2. Página `src/pages/PersonalQuestionnaire.tsx`
- 4 etapas no padrão do questionário de negócio.
- Aviso inicial: "Suas respostas serão usadas para humanizar seus posts. Histórias sensíveis podem aparecer publicamente." + checkbox de aceite.
- Salva `draft` por passo, finaliza como `submitted`.

### 3. Bloqueio: Linha Editorial exige questionário pessoal preenchido
- Backend (`generate-content-week`): valida `personal_questionnaires` submitted antes de criar job. Sem registro → `412 { error, redirect: "/personal-questionnaire" }`.
- Frontend (`EditorialPage.tsx` + `Dashboard.tsx`): botão "Gerar semana" desabilitado com tooltip; card de bloqueio com CTA "Preencher Sua História →"; tratamento do 412 com toast + redirect.
- Dashboard "Próximo passo": passa a indicar "Conte sua história" quando faltar.

### 4. Navegação
- Rota `/personal-questionnaire` (ProtectedRoute + requirePlan) em `App.tsx`.
- Item "Sua História" no grupo Diagnóstico do `DashboardLayout`.
- Card de incentivo no Dashboard quando ainda não preenchido.

### 5. Migração para Claude Sonnet 4
- Solicitar `ANTHROPIC_API_KEY` via add_secret.
- Criar `supabase/functions/_shared/claudeClient.ts` (`callClaude({ system, messages, max_tokens, pdfs })`).
- Criar `supabase/functions/_shared/buildClaudeContext.ts` (`buildClaudeContextBlocks({ business, storybrand, archetypes, personal, pdfs })`) — garante PDFs + contexto pessoal em toda chamada.
- Migrar Gemini → Claude em: `process-content-generation-job`, `regenerate-single-post`, `generate-report`.
- Manter Gemini para imagens (`generate-portrait`, `fetch-post-image`).

### 6. Prompt humanizado
Toda chamada ao Claude para conteúdo editorial inclui:
1. System prompt editorial.
2. PDFs de referência (StoryBrand, Made to Stick, Obviously Awesome) anexados via `content[].type=document`.
3. Bloco `# CONTEXTO PESSOAL DO CRIADOR` com as 16 respostas (campos vazios omitidos).
4. Bloco de negócio + StoryBrand + arquétipos.

Instrução adicional: "Reserve 1–2 dias da semana para posts em formato storytelling, tecendo paralelos entre a vida pessoal/história do criador e as dores do cliente-alvo. Nunca invente fatos."

### 7. Versionamento
- Bump em `supabase/functions/_shared/generatorVersion.ts` e `src/lib/generatorVersion.ts` para `2026-04-25-v5` — semanas antigas elegíveis para regeneração gratuita.

### Arquivos
**Novos:** migração SQL, `PersonalQuestionnaire.tsx`, `claudeClient.ts`, `buildClaudeContext.ts`.
**Editados:** `App.tsx`, `DashboardLayout.tsx`, `Dashboard.tsx`, `EditorialPage.tsx`, `generate-content-week`, `process-content-generation-job`, `regenerate-single-post`, `generate-report`, `generatorVersion.ts` (frontend e shared).

### Ordem de execução
1. Migração + página + navegação + bloqueio (independe da chave Claude).
2. Solicitar `ANTHROPIC_API_KEY`.
3. Após chave: `claudeClient`, `buildClaudeContext`, migrar 3 edge functions, bump v5.