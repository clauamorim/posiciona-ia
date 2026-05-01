## Objetivo

Eliminar a "pele plástica" dos retratos sem perder semelhança da cliente nem fidelidade ao figurino, combinando:

1. **Stack de 2 LoRAs** na inferência (LoRA da cliente + LoRA público de realismo de pele).
2. **Ajustes de prompt e negative prompt** para remover vocabulário "studio polido".
3. **Manutenção da diversidade de figurino por profissão** já implementada.

Sem retreino. Os LoRAs já treinados continuam válidos.

## Mudança 1 — Trocar modelo Replicate (multi-LoRA)

O modelo atual `black-forest-labs/flux-dev-lora` aceita apenas 1 LoRA por chamada. Vamos para:

```
black-forest-labs/flux-dev-lora  →  lucataco/flux-dev-multi-lora
```

Suporta `hf_loras` (array) + `lora_scales` (array). Carrega LoRAs públicos do HuggingFace direto pelo path. Mantém todos os outros inputs (aspect_ratio, megapixels, guidance_scale, num_inference_steps, output_format, output_quality, negative_prompt, seed).

### Novo payload

```json
{
  "hf_loras": [
    "<replicate_lora_url da cliente>",
    "prithivMLmods/Canopus-LoRA-Flux-FaceRealism"
  ],
  "lora_scales": [0.82, 0.45],
  "prompt": "<prompt com trigger word>",
  "negative_prompt": "<negative reforçado>",
  "aspect_ratio": "3:4",
  "megapixels": "1",
  "guidance_scale": <2.0 | 2.4 | 2.8>,
  "num_inference_steps": 28,
  "output_format": "png",
  "output_quality": 95,
  "num_outputs": 1,
  "seed": <random>
}
```

### Por que essas escalas

- LoRA da cliente sobe de 0.68 → **0.82**: o LoRA de realismo (0.45) puxa para textura natural; sem subir o da cliente, perderíamos semelhança.
- LoRA de realismo em **0.45**: forte para introduzir poros e linhas finas, fraco para não dominar os traços faciais.

## Mudança 2 — Prompt e negative prompt

Em `supabase/functions/_shared/portraitPrompts.ts`:

### `QUALITY_SUFFIX` revisto

Remover termos "studio polido":
- `shot on Sony A7`, `85mm f/1.4`, `shallow depth of field`

Adicionar termos editoriais/documentais:
- `natural editorial portrait`
- `real human skin texture`
- `fine pores and natural facial lines`
- `soft realistic skin, not glossy`
- `natural makeup, no beauty retouching`
- `true-to-life face texture`
- `photographed not rendered`

### `STUDIO_NEGATIVE_BASE` ampliado

Adicionar:
- `glossy skin`, `overly smooth face`, `perfect skin`
- `skin smoothing`, `face smoothing`, `airbrushed skin`
- `waxy skin`, `porcelain skin`, `plastic skin`
- `CGI skin`, `3d render skin`, `synthetic skin texture`
- `instagram filter`, `AI beauty filter`
- `glamour retouching`, `overprocessed portrait`

## Mudança 3 — Parâmetros de geração

Mantidos do plano anterior (não baixamos mais o guidance porque o stack de LoRAs já resolve):

- `guidance_scale`: `[2.0, 2.4, 2.8]` (uma por look da rodada de 3)
- `num_inference_steps`: `28`
- `output_format`: `png`
- `output_quality`: `95`
- `aspect_ratio`: `3:4` @ 1MP

## Mudança 4 — Logs

Em `generate-portrait/index.ts`, ampliar log existente para registrar a stack aplicada em cada uma das 3 fotos:

```
loraStack=[{anchor:client,scale:0.82},{anchor:realism,scale:0.45}] guidance=2.4 steps=28
```

## O que NÃO muda

- `portrait-train` — sem retreino, LoRAs existentes continuam válidos
- Lógica de figurino por profissão e diversidade de peças-âncora (`outfitPool.ts`)
- Pool de poses de mãos
- Sistema de fundos (Neutro / Claro / Escuro)
- Trigger word, dataset, traços físicos extraídos
- Créditos, storage privado, URLs assinadas, histórico, versionamento
- Qualquer UI

## Plano de fallback

Após primeira rodada de teste:
- Cara menos parecida → ajustar para `[0.85, 0.40]`
- Pele ainda lisa → ajustar para `[0.80, 0.55]`
- LoRA público falhando ao carregar → try/catch já existente cai de volta para `flux-dev-lora` com só o LoRA da cliente, sem quebrar a função

## Arquivos afetados

Apenas dois:

- `supabase/functions/generate-portrait/index.ts` — trocar modelo, montar payload com `hf_loras`/`lora_scales`, ampliar logs
- `supabase/functions/_shared/portraitPrompts.ts` — `QUALITY_SUFFIX` e `STUDIO_NEGATIVE_BASE`

Sem migrations. Sem mudanças de UI. Sem novos secrets (`REPLICATE_API_TOKEN` já existe).