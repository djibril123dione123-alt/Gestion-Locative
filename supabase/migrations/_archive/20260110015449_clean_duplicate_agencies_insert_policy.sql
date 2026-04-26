/*
  # Nettoyage des policies INSERT dupliquées sur agencies

  1. Problème
    - Deux policies INSERT existent : "Users can create first agency" et "Users can create their first agency"
    - La première a une condition OR incorrecte qui bloque les inserts
  
  2. Solution
    - Supprimer les deux policies
    - Créer UNE seule policy claire et fonctionnelle
  
  3. Sécurité
    - Les utilisateurs authentifiés peuvent créer une agence
    - La contrainte "première agence uniquement" sera gérée au niveau applicatif
*/

-- Supprimer les policies dupliquées
DROP POLICY IF EXISTS "Users can create first agency" ON agencies;
DROP POLICY IF EXISTS "Users can create their first agency" ON agencies;

-- Créer UNE seule policy INSERT claire
CREATE POLICY "Authenticated users can insert agency"
  ON agencies FOR INSERT
  TO authenticated
  WITH CHECK (true);
