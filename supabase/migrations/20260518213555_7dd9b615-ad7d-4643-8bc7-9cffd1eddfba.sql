-- Dedup post_embeddings, keeping the most recent row per (user_id, report_id, week_index, day_index, post_kind)
DELETE FROM public.post_embeddings p1
USING public.post_embeddings p2
WHERE p1.user_id = p2.user_id
  AND p1.report_id = p2.report_id
  AND p1.week_index = p2.week_index
  AND p1.day_index = p2.day_index
  AND p1.post_kind = p2.post_kind
  AND (p1.created_at < p2.created_at
       OR (p1.created_at = p2.created_at AND p1.id < p2.id));

CREATE UNIQUE INDEX IF NOT EXISTS post_embeddings_unique_post_idx
  ON public.post_embeddings (user_id, report_id, week_index, day_index, post_kind);