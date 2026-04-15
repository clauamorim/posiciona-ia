

# Painel Admin: Menu exclusivo e dados de jornada por usuário

## Problema atual
- O admin vê o menu completo de usuário comum (Dashboard, Questionários, Estratégia, etc.) na sidebar, mesmo sem necessidade de usá-los.
- A lista de usuários não mostra o último login nem quais fases da jornada cada um completou.

## Alterações

### 1. Sidebar exclusiva para admin (`DashboardLayout.tsx`)
Quando `isAdmin === true`, exibir **apenas** o grupo "Admin" na sidebar (Painel Admin, Usuários, Documentos LLM, Galeria), removendo todos os grupos de usuário comum (Início, Diagnóstico, Estratégia, Produção, Conta).

### 2. Edge Function: retornar `last_sign_in_at` (`admin-manage-user/index.ts`)
Na action `list_users`, além do `emailMap`, retornar um `lastSignInMap` com `{ [userId]: last_sign_in_at }` extraído dos dados já disponíveis no `listUsers()` do Supabase Admin API.

### 3. Fases da jornada por usuário (`AdminUsers.tsx`)
Carregar dados adicionais para determinar quais fases cada usuário completou:

| Fase | Critério |
|------|----------|
| Questionário do Negócio | `business_questionnaires` com `is_complete = true` |
| Questionário de Arquétipos | `archetype_scores` existe para o usuário |
| Relatório Estratégico | `reports` com `status = 'completed'` |
| Narrativa da Marca | `reports.content` contém seção StoryBrand (já carregado) |
| Análise do Instagram | `instagram_analyses` existe |
| Linha Editorial | `reports.editorial_weeks` com array não-vazio |
| Retratos de Marca | `portrait_generations` existe |

Exibir na tabela:
- Nova coluna **"Último Login"** com a data formatada em pt-BR
- Nova coluna **"Jornada"** com badges compactas indicando as fases concluídas (ex: "QN", "QA", "RE", "NM", "IG", "LE", "RT")

Também incluir esses dados no dialog de detalhes do usuário e no CSV exportado.

### Arquivos alterados
- `src/components/DashboardLayout.tsx` — condicional de menu admin-only
- `supabase/functions/admin-manage-user/index.ts` — incluir `lastSignInMap`
- `src/pages/admin/AdminUsers.tsx` — novas colunas, queries adicionais, badges de jornada

