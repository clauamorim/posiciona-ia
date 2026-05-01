## Objetivo

Eliminar distorções faciais (olhos assimétricos, rosto inflado, pescoço inexistente) que apareceram no retrato escuro-14, mantendo a nitidez tipo Gemini conquistada na rodada anterior.

## Diagnóstico

O retrato problemático foi gerado com guidance 3.6 + LoRA cliente 1.05 — combinação no limite superior do FLUX-dev, propensa a colapsar em assimetria facial. Os outros dois looks (guidance 2.8 e 3.2) ficaram bons. Solução: descer ambos os tetos um degrau e reforçar o negative.

## Mudanças

### 1. `supabase/functions/generate-portrait/index.ts`

| Constante | Atual | Novo |
|---|---|---|
| `GUIDANCE_VARIATIONS` | `[2.8, 3.2, 3.6]` | `[2.6, 3.0, 3.4]` |
| `pickLoraScale` ≤12 | `0.95` | `0.90` |
| `pickLoraScale` 13–20 | `1.00` | `0.95` |
| `pickLoraScale` >20 | `1.05` | `1.00` |

`FACE_REALISM_SCALE` (0.25), `NUM_INFERENCE_STEPS` (35) permanecem.

### 2. `supabase/functions/_shared/portraitPrompts.ts`

Adicionar ao `STUDIO_NEGATIVE_BASE`:
```
, asymmetric eyes, uneven eyes, crooked eyes, tilted eye line, asymmetric eyebrows, no neck, missing neck, distorted facial proportions, inflated cheeks, wide jaw
```

### 3. `.lovable/memory/funcionalidades/retratos-marca.md`

Atualizar valores documentados (escalas LoRA, guidance) e a justificativa (descida feita após distorção em guidance 3.6 + LoRA 1.05).

## Validação

Após deploy, gerar nova rodada de 3 retratos e conferir:
- Eixo horizontal dos olhos alinhado em todos os looks.
- Sobrancelhas com densidade equivalente.
- Transição visível entre queixo e gola (pescoço não "engolido").
- Nitidez de pele/olhos preservada (não voltar ao "lavado").

Se a nitidez cair perceptivelmente, próximo passo é subir steps para 40 (sem mexer em guidance).
