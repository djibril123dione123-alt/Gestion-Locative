/*
  # Migration Multi-Tenant - Partie 4 : Interventions et Événements

  1. Nouvelles tables
    - interventions : Maintenance et réparations
    - evenements : Calendrier
  
  2. Sécurité
    - RLS activé
    - Politiques par agence et rôle
*/

-- Table interventions
CREATE TABLE IF NOT EXISTS interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  titre text NOT NULL,
  description text,
  immeuble_id uuid REFERENCES immeubles(id),
  unite_id uuid REFERENCES unites(id),
  categorie text CHECK (categorie IN ('plomberie', 'electricite', 'peinture', 'serrurerie', 'climatisation', 'autre')),
  urgence text DEFAULT 'normale' CHECK (urgence IN ('urgente', 'normale', 'basse')),
  demande_par text CHECK (demande_par IN ('locataire', 'bailleur', 'agent')),
  date_demande date NOT NULL,
  date_souhaitee date,
  assigne_a uuid REFERENCES user_profiles(id),
  prestataire_nom text,
  prestataire_telephone text,
  cout_estime decimal(10,2),
  cout_reel decimal(10,2),
  statut text DEFAULT 'a_faire' CHECK (statut IN ('a_faire', 'en_cours', 'termine')),
  date_intervention date,
  date_fin date,
  photos_avant text[] DEFAULT ARRAY[]::text[],
  photos_apres text[] DEFAULT ARRAY[]::text[],
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;

-- Politiques interventions
DROP POLICY IF EXISTS "Users can view agency interventions" ON interventions;
CREATE POLICY "Users can view agency interventions"
  ON interventions FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins and agents can create interventions" ON interventions;
CREATE POLICY "Admins and agents can create interventions"
  ON interventions FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

DROP POLICY IF EXISTS "Admins and agents can update interventions" ON interventions;
CREATE POLICY "Admins and agents can update interventions"
  ON interventions FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

-- Index interventions
CREATE INDEX IF NOT EXISTS idx_interventions_agency_id ON interventions(agency_id);
CREATE INDEX IF NOT EXISTS idx_interventions_immeuble_id ON interventions(immeuble_id);
CREATE INDEX IF NOT EXISTS idx_interventions_unite_id ON interventions(unite_id);
CREATE INDEX IF NOT EXISTS idx_interventions_statut ON interventions(statut);
CREATE INDEX IF NOT EXISTS idx_interventions_urgence ON interventions(urgence);
CREATE INDEX IF NOT EXISTS idx_interventions_categorie ON interventions(categorie);
CREATE INDEX IF NOT EXISTS idx_interventions_assigne_a ON interventions(assigne_a);

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_interventions_updated_at ON interventions;
CREATE TRIGGER update_interventions_updated_at
  BEFORE UPDATE ON interventions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table evenements
CREATE TABLE IF NOT EXISTS evenements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  titre text NOT NULL,
  type text NOT NULL CHECK (type IN ('paiement', 'contrat', 'intervention', 'rendez_vous', 'autre')),
  date date NOT NULL,
  heure time,
  bailleur_id uuid REFERENCES bailleurs(id),
  immeuble_id uuid REFERENCES immeubles(id),
  unite_id uuid REFERENCES unites(id),
  locataire_id uuid REFERENCES locataires(id),
  description text,
  rappel text CHECK (rappel IN ('aucun', '1_jour', '1_semaine')),
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE evenements ENABLE ROW LEVEL SECURITY;

-- Politiques evenements
DROP POLICY IF EXISTS "Users can view agency evenements" ON evenements;
CREATE POLICY "Users can view agency evenements"
  ON evenements FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins and agents can create evenements" ON evenements;
CREATE POLICY "Admins and agents can create evenements"
  ON evenements FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

DROP POLICY IF EXISTS "Admins and agents can update evenements" ON evenements;
CREATE POLICY "Admins and agents can update evenements"
  ON evenements FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

DROP POLICY IF EXISTS "Admins and agents can delete evenements" ON evenements;
CREATE POLICY "Admins and agents can delete evenements"
  ON evenements FOR DELETE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

-- Index evenements
CREATE INDEX IF NOT EXISTS idx_evenements_agency_id ON evenements(agency_id);
CREATE INDEX IF NOT EXISTS idx_evenements_date ON evenements(date);
CREATE INDEX IF NOT EXISTS idx_evenements_type ON evenements(type);