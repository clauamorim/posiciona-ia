-- Bucket privado para armazenar PNGs dos retratos gerados
INSERT INTO storage.buckets (id, name, public)
VALUES ('portrait-outputs', 'portrait-outputs', false)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: cada usuário só acessa sua própria pasta
CREATE POLICY "Users can read own portrait outputs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'portrait-outputs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can insert own portrait outputs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portrait-outputs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own portrait outputs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'portrait-outputs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Coluna para registrar figurinos usados na última geração (memória curta)
ALTER TABLE public.portrait_generations
  ADD COLUMN IF NOT EXISTS used_outfits jsonb NOT NULL DEFAULT '[]'::jsonb;