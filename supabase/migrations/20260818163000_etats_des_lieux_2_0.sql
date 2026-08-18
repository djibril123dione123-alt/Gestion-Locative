/*
  # Refonte États des Lieux 2.0

  1. Modifications
    - Mise à jour de la contrainte `type` pour inclure 'intermediaire'.
    - Ajout de la colonne `cles` (JSONB) pour stocker les clés (type, quantité, observations).
    - Ajout de la colonne `parent_inventaire_id` pour gérer la comparaison (Ex: Sortie liée à une Entrée).
*/

-- 1. Mise à jour de la contrainte du type
DO $$ 
DECLARE
  constraint_name text;
BEGIN
  -- Chercher la contrainte existante sur la colonne 'type' de la table 'inventaires'
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'inventaires'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%type%';
  
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE inventaires DROP CONSTRAINT ' || constraint_name;
  END IF;
END $$;

ALTER TABLE inventaires 
ADD CONSTRAINT inventaires_type_check 
CHECK (type IN ('entree', 'sortie', 'intermediaire'));

-- 2. Ajout des nouvelles colonnes
ALTER TABLE inventaires 
ADD COLUMN IF NOT EXISTS cles jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS parent_inventaire_id uuid REFERENCES inventaires(id);

-- 3. Ajout de policy sur le bucket storage (assumant un bucket agency_assets existant)
-- Note: les règles RLS pour le bucket existant couvrent déjà les uploads de l'agence.
