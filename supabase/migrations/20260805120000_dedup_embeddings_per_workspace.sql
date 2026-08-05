-- ============================================================================
-- Slice C2 — motor de geração (process-content-generation-job) por perfil.
-- match_post_embeddings/match_story_embeddings filtravam só por p_user_id:
-- numa conta com 2+ perfis, o dedup semântico comparava o post/story novo
-- contra o histórico de TODOS os perfis da conta, não só do perfil ativo.
-- post_embeddings/story_embeddings já têm workspace_id desde a Etapa 1
-- (migração 20260717130000, backfilled). Aqui só ensina as funções a filtrar
-- por ele quando informado — chamador antigo (sem p_workspace_id) mantém o
-- comportamento anterior por user_id. Aplicação MANUAL no SQL editor do
-- Lovable Cloud (git push não aplica migração).
-- ============================================================================

drop function if exists public.match_post_embeddings(uuid, vector(768), timestamptz, float, int);

create or replace function public.match_post_embeddings(
  p_user_id uuid,
  p_query vector(768),
  p_since timestamptz,
  p_threshold float,
  p_limit int,
  p_workspace_id uuid default null
)
returns table (
  id uuid,
  report_id uuid,
  week_index int,
  day_index int,
  post_kind text,
  text_used text,
  named_cases text[],
  created_at timestamptz,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pe.id,
    pe.report_id,
    pe.week_index,
    pe.day_index,
    pe.post_kind,
    pe.text_used,
    pe.named_cases,
    pe.created_at,
    1 - (pe.embedding <=> p_query) as similarity
  from public.post_embeddings pe
  where (
      (p_workspace_id is not null and pe.workspace_id = p_workspace_id)
      or (p_workspace_id is null and pe.user_id = p_user_id)
    )
    and pe.created_at >= p_since
    and 1 - (pe.embedding <=> p_query) >= p_threshold
  order by pe.embedding <=> p_query asc
  limit p_limit;
$$;

drop function if exists public.match_story_embeddings(uuid, vector(768), integer, double precision, integer, uuid);

create or replace function public.match_story_embeddings(
  p_user_id uuid,
  p_query_embedding vector(768),
  p_day_index integer,
  p_threshold double precision default 0.78,
  p_window_days integer default 56,
  p_exclude_report_id uuid default null,
  p_workspace_id uuid default null
)
returns table (
  id uuid,
  week_index integer,
  story_text text,
  similarity double precision
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    se.id,
    se.week_index,
    se.story_text,
    1 - (se.embedding <=> p_query_embedding) as similarity
  from public.story_embeddings se
  where (
      (p_workspace_id is not null and se.workspace_id = p_workspace_id)
      or (p_workspace_id is null and se.user_id = p_user_id)
    )
    and se.day_index = p_day_index
    and se.created_at > now() - (p_window_days || ' days')::interval
    and (p_exclude_report_id is null or se.report_id is distinct from p_exclude_report_id)
    and (1 - (se.embedding <=> p_query_embedding)) > p_threshold
  order by se.embedding <=> p_query_embedding
  limit 5;
end;
$$;
