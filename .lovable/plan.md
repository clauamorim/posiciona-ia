# Hierarquia tipográfica por arquétipo no editor de posts

Hoje o título do post usa `fontWeight: "bold"` fixo (PostCanvas.tsx linha 670) e o corpo herda o que vier de `fontWeight` (linhas 502, 670–671), o que neutraliza fontes elegantes (ex.: Cormorant Garamond) e elimina contraste título/corpo.

## 1. Novo módulo `src/lib/archetypeTypography.ts`

Define o mapa de tipografia por arquétipo (nomes idênticos aos de `src/lib/archetypes.ts`):

```ts
export interface ArchetypeTypography {
  titleWeight: number;       // 100–900
  titleSizeMin: number;      // px
  titleSizeMax: number;      // px (usado como teto inicial)
  titleLineHeight: number;
  titleLetterSpacing: string;
  bodyWeight: 300 | 400;
}

const ELEGANCE = { titleWeight: 300, titleSizeMin: 48, titleSizeMax: 52,
                   titleLineHeight: 1.1, titleLetterSpacing: "0.02em",
                   bodyWeight: 300 as const };

const ENERGY   = { titleWeight: 600, titleSizeMin: 44, titleSizeMax: 48,
                   titleLineHeight: 1.05, titleLetterSpacing: "-0.01em",
                   bodyWeight: 400 as const };

const DEFAULT  = { titleWeight: 400, titleSizeMin: 44, titleSizeMax: 44,
                   titleLineHeight: 1.1, titleLetterSpacing: "0",
                   bodyWeight: 400 as const };

export const ARCHETYPE_TYPOGRAPHY: Record<string, ArchetypeTypography> = {
  "Sábio": ELEGANCE, "Governante": ELEGANCE, "Mago": ELEGANCE,
  "Herói": ENERGY, "Explorador": ENERGY, "Rebelde": ENERGY,
  // demais arquétipos caem no DEFAULT via getter
};

export function getArchetypeTypography(name?: string | null): ArchetypeTypography {
  if (!name) return DEFAULT;
  return ARCHETYPE_TYPOGRAPHY[name] ?? DEFAULT;
}
```

Regra do enunciado: nunca abaixo de 42px (todos os mínimos respeitam).

## 2. Propagar arquétipo até o PostCanvas

- `PostEditorPage.tsx` já carrega `report` e tem `user`. Adicionar uma busca leve em `user_top_archetypes` para `rank = 1` (já é feita em outras telas — Report/Results) e guardar `primaryArchetype: string | null`. Alternativa zero-fetch: ler de `content.archetypes?.["1"]?.name` quando existir, evitando query extra. Usar essa via primeiro e cair no fetch só se vier vazio.
- Passar nova prop opcional `primaryArchetype?: string | null` para os dois usos de `<PostCanvas>` (linhas 1242 e 1276) e também em `CarouselEditor.tsx` (linha 88), encadeando do parent.

## 3. Aplicar no `PostCanvas.tsx`

- Adicionar `primaryArchetype?: string | null` na interface (perto de `displayFont`/`bodyFont`).
- No topo do componente: `const typo = getArchetypeTypography(primaryArchetype);`
- Substituir o cálculo do título (linha 508):
  - `resolvedTitleFontSize = titleFontSize ?? Math.max(typo.titleSizeMin, isCoverSlide ? typo.titleSizeMax + 12 : typo.titleSizeMax);`
  - Garantir piso `Math.max(42, ...)`.
- No bloco de estilo (linhas 668–671):
  - `fontWeight: isTitle ? typo.titleWeight : Math.min(typo.bodyWeight, Number(bodyFontWeight) || typo.bodyWeight)` — efetivamente força body a 300/400 mesmo se vier "bold".
  - Adicionar `lineHeight: isTitle ? typo.titleLineHeight : 1.35`
  - Adicionar `letterSpacing: isTitle ? typo.titleLetterSpacing : "0"`.
- Body (`bodyFontWeight`, linha 502): clampar para `typo.bodyWeight` quando o valor recebido for "bold"/>=600. Mantém compat com props existentes mas elimina título/corpo ambos bold.

## 4. CTA e badges

CTA (linha 944) e numeração de slides (linha 899) usam `font-bold` / `fontWeight: "bold"` literal. Esses são elementos utilitários (botão e badge), não título — mantemos como estão para preservar legibilidade em corpos pequenos. Sem alteração.

## Não-mudanças

- Sem alterar fetch de imagens, persistência, lógica de slides, ou gerador.
- Sem mexer em `displayFont`/`bodyFont` escolhidos pelo arquétipo (já vêm do relatório).
- Sem nova migração — `user_top_archetypes` já existe.

## Detalhes técnicos

- Fallback de arquétipo: `content.archetypes["1"].name` → `user_top_archetypes` rank 1 → `null` (cai no DEFAULT, comportamento atual).
- O peso do body só é "rebaixado", nunca elevado, então usuários que reduzem o peso manualmente continuam controlando.
- `titleFontSize` controlado pelo usuário continua tendo precedência sobre o valor do arquétipo (só usamos o do arquétipo como default).
