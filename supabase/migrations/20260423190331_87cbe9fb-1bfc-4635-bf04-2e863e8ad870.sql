-- 1) Add is_logo flag to user_gallery_assets
ALTER TABLE public.user_gallery_assets
ADD COLUMN IF NOT EXISTS is_logo BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_gallery_assets_user_logo
ON public.user_gallery_assets(user_id) WHERE is_logo = true;

-- Allow users to update their own gallery assets (needed to toggle is_logo)
CREATE POLICY "Users can update own gallery assets"
ON public.user_gallery_assets
FOR UPDATE
USING (auth.uid() = user_id);

-- 2) Create post_background_cache (shared across users to save AI credits)
CREATE TABLE IF NOT EXISTS public.post_background_cache (
  theme_hash TEXT PRIMARY KEY,
  image_url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'unsplash',
  keywords TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.post_background_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read background cache"
ON public.post_background_cache
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert background cache"
ON public.post_background_cache
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_post_background_cache_created_at
ON public.post_background_cache(created_at DESC);