
-- 1) Atomic credit consumption RPC (user-facing)
CREATE OR REPLACE FUNCTION public.consume_credit(
  p_credit_type text,
  p_amount integer,
  p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_col text;
  v_current integer;
  v_deduct integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_amount IS NULL OR p_amount >= 0 THEN
    RAISE EXCEPTION 'Amount must be a negative integer (deduction)';
  END IF;
  v_deduct := -p_amount;

  IF p_credit_type = 'reanalysis' THEN
    v_col := 'reanalysis_credits';
  ELSIF p_credit_type = 'regeneration' THEN
    v_col := 'regeneration_credits';
  ELSIF p_credit_type = 'portrait_extra' THEN
    v_col := 'portrait_credits_extra';
  ELSE
    RAISE EXCEPTION 'Invalid credit_type: %', p_credit_type;
  END IF;

  EXECUTE format('SELECT %I FROM public.user_balances WHERE user_id = $1 FOR UPDATE', v_col)
    INTO v_current USING v_user;
  IF v_current IS NULL OR v_current < v_deduct THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;
  EXECUTE format('UPDATE public.user_balances SET %I = %I - $1, updated_at = now() WHERE user_id = $2', v_col, v_col)
    USING v_deduct, v_user;

  INSERT INTO public.credit_logs (user_id, credit_type, amount, description)
  VALUES (v_user, p_credit_type, p_amount, p_description);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_credit(text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_credit(text, integer, text) TO authenticated;

-- 2) Admin: set balances + log
CREATE OR REPLACE FUNCTION public.admin_set_balances(
  p_user_id uuid,
  p_weekly_cycles integer,
  p_reanalysis_credits integer,
  p_portrait_credits_included integer,
  p_portrait_credits_extra integer,
  p_regeneration_credits integer,
  p_log_type text,
  p_log_amount integer,
  p_log_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.user_balances SET
    weekly_cycles = COALESCE(p_weekly_cycles, weekly_cycles),
    reanalysis_credits = COALESCE(p_reanalysis_credits, reanalysis_credits),
    portrait_credits_included = COALESCE(p_portrait_credits_included, portrait_credits_included),
    portrait_credits_extra = COALESCE(p_portrait_credits_extra, portrait_credits_extra),
    regeneration_credits = COALESCE(p_regeneration_credits, regeneration_credits),
    updated_at = now()
  WHERE user_id = p_user_id;

  IF p_log_type IS NOT NULL THEN
    INSERT INTO public.credit_logs (user_id, credit_type, amount, description)
    VALUES (p_user_id, p_log_type, COALESCE(p_log_amount, 0), p_log_description);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_balances(uuid, integer, integer, integer, integer, integer, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_balances(uuid, integer, integer, integer, integer, integer, text, integer, text) TO authenticated;

-- 3) Lock down user_balances / user_credits / credit_logs from direct user writes
DROP POLICY IF EXISTS "Users can insert own balances" ON public.user_balances;
DROP POLICY IF EXISTS "Users can update own balances" ON public.user_balances;
DROP POLICY IF EXISTS "Users can insert own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can update own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can insert own logs" ON public.credit_logs;

-- 4) user_designs: prevent promoting non-global to global via UPDATE
DROP POLICY IF EXISTS "Only admins can update global templates" ON public.user_designs;
CREATE POLICY "Only admins can update global templates"
ON public.user_designs
FOR UPDATE
USING (((auth.uid() = user_id) AND (is_global = false)) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (auth.uid() = user_id AND is_global = false)
);

-- 5) post_background_cache: require authenticated user
DROP POLICY IF EXISTS "Authenticated can insert background cache" ON public.post_background_cache;
CREATE POLICY "Authenticated can insert background cache"
ON public.post_background_cache
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 6) asset-gallery: restrict SELECT to authenticated users
DROP POLICY IF EXISTS "Anyone can view gallery assets" ON storage.objects;
CREATE POLICY "Authenticated can view gallery assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'asset-gallery');

-- 7) Revoke public execute on internal trigger function
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
