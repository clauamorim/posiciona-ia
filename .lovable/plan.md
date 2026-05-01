## Objetivo

Eliminar de vez a "pele plástica" trocando o modelo base pelo **FLUX.1 Krea [dev]** — modelo oficial da Black Forest Labs treinado especificamente para combater o "look de IA". Aproveitar a migração para simplificar o pipeline (prompt curto, parâmetros default, um único LoRA).

## Por que Krea

- Krea foi lançado pela própria BFL como resposta ao viés conhecido do FLUX-dev (pele de cera, oversaturação). Não é workaround — é a solução nativa.
- Mesma família arquitetural do FLUX-dev. Migração de baixo risco.
- Custo menor que o atual ($0.025/imagem no endpoint oficial vs $0.047 hoje no `lucataco/flux-dev-multi-lora`).
- Suporte a LoRA via trainer oficial Krea (`ostris/flux-krea-lora-trainer`).

## Decisão sobre LoRA: retreinar todas as clientes

Como retreino está liberado, o caminho fica limpo:

- Trainer novo: **`ostris/flux-krea-lora-trainer`** (mesma família ostris, mesmo formato de input — zip de selfies — só muda o modelo base que ele fine-tuna).
- LoRA Krea só funciona em modelo base Krea. LoRAs antigas (FLUX-dev) ficam órfãs após a migração.
- Retreino é gratuito do ponto de vista da cliente (nós absorvemos), mas o custo Replicate é equivalente ao treino atual (~$2). Como retreinos são finitos (uma vez por cliente existente, depois nunca mais), está dentro do orçamento.

## Mudanças

### 1. `supabase/functions/portrait-train/index.ts`

Trocar trainer:
```ts
const TRAINER_OWNER = "ostris";
const TRAINER_NAME = "flux-krea-lora-trainer"; // era flux-dev-lora-trainer
```

Sem mudanças no resto (zip builder, webhook, custo de créditos).

### 2. `supabase/functions/generate-portrait/index.ts`

Trocar endpoint de inferência para wrapper Krea + LoRA (a confirmar exato no momento do build via API call de teste — `replicate/fast-flux-trainer` family ou wrapper community equivalente). Simplificar parâmetros:

| Constante | Atual | Novo |
|---|---|---|
| Modelo | `lucataco/flux-dev-multi-lora` | wrapper Krea + LoRA |
| `FACE_REALISM_LORA` | `Canopus-LoRA-Flux-FaceRealism` | **removido** |
| `FACE_REALISM_SCALE` | `0.40` | **removido** |
| `pickLoraScale` | `0.90 / 0.95 / 1.00` | `1.0` fixo |
| `GUIDANCE_VARIATIONS` | `[2.6, 3.0, 3.4]` | `[3.0]` (default Krea) |
| `NUM_INFERENCE_STEPS` | `35` | `28` (default) |

Mantém: `aspect_ratio` 3:4, `output_format` png, custo de 3 créditos, fluxo de download/upload pro Storage privado.

### 3. `supabase/functions/_shared/portraitPrompts.ts`

Cortar prompts pela metade. Krea funciona melhor com instruções enxutas — quanto menos prompt, menos o modelo briga consigo mesmo.

- **`STUDIO_PREFIX`**: enxugar para `"editorial portrait photograph"`.
- **`QUALITY_SUFFIX`**: ~10 tokens essenciais — `"natural skin texture, soft daylight, shallow depth of field, 50mm lens"`. Remover toda a ladainha de `unretouched skin`, `visible skin pores`, `peach fuzz`, `crisp eyelashes`, etc. — Krea entrega isso por default.
- **`STUDIO_NEGATIVE_BASE`**: cortar para o estrutural — `"plastic skin, airbrushed, cgi, deformed, asymmetric eyes, distorted proportions"`. Remover repetições.
- **Templates de arquétipo**: manter só descrição de cena (look + pose + ambiente). Sem reforço de textura/realismo.

### 4. Migração de dados

Marcar todas as `replicate_lora_url` existentes como `legacy` (campo novo `lora_model_base` ou similar — a definir no momento do build). Cliente com LoRA `legacy` precisa retreinar antes de gerar — UI mostra CTA "Reanalisar selfies (gratuito)".

Subtarefas:
- Migration: adicionar coluna `lora_model_base` (`text`, default `'flux-krea-dev'`, valor `'flux-dev'` para registros existentes).
- `generate-portrait` rejeita LoRAs `flux-dev` com mensagem clara.
- UI no `PortraitGenerator` detecta o legacy e oferece retreino em 1 clique (sem cobrança extra).

### 5. `.lovable/memory/funcionalidades/retratos-marca.md`

Reescrever:
- Modelo base: FLUX.1 Krea [dev].
- Stack: 1 LoRA (Client only). Sem realism stacking.
- Trainer: `ostris/flux-krea-lora-trainer`.
- Filosofia: "deixar Krea entregar textura, não brigar via prompt".
- Migração legacy documentada.

## Validação

Antes de marcar concluído:

1. **Smoke test curl** no novo endpoint de inferência com LoRA Krea recém-treinada.
2. **Treino de teste**: rodar `portrait-train` numa selfie set conhecida e confirmar que o output é Krea-compatível.
3. **Comparativo lado a lado**: 3 retratos da mesma cliente (Krea novo vs FLUX-dev anterior). Critérios:
   - Pele com poros visíveis em zoom 100%, sem brilho de cera.
   - Identidade preservada (rosto reconhecível).
   - Estrutura facial estável (olhos alinhados, sem inflação).
4. **Fluxo legacy**: simular cliente com LoRA antiga e confirmar que UI bloqueia gerar e oferece retreino.

## Rollback

- Reverter as 4 constantes (`TRAINER_NAME`, modelo de inferência, prompts, parâmetros) volta ao estado atual.
- Migração de coluna fica — não atrapalha o estado anterior (default value cobre).
- LoRAs novas treinadas em Krea ficariam órfãs, mas são minoria nesse cenário.

Risco geral: baixo. Maior incerteza é a estética opinionada do Krea — só validando lado a lado pra confirmar que bate com o tom editorial do produto.
