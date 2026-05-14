REVOKE EXECUTE ON FUNCTION public.match_post_embeddings(uuid, vector, timestamptz, float, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_post_embeddings(uuid, vector, timestamptz, float, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.match_post_embeddings(uuid, vector, timestamptz, float, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_post_embeddings(uuid, vector, timestamptz, float, int) TO service_role;