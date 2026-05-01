CREATE TABLE public.portrait_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_portrait_references_user_active
  ON public.portrait_references(user_id, is_active, position);

ALTER TABLE public.portrait_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own references"
  ON public.portrait_references FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own references"
  ON public.portrait_references FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own references"
  ON public.portrait_references FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own references"
  ON public.portrait_references FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all references"
  ON public.portrait_references FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.portrait_generations
  ADD COLUMN IF NOT EXISTS engine TEXT NOT NULL DEFAULT 'gemini';