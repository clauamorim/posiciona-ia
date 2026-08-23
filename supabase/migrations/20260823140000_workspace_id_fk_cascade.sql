-- ============================================================================
-- Corrige exclusão de usuário quebrada no Admin ("Edge Function returned a
-- non-2xx status code" ao excluir).
--
-- Causa raiz: a migração 20260717130000 adicionou workspace_id (uuid
-- references public.workspaces(id)) nas 22 tabelas do Grupo A SEM
-- "on delete cascade". workspaces.owner_id -> auth.users JÁ é cascade, então
-- ao excluir um usuário a Postgres tenta apagar os workspaces dele em
-- cascata — mas essas 22 tabelas ainda têm linhas apontando pro workspace_id
-- (a própria exclusão delas, via user_id -> auth.users, também é cascade,
-- só que é um caminho independente do workspace_id -> workspaces; a Postgres
-- não garante que uma rode antes da outra), e a constraint sem cascade
-- barra a exclusão do workspace com "violates foreign key constraint".
--
-- Aplicação: MANUAL no SQL editor do Lovable Cloud. Idempotente.
-- ============================================================================

do $$
declare
  t text;
  tables text[] := array[
    'reports',
    'business_questionnaires',
    'personal_questionnaires',
    'sales_narrative_questionnaires',
    'sales_story_sequences',
    'archetype_answers',
    'archetype_scores',
    'user_top_archetypes',
    'user_archetype_symbols',
    'instagram_analyses',
    'user_brand_palette',
    'post_embeddings',
    'story_embeddings',
    'used_title_patterns',
    'used_personal_traits',
    'used_market_trends',
    'assistant_conversations',
    'assistant_messages',
    'content_generation_jobs',
    'report_generation_jobs',
    'user_designs',
    'user_gallery_assets'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_workspace_id_fkey');
    execute format(
      'alter table public.%I add constraint %I foreign key (workspace_id) references public.workspaces(id) on delete cascade',
      t, t || '_workspace_id_fkey');
  end loop;
end $$;
