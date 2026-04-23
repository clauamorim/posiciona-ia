## O problema identificado

Sim, eu já sei o que está quebrado. Os prints batem com 5 falhas reais no código atual:

1. **IA reaproveitando imagem do Unsplash**
   - A função `fetch-post-image` salva tudo na mesma cache `post_background_cache` usando só `theme_hash`.
   - Resultado: quando você pede IA para um tema que já teve busca no banco de imagens, o sistema pode devolver a imagem cacheada do Unsplash como se fosse IA.

2. **Caixa branca/retângulo no layout com foto**
   - Em `postAutoLayout.ts`, os estilos `unsplash` e `ai` ainda adicionam `decorativeBlock` sólido do template.
   - Isso explica a faixa/bloco branco embaixo, em vez do degradê de referência.

3. **Minimalista com texto fora do lugar**
   - Para posts únicos, `pickSingleTemplate()` escolhe template por hash e **não respeita o estilo escolhido**.
   - Então o editor pode usar posições de texto de um template “content” mesmo quando o estilo esperado é “minimal”.

4. **Logo continua com fundo branco**
   - `fetchUserLogo()` testa transparência, mas quando chama `remove-background` ele salva o retorno bruto sem aplicar o `chromaKey` verde que a função devolve.
   - Além disso, a URL final fica em `sessionStorage`, então uma logo antiga com fundo pode continuar sendo reutilizada.

5. **Créditos sendo perdidos sem garantia de resultado correto**
   - Hoje o débito acontece após qualquer retorno de `generateAIImage`, sem validar se a imagem realmente veio com `source: "ai"`.
   - Como a cache pode devolver Unsplash, o crédito pode ser cobrado indevidamente.

## Plano de correção

### 1. Separar corretamente fonte IA vs banco de imagens
- Ajustar `supabase/functions/fetch-post-image/index.ts` para diferenciar cache por fonte/estratégia.
- Quando `allowAI: true`, não reutilizar cache de Unsplash como se fosse IA.
- Retornar metadados consistentes de origem (`source: "ai" | "unsplash" | "cache"`) com semântica correta.
- Se necessário, usar chave de cache distinta por modo.

### 2. Remover o bloco branco e aplicar o visual da referência
- Em `src/lib/postAutoLayout.ts`, parar de injetar `decorativeBlock` sólido nos estilos `unsplash` e `ai`.
- Manter apenas:
  - foto de fundo,
  - logo,
  - degradê de legibilidade no canvas.
- Em `PostCanvas.tsx`, ajustar o degradê para ocupar a base do canvas no padrão do print de referência, sem caixa opaca separada.

### 3. Fazer o minimalista respeitar o template certo
- Ajustar `src/lib/postTemplates.ts` para permitir escolher template de post único com base no estilo selecionado.
- Quando o estilo for `minimal`, usar sempre slots compatíveis com minimalismo.
- Refinar `titleSlot` e `bodySlot` para não empurrar texto para áreas erradas.
- Garantir que moldura, linha e ornamento continuem consistentes com o layout minimalista.

### 4. Corrigir a remoção de fundo da logo de ponta a ponta
- Em `src/lib/postAutoLayout.ts`, reaproveitar a lógica de chroma key já existente no editor antes de salvar a nova logo.
- Só considerar a logo “corrigida” quando o PNG final realmente tiver alpha.
- Invalidar o cache de sessão da logo quando houver reprocessamento.
- Se a remoção falhar, evitar persistir uma versão errada como se estivesse resolvida.

### 5. Proteger créditos e impedir cobrança indevida
- Em `src/components/post-editor/inspector/ImageGalleryPanel.tsx` e `src/pages/PostEditorPage.tsx`, só debitar crédito quando a resposta estiver validada como geração IA real.
- Se a origem vier de cache/Unsplash ou falhar, não debitar.
- Ajustar feedback na interface para mostrar claramente quando a imagem veio de IA versus banco de imagens.

### 6. Limpar efeitos colaterais que mascaram correções
- Revisar `sessionStorage` do rascunho e do cache da logo para não reaplicar estado antigo quebrado.
- Garantir que trocar estilo ou resetar o editor recompute overlays e slots corretos.
- Revisar `onSwapBackgroundUrl` para manter apenas um fundo ativo e preservar a atribuição correta.

## Arquivos que serão alterados
- `supabase/functions/fetch-post-image/index.ts`
- `src/lib/postAutoLayout.ts`
- `src/lib/postTemplates.ts`
- `src/components/post-editor/PostCanvas.tsx`
- `src/pages/PostEditorPage.tsx`
- `src/components/post-editor/inspector/ImageGalleryPanel.tsx`

## Resultado esperado
- Minimalista com texto alinhado corretamente.
- Unsplash sem caixa branca; visual próximo ao seu print de referência.
- “Gerar com IA” usando imagem realmente gerada por IA.
- Logo sem fundo branco quando a remoção funcionar.
- Crédito debitado apenas quando a geração por IA for de fato bem-sucedida.

<lov-actions>
  <lov-open-history>View History</lov-open-history>
</lov-actions>

<lov-actions>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>