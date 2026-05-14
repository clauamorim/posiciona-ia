
CREATE TABLE public.used_market_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  week_index INTEGER,
  trends_used JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_used_market_trends_user_created
  ON public.used_market_trends(user_id, created_at DESC);

ALTER TABLE public.used_market_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trend usage"
  ON public.used_market_trends FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on used_market_trends"
  ON public.used_market_trends FOR ALL
  USING (auth.role() = 'service_role');
