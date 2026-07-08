-- ============================================================================
-- Agency assets: allow signature / cachet uploads
-- ============================================================================
--
-- The frontend stores visual identity assets in the public `agency-assets`
-- bucket:
--   {agency_id}/logos/logo-{timestamp}.{ext}
--   {agency_id}/signatures/signature-{timestamp}.{ext}
--
-- Keep tenant scoping strict. The first folder must be the authenticated
-- user's agency id, and writable folders are limited to `logos` and
-- `signatures`. Legacy logo paths are kept read/delete compatible.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agency-assets',
  'agency-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "agency_assets_logo_read" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "agency_assets_logo_insert" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "agency_assets_logo_update" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "agency_assets_logo_delete" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "agency_assets_identity_read" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "agency_assets_identity_insert" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "agency_assets_identity_update" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "agency_assets_identity_delete" ON storage.objects';

  EXECUTE $POL$
    CREATE POLICY "agency_assets_identity_read"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'agency-assets'
        AND (
          (
            (storage.foldername(name))[1] = (
              SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
            )
            AND (storage.foldername(name))[2] IN ('logos', 'signatures')
          )
          OR name LIKE 'logos/' || (
            SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
          ) || '-logo.%'
        )
      )
  $POL$;

  EXECUTE $POL$
    CREATE POLICY "agency_assets_identity_insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'agency-assets'
        AND (storage.foldername(name))[1] = (
          SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
        )
        AND (storage.foldername(name))[2] IN ('logos', 'signatures')
      )
  $POL$;

  EXECUTE $POL$
    CREATE POLICY "agency_assets_identity_update"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'agency-assets'
        AND (storage.foldername(name))[1] = (
          SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
        )
        AND (storage.foldername(name))[2] IN ('logos', 'signatures')
      )
      WITH CHECK (
        bucket_id = 'agency-assets'
        AND (storage.foldername(name))[1] = (
          SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
        )
        AND (storage.foldername(name))[2] IN ('logos', 'signatures')
      )
  $POL$;

  EXECUTE $POL$
    CREATE POLICY "agency_assets_identity_delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'agency-assets'
        AND (
          (
            (storage.foldername(name))[1] = (
              SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
            )
            AND (storage.foldername(name))[2] IN ('logos', 'signatures')
          )
          OR name LIKE 'logos/' || (
            SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
          ) || '-logo.%'
        )
      )
  $POL$;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping agency-assets identity policy update: apply these policies from Supabase Dashboard if this migration role cannot alter storage.objects.';
END $$;
