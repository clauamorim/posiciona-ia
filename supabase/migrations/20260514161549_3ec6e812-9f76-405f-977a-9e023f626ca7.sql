
-- SSoT: símbolos e paleta do relatório do usuário (versão atual)
CREATE TABLE public.user_archetype_symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id uuid,
  report_version integer NOT NULL DEFAULT 1,
  symbol_name text NOT NULL,
  emoji text,
  meaning text,
  application text,
  applies_to text[] NOT NULL DEFAULT ARRAY['overlay','highlight_icon','post_decoration']::text[],
  archetype_role text NOT NULL DEFAULT 'primary',
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_uas_user_version ON public.user_archetype_symbols(user_id, report_version DESC);
ALTER TABLE public.user_archetype_symbols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own symbols" ON public.user_archetype_symbols FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own symbols" ON public.user_archetype_symbols FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own symbols" ON public.user_archetype_symbols FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages symbols" ON public.user_archetype_symbols FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Admins view all symbols" ON public.user_archetype_symbols FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_brand_palette (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id uuid,
  report_version integer NOT NULL DEFAULT 1,
  color_name text NOT NULL,
  hex text NOT NULL,
  usage text,
  role text NOT NULL DEFAULT 'accent',
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ubp_user_version ON public.user_brand_palette(user_id, report_version DESC);
ALTER TABLE public.user_brand_palette ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own palette" ON public.user_brand_palette FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own palette" ON public.user_brand_palette FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own palette" ON public.user_brand_palette FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages palette" ON public.user_brand_palette FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Admins view all palettes" ON public.user_brand_palette FOR SELECT USING (has_role(auth.uid(), 'admin'));
