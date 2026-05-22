# Template Sertão: parar de misturar conteúdo + tornar tudo editável

## Diagnóstico do problema atual

`mapPostToCards` usa `SERTAO_CONTENT_DEFAULTS` (do `manifest.json`) como fallback para qualquer slot que o post não preenche. Esses defaults são **temáticos** ("DIREITO DO AGRO", "Sete cláusulas de arrendamento rural", "PRAZO", "REAJUSTE"…) e aparecem misturados com o body real do post, dando a sensação de "exemplo + post juntos".

Além disso, cor de fundo (verde), tinta (areia) e accent (ouro) estão hard-coded no `SertaoCard`. Ornamentos, fonte do corpo e estilo de numeração existem como `SertaoTokens` mas ninguém edita.

## Estratégia

1. **Separar defaults estruturais (neutros) dos defaults temáticos.** Mapper só preenche slots a partir do post; o que não vier vira string vazia (renderizada como placeholder discreto e editável). Numeração e paginação continuam derivadas do índice do slide, não do conteúdo.
2. **`templateTokens` no estado do editor**, mesmo padrão de `templateSlots`: overrides parciais de `SertaoTokens` (cores, ornamentos, fontes, numeração, swipe hint). `SertaoCard` já aceita `tokens` — só falta passar.
3. **Painel "Template" no inspector** quando `templateId` ativo, expondo cor/ornamentos/numeração/fontes. Edição de texto continua direto no card (contentEditable já implementado).

## Passo 1 — Reescrever `mapPostToCards`

`src/components/post-templates/governante/mapPostToCards.ts`:

- Remover qualquer fallback vindo de `SERTAO_CONTENT_DEFAULTS` para campos **temáticos** (eyebrow do cover, kicker, titleTail, topic, title de cláusula, eyebrow/body do close).
- Manter apenas defaults **estruturais não-temáticos**:
  - Cover `footer`: `"arraste para começar"` (instrução de UX, não tema).
  - Cover `countWord`: derivado do número real de cláusulas (5 → `"Cinco"`). Mapa `1..7 → Uma/Duas/Três/Quatro/Cinco/Seis/Sete`.
  - Clause `num`: `"01".."05"` por índice (fixo).
  - Clause `roman`: `I..V` por índice.
  - Close `eyebrow`: `"FECHAMENTO"` (rótulo estrutural).
- Slots temáticos vazios passam `""`. O card renderiza placeholder cinza translúcido quando vazio.
- Mapeamento de conteúdo do post:
  - Cover `titleLead` ← `input.title`.
  - Clause `body[i]` ← `copy[i+1]` (mantém).
  - Close `title` ← `copy[6]`.
  - Close `cta` ← `input.cta`.
- Documentar no topo do arquivo: "defaults temáticos foram removidos para evitar que demo content vaze nos posts reais. Quando a IA passar a devolver slots nativos (eyebrow, topic, kicker), basta consumir aqui."

`SERTAO_CONTENT_DEFAULTS` em `tokens.ts` fica como referência morta (não é mais importada pelo mapper). Marcar com comentário "@deprecated — usar apenas para preview do template em catálogo futuro".

## Passo 2 — Placeholder editável no SertaoCard

`src/components/post-templates/governante/SertaoCard.tsx`:

- `EditableSpan` ganha prop `placeholder?: string`. Quando `value === ""` e `onEdit` está presente, renderiza o placeholder com `opacity: 0.35`, `fontStyle: italic`, e ao receber foco o conteúdo fica vazio para começar a digitar (usar `onFocus` para limpar via `selectAll` se for placeholder). Sem `onEdit`, slot vazio simplesmente não renderiza.
- Passar placeholders curtos por slot (ex: `"Eyebrow"`, `"Kicker"`, `"Tópico"`, `"Título da cláusula"`, `"Fechamento"`, `"CTA"`). Em PT-BR.
- Numeração da cláusula (`numLabel`) e paginação `01/07..07/07` permanecem derivadas do índice do slide (`slideIndex`), **não** de `card.num`. Para isso, `SertaoCard` ganha prop opcional `slideIndex?: number` (default: parse de `card.num`). O carousel passa o índice real → mesmo que `card.num` seja editado, a paginação não quebra.
  - Decisão: número da cláusula em si vira editável (slot `num`), mas a paginação do rodapé usa `slideIndex + 1`.

## Passo 3 — Estado `templateTokens` no editor

`src/pages/PostEditorPage.tsx`:

- Novo state: `const [templateTokens, setTemplateTokens] = useState<Partial<SertaoTokens>>((draft as any)?.templateTokens ?? {})`.
- Callback `updateTemplateTokens(patch: Partial<SertaoTokens>) → setTemplateTokens(prev => ({ ...prev, ...patch }))`.
- `handleTemplateIdChange(null)` também limpa `templateTokens` (mesma lógica de `templateSlots`).
- Incluir `templateTokens` no `saveDraft` (passar como any, mesmo padrão).
- Passar `templateTokens` para `<CarouselEditor>` e `<PostCanvas>` via nova prop `templateTokens?: Partial<SertaoTokens> | null`.

`PostCanvas` repassa `tokens={templateTokens ?? undefined}` ao `<SertaoCard>`.
`CarouselEditor` apenas faz pass-through.

## Passo 4 — Painel "Template" no inspector

`src/pages/PostEditorPage.tsx`, no slot da coluna direita (onde vive o `<SelectionPanel>`):

Quando `templateId` está setado, renderizar **acima** do `<SelectionPanel>` um novo card "Template · Sertão Profundo" com os controles abaixo. O `<SelectionPanel>` continua visível mas vira no-op enquanto o template está ativo (já tem a nota "Cores e tipografia controladas pelo template").

Controles (componente novo `src/components/post-editor/inspector/TemplateSertaoPanel.tsx`):

- **Cor de fundo** (`verdeBg`) — `ColorPicker` reutilizado, default `VERDE`.
- **Cor da tinta** (`areiaInk`) — `ColorPicker`, default `AREIA`.
- **Cor do accent** (`ouroAccent`) — `ColorPicker`, default `OURO`, controla réguas, eyebrow, diamantes, número grande.
- **Fonte do corpo** — `Select` com 3 opções: Cormorant Garamond (default), Lato, Playfair Display.
- **Numeração** — `Select`: Padrão (`01`), Colchetes (`[ 01 ]`), Romano (`I`).
- **Ornamentos** — `Switch` (diamantes liga/desliga).
- **Indicação "arraste"** — `Switch` (footer da capa).
- Botão "Restaurar padrões do template" → `setTemplateTokens({})`.

Reaproveitar `ColorPicker` existente; paleta sugerida com swatches da própria paleta Sertão (`VERDE`, `OURO`, `AREIA`, `GRAFITE`, `MOGNO`, `VERDE_INK`, `AREIA_TINT`, `OURO_INK`) + free-color.

## Passo 5 — Wiring de props

- `PostCanvasProps`: adicionar `templateTokens?: Partial<SertaoTokens> | null`.
- `CarouselEditorProps`: mesmo.
- Bypass do `PostCanvas` passa `tokens={templateTokens ?? undefined}` + `slideIndex={…}` (já tem `slideNumber`; reaproveitar).
- `SertaoCard`: prop `slideIndex?: number` usada para paginação no rodapé.

## Persistência

- `templateSlots` e `templateTokens` continuam local-state, dentro do mesmo `saveDraft`. Sem migração de DB (alinhado a `mem://constraints/post-editor-persistence`).

## Fora de escopo

- Editar a cor de cada slot individualmente (cores são globais ao template).
- Variações Cartório/Manuscrito.
- Persistência no Supabase.
- Rich text (negrito/itálico dentro do card).
- Edição dos diamantes como elementos arrastáveis (apenas toggle on/off por enquanto).

## Arquivos tocados

- `src/components/post-templates/governante/mapPostToCards.ts` — remover fallbacks temáticos, derivar `countWord` do total de cláusulas.
- `src/components/post-templates/governante/SertaoCard.tsx` — `placeholder` no `EditableSpan`, prop `slideIndex` para paginação.
- `src/components/post-editor/inspector/TemplateSertaoPanel.tsx` (novo) — UI de tokens.
- `src/components/post-editor/PostCanvas.tsx` — prop `templateTokens` + `slideIndex` repassados.
- `src/components/post-editor/CarouselEditor.tsx` — prop `templateTokens` pass-through.
- `src/pages/PostEditorPage.tsx` — state `templateTokens`, callback, draft, render do painel.

## Validação

1. Build limpo.
2. Selecionar "Governante · Sertão Profundo" em post de Direito do Agro: nenhum texto de outro nicho aparece. Slots não preenchidos pelo post mostram placeholder italic discreto.
3. Paginação do rodapé permanece `01/07 … 07/07` mesmo após editar `num`.
4. Painel "Template" troca a cor de fundo: todos os 7 slides atualizam ao vivo.
5. Desligar ornamentos: diamantes somem dos 7 slides.
6. Trocar numeração para "Romano": número grande vira `I..V`, paginação rodapé continua `01..07`.
7. Voltar para "Padrão (sem template)": canvas legado volta, sem perder texto.
