-- ============================================================================
-- Etapa 3 / Slice B — Relatório e arquétipos calculados por perfil.
-- Mesma colisão latente já corrigida em archetype_answers e
-- business_questionnaires: reports, archetype_scores e user_top_archetypes
-- têm UNIQUE(user_id, version, ...) — dois perfis da mesma conta colidiriam
-- na numeração de versão. Troca para UNIQUE(workspace_id, version, ...).
-- Idempotente. workspace_id já foi preenchido na Etapa 1 (backfill pelo
-- workspace default). RLS continua auth.uid()=user_id — nada muda aí.
-- ============================================================================

alter table public.reports
  drop constraint if exists reports_user_id_version_key;
alter table public.reports
  add constraint reports_workspace_version_key
    unique (workspace_id, version);

alter table public.archetype_scores
  drop constraint if exists archetype_scores_user_id_version_archetype_name_key;
alter table public.archetype_scores
  add constraint archetype_scores_workspace_version_archetype_key
    unique (workspace_id, version, archetype_name);

alter table public.user_top_archetypes
  drop constraint if exists user_top_archetypes_user_id_version_rank_key;
alter table public.user_top_archetypes
  add constraint user_top_archetypes_workspace_version_rank_key
    unique (workspace_id, version, rank);
