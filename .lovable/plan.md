
## Análise

Verifiquei o `SelectionPanel.tsx` (linhas 309-314): o botão "Excluir elemento" já está dentro do bloco condicional `(kind === "image" || kind === "icon" || kind === "textbox")`, então tecnicamente ele JÁ aparece para caixas de texto.

Preciso confirmar se o handler `onDeleteOverlay` no `PostEditorPage.tsx` realmente remove textboxes do estado correto, ou se elas vivem em estado separado de `overlayImages`.
