/*
  # Migration temporaire pour permettre le seed
  
  1. Problème
    - Le script de seed ne peut pas insérer dans agencies à cause des RLS
    - Besoin de permettre temporairement l'insertion pour le seed
    
  2. Solution temporaire
    - Créer une politique permissive pour permettre l'insertion
    - À SUPPRIMER après le seed
    
  3. Sécurité
    - Cette migration doit être annulée immédiatement après le seed
*/

-- Politique temporaire pour permettre le seed
CREATE POLICY "temp_allow_all_insert_agencies"
  ON agencies FOR INSERT
  WITH CHECK (true);
