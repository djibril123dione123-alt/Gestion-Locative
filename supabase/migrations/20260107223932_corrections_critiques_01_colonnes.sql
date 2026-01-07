/*
  # Migrations critiques - Partie 1 : Colonnes manquantes

  1. Ajout colonnes
    - bailleurs.commission (taux de commission par bailleur)
    - bailleurs.debut_contrat (date début mandat)
    - contrats.destination (Habitation/Commercial)
  
  2. Renommage
    - contrats.pourcentage_agence → commission
  
  3. Sécurité
    - Contraintes CHECK pour validation
*/

-- Ajouter colonne commission aux bailleurs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bailleurs' AND column_name = 'commission'
  ) THEN
    ALTER TABLE bailleurs ADD COLUMN commission decimal(5,2) DEFAULT 10.00;
  END IF;
END $$;

-- Ajouter colonne debut_contrat aux bailleurs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bailleurs' AND column_name = 'debut_contrat'
  ) THEN
    ALTER TABLE bailleurs ADD COLUMN debut_contrat date;
  END IF;
END $$;

-- Ajouter colonne destination aux contrats
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contrats' AND column_name = 'destination'
  ) THEN
    ALTER TABLE contrats ADD COLUMN destination text DEFAULT 'Habitation';
  END IF;
END $$;

-- Renommer pourcentage_agence en commission (si elle existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contrats' AND column_name = 'pourcentage_agence'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contrats' AND column_name = 'commission'
  ) THEN
    ALTER TABLE contrats RENAME COLUMN pourcentage_agence TO commission;
  END IF;
END $$;

-- Contraintes de validation
ALTER TABLE bailleurs DROP CONSTRAINT IF EXISTS check_commission_valide;
ALTER TABLE bailleurs ADD CONSTRAINT check_commission_valide
  CHECK (commission IS NULL OR (commission >= 0 AND commission <= 100));

ALTER TABLE contrats DROP CONSTRAINT IF EXISTS check_destination_valide;
ALTER TABLE contrats ADD CONSTRAINT check_destination_valide
  CHECK (destination IN ('Habitation', 'Commercial', 'Mixte'));

ALTER TABLE contrats DROP CONSTRAINT IF EXISTS check_loyer_positif;
ALTER TABLE contrats ADD CONSTRAINT check_loyer_positif
  CHECK (loyer_mensuel > 0);

ALTER TABLE contrats DROP CONSTRAINT IF EXISTS check_commission_contrat_valide;
ALTER TABLE contrats ADD CONSTRAINT check_commission_contrat_valide
  CHECK (commission IS NULL OR (commission >= 0 AND commission <= 100));

ALTER TABLE contrats DROP CONSTRAINT IF EXISTS check_dates_coherentes;
ALTER TABLE contrats ADD CONSTRAINT check_dates_coherentes
  CHECK (date_fin IS NULL OR date_fin > date_debut);

ALTER TABLE paiements DROP CONSTRAINT IF EXISTS check_montants_positifs;
ALTER TABLE paiements ADD CONSTRAINT check_montants_positifs
  CHECK (montant_total > 0 AND part_agence >= 0 AND part_bailleur >= 0);

ALTER TABLE paiements DROP CONSTRAINT IF EXISTS check_parts_coherentes;
ALTER TABLE paiements ADD CONSTRAINT check_parts_coherentes
  CHECK (abs((part_agence + part_bailleur) - montant_total) < 0.01);

ALTER TABLE depenses DROP CONSTRAINT IF EXISTS check_depense_positive;
ALTER TABLE depenses ADD CONSTRAINT check_depense_positive
  CHECK (montant > 0);

ALTER TABLE unites DROP CONSTRAINT IF EXISTS check_loyer_base_positif;
ALTER TABLE unites ADD CONSTRAINT check_loyer_base_positif
  CHECK (loyer_base > 0);