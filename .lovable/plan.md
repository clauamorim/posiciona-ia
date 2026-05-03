## Objetivo
Adicionar gerenciamento de **templates globais** no painel admin. Templates globais são modelos criados pela equipe Posiciona, vinculados a um arquétipo, e visíveis para todos os usuários autenticados na aba "Meus modelos".

## 1. Migração de banco de dados

Adicionar dois campos em `user_designs`:
- `is_global boolean NOT NULL DEFAULT false`
- `archetype text NULL` (nome do arquétipo, ex: "Sábio", "Herói", ou null = neutro/todos)

Índice auxiliar:
- `(is_template, is_global)` para consulta de globais.

Atualizar **RLS** em `user_designs`:
- Manter políticas existentes (dono CRUD).
- Adicionar política `SELECT` para `authenticated`: qualquer usuário pode ler linhas onde `is_template = true AND is_global = true`.
- Restringir `INSERT/UPDATE/DELETE` de globais somente a admins (via `has_role(auth.uid(), 'admin')`), garantindo que usuários comuns não consigam criar/marcar registros globais.

## 2. Painel admin — nova rota `/admin/templates`

Criar `src/pages/admin/AdminTemplates.tsx` com:
- Listagem de templates globais (cards com thumbnail, título, badge do `archetype`, toggle ativo/inativo).
- Botão **"Criar template global"** que abre o editor (`/post-editor?adminTemplate=1&archetype=<nome>`) e ao salvar grava com `is_template=true` e `is_global=true`.
- Ações por card: editar, duplicar, ativar/desativar (toggle de `is_global`), excluir.
- Filtro por arquétipo usando os nomes de `ARCHETYPE_MAP`.

Adicionar entrada **"Templates globais"** no grupo Admin do `DashboardLayout`.

Pequena adaptação no `PostEditorPage` para, quando `adminTemplate=1` (e usuário admin), gravar `is_global=true` e `archetype` no insert do `user_designs`. Sem mudar o fluxo normal de salvar.

## 3. MyDesignsPage — incluir templates globais

Substituir a query única por duas chamadas paralelas:
- Templates próprios + designs do usuário (como hoje).
- Templates globais ativos: `is_template=true AND is_global=true`.

Mesclar os resultados; na aba **"Meus modelos"** mostrar os globais com badge **"Posiciona"** (ou similar) e desabilitar ações de excluir/editar para não-donos. Botão "Usar" continua abrindo no editor com `fromTemplate=1` (igual ao fluxo atual — gera um novo design baseado no template).

## 4. Detalhes técnicos

**Arquivos novos:**
- `supabase/migrations/<timestamp>_user_designs_global_templates.sql`
- `src/pages/admin/AdminTemplates.tsx`

**Arquivos alterados:**
- `src/App.tsx` (rota `/admin/templates`)
- `src/components/DashboardLayout.tsx` (item de nav admin)
- `src/pages/MyDesignsPage.tsx` (query, merge, badge, restrição de ações)
- `src/pages/PostEditorPage.tsx` (insert respeitar `is_global`/`archetype` quando admin)

**RLS resumida (políticas adicionadas):**
- `SELECT` global: `is_template AND is_global` para `authenticated`.
- `INSERT/UPDATE/DELETE` quando `is_global = true`: somente `has_role(auth.uid(),'admin')`.

**Tipos:** `src/integrations/supabase/types.ts` é regenerado após a migração — não é editado manualmente.
