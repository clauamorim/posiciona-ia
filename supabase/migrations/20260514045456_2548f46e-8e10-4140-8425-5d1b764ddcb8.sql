-- Tabela: sales_narrative_questionnaires (opcional, 1 por usuário)
CREATE TABLE public.sales_narrative_questionnaires (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  previous_profession text,
  career_turn text,
  negative_comments text,
  audience_objections text,
  proof_cases text,
  personal_expressions text,
  forbidden_topics text,
  start_year_motivation text,
  status text NOT NULL DEFAULT 'draft',
  is_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.sales_narrative_questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sales narrative"
  ON public.sales_narrative_questionnaires FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sales narrative"
  ON public.sales_narrative_questionnaires FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sales narrative"
  ON public.sales_narrative_questionnaires FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sales narrative"
  ON public.sales_narrative_questionnaires FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sales narratives"
  ON public.sales_narrative_questionnaires FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_sales_narrative_updated_at
  BEFORE UPDATE ON public.sales_narrative_questionnaires
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela: sales_story_sequences
CREATE TABLE public.sales_story_sequences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sequence_type text NOT NULL,
  offer_context text NOT NULL DEFAULT '',
  stories jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_story_sequence_type_check CHECK (
    sequence_type IN (
      'transformacao',
      'criticas_julgamentos',
      'objecao_narrativa',
      'objecao_direto',
      'bastidores_atendimentos',
      'bastidores_entregas',
      'apresentacao_bio'
    )
  )
);

CREATE INDEX idx_sales_story_sequences_user_created
  ON public.sales_story_sequences (user_id, created_at DESC);

ALTER TABLE public.sales_story_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sequences"
  ON public.sales_story_sequences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sequences"
  ON public.sales_story_sequences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sequences"
  ON public.sales_story_sequences FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sequences"
  ON public.sales_story_sequences FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));