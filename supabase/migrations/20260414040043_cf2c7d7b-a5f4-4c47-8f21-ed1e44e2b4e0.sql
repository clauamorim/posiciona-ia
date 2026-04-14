
-- Reference documents table
CREATE TABLE public.reference_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  file_path text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reference_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read reference_documents"
  ON public.reference_documents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert reference_documents"
  ON public.reference_documents FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reference_documents"
  ON public.reference_documents FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reference_documents"
  ON public.reference_documents FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Gallery assets table
CREATE TABLE public.gallery_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  file_path text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read gallery_assets"
  ON public.gallery_assets FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert gallery_assets"
  ON public.gallery_assets FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update gallery_assets"
  ON public.gallery_assets FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete gallery_assets"
  ON public.gallery_assets FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('reference-pdfs', 'reference-pdfs', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('asset-gallery', 'asset-gallery', true);

-- Storage policies for reference-pdfs (admin only)
CREATE POLICY "Admins can upload reference pdfs"
  ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'reference-pdfs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read reference pdfs"
  ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'reference-pdfs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reference pdfs"
  ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'reference-pdfs' AND public.has_role(auth.uid(), 'admin'));

-- Storage policies for asset-gallery (public read, admin write)
CREATE POLICY "Anyone can view gallery assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'asset-gallery');

CREATE POLICY "Admins can upload gallery assets"
  ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'asset-gallery' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete gallery assets"
  ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'asset-gallery' AND public.has_role(auth.uid(), 'admin'));
