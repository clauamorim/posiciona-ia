---
name: Retratos de Marca
description: Pay-per-download portrait generation on Fal.ai using FLUX.1 Krea [dev] + portrait-trained LoRA
---

Retratos gerados via **Fal.ai** com pipeline em duas pontas:

- **Treino:** `fal-ai/flux-lora-portrait-trainer` — trainer da Fal otimizado pra rosto humano (brilho de olho, semelhança, detalhe fino). Edge function `portrait-train` chama `https://queue.fal.run/...` com webhook nativo (header `fal-webhook`) apontando pra `portrait-webhook`. Custo Fal ~$2.40/treino (1000 steps × $0.0024). Trigger phrase: `USR<12hex>` (+ `<gender>` quando há traits).
- **Inferência:** `fal-ai/flux-krea-lora` — FLUX.1 Krea [dev] com suporte oficial a LoRA. Krea é a resposta da BFL ao "look de IA" do FLUX-dev base; entrega textura natural de pele NATIVAMENTE. Custo $0.035/MP. Endpoint síncrono `https://fal.run/...`, ~10-25s por imagem, paralelizável.

**Stack de LoRAs:** APENAS 1 LoRA (identidade da cliente, escala fixa **1.0**). Sem realism stacking — Krea entrega isso sozinho.

**Parâmetros de inferência:**
- `guidance_scale`: **3.0** fixo (default Krea).
- `num_inference_steps`: **28** (default Krea).
- `image_size`: 896×1152 (3:4 @ 1MP).
- `num_images`: 1 por chamada; 3 chamadas em paralelo por geração.
- Sem negative prompt (Krea não responde bem a negative longo).

**Prompt (`_shared/portraitPrompts.ts`):** drasticamente enxuto.
- `QUALITY_SUFFIX`: `"editorial portrait photograph, natural skin texture, soft daylight, shallow depth of field, 50mm lens"`.
- `STUDIO_NEGATIVE_BASE`: `", plastic skin, airbrushed, cgi, deformed, asymmetric eyes, distorted proportions"`. (Mantido por compat — não enviado ao endpoint Fal.)
- Templates de arquétipo: descrição mínima de cena (expressão + luz + fundo). Sem reforço de textura/realismo.

**Migração legacy:** Coluna `portrait_trainings.lora_provider` (`'fal'` default, `'replicate'` para registros pré-migração). LoRAs `replicate` são bloqueadas na geração — `generate-portrait` retorna `409 needs_legacy_migration`. UI no `PortraitGenerator` detecta `isLegacyLora` e oferece **"Refazer treino (gratuito)"** — flag `migrate_legacy: true` no `portrait-train` força `canUseFree` sem consumir o slot mensal nem créditos.

**Figurino e poses:** inalterados — pool por profissão (`outfitPool.ts`), 4 categorias gestuais com mãos sempre fora do frame (`HAND_POSE_POOLS_BY_CATEGORY`).

**Pós-processamento:** nenhum no fluxo principal. Bytes vão direto da Fal pro Storage privado `portrait-outputs`. Chroma-key despill via Gemini permanece em fluxos auxiliares.

**Secrets:** `FAL_KEY` (Fal.ai), `WEBHOOK_SECRET` (HMAC do webhook). `REPLICATE_API_TOKEN` mantido por enquanto pra não quebrar fluxos auxiliares; pode ser removido após validação completa.

Coluna DB `replicate_training_id` foi reaproveitada como "external request id" genérico — agora guarda `request_id` da Fal.
