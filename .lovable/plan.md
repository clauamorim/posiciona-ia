## Ajuste de qualidade dos retratos

Edição única em `supabase/functions/generate-portrait/index.ts`:

### 1. Corrigir dimensões (896x1152 vertical)
No objeto `input` da `callFluxLora`:
- Remover `width: PORTRAIT_WIDTH` e `height: PORTRAIT_HEIGHT` (FLUX LoRA ignora silenciosamente).
- Adicionar `aspect_ratio: "3:4"` e `megapixels: "1"`.
- Manter as constantes `PORTRAIT_WIDTH/HEIGHT` apenas para referência nos logs.

### 2. loraScale adaptativo por nº de selfies
- Adicionar `selfies_count` no `select` da query `portrait_trainings`.
- Criar função `pickLoraScale(selfiesCount)`:
  - `≤ 12` → **0.82**
  - `13–20` → **0.88**
  - `≥ 21` → **0.93**
- Substituir o atual `const loraScale = 1.0` pelo valor calculado.

### 3. Aumentar guidance_scale
- `GUIDANCE_VARIATIONS`: `[2.6, 2.8, 3.0]` → **`[3.5, 3.8, 4.0]`**.

### 4. Aumentar refinamento
- `num_inference_steps`: `40` → **`45`**.

### 5. Logs aprimorados
- Incluir `selfiesCount` e `loraScale` calculado nos logs já existentes (sem novos `console.log`, apenas estender a string).

### Deploy
- Fazer `supabase--deploy_edge_functions` apenas para `generate-portrait`.

### Fora de escopo
- Não mexer em `portrait-train/index.ts`.
- Não chamar Claude/Anthropic.
- Não criar migração de banco (coluna `selfies_count` já existe).
- Não regenerar retratos automaticamente — usuária testará quando quiser.

### Resultado esperado (dataset de 12 selfies)
- Dimensões: 896x1152 vertical ✅
- loraScale: 0.82
- Mãos significativamente melhores
- Rosto mais natural, menos "decorado"