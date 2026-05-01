## Objetivo

Resolver quatro problemas no editor de posts (PostEditorPage):

1. CTA do post precisa permitir quebra em duas linhas.
2. Botão "Salvar design" deve ficar lado a lado com "Baixar PNG".
3. Em carrosséis, ao trocar de slide as edições de posição/tamanho dos textos do slide anterior são perdidas.
4. Em "Meus designs", o thumbnail mostra o estado salvo, mas ao reabrir o design as posições/tamanhos dos textos voltam ao layout inicial.

Os itens 3 e 4 têm a mesma causa raiz: as posições e dimensões das caixas de título e corpo (`textBoxes`) vivem só no estado local do `PostCanvas`. Ao trocar de slide ou recarregar um design salvo, esse estado é recriado a partir do template padrão.

## Mudanças

### 1. Permitir CTA em duas linhas

Arquivo: `src/components/post-editor/PostCanvas.tsx`

- Trocar `whitespace-nowrap` do CTA por `whiteSpace: "pre-line"` e remover/ajustar a classe `whitespace-nowrap` nos dois pontos onde o CTA é renderizado (último slide e variante `split`).
- Manter `textAlign: center` e `lineHeight` confortável (≈ 1.15) para que o quebra de linha fique legível.

Arquivo: `src/components/post-editor/inspector/SelectionPanel.tsx`

- O input de texto do CTA hoje é `<Input>` (uma linha). Trocar por `<Textarea>` (já existe em `src/components/ui/textarea.tsx`) com `rows={2}` para o usuário conseguir digitar Enter e gerar a quebra.
- Pequena instrução abaixo: "Use Enter para quebrar a linha".

Não exige mudança no estado: o `ctaText` já é uma string e a quebra `\n` viaja naturalmente até o canvas e para o JSON salvo.

### 2. Botão "Salvar design" ao lado de "Baixar PNG"

Arquivo: `src/components/post-editor/PostToolbar.tsx`

- Reorganizar o bloco "Actions" para colocar "Salvar design" e "Baixar PNG" lado a lado em um `flex gap-2`, ocupando largura igual.
- "Desfazer" continua acima, ocupando linha cheia.
- "Salvar como modelo" continua abaixo, ocupando linha cheia (é uma ação secundária menos frequente).

Resultado visual:

```text
[ Desfazer (Ctrl+Z)              ]
[ Salvar design ] [ Baixar PNG  ]
[ Salvar como modelo             ]
```

Manter o mesmo comportamento (estado `saving`, label "Salvando…", ícones).

### 3 + 4. Persistir posições dos textos por slide e ao salvar/recarregar designs

Causa raiz: `textBoxes` (posição, largura e altura das caixas de título e corpo) só existem como `useState` dentro do `PostCanvas`. Ao trocar o slide do carrossel, o componente recebe `text`/`title` novos e o `resetKey` força recálculo a partir do template, descartando as edições. Ao salvar um design, esse estado nunca é incluído em `state`, então no reload as posições voltam ao padrão.

**Estratégia**: subir o estado de `textBoxes` para o `PostEditorPage`, mantendo um array por slide para o carrossel. O `PostCanvas` passa a operar como controlado nesse aspecto.

Arquivo: `src/components/post-editor/PostCanvas.tsx`

- Adicionar dois novos props opcionais:
  - `textBoxes?: TextBox[]` (override controlado)
  - `onTextBoxesChange?: (boxes: TextBox[]) => void`
- Quando `textBoxes` for fornecido pelo pai, renderizar a partir dele e chamar `onTextBoxesChange` em vez de `setTextBoxes` local. Manter o estado local como fallback para quem não passar (compatibilidade).
- Quando `textBoxes` estiver vazio/indefinido pelo pai mas houver `initialTextBoxes` ou recompute, calcular como hoje e propagar via `onTextBoxesChange` para o pai persistir.
- Importante: continuar respeitando `resetKey` apenas quando o pai não estiver fornecendo `textBoxes` controlados, ou quando o pai explicitamente solicitar reset (ver abaixo).

Arquivo: `src/pages/PostEditorPage.tsx`

- Novo estado:
  - `slideTextBoxes: Record<number, TextBox[]>` (chave = índice do slide; índice `0` para post simples).
- Handler `handleTextBoxesChange(slideIndex, boxes)` que grava em `slideTextBoxes[slideIndex]`.
- Passar para o `PostCanvas` (post simples) e para cada slide do `CarouselEditor` o `textBoxes` correspondente e o handler.
- Incluir `slideTextBoxes` no objeto `state` salvo em `user_designs` e no `loadDraft`/`saveDraft` (sessionStorage), com migração suave: se o design carregado não tiver `slideTextBoxes`, deixar `undefined` para o canvas calcular do template (comportamento atual).
- Incluir `slideTextBoxes` no `historyState` do `useEditorHistory` e em `applyUndoSnapshot` para que undo/redo respeitem as posições.

Arquivo: `src/components/post-editor/CarouselEditor.tsx`

- Aceitar e repassar `textBoxes` e `onTextBoxesChange` por slide para o `PostCanvas`.

### Botão "Resetar posições"

No `PostToolbar` (ou no `SelectionPanel` quando um texto está selecionado) adicionar um botão pequeno "Resetar posição do texto" que limpa `slideTextBoxes[currentSlide]` para que o canvas recalcule a partir do template. Garante uma saída para o usuário caso a posição salva fique ruim depois de mudar formato/estilo.

## Detalhes técnicos

- `TextBox` já é um tipo interno do `PostCanvas`. Exportá-lo (`export type TextBox`) para reutilizar no `PostEditorPage`.
- O thumbnail salvo em `doSaveDesign` continua sendo capturado via `html2canvas` do DOM atual, então não precisa mudar — ele já reflete o estado real. O bug atual é só de reidratação.
- Validar com um carrossel de 3 slides: editar posição do título no slide 1, ir para o slide 2, voltar para o 1 → posição mantida. Salvar, recarregar do "Meus designs" → posição mantida. Mesmo teste para o tamanho (resize) e para o corpo.
- Validar que CTA com `\n` exporta corretamente no PNG (html2canvas respeita `white-space: pre-line`).
- Validar que designs antigos (sem `slideTextBoxes` no JSON) abrem normalmente, com o layout default.

## Arquivos editados

- `src/components/post-editor/PostCanvas.tsx`
- `src/components/post-editor/CarouselEditor.tsx`
- `src/components/post-editor/PostToolbar.tsx`
- `src/components/post-editor/inspector/SelectionPanel.tsx`
- `src/pages/PostEditorPage.tsx`

Sem mudanças de banco.