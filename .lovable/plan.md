## Diagnóstico

Comparando selfies de treino (1, 2, 6) × novos retratos (escuro-13, neutro-14, claro-16) × o retrato do Gemini (45-2) que era a referência boa:

**Problema 1 — Proporções faciais alteradas:**
- Selfie real: rosto oval, queixo definido e alongado, nariz fino, maçãs altas.
- Novos retratos: rosto **mais largo e arredondado**, queixo curto, nariz mais largo, lábios mais cheios. Parece "outra pessoa" da mesma família.
- Causa provável: a combinação **LoRA cliente em 0.78–0.85 + LoRA de realismo facial em 0.45** está empurrando a estrutura óssea para a média do FaceRealism LoRA (que tem viés próprio de rosto). A soma efetiva passou de 1.2 e está dominando a identidade.

**Problema 2 — Qualidade de pele inferior à do Gemini:**
- Retrato do Gemini (45-2): pele **nítida, com microcontraste**, textura natural, olhos cristalinos.
- Novos retratos: pele **lavada/borrada**, falta de definição em poros, olhos sem brilho. O FaceRealism LoRA está suavizando demais quando combinado com guidance baixo (2.0–2.8) e 28 steps.
- Causa provável: a redução agressiva de guidance + steps (feita para tirar o "plástico") cortou também a definição que a Gemini entregava.

**Não precisa retreinar o LoRA.** O treino está bom (semelhança geral preservada). O problema está na **inferência** (escala dos LoRAs + guidance + steps).

---

## Plano de correção

### 1. Reequilibrar o stack de LoRAs (`supabase/functions/generate-portrait/index.ts`)

Reduzir o peso combinado para preservar a estrutura óssea original da cliente:

| Parâmetro | Atual | Novo | Razão |
|---|---|---|---|
| LoRA cliente (≤12 selfies) | 0.78 | **0.95** | Devolve o controle da identidade ao LoRA da pessoa |
| LoRA cliente (13–20) | 0.82 | **1.00** | Idem |
| LoRA cliente (>20) | 0.85 | **1.05** | Idem |
| FaceRealism LoRA | 0.45 | **0.25** | Mantém só um toque de textura, sem capturar a estrutura |

### 2. Recuperar nitidez tipo Gemini

| Parâmetro | Atual | Novo | Razão |
|---|---|---|---|
| `num_inference_steps` | 28 | **35** | Mais steps = mais detalhe fino (poros, cílios, brilho do olho) |
| `guidance_scale` (3 looks) | [2.0, 2.4, 2.8] | **[2.8, 3.2, 3.6]** | Guidance maior melhora definição sem voltar ao "plástico" porque o FaceRealism caiu para 0.25 |
| `megapixels` | "1" | **"1"** (mantém) | Já no máximo do FLUX |

### 3. Refinar prompt/negative (`supabase/functions/_shared/portraitPrompts.ts`)

- Adicionar ao `QUALITY_SUFFIX`: `sharp focus on eyes, crisp eyelashes, defined facial bone structure, preserved facial proportions`.
- Adicionar ao `STUDIO_NEGATIVE_BASE`: `wide face, round face, short chin, altered face shape, different person, face morph, soft focus, blurry skin, washed out details`.

### 4. Logs de validação

Atualizar o log existente em `callFluxLora` para incluir o novo stack:
```
loraStack=[client:1.00, realism:0.25] steps=35 guidance=3.2
```
Permite confirmar nas próximas gerações que os parâmetros chegaram corretamente ao Replicate.

### 5. Atualizar memória

Ajustar `.lovable/memory/funcionalidades/retratos-marca.md` com os novos valores e a justificativa (LoRA da cliente domina identidade; FaceRealism só tempera textura).

---

## Arquivos modificados

- `supabase/functions/generate-portrait/index.ts` — escalas, steps, guidance
- `supabase/functions/_shared/portraitPrompts.ts` — quality suffix + negative
- `.lovable/memory/funcionalidades/retratos-marca.md` — documentação

## Validação

Após deploy, gerar uma rodada de 3 retratos e comparar:
1. Estrutura facial bate com as selfies de treino (queixo, nariz, formato do rosto).
2. Nitidez de pele/olhos próxima ao retrato do Gemini.
3. Sem volta do efeito "plástico" (a redução do FaceRealism para 0.25 é a margem de segurança).

Se ainda houver leve borrão, próximo passo é subir steps para 40. Se voltar plástico, baixar FaceRealism para 0.20.

**Sem retreino do LoRA.** Apenas ajuste de inferência.
