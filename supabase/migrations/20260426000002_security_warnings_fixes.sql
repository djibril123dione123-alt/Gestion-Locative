-- =====================================================
-- Correctifs des warnings de sécurité Supabase Advisor
-- =====================================================
--
-- Ce fichier traite trois familles de warnings remontés par
-- l'advisor Supabase :
--
--   1. function_search_path_mutable (11 fonctions)
--      → fixe `search_path = public, pg_temp` sur chaque fonction
--        pour éviter les attaques par schema hijacking.
--
--   2. rls_policy_always_true (2 policies)
--      → supprime les policies INSERT trop permissives
--        (`WITH CHECK (true)`) sur `agency_settings` et `audit_logs`.
--        Les inserts légitimes passent désormais par les RPC
--        SECURITY DEFINER ou par les triggers internes.
--
--   3. public_bucket_allows_listing (`agency-assets`)
--      → restreint la SELECT policy pour empêcher l'énumération
--        des fichiers tout en conservant l'accès public aux URLs
--        connues (logos d'agence rendus en `<img src=...>`).
-- =====================================================


-- =====================================================
-- 1) FUNCTION SEARCH_PATH MUTABLE
-- =====================================================
-- ALTER FUNCTION ne nécessite pas de redéfinir le corps : on
-- fige juste le search_path. `pg_temp` est ajouté en dernier pour
-- pouvoir continuer à utiliser des tables temporaires sans risque.

ALTER FUNCTION public.create_admin_profile(uuid, text, text, text, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.create_agent_profile(uuid, text, text, text, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.touch_agency_request_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.log_table_changes()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.create_notification(uuid, uuid, text, text, text, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.cleanup_expired_invitations()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_user_role()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.is_admin()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.is_agent_or_admin()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_user_bailleur_id()
  SET search_path = public, pg_temp;


-- =====================================================
-- 2) RLS POLICY ALWAYS TRUE
-- =====================================================
-- Ces deux policies datent de l'amorçage initial (Supabase Studio
-- crée par défaut "Enable insert for authenticated users only" avec
-- WITH CHECK (true) lorsque l'on active RLS via l'UI). Elles sont
-- redondantes avec les policies tenant-aware ajoutées ensuite et
-- constituent une porte ouverte.

-- agency_settings : un INSERT direct n'est plus jamais légitime ;
-- le seed est fait par la RPC `approve_agency_request` (SECURITY
-- DEFINER) qui bypass RLS.
DROP POLICY IF EXISTS "Enable insert for authenticated users only"
  ON public.agency_settings;

-- audit_logs : seuls les triggers SECURITY DEFINER peuvent insérer.
-- Aucun INSERT applicatif ne doit être autorisé pour les utilisateurs.
DROP POLICY IF EXISTS "Authenticated users can insert audit logs"
  ON public.audit_logs;


-- =====================================================
-- 3) PUBLIC BUCKET ALLOWS LISTING (agency-assets)
-- =====================================================
-- Le bucket reste public pour permettre l'affichage anonyme des
-- logos via des URLs déjà connues (`getPublicUrl(...)` côté front).
-- En revanche on supprime la policy `USING (bucket_id = '...')`
-- (qui autorise un LIST root et énumère tous les fichiers) au
-- profit d'une policy qui exige soit :
--   - une lecture authentifiée tenant-scoped (admin, comptable, agent
--     de l'agence propriétaire),
--   - soit la connaissance de la clé exacte (anon : accès direct via
--     URL publique car le bucket est `public = true`, mais aucun LIST
--     possible puisque la policy ne matche pas sur LIST anon).

DROP POLICY IF EXISTS "Public read access for agency assets"
  ON storage.objects;

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
  );

COMMENT ON POLICY "agency_assets_authenticated_read" ON storage.objects IS
  'Lecture des assets restreinte au tenant. L''affichage public anonyme reste possible via URL exacte (bucket public=true) mais l''énumération via LIST n''est plus autorisée.';


-- =====================================================
-- NOTE : auth_leaked_password_protection
-- =====================================================
-- Ce paramètre se règle uniquement depuis le dashboard Supabase
-- (Auth → Policies → "Leaked password protection"). Aucune
-- migration SQL ne peut l'activer. Action manuelle à faire :
--   Supabase Dashboard → Authentication → Settings → activer
--   "Leaked password protection" (vérifie les mots de passe
--   contre HaveIBeenPwned.org au signup et au reset).
-- =====================================================
