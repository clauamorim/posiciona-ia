---
name: Retratos de Marca
description: Pay-per-download portrait generation with multi-LoRA stack (client + face realism)
type: feature
---

Retratos gerados via Replicate com **stack de 2 LoRAs**:

- Modelo: `lucataco/flux-dev-multi-lora`
- LoRA 1: `replicate_lora_url` da cliente (treinado em `portrait-train`), escala 0.78–0.85 (cresce com `selfies_count`)
- LoRA 2: `prithivMLmods/Canopus-LoRA-Flux-FaceRealism` (público HF), escala fixa 0.45 — força textura natural de pele e impede look "plastificado"

Parâmetros: `guidance_scale` [2.0, 2.4, 2.8] por look, `num_inference_steps` 28, `aspect_ratio` 3:4 @ 1MP, `output_format` png @ 95.

Prompt (`_shared/portraitPrompts.ts`):
- `QUALITY_SUFFIX` em modo editorial-documental (sem termos studio tipo Sony A7/85mm)
- `STUDIO_NEGATIVE_BASE` bloqueia plastic/glossy/airbrushed/CGI/instagram filter/glamour retouching

Figurino: pool por profissão (`outfitPool.ts`) com diversidade de peças-âncora dentro da rodada de 3.
Mãos: estratégia "sempre escondidas" — 4 categorias gestuais (`HAND_POSE_POOLS_BY_CATEGORY`).

Pós-processamento: chroma-key despill via Gemini (legado, ainda em alguns fluxos auxiliares). Geração principal não usa upscaler — bytes do Replicate vão direto ao Storage privado.

Sem retreino necessário ao trocar parâmetros de inferência. Treinos antigos continuam válidos.
