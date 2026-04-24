

## Pacote de correções 7 — Minha galeria sempre atualizada + esconder Galeria Posiciona

### Problema atual
1. As imagens IA / Unsplash só aparecem em **"Minhas imagens"** depois que o design é salvo manualmente E a página é recarregada. Hoje a aba só carrega uma vez (`userAssetsLoaded`) e nunca atualiza após uma nova foto entrar no canvas.
2. Mesmo após salvar, a aba ainda não atualiza dentro da mesma sessão.
3. A seção **"Galeria Posiciona"** (galeria curada por admin) precisa ser escondida.

### O que será feito

**1. Salvamento automático de fotos IA / Unsplash na galeria do usuário**
- Em `PostEditorPage.tsx`, criar uma função `saveSinglePhotoToGallery(url, source, attribution?)` derivada da lógica atual de `persistPostPhotosToGallery`.
- Disparar essa função imediatamente quando o usuário:
  - Escolhe uma foto do Unsplash (`onPickImage` no `ImageGalleryPanel`).
  - Gera uma imagem por IA com sucesso (no fluxo `handleAIConfirm` / `onPickImage` IA).
  - Troca o fundo via `handleSwapBackground`.
- Assim a foto entra na galeria pessoal **no instante em que é usada**, sem depender de "Salvar design".
- Manter o `persistPostPhotosToGallery` no save apenas como rede de proteção (deduplicar por path/URL para não duplicar).

**2. Refresh da seção "Minhas imagens" e "Suas imagens salvas"**
- Em `AddElementPanel.tsx`, expor um `reloadUserAssets()` e chamá-lo:
  - Sempre que a aba "Galeria" é aberta.
  - Após upload local concluído.
  - Após receber um evento global `posiciona:gallery-updated`.
- Em `ImageGalleryPanel.tsx`, mesmo tratamento na seção "Suas imagens salvas".
- O `PostEditorPage` dispara `window.dispatchEvent(new CustomEvent("posiciona:gallery-updated"))` toda vez que `saveSinglePhotoToGallery` insere com sucesso. Os dois painéis ouvem e recarregam.

**3. Esconder "Galeria Posiciona"**
- Em `src/components/post-editor/inspector/AddElementPanel.tsx`, remover o bloco JSX `{/* Posiciona gallery */}` (linhas ~523-544) e o estado/effect que carrega `gallery_assets` (`galleryAssets`, `galleryLoaded`, `useEffect` correspondente).
- A aba **Galeria** passa a mostrar **apenas "Minhas imagens"**. Se estiver vazia, a mensagem orienta o usuário a enviar imagem ou usar Unsplash/IA.

**4. Mensagem clara quando ainda está vazia**
- Substituir `"Nenhuma imagem salva."` por: *"Suas imagens IA, Unsplash e uploads aparecem aqui automaticamente quando usadas em posts."*

### Arquivos editados
- `src/pages/PostEditorPage.tsx` — `saveSinglePhotoToGallery` + chamada em todos os pontos onde uma foto remota entra no canvas + dispatch de evento.
- `src/components/post-editor/inspector/AddElementPanel.tsx` — remoção da Galeria Posiciona, refresh por evento e ao abrir aba.
- `src/components/post-editor/inspector/ImageGalleryPanel.tsx` — refresh por evento na seção "Suas imagens salvas".

### Resultado esperado
- Toda foto Unsplash escolhida ou imagem IA gerada vai direto para **Minhas imagens** — sem precisar salvar o design.
- A seção atualiza automaticamente, sem reload.
- A "Galeria Posiciona" some por completo da interface.

