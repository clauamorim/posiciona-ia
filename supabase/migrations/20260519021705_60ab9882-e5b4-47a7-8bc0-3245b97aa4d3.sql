ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET profile_completed = true
WHERE COALESCE(whatsapp, '') <> ''
  AND COALESCE(profession, '') <> ''
  AND COALESCE(niche, '') <> ''
  AND COALESCE(gender, '') <> ''
  AND COALESCE(main_goal, '') <> '';