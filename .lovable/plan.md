## Três correções nos retratos

### 1. Microcopy — remover "Nano Banana Pro"

Em `src/pages/PortraitGenerator.tsx`:
- **Linha 438** (durante geração): *"Gerando seu(s) N retrato(s) com Nano Banana Pro. Leva cerca de 1 minuto — não feche esta aba."* → *"Gerando seu(s) N retrato(s). Leva cerca de 1 minuto — não feche esta aba."*
- **Linha 530** (antes de gerar): *"Vamos gerar N retrato(s) usando Nano Banana Pro com as suas referências..."* → *"Vamos gerar N retrato(s) a partir das suas referências..."*

### 2. Histórico não mostra retratos novos

**Causa raiz**: o novo `generate-portrait` salva `portraits` como array de **objetos** `{ storage_path, url, background, outfit, pose }`, mas `HistoryPage.tsx` (linha 60) ainda filtra apenas strings:
```ts
const imgs: string[] = Array.isArray(row.portraits) 
  ? row.portraits.filter((p: any) => typeof p === "string") : [];
```
Por isso as gerações novas são descartadas e somem do histórico.

**Correção** em `src/pages/HistoryPage.tsx` (linhas 56–67): aceitar ambos os formatos.
```ts
for (const item of row.portraits ?? []) {
  if (typeof item === "string") {
    legacyStrings.push(item);                     // legado: string
  } else if (item?.url) {
    flat.push({ url: item.url, ... });            // novo: já tem signed URL fresca? não — regerar
  } else if (item?.storage_path) {
    pathsToResolve.push(item.storage_path);       // novo: gera signedUrl on-demand
  }
}
```
Como as signed URLs salvas no banco expiram em 7 dias, sempre regerar via `resolvePortraitUrl(storage_path)` para o histórico — garante que continua funcionando depois de semanas.

### 3. Resultado parece artificial — refinar prompt do Nano Banana Pro

Em `supabase/functions/_shared/portraitPrompts.ts`, função `buildGeminiPortraitPrompt`:

**Adicionar/reforçar**:
- *"PHOTOGRAPHIC REALISM ONLY — this must look like a real photograph captured by a professional camera (Canon R5, 85mm f/1.4). Absolutely NOT 3D render, NOT CGI, NOT digital painting, NOT AI-stylized."*
- *"Skin: visible pores, fine lines, micro-tonal variations, natural asymmetry. Preserve every freckle, mole, mark, scar, and skin imperfection visible in the reference photos. Do NOT smooth, do NOT airbrush, do NOT beautify."*
- *"Facial geometry: copy EXACTLY from references — same nose shape and width, same eye shape and spacing, same jawline, same lip shape, same forehead proportions. Do NOT idealize features."*
- *"Age preservation: match exact apparent age in references — preserve eye creases, neck texture, expression lines. Do NOT regress age, do NOT make younger."*
- *"Lighting: soft natural studio lighting (large softbox, key + subtle fill), gentle falloff, realistic shadow density on neck and under jaw."*
- *"Negative prompt: plastic skin, doll-like, waxy texture, oversaturated, render look, cartoon, anime, illustration, beauty filter, Instagram filter, smoothing, blurred skin, perfect symmetry."*

Manter o IDENTITY LOCK existente, apenas reforçando esses pontos.

### Arquivos alterados

- `src/pages/PortraitGenerator.tsx` — duas trocas de string.
- `src/pages/HistoryPage.tsx` — corrige parser de `portraits` (suporta string legado + objeto novo).
- `supabase/functions/_shared/portraitPrompts.ts` — prompt mais detalhado para fotorrealismo e fidelidade às referências.

### O que não muda

- Schema do banco (já tem `engine`, `portraits` é JSONB flexível).
- Edge function `generate-portrait` (a estrutura salva continua correta).
- Modelo (continua Nano Banana Pro com fallback Nano Banana 2).
- Sem custos extras — só refinamento de prompt e correção de leitura no front.
