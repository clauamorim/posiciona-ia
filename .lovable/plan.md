## Objetivo

Permitir que o usuário selecione um trecho do texto dentro de uma caixa (título ou corpo) no editor de posts e aplique **negrito**, *itálico* e <u>sublinhado</u> apenas àquela seleção — preservando a formatação na edição, no salvamento e na exportação PNG.

Hoje, esses três botões só agem no bloco inteiro (`fontWeight`/`fontStyle` globais). Vamos transformá-los em formatação inline real (HTML).

## Como vai funcionar para o usuário

1. Dá duplo clique numa caixa de texto para entrar em modo de edição (já existe).
2. Seleciona uma palavra ou trecho com o mouse/dedo.
3. Aparece uma **mini-toolbar flutuante** logo acima da seleção com 3 botões: **B** / *I* / <u>U</u>.
4. Clica para aplicar/remover a formatação só naquele trecho. Atalhos de teclado padrão (Ctrl/Cmd+B, +I, +U) também funcionam.
5. Os botões globais existentes no painel lateral ("Negrito"/"Itálico" do corpo) continuam aplicando ao bloco inteiro como hoje (compatibilidade), mas ganham a opção visual de "Sublinhado" também.

## Mudanças técnicas

### 1. Modelo de dados — texto vira HTML
- Hoje `editedTexts: string[]` e `editedTitle: string` guardam texto puro.
- Vamos passar a guardar **HTML sanitizado** (apenas as tags `<strong>`, `<em>`, `<u>`, `<br>`). Texto sem formatação continua salvando como string limpa, então retrocompatível.
- Helper novo em `src/lib/richText.ts`:
  - `sanitizeRichText(html)` — whitelist estrita das 4 tags acima, remove o resto.
  - `richTextToPlain(html)` — converte para texto puro (para legenda/copiar/contagem de caracteres).
  - `isRichText(s)` — detecta se já contém uma das tags.

### 2. `PostCanvas.tsx` — caixas de texto editáveis
- O `<div contentEditable>` em `renderTextBox` passa a usar `dangerouslySetInnerHTML` em vez de `{content}`.
- No `onBlur`, em vez de `e.currentTarget.textContent`, capturar `e.currentTarget.innerHTML`, passar por `sanitizeRichText` e propagar via `onTextChange`/`onTitleChange`.
- Adicionar handler `onKeyDown` para interceptar Ctrl/Cmd+B/I/U e chamar `document.execCommand('bold'|'italic'|'underline')` (ainda é a forma mais simples e funciona em todos os navegadores para edição contentEditable).
- Adicionar componente novo **`InlineFormatToolbar`** (filho do canvas, posicionado em coordenadas absolutas relativas ao container) que:
  - Escuta `selectionchange` enquanto há `editingTextId`.
  - Mostra-se apenas quando a seleção não está colapsada e está dentro do contentEditable atualmente em edição.
  - Mostra três `Toggle` (B/I/U) já alinhados ao design system existente; estado `pressed` derivado de `document.queryCommandState`.
  - Ao clicar, chama `execCommand` e re-foca a seleção.

### 3. Exportação PNG
- Já usa `html-to-image` (`toBlob`) e fallback `html2canvas`. Ambos respeitam `<strong>`, `<em>`, `<u>` no DOM clonado, então não precisa mudança na pipeline de export.
- Confirmar visualmente que o texto sai com a formatação correta no PNG.

### 4. Outros lugares que consomem o texto
- **Copiar legenda / preview do feed**: aplicar `richTextToPlain()` antes de copiar para a área de transferência (a legenda do Instagram não suporta HTML).
- **Persistência de draft no `sessionStorage`**: já é string, salva HTML normalmente.
- **`textCleanup.ts`**: a função `cleanText` continua valendo para texto vindo da IA (que não tem nossas tags); ao receber HTML do usuário, pulamos o cleanup.

### 5. `SelectionPanel.tsx` — adicionar botão de Sublinhado global (opcional/cosmético)
- Adicionar toggle **U** ao lado dos toggles B/I do "Corpo do texto".
- Para manter o comportamento global, esses três toggles passam a aplicar a formatação no bloco inteiro via `wrapAll`/`unwrapAll` HTML — ou simplesmente envolver todo o conteúdo numa tag única quando ativado.

## Arquivos afetados

```text
src/lib/richText.ts                                   (novo)
src/components/post-editor/InlineFormatToolbar.tsx    (novo)
src/components/post-editor/PostCanvas.tsx             (editável + toolbar + execCommand)
src/components/post-editor/inspector/SelectionPanel.tsx (adicionar toggle Sublinhado)
src/pages/PostEditorPage.tsx                          (sanitização + plain-text para copiar legenda)
```

## Considerações

- `document.execCommand` está marcado como deprecated no MDN, mas continua sendo o caminho mais pragmático e amplamente suportado para edição contentEditable simples (Lexical/Slate seriam overkill aqui). Sem dependências novas.
- Sanitização estrita (whitelist de tags + sem atributos) evita injeção de HTML/CSS arbitrário.
- A formatação é puramente visual; não interfere em peso de fonte do arquétipo (`<strong>` herda `font-family`/`color` do contêiner — só muda peso).
- Mobile: a mini-toolbar aparece acima da seleção tátil, com tamanho de toque adequado (32px+).
