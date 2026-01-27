/*
  # Migration Multi-Tenant - Partie 3 : Documents et Inventaires

  1. Nouvelles tables
    - documents : Gestion documentaire
    - inventaires : États des lieux
  
  2. Sécurité
    - RLS activé
    - Politiques par agence et rôle
*/

-- Table documents
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  folder text,
  bailleur_id uuid REFERENCES bailleurs(id),
  immeuble_id uuid REFERENCES immeubles(id),
  unite_id uuid REFERENCES unites(id),
  contrat_id uuid REFERENCES contrats(id),
  tags text[],
  uploaded_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Politiques documents
DROP POLICY IF EXISTS "Users can view agency documents" ON documents;
CREATE POLICY "Users can view agency documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins and agents can create documents" ON documents;
CREATE POLICY "Admins and agents can create documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

DROP POLICY IF EXISTS "Admins and agents can update documents" ON documents;
CREATE POLICY "Admins and agents can update documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

DROP POLICY IF EXISTS "Admins can delete documents" ON documents;
CREATE POLICY "Admins can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Index documents
CREATE INDEX IF NOT EXISTS idx_documents_agency_id ON documents(agency_id);
CREATE INDEX IF NOT EXISTS idx_documents_bailleur_id ON documents(bailleur_id);
CREATE INDEX IF NOT EXISTS idx_documents_immeuble_id ON documents(immeuble_id);
CREATE INDEX IF NOT EXISTS idx_documents_unite_id ON documents(unite_id);
CREATE INDEX IF NOT EXISTS idx_documents_contrat_id ON documents(contrat_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING gin(tags);

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table inventaires
CREATE TABLE IF NOT EXISTS inventaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  contrat_id uuid REFERENCES contrats(id),
  type text NOT NULL CHECK (type IN ('entree', 'sortie')),
  date date NOT NULL,
  locataire_present boolean DEFAULT false,
  proprietaire_present boolean DEFAULT false,
  agent_present boolean DEFAULT false,
  pieces jsonb DEFAULT '[]'::jsonb,
  equipements jsonb DEFAULT '{}'::jsonb,
  compteurs jsonb DEFAULT '{}'::jsonb,
  observations text,
  reparations text,
  caution_retenue decimal(10,2) DEFAULT 0,
  signature_locataire text,
  signature_proprietaire text,
  signature_agent text,
  statut text DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'termine', 'litige')),
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventaires ENABLE ROW LEVEL SECURITY;

-- Politiques inventaires
DROP POLICY IF EXISTS "Users can view agency inventaires" ON inventaires;
CREATE POLICY "Users can view agency inventaires"
  ON inventaires FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins and agents can create inventaires" ON inventaires;
CREATE POLICY "Admins and agents can create inventaires"
  ON inventaires FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

DROP POLICY IF EXISTS "Admins and agents can update inventaires" ON inventaires;
CREATE POLICY "Admins and agents can update inventaires"
  ON inventaires FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

-- Index inventaires
CREATE INDEX IF NOT EXISTS idx_inventaires_agency_id ON inventaires(agency_id);
CREATE INDEX IF NOT EXISTS idx_inventaires_contrat_id ON inventaires(contrat_id);
CREATE INDEX IF NOT EXISTS idx_inventaires_type ON inventaires(type);
CREATE INDEX IF NOT EXISTS idx_inventaires_statut ON inventaires(statut);
CREATE INDEX IF NOT EXISTS idx_inventaires_date ON inventaires(date DESC);

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_inventaires_updated_at ON inventaires;
CREATE TRIGGER update_inventaires_updated_at
  BEFORE UPDATE ON inventaires
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();