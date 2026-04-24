# Corrigir modal de seleção de estilo no mobile

## Problema

No mobile, ao clicar em "Gerar posts", o modal "Escolha o estilo do post" abre com os 3 cards (Minimalista, Unsplash, IA) empilhados verticalmente. Como cada card tem um preview grande (quadrado ou 9:16) e o `DialogContent` é centralizado na tela sem limite de altura nem rolagem, o conteúdo extrapola o viewport para cima e para baixo. O usuário não consegue rolar dentro do modal nem alcançar o rodapé com os botões "Pular" e "Abrir com este estilo".

## Causa técnica

`src/components/ui/dialog.tsx` — o `DialogContent` usa `top-[50%] translate-y-[-50%]` sem `max-height` nem `overflow`. Combinado com `StyleSelectionModal` (3 cards grandes em coluna no mobile), o conteúdo fica maior que a tela e fica inacessível.

## Solução

Mudanças mínimas e localizadas em **um único arquivo**: `src/components/post-editor/StyleSelectionModal.tsx`.

1. **Limitar a altura do modal e habilitar rolagem interna**:
   - Adicionar ao `DialogContent`: `max-h-[90vh] overflow-hidden flex flex-col` para que o modal nunca ultrapasse 90% da altura da tela e organize seu conteúdo em coluna.

2. **Rolagem somente na área dos cards**:
   - Envolver o grid dos 3 cards em um wrapper com `overflow-y-auto flex-1 -mx-1 px-1` para que header e footer fiquem fixos e apenas os cards rolem.

3. **Reduzir o tamanho do preview no mobile** (defesa extra):
   - Para a opção Minimalista e IA, trocar o `aspect` por uma altura fixa menor no mobile (ex.: `h-32 sm:aspect-square` quando `format === "square"`, e `h-40 sm:aspect-[9/16]` quando `portrait`). Mantém a proporção certa no desktop e evita previews enormes no mobile.
   - Para o card Unsplash (que mostra a foto real), aplicar a mesma regra para alinhar visualmente.

4. **Footer sempre visível**:
   - Adicionar `shrink-0` ao `DialogFooter` para garantir que não seja comprimido e que os botões "Pular" e "Abrir com este estilo" estejam sempre acessíveis.

## Detalhes técnicos

Arquivo a editar: `src/components/post-editor/StyleSelectionModal.tsx`

- `DialogContent` recebe `className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"`.
- Novo wrapper rolável envolve o `<div className="grid ...">` dos cards com `className="overflow-y-auto flex-1 min-h-0 -mx-1 px-1"`.
- Os previews dentro de cada card passam a usar uma altura responsiva: `h-32 sm:h-auto sm:aspect-square` (square) ou `h-40 sm:h-auto sm:aspect-[9/16]` (portrait), preservando o `rounded-md overflow-hidden` atual.
- `DialogFooter` recebe `shrink-0` adicional para impedir compressão.

Nada muda na lógica (seleção, preview do Unsplash, créditos, callbacks). Não é necessário alterar `dialog.tsx` (mantém compatibilidade com outros modais).

## Validação esperada

- No mobile (390x567 e similares): o modal abre ocupando até 90% da tela, com os 3 cards roláveis dentro dele e os botões "Pular e abrir editor vazio" e "Abrir com este estilo" sempre visíveis no rodapé.
- No desktop: aparência praticamente idêntica à atual (cards lado a lado com previews em aspect ratio original).
