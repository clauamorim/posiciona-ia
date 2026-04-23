

## Limpeza de rótulos do framework nos posts

Os textos "Problema Externo:" no tema e "Slide 1: '...'" no conteúdo vêm direto do que a IA gera. Vou atacar em duas camadas: prompts mais rígidos (corrige o futuro) e sanitização no cliente (corrige o passado e protege contra reincidência).

## 1. Prompts mais rígidos nas edge functions

### `supabase/functions/generate-report/index.ts`
Hoje esse prompt **não tem** a regra anti-rótulo (só `generate-content-week` e `regenerate-single-post` têm). Vou adicionar o mesmo bloco "REGRA DE LINGUAGEM CRÍTICA" + lista de termos proibidos + exemplos ERRADO/CERTO antes da seção `editorial`.

### Os 3 prompts (`generate-report`, `generate-content-week`, `regenerate-single-post`)
Adicionar regra explícita sobre `card_copy`:
> NUNCA prefixe os itens de `card_copy` com "Slide 1:", "Slide 2:", "Card 1:", "Página 1:", etc. Cada item do array JÁ É um slide; escreva apenas o conteúdo em si, sem rótulo posicional.
> ERRADO: `["Slide 1: Você também sente que o tempo voa?", "Slide 2: A solução está aqui"]`
> CERTO:  `["Você também sente que o tempo voa?", "A solução está aqui"]`

## 2. Sanitização defensiva no cliente

### `src/lib/textCleanup.ts`
Adicionar nova função `stripFrameworkLabels(text)` que remove no início da string (case-insensitive):
- `Slide \d+\s*[:\-–]\s*`
- `Card \d+\s*[:\-–]\s*`
- `Página \d+\s*[:\-–]\s*`
- `Problema Externo\s*[:\-–]\s*`
- `Problema Interno\s*[:\-–]\s*`
- `Problema Filosófico\s*[:\-–]\s*`
- `O Plano\s*[:\-–]\s*` / `Plano\s*[:\-–]\s*`
- `CTA\s*[:\-–]\s*` / `Chamada à Ação\s*[:\-–]\s*` / `Chamada para Ação\s*[:\-–]\s*`
- `O Sucesso\s*[:\-–]\s*` / `Sucesso\s*[:\-–]\s*`
- `O Fracasso\s*[:\-–]\s*` / `Fracasso\s*[:\-–]\s*`
- `O Herói\s*[:\-–]\s*` / `Herói\s*[:\-–]\s*`
- `O Guia\s*[:\-–]\s*` / `Guia\s*[:\-–]\s*`

Também remover aspas envolventes residuais (a IA às vezes gera `"Você também sente..."` com aspas literais incluídas).

Atualizar `cleanText()` para encadear `stripFrameworkLabels` no pipeline.

### Pontos onde aplicar a limpeza (já usam `cleanMarkdown` / `extractAfterBold`)

- **`src/pages/PostEditorPage.tsx`** (linhas 266-269 e 648-650): aplicar `stripFrameworkLabels` em cada item de `card_copy`, no `theme` e no `cta` ao inicializar e ao resetar; também no título exibido (linha 729) e na legenda copiada (linha 691).
- **`src/pages/EditorialPage.tsx`**: aplicar nos previews de `day.theme`, `day.caption`, `day.card_copy[]`, `day.cta` (renderização nos cards e no PDF de exportação).
- **`src/pages/Report.tsx`**: aplicar na exibição da semana 1 do editorial.

## Resultado esperado

- "Problema Externo: A Correria Vazia" → "A Correria Vazia"
- "Slide 1: 'Você também sente...'" → "Você também sente..."
- Conteúdos novos já saem limpos via prompt; conteúdos antigos já gravados no banco aparecem limpos via sanitização ao renderizar.

## Fora do escopo

- Reescrever em massa os `card_copy` antigos no banco (não é necessário — a sanitização no cliente cobre exibição e edição).
- Mexer em outros campos do relatório (StoryBrand, arquétipos) que usam esses rótulos legitimamente.

