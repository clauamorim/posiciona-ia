CREATE TABLE public.story_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE CASCADE,
  week_index integer NOT NULL,
  day_index integer NOT NULL CHECK (day_index BETWEEN 1 AND 7),
  embedding vector(768) NOT NULL,
  story_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_story_embeddings_user_day
  ON public.story_embeddings (user_id, day_index, created_at DESC);

CREATE INDEX idx_story_embeddings_vector
  ON public.story_embeddings USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.story_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own story embeddings"
  ON public.story_embeddings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages story embeddings"
  ON public.story_embeddings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins view all story embeddings"
  ON public.story_embeddings
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.match_story_embeddings(
  p_user_id uuid,
  p_query_embedding vector(768),
  p_day_index integer,
  p_threshold double precision DEFAULT 0.78,
  p_window_days integer DEFAULT 56,
  p_exclude_report_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  week_index integer,
  story_text text,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.id,
    se.week_index,
    se.story_text,
    1 - (se.embedding <=> p_query_embedding) AS similarity
  FROM public.story_embeddings se
  WHERE se.user_id = p_user_id
    AND se.day_index = p_day_index
    AND se.created_at > now() - (p_window_days || ' days')::interval
    AND (p_exclude_report_id IS NULL OR se.report_id IS DISTINCT FROM p_exclude_report_id)
    AND (1 - (se.embedding <=> p_query_embedding)) > p_threshold
  ORDER BY se.embedding <=> p_query_embedding
  LIMIT 5;
END;
$$;