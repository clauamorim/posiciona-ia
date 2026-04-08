
-- 1. Plans table
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  price_cents integer NOT NULL,
  billing_type text NOT NULL DEFAULT 'one_time',
  weekly_cycles integer NOT NULL DEFAULT 0,
  reanalysis_credits integer NOT NULL DEFAULT 0,
  portrait_credits integer NOT NULL DEFAULT 0,
  regeneration_credits integer NOT NULL DEFAULT 0,
  stripe_price_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read plans" ON public.plans
  FOR SELECT TO authenticated USING (true);

-- 2. Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all subscriptions" ON public.subscriptions
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert subscriptions" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 3. User balances table
CREATE TABLE public.user_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  weekly_cycles integer NOT NULL DEFAULT 0,
  reanalysis_credits integer NOT NULL DEFAULT 0,
  portrait_credits_included integer NOT NULL DEFAULT 0,
  portrait_credits_extra integer NOT NULL DEFAULT 0,
  regeneration_credits integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own balances" ON public.user_balances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own balances" ON public.user_balances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own balances" ON public.user_balances
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all balances" ON public.user_balances
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all balances" ON public.user_balances
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- 4. Credit logs table
CREATE TABLE public.credit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credit_type text NOT NULL,
  amount integer NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON public.credit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all logs" ON public.credit_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own logs" ON public.credit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Add status column to business_questionnaires
ALTER TABLE public.business_questionnaires
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

-- 6. Update handle_new_user to also create user_balances
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 1);
  INSERT INTO public.user_balances (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$function$;
