

## Plano: Unificar paleta de cores para ícones/formas/molduras

### Causa
Existem 2 paletas separadas no editor:
1. **`AddElementPanel.tsx`** (abas Ícones/Molduras): paleta "Cor de novos elementos" via prop `elementColor` + `onElementColorChange`.
2. **`SelectionPanel.tsx`** (quando `kind === "icon"`): paleta "Cor" via prop `onRecolorElement`.

Ambas existem simultaneamente no sidebar quando um ícone está selecionado, gerando confusão.

### Solução
Uma única paleta contextual no topo de cada aba (Ícones / Molduras), cujo comportamento muda conforme há ou não seleção:
- **Sem seleção** → define `elementColor` (cor padrão para novos elementos). Label: "Cor padrão para novos elementos".
- **Com ícone/moldura selecionado** → recolore o elemento selecionado em tempo real. Label: "Cor do elemento selecionado".

Remover a paleta duplicada do `SelectionPanel` (quando `kind === "icon"`).

---

### Mudanças

**A) `AddElementPanel.tsx`**
- Receber novas props: `hasSelectedElement: boolean` + `onRecolorSelected?: (color: string) => void`.
- No topo das abas Ícones e Molduras, renderizar uma paleta única:
  - Label dinâmico baseado em `hasSelectedElement`.
  - Handler unificado: se `hasSelectedElement` → chama `onRecolorSelected(c)`; senão → chama `onElementColorChange(c)`.
  - Mostrar `value` = `elementColor` quando sem seleção (sem highlight quando há seleção, pois a cor do elemento já foi aplicada).

**B) `SelectionPanel.tsx`**
- Remover o bloco de `ColorPicker` quando `kind === "icon"` (linhas que renderizam "Cor" + `onRecolorElement`). Manter apenas opacidade + ordem de camada.
- Manter a prop `onRecolorElement` no tipo (ainda usada via AddElementPanel, mas não renderizada aqui).

**C) `PostToolbar.tsx`**
- Calcular `hasSelectedIconOrFrame` = `selectedKind === "icon"`.
- Passar `hasSelectedElement` + `onRecolorSelected={onRecolorElement}` ao `AddElementPanel`.

**D) `PostEditorPage.tsx`**
- Sem mudanças funcionais. `handleRecolorElement` já existe e funciona para ícones e molduras (ambos são `type: "element"`).

---

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/post-editor/inspector/AddElementPanel.tsx` | Paleta única contextual no topo de Ícones/Molduras |
| `src/components/post-editor/inspector/SelectionPanel.tsx` | Remover ColorPicker do bloco `kind === "icon"` |
| `src/components/post-editor/PostToolbar.tsx` | Passar `hasSelectedElement` + `onRecolorSelected` ao AddElementPanel |

Sem mudanças de schema. Sem mudanças em geração, créditos ou Stripe.

