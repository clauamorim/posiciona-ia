UPDATE public.reports
SET status = 'pending',
    content = NULL,
    editorial_weeks = '[]'::jsonb,
    error_message = NULL,
    updated_at = now()
WHERE id = '76e7997d-9ff3-4318-8093-945f9c125eb3';

DELETE FROM public.report_generation_jobs
WHERE report_id = '76e7997d-9ff3-4318-8093-945f9c125eb3';

DELETE FROM public.content_generation_jobs
WHERE report_id = '76e7997d-9ff3-4318-8093-945f9c125eb3';