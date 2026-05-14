CREATE TABLE public.used_personal_traits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id uuid,
  week_index integer,
  traits_used text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_used_personal_traits_user_created
  ON public.used_personal_traits(user_id, created_at DESC);

ALTER TABLE public.used_personal_traits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own used traits"
  ON public.used_personal_traits
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all used traits"
  ON public.used_personal_traits
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));