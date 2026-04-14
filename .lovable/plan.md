

# Plano: Aumentar limites de PDFs de referência

Alterar os limites em ambas as Edge Functions (`generate-report` e `analyze-instagram`):

- `.limit(3)` → `.limit(5)`
- `MAX_TOTAL = 4 * 1024 * 1024` → `MAX_TOTAL = 8 * 1024 * 1024`

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/generate-report/index.ts` | limit 5, MAX 8MB |
| `supabase/functions/analyze-instagram/index.ts` | limit 5, MAX 8MB |

