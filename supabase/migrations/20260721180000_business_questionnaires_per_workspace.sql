-- ============================================================================
-- Etapa 3 / Slice A — Diagnóstico por perfil.
-- business_questionnaires tinha UNIQUE(user_id, version): dois perfis da
-- mesma conta colidiriam na numeração de versão (como aconteceria em
-- archetype_answers). Troca para UNIQUE(workspace_id, version). Idempotente.
-- workspace_id já foi preenchido na Etapa 1 (backfill pelo workspace default).
-- A RLS continua auth.uid()=user_id (todo perfil é do mesmo dono) — nada muda.
-- ============================================================================

alter table public.business_questionnaires
  drop constraint if exists business_questionnaires_user_id_version_key;

alter table public.business_questionnaires
  add constraint business_questionnaires_workspace_version_key
    unique (workspace_id, version);
