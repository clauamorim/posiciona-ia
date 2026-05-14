CREATE TABLE public.market_trends_cache (
  key text PRIMARY KEY,
  trends jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.market_trends_cache ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_market_trends_cache_expires ON public.market_trends_cache(expires_at);