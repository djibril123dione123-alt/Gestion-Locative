-- ============================================================================
-- Fix Storage policies for agency logo uploads
-- ============================================================================
--
-- The frontend stores logos under:
--   {agency_id}/logos/logo-{timestamp}.{ext}
--
-- Supabase Storage upsert/replacement flows need SELECT + INSERT + UPDATE.
-- We keep direct public serving available through the public bucket, but API
-- listing and write operations are tenant-scoped.

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
  EXECUTE 'DROP POLICY IF EXISTS "Public read access for agency assets" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "agency_assets_authenticated_read" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Agency admins can upload assets" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Agency admins can update their assets" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Agency admins can delete their assets" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "agency_assets_logo_read" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "agency_assets_logo_insert" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "agency_assets_logo_update" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "agency_assets_logo_delete" ON storage.objects';

  EXECUTE $POL$
    CREATE POLICY "agency_assets_logo_read"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'agency-assets'
        AND (
          (storage.foldername(name))[1] = (
            SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
          )
          OR name LIKE 'logos/' || (
            SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
          ) || '-logo.%'
        )
      )
  $POL$;

  EXECUTE $POL$
    CREATE POLICY "agency_assets_logo_insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'agency-assets'
        AND (storage.foldername(name))[1] = (
          SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
        )
        AND (storage.foldername(name))[2] = 'logos'
      )
  $POL$;

  EXECUTE $POL$
    CREATE POLICY "agency_assets_logo_update"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'agency-assets'
        AND (storage.foldername(name))[1] = (
          SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
        )
        AND (storage.foldername(name))[2] = 'logos'
      )
      WITH CHECK (
        bucket_id = 'agency-assets'
        AND (storage.foldername(name))[1] = (
          SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
        )
        AND (storage.foldername(name))[2] = 'logos'
      )
  $POL$;

  EXECUTE $POL$
    CREATE POLICY "agency_assets_logo_delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'agency-assets'
        AND (
          (
            (storage.foldername(name))[1] = (
              SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
            )
            AND (storage.foldername(name))[2] = 'logos'
          )
          OR name LIKE 'logos/' || (
            SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
          ) || '-logo.%'
        )
      )
  $POL$;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping agency-assets storage policy update: apply these policies from Supabase Dashboard if this migration role cannot alter storage.objects.';
END $$;
