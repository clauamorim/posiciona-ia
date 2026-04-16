

# Fix: Drag de elementos no editor mobile (sem scroll)

## Causa raiz

`PostCanvas.tsx` usa exclusivamente `onMouseDown` + listeners `mousemove`/`mouseup` no `window`. No mobile (iOS Safari, Chrome Android), eventos de toque não disparam handlers de mouse de forma confiável quando há intenção de scroll — o navegador interpreta o gesto como rolagem da página antes que o React entregue um `mousedown` sintético. Resultado: a página rola, o elemento não move.

## Solução (lightweight, MVP-friendly)

Migrar os handlers de drag/resize para **Pointer Events**, que unificam mouse + touch + caneta em um único pipeline confiável. Combinar com `touch-action: none` nos elementos arrastáveis para impedir o scroll nativo apenas onde há drag, preservando scroll normal no resto da página.

### Mudanças em `src/components/post-editor/PostCanvas.tsx`

1. **Renomear handlers** `handleMouseDown` → `handlePointerDown` (idem para text/CTA/resize/slide-number). Trocar `React.MouseEvent` por `React.PointerEvent`. Trocar atributos JSX `onMouseDown` → `onPointerDown`.

2. **Listeners globais**: nos dois `useEffect` de drag/resize (linhas 216-233 e 235-266) e no inline do slide-number (linhas 513-520):
   - `window.addEventListener("mousemove", ...)` → `window.addEventListener("pointermove", ..., { passive: false })`
   - `window.addEventListener("mouseup", ...)` → `window.addEventListener("pointerup", ...)` + `pointercancel`
   - Chamar `e.preventDefault()` dentro do `pointermove` ativo para travar scroll durante o gesto.

3. **Capturar o pointer** no `pointerdown`: `(e.target as HTMLElement).setPointerCapture(e.pointerId)` para garantir que o move continue chegando mesmo se o dedo sair do elemento.

4. **CSS `touch-action: none`** nos elementos arrastáveis (text boxes, overlays de imagem, CTA, slide number, handles de resize). Adicionar como propriedade inline `touchAction: "none"` nos `style` desses divs. Isso impede que o navegador roube o gesto para scroll antes do JS reagir.

5. **Não aplicar** `touch-action: none` no container externo do canvas — assim o usuário ainda pode rolar a página tocando fora dos elementos arrastáveis.

6. **Edição de texto preservada**: quando `editingTextId === tb.id`, o `pointerdown` retorna cedo (já existe esse early return), e `touch-action` permanece `auto` nesse caso para permitir seleção de texto / scroll dentro do contenteditable.

### Por que isso funciona no iPhone Safari

- Pointer Events são suportados nativamente desde iOS 13.
- `touch-action: none` é a forma oficial de impedir scroll/zoom em elementos interativos.
- `setPointerCapture` resolve o problema de "dedo escapou do elemento".
- Não muda nada no desktop: PointerEvents incluem mouse, com mesmas coordenadas (`clientX/Y`).

### Sem fallback necessário

Pointer Events + `touch-action: none` é robusto o suficiente para o MVP. Se algo falhar em algum device exótico, o desktop continua funcionando normalmente.

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/post-editor/PostCanvas.tsx` | Migrar mouse → pointer events, adicionar `touch-action: none` nos arrastáveis, `setPointerCapture` no down, `preventDefault` no move ativo |

Sem mudanças de schema, sem mudanças em lógica de geração, sem novas dependências.

