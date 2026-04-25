-- =============================================================================
-- Nettoyage des policies INSERT sur la table `agencies`
-- =============================================================================
-- Au fil des migrations correctives (sept policies cumulées entre janvier 2026
-- et avril 2026), la table `agencies` se retrouve avec plusieurs policies
-- INSERT en doublon, dont certaines temporaires laissées en place
-- (`temp_allow_anon_insert_agencies`, `temp_allow_all_insert_agencies`).
--
-- Cette migration :
--   1. Supprime TOUTES les policies INSERT historiques connues
--   2. Crée UNE seule policy claire pour les utilisateurs authentifiés
--   3. Ajoute une policy explicite pour le rôle super_admin (bypass via Console)
-- =============================================================================

-- 1) Suppression de toutes les variantes connues
DROP POLICY IF EXISTS "Authenticated users can create agency"        ON agencies;
DROP POLICY IF EXISTS "Authenticated users can insert agency"        ON agencies;
DROP POLICY IF EXISTS "Users can create first agency"                ON agencies;
DROP POLICY IF EXISTS "Users can create their first agency"          ON agencies;
DROP POLICY IF EXISTS "Users with valid session can create agency"   ON agencies;
DROP POLICY IF EXISTS "temp_allow_anon_insert_agencies"              ON agencies;
DROP POLICY IF EXISTS "temp_allow_all_insert_agencies"               ON agencies;
DROP POLICY IF EXISTS "agencies_insert_authenticated"                ON agencies;
DROP POLICY IF EXISTS "Super admin can insert agencies"              ON agencies;

-- 2) Policy unique pour les utilisateurs authentifiés
--    (utilisée notamment lors de l'onboarding via la page Welcome)
CREATE POLICY "agencies_insert_authenticated"
  ON agencies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3) Policy explicite pour le super_admin (Console propriétaire SaaS)
CREATE POLICY "Super admin can insert agencies"
  ON agencies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- =============================================================================
-- Vérification : lister les policies INSERT actives sur agencies
-- (à exécuter manuellement dans le SQL editor pour confirmer)
-- =============================================================================
-- SELECT policyname FROM pg_policies
--  WHERE tablename = 'agencies' AND cmd = 'INSERT';
-- =============================================================================
