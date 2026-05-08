## Diagnóstico

Vendo o código atual, identifiquei dois problemas que explicam exatamente o que você descreveu:

### 1. Clicar na toolbar flutuante "vaza" para o bloco inteiro

No `InlineFormatToolbar.tsx`, ao clicar num botão (B/I/U):

```tsx
const apply = (cmd) => (e) => {
  e.preventDefault();
  if (!editableEl) return;
  editableEl.focus();           // ← perde a seleção (colapsa)
  document.execCommand(cmd);
};
```

Dois problemas combinados:

- **Os `<button>` não têm `onMouseDown` com `preventDefault`** no `mousedown` nativo do navegador. Resultado: quando você clica no botão, o foco sai da `<div contentEditable>`, dispara `onBlur` no canvas → `setEditingTextId(null)` → o elemento deixa de ser editável **antes** do `execCommand` rodar.
- **`editableEl.focus()` é chamado depois** que a seleção já foi perdida, então `execCommand('bold')` acaba aplicando ao "estado padrão" da caixa, o que pode parecer que afetou o bloco todo.

### 2. Título não funciona

O título tem o estilo:

```tsx
fontWeight: isTitle ? typo.titleWeight : bodyFontWeight,
fontStyle:  isTitle ? "normal"         : bodyFontStyle2,
```

Como `typo.titleWeight` já é 700/800, o `<strong>` aplicado dentro pode não mudar visualmente o peso (já está no máximo). E pior: quando se entra em modo de edição no título, o mesmo problema do bug #1 acontece — a seleção é perdida ao clicar na toolbar, e como o título normalmente é uma única linha curta, o efeito visual de "foi pro bloco inteiro" também aparece.

## Correções

### `InlineFormatToolbar.tsx`

1. **Preservar a seleção ao clicar nos botões**: usar `onMouseDown` com `e.preventDefault()` no próprio `<button>` (não só no `<div>` pai). Isso impede o foco de sair do contentEditable.
2. **Salvar e restaurar a `Range` antes do `execCommand`** como cinto-e-suspensórios:
   - Ao detectar seleção válida em `update()`, guardar a `Range` num `useRef`.
   - Em `apply()`, em vez de chamar `editableEl.focus()` cego, restaurar a range salva via `selection.removeAllRanges()` + `selection.addRange(savedRange)` e só então rodar `execCommand`.
3. **Re-detectar estado dos botões** (`queryCommandState`) após o comando, mantendo a UI consistente.

### `PostCanvas.tsx` — título

4. **Permitir que `<strong>` no título seja visível**: trocar a aplicação rígida de `fontWeight` no título por uma estratégia que permite override:
   - Aplicar `typo.titleWeight` apenas como peso "base" do contêiner.
   - Garantir que `<strong>` use um peso visualmente distinto: incluir CSS específico (via `style` numa classe ou `<style>` inline injetado uma vez) que force `strong { font-weight: 900; }` quando o pai já é 700+, ou troque para `font-weight: 400` quando o título base já é 800/900 (assim o "negrito" passa a ser um contraste visível em qualquer cenário).
   - Mesma lógica para `<em>` (forçar `font-style: italic`) já que o título tem `fontStyle: "normal"` rígido — sem isso, `<em>` é ignorado visualmente em alguns arquétipos.

5. **Sanitização no `onBlur` não pode disparar antes do `execCommand`**: o fix do bug #1 já resolve isso indiretamente (o `preventDefault` no botão impede o blur). Como reforço, adicionar uma verificação no `onBlur` do contentEditable: se o `relatedTarget` (próximo foco) estiver dentro da toolbar flutuante, ignorar o blur. Detecto a toolbar via `data-inline-format-toolbar` no wrapper do `InlineFormatToolbar`.

## Arquivos afetados

```text
src/components/post-editor/InlineFormatToolbar.tsx   (fix de seleção + save/restore range + data attr)
src/components/post-editor/PostCanvas.tsx            (CSS p/ <strong>/<em> dentro do título; onBlur ignora foco na toolbar)
```

## Validação

Depois de implementar, testar no preview que já está aberto:

1. Body — selecionar uma palavra, clicar **B** → só a palavra fica em negrito.
2. Body — selecionar duas palavras, clicar **I** depois **U** → só essas duas ficam itálico+sublinhado.
3. Título — selecionar uma palavra, clicar **B** → contraste visível de peso só naquela palavra.
4. Atalhos Ctrl/Cmd+B/I/U continuam funcionando (já estão corretos).
5. Exportar PNG e conferir que `<strong>`/`<em>`/`<u>` saem corretamente renderizados.
