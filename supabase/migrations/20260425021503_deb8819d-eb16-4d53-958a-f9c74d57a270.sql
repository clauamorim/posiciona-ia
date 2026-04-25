ALTER TABLE public.portrait_generations
ADD COLUMN IF NOT EXISTS used_hand_poses jsonb NOT NULL DEFAULT '[]'::jsonb;