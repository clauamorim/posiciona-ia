
-- 1) user_gallery_assets table
CREATE TABLE public.user_gallery_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_gallery_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gallery assets"
ON public.user_gallery_assets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gallery assets"
ON public.user_gallery_assets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own gallery assets"
ON public.user_gallery_assets FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all gallery assets"
ON public.user_gallery_assets FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_user_gallery_assets_user_id ON public.user_gallery_assets(user_id, created_at DESC);

-- 2) user_designs table
CREATE TABLE public.user_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Design sem título',
  week_index INTEGER,
  day_index INTEGER,
  thumbnail TEXT,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own designs"
ON public.user_designs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own designs"
ON public.user_designs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own designs"
ON public.user_designs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own designs"
ON public.user_designs FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all designs"
ON public.user_designs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_user_designs_user_updated ON public.user_designs(user_id, updated_at DESC);

CREATE TRIGGER update_user_designs_updated_at
BEFORE UPDATE ON public.user_designs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3) user-uploads storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploads', 'user-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can view own uploads"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'user-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4) Allow users to delete their own portraits
CREATE POLICY "Users can delete own portraits"
ON public.portrait_generations FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own portraits"
ON public.portrait_generations FOR UPDATE
USING (auth.uid() = user_id);
