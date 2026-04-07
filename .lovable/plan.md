

# Correção da Análise do Instagram

## Problema

A edge function `analyze-instagram` usa `supabase.auth.getClaims()` que não existe no Supabase JS client. O erro nos logs é claro: `TypeError: supabase.auth.getClaims is not a function`.

## Correção

### `supabase/functions/analyze-instagram/index.ts`
- Substituir `supabase.auth.getClaims()` por `supabase.auth.getUser()` para obter o `user_id`
- Remover o parâmetro `manualData` e toda a lógica de fallback manual — se o Firecrawl falhar, retornar erro direto

### `src/pages/InstagramAnalysis.tsx`
- Remover todo o formulário manual (estados `manualData`, `showManualFallback`, função `handleManualAnalyze`, e o card de "Dados do Perfil (Manual)")
- Manter apenas o input de @ e o botão "Analisar Perfil"
- Se a análise falhar, mostrar apenas o toast de erro

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/analyze-instagram/index.ts` | Trocar `getClaims` por `getUser`, remover lógica manual |
| `src/pages/InstagramAnalysis.tsx` | Remover formulário e fallback manual |

