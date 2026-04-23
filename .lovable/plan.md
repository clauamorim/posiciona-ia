

## Pacote de correções 5 — formato 4:5, layout, galeria pessoal, templates

### 1. Trocar 1:1 por 4:5 nos cards
- Substituir o formato `square` (1080×1080) por **`card` 1080×1350** (proporção 4:5, padrão Instagram feed).
- Reels permanece 1080×1920.
- Atualizar:
  - `src/lib/postTemplates.ts`: mudar `SQUARE_H = 1350`, recalcular slots de `cover`, `content`, `minimal`, `cta` para o novo canvas (mais alto).
  - `src/pages/PostEditorPage.tsx`: `cH = canvasFormat === "reels" ? 1920 : 1350`.
  - `DocumentPanel.tsx` e `MobileEditorBar.tsx`: rótulos do botão de formato passam de "1:1" → "4:5".
  - `StyleSelectionModal.tsx` e `ImageGalleryPanel.tsx`: trocar `aspect-square` por `aspect-[4/5]` quando formato for card.

### 2. Fotos cobrindo todo o canvas (sem margens)
- Em `PostCanvas.tsx`, no `<img>` de overlays do tipo `photo`, trocar `object-fit: contain` por `object-fit: cover` apenas quando o overlay é foto de fundo full-canvas. Isso elimina barras quando a proporção da foto não bate exatamente.
- Em `buildBackgroundImageOverlay` garantir `width=canvasW`, `height=canvasH` exatos para o novo formato 1080×1350.
- O usuário ainda pode redimensionar manualmente a foto se quiser; o resize livre continua disponível.

### 3. Centralizar texto em todo design minimalista
- Em `PostCanvas.tsx`, a centralização horizontal já é forçada quando `postStyle === "minimal"`, mas o `textAlign` dos parágrafos vem do estado externo. Quando `postStyle === "minimal"` ignorar `textAlign`/`titleTextAlign` props e fixar `"center"` para título e corpo.
- Garantir que isso vale também em **carrossel minimalista** (`CarouselEditor` já passa `postStyle`).

### 4. Logo sempre no canto inferior direito
- Em `postTemplates.ts`, redefinir `logoSlot` em **todos** os templates (cover, content, minimal, cta, square e reels) para uma posição padrão no canto inferior direito com margem segura:
  - 4:5: `x = W − 200`, `y = H − 200`, `w = h = 140`.
  - Reels: `x = W − 220`, `y = H − 240`, `w = h = 160`.
- Em `PostCanvas.tsx`, calcular `bodyMaxY = canvasHeight − logoHeight − margin` para impedir que o corpo do texto invada a área da logo. Se o corpo precisar mais espaço, reduzir altura do bloco em vez de sobrepor.
- A logo recebe `zIndex` acima das decorações mas abaixo do CTA.

### 5. Corpo do texto não colar na moldura nem ser coberto pelo CTA
- Em `postTemplates.ts`, aumentar margem inferior do `bodySlot` em todos os templates (mínimo 200px de respiro até o fim do canvas no 4:5 / 280px no Reels).
- Em `PostCanvas.tsx`, o `computedCtaY` já é dinâmico; reforçar que **nunca** seja menor que `bodyBox.y + bodyBox.height + 60`. Adicionar também: se o CTA estourar o limite (`canvasHeight − 120`), empurrar o `bodyBox` para cima proporcionalmente em vez de sobrepor.
- A moldura interna (`buildMinimalDecorativeOverlays`) recebe `FRAME_INSET` maior (60 no 4:5, 80 no Reels) para o texto não tocar a borda.

### 6. "Salvar como template" + biblioteca pessoal
- Adicionar coluna `is_template boolean default false` em `user_designs` via migration.
- No `PostEditorPage.tsx`, adicionar botão **"Salvar como modelo"** ao lado de "Salvar design". Marca `is_template=true` no insert.
- Em `MyDesignsPage.tsx`, criar abas: **Meus designs** | **Meus modelos**. Ao clicar num modelo, abrir o editor pré-carregado com aquele state (rota `?design=ID&fromTemplate=1`).

### 7. Galeria pessoal recebe imagens IA e Unsplash de posts salvos
- Criar nova coluna em `user_gallery_assets`: `source text default 'upload'` (`'upload' | 'unsplash' | 'ai'`) + `attribution jsonb` (para créditos do fotógrafo).
- Em `PostEditorPage.tsx`, no momento do `Salvar design`, varrer `overlayImages` por overlays `type=photo` cuja URL não esteja já na galeria do usuário. Para cada uma:
  - Baixar o blob, fazer upload para `user-uploads`, inserir registro em `user_gallery_assets` com `source` = `unsplash`/`ai` e `attribution` (Unsplash photographer info quando aplicável).
- A `ImageGalleryPanel` já lista assets do usuário; passa a mostrar também essas fotos salvas em uma seção "Suas imagens salvas".

### 8. Retirar coordenadas do canvas
- Em `PostCanvas.tsx`, remover por completo o bloco `{showCoordinates && selectedBounds && (...)}` (badge de "X, Y · W×H").
- Limpar prop `showCoordinates` da assinatura de `PostCanvas`, `CarouselEditor` e do `PostEditorPage` (default já era irrelevante).

### 9. Reforçar contexto enviado ao Unsplash / IA
- A edge function `fetch-post-image` já prioriza `niche`. Garantir que TODAS as chamadas passem `niche` E `businessContext`:
  - `ImageGalleryPanel.runSearch` — já passa.
  - `handleAIConfirm` — passa só `niche`. Adicionar `businessContext`.
  - `StyleSelectionModal` (preview) — já passa.
  - `PostEditorPage.handleSwapBackground` — já passa.
- Em `generateAIImage` (cliente + edge), aceitar e propagar `businessContext`. Atualmente só `niche`.
- No `PostEditorPage`, quando `userNiche` ou `businessContext` estiverem vazios, buscar do `business_questionnaires` mais recente do usuário antes da primeira renderização (atualmente só lê do report).

---

### Arquivos editados
- `src/lib/postTemplates.ts` (formato 4:5, slots, logo bottom-right, FRAME_INSET).
- `src/pages/PostEditorPage.tsx` (cH=1350, salvar template, gravar fotos na galeria, propagar businessContext, remover coordinates).
- `src/components/post-editor/PostCanvas.tsx` (object-fit cover, centralização minimal forçada, CTA-vs-texto, remoção do badge de coordenadas, limite logo).
- `src/components/post-editor/CarouselEditor.tsx` (remover prop `showCoordinates`).
- `src/components/post-editor/inspector/DocumentPanel.tsx` e `MobileEditorBar.tsx` (rótulo "4:5").
- `src/components/post-editor/StyleSelectionModal.tsx` (`aspect-[4/5]`).
- `src/components/post-editor/inspector/ImageGalleryPanel.tsx` (passar `businessContext` para IA, mostrar "Suas imagens salvas").
- `src/components/post-editor/inspector/AddElementPanel.tsx` (formato `card` no Unsplash).
- `src/pages/MyDesignsPage.tsx` (abas designs vs modelos).
- `src/lib/postAutoLayout.ts` (`generateAIImage` aceita `businessContext`).
- Migration nova: `is_template` em `user_designs`, `source` + `attribution` em `user_gallery_assets`.

### Resultado esperado
- Cards passam para 4:5 e ocupam todo o quadro sem margens.
- Texto do minimal centralizado em qualquer cenário (post único ou carrossel).
- Logo sempre no canto inferior direito, sem colidir com texto/CTA.
- Corpo do texto com folga até a borda; CTA nunca sobrepõe.
- Usuário pode salvar designs como modelo e reutilizar.
- Imagens IA/Unsplash dos posts salvos viram galeria pessoal reutilizável.
- Coordenadas saem do canvas.
- Buscas de imagem usam nicho + contexto do negócio em todos os pontos de chamada.

