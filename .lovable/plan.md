

## Correções: minimalista, fundo da logo, escolha de estilo e texto solto

Vou atacar 4 problemas distintos identificados no print e no relato.

## 1. Estilo "minimalista" sem elementos decorativos

**Causa**: o template `minimal` define um `decorativeBlock` de apenas 200×6px (uma linha quase invisível). No estilo minimal, não há foto de fundo nem moldura — só o gradiente, a logo, o título e essa linha invisível. Resultado: parece "vazio".

**Correção em `postTemplates.ts`**:
- **Square minimal**: substituir a "linhinha" por um conjunto decorativo real:
  - Moldura interna fina (retângulo `1000×1000` em `40,40` com stroke de 2px)
  - Linha horizontal grossa decorativa abaixo do título (`160×4px` em x=460, y=440)
  - Pequeno losango ou bullet point centralizado entre título e corpo
- **Reels minimal**: mesma lógica, ajustada para 1080×1920.
- Adicionar nova função `buildMinimalDecorativeOverlays(template, paletteHex)` em `postTemplates.ts` que retorna **array** de overlays (moldura + linha + ornamento), não apenas um.
- Em `postAutoLayout.ts`, quando `style === "minimal"`, chamar essa função em vez do `buildDecorativeBlockOverlay` único.

## 2. Logo não fica com fundo transparente

**Causa**: a remoção de fundo só roda no momento do **upload com checkbox "É minha logo" marcado**. A logo do usuário no print foi enviada antes dessa lógica existir (ou marcada como logo só depois). O sistema usa o arquivo original.

**Correção**:
- **Reprocessamento sob demanda**: ao buscar a logo em `fetchUserLogo`, verificar se o arquivo é `.png` (já processado). Se for `.jpg`/`.jpeg`, chamar `remove-background` na hora, salvar o resultado como novo `.png`, atualizar `file_path` no `user_gallery_assets` e usar o novo signed URL.
- **Botão manual** em `AddElementPanel.tsx` na lista da galeria do usuário: botão "Remover fundo" ao lado do toggle "É logo", para reprocessar logos antigas a qualquer momento. Custo: zero (edge function gratuita).
- Adicionar coluna `bg_removed: boolean` na tabela `user_gallery_assets` via migration para evitar reprocessamento desnecessário.

## 3. Clicar "Unsplash" ou "IA" abre estilo minimalista

**Causa real** (revisando o código): o parâmetro `style` é passado corretamente via URL e `buildAutoLayout` recebe e processa. **Mas** quando `fetchBackgroundImage` falha silenciosamente (sem `UNSPLASH_ACCESS_KEY`, ou erro de rede, ou imagem rejeitada por filtros), `bgInfo` fica `null`, **nenhum overlay de fundo é adicionado**, e o canvas mostra só o gradiente padrão da paleta — visualmente idêntico ao minimal.

**Correção**:
- Em `buildAutoLayout`, se `style === "unsplash"` e a busca falhar:
  - Toast de erro claro: *"Unsplash indisponível — usando fundo gradiente. Tente trocar imagem no editor."*
  - Em vez de cair no gradiente sem aviso, **retornar `suggestions.useGradient: false`** e **forçar um fundo de cor sólida da paleta** (sem confundir com minimal).
- Idem para `style === "ai"`: se a IA falhar, toast explicativo + fallback para gradiente + retornar zero crédito (não cobrar).
- Adicionar **logging detalhado** na edge function `fetch-post-image` (já tem, mas vou verificar e adicionar `console.error` no path de erro do Unsplash para o usuário ver no painel de logs).
- Adicionar verificação do `UNSPLASH_ACCESS_KEY` no início da edge function — se ausente, retornar erro 503 explícito.

## 4. Caixa de texto solta no meio do canvas

**Causa**: o texto "1. Aquele cabelo que não 'coopera'..." é o `card_copy[0]` renderizado no `bodySlot` do template `cover` (y=940 no square). No print, o usuário escolheu Unsplash mas o fundo não carregou (problema #3), então o texto fica solto sem o contraste do bloco decorativo que deveria estar atrás dele.

**Correção**:
- Garantir que o `decorativeBlock` do template `cover` (a faixa de 1080×320 em y=760) seja renderizado **mesmo quando há foto de fundo** — hoje ele só ajuda a destacar o texto se aparece. No print parece que aparece, mas o texto está acima dele em y=940 dentro da faixa, então o problema visual é: a faixa é toda da mesma cor do gradiente, sumindo no fundo.
- Mudar `decorativeBlock.paletteIndex` do cover de `0` (cor primária) para um valor com **contraste forte** — usar `palette.find(usage="background")` ou cor escura (#1a1a2e com 92% opacidade).
- No `PostCanvas.tsx`, adicionar **fundo semi-translúcido automático** atrás do bloco de body text quando há foto de fundo — caixa preta com 40% opacidade e padding 24px (para legibilidade tipo legenda de Instagram).
- Numerar os textos do `card_copy` (já vem "1.", "2."...) sem prefixo extra. Verificar que `extractAfterBold` não está duplicando o número.

## Arquivos a editar

- `src/lib/postTemplates.ts` — novos overlays decorativos para minimal (moldura + linha + ornamento); contraste do bloco do cover.
- `src/lib/postAutoLayout.ts` — chamar overlays minimal; fallback claro quando Unsplash/IA falha; reprocessamento de logo antiga.
- `src/components/post-editor/inspector/AddElementPanel.tsx` — botão "Remover fundo" para logos antigas na galeria.
- `src/components/post-editor/PostCanvas.tsx` — fundo semi-translúcido automático atrás do body text quando há foto.
- `src/pages/PostEditorPage.tsx` — toast de erro quando estilo escolhido falha; não cobrar crédito IA em falha.
- `supabase/functions/fetch-post-image/index.ts` — verificação explícita da `UNSPLASH_ACCESS_KEY`; logs detalhados.
- **Migration SQL nova**: adicionar coluna `bg_removed BOOLEAN DEFAULT false` em `user_gallery_assets`.

## Fora do escopo

- Editor visual de moldura/decoração customizada pelo usuário (mantemos predefinidos).
- Reprocessar todas as logos existentes em batch (faz sob demanda quando o usuário abre o editor).
- Cache de imagens Unsplash (já existe via `post_background_cache`).

