---
name: Retratos de Marca
description: Pay-per-download portrait generation with multi-LoRA stack (client dominant + light face realism)
type: feature
---

Retratos gerados via Replicate com **stack de 2 LoRAs**:

- Modelo: `lucataco/flux-dev-multi-lora` (community, requer version hash em `/v1/predictions`)
- LoRA 1 (DOMINANTE — identidade): `replicate_lora_url` da cliente, escala **0.90 / 0.95 / 1.00** (cresce com `selfies_count`). Mantém estrutura óssea e proporções faciais. Teto descido de 1.05 → 1.00 após 1.05+guidance 3.6 produzir assimetria (olhos tortos, rosto inflado).
- LoRA 2 (TEMPERO — textura): `prithivMLmods/Canopus-LoRA-Flux-FaceRealism`, escala fixa **0.25**. Só puxa textura natural de pele.

Parâmetros de inferência:
- `guidance_scale`: **[2.6, 3.0, 3.4]** por look — descido um degrau (era [2.8, 3.2, 3.6]) porque 3.6 estava forçando colapso facial em algumas seeds.
- `num_inference_steps`: **35** — detalhe fino (poros, cílios, brilho de olho).
- `aspect_ratio` 3:4 @ 1MP, `output_format` png @ 95.

Prompt (`_shared/portraitPrompts.ts`):
- `QUALITY_SUFFIX`: editorial-documental + reforço de identidade (`sharp focus on eyes, crisp eyelashes, defined facial bone structure, preserved facial proportions`).
- `STUDIO_NEGATIVE_BASE`: bloqueia plástico/airbrush + distorção de proporções + **assimetria facial** (`asymmetric eyes, uneven eyes, crooked eyes, tilted eye line, asymmetric eyebrows, no neck, missing neck, distorted facial proportions, inflated cheeks, wide jaw`).

Figurino: pool por profissão (`outfitPool.ts`) com diversidade de peças-âncora dentro da rodada de 3.
Mãos: estratégia "sempre escondidas" — 4 categorias gestuais (`HAND_POSE_POOLS_BY_CATEGORY`).

Pós-processamento: chroma-key despill via Gemini (legado, fluxos auxiliares). Geração principal não usa upscaler — bytes do Replicate vão direto ao Storage privado.

Sem retreino necessário ao trocar parâmetros de inferência. Treinos antigos continuam válidos.
