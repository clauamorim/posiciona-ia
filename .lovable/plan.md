
## Análise

Olhando o print mobile: drawer "Editar: Título" mostra Fonte/Tamanho/Cor/Alinhamento + Fechar — SEM botão excluir. Print desktop: "Elemento Selecionado" mostra Corpo do texto (kind="body"), também sem excluir.

**Causa:** O botão "Excluir elemento" no `SelectionPanel.tsx` está dentro do bloco `(kind === "image" || kind === "icon" || kind === "textbox")`. Quando o usuário seleciona um TÍTULO ou CORPO DO TEXTO nativo do template (kind="title" ou "body"), eles NÃO são overlays — são parte fixa do template, então não há `selectedOverlay` pra excluir.

No print mobile, o usuário selecionou o **título do template** ("Dia 1: O Herói..."), que é `kind="title"` — não dá pra excluir porque é estrutural do template.

No print desktop, o que está selecionado é "Corpo do texto" do template (kind="body") — também estrutural.

**Mas:** caixas de texto adicionadas pelo usuário (kind="textbox", overlay) JÁ têm o botão. O usuário provavelmente não testou com uma caixa de texto adicionada, mas com o texto nativo do template.

## Verificações pendentes
- Confirmar que delete via teclado já funciona (procurar listener no `PostEditorPage` ou `PostCanvas`)
- Confirmar que o ícone de lixeira flutuante seria melhor que botão largo no mobile

## Plano

**1. Atalho Delete/Backspace no desktop** (`src/pages/PostEditorPage.tsx`)
- Adicionar `useEffect` global com listener `keydown`
- Se `e.key === "Delete" || e.key === "Backspace"` E há `selectedImageId` E foco NÃO está em input/textarea/contenteditable → chama `handleDeleteOverlay(selectedImageId)`
- Aplica a imagens, ícones E caixas de texto (overlays)

**2. Compactar botão excluir no mobile** (`src/components/post-editor/inspector/SelectionPanel.tsx`)
- Trocar o botão largo "Excluir elemento" por um ícone-only de lixeira alinhado à direita
- Posicioná-lo na mesma linha do `LayerControls` (Frente/Trás): vira `[Frente] [Trás] [🗑]` ocupando uma única linha
- Mantém destaque destrutivo (vermelho on hover), mas ocupa ~40px ao invés de linha cheia
- Tooltip "Excluir elemento" pra clareza

**3. Esclarecer no UX que título/corpo do template não são excluíveis**
- Esses elementos são estruturais (parte do layout do post) — excluí-los quebraria o template
- NÃO adicionar botão excluir pra `kind="title"` / `"body"` / `"cta"` / `"slideNumber"` (mantém comportamento atual correto)
- Apenas overlays adicionados pelo usuário (image/icon/textbox) podem ser excluídos — que é o comportamento correto

## Arquivos afetados
- `src/pages/PostEditorPage.tsx` — adicionar listener de teclado Delete/Backspace
- `src/components/post-editor/inspector/SelectionPanel.tsx` — compactar botão excluir em ícone na linha do LayerControls

**Observação importante pro usuário:** O botão excluir só aparece pra elementos que VOCÊ adicionou (imagens, ícones, caixas de texto novas). O título e o corpo do template não podem ser excluídos porque fazem parte da estrutura do post — se você quer um post sem título, ajusta o conteúdo, não exclui o slot.
