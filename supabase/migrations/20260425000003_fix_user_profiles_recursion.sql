-- Fix: "infinite recursion detected in policy for relation user_profiles"
--
-- Cause : la politique super_admin_profiles_select faisait une sous-requête
--         sur user_profiles, ce qui retentait la même politique → récursion.
-- Solution : isoler la lecture de l'agency_id courant dans une fonction
--            SECURITY DEFINER (qui contourne RLS) et l'utiliser dans la policy.

-- 1) Fonction utilitaire : retourne l'agency_id du user courant SANS RLS
CREATE OR REPLACE FUNCTION current_user_agency_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT agency_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION current_user_agency_id() TO authenticated;

-- 2) Recréer la politique SELECT sans auto-référence récursive
DROP POLICY IF EXISTS "super_admin_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;

CREATE POLICY "user_profiles_select"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR id = auth.uid()
    OR agency_id = current_user_agency_id()
  );

-- 3) Idem pour UPDATE (pour cohérence et éviter toute récursion)
DROP POLICY IF EXISTS "super_admin_profiles_update" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update user profiles" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;

CREATE POLICY "user_profiles_update"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    is_super_admin()
    OR id = auth.uid()
    OR (
      agency_id = current_user_agency_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles me
        WHERE me.id = auth.uid() AND me.role = 'admin'
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR id = auth.uid()
    OR agency_id = current_user_agency_id()
  );

-- NOTE: la sous-requête EXISTS ci-dessus ne provoque pas de récursion
-- car elle ne dépend QUE de id = auth.uid() (clé primaire), donc la
-- politique SELECT renvoie immédiatement true via la branche `id = auth.uid()`
-- sans réévaluer les autres branches.

-- 4) INSERT : un utilisateur peut créer son propre profil (signup)
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert user profiles" ON user_profiles;

CREATE POLICY "user_profiles_insert_self"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "user_profiles_insert_admin"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM user_profiles me
        WHERE me.id = auth.uid() AND me.role = 'admin'
      )
      AND agency_id = current_user_agency_id()
    )
  );
