/*
  # Ajouter les champs pour le manager et la ville de l'agence
  
  1. Nouveaux champs
    - manager_id_type: Type de pièce d'identité du manager (CNI, Passeport)
    - manager_id_number: Numéro de la pièce d'identité du manager
    - city: Ville où se trouve l'agence (par défaut: Dakar)
    
  2. Objectif
    - Supprimer toutes les valeurs en dur dans les templates
    - Permettre la personnalisation complète du représentant de l'agence
    - Rendre la ville paramétrable pour les agences hors Dakar
*/

-- Ajouter les nouveaux champs à agency_settings
DO $$
BEGIN
  -- Type de pièce d'identité du manager
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'manager_id_type'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN manager_id_type text DEFAULT 'CNI';
  END IF;

  -- Numéro de pièce d'identité du manager
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'manager_id_number'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN manager_id_number text;
  END IF;

  -- Ville de l'agence
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'city'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN city text DEFAULT 'Dakar';
  END IF;
END $$;

-- Créer un commentaire sur les nouveaux champs
COMMENT ON COLUMN agency_settings.manager_id_type IS 'Type de pièce d''identité du représentant (CNI, Passeport, etc.)';
COMMENT ON COLUMN agency_settings.manager_id_number IS 'Numéro de la pièce d''identité du représentant';
COMMENT ON COLUMN agency_settings.city IS 'Ville où se trouve l''agence (utilisé dans les documents)';
