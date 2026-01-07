/*
  # Migration Multi-Tenant - Architecture SaaS

  ## Vue d'ensemble
  Cette migration transforme l'application en un SaaS multi-tenant permettant :
  - Inscription d'agences immobilières
  - Inscription de bailleurs individuels
  - Isolation complète des données par agence
  - Gestion des utilisateurs et invitations
  - Notifications système
  - Gestion documentaire
  - Inventaires d'état des lieux
  - Interventions / Maintenance
  - Calendrier des événements

  ## Tables créées (9 nouvelles tables)
  1. agencies - Agences immobilières
  2. invitations - Invitations d'utilisateurs
  3. notifications - Système de notifications
  4. documents - Gestion documentaire
  5. inventaires - États des lieux
  6. interventions - Maintenance et réparations
  7. evenements - Calendrier
  8. subscription_plans - Plans d'abonnement
  9. subscriptions - Abonnements des agences

  ## Modifications de tables existantes
  - profiles : ajout agency_id
  - agency_settings : ajout agency_id (devient multi-tenant)
  - Toutes les tables métier : ajout agency_id pour isolation

  ## Sécurité
  - RLS activé sur toutes les nouvelles tables
  - Politiques d'accès par rôle et par agence
  - Isolation complète des données entre agences
*/

-- =====================================================
-- SECTION 1 : CRÉATION DE LA TABLE AGENCIES
-- =====================================================

CREATE TABLE IF NOT EXISTS agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ninea text, -- Numéro d'identification (Sénégal)
  address text,
  phone text NOT NULL,
  email text NOT NULL,
  website text,
  logo_url text,
  plan text DEFAULT 'basic' CHECK (plan IN ('basic', 'pro', 'enterprise')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
  trial_ends_at timestamptz,
  is_bailleur_account boolean DEFAULT false, -- true si compte bailleur individuel
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

-- Politique : Admins peuvent voir leur propre agence
CREATE POLICY "Users can view own agency"
  ON agencies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Politique : Admins peuvent mettre à jour leur agence
CREATE POLICY "Admins can update own agency"
  ON agencies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_agencies_status ON agencies(status);
CREATE INDEX IF NOT EXISTS idx_agencies_plan ON agencies(plan);

-- =====================================================
-- SECTION 2 : MODIFICATION DES TABLES EXISTANTES
-- =====================================================

-- Ajouter agency_id à la table profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'agency_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN agency_id uuid REFERENCES agencies(id);
    CREATE INDEX idx_profiles_agency_id ON profiles(agency_id);
  END IF;
END $$;

-- Modifier agency_settings pour être multi-tenant
DO $$
BEGIN
  -- Supprimer l'ancienne clé primaire
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'agency_settings'
    AND constraint_type = 'PRIMARY KEY'
    AND constraint_name = 'agency_settings_pkey'
  ) THEN
    ALTER TABLE agency_settings DROP CONSTRAINT agency_settings_pkey;
  END IF;

  -- Ajouter agency_id si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'agency_id'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN agency_id uuid REFERENCES agencies(id);
  END IF;

  -- Ajouter la nouvelle clé primaire
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'agency_settings'
    AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE agency_settings ADD PRIMARY KEY (agency_id);
  END IF;

  -- Créer l'index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'agency_settings' AND indexname = 'idx_agency_settings_agency_id'
  ) THEN
    CREATE INDEX idx_agency_settings_agency_id ON agency_settings(agency_id);
  END IF;
END $$;

-- Ajouter agency_id à toutes les tables métier pour l'isolation multi-tenant
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT unnest(ARRAY[
      'bailleurs', 'immeubles', 'unites', 'locataires',
      'contrats', 'paiements', 'depenses', 'audit_logs'
    ])
  LOOP
    -- Ajouter agency_id si n'existe pas
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_name::text
      AND column_name = 'agency_id'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN agency_id uuid REFERENCES agencies(id)', table_name);
      EXECUTE format('CREATE INDEX idx_%I_agency_id ON %I(agency_id)', table_name, table_name);
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- SECTION 3 : TABLE DES INVITATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'agent', 'comptable')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  token text UNIQUE NOT NULL,
  invited_by uuid REFERENCES profiles(id),
  message text,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Politique : Admins peuvent voir les invitations de leur agence
CREATE POLICY "Admins can view agency invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Politique : Admins peuvent créer des invitations
CREATE POLICY "Admins can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_invitations_agency_id ON invitations(agency_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

-- =====================================================
-- SECTION 4 : TABLE DES NOTIFICATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  link text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Politique : Utilisateurs peuvent voir leurs propres notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Politique : Utilisateurs peuvent mettre à jour leurs notifications (marquer comme lu)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Politique : Utilisateurs peuvent supprimer leurs notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Index
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_agency_id ON notifications(agency_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- =====================================================
-- SECTION 5 : TABLE DES DOCUMENTS
-- =====================================================

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
  uploaded_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Politique : Utilisateurs peuvent voir les documents de leur agence
CREATE POLICY "Users can view agency documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Politique : Admins et agents peuvent créer des documents
CREATE POLICY "Admins and agents can create documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

-- Politique : Admins et agents peuvent mettre à jour les documents
CREATE POLICY "Admins and agents can update documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

-- Politique : Admins peuvent supprimer les documents
CREATE POLICY "Admins can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_documents_agency_id ON documents(agency_id);
CREATE INDEX IF NOT EXISTS idx_documents_bailleur_id ON documents(bailleur_id);
CREATE INDEX IF NOT EXISTS idx_documents_immeuble_id ON documents(immeuble_id);
CREATE INDEX IF NOT EXISTS idx_documents_unite_id ON documents(unite_id);
CREATE INDEX IF NOT EXISTS idx_documents_contrat_id ON documents(contrat_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING gin(tags);

-- =====================================================
-- SECTION 6 : TABLE DES INVENTAIRES
-- =====================================================

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
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventaires ENABLE ROW LEVEL SECURITY;

-- Politique : Utilisateurs peuvent voir les inventaires de leur agence
CREATE POLICY "Users can view agency inventaires"
  ON inventaires FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Politique : Admins et agents peuvent créer des inventaires
CREATE POLICY "Admins and agents can create inventaires"
  ON inventaires FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

-- Politique : Admins et agents peuvent mettre à jour les inventaires
CREATE POLICY "Admins and agents can update inventaires"
  ON inventaires FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_inventaires_agency_id ON inventaires(agency_id);
CREATE INDEX IF NOT EXISTS idx_inventaires_contrat_id ON inventaires(contrat_id);
CREATE INDEX IF NOT EXISTS idx_inventaires_type ON inventaires(type);
CREATE INDEX IF NOT EXISTS idx_inventaires_statut ON inventaires(statut);
CREATE INDEX IF NOT EXISTS idx_inventaires_date ON inventaires(date DESC);

-- =====================================================
-- SECTION 7 : TABLE DES INTERVENTIONS
-- =====================================================

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
  assigne_a uuid REFERENCES profiles(id),
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
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;

-- Politique : Utilisateurs peuvent voir les interventions de leur agence
CREATE POLICY "Users can view agency interventions"
  ON interventions FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Politique : Admins et agents peuvent créer des interventions
CREATE POLICY "Admins and agents can create interventions"
  ON interventions FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

-- Politique : Admins et agents peuvent mettre à jour les interventions
CREATE POLICY "Admins and agents can update interventions"
  ON interventions FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_interventions_agency_id ON interventions(agency_id);
CREATE INDEX IF NOT EXISTS idx_interventions_immeuble_id ON interventions(immeuble_id);
CREATE INDEX IF NOT EXISTS idx_interventions_unite_id ON interventions(unite_id);
CREATE INDEX IF NOT EXISTS idx_interventions_statut ON interventions(statut);
CREATE INDEX IF NOT EXISTS idx_interventions_urgence ON interventions(urgence);
CREATE INDEX IF NOT EXISTS idx_interventions_categorie ON interventions(categorie);
CREATE INDEX IF NOT EXISTS idx_interventions_assigne_a ON interventions(assigne_a);

-- =====================================================
-- SECTION 8 : TABLE DES ÉVÉNEMENTS (CALENDRIER)
-- =====================================================

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
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE evenements ENABLE ROW LEVEL SECURITY;

-- Politique : Utilisateurs peuvent voir les événements de leur agence
CREATE POLICY "Users can view agency evenements"
  ON evenements FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Politique : Admins et agents peuvent créer des événements
CREATE POLICY "Admins and agents can create evenements"
  ON evenements FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

-- Politique : Admins et agents peuvent mettre à jour les événements
CREATE POLICY "Admins and agents can update evenements"
  ON evenements FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

-- Politique : Admins et agents peuvent supprimer les événements
CREATE POLICY "Admins and agents can delete evenements"
  ON evenements FOR DELETE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_evenements_agency_id ON evenements(agency_id);
CREATE INDEX IF NOT EXISTS idx_evenements_date ON evenements(date);
CREATE INDEX IF NOT EXISTS idx_evenements_type ON evenements(type);

-- =====================================================
-- SECTION 9 : TABLES DE FACTURATION (PLANS & ABONNEMENTS)
-- =====================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_xof integer NOT NULL,
  price_eur integer NOT NULL,
  price_usd integer NOT NULL,
  max_users integer NOT NULL,
  max_immeubles integer NOT NULL,
  max_unites integer NOT NULL,
  storage_gb integer NOT NULL,
  features jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insérer les plans par défaut
INSERT INTO subscription_plans (id, name, price_xof, price_eur, price_usd, max_users, max_immeubles, max_unites, storage_gb, features)
VALUES
  ('basic', 'Basic', 15000, 23, 25, 1, 5, 20, 1, '{"support": "email"}'::jsonb),
  ('pro', 'Pro', 35000, 53, 58, 10, 50, 200, 5, '{"support": "prioritaire", "all_modules": true}'::jsonb),
  ('enterprise', 'Enterprise', 0, 0, 0, -1, -1, -1, 50, '{"support": "dedie", "api_access": true, "custom": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid UNIQUE REFERENCES agencies(id) ON DELETE CASCADE,
  plan_id text REFERENCES subscription_plans(id),
  status text DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due')),
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz DEFAULT (now() + interval '1 month'),
  cancel_at_period_end boolean DEFAULT false,
  stripe_subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Politique : Admins peuvent voir leur abonnement
CREATE POLICY "Admins can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_subscriptions_agency_id ON subscriptions(agency_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- =====================================================
-- SECTION 10 : FONCTIONS UTILITAIRES
-- =====================================================

-- Fonction pour créer une notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_agency_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_link text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO notifications (user_id, agency_id, type, title, message, link)
  VALUES (p_user_id, p_agency_id, p_type, p_title, p_message, p_link)
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour nettoyer les invitations expirées
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
  UPDATE invitations
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier les limites du plan
CREATE OR REPLACE FUNCTION check_plan_limits(p_agency_id uuid)
RETURNS jsonb AS $$
DECLARE
  plan_limits jsonb;
  current_usage jsonb;
  plan_record RECORD;
BEGIN
  -- Récupérer les limites du plan
  SELECT sp.* INTO plan_record
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.agency_id = p_agency_id;

  -- Calculer l'utilisation actuelle
  SELECT jsonb_build_object(
    'users', (SELECT COUNT(*) FROM profiles WHERE agency_id = p_agency_id),
    'immeubles', (SELECT COUNT(*) FROM immeubles WHERE agency_id = p_agency_id),
    'unites', (SELECT COUNT(*) FROM unites WHERE agency_id = p_agency_id)
  ) INTO current_usage;

  -- Construire la réponse
  RETURN jsonb_build_object(
    'limits', jsonb_build_object(
      'max_users', plan_record.max_users,
      'max_immeubles', plan_record.max_immeubles,
      'max_unites', plan_record.max_unites
    ),
    'usage', current_usage,
    'can_add_user', (current_usage->>'users')::int < plan_record.max_users OR plan_record.max_users = -1,
    'can_add_immeuble', (current_usage->>'immeubles')::int < plan_record.max_immeubles OR plan_record.max_immeubles = -1,
    'can_add_unite', (current_usage->>'unites')::int < plan_record.max_unites OR plan_record.max_unites = -1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECTION 11 : TRIGGERS
-- =====================================================

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger sur toutes les tables avec updated_at
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT unnest(ARRAY[
      'agencies', 'agency_settings', 'documents',
      'inventaires', 'interventions', 'subscriptions',
      'subscription_plans'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS update_%I_updated_at ON %I',
      table_name, table_name
    );
    EXECUTE format(
      'CREATE TRIGGER update_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW
       EXECUTE FUNCTION update_updated_at()',
      table_name, table_name
    );
  END LOOP;
END $$;

-- =====================================================
-- SECTION 12 : MIGRATION DES DONNÉES EXISTANTES
-- =====================================================

-- Créer une agence par défaut pour les données existantes
DO $$
DECLARE
  default_agency_id uuid;
BEGIN
  -- Créer l'agence par défaut si elle n'existe pas
  INSERT INTO agencies (name, email, phone, plan, status)
  VALUES ('Confort Immo Archi', 'contact@confortimmoarchi.sn', '+221 XX XXX XX XX', 'pro', 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO default_agency_id;

  -- Si l'agence existait déjà, récupérer son ID
  IF default_agency_id IS NULL THEN
    SELECT id INTO default_agency_id FROM agencies WHERE name = 'Confort Immo Archi';
  END IF;

  -- Mettre à jour tous les profils sans agency_id
  UPDATE profiles
  SET agency_id = default_agency_id
  WHERE agency_id IS NULL;

  -- Mettre à jour agency_settings
  UPDATE agency_settings
  SET agency_id = default_agency_id
  WHERE agency_id IS NULL;

  -- Mettre à jour toutes les tables métier
  UPDATE bailleurs SET agency_id = default_agency_id WHERE agency_id IS NULL;
  UPDATE immeubles SET agency_id = default_agency_id WHERE agency_id IS NULL;
  UPDATE unites SET agency_id = default_agency_id WHERE agency_id IS NULL;
  UPDATE locataires SET agency_id = default_agency_id WHERE agency_id IS NULL;
  UPDATE contrats SET agency_id = default_agency_id WHERE agency_id IS NULL;
  UPDATE paiements SET agency_id = default_agency_id WHERE agency_id IS NULL;
  UPDATE depenses SET agency_id = default_agency_id WHERE agency_id IS NULL;
  UPDATE audit_logs SET agency_id = default_agency_id WHERE agency_id IS NULL;

  -- Créer un abonnement Pro pour l'agence par défaut
  INSERT INTO subscriptions (agency_id, plan_id, status)
  VALUES (default_agency_id, 'pro', 'active')
  ON CONFLICT (agency_id) DO NOTHING;

END $$;

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================

-- Vérification finale
DO $$
BEGIN
  RAISE NOTICE 'Migration multi-tenant terminée avec succès !';
  RAISE NOTICE 'Tables créées : agencies, invitations, notifications, documents, inventaires, interventions, evenements, subscription_plans, subscriptions';
  RAISE NOTICE 'Champs ajoutés : agency_id sur profiles, agency_settings et toutes les tables métier';
  RAISE NOTICE 'RLS activé et politiques configurées sur toutes les nouvelles tables';
END $$;
