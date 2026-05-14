## Alterações em 3 arquivos

### 1. `supabase/functions/_shared/cors.ts`
Adicionar `DELETE` à lista `Access-Control-Allow-Methods`.

### 2. `supabase/functions/generate-portrait/index.ts`
- 2a. `MAX_REFERENCES_TO_SEND`: `5` → `3` (já está em 3 atualmente segundo o arquivo, confirmar e manter).
- 2b. Em `generateOnePortrait`: inverter ordem de `userContent` para imagens antes do texto (já aplicado anteriormente — confirmar e manter).
- 2c. Trocar a geração `Promise.all` por loop sequencial `for`, com early-break em status 402/429.

### 3. `supabase/functions/_shared/portraitPrompts.ts` — em `buildGeminiPortraitPrompt`
- 3a. Adicionar constante `GEMINI_BACKGROUNDS` (3 entradas neutro/claro/escuro) antes de `const subject = ...`.
- 3b. Trocar `BACKGROUND_VARIATIONS[params.backgroundIndex]` por `GEMINI_BACKGROUNDS[params.backgroundIndex]` (mantém `FRAMING_VARIATIONS`).
- 3c. Substituir primeiro item de `sceneParts` por versão "DOCUMENTARY PORTRAIT PHOTOGRAPH / Kodak Portra 400".
- 3d. Substituir diretriz `Lighting:` por versão "window-style softbox at 45°".

### Fora do escopo
Nenhuma outra mudança em prompts, cobrança, upload ou UI.
