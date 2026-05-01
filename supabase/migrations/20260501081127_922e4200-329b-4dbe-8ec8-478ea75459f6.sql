ALTER TABLE public.portrait_trainings
  ADD COLUMN IF NOT EXISTS lora_provider text NOT NULL DEFAULT 'fal';

UPDATE public.portrait_trainings
  SET lora_provider = 'replicate'
  WHERE created_at < now()
    AND lora_provider = 'fal';

CREATE INDEX IF NOT EXISTS idx_portrait_trainings_provider
  ON public.portrait_trainings (user_id, lora_provider, status, created_at DESC);