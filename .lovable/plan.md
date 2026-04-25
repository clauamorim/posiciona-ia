## Corrigir fluxo de redirecionamento + mitigar rate limit do Claude

### 1. Corrigir redirecionamento dos questionários
- **`src/pages/BusinessQuestionnaire.tsx`**: trocar redirect final de `/archetype-questionnaire` para `/personal-questionnaire`.
- **`src/pages/PersonalQuestionnaire.tsx`**: garantir que após submit redireciona para `/archetype-questionnaire`.

### 2. Reduzir contexto do `generate-report` (causa do 429)
- **`supabase/functions/generate-report/index.ts`**: remover a chamada a `fetchEditorialReferencePdfs()` e parar de enviar os PDFs de StoryBrand/Made to Stick/Obviously Awesome. O Claude já conhece o framework BrandScript nativamente — reforçar 2-3 parágrafos descritivos no system prompt se necessário.
- PDFs de referência continuam ativos nas funções de Linha Editorial (`generate-content-week`, `regenerate-single-post`, `process-content-generation-job`).

### 3. Retry exponencial no cliente Claude
- **`supabase/functions/_shared/claudeClient.ts`**: adicionar retry automático para erros 429 (rate limit) e 529 (overloaded). 3 tentativas com backoff: 2s, 5s, 10s. Se esgotar, propaga erro com `userMessage` amigável.

### 4. UX de erro no frontend
- **`src/pages/Results.tsx`**: detectar erros 429/"rate limit"/"overloaded" e exibir mensagem específica ("A IA está com alta demanda agora. Aguarde um instante e tente novamente.") com botão **Tentar novamente** que reinvoca a geração.

### 5. Deploy
- Redeploy de `generate-report` (suficiente para resolver o erro reportado; outras funções pegam o retry no próximo deploy delas).

### Dados existentes
Respostas em `business_questionnaires` e `archetype_answers` permanecem intactas — nenhuma migration necessária.