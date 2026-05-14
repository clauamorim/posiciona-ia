## Mudanças

### 1. `supabase/functions/_shared/portraitPrompts.ts` — `buildGeminiPortraitPrompt`

**(a) Reforço de pele anti-smoothing (item 1)**
Na linha que termina com `do NOT smooth, do NOT airbrush, do NOT beautify, do NOT apply ANY filter.` (atual linha 753, dentro do bloco IDENTITY LOCK), estender com:
> `Preserve visible skin pores, natural micro-texture variation, fine expression lines around the eyes and mouth, subtle uneven skin tone and natural skin grain exactly as photographed in the references. A macro loupe on the final image should reveal the same skin texture as the reference photo — not smoother, not cleaner, not more uniform.`

**(b) Compactar bloco AVOID (item 2)**
Substituir o `sceneParts.push(\`AVOID at all costs: ...\`)` final (linhas 759–761) pela versão curta fornecida.

**(c) Reforço foto-realista no IDENTITY LOCK (item 3)**
Logo após `### CRITICAL IDENTITY LOCK — THIS OVERRIDES EVERYTHING ABOVE ###`, inserir como nova entrada antes do parágrafo "FIRST reference image is the PRIMARY identity reference":
> `This is a PHOTOGRAPHIC REPRODUCTION, not a portrait painting. The goal is forensic accuracy to the reference, not aesthetic improvement. Any deviation from the reference — smoother skin, younger appearance, more symmetrical features, brighter eyes, thinner face — is a failure, not an enhancement.`

**(d) Suporte a âncora de idade**
- Adicionar campo opcional `apparentAgeRange?: "20s" | "30s" | "40s" | "50s" | "60s+"` em `GeminiPromptParams`.
- Quando presente, injetar logo no início do `sceneParts` (após o bloco PHOTOGRAPHIC REALISM) uma frase: `Subject is a ${gender|person} apparently in their ${range}. The output MUST match this exact apparent age — do not regress, do not age up.`
- Se ausente, não injeta nada (mantém comportamento atual).

### 2. `supabase/functions/generate-portrait/index.ts` — detecção de idade

Atualmente `buildGeminiPortraitPrompt` não recebe idade alguma. Vamos:

**(a)** Adicionar helper `detectApparentAgeRange(apiKey, referenceDataUrl)` que faz UMA chamada ao Lovable AI Gateway com `google/gemini-3-flash-preview` (texto puro, modalidade text), usando o prompt:
> `Look at this photo and estimate the apparent age range of the person. Reply with ONLY one of these values: "20s", "30s", "40s", "50s", "60s+". Nothing else.`

Valida o retorno contra a enum; se inválido/erro/timeout → retorna `"40s"`.

**(b)** Antes do `Promise.all` que gera os retratos (linha ~276), chamar `detectApparentAgeRange` uma única vez usando a primeira reference data URL. Logar resultado.

**(c)** Passar `apparentAgeRange: detected` em todos os 3 calls de `buildGeminiPortraitPrompt`.

### 3. `src/pages/PortraitGenerator.tsx` — orientação de qualidade (item 5)

Editar o `<p>` da linha 423–425 para adicionar (como segundo parágrafo dentro do mesmo `CardContent`, mantendo o texto atual) o trecho:
> `Para melhores resultados: use fotos com iluminação frontal uniforme (sem sombras duras no rosto), uma foto de frente, uma de 3/4 e uma de perfil leve. Rosto deve ocupar ao menos 60% do frame. Sem filtros, sem óculos escuros, boa resolução.`

## Fora de escopo (intocado)
- `PRIMARY_MODEL` / `FALLBACK_MODEL`, fluxo de chamada do Gateway
- Pools de poses/outfits/backgrounds
- Créditos, storage, RLS, migrations
- Krea/Flux builder (`buildPortraitPrompt`) — só o builder Gemini muda