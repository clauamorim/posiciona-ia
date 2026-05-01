ALTER TABLE public.portrait_generations
ADD COLUMN IF NOT EXISTS kept_indices INTEGER[] DEFAULT NULL;

COMMENT ON COLUMN public.portrait_generations.kept_indices IS
'Lista de índices dos retratos mantidos pela usuária. NULL = todos visíveis (default). Array vazio = geração inteira oculta no histórico.';