-- ============================================================================
-- História de Venda por perfil.
-- sales_narrative_questionnaires tinha UNIQUE(user_id): uma conta com 2+
-- perfis só podia ter UMA História de Venda no total, compartilhada entre
-- todos os perfis (mesmo achado documentado desde a Etapa 2). Troca para
-- UNIQUE(workspace_id). workspace_id já foi preenchido na Etapa 1 (backfill
-- pelo workspace default, migração 20260717130000). A RLS continua
-- auth.uid()=user_id (todo perfil é do mesmo dono) — nada muda. Idempotente.
-- ============================================================================

alter table public.sales_narrative_questionnaires
  drop constraint if exists sales_narrative_questionnaires_user_id_key;

alter table public.sales_narrative_questionnaires
  add constraint sales_narrative_questionnaires_workspace_key
    unique (workspace_id);
