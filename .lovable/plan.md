## Problemas observados

Confirmei no preview (carrossel da Semana 3, Dia 1):

1. **Fonte do título do template global não aparece.** O título sai em sans-serif do sistema, não na serifada (Playfair/Cormorant) que o template global do arquétipo define. O `titleFontFamily` salvo não chega ao canvas de forma confiável.
2. **Corpo do texto minúsculo.** Templates de carrossel usam `bodySlot.fontSize` 38–40 — o default precisa subir.
3. **A foto "pisca": carrega uma e logo é substituída.** O efeito `slideBgRanRef` percorre do índice 0 a N e sobrescreve a foto que o auto-layout já tinha aplicado no slide 1.
4. **Trocar foto no carrossel não funciona.** O canvas é renderizado a partir de `carouselOverlays` (PostEditorPage linha 898), que sobrescreve `tpl-bg-*` por `slideBackgrounds[currentSlide]`. A callback `onSwapBackgroundUrl` atualiza só `overlayImages[tpl-bg-*].src`, então `slideBackgrounds[currentSlide]` continua mascarando a escolha do usuário.
5. **Botões "Frente"/"Trás" (organização de camadas) pararam de funcionar.** `handleBringForward`/`handleSendBackward` (PostEditorPage 926–944) reordenam `renderOrder`, mas no `PostCanvas` o `effectiveRenderOrder` passa por `sortByVisualLayer` (linhas 585–608) que **força ranks fixos** (foto-fundo=0, moldura=1, textos=2, ornamentos=3, demais=4). Isso anula qualquer troca manual entre itens de ranks diferentes (e mesmo dentro do mesmo rank, a ordem retorna porque o sort recalcula a cada render).

## O que vou alterar

### 1. Aplicar de fato a fonte do título do template global
`src/pages/PostEditorPage.tsx` (efeito do template do arquétipo, ~486–576):
- Quando o state salvo do template global não tiver `titleFontFamily`, derivar do `displayFont` do template e aplicar via `setTitleFontFamily`.
- Garantir o `loadGoogleFont` correspondente.

### 2. Aumentar tamanho default do corpo no canvas
`src/lib/postAutoLayout.ts` (linhas ~600 e 660):
- Aplicar boost de +20% ao `template.bodySlot.fontSize` antes de devolver `bodyFontSize` em `suggestions`, com piso mínimo de 44 px (carrossel) e 48 px (reels).
- Escalar a estimativa de altura proporcionalmente para o slot não cortar texto.

### 3. Eliminar a troca de foto no primeiro slide
`src/pages/PostEditorPage.tsx` (efeito `slideBgRanRef`, linhas 689–760):
- Pular o índice 0 do loop (`for (let i = 1; ...)`). A foto do slide 1 já vem do auto-layout.

### 4. Fazer a troca de foto funcionar no carrossel
`src/pages/PostEditorPage.tsx`:
- Criar helper `applyBackgroundToCurrentSlide(url)` que, em carrossel, escreve em `slideBackgrounds[currentSlide]` (preservando `opacity` e `objectPosition` atuais ou usando defaults). Fora do carrossel, atualiza apenas o `tpl-bg-*` em `overlayImages`.
- Refatorar `handleSwapBackground` (763–807) e a callback `onSwapBackgroundUrl` (1800–1829) para usarem a helper.

### 5. Corrigir os botões "Frente" e "Trás" (camadas)
`src/components/post-editor/PostCanvas.tsx` (linhas 585–608):
- Tornar `sortByVisualLayer` o **estado inicial** do `renderOrder`, não uma reordenação a cada render. O sort por rank deve rodar uma única vez na primeira montagem (ou quando aparecem ids novos), e a partir daí o `renderOrder` que vem do parent é a fonte de verdade.
- Implementação: para ids novos (não presentes em `externalRenderOrder`), inserir já ranqueados; para ids existentes, **preservar a ordem do parent** sem aplicar `sortByVisualLayer` em cima. Assim, `handleBringForward`/`handleSendBackward` passam a deslocar de fato a posição visual (inclusive cruzando ranks).
- Resultado: o usuário consegue mandar uma foto para frente do título, ou um ornamento para trás de tudo, e a alteração se mantém.

### 6. Limpeza dos avisos do React
`src/components/post-editor/inspector/SelectionPanel.tsx`: o aviso "Function components cannot be given refs" aparece em `FontSelect` e `ColorPicker`. Embrulhar ambos com `React.forwardRef` (sem mudança visual).

## Como vou validar
- Recarregar `/post-editor?week=2&day=0&style=pexels` e confirmar:
  - Título em fonte serifada do template global.
  - Corpo do post nitidamente maior já no carregamento.
  - Slide 1 carrega uma única foto, sem flicker.
  - Escolher foto nova (Galeria/Pexels/IA) atualiza só o slide ativo do carrossel.
  - Selecionar uma imagem/ornamento e clicar "Frente"/"Trás" move o elemento na pilha visualmente — e a posição persiste ao clicar de novo.
