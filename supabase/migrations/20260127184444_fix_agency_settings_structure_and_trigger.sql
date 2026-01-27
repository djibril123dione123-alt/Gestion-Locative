/*
  # Corriger la structure de agency_settings et créer le trigger
  
  1. Modifications de structure
    - Changer la PRIMARY KEY de `id` vers `agency_id`
    - Supprimer l'ancien système avec id='default'
  
  2. Trigger
    - Créer automatiquement agency_settings lors de la création d'une agence
  
  3. Sécurité
    - Mettre à jour les politiques RLS pour utiliser agency_id
*/

-- Étape 1: Sauvegarder les paramètres existants s'il y en a
DO $$
DECLARE
  default_settings RECORD;
  first_agency_id uuid;
BEGIN
  -- Vérifier s'il existe un enregistrement avec id='default'
  SELECT * INTO default_settings FROM agency_settings WHERE id = 'default';
  
  IF FOUND THEN
    -- Trouver la première agence
    SELECT id INTO first_agency_id FROM agencies LIMIT 1;
    
    IF first_agency_id IS NOT NULL THEN
      -- Si l'agence n'a pas déjà de paramètres, copier ceux par défaut
      IF NOT EXISTS (SELECT 1 FROM agency_settings WHERE agency_id = first_agency_id) THEN
        UPDATE agency_settings 
        SET agency_id = first_agency_id
        WHERE id = 'default';
      ELSE
        -- Sinon, supprimer l'enregistrement par défaut
        DELETE FROM agency_settings WHERE id = 'default';
      END IF;
    ELSE
      -- Pas d'agence, supprimer l'enregistrement par défaut
      DELETE FROM agency_settings WHERE id = 'default';
    END IF;
  END IF;
END $$;

-- Étape 2: Supprimer l'ancienne PRIMARY KEY et créer la nouvelle
ALTER TABLE agency_settings DROP CONSTRAINT IF EXISTS agency_settings_pkey;

-- Rendre agency_id NOT NULL et PRIMARY KEY
ALTER TABLE agency_settings ALTER COLUMN agency_id SET NOT NULL;
ALTER TABLE agency_settings ADD PRIMARY KEY (agency_id);

-- Supprimer l'ancienne colonne id si elle existe encore
ALTER TABLE agency_settings DROP COLUMN IF EXISTS id CASCADE;

-- Étape 3: Recréer les politiques RLS avec la nouvelle structure
DROP POLICY IF EXISTS "Authenticated users can view agency settings" ON agency_settings;
DROP POLICY IF EXISTS "Admins can update agency settings" ON agency_settings;
DROP POLICY IF EXISTS "Users can view own agency settings" ON agency_settings;
DROP POLICY IF EXISTS "Admins can update own agency settings" ON agency_settings;
DROP POLICY IF EXISTS "Authenticated users can insert agency settings" ON agency_settings;

-- Users peuvent voir les paramètres de leur agence
CREATE POLICY "Users can view own agency settings"
  ON agency_settings FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Admins peuvent modifier les paramètres de leur agence
CREATE POLICY "Admins can update own agency settings"
  ON agency_settings FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Permettre l'insertion automatique via trigger (SECURITY DEFINER)
CREATE POLICY "Authenticated users can insert agency settings"
  ON agency_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Empêcher les doublons
    NOT EXISTS (
      SELECT 1 FROM agency_settings existing
      WHERE existing.agency_id = agency_settings.agency_id
    )
  );

-- Étape 4: Créer la fonction trigger
CREATE OR REPLACE FUNCTION create_agency_settings_on_agency_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Créer les paramètres par défaut pour la nouvelle agence
  INSERT INTO agency_settings (
    agency_id,
    nom_agence,
    adresse,
    telephone,
    email,
    couleur_primaire,
    devise,
    representant_fonction,
    manager_id_type,
    city,
    commission_globale,
    penalite_retard_montant,
    penalite_retard_delai_jours,
    pied_page_personnalise,
    qr_code_quittances,
    module_depenses_actif
  ) VALUES (
    NEW.id,
    NEW.name,
    NEW.address,
    NEW.phone,
    NEW.email,
    '#F58220',
    'XOF',
    'Gérant',
    'CNI',
    'Dakar',
    10.00,
    1000.00,
    3,
    NEW.name || ' - ' || COALESCE(NEW.address, 'Sénégal'),
    true,
    true
  );
  
  RETURN NEW;
END;
$$;

-- Créer le trigger
DROP TRIGGER IF EXISTS create_agency_settings_on_insert ON agencies;
CREATE TRIGGER create_agency_settings_on_insert
  AFTER INSERT ON agencies
  FOR EACH ROW
  EXECUTE FUNCTION create_agency_settings_on_agency_insert();

-- Étape 5: Créer agency_settings pour les agences existantes qui n'en ont pas
INSERT INTO agency_settings (
  agency_id,
  nom_agence,
  adresse,
  telephone,
  email,
  couleur_primaire,
  devise,
  representant_fonction,
  manager_id_type,
  city
)
SELECT 
  a.id,
  a.name,
  a.address,
  a.phone,
  a.email,
  '#F58220',
  'XOF',
  'Gérant',
  'CNI',
  'Dakar'
FROM agencies a
WHERE NOT EXISTS (SELECT 1 FROM agency_settings s WHERE s.agency_id = a.id);
