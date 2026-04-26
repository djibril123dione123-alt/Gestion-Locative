-- =============================================================================
-- Création du bucket storage pour les assets des agences (logos, etc.)
-- =============================================================================

-- Créer le bucket agency-assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agency-assets',
  'agency-assets',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
);

-- Policy pour lecture publique (logos visibles)
CREATE POLICY "Public read access for agency assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'agency-assets');

-- Policy pour upload par les admins d'agence
CREATE POLICY "Agency admins can upload assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'agency-assets'
    AND (storage.foldername(name))[1] = (
      SELECT agency_id::text FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy pour update/delete par les admins d'agence
CREATE POLICY "Agency admins can update their assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'agency-assets'
    AND (storage.foldername(name))[1] = (
      SELECT agency_id::text FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'agency-assets'
    AND (storage.foldername(name))[1] = (
      SELECT agency_id::text FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Agency admins can delete their assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'agency-assets'
    AND (storage.foldername(name))[1] = (
      SELECT agency_id::text FROM user_profiles WHERE id = auth.uid()
    )
  );