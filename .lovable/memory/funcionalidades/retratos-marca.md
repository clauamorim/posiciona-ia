---
name: Retratos de Marca
description: Pay-per-download portrait generation with multi-LoRA stack (client dominant + light face realism)
type: feature
---

Retratos gerados via Replicate com **stack de 2 LoRAs**:

- Modelo: `lucataco/flux-dev-multi-lora` (community, requer version hash em `/v1/predictions`)
- LoRA 1 (DOMINANTE — identidade): `replicate_lora_url` da cliente, escala **0.95–1.05** (cresce com `selfies_count`). Mantém estrutura óssea, proporções faciais, traços únicos.
- LoRA 2 (TEMPERO — textura): `prithivMLmods/Canopus-LoRA-Flux-FaceRealism`, escala fixa **0.25**. Só puxa textura natural de pele; em escalas maiores (~0.45) começava a empurrar a estrutura facial pra média do LoRA (rosto mais largo/redondo, queixo curto).

Parâmetros de inferência:
- `guidance_scale`: **[2.8, 3.2, 3.6]** por look — recupera nitidez tipo Gemini sem virar "plástico" (margem de segurança vem da queda do FaceRealism).
- `num_inference_steps`: **35** — mais detalhe fino (poros, cílios, brilho de olho).
- `aspect_ratio` 3:4 @ 1MP, `output_format` png @ 95.

Prompt (`_shared/portraitPrompts.ts`):
- `QUALITY_SUFFIX` modo editorial-documental + reforço de identidade: `sharp focus on eyes, crisp eyelashes, defined facial bone structure, preserved facial proportions`.
- `STUDIO_NEGATIVE_BASE` bloqueia plastic/glossy/airbrushed/CGI/filter E distorção: `wide face, round face, short chin, altered face shape, different person, face morph, soft focus, blurry skin`.

Figurino: pool por profissão (`outfitPool.ts`) com diversidade de peças-âncora dentro da rodada de 3.
Mãos: estratégia "sempre escondidas" — 4 categorias gestuais (`HAND_POSE_POOLS_BY_CATEGORY`).

Pós-processamento: chroma-key despill via Gemini (legado, fluxos auxiliares). Geração principal não usa upscaler — bytes do Replicate vão direto ao Storage privado.

Sem retreino necessário ao trocar parâmetros de inferência. Treinos antigos continuam válidos.
