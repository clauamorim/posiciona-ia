# Plano — `copy[0]` na cover do template Sertão

## Causa-raiz

`mapPostToCards` tem dois caminhos:

- **Post único** (`format !== "carrossel"`): retorna 1 card `close` com `title = editedTitle` e `body = copy[0] || caption`. Funciona — o `SertaoCard` close renderiza título + corpo + CTA.
- **Carrossel** (`format === "carrossel"`): retorna 7 cards. A `cover` (slide 0) tem só `titleLead / kicker / countWord / titleTail / footer`. **Não existe slot que receba `copy[0]`**, então o corpo do primeiro card (que no `PostCanvas` legacy aparece junto do título) é descartado.

O print IMG_4864 confirma: título alinhado ao topo (assinatura da cover), corpo ausente. O post é carrossel, mesmo aparentando ser único.

## Mudanças

### 1. `src/components/post-templates/governante/types.ts`

Adicionar campo opcional `body` em `CoverSlots`:

```ts
export interface CoverSlots {
  eyebrow: string;
  kicker: string;
  countWord: string;
  titleLead: string;
  titleTail: string;
  body?: string;     // ← novo (opcional p/ não quebrar tipos existentes)
  footer: string;
}
```

### 2. `src/components/post-templates/governante/mapPostToCards.ts`

No branch carrossel, popular `cover.body = copy[0] ?? ""`. Cláusulas continuam em `copy[i+1]` (1..5) e close em `copy[6]`. Nada mais muda.

```ts
const cover: CardData = {
  kind: "cover",
  // ... campos atuais
  body: copy[0] ?? "",   // ← novo
  footer: meta?.footer ?? "",
};
```

### 3. `src/components/post-templates/governante/SertaoCard.tsx`

Na branch `kind === "cover"`, adicionar um `EditableSpan` para `body` **logo abaixo do bloco de título** (entre o título e o `flex: 1` que empurra o rodapé para o fundo). Tipografia que não compita com a `titleLead`: mesma família do `bodyFam` (Lato/Cormorant/Playfair conforme `tokens.bodyFont`), peso 400, tamanho menor (`big ? 24 : 18`), `opacity: 0.78`, `marginTop: big ? 28 : 18`. Quando `body` vier vazio, `EditableSpan` já retorna `null` (regra atual de slot vazio) — a cover continua idêntica à original.

```tsx
<EditableSpan
  field="body"
  value={(card as any).body || ""}
  as="div"
  style={{
    fontFamily: bodyFam,
    fontStyle: bodyFam.includes("Cormorant") ? "italic" : "normal",
    fontSize: big ? 24 : 18,
    lineHeight: 1.4,
    color: areia,
    opacity: 0.78,
    marginTop: big ? 28 : 18,
    textWrap: "pretty" as any,
  }}
  onEdit={onEditSlot}
  placeholder="Corpo de abertura"
/>
```

`SlotField` já é união de `keyof CoverSlots | keyof ClauseSlots | keyof CloseSlots`. Como `body` passa a existir em `CoverSlots` e já existe em `ClauseSlots/CloseSlots`, o tipo continua válido sem alteração.

## Fora de escopo

- Não muda branch single-close (já correto).
- Não muda a estrutura de `copy[1..6]` para cláusulas/close.
- Não muda `TemplateSertaoPanel` nem `PostEditorPage` (overrides em `templateSlots[0].body` continuam funcionando: o `EditableSpan` já é editável).
- Cartório/Manuscrito ainda não existem como componentes, então não há impacto.

## Validação

1. Build limpo (sem erros TS).
2. Carrossel + template Sertão na cover → corpo do `copy[0]` aparece abaixo do título.
3. Carrossel cuja IA não devolveu `copy[0]` (vazio) → cover idêntica à original (slot vazio renderiza `null`).
4. Post único + template Sertão → continua mostrando close com title+body+cta (sem regressão).
5. Posts sem `templateId` → canvas legado intacto.
6. Editar o novo slot de body na cover persiste em `templateSlots[0].body` no draft, igual aos outros slots.
