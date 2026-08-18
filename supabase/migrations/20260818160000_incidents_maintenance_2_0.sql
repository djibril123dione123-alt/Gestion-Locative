/*
  # Incidents & Maintenance 2.0

  1. Modifications
    - Enrichissement de la table `interventions` existante.
    - Ajout de `reference`, `locataire_id`, `bailleur_id`.
    - Ajout des dates `started_at`, `resolved_at`, `scheduled_at`.
    - Modification du type `statut` via CHECK constraint pour inclure : 
      signale, a_qualifier, planifie, devis_a_valider, autorise, en_cours, resolu, annule.
    - Ajout des champs de validation bailleur (`approval_required`, `approval_status`, `approved_by`, `approved_at`).
    - Ajout de `approved_cost`, `devis_url`, `facture_url`.
    - Lien vers dépense: ajout de `intervention_id` dans `depenses`.
*/

-- 1. Ajout des colonnes à `interventions`
ALTER TABLE interventions 
ADD COLUMN IF NOT EXISTS reference text,
ADD COLUMN IF NOT EXISTS locataire_id uuid REFERENCES locataires(id),
ADD COLUMN IF NOT EXISTS bailleur_id uuid REFERENCES bailleurs(id),
ADD COLUMN IF NOT EXISTS started_at timestamptz,
ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
ADD COLUMN IF NOT EXISTS prestataire_email text,
ADD COLUMN IF NOT EXISTS prestataire_metier text,
ADD COLUMN IF NOT EXISTS approval_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS approved_cost decimal(10,2),
ADD COLUMN IF NOT EXISTS devis_url text,
ADD COLUMN IF NOT EXISTS facture_url text;

-- 2. Génération automatique des références pour les interventions existantes
UPDATE interventions 
SET reference = 'INC-' || to_char(created_at, 'YYYYMMDD') || '-' || substring(id::text from 1 for 4)
WHERE reference IS NULL;

-- 3. Mise à jour de la contrainte du statut
-- D'abord supprimer l'ancienne contrainte (le nom peut varier, on va la chercher et la supprimer dynamiquement ou dropper via le nom par defaut).
DO $$ 
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'interventions'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%statut%';
  
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE interventions DROP CONSTRAINT ' || constraint_name;
  END IF;
END $$;

-- Mise à jour des anciennes valeurs vers les nouvelles
UPDATE interventions SET statut = 'signale' WHERE statut = 'a_faire';
UPDATE interventions SET statut = 'resolu', resolved_at = COALESCE(date_fin::timestamptz, updated_at) WHERE statut = 'termine';
UPDATE interventions SET statut = 'en_cours', started_at = COALESCE(date_intervention::timestamptz, updated_at) WHERE statut = 'en_cours';

-- Ajouter la nouvelle contrainte
ALTER TABLE interventions 
ADD CONSTRAINT interventions_statut_check 
CHECK (statut IN ('signale', 'a_qualifier', 'planifie', 'devis_a_valider', 'autorise', 'en_cours', 'resolu', 'annule'));

-- 4. Ajout du lien vers l'intervention dans `depenses`
ALTER TABLE depenses 
ADD COLUMN IF NOT EXISTS intervention_id uuid REFERENCES interventions(id);
