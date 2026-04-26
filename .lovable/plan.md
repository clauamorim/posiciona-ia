## Objetivo
Substituir o **Unsplash** pelo **Pexels** como banco de imagens do Editor de Posts. Remover o banner de atribuição (Pexels não exige), mas preservar o nome do fotógrafo nos metadados da galeria pessoal.

---

## 1. Nova chave de API (Pexels)

- Pedir ao usuário a secret **`PEXELS_API_KEY`** (gerada gratuitamente em pexels.com/api).
- Manter `UNSPLASH_ACCESS_KEY` no projeto por ora (sem uso ativo) — pode ser removida depois.

## 2. Edge function `fetch-post-image`

Arquivo: `supabase/functions/fetch-post-image/index.ts`

- Substituir `UNSPLASH_URL` por endpoint Pexels:
  - `https://api.pexels.com/v1/search?query=...&orientation=portrait&per_page=12&page=N`
- Trocar header de auth: `Authorization: ${PEXELS_API_KEY}` (sem `Client-ID`).
- Renomear `searchUnsplashList` → `searchPexelsList` e mapear o payload do Pexels:
  - `url` ← `photo.src.large2x` (ou `large`)
  - `width`/`height` ← `photo.width`/`height`
  - `photographer.name` ← `photo.photographer`
  - `photographer.profileUrl` ← `photo.photographer_url`
  - Campo `unsplashUrl` vira `sourceUrl` ← `photo.url` (página do Pexels com a foto)
- Atualizar variável de ambiente lida: `Deno.env.get("PEXELS_API_KEY")` (com fallback de erro claro).
- Manter mesmo contrato de resposta (`results[]`, `url`, `source`, `photographer`), apenas trocando `unsplashUrl` por `sourceUrl` e `source: "unsplash"` por `source: "pexels"`.

## 3. Tipos compartilhados no front

Arquivo: `src/lib/postAutoLayout.ts`

- Tipo `PhotographerInfo`: renomear `unsplashUrl` → `sourceUrl`.
- Tipo `PostStyle`: `"minimal" | "pexels" | "ai"` (renomeado de `unsplash`).
- Tipo de `backgroundSource`: `"pexels" | "ai" | "cache" | "none"`.
- Adaptar todas as comparações `style === "unsplash"` para `style === "pexels"`.
- Atualizar mapeamento do retorno da edge function.

## 4. Componentes do editor

Renomear/atualizar referências em:
- `src/components/post-editor/inspector/ImageGalleryPanel.tsx` — texto "Buscar no Unsplash" → "Buscar no Pexels"; badge `"UN"` → `"PX"`; `source` literal `"unsplash"` → `"pexels"`.
- `src/components/post-editor/inspector/AddElementPanel.tsx` — labels "Unsplash + IA" → "Pexels + IA"; tooltips e textos de ajuda.
- `src/components/post-editor/PostToolbar.tsx` — props `onUnsplashPick` → `onPexelsPick` (e tipo do photographer).
- `src/components/post-editor/MobileEditorBar.tsx` — repassar a nova prop.
- `src/components/post-editor/StyleSelectionModal.tsx` — id `"unsplash"` → `"pexels"`, título "Com foto (Pexels)".
- `src/components/post-editor/PostCanvas.tsx` — atualizar union de `postStyle`.
- `src/lib/postTemplates.ts` — atualizar comparação de estilo.

## 5. Página do editor

`src/pages/PostEditorPage.tsx`:
- Trocar `sourceHint` e literais `"unsplash"` por `"pexels"`.
- Regex de detecção: trocar `images.unsplash.com|plus.unsplash.com` por `images.pexels.com`.
- Toast pós-troca: "Imagem atualizada · Fonte: Pexels (gratuita)".
- **Remover** importação e renderização de `<UnsplashAttribution />`.
- Remover qualquer state relacionado ao banner (`pendingPhotographer` etc.).

## 6. Remover o banner de atribuição

- Excluir `src/components/post-editor/UnsplashAttribution.tsx`.
- Garantir que o `photographer` ainda seja **persistido nos metadados** da galeria pessoal (`user_gallery_assets.attribution`) — só não é exibido em banner.

## 7. Galeria pessoal (`MyGalleryPage`)

`src/pages/MyGalleryPage.tsx`:
- Filtro `"unsplash"` → `"pexels"` (label "Pexels").
- Badge "Unsplash" → "Pexels".
- Texto "Foto por X / Unsplash" → "Foto por X / Pexels" (mantido só na galeria, não no canvas).
- Atualizar contagens e tooltips relacionados.

## 8. Banco de dados

Tabela `user_gallery_assets`:
- O default da coluna `source` ainda é `'unsplash'` (migração antiga). Criar **nova migração** para alterar default para `'pexels'`. Linhas existentes ficam intocadas (continuam exibindo "Unsplash" na galeria, o que é correto historicamente).

## 9. Limpeza final

- Remover importações órfãs de `UnsplashAttribution`.
- Verificar build TypeScript (sem referências a `unsplashUrl`).
- Atualizar comentários no código que ainda mencionam Unsplash como fonte ativa.

---

## Arquivos afetados
- `supabase/functions/fetch-post-image/index.ts`
- `supabase/migrations/<nova>.sql`
- `src/lib/postAutoLayout.ts`
- `src/lib/postTemplates.ts`
- `src/components/post-editor/inspector/ImageGalleryPanel.tsx`
- `src/components/post-editor/inspector/AddElementPanel.tsx`
- `src/components/post-editor/PostToolbar.tsx`
- `src/components/post-editor/MobileEditorBar.tsx`
- `src/components/post-editor/StyleSelectionModal.tsx`
- `src/components/post-editor/PostCanvas.tsx`
- `src/components/post-editor/UnsplashAttribution.tsx` (excluído)
- `src/pages/PostEditorPage.tsx`
- `src/pages/MyGalleryPage.tsx`

## Pré-requisito
Antes da implementação eu vou pedir a secret `PEXELS_API_KEY`. Pegue a chave grátis em **pexels.com/api** (precisa de conta Pexels — sem cartão).