## Diagnóstico

### Bug 1 — Tipografia pequena
`PostCanvas.tsx` já aplica `typo.titleWeight` (linha 681) e calcula floor com `Math.max(42, typo.titleSizeMin)` (linha 518) e `Math.max(archetypeTitleFloor, titleFontSize || archetypeTitleSize)` (linha 519). O sistema funciona — mas:

1. **Amante não está no mapa de ELEGANCE** em `src/lib/archetypeTypography.ts` → cai em DEFAULT (weight 400, size 44).
2. Templates globais salvos no banco têm `titleFontSize` baixo (ex.: Mago=44, Cuidador=46) e o efeito de hidratação do template chama `setTitleFontSize(s.titleFontSize)` (PostEditorPage linha 505), forçando esse valor antes do clamp do canvas. O floor ainda atua, mas elegância merece mais respiro.
3. Possível race: o efeito de auto-layout pode rodar antes de `archetypeTemplateAppliedRef.current` virar `true` (a flag só é setada depois do `await` da query Supabase), e aplicar `setTitleFontSize` da sugestão da IA por cima.

### Bug 2 — Imagem fora de contexto (copo de café num post de advogado)
Edge `fetch-post-image` JÁ tem `NICHE_SCENES` + `resolveNicheKey` + `pickNicheScene` aplicados em `buildSearchQuery` e `buildAIPromptSubject`. A query para `niche="advogado"` resolveria para `"lawyer office attorney at mahogany desk reviewing documents"`.

A causa real do "copo de café": quando `niche` chega vazio na edge (porque `profiles.niche` do usuário está NULL), `resolveNicheKey` cai em `default`, cuja primeira cena é literalmente `"minimalist editorial workspace with notebook, warm coffee and morning daylight from the side"` — exatamente o copo de café que apareceu.

`PostEditorPage.tsx` (linha 269-270) só busca `niche` em `profiles`. Não há fallback para o `business_questionnaires` (que JÁ é carregado em seguida para `businessContext`).

### Bug 3 — Decorativos fora de posição
Templates globais foram salvos com canvas implícito de **1080×1080** (frames com `x:60, y:60, width:960, height:960` = 1080-60-60). O canvas atual do editor é **1080×1350 (card 4:5)** ou **1080×1920 (reels)**. As coordenadas são absolutas em px — usadas direto sem rescale (`PostCanvas` linha 660: `left: tb.x, top: tb.y`).

Resultado: o frame fica `60px` do topo, ocupa apenas até `y=1020` (sobra 330px embaixo), e linhas decorativas posicionadas em `y=120` e `y=840` aparecem no meio do card em vez das bordas.

Os templates não são responsivos a outros formatos.

---

## Correções

### 1. `src/lib/archetypeTypography.ts`
- Adicionar `"Amante": ELEGANCE` ao mapa.
- Subir `titleSizeMin` de ELEGANCE de 48 → **52** e `titleSizeMax` para 60, garantindo título visivelmente maior.

### 2. `src/components/post-editor/PostCanvas.tsx`
- Reforçar floor: para arquétipos de elegância, ignorar `titleFontSize` quando ele for menor que `typo.titleSizeMin`.
  Trocar linha 519 por:
  `const userTitleSize = titleFontSize && titleFontSize >= typo.titleSizeMin ? titleFontSize : archetypeTitleSize;`
  `const resolvedTitleFontSize = Math.max(archetypeTitleFloor, userTitleSize);`

### 3. `src/pages/PostEditorPage.tsx` — fix race e nicho

**Race condition do template** (linha 466):
- Setar `archetypeTemplateAppliedRef.current = true` **sincronamente** logo após `archetypeTemplateRanRef.current = true` (otimista), e revertê-lo no `catch`/quando `data?.state` não existir. Garante que o auto-layout que dispara em paralelo já enxergue a flag.

**Fallback de niche** (linha 269):
- Se `profiles.niche` vier vazio, derivar a partir do `business_questionnaires` (services + company_name) com simples heurística PT — ou simplesmente usar a primeira frase de `services` como `userNiche`. Preferir guardar o niche real quando achar palavra-chave conhecida (`advogado`, `médico`, etc.).

### 4. Reescalar overlays do template ao hidratar (`PostEditorPage.tsx` linha 522-530)

Adicionar função local `rescaleTemplateOverlay(overlay, fromW, fromH, toW, toH)` que multiplica `x`, `y`, `width`, `height` pelos fatores `toW/fromW` e `toH/fromH`.

- Detectar dimensão original do template: ler `state.canvasWidth`/`canvasHeight` se existir; senão assumir **1080×1080** (templates atuais).
- Aplicar `rescaleTemplateOverlay` em cada elemento de `tplOverlays` antes de chamar `setOverlayImages`.
- Para frames (SVGs com viewBox fixo), o rescale por `width`/`height` já estica corretamente o data-URL SVG (preserveAspectRatio padrão).

## Critérios de verificação

- Abrir post novo de usuário com arquétipo Sábio/Governante/Amante/Mago: título ≥ 52px, weight 300, fonte do template aplicada.
- Console log `[PostCanvas] primaryArchetype` confirma typo correto.
- Post de advogado: log `Search query:` na edge `fetch-post-image` deve conter `lawyer` + cena editorial (não default coffee).
- Frame decorativo do template encosta nas 4 bordas do canvas em formato card (1080×1350) e reels (1080×1920).
