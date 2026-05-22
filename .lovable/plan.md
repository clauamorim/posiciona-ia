# Tornar o template Sertão Profundo editável

## Problema

`SertaoCard` renderiza apenas `<div>`/`<span>` estáticos vindos de `CardData`. Como o canvas legado é bypassado, nenhum slot (eyebrow, kicker, countWord, titleLead, num, topic, title, body, cta…) é editável. O usuário precisa poder clicar em qualquer texto e alterar.

## Estratégia

Manter `mapPostToCards` como fonte base (defaults + `card_copy`/`title`/`cta`) e introduzir **overrides por slide e por slot** no estado do editor. Texto continua plano (sem rich text por enquanto, igual ao resto do canvas legado).

## Passo 1 — Estado de overrides

`src/pages/PostEditorPage.tsx`:

- Novo state: `const [templateSlots, setTemplateSlots] = useState<Record<number, Record<string, string>>>(draft?.templateSlots ?? {})`.
- Incluir `templateSlots` no `EditorDraft` (serialização) e no snapshot do `useEditorHistory` (undo/redo).
- Limpar `templateSlots` quando `setTemplateId(null)` (mais simples; voltar ao template depois reinicia overrides).
- No `useMemo` de `templateCards`, depois de `mapPostToCards(...)`, aplicar merge: para cada `i`, `cards[i] = { ...cards[i], ...(templateSlots[i] ?? {}) }`.
- Callback `updateTemplateSlot(slideIdx, field, value)` que faz `setTemplateSlots(prev => ({ ...prev, [slideIdx]: { ...(prev[slideIdx] ?? {}), [field]: value } }))`.

## Passo 2 — Slot editável no SertaoCard

`src/components/post-templates/governante/SertaoCard.tsx`:

- Nova prop opcional `onEditSlot?: (field: keyof CoverSlots | keyof ClauseSlots | keyof CloseSlots, value: string) => void`.
- Criar componente interno `EditableSpan({ field, value, style })`:
  - Se `onEditSlot` está definido, renderiza `<span contentEditable suppressContentEditableWarning style={style} onBlur={e => onEditSlot(field, e.currentTarget.innerText)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.target as HTMLElement).blur(); } }}>{value}</span>` com `outline: none`, cursor `text`, e leve `:focus` ring via `onFocus` (border tracejado em ouro).
  - Caso contrário, renderiza `<span style={style}>{value}</span>` (preserva render para export PNG futuro, se um dia precisar desabilitar).
- Trocar todos os textos vindos de `card` por `EditableSpan` com o `field` correto (cover: eyebrow, kicker, countWord, titleLead, titleTail, footer; clause: topic, title, body, e opcionalmente num; close: eyebrow, title, body, cta).
- O `numLabel` da cláusula continua derivado de `card.num` via `peRenderNum`; não tornar o número editável no v1 (mexer no `num` quebra paginação "02/07"). Documentar como fora de escopo.

## Passo 3 — Wiring no canvas

`src/components/post-editor/PostCanvas.tsx`:

- Adicionar prop opcional `onEditTemplateSlot?: (field: string, value: string) => void`.
- No bloco que renderiza `<SertaoCard …/>`, repassar `onEditSlot={onEditTemplateSlot}`.
- Wrapper do bypass: garantir que o container externo deixa o conteúdo receber `pointer-events: auto` (já está). Não alterar o `transform: scale(scale)` — `contentEditable` funciona normalmente dentro de elementos escalados; só a área de clique fica menor proporcionalmente, comportamento aceitável.

`src/components/post-editor/CarouselEditor.tsx`:

- Nova prop `onEditTemplateSlot?: (slideIdx: number, field: string, value: string) => void`.
- No mapeamento dos slides, repassar `onEditTemplateSlot={(field, value) => onEditTemplateSlot?.(slideIdx, field, value)}`.

`src/pages/PostEditorPage.tsx`:

- Passar `onEditTemplateSlot={updateTemplateSlot}` para `<CarouselEditor>` e, no fallback single-slide com `templateCards?.[0]`, passar `onEditTemplateSlot={(field, value) => updateTemplateSlot(0, field, value)}` para `<PostCanvas>`.

## Passo 4 — UX mínima de edição

No `EditableSpan`:

- `cursor: text`.
- `transition: box-shadow 120ms`.
- Ao foco: `outline: 1px dashed <ouro com 60%>` ou `boxShadow: 0 0 0 1px <ouro 40%>` — sutil, não polui export visual em runtime de edição.
- `onPaste`: `e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain"))` para evitar colar HTML formatado.

Nada de toolbar de formatação por agora — alinhado ao escopo (apenas tornar editável).

## Persistência

`templateSlots` segue o padrão do editor: localStorage draft + history snapshot. **Não** salva no Supabase ainda (coerente com `mem://constraints/post-editor-persistence`). Documentar.

## Fora de escopo

- Edição do número da cláusula (`num`/paginação).
- Rich text (negrito/itálico) dentro do template.
- Edição de cor/fonte por slot (tudo continua controlado pelo template).
- Persistência de `templateSlots` no banco.
- Variações Cartório/Manuscrito e demais arquétipos.

## Arquivos tocados

- `src/components/post-templates/governante/SertaoCard.tsx` — `EditableSpan` + prop `onEditSlot` em todos os textos.
- `src/components/post-editor/PostCanvas.tsx` — prop `onEditTemplateSlot` repassada ao SertaoCard.
- `src/components/post-editor/CarouselEditor.tsx` — prop `onEditTemplateSlot(slideIdx, …)`.
- `src/pages/PostEditorPage.tsx` — state `templateSlots`, merge no `templateCards`, callback `updateTemplateSlot`, snapshot/draft.

## Validação

1. Build limpo.
2. Selecionar "Governante · Sertão Profundo": clicar em qualquer texto entra em modo edição com outline ouro discreto; blur ou Enter confirma.
3. Trocar de slide e voltar: edição preservada.
4. Undo/redo desfaz edições de slot.
5. Voltar para "Padrão (sem template)" e re-selecionar o template: overrides limpos (reinicia com defaults), sem perder texto/imagens do canvas legado.
