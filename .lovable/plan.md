

## Pacote de correções 8 — Variedade de imagens, galeria, molduras 4:5 e botão "Criar post"

### 1. Mesma imagem IA / Unsplash sempre para o mesmo post
**Causa**: a edge function `fetch-post-image` faz cache pelo hash `theme + format + modo`. A primeira chamada salva o resultado em `post_background_cache` e qualquer chamada seguinte com o mesmo tema devolve a mesma URL, tanto para Unsplash quanto para IA.

**Correção**:
- Em `supabase/functions/fetch-post-image/index.ts`, **remover o cache para o modo IA** (cada geração precisa ser única — o usuário está pagando por uma nova).
- Para o modo Unsplash, manter o cache mas:
  - Trazer **uma lista** de 10 fotos do Unsplash (`searchUnsplashList` já faz isso) e **escolher uma aleatória** em vez de sempre `list[0]`.
  - Salvar no cache uma chave que inclua um índice rotativo, **ou** simplesmente desativar o cache no modo single (a lista já é ordenada por relevância).
- Em `generateAIImage` (`src/lib/postAutoLayout.ts`) e em `handleAIConfirm` (`ImageGalleryPanel.tsx`), adicionar um nonce no payload (ex: timestamp ou UUID) que entra na construção da prompt para variar levemente entre chamadas.
- O preço/débito do crédito permanece igual; muda apenas que cada clique gera uma imagem nova.

### 2. Imagens IA não aparecem na galeria do usuário
**Causa**: hoje `saveSinglePhotoToGallery` é chamado em dois pontos:
- `onPickImage` do `ImageGalleryPanel` (✅ funciona para Unsplash e IA quando vem da aba Imagem)
- `handleSwapBackground` (✅ funciona)

Mas **não é chamado no fluxo `handleAIConfirm`** quando o usuário gera uma imagem IA pelo painel "Imagem". O `ImageGalleryPanel.handleAIConfirm` chama `onPickImage(url, "ai")`, que **não** dispara o salvamento da galeria — só atualiza o overlay.

**Correção**:
- Em `src/pages/PostEditorPage.tsx`, no callback `onPickImage` passado para `ImageGalleryPanel`, adicionar a chamada explícita: `saveSinglePhotoToGallery(url, source === "ai" ? "ai" : "unsplash")`.
- Verificar também `handleSwapBackground` e `buildAutoLayout`/`fetchBackgroundImage` (geração automática inicial do template "ai" e "photo") para garantir que a primeira foto carregada também caia na galeria.
- Adicionar log de console (`console.log("Saved to gallery:", source, url)`) para diagnóstico.

### 3. Molduras só permitem redimensionar proporcionalmente — caem em 1:1 e não cabem no 4:5
**Causa**: as molduras SVG (`Moldura retangular`, `Moldura dupla`, `Moldura arredondada`, etc.) são adicionadas em `AddElementPanel.tsx` com `width: 400, height: 400` no centro do canvas. Tecnicamente o resize livre já existe (handles laterais `t/b/l/r` redimensionam um eixo só), mas:
- O usuário não percebe os 4 handles laterais — só vê os 4 cantos.
- 400×400 em um canvas 1080×1350 fica visivelmente quadrado/pequeno.

**Correção**:
- Em `AddElementPanel.tsx`, ao adicionar uma "moldura" (qualquer SVG cujo nome comece com "Moldura"), **detectar o canvas atual** (passar `canvasFormat` como prop) e inserir a moldura **já ajustada às proporções do canvas**:
  - 4:5 (1080×1350): moldura entra com `x=60, y=60, width=960, height=1230`.
  - Reels (1080×1920): `x=60, y=80, width=960, height=1760`.
- Para os outros SVGs (barras, linhas, divisores, ícones), manter o tamanho atual.
- Em `PostCanvas.tsx`, também ajustar visualmente os handles laterais para serem mais visíveis (já existem, só estão pequenos no desktop). Subir o `handleVisualSize` desktop de 14 para 16.

### 4. "Criar post" não aparece para posts únicos sem `card_copy`
**Causa**: em `EditorialPage.tsx` linha 583, a condição é:
```
(format === "carrossel" || format === "post") && day.card_copy?.length > 0
```
Quando o sétimo dia é um **post único** que a IA gerou sem array `card_copy` (apenas `caption`), o botão fica oculto.

**Correção**:
- Trocar a condição para mostrar o botão sempre que o formato for "post" ou "carrossel", independente do `card_copy`. Se o array vier vazio, o editor monta um post único usando `caption` como corpo (já é o fallback existente em `PostEditorPage`).
- Para "post" único: rótulo do botão continua "Criar post". Para "carrossel": idem.

### Arquivos editados
- `supabase/functions/fetch-post-image/index.ts` — remover cache IA, randomizar foto Unsplash, aceitar nonce.
- `src/lib/postAutoLayout.ts` — propagar nonce em `generateAIImage`.
- `src/components/post-editor/inspector/ImageGalleryPanel.tsx` — adicionar nonce ao chamar IA.
- `src/pages/PostEditorPage.tsx` — garantir `saveSinglePhotoToGallery` no `onPickImage` para IA, no `handleSwapBackground` e na primeira foto do template.
- `src/components/post-editor/inspector/AddElementPanel.tsx` — receber `canvasFormat` e ajustar tamanho inicial das molduras.
- `src/components/post-editor/PostCanvas.tsx` — handles laterais um pouco maiores no desktop.
- `src/pages/EditorialPage.tsx` — relaxar condição do botão "Criar post" para posts únicos.

### Resultado esperado
- Cada clique em "Trocar fundo" ou "Gerar com IA" devolve uma imagem **diferente** (mesmo para o mesmo tema).
- Toda imagem IA gerada cai automaticamente em **Minha galeria**, sem reload.
- Molduras retangulares entram no canvas já ajustadas ao formato 4:5 ou Reels, sem precisar redimensionar manualmente.
- O botão **"Criar post"** aparece em todos os dias da linha editorial cujo formato é "post" ou "carrossel".

