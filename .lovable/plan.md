## Plano aprovado — fidelidade máxima sem upscaler, 896×1152, download corrigido

### 1. `supabase/functions/generate-portrait/index.ts`
- **Deletar** `upscaleImage()` e toda a lógica do Clarity Upscaler.
- Garantir input do FLUX com `width: 896, height: 1152` (vertical premium).
- Pipeline: `predict FLUX → download bytes → upload Storage` em paralelo (`Promise.all` para os 3 retratos).
- Buscar `trigger_word` direto da tabela `portrait_trainings` em vez de reconstruir do `user_id`.
- Adicionar logs de diagnóstico: `trigger_word`, `training_id`, `lora_scale`, `guidance_scale`, dimensões.
- Tempo total esperado: ~25–35s.

### 2. `supabase/functions/_shared/portraitPrompts.ts`
- Trigger word como **primeiro token absoluto** do prompt.
- Reforços de identidade: `"preserve exact facial features, same person, identical face"`.
- `lora_scale`: **0.95** (mantido).
- `guidance_scale`: **3.0** (era 4.5).
- `outfitWeight`: **1.5** (era 2.0).
- Manter outfit duplicado (início + fim) para compensar guidance menor.

### 3. Download corrigido (cross-origin)
Aplicar helper `downloadAsBlob` de `src/lib/portraitUrl.ts` em:
- `src/pages/HistoryPage.tsx`
- `src/pages/MyGalleryPage.tsx`
- `src/pages/PortraitGenerator.tsx`
- `src/components/PortraitPreviewDialog.tsx`

### Sem alterações
- Schema, RLS, créditos da geração órfã `e5b951eb` (bônus mantido).
- Resolução final: **896×1152**.

### Arquivos editados
- `supabase/functions/generate-portrait/index.ts`
- `supabase/functions/_shared/portraitPrompts.ts`
- `src/pages/HistoryPage.tsx`
- `src/pages/MyGalleryPage.tsx`
- `src/pages/PortraitGenerator.tsx`
- `src/components/PortraitPreviewDialog.tsx`
