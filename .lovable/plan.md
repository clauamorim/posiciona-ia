
Objetivo: corrigir 3 problemas restantes no editor: reset ao alternar janela/aba, botões de camada sem efeito visual real, e imagens enviadas não aparecendo na galeria como esperado.

1. Corrigir o reset ao alternar app/aba
- O `AuthContext` ainda pode recolocar a app em loading quando ocorre `SIGNED_IN` para o mesmo usuário já autenticado, o que desmonta páginas protegidas e reinicia o editor.
- Vou ajustar a lógica para que refresh/reativação da sessão do mesmo usuário apenas atualize `session`, sem reentrar em `isLoading`.
- No `PostEditorPage`, vou adicionar persistência de rascunho por usuário + conteúdo atual, salvando estado do editor em armazenamento temporário e restaurando antes da inicialização padrão.
- O rascunho vai incluir: textos, título, overlays, slide atual, layout, cores, gradiente, CTA, numeração, formato e demais controles visuais.
- O botão de reset também limpará esse rascunho.

2. Fazer “Para frente” e “Para trás” funcionarem de verdade no canvas
- Hoje a reordenação altera o array, mas o canvas ainda mistura z-index fixo por tipo/seleção, então a mudança nem sempre aparece visualmente.
- Vou unificar a pilha visual dos overlays: a ordem renderizada passará a seguir uma única hierarquia consistente para foto, elemento e caixa de texto.
- Vou remover overrides de z-index baseados em seleção e manter o destaque visual só com outline/handles.
- Os botões passarão a mover o item selecionado na pilha real do canvas, não apenas na listagem derivada.

3. Fazer upload aparecer na galeria
- Hoje a imagem enviada entra no canvas, e a “galeria” visível fica separada entre ativos administrativos e uma lista temporária derivada do estado atual.
- Vou transformar as imagens enviadas pelo usuário em uma fonte explícita de galeria do editor, persistida junto com o rascunho.
- Essas imagens aparecerão na própria área de galeria como “Minhas imagens”/“Imagens enviadas”, para poder reutilizar sem novo upload.
- Assim, mesmo após alternar aba/janela, as imagens continuarão disponíveis na galeria enquanto o rascunho existir.

Arquivos previstos
- `src/contexts/AuthContext.tsx`
- `src/pages/PostEditorPage.tsx`
- `src/components/post-editor/PostCanvas.tsx`
- `src/components/post-editor/PostToolbar.tsx`

Detalhes técnicos
- `textsInitializedRef` sozinho não resolve, porque ele só protege dentro do mesmo mount.
- A correção precisa combinar:
  1) não desmontar a rota desnecessariamente;
  2) restaurar estado do editor se houver remount.
- A galeria de uploads do usuário ficará separada da galeria administrativa, mas dentro da mesma experiência visual do editor.
