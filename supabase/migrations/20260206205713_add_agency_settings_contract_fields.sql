/*
  # Ajouter les champs de personnalisation des contrats et mandats
  
  1. Nouveaux champs
    - rc : Registre de commerce
    - representant_nom : Nom complet du représentant
    - representant_fonction : Fonction (Gérant, Directeur, etc.)
    - manager_id_type : Type de pièce d'identité (CNI, Passeport)
    - manager_id_number : Numéro de la pièce
    - city : Ville de l'agence
    - mention_tribunal : Texte personnalisé pour la mention du tribunal
    - mention_penalites : Texte personnalisé pour les pénalités de retard
    - frais_huissier : Montant des frais d'huissier
    - loyer_lettres_template : Template pour loyer en lettres
    - depot_lettres_template : Template pour dépôt en lettres
  
  2. Valeurs par défaut
    - Textes standards pour tribunal et pénalités
    - Montants par défaut cohérents
*/

-- Ajouter les champs manquants
DO $$
BEGIN
  -- RC (Registre de Commerce)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'rc'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN rc text;
  END IF;

  -- Représentant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'representant_nom'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN representant_nom text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'representant_fonction'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN representant_fonction text DEFAULT 'Gérant';
  END IF;

  -- Manager ID
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'manager_id_type'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN manager_id_type text DEFAULT 'CNI';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'manager_id_number'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN manager_id_number text;
  END IF;

  -- Ville
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'city'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN city text DEFAULT 'Dakar';
  END IF;

  -- Mentions personnalisables
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'mention_tribunal'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN mention_tribunal text 
    DEFAULT 'Avec attribution exclusive de juridiction au juge des référés du Tribunal de Dakar.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'mention_penalites'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN mention_penalites text 
    DEFAULT 'Il est expressément convenu qu''à défaut de paiement d''un mois de loyer dans les délais impartis (au plus tard le 07 du mois en cours) des pénalités seront appliquées. Passé ce délai, la procédure judiciaire sera enclenchée.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'frais_huissier'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN frais_huissier numeric DEFAULT 37500.00;
  END IF;

  -- Templates pour conversion en lettres (optionnel)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'mention_frais_huissier'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN mention_frais_huissier text 
    DEFAULT 'En cas de non-paiement du loyer dans les délais impartis, une somme est prélevée sur la caution pour les frais d''huissier afin d''assignation en expulsion, conformément à la loi sénégalaise.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'mention_litige'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN mention_litige text 
    DEFAULT 'Il est expressément convenu qu''en cas de litige, les frais d''huissier, d''expertises et d''honoraires d''avocat, qui auraient été engagés par le bailleur et ce sur pièces justificatives, seront remboursés par le locataire.';
  END IF;

END $$;