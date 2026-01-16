/*
  # Ajouter les champs pour la personnalisation des documents
  
  1. Nouveaux champs
    - rc: Registre de commerce de l'agence
    - site_web: Site web de l'agence
    - representant_nom: Nom du représentant légal
    - representant_fonction: Fonction du représentant (ex: Gérant, Directeur)
    - mention_tribunal: Mention du tribunal compétent
    - mention_penalites: Texte standard des pénalités de retard
    - mention_pied_page: Texte de bas de page pour les documents
    - couleur_secondaire: Couleur secondaire pour les documents
    - logo_position: Position du logo (left, center, right)
    
  2. Objectif
    - Permettre la personnalisation complète des documents (contrats, mandats, factures)
    - Uniformiser les mentions légales entre tous les documents
    - Centraliser les paramètres dans la page Paramètres/Agence
*/

-- Ajouter les nouveaux champs à agency_settings
DO $$
BEGIN
  -- RC (Registre de commerce)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'rc'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN rc text;
  END IF;

  -- Site web
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'site_web'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN site_web text;
  END IF;

  -- Représentant nom
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'representant_nom'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN representant_nom text;
  END IF;

  -- Représentant fonction
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'representant_fonction'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN representant_fonction text DEFAULT 'Gérant';
  END IF;

  -- Mention tribunal
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'mention_tribunal'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN mention_tribunal text DEFAULT 'Tribunal de commerce de Dakar';
  END IF;

  -- Mention pénalités
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'mention_penalites'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN mention_penalites text DEFAULT 'À défaut de paiement d''un mois de loyer dans les délais impartis (au plus tard le 07 du mois en cours), des pénalités qui s''élèvent à 1000 FCFA par jour de retard seront appliquées pendant 03 jours. Passé ce délai, la procédure judiciaire sera enclenchée.';
  END IF;

  -- Mention pied de page (on garde l'existant pied_page_personnalise)
  
  -- Couleur secondaire
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'couleur_secondaire'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN couleur_secondaire text DEFAULT '#333333';
  END IF;

  -- Position du logo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'logo_position'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN logo_position text DEFAULT 'left';
  END IF;

  -- Frais huissier par défaut
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'frais_huissier'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN frais_huissier numeric DEFAULT 37500;
  END IF;
END $$;

-- Créer un commentaire sur la table
COMMENT ON TABLE agency_settings IS 'Paramètres de personnalisation pour chaque agence incluant logo, coordonnées, mentions légales et modèles de documents';
