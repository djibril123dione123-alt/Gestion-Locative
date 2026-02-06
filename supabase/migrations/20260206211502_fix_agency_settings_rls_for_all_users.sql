/*
  # Correction définitive RLS agency_settings - Autoriser TOUS les utilisateurs
  
  1. Problème
    - La politique UPDATE "Admins can update own agency settings" bloque les non-admins
    - Les agents et comptables ne peuvent pas sauvegarder les paramètres
    - L'upsert échoue silencieusement côté frontend
  
  2. Solution
    - Supprimer toutes les anciennes politiques UPDATE restrictives
    - Créer une politique UPDATE permettant à TOUS les users de leur agence
    - Vérifier la politique INSERT pour l'upsert initial
  
  3. Sécurité maintenue
    - Restriction par agency_id (multi-tenant)
    - Seuls les users de l'agence peuvent modifier leurs paramètres
*/

-- 1. Supprimer TOUTES les anciennes politiques UPDATE restrictives
DROP POLICY IF EXISTS "Admins can update agency settings" ON agency_settings;
DROP POLICY IF EXISTS "Admins can update own agency settings" ON agency_settings;
DROP POLICY IF EXISTS "Users can update own agency settings" ON agency_settings;

-- 2. Créer la nouvelle politique UPDATE pour TOUS les utilisateurs authentifiés de l'agence
CREATE POLICY "All agency users can update settings"
  ON agency_settings FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- 3. Vérifier et corriger la politique SELECT
DROP POLICY IF EXISTS "Authenticated users can view agency settings" ON agency_settings;
DROP POLICY IF EXISTS "Users can view own agency settings" ON agency_settings;

CREATE POLICY "All agency users can view settings"
  ON agency_settings FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- 4. Vérifier et corriger la politique INSERT pour l'upsert initial
DROP POLICY IF EXISTS "Authenticated users can insert agency settings" ON agency_settings;

CREATE POLICY "All agency users can insert settings"
  ON agency_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- 5. Vérifier que RLS est bien activé
ALTER TABLE agency_settings ENABLE ROW LEVEL SECURITY;