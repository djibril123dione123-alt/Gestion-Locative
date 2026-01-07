/*
  # Migration Multi-Tenant - Partie 1 : Table Agencies (Version 3)

  1. Nouvelle table
    - agencies : Agences immobilières / Bailleurs individuels
  
  2. Modifications
    - user_profiles.agency_id : Lien vers l'agence
    - Tables métier.agency_id : Isolation multi-tenant
  
  3. Sécurité
    - RLS activé avec politiques par agence
*/

-- Créer table agencies SANS RLS d'abord
CREATE TABLE IF NOT EXISTS agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ninea text,
  address text,
  phone text NOT NULL,
  email text NOT NULL,
  website text,
  logo_url text,
  plan text DEFAULT 'basic' CHECK (plan IN ('basic', 'pro', 'enterprise')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
  trial_ends_at timestamptz,
  is_bailleur_account boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_agencies_status ON agencies(status);
CREATE INDEX IF NOT EXISTS idx_agencies_plan ON agencies(plan);

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_agencies_updated_at ON agencies;
CREATE TRIGGER update_agencies_updated_at
  BEFORE UPDATE ON agencies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Ajouter agency_id à user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'agency_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN agency_id uuid REFERENCES agencies(id);
    CREATE INDEX idx_user_profiles_agency_id ON user_profiles(agency_id);
  END IF;
END $$;

-- Maintenant activer RLS et créer les politiques
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

-- Politique : Users peuvent voir leur propre agence
DROP POLICY IF EXISTS "Users can view own agency" ON agencies;
CREATE POLICY "Users can view own agency"
  ON agencies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Politique : Admins peuvent mettre à jour leur agence
DROP POLICY IF EXISTS "Admins can update own agency" ON agencies;
CREATE POLICY "Admins can update own agency"
  ON agencies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Ajouter agency_id à agency_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'agency_id'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN agency_id uuid REFERENCES agencies(id);
    CREATE INDEX idx_agency_settings_agency_id ON agency_settings(agency_id);
  END IF;
END $$;

-- Ajouter agency_id à toutes les tables métier
DO $$
DECLARE
  tbl_name text;
BEGIN
  FOR tbl_name IN
    SELECT unnest(ARRAY[
      'bailleurs', 'immeubles', 'unites', 'locataires',
      'contrats', 'paiements', 'depenses', 'audit_logs'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = tbl_name
      AND column_name = 'agency_id'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN agency_id uuid REFERENCES agencies(id)', tbl_name);
      EXECUTE format('CREATE INDEX idx_%I_agency_id ON %I(agency_id)', tbl_name, tbl_name);
    END IF;
  END LOOP;
END $$;