ALTER TABLE public.user_gallery_assets
ADD COLUMN IF NOT EXISTS bg_removed BOOLEAN NOT NULL DEFAULT false;