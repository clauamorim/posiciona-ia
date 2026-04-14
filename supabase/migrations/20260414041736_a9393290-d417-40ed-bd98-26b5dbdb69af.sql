
CREATE POLICY "Admins can update reference pdfs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'reference-pdfs' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update gallery assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'asset-gallery' AND public.has_role(auth.uid(), 'admin'::public.app_role));
