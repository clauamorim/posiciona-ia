-- ============================================================================
-- Etapa 3 (multi-perfil) — corrige unicidade de archetype_answers
-- UNIQUE(user_id, version, question_id) colidiria se a mesma conta tiver
-- dois perfis do MESMO tipo (ex.: social media com 2 clientes institucionais
-- na mesma conta) — respostas de um perfil sobrescreveriam as do outro.
-- Troca para UNIQUE(workspace_id, version, question_id). Idempotente.
-- Backfill: linhas antigas (workspace_id já preenchido desde a Etapa 1 pelo
-- workspace default do dono) mantêm o valor existente.
-- ============================================================================

alter table public.archetype_answers
  drop constraint if exists archetype_answers_user_id_version_question_id_key;

alter table public.archetype_answers
  add constraint archetype_answers_workspace_version_question_key
    unique (workspace_id, version, question_id);
