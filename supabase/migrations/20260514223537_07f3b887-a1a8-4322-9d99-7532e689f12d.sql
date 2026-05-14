CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.post_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id uuid NOT NULL,
  week_index integer NOT NULL,
  day_index integer NOT NULL,
  post_kind text NOT NULL CHECK (post_kind IN ('feed','stories')),
  text_used text NOT NULL,
  embedding vector(768) NOT NULL,
  named_cases text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX post_embeddings_user_created_idx
  ON public.post_embeddings (user_id, created_at DESC);

CREATE INDEX post_embeddings_vec_idx
  ON public.post_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE public.post_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own embeddings"
  ON public.post_embeddings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own embeddings"
  ON public.post_embeddings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own embeddings"
  ON public.post_embeddings FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all embeddings"
  ON public.post_embeddings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages embeddings"
  ON public.post_embeddings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.match_post_embeddings(
  p_user_id uuid,
  p_query vector(768),
  p_since timestamptz,
  p_threshold float,
  p_limit int
)
RETURNS TABLE (
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pe.id,
    pe.report_id,
    pe.week_index,
    pe.day_index,
    pe.post_kind,
    pe.text_used,
    pe.named_cases,
    pe.created_at,
    1 - (pe.embedding <=> p_query) AS similarity
  FROM public.post_embeddings pe
  WHERE pe.user_id = p_user_id
    AND pe.created_at >= p_since
    AND 1 - (pe.embedding <=> p_query) >= p_threshold
  ORDER BY pe.embedding <=> p_query ASC
  LIMIT p_limit;
$$;