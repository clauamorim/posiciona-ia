# Passo 5 — UI de falha de deduplicação

Backend já marca `_dedup_failed=true` por dia em `week.days[i].feed` e expõe `_dedup_warning` + `_dedup_metrics.dedup_failed_days` no nível da semana. Falta só a UI.

## Mudanças (apenas `src/pages/EditorialPage.tsx`)

### 1. Banner âmbar no topo do bloco da semana
Após o bloco existente `(week._partial || week._stage_b_failed)` (linha ~1091), adicionar:

```tsx
{week._dedup_warning === true && (
  <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
    <strong className="block font-semibold mb-1">Repetição detectada nesta semana</strong>
    <span className="text-sm opacity-90">
      Alguns posts permaneceram com alta similaridade frente às últimas semanas mesmo após reescrita. Revise os dias destacados em âmbar antes de publicar — você pode regenerá-los individualmente usando crédito de regeneração.
    </span>
    {Array.isArray(week._dedup_metrics?.dedup_failed_days) && week._dedup_metrics.dedup_failed_days.length > 0 && (
      <span className="block text-xs mt-2 opacity-80">
        Dias afetados: {week._dedup_metrics.dedup_failed_days.join(", ")}
      </span>
    )}
  </div>
)}
```

Condição de exibição: `week._dedup_warning === true`. O array `dedup_failed_days` é apenas informativo.

### 2. Chip âmbar no card de cada dia falho
Dentro de `week.days.map(...)` (linha ~1122), no `<Card>` de cada dia, quando `feed?._dedup_failed === true`, renderizar um pequeno indicador âmbar ao lado do título/dia do card (próximo ao badge de formato existente):

```tsx
{feed?._dedup_failed === true && (
  <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
    Repetição
  </span>
)}
```

Posição: junto ao header do card (mesma linha do badge de formato). Sem emojis, conforme guideline.

### 3. Tipagem
`DayV6.feed` em `src/lib/editorialShape.ts` mantém `FeedPostV6` — o campo `_dedup_failed` é opcional e acessado com optional chaining + cast em uma única linha. Nenhuma mudança em tipos é necessária (o JSONB carrega o campo intacto).

## Não muda
- Lógica de geração (Passos 1-4 já implementados)
- Estilos globais / index.css
- Nenhum estado novo, nenhum hook novo

## Validação após implementação
1. Você roda `dedup-backfill-thesis` (com `user_id` ou geral)
2. Confirma W12-W20 com `thesis_summaries` + `extracted_brands_by_day`
3. Gera W23 e W24
4. Me devolve os 4 títulos de feed de cada uma + presença/ausência do banner âmbar
