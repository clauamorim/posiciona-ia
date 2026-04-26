# Guias dinâmicas de alinhamento no editor de posts

## Objetivo
Mostrar guias visuais **somente durante o arrasto** de um elemento, para auxiliar o posicionamento (centro do canvas, alinhamento com bordas e com outros elementos). Nada de toggle, nada de réguas fixas — comportamento idêntico ao Figma/Canva.

## Comportamento esperado
- Quando o usuário **começa a arrastar** um elemento (imagem, ícone, caixa de texto ou botão CTA), linhas finas magenta aparecem instantaneamente quando suas bordas/centro se aproximam de:
  - Centro horizontal do canvas
  - Centro vertical do canvas
  - Bordas do canvas
  - Centro/bordas de outros elementos visíveis
- As linhas **somem imediatamente** ao soltar o mouse.
- Tolerância de snap: ~6px (no espaço do canvas) — suficiente para "grudar" sem atrapalhar o posicionamento livre.
- Quando há snap, a posição do elemento é ajustada para alinhar perfeitamente.

## Arquivo afetado
- `src/components/post-editor/PostCanvas.tsx` (único arquivo)

## Mudanças técnicas

### 1. Função utilitária `computeSnapAndGuides`
Criar uma função pura que recebe:
- Bounding box proposto do elemento sendo arrastado `{x, y, w, h}`
- Lista de targets (canvas + outros elementos): `[{x, y, w, h}]`

E retorna:
- `{ snappedX, snappedY, guides: { v: number[], h: number[] } }`

A função compara as 3 linhas-chave do elemento (start, center, end em cada eixo) com as 3 linhas-chave de cada target. Se a distância for ≤ 6px, aplica o snap e adiciona a coordenada da linha em `guides`.

### 2. Integrar no handler de `pointermove` (linhas 295-320)
Após calcular `proposedX/proposedY`:
- Montar a lista de targets: canvas inteiro + todos os `overlayImages` e `textBoxes` exceto o que está sendo arrastado.
- Chamar `computeSnapAndGuides`.
- Aplicar `snappedX/snappedY` em vez dos valores brutos.
- `setActiveGuides(guides)`.

### 3. Limpar guias ao soltar
No `handlePointerUp`: `setActiveGuides({ v: [], h: [] })`.

### 4. Renderizar as guias
Adicionar dentro do canvas (camada absoluta acima de tudo, abaixo dos handles de seleção):
```tsx
{(activeGuides.v.length > 0 || activeGuides.h.length > 0) && (
  <div className="absolute inset-0 pointer-events-none z-50">
    {activeGuides.v.map((x, i) => (
      <div key={`v${i}`} className="absolute top-0 bottom-0" style={{ left: x, width: 1, background: "#FF00FF" }} />
    ))}
    {activeGuides.h.map((y, i) => (
      <div key={`h${i}`} className="absolute left-0 right-0" style={{ top: y, height: 1, background: "#FF00FF" }} />
    ))}
  </div>
)}
```

## Fora de escopo (não fazer)
- Não adicionar toggle de réguas no `DocumentPanel` ou `MobileEditorBar`.
- Não persistir nada em `localStorage`.
- Não renderizar réguas com escala em pixels.
- Não tocar em `PostEditorPage.tsx`, `PostToolbar.tsx`, `DocumentPanel.tsx` ou `MobileEditorBar.tsx`.

## Resultado esperado
Ao arrastar qualquer elemento, linhas magenta finas aparecem no momento em que ele alinha com o centro do canvas ou outro elemento, e o item "encaixa" suavemente. Solte o mouse → as linhas somem. Sem nenhum controle visível na interface.
