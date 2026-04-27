-- =============================================================================
-- Création du bucket storage `agency-assets` (logos d'agence)
-- =============================================================================
--
-- IDEMPOTENT : ce fichier peut être ré-exécuté sans erreur.
--   - `INSERT ... ON CONFLICT DO NOTHING` pour le bucket
--   - `DROP POLICY IF EXISTS` + `CREATE POLICY` enrobés dans un DO
--     qui ignore l'erreur `42501 insufficient_privilege` lorsque le
--     rôle courant n'est pas propriétaire de `storage.objects`
--     (cas des projets Supabase où seuls `supabase_storage_admin`
--      ou la console peuvent toucher aux policies storage).
-- =============================================================================

-- 1. Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agency-assets',
  'agency-assets',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;


-- 2. Policies sur storage.objects
-- Enrobé dans DO + EXCEPTION : si le rôle courant n'a pas les droits
-- d'écriture sur storage.objects, on émet juste un NOTICE et on continue.
-- L'admin pourra alors créer ces policies depuis le dashboard Supabase
-- (Storage → Policies → New policy).

DO $$
BEGIN
  -- Lecture publique (logos visibles via URL anon connue ; le LIST root
  -- sera restreint par la migration 20260426000002).
  EXECUTE 'DROP POLICY IF EXISTS "Public read access for agency assets" ON storage.objects';
  EXECUTE $POL$
    CREATE POLICY "Public read access for agency assets"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'agency-assets')
  $POL$;

  -- Upload par les admins de l'agence (folder = agency_id)
  EXECUTE 'DROP POLICY IF EXISTS "Agency admins can upload assets" ON storage.objects';
  EXECUTE $POL$
    CREATE POLICY "Agency admins can upload assets"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'agency-assets'
        AND (storage.foldername(name))[1] = (
          SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
        )
      )
  $POL$;

  -- Update par les admins de l'agence
  EXECUTE 'DROP POLICY IF EXISTS "Agency admins can update their assets" ON storage.objects';
  EXECUTE $POL$
    CREATE POLICY "Agency admins can update their assets"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'agency-assets'
        AND (storage.foldername(name))[1] = (
          SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        bucket_id = 'agency-assets'
        AND (storage.foldername(name))[1] = (
          SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
        )
      )
  $POL$;

  -- Delete par les admins de l'agence
  EXECUTE 'DROP POLICY IF EXISTS "Agency admins can delete their assets" ON storage.objects';
  EXECUTE $POL$
    CREATE POLICY "Agency admins can delete their assets"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'agency-assets'
        AND (storage.foldername(name))[1] = (
          SELECT agency_id::text FROM public.user_profiles WHERE id = auth.uid()
        )
      )
  $POL$;

EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage.objects policy creation: insufficient_privilege. Apply via Supabase Dashboard → Storage → Policies.';
END $$;
