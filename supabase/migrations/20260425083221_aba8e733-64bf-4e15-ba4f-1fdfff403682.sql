create table public.report_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  report_id uuid not null,
  report_version int not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  result jsonb,
  error_message text,
  progress_message text,
  attempts int not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.report_generation_jobs enable row level security;

create policy "Users view own report jobs" on public.report_generation_jobs
  for select using (auth.uid() = user_id);
create policy "Users insert own report jobs" on public.report_generation_jobs
  for insert with check (auth.uid() = user_id);
create policy "Users update own report jobs" on public.report_generation_jobs
  for update using (auth.uid() = user_id);
create policy "Admins view all report jobs" on public.report_generation_jobs
  for select using (has_role(auth.uid(), 'admin'::app_role));
create policy "Admins update all report jobs" on public.report_generation_jobs
  for update using (has_role(auth.uid(), 'admin'::app_role));
create policy "Admins delete report jobs" on public.report_generation_jobs
  for delete using (has_role(auth.uid(), 'admin'::app_role));

create index idx_report_jobs_user_status on public.report_generation_jobs(user_id, status);
create index idx_report_jobs_report on public.report_generation_jobs(report_id);

create trigger update_report_generation_jobs_updated_at
  before update on public.report_generation_jobs
  for each row execute function public.update_updated_at_column();