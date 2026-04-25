CREATE TABLE public.personal_questionnaires (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  is_complete BOOLEAN NOT NULL DEFAULT false,
  -- Bloco 1: Vida pessoal
  hobby TEXT,
  pets TEXT,
  sports TEXT,
  dependents TEXT,
  sunday_morning TEXT,
  -- Bloco 2: Bastidores profissionais
  proud_moment TEXT,
  failure_lesson TEXT,
  work_routine TEXT,
  pre_meeting_ritual TEXT,
  unblock_method TEXT,
  -- Bloco 3: Valores e visão
  defended_belief TEXT,
  social_cause TEXT,
  desired_feeling TEXT,
  guiding_belief TEXT,
  -- Bloco 4: Memórias
  formative_story TEXT,
  biggest_influence TEXT,
  advice_to_20yo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pq"
ON public.personal_questionnaires FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pq"
ON public.personal_questionnaires FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pq"
ON public.personal_questionnaires FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all pq"
ON public.personal_questionnaires FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pq"
ON public.personal_questionnaires FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_personal_questionnaires_user_version
ON public.personal_questionnaires (user_id, version DESC);

CREATE TRIGGER update_personal_questionnaires_updated_at
BEFORE UPDATE ON public.personal_questionnaires
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();