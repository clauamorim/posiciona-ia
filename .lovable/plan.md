
## Pacote de correções 9 — galeria com thumbnails funcionando + contexto completo para IA/Unsplash + proporção correta

### 1. Corrigir por que as imagens não aparecem no editor nem em “Minha galeria”
**Causa principal:** o bucket `user-uploads` é privado, mas alguns pontos do app ainda usam `getPublicUrl(...)`. Isso gera URL inválida para exibição, então:
- a imagem até pode estar salva no banco/storage;
- porém o thumbnail quebra;
- e a galeria parece vazia ou com ícone de imagem quebrada.

**Correção:**
- Trocar `getPublicUrl(...)` por `createSignedUrl(...)` em todos os fluxos da galeria do usuário:
  - `src/components/post-editor/inspector/ImageGalleryPanel.tsx`
  - `src/pages/MyGalleryPage.tsx`
  - `src/pages/PostEditorPage.tsx` no fluxo `fromGallery`
- Padronizar um helper para resolver URLs assinadas do bucket `user-uploads`, evitando regressão.
- Atualizar também o download da galeria para usar a URL assinada já carregada no card.

### 2. Garantir que imagens geradas por IA realmente entrem na galeria
Hoje já existe tentativa de salvamento, mas o comportamento precisa ficar inequívoco e rastreável.

**Correção:**
- Consolidar o salvamento em um único fluxo robusto em `src/pages/PostEditorPage.tsx`, com:
  - deduplicação por URL de origem;
  - upload no bucket privado;
  - insert em `user_gallery_assets` com `source = 'ai'` ou `source = 'unsplash'`;
  - disparo do evento `posiciona:gallery-updated` somente após insert bem-sucedido.
- Garantir cobertura em todos os pontos:
  - geração inicial automática do post;
  - troca de fundo;
  - escolha manual no painel de imagens;
  - geração manual por IA no painel.
- Ajustar a recarga no editor:
  - `ImageGalleryPanel.tsx`
  - `AddElementPanel.tsx`
  para sempre refletirem o estado novo sem reload.

### 3. Usar contexto completo do post para IA e Unsplash
Você pediu que a imagem seja gerada/buscada considerando:
- área/nicho do negócio;
- copy do post;
- legenda do post.

Hoje o backend usa sobretudo tema/nicho/contexto de negócio, mas ainda não aproveita a copy completa do post.

**Correção:**
- Montar um contexto textual mais rico no cliente, incluindo:
  - título/tema;
  - corpo do post (`card_copy` ou `editedTexts`);
  - legenda (`caption`);
  - CTA, quando existir;
  - nicho + contexto do negócio.
- Passar esse contexto para todos os pontos que buscam/geram imagem:
  - `buildAutoLayout(...)`
  - `fetchBackgroundImage(...)`
  - `fetchImageGallery(...)`
  - `generateAIImage(...)`
  - `StyleSelectionModal.tsx` (preview Unsplash)
  - `ImageGalleryPanel.tsx` (busca manual e geração IA)
- No backend (`supabase/functions/fetch-post-image/index.ts`):
  - expandir `buildSearchQuery(...)` para considerar copy + legenda, não só tema;
  - expandir `translateThemeForAI(...)` para virar um construtor de prompt/contexto visual com:
    - nicho;
    - intenção do post;
    - assunto central da copy;
    - legenda;
    - restrições visuais.
- Priorizar o nicho, mas usar copy/legenda para refinar a cena e evitar imagens genéricas.

### 4. Gerar/buscar imagem na proporção real do card ou do reels
Hoje a nomenclatura ainda usa `square | portrait` em vários pontos, e a edge function ainda trata card como “square”.

**Correção:**
- Substituir semanticamente o uso de `square` por `card` (4:5) nos fluxos de imagem, ou manter a tipagem interna mas remapear corretamente para:
  - `card` = 4:5
  - `reels` = 9:16
- Em `supabase/functions/fetch-post-image/index.ts`:
  - Unsplash:
    - `card` → `orientation=portrait`
    - `reels` → `orientation=portrait`
    - filtrar resultados preferindo fotos com proporção próxima do alvo (4:5 ou 9:16), não apenas largura mínima.
  - IA:
    - prompt explícito para composição em 4:5 ou 9:16;
    - reforçar enquadramento vertical e área segura para texto.
- Em `src/lib/postAutoLayout.ts`:
  - propagar formato correto para todos os invokes da edge function.
- Resultado esperado:
  - imagem de card nasce pensada para 1080x1350;
  - imagem de reels nasce pensada para 1080x1920;
  - menos cortes ruins e menos áreas vazias.

### 5. Melhorar a escolha visual para Unsplash
Além do contexto textual, a seleção deve ficar menos literal e mais útil para layout editorial.

**Correção:**
- No backend, ranquear os resultados do Unsplash considerando:
  - aderência ao nicho;
  - aderência aos termos da copy/legenda;
  - proporção mais próxima do formato alvo;
  - espaço negativo útil para sobrepor texto.
- Continuar variando os resultados entre opções relevantes, sem repetir sempre a mesma foto.

### 6. Ajustes de UX para deixar claro o que foi salvo
- `ImageGalleryPanel.tsx`:
  - manter “Suas imagens salvas” sempre sincronizado;
  - exibir thumbnails com URL assinada;
  - mostrar estado vazio correto se ainda não houver itens.
- `MyGalleryPage.tsx`:
  - thumbnails funcionais;
  - filtro IA / Unsplash realmente refletindo os itens recém-gerados;
  - ação “Usar” carregando imagem com URL assinada no editor.
- Mensagem de sucesso mais explícita quando uma imagem IA/Unsplash entra na galeria.

### Arquivos envolvidos
- `src/pages/PostEditorPage.tsx`
- `src/pages/MyGalleryPage.tsx`
- `src/components/post-editor/inspector/ImageGalleryPanel.tsx`
- `src/components/post-editor/inspector/AddElementPanel.tsx`
- `src/components/post-editor/StyleSelectionModal.tsx`
- `src/lib/postAutoLayout.ts`
- `supabase/functions/fetch-post-image/index.ts`

### Resultado esperado
- Imagens geradas por IA passam a aparecer corretamente:
  - no editor de posts;
  - em “Minha galeria”.
- Thumbnails deixam de quebrar.
- IA e Unsplash passam a considerar:
  - nicho do negócio;
  - copy do post;
  - legenda.
- Imagens passam a ser geradas/buscadas com enquadramento coerente para:
  - card 4:5;
  - reels 9:16.
