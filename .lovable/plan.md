

# Plano: corrigir 3 bugs do editor de posts

## Causas raiz

**1. Botão Layout (DocumentPanel) confuso e aparenta não fazer nada**
- Os 3 botões "Layout" (centralizado/topo/dividido) reposicionam os blocos de título/corpo verticalmente no canvas.
- O efeito é sutil e o usuário confunde com o alinhamento de parágrafo (que está logo abaixo no painel de seleção).
- **Decisão**: remover o controle "Layout" do Documento. É redundante visualmente, confunde, e o reposicionamento manual via drag já cobre o caso. Mantém o estado interno `layout="centered"` como default fixo.

**2. Mudar alinhamento de parágrafo afeta TODOS os textos**
- Em `PostCanvas.tsx` linha 414, o `textAlign: bodyTextAlign` é aplicado em ambos título e corpo (não há ternário `isTitle ?`).
- Além disso, `textAlign` é um único state global compartilhado por todos os text boxes.
- **Decisão**: tornar o alinhamento dependente do tipo do text box selecionado:
  - Se `isTitle` → usar `titleTextAlign` (novo state).
  - Se body → usar `bodyTextAlign` (atual `textAlign`).
- O painel de seleção já mostra os controles de alinhamento apenas quando `kind === "body"`, então o controle só edita o corpo. Para o título, adicionar controles de alinhamento no painel `kind === "title"` que editam `titleTextAlign`.

**3. Recolorir ícones/barras/molduras não atualiza visualmente**
- A função `handleRecolorElement` em `PostEditorPage.tsx` substitui apenas `fill=` e `stroke=`, mas Lucide renderiza com atributo `color="#hex"` no `<svg>` raiz e os filhos usam `stroke="currentColor"`. Ao trocar `stroke="currentColor"` por `stroke="#novo"`, funciona — mas se o SVG já foi recolorido uma vez, o ciclo seguinte pode falhar dependendo da ordem dos atributos.
- Fix robusto: substituir TAMBÉM o atributo `color="..."` no `<svg>` raiz (que serve `currentColor`), garantindo que qualquer referência a `currentColor` propague o novo tom; e injetar `color="#novo"` se ainda não existir.

---

## Mudanças

### A) `src/components/post-editor/inspector/DocumentPanel.tsx`
- Remover o bloco "Layout" (3 botões centered/top/split) e seus props relacionados.
- Sem outras mudanças.

### B) `src/components/post-editor/PostToolbar.tsx`
- Remover props `layout` / `onLayoutChange` (não são mais usados pelo DocumentPanel).

### C) `src/pages/PostEditorPage.tsx`
- Manter `layout` como default `"centered"` interno (não passar mais ao toolbar).
- Adicionar state `titleTextAlign` e `setTitleTextAlign`, persistir no draft + design save/load.
- Passar `titleTextAlign` ao `PostCanvas` / `CarouselEditor`.
- Endurecer `handleRecolorElement`:
  ```ts
  let recolored = decoded
    .replace(/(fill|stroke|color)="(?!none)[^"]*"/g, (_m, attr) => `${attr}="${color}"`);
  // garantir color= no <svg> raiz (controla currentColor)
  if (!/<svg[^>]*\\bcolor=/.test(recolored)) {
    recolored = recolored.replace(/<svg([^>]*)>/, `<svg$1 color="${color}">`);
  }
  ```

### D) `src/components/post-editor/PostCanvas.tsx`
- Receber prop opcional `titleTextAlign`.
- No `renderTextBox`, aplicar `textAlign: isTitle ? (titleTextAlign || "center") : bodyTextAlign`.

### E) `src/components/post-editor/CarouselEditor.tsx`
- Pass-through de `titleTextAlign` para `PostCanvas`.

### F) `src/components/post-editor/inspector/SelectionPanel.tsx`
- No painel `kind === "title"`, adicionar 4 botões de alinhamento (left/center/right/justify) editando `titleTextAlign` via novos props `titleTextAlign` + `onTitleTextAlignChange`.

### G) `src/components/post-editor/PostToolbar.tsx`
- Adicionar props `titleTextAlign` + `onTitleTextAlignChange` e repassar ao `SelectionPanel`.

---

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/post-editor/inspector/DocumentPanel.tsx` | Remover bloco "Layout" |
| `src/components/post-editor/PostToolbar.tsx` | Remover props layout; adicionar props titleTextAlign |
| `src/components/post-editor/inspector/SelectionPanel.tsx` | Adicionar alinhamento no painel título |
| `src/components/post-editor/PostCanvas.tsx` | Aplicar alinhamento separado para título |
| `src/components/post-editor/CarouselEditor.tsx` | Pass-through titleTextAlign |
| `src/pages/PostEditorPage.tsx` | State titleTextAlign + recolor robusto |

Sem mudanças de schema. Sem mudanças em geração de relatório, créditos ou Stripe.

