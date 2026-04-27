-- =====================================================
-- Correctifs des warnings de sécurité Supabase Advisor
-- =====================================================
--
-- Ce fichier traite trois familles de warnings :
--   1. function_search_path_mutable (11 fonctions)
--   2. rls_policy_always_true (2 policies INSERT trop permissives)
--   3. public_bucket_allows_listing (`agency-assets`)
--
-- IDEMPOTENT : tout est enrobé dans `DROP ... IF EXISTS` ou des
-- DO + EXCEPTION blocks pour pouvoir être ré-exécuté sans erreur,
-- notamment quand le rôle courant n'a pas les droits sur
-- `storage.objects` (propriété de `supabase_storage_admin`).
-- =====================================================


-- =====================================================
-- 1) FUNCTION SEARCH_PATH MUTABLE
-- =====================================================
-- ALTER FUNCTION fige `search_path = public, pg_temp` pour empêcher
-- les attaques par schema hijacking. Enrobé dans DO + EXCEPTION pour
-- ignorer une fonction absente (cas migration partielle).

DO $$
BEGIN
  ALTER FUNCTION public.create_admin_profile(uuid, text, text, text, text)
    SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.create_agent_profile(uuid, text, text, text, text)
    SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.touch_agency_request_updated_at()
    SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.log_table_changes()
    SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.create_notification(uuid, uuid, text, text, text, text)
    SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.cleanup_expired_invitations()
    SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.update_updated_at_column()
    SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.get_user_role()
    SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.is_admin()
    SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.is_agent_or_admin()
    SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.get_user_bailleur_id()
    SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;


-- =====================================================
-- 2) RLS POLICY ALWAYS TRUE
-- =====================================================
-- Drop des deux policies INSERT permissives `WITH CHECK (true)` héritées
-- du seed Supabase Studio. Les inserts légitimes passent par les RPC
-- SECURITY DEFINER ou par les triggers internes.

DROP POLICY IF EXISTS "Enable insert for authenticated users only"
  ON public.agency_settings;

DROP POLICY IF EXISTS "Authenticated users can insert audit logs"
  ON public.audit_logs;


-- =====================================================
-- 3) PUBLIC BUCKET ALLOWS LISTING (agency-assets)
-- =====================================================
-- Remplace la SELECT policy `USING (bucket_id = ...)` (qui autorise un
-- LIST root énumérant TOUS les fichiers de TOUTES les agences) par une
-- policy tenant-scoped pour les utilisateurs authentifiés.
-- Le bucket reste `public = true` donc les URLs anon connues
-- (`getPublicUrl(...)` côté front) continuent de servir les logos
-- d'agence. Seule l'opération LIST côté API est restreinte.
--
-- Enrobé dans DO + EXCEPTION car `storage.objects` appartient à
-- `supabase_storage_admin` sur certains projets : si le rôle courant
-- n'a pas les droits, on émet un NOTICE et la policy doit être
-- ajustée manuellement via Supabase Dashboard → Storage → Policies.

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Public read access for agency assets" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "agency_assets_authenticated_read" ON storage.objects';
  EXECUTE $POL$
    CREATE POLICY "agency_assets_authenticated_read"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'agency-assets'
        AND (storage.foldername(name))[1] = (
          SELECT agency_id::text
          FROM public.user_profiles
          WHERE id = auth.uid()
        )
      )
  $POL$;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage.objects policy update: insufficient_privilege. Apply via Supabase Dashboard → Storage → Policies → bucket "agency-assets".';
END $$;


-- =====================================================
-- NOTE : auth_leaked_password_protection
-- =====================================================
-- Action manuelle obligatoire : Supabase Dashboard
--   → Authentication → Settings → activer "Leaked password protection"
-- (vérifie les mots de passe contre HaveIBeenPwned.org).
-- Aucune migration SQL ne peut activer ce paramètre.
-- =====================================================
