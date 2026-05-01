---
name: Retratos de Marca
description: Pay-per-download portrait generation using Gemini 3 Pro Image with neutral studio paper backdrops and discardable history
---

Retratos gerados via **Gemini 3 Pro Image** (`google/gemini-3-pro-image-preview`) no Lovable AI Gateway, com fallback para `gemini-3.1-flash-image-preview`. Sem treino, sem LoRA — selfies enviadas como `image_url` em cada chamada.

**Fundo (regra absoluta):** SEMPRE seamless paper studio backdrop com textura sutil. Paleta APENAS neutra — cinza, marrom e preto. Nenhum cenário, equipamento de estúdio (softbox, tripé, refletor), tijolo, concreto, planta, móvel ou cor saturada (sem terracota, mostarda, rosa, verde, azul, creme, ivory). Configurado em `_shared/portraitPrompts.ts`:
- `ARCHETYPE_PROMPTS` — cor do paper varia por arquétipo dentro da paleta neutra (charcoal/grey/taupe/sepia/black/mocha/dark brown).
- `BACKGROUND_VARIATIONS` — Neutro mantém o paper do arquétipo; Claro = `light grey paper`; Escuro = `deep charcoal paper`.
- `buildGeminiPortraitPrompt` injeta bloco **STUDIO BACKDROP LOCK** + AVOID list reforçado contra equipamento e cor saturada.

**Identidade:** bloco `### IDENTITY LOCK ###` no topo do prompt — primeira selfie como ground truth, reprodução forense de traços, preservação de idade aparente, sem suavizar pele.

**Custo:** 1 crédito por imagem entregue (até 3 por geração). Cobrança consome `portrait_credits_included` antes de `portrait_credits_extra`.

**Histórico descartável:** coluna `portrait_generations.kept_indices` (INTEGER[]). NULL = todos visíveis (default). Edge function `portrait-discard` recebe `{ generation_id, index }` e remove o índice. `portrait-history` filtra por `kept_indices` e expõe `parent_index` para o front. Botão "Descartar" disponível em `PortraitGenerator.tsx` (após geração) e `HistoryPage.tsx` (overlay no thumbnail). Arquivos no storage não são apagados; só ocultados do histórico.

**Stack auxiliar:** `outfitPool.ts` (figurino por profissão), `HAND_POSE_POOLS_BY_CATEGORY` (4 categorias gestuais com mãos sempre fora do frame). Bucket `portrait-outputs` (privado, signed URLs 1h no histórico, 7d no retorno imediato).
