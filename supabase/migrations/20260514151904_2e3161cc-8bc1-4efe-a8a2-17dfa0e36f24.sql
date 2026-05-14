CREATE TABLE public.used_title_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id uuid,
  week_index integer NOT NULL,
  day_index integer NOT NULL,
  pillar text NOT NULL DEFAULT 'livre',
  title_formula text NOT NULL DEFAULT 'livre',
  title_anchors text[] NOT NULL DEFAULT '{}',
  central_concepts text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_used_title_patterns_user_created
  ON public.used_title_patterns (user_id, created_at DESC);

ALTER TABLE public.used_title_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own title patterns"
  ON public.used_title_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own title patterns"
  ON public.used_title_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all title patterns"
  ON public.used_title_patterns FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages title patterns"
  ON public.used_title_patterns FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');