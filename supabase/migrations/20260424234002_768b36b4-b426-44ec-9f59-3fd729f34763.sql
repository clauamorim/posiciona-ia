-- Tabela de jobs assíncronos para geração de conteúdo editorial
CREATE TABLE public.content_generation_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  report_id UUID NOT NULL,
  week_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

-- Índice para o worker pegar jobs queued mais antigos e para polling do cliente
CREATE INDEX idx_content_jobs_status_created ON public.content_generation_jobs (status, created_at);
CREATE INDEX idx_content_jobs_user ON public.content_generation_jobs (user_id, created_at DESC);

-- Atualiza updated_at automaticamente
CREATE TRIGGER update_content_generation_jobs_updated_at
BEFORE UPDATE ON public.content_generation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.content_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
  ON public.content_generation_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
  ON public.content_generation_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
  ON public.content_generation_jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all jobs"
  ON public.content_generation_jobs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all jobs"
  ON public.content_generation_jobs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete jobs"
  ON public.content_generation_jobs FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));