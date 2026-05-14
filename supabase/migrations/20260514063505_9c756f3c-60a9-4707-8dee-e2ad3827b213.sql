ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_deletion_requested_at timestamptz NULL;

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  profession text,
  niche text,
  requested_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own deletion request"
  ON public.account_deletion_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own deletion request"
  ON public.account_deletion_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all deletion requests"
  ON public.account_deletion_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));