# Pacote de correções do Editor de Posts (rodada 4)

## O que está errado hoje

1. **Texto antigo de outra conta** aparece no novo design — o `sessionStorage` (`posiciona-editor-draft` + chaves auxiliares `__ref__`) e o cache da logo (`posiciona-logo-cache-<userId>`) não são limpos quando o usuário faz logout / troca de conta.
2. **Imagem cobre o texto e o degradê fica abaixo do texto** — quando se troca o fundo (Unsplash/IA), o overlay novo entra no fim da lista e fica acima dos blocos de texto; o degradê atual também fica acima da foto mas não necessariamente abaixo dos textos.
3. **Texto solta muito perto da base do card** — o `bodySlot` do template `cover` está em y=940 (square) / y=1660 (reels), grudado na borda inferior.
4. **Estilo com foto não tem moldura/linha/losango** — `buildAutoLayout` só adiciona `buildMinimalDecorativeOverlays` quando o estilo é `minimal`.
5. **Botão "Grade" precisa sair** do `DocumentPanel`.
6. **Snap não funciona** — remover toggle e a função inteira para acabar com o estado morto.
7. **Galeria do Unsplash não aparece e "Trocar imagem" não troca** — o botão `Trocar imagem (Unsplash)` no `DocumentPanel` chama `fetchBackgroundImage` direto sem oferecer opções, e o `ImageGalleryPanel` (galeria real) está só na aba "Banco de imagens" do `AddElementPanel`, escondido. Quando ele troca, só atualiza `src` se o ID começa com `tpl-bg-`; em alguns casos o overlay foi adicionado por outro caminho e nada acontece.
8. **Logo continua com fundo** — `imageHasTransparency` exige `>2%` de pixels com alpha < 250. Logos JPG não têm canal alpha mas têm fundo branco sólido — passam direto e nunca chamam `remove-background`. Faltou também detectar fundo branco/sólido como "precisa remover".
9. **Decorações ficam acima do texto** (linha + losango) — em `buildMinimalDecorativeOverlays` os 3 overlays entram em `overlays.push(...)`. Como o canvas usa `renderOrder` com textos primeiro e overlays depois, eles ficam acima.
10. **Minimalista não centraliza texto** — o template `minimal` já define `align: center`, mas o usuário pode ter movido manualmente; falta forçar centralização horizontal do bloco.
11. **CTA pode ficar acima do texto principal** — `defaultCtaPos` usa coordenadas fixas (y=540 na capa) que sobrepõem o título.

## O que vai mudar

### A. Limpeza de cache ao trocar de conta
- No `AuthContext.tsx`, no `signOut` e quando `user.id` muda, limpar:
  - `sessionStorage` chaves: `posiciona-editor-draft`, `posiciona-editor-draft_*`, `posiciona-logo-cache-*`.
- No `loadDraft`, validar também `userId` (adicionar `__userId` ao salvar) — se não bater, descartar.

### B. Camadas (z-index) corretos para foto + texto + decoração + degradê
Ordem visual final (de baixo para cima):
1. Foto de fundo (overlay tipo `photo` cobrindo todo canvas)
2. Degradê de legibilidade (sob os textos)
3. Decorações (moldura, linha, losango)
4. Textos (título, corpo)
5. Logo
6. CTA / número do slide

Implementação:
- Em `PostCanvas.tsx`, ao calcular `effectiveRenderOrder`, **forçar** que overlays do tipo `photo` (cobertura total) fiquem sempre primeiro, decorações (`tpl-mframe-*`, `tpl-mline-*`, `tpl-mornament-*`) acima do degradê mas abaixo dos textos, textos depois, e CTA/logo por cima.
- Quando o usuário troca a foto pelo painel de imagens, normalizar o overlay novo para `type: "photo"` cobrindo o canvas inteiro e movê-lo para o topo da pilha (z-index mais baixo).

### C. Degradê de legibilidade sob o texto, não sobre ele
- Em `PostCanvas.tsx`, posicionar o degradê com z-index entre a foto e as decorações (não acima de tudo). Reduzir altura para 50% inferior.
- Garantir que os blocos de texto fiquem com `text-shadow` apenas quando há foto, sem caixa branca.

### D. Reposicionar bloco de texto para longe da base
- Em `postTemplates.ts`, no template `cover` (square e reels):
  - Square: subir `bodySlot.y` de 940 para 820 e título de 800 para 620; aumentar respiro inferior.
  - Reels: subir `bodySlot.y` de 1660 para 1480 e título de 1440 para 1180.
- Em `pickSingleTemplate`, manter o uso do template `cover` para `unsplash`/`ai`.

### E. Decorações também em estilos com foto
- Em `buildAutoLayout`, chamar `buildMinimalDecorativeOverlays` também para `unsplash` e `ai` (com cores adaptadas: branco translúcido para contrastar com a foto).
- Atualizar `buildMinimalDecorativeOverlays` para aceitar parâmetro `onPhoto: boolean` e usar `rgba(255,255,255,0.85)` quando sim.

### F. Remover botão "Grade" e snap
- Em `DocumentPanel.tsx`, remover o botão Grade e a seção "Configurações avançadas" inteira (snap).
- Em `PostEditorPage.tsx`, remover estados `showGrid`, `enableSnap`.
- Em `PostCanvas.tsx`, remover prop `showGrid`, `enableSnap`, lógica de `snapPosition`, `buildSnapTargets`, `activeGuides` e renderização da grade.
- Remover propagação dessas props em `PostToolbar.tsx` e `MobileEditorBar.tsx`.

### G. Galeria visível + troca real de imagem
- No `DocumentPanel.tsx`, **remover** o botão "Trocar imagem (Unsplash)" simplificado.
- No `PostToolbar.tsx`, mover o `ImageGalleryPanel` para uma seção dedicada "Imagem de fundo" sempre visível quando há foto no canvas (ou criar uma aba "Foto" no inspetor).
- Em `PostEditorPage.tsx`, quando `onPickImage` da galeria é acionado e `onSwapBackground` está disponível, garantir:
  - Se já existe overlay `photo` cobrindo o canvas, atualizar o `src` desse overlay (não criar novo).
  - Se não existe, criar overlay novo no início da lista (z-index mais baixo).
  - Atualizar `activePhotographer` quando vier do Unsplash.

### H. Logo realmente sem fundo
Em `postAutoLayout.ts`:
- Reescrever `imageHasTransparency`:
  - Detectar **arquivos sem canal alpha** (JPG): tratar como "precisa remover".
  - Verificar se >85% dos pixels nas bordas são quase brancos (R,G,B > 240) → também tratar como "tem fundo sólido".
- Sempre acionar `remove-background` se uma das condições acima for verdadeira.
- Após `remove-background`, **sempre** passar pelo `chromaKeyGreenToTransparent` antes de validar transparência.
- Invalidar o cache da logo (`sessionStorage.removeItem(LOGO_CACHE_PREFIX + userId)`) toda vez que o usuário sobe um novo asset marcado `is_logo=true`.

### I. Ordem das decorações: linha + losango ABAIXO do texto
- Em `buildMinimalDecorativeOverlays`, separar em dois grupos:
  - **Atrás do texto**: moldura interna.
  - **Abaixo do texto (mas acima do fundo)**: linha + losango.
- No `PostCanvas.tsx`, o `effectiveRenderOrder` deve respeitar: foto → moldura → degradê → linha/losango → texto → logo → CTA. Como linha/losango devem estar **abaixo do texto** visualmente (z-index menor que o texto) E logicamente posicionadas no card abaixo do bloco de texto, ajustar `y` do `lineY` e `dY` para depois do `bodySlot.y + bodySlot.height` calculado dinamicamente, em vez do valor fixo 540/880.

### J. Forçar centralização horizontal no estilo minimal
- Em `computeTextBoxPositions` do `PostCanvas.tsx`, quando `initialTextBoxes` vem do template `minimal`, sobrescrever `x` para `(canvasWidth - width) / 2`.
- Em `PostEditorPage.tsx`, passar a `style` atual ao `PostCanvas` para que ele saiba aplicar a centralização.

### K. CTA nunca sobre o texto principal
- Em `PostCanvas.tsx`, calcular `defaultCtaPos.y` com base na posição do `bodySlot` mais alto: `bodyBox.y + bodyBox.height + 60`.
- Garantir z-index do CTA > textos.

## Arquivos alterados
- `src/contexts/AuthContext.tsx` — limpeza de sessionStorage no signOut/troca de user.
- `src/pages/PostEditorPage.tsx` — validação `__userId`, troca de fundo unificada, remoção de `showGrid`/`enableSnap`, propagação de `style` ao canvas.
- `src/components/post-editor/PostCanvas.tsx` — z-index estratificado, centralização forçada no minimal, remoção de grade/snap, CTA dinâmico.
- `src/components/post-editor/PostToolbar.tsx` — galeria sempre visível, props enxutas.
- `src/components/post-editor/MobileEditorBar.tsx` — remover propagação de grade/snap.
- `src/components/post-editor/inspector/DocumentPanel.tsx` — remover botão Grade, snap e botão simplificado de trocar imagem.
- `src/components/post-editor/inspector/AddElementPanel.tsx` — manter `ImageGalleryPanel`, ajustar contrato com PostEditorPage.
- `src/lib/postAutoLayout.ts` — detecção rigorosa de fundo na logo, decorações para fotos, separação moldura vs linha/losango.
- `src/lib/postTemplates.ts` — `bodySlot.y` mais alto no `cover`, parâmetro `onPhoto` em `buildMinimalDecorativeOverlays`.

## Resultado esperado
- Logout → login com outra conta começa o editor limpo, sem texto da conta anterior.
- Foto (Unsplash ou IA) sempre fica atrás de tudo; texto sempre legível com degradê real abaixo dele.
- Texto não cola na base; sempre sobra respiro.
- Moldura, linha e losango aparecem em todos os estilos (inclusive com foto), e a linha + losango ficam abaixo do bloco de texto.
- "Grade" e "Snap" desaparecem da interface.
- Galeria do Unsplash visível com 12 opções; clicar troca o fundo de verdade.
- Logo JPG/PNG com fundo branco vira PNG transparente automaticamente (uma vez só, com cache invalidável).
- Estilo minimalista com texto sempre centralizado horizontalmente.
- CTA nunca sobrepõe o título nem o corpo.
