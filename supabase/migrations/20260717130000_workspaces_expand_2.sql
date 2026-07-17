-- ============================================================================
-- ETAPA 1.2 — Fundação multi-workspace (expand, parte 2)
-- Adiciona workspace_id (NULLABLE nesta fase) às 22 tabelas de conteúdo do
-- Grupo A + índice + backfill via workspace default do dono. Idempotente.
-- Aplicação MANUAL no SQL editor do Lovable Cloud, após a parte 1.
-- Nota: reference_documents saiu do Grupo A (catálogo global, sem user_id).
-- A constraint NOT NULL e a troca das UNIQUE ficam para a fase "contract".
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
    execute format(
      'alter table public.%I add column if not exists workspace_id uuid references public.workspaces(id)', t);
    execute format(
      'create index if not exists idx_%s_workspace on public.%I (workspace_id)', t, t);
    execute format(
      'update public.%I x set workspace_id = w.id
         from public.workspaces w
        where w.owner_id = x.user_id and w.is_default and x.workspace_id is null', t);
  end loop;
end $$;
