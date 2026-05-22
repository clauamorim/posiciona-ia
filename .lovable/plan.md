# Ativar template "Governante · Sertão Profundo" no editor

## Objetivo

Trazer o material de `design-sources/governante/` (Babel-in-browser) para produção como componentes React/TS, ativando **apenas** a variação **Sertão Profundo** no editor, atrás de um `templateId` opcional. Sem mexer no gerador de IA nem nas outras variações/arquétipos.

## Passo 1 — Fontes no shell

Em `index.html`, dentro do `<head>` (antes do `<title>`):

- `<link rel="preconnect" href="https://fonts.googleapis.com">`
- `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`
- Três `<link rel="stylesheet">` com as URLs exatas do `manifest.json → design_system.fonts` (Cormorant Garamond ital+normal 400/500/600, Playfair Display ital+normal 400/500/600/700, Lato 400/700).

Sem `@font-face` em componentes.

## Passo 2 — Estrutura de templates

Criar `src/components/post-templates/governante/` com:

### `types.ts`
Tipos derivados do `manifest.json`:

```ts
export type Format = "4:5" | "9:16";
export type CardKind = "cover" | "clause" | "close";

export interface CoverSlots { eyebrow: string; kicker: string; countWord: string; titleLead: string; titleTail: string; footer: string; }
export interface ClauseSlots { num: string; roman?: string; topic: string; title: string; body: string; detail?: string; }
export interface CloseSlots  { eyebrow: string; title: string; body: string; cta: string; }

export type CardData =
  | ({ kind: "cover"  } & CoverSlots)
  | ({ kind: "clause" } & ClauseSlots)
  | ({ kind: "close"  } & CloseSlots);

export interface SertaoTokens {
  verdeBg?: string; areiaInk?: string; ouroAccent?: string;
  bodyFont?: "lato" | "cormorant" | "playfair";
  numberingStyle?: "plain" | "bracketed" | "roman";
  showOrnaments?: boolean;
  showSwipeHint?: boolean;
  eyebrowText?: string | null;
}
```

### `tokens.ts`
- Constantes da paleta (`VERDE`, `OURO`, `AREIA`, `GRAFITE`, `MOGNO`, `VERDE_INK`, `AREIA_TINT`, `OURO_INK`) extraídas do `manifest.json → design_system.palette`.
- Helpers portados de `cards-data.jsx`: `peTinyCaps`, `peBodyFontFor`, `peRenderNum`, todos tipados.
- `FORMATS: Record<Format, { w: number; h: number; label: string }>` a partir de `manifest.formats` (preview).
- **`SERTAO_CONTENT_DEFAULTS: CardData[]`** copiado integralmente do `manifest.json → content_defaults.cards` — usado como fallback pelo mapper.

### `shared.tsx`
Mini-componentes tipados (sem `window`): `PeEyebrow`, `PeRule`, `PeDiamond`. Mesma marcação inline-style de `cards-data.jsx`.

### `SertaoCard.tsx`
Refatoração 1:1 de `cards-sertao.jsx`. Substitui `window.*` por imports proper. Props:

```ts
interface SertaoCardProps {
  card: CardData;
  format: Format;
  tokens?: SertaoTokens;
}
```

Mantém os três branches (`cover` / `clause` / `close`), os paddings por formato, e os defaults vindos de `tokens.ts` quando o token não vem do prop.

### `mapPostToCards.ts` — regras finais (com os 3 ajustes)

Entrada: `{ card_copy: string[]; title?: string; cta?: string; meta?: { eyebrow?; kicker?; countWord?; topic?: string[]; titles?: string[]; } }`.
Saída: `CardData[]` com 7 posições.

Defaults: `import { SERTAO_CONTENT_DEFAULTS as D } from "./tokens";`

1. **Fallbacks consistentes (capa)** — quando o slot não vier em `meta`, usar o valor de `D[0]`:
   ```ts
   cards[0] = {
     kind: "cover",
     eyebrow:   meta?.eyebrow   ?? D[0].eyebrow,
     kicker:    meta?.kicker    ?? D[0].kicker,
     countWord: meta?.countWord ?? D[0].countWord,
     titleLead: title           ?? D[0].titleLead,
     titleTail: D[0].titleTail,
     footer:    D[0].footer,
   };
   ```

2. **Segmentação simplificada (cláusulas 1..5)** — sem `firstSentence/rest`:
   ```ts
   for (let i = 0; i < 5; i++) {
     const def = D[i + 1]; // clause default
     cards[i + 1] = {
       kind: "clause",
       num:   def.num,
       roman: def.roman,
       topic: meta?.topic?.[i]  ?? def.topic,
       title: meta?.titles?.[i] ?? def.title,
       body:  card_copy[i + 1]  ?? def.body,
     };
   }
   ```

3. **`lastLine` explícito (fechamento)**:
   ```ts
   cards[6] = {
     kind: "close",
     eyebrow: D[6].eyebrow,
     title:   card_copy[6] ?? D[6].title,
     body:    D[6].body,
     cta:     cta ?? D[6].cta,
   };
   ```

Esse mapper é o ponto único de tradução; quando a IA passar a devolver slots nativos basta trocar.

## Passo 3 — Integração mínima no canvas

### `src/components/post-editor/PostCanvas.tsx`
1. Adicionar props opcionais:
   - `templateId?: string | null`
   - `templateCard?: CardData | null` (o card já mapeado para o slide atual)
2. No topo do `return`: se `templateId === "governante.sertao-profundo"` e `templateCard`, **bypass** completo do canvas legado e renderizar `<SertaoCard card={templateCard} format={canvasHeight === 1920 ? "9:16" : "4:5"} />` dentro do mesmo wrapper com `transform: scale(scale)` já calculado. Canvas legado fica inalterado para qualquer outro valor.

### `src/components/post-editor/CarouselEditor.tsx`
- Adicionar prop `templateId?: string | null` e `templateCards?: CardData[] | null`.
- Repassar para `<PostCanvas>` como `templateId={templateId}` e `templateCard={templateCards?.[currentSlide] ?? null}`.

### `src/pages/PostEditorPage.tsx`
- Novo state local: `const [templateId, setTemplateId] = useState<string | null>(draft?.templateId ?? null)` (incluir em `historyState` para sobreviver ao undo e ao snapshot do editor — coerente com a memória "Post Editor é local state").
- `const templateCards = useMemo(() => templateId === "governante.sertao-profundo" ? mapPostToCards({ card_copy: editedTexts, title: editedTitle, cta: ctaText || day?.cta }) : null, [templateId, editedTexts, editedTitle, ctaText, day]);`
- Passar `templateId` + `templateCards`/`templateCard` para `<CarouselEditor>` e `<PostCanvas>`.

## Passo 4 — UI mínima do seletor

Adicionar um bloco compacto **"Template"** na coluna do canvas (logo acima do `<CarouselEditor>`/`<PostCanvas>` em `PostEditorPage.tsx`, dentro do mesmo container do canvas). Não mexer no `SelectionPanel.tsx` para não complicar.

- `<Select value={templateId ?? "none"} onValueChange={(v) => setTemplateId(v === "none" ? null : v)}>` com duas opções:
  - `"Padrão (sem template)"` → `none`
  - `"Governante · Sertão Profundo"` → `governante.sertao-profundo`
- Quando `templateId` está setado, mostrar uma nota discreta `"Cores e tipografia controladas pelo template"` ao invés de esconder os controles do inspector (mais simples; controles continuam visíveis mas viram no-op para o canvas até remover o template).

## Persistência

`templateId` é local-state. Vai dentro do `historyState`/snapshot do editor — segue o padrão já documentado em `mem://constraints/post-editor-persistence`. Persistência em banco fica para o PR de salvar designs.

## Fora de escopo

- Variações Cartório e Manuscrito
- Outros 11 arquétipos
- Mudanças no `process-content-generation-job` / prompts de IA
- Persistência do `templateId` no Supabase
- QA dedicado de export PNG do template

## Arquivos tocados

- `index.html` — fontes
- `src/components/post-templates/governante/types.ts` (novo)
- `src/components/post-templates/governante/tokens.ts` (novo, inclui `SERTAO_CONTENT_DEFAULTS`)
- `src/components/post-templates/governante/shared.tsx` (novo)
- `src/components/post-templates/governante/SertaoCard.tsx` (novo)
- `src/components/post-templates/governante/mapPostToCards.ts` (novo)
- `src/components/post-editor/PostCanvas.tsx` — bypass por `templateId`
- `src/components/post-editor/CarouselEditor.tsx` — repasse de `templateId` + `templateCards`
- `src/pages/PostEditorPage.tsx` — state, mapper, seletor

## Validação a confirmar ao final

1. Build limpo.
2. Posts antigos sem `templateId` → canvas idêntico ao atual.
3. Selecionar "Governante · Sertão Profundo" → canvas troca pelo `SertaoCard` com conteúdo de `SERTAO_CONTENT_DEFAULTS` (já que `card_copy` real ainda não traz slots nativos).
4. Selecionar "Padrão (sem template)" → canvas legado volta sem perder texto/imagens/posições.
