## Objetivo
Eliminar deformidades de mãos (problema universal do FLUX) escondendo-as nos enquadramentos, e aumentar fidelidade facial recalibrando o `loraScale` para cima.

## Arquivos a editar

### 1. `supabase/functions/_shared/portraitPrompts.ts`

**a) Reescrever `HAND_POSE_POOLS_BY_CATEGORY`** — substituir todas as poses por estratégias "mãos invisíveis":
- Mãos atrás das costas
- Mãos profundamente nos bolsos (calça, blazer)
- Braços cruzados com mãos escondidas sob os braços
- Mãos cortadas pelo enquadramento (out of frame)
- Segurando objeto que oculta dedos: caderno fechado contra o peito, xícara vista de lado, óculos dobrados, livro fechado
- Manter variedade entre as 3 categorias gestuais (assertiva / acolhedora / contemplativa) usando linguagem corporal de braços/ombros/postura, não de mãos

**b) Reforçar `STUDIO_NEGATIVE_BASE`** — adicionar termos:
- `visible fingers, exposed fingers, prominent hand details, fingertips, knuckles, deformed hands, extra fingers, fused fingers, malformed hands, mutated hands, missing fingers, six fingers`

### 2. `supabase/functions/generate-portrait/index.ts`

**Recalibrar `pickLoraScale()`** — subir todos os valores para aumentar fidelidade facial:
- `≤ 12` selfies → **0.90** (era 0.82)
- `13–20` selfies → **0.95** (era 0.88)
- `≥ 21` selfies → **1.00** (era 0.93)

Manter:
- `GUIDANCE_VARIATIONS = [3.5, 3.8, 4.0]` (já bom)
- `num_inference_steps = 45` (já bom)
- `aspect_ratio: "3:4" + megapixels: "1"` (já corrigido)

## Deploy
- `supabase--deploy_edge_functions` em `generate-portrait` (a função `_shared` é puxada automaticamente).

## Fora de escopo
- Não retreinar LoRA
- Não chamar Claude
- Não mudar UI
- Sem migração de banco

## Resultado esperado (12 selfies)
- 0% mãos deformadas (porque mãos não aparecem)
- Rosto significativamente mais fiel (loraScale 0.90 vs 0.82 atual)
- Risco: se loraScale 0.90 começar a "decorar" rosto de novo (textura artificial), reduzimos pra 0.86 num ajuste seguinte

## Custo
- Implementação: zero
- Próximo teste seu: ~$0.10 Replicate (3 retratos)