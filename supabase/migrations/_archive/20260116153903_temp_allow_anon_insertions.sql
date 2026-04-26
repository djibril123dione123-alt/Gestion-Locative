/*
  # Permettre au role anon d'insérer temporairement
  
  1. Problème
    - Le script de seed utilise ANON_KEY sans authentification
    - Il a donc le role anon, pas authenticated ni public
    
  2. Solution
    - Créer une politique pour le role anon
    - À SUPPRIMER après le seed
*/

-- Politique temporaire pour le role anon
CREATE POLICY "temp_allow_anon_insert_agencies"
  ON agencies FOR INSERT
  TO anon
  WITH CHECK (true);
