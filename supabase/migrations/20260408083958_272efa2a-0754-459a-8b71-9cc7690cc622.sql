
-- Tabela para salvar análises do Instagram
CREATE TABLE public.instagram_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text,
  analysis jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instagram_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses" ON public.instagram_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all analyses" ON public.instagram_analyses FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own analyses" ON public.instagram_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tabela para salvar retratos gerados
CREATE TABLE public.portrait_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  portraits jsonb NOT NULL DEFAULT '[]'::jsonb,
  style_index integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portrait_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own portraits" ON public.portrait_generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all portraits" ON public.portrait_generations FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own portraits" ON public.portrait_generations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tabela para pacotes de retrato
CREATE TABLE public.portrait_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL,
  price_cents integer NOT NULL,
  stripe_price_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portrait_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read packs" ON public.portrait_packs FOR SELECT TO authenticated USING (true);
