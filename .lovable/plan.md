
## Causa raiz

Quando migramos a Linha Editorial para o shape **v6** (Feed + Stories), cada semana virou um objeto `{ days: [{ feed, story, day }, ...] }`. A `EditorialPage` foi atualizada e chama o editor passando `week`/`day` baseados em `week.days[di]`. Mas a `PostEditorPage` ainda está no shape **v5** (semana = array plano de posts):

```ts
// src/pages/PostEditorPage.tsx:282 — quebrado
const day = allWeeks[weekIndex]?.[dayIndex];
```

Como `allWeeks[weekIndex]` agora é um objeto (não array), `[dayIndex]` devolve `undefined` → `if (!day)` → mostra "Conteúdo não encontrado". Além disso, todos os usos posteriores (`day.theme`, `day.caption`, `day.card_copy`, `day.cta`, `day.format`) precisam apontar para `day.feed.*`.

## Correção

### 1. `src/pages/PostEditorPage.tsx` — normalizar para v6 e ler o feed

**a) Importar o normalizador** (já existe em `src/lib/editorialShape.ts`):
```ts
import { normalizeWeekToV6 } from "@/lib/editorialShape";
```

**b) Trocar a derivação de `day`** (linhas ~277-282):
```ts
const allWeeksRaw = [
  ...(hasEditorial && structuredEditorial.length > 0 ? [structuredEditorial] : []),
  ...editorialWeeks,
];
const allWeeks = allWeeksRaw.map((w) => normalizeWeekToV6(w));

const dayV6 = allWeeks[weekIndex]?.days?.[dayIndex];
// Compat: o restante do editor ainda lê day.theme / day.caption / day.card_copy / day.cta / day.format
const day = dayV6
  ? {
      day: dayV6.day,
      ...(dayV6.feed ?? {}),
      // fallbacks caso o dia tenha apenas story (sem feed)
      theme: dayV6.feed?.theme || dayV6.story?.theme || "",
      caption: dayV6.feed?.caption || "",
      card_copy: dayV6.feed?.card_copy || [],
      cta: dayV6.feed?.cta || "",
      format: dayV6.feed?.format || "post",
      script: dayV6.feed?.script || "",
    }
  : null;
```

Isso mantém **toda a lógica subsequente** do editor funcionando sem alterações (nas linhas 405-1386 que leem `day.theme`, `day.caption`, etc.), porque expomos um objeto v5-like a partir do `feed` v6.

### 2. Verificar paridade com a navegação

Na `EditorialPage` (linhas 862-870), os botões "Criar" e "Capa" chamam `handleOpenEditor(wi, di, feed, ...)` apenas quando `feed.format` é `carrossel`/`post`/`reels`. Isso garante que o editor sempre receberá um dia que tem `feed`. O fallback acima cobre o caso defensivo de um dia "só story" (não acontece no fluxo atual, mas evita regressão).

### 3. Suite de teste manual rápido (após implementar)

- Gerar/abrir uma semana já existente.
- Clicar em "Criar" num carrossel → editor abre com tema, legenda e slides preenchidos.
- Clicar em "Criar" num post único → idem.
- Clicar em "Capa" num reels → editor abre em formato 1080×1920 com tema correto.

## Arquivos modificados
- `src/pages/PostEditorPage.tsx` (apenas a derivação de `day` perto da linha 277-282)

## Fora de escopo
- A persistência do editor, autoLayout, salvar como design/modelo — tudo continua funcionando porque o objeto `day` exposto preserva o contrato antigo (v5-like).
- Nenhuma mudança em edge functions, banco de dados ou shape v6 — só a leitura no editor.
