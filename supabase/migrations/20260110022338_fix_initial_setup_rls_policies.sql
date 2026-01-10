/*
  # Correction des policies RLS pour le setup initial d'agence

  1. Problème
    - Les policies INSERT sur agency_settings et subscriptions vérifient user_profiles.agency_id
    - Mais lors du premier setup, l'UPDATE du user_profile n'est pas encore visible par ces policies
    - Cela bloque la création complète d'une nouvelle agence
  
  2. Solution
    - Simplifier la policy agency_settings : autoriser INSERT si aucun settings existe pour cette agency_id
    - Simplifier la policy subscriptions : autoriser INSERT si aucune subscription existe pour cette agency_id
    - Ces checks empêchent les doublons tout en permettant le premier insert
  
  3. Sécurité
    - Les utilisateurs authentifiés peuvent créer des settings/subscriptions
    - La contrainte de non-duplication est maintenue
    - Les SELECT/UPDATE/DELETE restent protégés par les policies existantes
*/

-- Supprimer les policies INSERT complexes existantes
DROP POLICY IF EXISTS "Users can insert own agency settings" ON agency_settings;
DROP POLICY IF EXISTS "Users can create own subscription" ON subscriptions;

-- Nouvelle policy simplifiée pour agency_settings
CREATE POLICY "Authenticated users can insert agency settings"
  ON agency_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 
      FROM agency_settings existing 
      WHERE existing.agency_id = agency_settings.agency_id
    )
  );

-- Nouvelle policy simplifiée pour subscriptions
CREATE POLICY "Authenticated users can insert subscription"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 
      FROM subscriptions existing 
      WHERE existing.agency_id = subscriptions.agency_id
    )
  );
