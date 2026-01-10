/*
  # Correction Policy INSERT pour Agencies

  1. Problème identifié
    - Les utilisateurs authentifiés ne peuvent pas créer d'agence (erreur RLS)
    - Il manque une policy INSERT sur la table agencies
  
  2. Solution
    - Ajouter une policy INSERT pour les utilisateurs authentifiés sans agency_id
    - Permet la création d'une agence lors du premier onboarding
  
  3. Sécurité
    - Seuls les utilisateurs authentifiés SANS agency_id peuvent insérer
    - Une fois l'agence créée, l'agency_id est ajouté au profil
    - Empêche la création de multiples agences par le même utilisateur
*/

-- Policy : Authenticated users sans agency_id peuvent créer UNE agence
DROP POLICY IF EXISTS "Users can create their first agency" ON agencies;
CREATE POLICY "Users can create their first agency"
  ON agencies FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND agency_id IS NOT NULL
    )
  );
