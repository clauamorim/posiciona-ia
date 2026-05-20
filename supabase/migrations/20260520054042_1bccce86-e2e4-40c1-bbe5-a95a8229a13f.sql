-- 1. Restitui 1 ciclo semanal para a usuária claudiacomput@hotmail.com (job de geração travou)
UPDATE public.user_balances
SET weekly_cycles = weekly_cycles + 1,
    updated_at = now()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'claudiacomput@hotmail.com');

-- 2. Marca o job 37e1fa23 como failed (worker travou em loop de dedup)
UPDATE public.content_generation_jobs
SET status = 'failed',
    error_message = 'Timeout durante dedup de feed (worker shutdown). Crédito restituído.',
    updated_at = now()
WHERE id::text LIKE '37e1fa23%' AND status = 'processing';

-- 3. Marca qualquer outro job em "processing" há mais de 10 minutos da mesma usuária (segurança)
UPDATE public.content_generation_jobs
SET status = 'failed',
    error_message = 'Timeout no worker. Crédito a verificar.',
    updated_at = now()
WHERE status = 'processing'
  AND updated_at < now() - interval '10 minutes'
  AND user_id = (SELECT id FROM auth.users WHERE email = 'claudiacomput@hotmail.com');