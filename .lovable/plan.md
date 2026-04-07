

# Correções: PDF + Copy de Cards no Editorial

## Problemas identificados

1. **PDF não funciona**: O `import("jspdf")` dinâmico pode falhar silenciosamente porque o jsPDF v4 usa export nomeado, não default. A linha `const { default: jsPDF } = await import("jspdf")` pode retornar `undefined`.

2. **Copy de cards ausente**: O prompt da IA pede apenas `caption` (legenda) e `script` (roteiro de Reels), mas não pede a **copy individual de cada slide do carrossel** nem o **texto do card de posts únicos**. O frontend também não renderiza esse campo.

---

## Correções

### 1. PDF — corrigir import e adicionar try/catch

**Arquivo:** `src/pages/Report.tsx`

- Corrigir o import dinâmico do jsPDF para funcionar com v4: `const jsPDF = (await import("jspdf")).jsPDF`
- Envolver em try/catch com toast de erro para o usuário saber se falhar
- Incluir o novo campo `card_copy` no PDF quando presente

### 2. Prompt da IA — adicionar campo `card_copy`

**Arquivo:** `supabase/functions/generate-report/index.ts`

- Adicionar campo `card_copy` ao schema JSON do editorial:
  ```json
  {
    "day": 1,
    "theme": "...",
    "format": "carrossel",
    "caption": "legenda completa",
    "card_copy": ["Slide 1: texto...", "Slide 2: texto...", "Slide 3: texto..."],
    "cta": "...",
    "script": "..."
  }
  ```
- Instruir a IA: para carrosséis, `card_copy` é um array com o texto de cada slide; para posts únicos, `card_copy` é um array com 1 item (o texto do card); para Reels/Stories, pode ser vazio
- Manter `caption` como a legenda do Instagram e `card_copy` como o conteúdo visual dos slides

### 3. Frontend — renderizar `card_copy` nos cards editoriais

**Arquivo:** `src/pages/Report.tsx`

- Na seção editorial, após a legenda, se `day.card_copy` existir e tiver itens, renderizar uma lista numerada com o texto de cada slide/card
- Estilizar com badges "Slide 1", "Slide 2" etc. para carrosséis
- Para posts únicos, mostrar como "Copy do Post"

### 4. Edge function de semanas extras — mesmo campo

**Arquivo:** `supabase/functions/generate-content-week/index.ts`

- Adicionar `card_copy` ao schema pedido no prompt, mesma lógica

---

## Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Report.tsx` | Fix import jsPDF + renderizar `card_copy` + incluir no PDF |
| `supabase/functions/generate-report/index.ts` | Adicionar `card_copy` ao schema do prompt |
| `supabase/functions/generate-content-week/index.ts` | Adicionar `card_copy` ao schema do prompt |

---

## Detalhes técnicos

- O jsPDF v4 exporta a classe como `export { jsPDF }`, não como default. O import correto é `(await import("jspdf")).jsPDF`.
- O campo `card_copy` é opcional no JSON — Reels e Stories podem não ter. O frontend faz check `day.card_copy?.length > 0`.
- Relatórios já gerados sem `card_copy` continuam funcionando (graceful fallback).

