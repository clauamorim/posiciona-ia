ALTER TABLE public.user_designs
ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_designs_is_template
ON public.user_designs (user_id, is_template);

ALTER TABLE public.user_gallery_assets
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload',
ADD COLUMN IF NOT EXISTS attribution jsonb;

CREATE INDEX IF NOT EXISTS idx_user_gallery_assets_source
ON public.user_gallery_assets (user_id, source);