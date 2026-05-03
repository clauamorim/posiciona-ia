ALTER TABLE public.user_designs
ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS archetype text;

CREATE INDEX IF NOT EXISTS idx_user_designs_global_templates
ON public.user_designs (is_template, is_global) WHERE is_template = true AND is_global = true;

-- Allow all authenticated users to read active global templates
CREATE POLICY "Authenticated can view global templates"
ON public.user_designs
FOR SELECT
TO authenticated
USING (is_template = true AND is_global = true);

-- Restrict creating/updating/deleting global rows to admins only
CREATE POLICY "Only admins can insert global templates"
ON public.user_designs
FOR INSERT
TO authenticated
WITH CHECK (
  is_global = false OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Only admins can update global templates"
ON public.user_designs
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id AND is_global = false)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete global templates"
ON public.user_designs
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
