

## Botão Desfazer no Editor de Posts

Adicionar um botão **Desfazer** (com seta para trás) que permita reverter as **duas últimas alterações** feitas no editor (texto, imagens, cores, posições, fonte, layout, CTA, número do slide etc).

### Como vai funcionar

- O editor passa a manter um **histórico interno** dos últimos estados aplicados (até 10 passos para folga, mas o botão desfaz pelo menos as duas últimas).
- Cada alteração relevante (mover/redimensionar imagem, trocar cor, editar texto, mudar fonte, trocar fundo, adicionar/remover elemento, alterar CTA, alternar formato, etc.) gera um **snapshot** com debounce de ~400ms — assim digitar um parágrafo não cria 50 entradas no histórico, e sim uma só.
- Clicar em **Desfazer** restaura o snapshot anterior. Clicar de novo desfaz o penúltimo. E assim por diante até esgotar o histórico.
- Quando não há mais nada para desfazer, o botão fica desabilitado.
- Atalho de teclado: **Ctrl/Cmd + Z** também aciona o desfazer (sem interferir quando o foco está em campo de texto).

### Onde o botão aparece

- **Desktop**: dentro do `PostToolbar`, no topo do bloco de "Ações" (acima de "Salvar design" / "Baixar PNG"), como um botão `outline` pequeno com ícone `Undo2` da `lucide-react` e rótulo **"Desfazer"**.
- **Mobile**: dentro do `MobileEditorBar`, ao lado dos demais controles de ação rápida, como ícone com tooltip "Desfazer".

### Estado coberto pelo histórico

Snapshot inclui os campos visuais e estruturais do post: `editedTexts`, `editedTitle`, `overlayImages`, `bgIndex`, `layout`, `currentSlide`, `fontSize/Weight/Style`, `useGradient`, `gradientColor2Index`, `customGradientColor2`, `gradientDirection`, `textAlign`, `titleTextAlign`, `customTextColor`, `customBgColor`, `titleFontSize/Color/FontFamily`, `ctaText/BgColor/TextColor/FontSize/Position`, `canvasFormat`, `showSlideNumber`, `slideNumberPosition/BgColor/TextColor/Size`, `renderOrder`.

### Implementação técnica

- Novo hook `src/hooks/useEditorHistory.ts` que:
  - Recebe o objeto de estado consolidado.
  - Mantém uma pilha (`useRef`) com até 10 snapshots passados (LIFO).
  - Detecta mudanças via `useEffect` com debounce e empilha o snapshot anterior antes de aceitar o novo.
  - Expõe `undo()` (retorna o snapshot a aplicar) e `canUndo`.
- Em `src/pages/PostEditorPage.tsx`:
  - Integrar o hook após as declarações de estado.
  - Função `applyUndo` que recebe o snapshot e chama os `setX` correspondentes (com flag `isApplyingUndoRef` para não empilhar a aplicação como nova alteração).
  - Listener global de `keydown` para Ctrl/Cmd+Z (ignorando quando o alvo é input/textarea/contentEditable).
  - Passar `onUndo` e `canUndo` em `sharedToolbarProps`.
- Em `src/components/post-editor/PostToolbar.tsx`:
  - Aceitar `onUndo?` e `canUndo?` nas props.
  - Renderizar botão `outline sm` com `Undo2` no início da seção de ações.
- Em `src/components/post-editor/MobileEditorBar.tsx`:
  - Aceitar as mesmas props e renderizar botão equivalente na barra inferior.

### Arquivos editados

- `src/hooks/useEditorHistory.ts` (novo)
- `src/pages/PostEditorPage.tsx`
- `src/components/post-editor/PostToolbar.tsx`
- `src/components/post-editor/MobileEditorBar.tsx`

### Resultado esperado

- Botão **"Desfazer"** com seta para trás visível no editor (desktop e mobile).
- Permite reverter pelo menos as **duas últimas alterações** — na prática até ~10.
- Funciona também via atalho **Ctrl/Cmd + Z**.
- Não interfere em fluxos existentes (salvar design, baixar PNG, créditos de IA).

