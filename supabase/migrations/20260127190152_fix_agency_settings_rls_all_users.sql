/*
  # Correction RLS agency_settings - Autoriser tous les utilisateurs
  
  1. Problème identifié
    - Seuls les admins peuvent UPDATE agency_settings
    - Les agents/comptables ne peuvent pas sauvegarder leurs paramètres
  
  2. Solution
    - Permettre à TOUS les users authentifiés de leur agence de modifier les paramètres
    - Garder la restriction par agency_id pour la sécurité multi-tenant
  
  3. Sécurité maintenue
    - Users ne peuvent modifier que les paramètres de leur propre agence
    - La vérification agency_id reste en place
*/

-- Supprimer l'ancienne politique UPDATE restrictive
DROP POLICY IF EXISTS "Admins can update own agency settings" ON agency_settings;

-- Créer une nouvelle politique UPDATE pour tous les users authentifiés
CREATE POLICY "Users can update own agency settings"
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

-- Vérifier que la politique SELECT existe toujours
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agency_settings' 
    AND policyname = 'Users can view own agency settings'
  ) THEN
    CREATE POLICY "Users can view own agency settings"
      ON agency_settings FOR SELECT
      TO authenticated
      USING (
        agency_id IN (
          SELECT agency_id FROM user_profiles
          WHERE id = auth.uid()
        )
      );
  END IF;
END $$;
