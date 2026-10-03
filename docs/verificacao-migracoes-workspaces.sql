-- ============================================================================
-- Verificação das migrações multi-workspace (17/07 a 25/08/2026).
-- SOMENTE LEITURA: não altera nada no banco.
--
-- Onde rodar: Lovable → More → Cloud → SQL editor. Cole a CONSULTA 1, rode, e
-- confira a coluna "aplicada". Toda linha deve vir "true". Se alguma vier
-- "false", aquela migração (ou parte dela) não está aplicada no banco.
--
-- A CONSULTA 2 só deve ser rodada se a consulta 1 vier toda "true": ela
-- mede se o banco está pronto para a fase contract.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- CONSULTA 1 — cada migração está aplicada?
-- ---------------------------------------------------------------------------
select migracao, aplicada from (values

  (1, '20260717120000 expand 1: tabelas workspaces e workspace_members',
      to_regclass('public.workspaces') is not null
      and to_regclass('public.workspace_members') is not null
      and exists (select 1 from pg_proc where proname = 'has_workspace_access')),

  (2, '20260717120000 expand 1: cadastro novo cria perfil (handle_new_user)',
      exists (select 1 from pg_proc where proname = 'handle_new_user'
              and prosrc ilike '%insert into public.workspaces%')),

  (3, '20260717130000 expand 2: workspace_id nas 22 tabelas do Grupo A',
      (select count(*) from information_schema.columns
       where table_schema = 'public' and column_name = 'workspace_id'
         and table_name in ('reports','business_questionnaires','personal_questionnaires',
           'sales_narrative_questionnaires','sales_story_sequences','archetype_answers',
           'archetype_scores','user_top_archetypes','user_archetype_symbols',
           'instagram_analyses','user_brand_palette','post_embeddings','story_embeddings',
           'used_title_patterns','used_personal_traits','used_market_trends',
           'assistant_conversations','assistant_messages','content_generation_jobs',
           'report_generation_jobs','user_designs','user_gallery_assets')) = 22),

  (4, '20260717140000 limpeza de órfãs + FKs (content_generation_jobs, user_gallery_assets)',
      (select count(*) from pg_constraint
       where conname in ('content_generation_jobs_user_id_fkey','user_gallery_assets_user_id_fkey')
         and confdeltype = 'c') = 2),

  (5, '20260718090000 arquétipos institucionais (36 perguntas, 1001-1036)',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'archetype_questions'
                and column_name = 'brand_type')
      and (select count(*) from public.archetype_questions
           where question_number between 1001 and 1036) = 36),

  (6, '20260718110000 archetype_answers único por perfil',
      exists (select 1 from pg_constraint
              where conname = 'archetype_answers_workspace_version_question_key')),

  (7, '20260721160000 owner_id preenchido pelo banco (default auth.uid())',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'workspaces'
                and column_name = 'owner_id' and column_default ilike '%auth.uid()%')),

  (8, '20260721170000 política "Owner can view workspace"',
      exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'workspaces'
                and policyname = 'Owner can view workspace')),

  (9, '20260721180000 diagnóstico (business_questionnaires) único por perfil',
      exists (select 1 from pg_constraint
              where conname = 'business_questionnaires_workspace_version_key')),

  (10, '20260721190000 relatório, scores e top arquétipos únicos por perfil',
      (select count(*) from pg_constraint
       where conname in ('reports_workspace_version_key',
                         'archetype_scores_workspace_version_archetype_key',
                         'user_top_archetypes_workspace_version_rank_key')) = 3),

  (11, '20260805120000 dedup semântico por perfil (match_*_embeddings)',
      exists (select 1 from pg_proc where proname = 'match_post_embeddings'
              and pg_get_function_arguments(oid) ilike '%p_workspace_id%')
      and exists (select 1 from pg_proc where proname = 'match_story_embeddings'
              and pg_get_function_arguments(oid) ilike '%p_workspace_id%')),

  (12, '20260810130000 História de Venda única por perfil',
      exists (select 1 from pg_constraint
              where conname = 'sales_narrative_questionnaires_workspace_key')),

  (13, '20260822120000 planos Dupla/Multi/Agência + limite de perfis',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'plans'
                and column_name = 'max_workspaces')
      and (select count(*) from public.plans
           where slug in ('dupla','multi','agencia')) = 3
      and exists (select 1 from pg_trigger where tgname = 'trg_enforce_workspace_limit')),

  (14, '20260823140000 workspace_id com exclusão em cascata',
      to_regclass('public.workspaces') is not null
      and not exists (select 1 from pg_constraint
                      where contype = 'f'
                        and confrelid = to_regclass('public.workspaces')
                        and confdeltype <> 'c')),

  (15, '20260823170000 pedidos de exclusão LGPD com processed_at',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'account_deletion_requests'
                and column_name = 'processed_at')),

  -- Os packs são cadastrados fora das migrações: se a tabela portrait_packs
  -- estiver vazia, esta linha vem "false" mesmo com a migração aplicada.
  (16, '20260823190000 packs de retrato com preço para Dupla/Multi/Agência',
      exists (select 1 from public.portrait_packs where stripe_price_ids ? 'dupla')
      and not exists (select 1 from public.portrait_packs
                  where stripe_price_ids ? 'autoridade_total'
                    and not (stripe_price_ids ? 'dupla'
                             and stripe_price_ids ? 'multi'
                             and stripe_price_ids ? 'agencia'))),

  (17, '20260824120000 convites (tabela, RPCs e políticas do convidado)',
      to_regclass('public.workspace_invites') is not null
      and exists (select 1 from pg_proc where proname = 'accept_workspace_invite')
      and exists (select 1 from pg_policies
                  where tablename = 'personal_questionnaires'
                    and policyname = 'Workspace members can view pq')),

  (18, '20260824140000 salvaguardas de exclusão de perfil (triggers)',
      (select count(*) from pg_trigger
       where tgname in ('trg_prevent_last_workspace_delete',
                        'trg_promote_default_workspace')) = 2),

  (19, '20260824150000 invited_by preenchido pelo banco',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'workspace_invites'
                and column_name = 'invited_by' and column_default ilike '%auth.uid()%')),

  (20, '20260824160000 invited_by não bloqueia exclusão de usuário',
      exists (select 1 from pg_constraint
              where conname = 'workspace_invites_invited_by_fkey' and confdeltype = 'c')
      and exists (select 1 from pg_constraint
              where conname = 'workspace_members_invited_by_fkey' and confdeltype = 'n')),

  (21, '20260825120000 exclusão de conta com perfil único liberada',
      exists (select 1 from pg_proc where proname = 'prevent_last_workspace_delete'
              and prosrc ilike '%owner_still_exists%'))

) as v(ordem, migracao, aplicada)
order by ordem;


-- ---------------------------------------------------------------------------
-- CONSULTA 2 — o banco está pronto para a fase contract?
-- Rode só depois que a consulta 1 vier toda "true".
-- Cada linha mostra quantos registros ainda estão SEM perfil (workspace_id
-- vazio). Para a fase contract, a coluna "sem_perfil" precisa ser 0 em todas.
-- A última linha conta contas que não têm nenhum perfil (também deve ser 0).
-- ---------------------------------------------------------------------------
select tabela,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from public.%I where workspace_id is null', tabela),
                           false, true, '')))[1]::text::int as sem_perfil
from unnest(array['reports','business_questionnaires','personal_questionnaires',
  'sales_narrative_questionnaires','sales_story_sequences','archetype_answers',
  'archetype_scores','user_top_archetypes','user_archetype_symbols',
  'instagram_analyses','user_brand_palette','post_embeddings','story_embeddings',
  'used_title_patterns','used_personal_traits','used_market_trends',
  'assistant_conversations','assistant_messages','content_generation_jobs',
  'report_generation_jobs','user_designs','user_gallery_assets']) as tabela
union all
select '(contas sem nenhum perfil)',
       (select count(*)::int from public.profiles p
        where not exists (select 1 from public.workspaces w where w.owner_id = p.user_id))
order by sem_perfil desc, tabela;
