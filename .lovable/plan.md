## Objetivo

Eliminar a "pele plástica" migrando o pipeline de retratos para **Fal.ai**, usando dois endpoints especializados:

- **Treino:** `fal-ai/flux-lora-portrait-trainer` (trainer otimizado pra rosto — brilho de olho, semelhança, detalhe).
- **Inferência:** `fal-ai/flux-krea-lora` (Krea = modelo BFL anti-"look de IA", com suporte oficial a LoRA).

Aproveitar a migração para simplificar prompts e parâmetros.

## Por que Fal.ai (e não Replicate)

A pesquisa anterior travou no Replicate porque **Krea + LoRA não tem endpoint oficial lá** — exigiria wrapper Cog custom (semanas de trabalho). Na Fal isso já existe pronto, em produção, e ainda por cima:

- Custo menor: **$0.035/MP** (vs ~$0.047 hoje no Replicate).
- **Trainer especializado em portrait** — nosso uso é literalmente isso.
- API estável, webhook nativo, SDK simples.

Trade-off honesto: precisamos adicionar `FAL_KEY` como secret, e migrar a integração de Replicate → Fal em duas funções. Sem migração de banco complexa.

## Decisão sobre LoRAs existentes

Retreino para todas as clientes (você liberou). Trainer novo é **melhor que o atual em portrait**, então o retreino entrega valor — não é só custo de migração. Custo Fal de treino: ~$2.40 por cliente (1000 steps × $0.0024).

## Mudanças

### 1. Secret novo

- Adicionar `FAL_KEY` (pedimos via tool de secrets antes de começar a codar).

### 2. `supabase/functions/portrait-train/index.ts`

Trocar provider de Replicate para Fal:

- Endpoint: `https://queue.fal.run/fal-ai/flux-lora-portrait-trainer`
- Input: zip de selfies (mesmo formato que já montamos hoje).
- Webhook: Fal suporta webhook nativo via header `fal-webhook` — apontar pra `portrait-webhook` (já existe).
- Output: URL do `.safetensors` da LoRA — salvar em `replicate_lora_url` (mantém nome da coluna pra evitar churn; é só um identificador).

Sem mudanças no fluxo de créditos ou no zip builder.

### 3. `supabase/functions/portrait-webhook/index.ts`

Adaptar parser do payload pra formato Fal (campo `diffusers_lora_file.url` em vez do shape Replicate). Continuar gravando na mesma coluna.

### 4. `supabase/functions/generate-portrait/index.ts`

Trocar endpoint de inferência:

- Endpoint: `https://queue.fal.run/fal-ai/flux-krea-lora`
- Input principal: `prompt`, `loras: [{ path: <url da LoRA da cliente>, scale: 1.0 }]`, `image_size`, `num_inference_steps`, `guidance_scale`.

Simplificar parâmetros:

| Constante | Atual | Novo |
|---|---|---|
| Provider | Replicate | Fal.ai |
| Modelo | `lucataco/flux-dev-multi-lora` | `fal-ai/flux-krea-lora` |
| `FACE_REALISM_LORA` | `Canopus-LoRA-Flux-FaceRealism` | **removido** |
| `FACE_REALISM_SCALE` | `0.40` | **removido** |
| `pickLoraScale` | `0.90 / 0.95 / 1.00` | `1.0` fixo |
| `GUIDANCE_VARIATIONS` | `[2.6, 3.0, 3.4]` | `[3.0]` (default Krea) |
| `NUM_INFERENCE_STEPS` | `35` | `28` |

Mantém: aspect ratio 3:4, output png, custo de 3 créditos, fluxo de download/upload pro Storage privado.

### 5. `supabase/functions/_shared/portraitPrompts.ts`

Encurtar drasticamente — Krea entrega textura nativa, prompt longo só atrapalha:

- **`STUDIO_PREFIX`**: `"editorial portrait photograph"`.
- **`QUALITY_SUFFIX`**: `"natural skin texture, soft daylight, shallow depth of field, 50mm lens"` (~10 tokens).
- **`STUDIO_NEGATIVE_BASE`**: `"plastic skin, airbrushed, cgi, deformed, asymmetric eyes, distorted proportions"`.
- **Templates de arquétipo**: manter só descrição de cena (look + pose + ambiente). Sem reforço de textura.

### 6. Migração de dados

Adicionar coluna `lora_provider` (`text`, default `'fal'`, valor `'replicate'` para registros existentes). Cliente com `lora_provider = 'replicate'` precisa retreinar antes de gerar.

Subtarefas:
- Migration: nova coluna + backfill.
- `generate-portrait` rejeita LoRAs `replicate` com mensagem clara.
- UI no `PortraitGenerator`: detecta legacy e oferece "Reanalisar selfies (gratuito)" em 1 clique.

### 7. `.lovable/memory/funcionalidades/retratos-marca.md`

Reescrever:
- Provider: Fal.ai.
- Treino: `fal-ai/flux-lora-portrait-trainer` (otimizado pra rosto).
- Inferência: `fal-ai/flux-krea-lora` (1 LoRA, scale 1.0, sem stacking).
- Filosofia: "Krea entrega textura, trainer entrega semelhança — prompt fica fora do caminho".
- Migração legacy documentada.

## Validação

Antes de marcar concluído:

1. **Smoke test curl** no `flux-krea-lora` com uma LoRA Fal recém-treinada.
2. **Treino de teste**: rodar `portrait-train` numa selfie set conhecida e confirmar webhook + URL da LoRA.
3. **Comparativo lado a lado**: 3 retratos da mesma cliente (Krea+Fal novo vs Replicate atual). Critérios:
   - Pele com poros visíveis em zoom 100%, sem brilho de cera.
   - Identidade preservada.
   - Estrutura facial estável.
4. **Fluxo legacy**: simular cliente com LoRA `replicate` e confirmar que UI bloqueia geração e oferece retreino.

## Rollback

- Reverter constantes de provider/endpoint/parâmetros volta ao estado atual.
- Coluna `lora_provider` fica — não atrapalha o estado anterior (default cobre).
- LoRAs Fal treinadas ficariam órfãs, mas são minoria nesse cenário.

Risco geral: **baixo**. Maior incerteza é estética opinionada do Krea — só validando lado a lado.
