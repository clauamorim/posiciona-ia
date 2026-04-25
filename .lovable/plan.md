## Plano aprovado — corrigir fidelidade facial, latência, payload, download e órfãos

### 1. `supabase/functions/generate-portrait/index.ts`
- Restaurar `lora_scale: 0.95` em todos os casos (era 0.80 quando havia override).
- Quando há override de figurino:
  - `guidance_scale`: 3.5 → **4.5**.
  - Outfit aparece **2x no prompt** (após trigger word + reforço final).
  - Wrap de peso outfit: `(outfit:1.4)` → **`(outfit:2.0)`**.
  - Negativos semânticos dinâmicos mantidos.
- Reduzir delay entre upscales: **11s → 6s**; manter retry com backoff 30s para 429.
- Paralelizar download dos bytes upscalados + upload para Storage (após upscale sequencial).
- Resposta retorna **paths do Storage** (`{user_id}/{generation_id}/N.png`) em vez de base64.
- Garantir `await` em `update user_balances` e `insert portrait_generations` ANTES de retornar JSON.

### 2. `src/pages/PortraitGenerator.tsx`
- Substituir `supabase.functions.invoke` por `fetch` nativo com `AbortController` de **240s**.
- Adaptar parsing: chamar `resolvePortraitUrls()` nos paths retornados.
- Recovery de órfãos no mount: listar `portrait-outputs/{user_id}/` no Storage, cruzar com `portrait_generations.portraits` e criar registros faltantes (sem debitar créditos).
- Trocar handlers de download para usar novo helper `downloadAsBlob`.

### 3. `src/lib/portraitUrl.ts`
- Adicionar helper `downloadAsBlob(url, filename)` que faz `fetch` → blob → object URL → `<a download>` para contornar problema cross-origin.

### 4. `src/components/PortraitPreviewDialog.tsx`
- Atualizar handler de download para usar `downloadAsBlob`.

### 5. `src/pages/MyGalleryPage.tsx` (e `HistoryPage.tsx` se aplicável)
- Substituir `handleDownload` atual pelo helper `downloadAsBlob`.

### Sem alterações
- Schema do banco, RLS, créditos da geração órfã `e5b951eb` (fica como bônus, não debitar).

### Arquivos editados/criados
- `supabase/functions/generate-portrait/index.ts`
- `src/pages/PortraitGenerator.tsx`
- `src/lib/portraitUrl.ts`
- `src/components/PortraitPreviewDialog.tsx`
- `src/pages/MyGalleryPage.tsx`
- `src/pages/HistoryPage.tsx` (se houver download de retratos)
