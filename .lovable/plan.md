## Plano aprovado

### 1. Frontend (`src/pages/PortraitGenerator.tsx`)
- Remover estado `outfitOverrides` e setters relacionados.
- Remover botão "Personalizar figurinos" e o dialog/modal correspondente.
- Remover envio de `outfit_overrides` no body da chamada `supabase.functions.invoke('generate-portrait', ...)`.
- Remover a descrição do figurino (`enToPtFashion(outfits[i])`) que aparece embaixo de cada retrato. Manter os badges de background.

### 2. Backend (`supabase/functions/generate-portrait/index.ts`)
- Apagar o bloco que lê `body.outfit_overrides`.
- Apagar a constante `GUIDANCE_VARIATIONS_OVERRIDE` e todo o ramo `isUserOverride`.
- Sempre usar pool curado: `pickOutfits(family, profCategory, recentlyUsedOutfits, 3)`. Fallback ao `buildOutfitTextForLook(figurino, i)` se pool vazio.
- `lora_scale`: **1.0** (era 0.95) — peso máximo do LoRA.
- `guidance_scale` unificado: **2.6, 2.8, 3.0** (era 2.8/3.0/3.2).
- Manter `num_inference_steps: 40` e resolução 896×1152.

### 3. Prompts (`supabase/functions/_shared/portraitPrompts.ts`)
- **Trigger duplicado** no início: `"${triggerWord}, portrait of ${triggerWord}, ..."`.
- Adicionar tokens de identidade real: `"authentic skin pores, natural skin texture, distinctive facial structure, real person photograph, unretouched skin, exact facial features, identical face to reference"`.
- Reduzir `outfitWeight` 1.5 → **1.2**.
- **Negative prompt** reforçado: `"generic face, idealized face, ai-generated face, plastic skin, airbrushed skin, beauty filter, smoothed skin, different person, face swap, average face"`.
- Poses, olhar e backgrounds inalterados.

### Sem alteração
- Schema, créditos, RLS, pipeline paralelo, download blob.
- Pool curado (`outfitPool.ts`) + memória curta (`recentlyUsedOutfits`).
- Resolução 896×1152.

### Arquivos editados
- `src/pages/PortraitGenerator.tsx`
- `supabase/functions/generate-portrait/index.ts`
- `supabase/functions/_shared/portraitPrompts.ts`