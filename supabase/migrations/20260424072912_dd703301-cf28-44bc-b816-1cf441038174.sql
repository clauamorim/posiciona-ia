-- Tabela de treinos de LoRA por usuário
CREATE TABLE public.portrait_trainings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  replicate_training_id TEXT,
  trigger_word TEXT NOT NULL,
  lora_weights_url TEXT,
  status TEXT NOT NULL DEFAULT 'training',
  selfies_count INTEGER NOT NULL DEFAULT 0,
  was_free BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_portrait_trainings_user ON public.portrait_trainings(user_id, created_at DESC);
CREATE INDEX idx_portrait_trainings_replicate ON public.portrait_trainings(replicate_training_id);

ALTER TABLE public.portrait_trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own trainings"
  ON public.portrait_trainings FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own trainings"
  ON public.portrait_trainings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage trainings"
  ON public.portrait_trainings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER portrait_trainings_updated_at
  BEFORE UPDATE ON public.portrait_trainings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para selfies de treino
INSERT INTO storage.buckets (id, name, public)
VALUES ('portrait-inputs', 'portrait-inputs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own portrait inputs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portrait-inputs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own portrait inputs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'portrait-inputs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own portrait inputs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'portrait-inputs' AND auth.uid()::text = (storage.foldername(name))[1]);
