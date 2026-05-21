-- Destrava jobs de relatório presos: worker morreu, catch nunca rodou.
-- Critério: status queued/processing E sem heartbeat há mais de 4 minutos.
UPDATE public.report_generation_jobs
SET
  status = 'failed',
  error_message = COALESCE(error_message, 'A geração foi interrompida antes de concluir. Tente novamente — se receber esta mensagem mais de uma vez, fale com o suporte.'),
  progress_message = NULL,
  finished_at = COALESCE(finished_at, now()),
  updated_at = now()
WHERE status IN ('queued', 'processing')
  AND updated_at < now() - interval '4 minutes';

-- Destrava os reports correspondentes que continuaram "generating".
UPDATE public.reports r
SET
  status = 'error',
  error_message = COALESCE(r.error_message, 'A geração foi interrompida antes de concluir. Tente novamente — se receber esta mensagem mais de uma vez, fale com o suporte.')
WHERE r.status IN ('pending', 'generating')
  AND EXISTS (
    SELECT 1 FROM public.report_generation_jobs j
    WHERE j.report_id = r.id
      AND j.status = 'failed'
      AND j.finished_at > now() - interval '1 minute'
  );
