/*
  # Création du schéma complet de gestion immobilière

  ## Vue d'ensemble
  Ce schéma établit une base de données complète pour la gestion d'une agence immobilière,
  incluant la gestion des bailleurs, immeubles, unités, locataires, contrats, paiements,
  et la comptabilité avec système multi-rôles.

  ## 1. Tables principales créées

  ### Gestion des utilisateurs et rôles
  - `user_profiles` : Profils utilisateurs avec rôle assigné

  ### Gestion immobilière
  - `bailleurs` : Propriétaires des immeubles
  - `immeubles` : Bâtiments gérés par l'agence
  - `unites` : Appartements/locaux dans les immeubles
  - `locataires` : Personnes qui louent les unités
  - `contrats` : Contrats de location entre locataires et unités
  - `paiements` : Enregistrement des paiements de loyers

  ### Comptabilité
  - `revenus` : Enregistrement des revenus de l'agence
  - `depenses` : Enregistrement des dépenses de l'agence
  - `bilans_mensuels` : Bilans financiers mensuels automatisés

  ### Audit
  - `audit_logs` : Historique de toutes les modifications

  ## 2. Sécurité (RLS)
  
  Chaque table est protégée par Row Level Security avec des politiques spécifiques par rôle :
  - **Admin** : Accès complet à toutes les données
  - **Agent** : Gestion des locataires, contrats, paiements
  - **Comptable** : Consultation des finances uniquement
  - **Bailleur** : Vue limitée à ses propres biens
*/

-- =====================================================
-- 1. TYPES ENUM
-- =====================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'agent', 'comptable', 'bailleur');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE unite_statut AS ENUM ('libre', 'loue', 'maintenance');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contrat_statut AS ENUM ('actif', 'expire', 'resilie');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE paiement_statut AS ENUM ('paye', 'partiel', 'impaye', 'annule');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE mode_paiement AS ENUM ('especes', 'cheque', 'virement', 'mobile_money', 'autre');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE operation_type AS ENUM ('revenus', 'depenses');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 2. TABLES UTILISATEURS ET RÔLES
-- =====================================================

-- Table des profils utilisateurs (étend auth.users de Supabase)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  nom text NOT NULL,
  prenom text NOT NULL,
  telephone text,
  role user_role NOT NULL DEFAULT 'agent',
  bailleur_id uuid,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 3. TABLES GESTION IMMOBILIÈRE
-- =====================================================

-- Bailleurs (propriétaires)
CREATE TABLE IF NOT EXISTS bailleurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  prenom text NOT NULL,
  telephone text NOT NULL,
  email text,
  adresse text,
  piece_identite text,
  notes text,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Immeubles
CREATE TABLE IF NOT EXISTS immeubles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  adresse text NOT NULL,
  quartier text,
  ville text NOT NULL,
  bailleur_id uuid REFERENCES bailleurs(id) ON DELETE CASCADE,
  nombre_unites integer DEFAULT 0,
  description text,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Unités (appartements/locaux)
CREATE TABLE IF NOT EXISTS unites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  immeuble_id uuid REFERENCES immeubles(id) ON DELETE CASCADE,
  nom text NOT NULL,
  numero text,
  etage text,
  loyer_base decimal(12,2) NOT NULL,
  statut unite_statut DEFAULT 'libre',
  superficie numeric,
  description text,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Locataires
CREATE TABLE IF NOT EXISTS locataires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  prenom text NOT NULL,
  telephone text NOT NULL,
  email text,
  adresse_personnelle text,
  piece_identite text,
  notes text,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Contrats de location
CREATE TABLE IF NOT EXISTS contrats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locataire_id uuid REFERENCES locataires(id) ON DELETE CASCADE,
  unite_id uuid REFERENCES unites(id) ON DELETE CASCADE,
  date_debut date NOT NULL,
  date_fin date,
  loyer_mensuel decimal(12,2) NOT NULL,
  caution decimal(12,2),
  pourcentage_agence decimal(5,2) DEFAULT 10.00,
  statut contrat_statut DEFAULT 'actif',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Paiements
CREATE TABLE IF NOT EXISTS paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id uuid REFERENCES contrats(id) ON DELETE CASCADE,
  montant_total decimal(12,2) NOT NULL,
  mois_concerne date NOT NULL,
  date_paiement date NOT NULL DEFAULT CURRENT_DATE,
  mode_paiement mode_paiement DEFAULT 'especes',
  part_agence decimal(12,2) NOT NULL,
  part_bailleur decimal(12,2) NOT NULL,
  statut paiement_statut DEFAULT 'paye',
  reference text,
  piece_justificative text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- =====================================================
-- 4. TABLES COMPTABILITÉ
-- =====================================================

-- Revenus
CREATE TABLE IF NOT EXISTS revenus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  montant decimal(12,2) NOT NULL,
  date_revenu date NOT NULL DEFAULT CURRENT_DATE,
  categorie text NOT NULL,
  description text,
  source text,
  paiement_id uuid REFERENCES paiements(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Dépenses
CREATE TABLE IF NOT EXISTS depenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  montant decimal(12,2) NOT NULL,
  date_depense date NOT NULL DEFAULT CURRENT_DATE,
  categorie text NOT NULL,
  description text,
  beneficiaire text,
  immeuble_id uuid REFERENCES immeubles(id),
  piece_justificative text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Bilans mensuels
CREATE TABLE IF NOT EXISTS bilans_mensuels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mois date NOT NULL UNIQUE,
  total_loyers_percus decimal(12,2) DEFAULT 0,
  total_loyers_impaye decimal(12,2) DEFAULT 0,
  total_commission_agence decimal(12,2) DEFAULT 0,
  total_part_bailleurs decimal(12,2) DEFAULT 0,
  total_depenses decimal(12,2) DEFAULT 0,
  solde_net decimal(12,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 5. TABLE AUDIT
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 6. INDEX POUR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_immeubles_bailleur ON immeubles(bailleur_id);
CREATE INDEX IF NOT EXISTS idx_unites_immeuble ON unites(immeuble_id);
CREATE INDEX IF NOT EXISTS idx_unites_statut ON unites(statut);
CREATE INDEX IF NOT EXISTS idx_contrats_locataire ON contrats(locataire_id);
CREATE INDEX IF NOT EXISTS idx_contrats_unite ON contrats(unite_id);
CREATE INDEX IF NOT EXISTS idx_contrats_statut ON contrats(statut);
CREATE INDEX IF NOT EXISTS idx_paiements_contrat ON paiements(contrat_id);
CREATE INDEX IF NOT EXISTS idx_paiements_date ON paiements(date_paiement);
CREATE INDEX IF NOT EXISTS idx_paiements_mois ON paiements(mois_concerne);
CREATE INDEX IF NOT EXISTS idx_revenus_date ON revenus(date_revenu);
CREATE INDEX IF NOT EXISTS idx_depenses_date ON depenses(date_depense);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- =====================================================
-- 7. TRIGGERS POUR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
  DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
  CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
  DROP TRIGGER IF EXISTS update_bailleurs_updated_at ON bailleurs;
  CREATE TRIGGER update_bailleurs_updated_at BEFORE UPDATE ON bailleurs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
  DROP TRIGGER IF EXISTS update_immeubles_updated_at ON immeubles;
  CREATE TRIGGER update_immeubles_updated_at BEFORE UPDATE ON immeubles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
  DROP TRIGGER IF EXISTS update_unites_updated_at ON unites;
  CREATE TRIGGER update_unites_updated_at BEFORE UPDATE ON unites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
  DROP TRIGGER IF EXISTS update_locataires_updated_at ON locataires;
  CREATE TRIGGER update_locataires_updated_at BEFORE UPDATE ON locataires FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
  DROP TRIGGER IF EXISTS update_contrats_updated_at ON contrats;
  CREATE TRIGGER update_contrats_updated_at BEFORE UPDATE ON contrats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
  DROP TRIGGER IF EXISTS update_paiements_updated_at ON paiements;
  CREATE TRIGGER update_paiements_updated_at BEFORE UPDATE ON paiements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
  DROP TRIGGER IF EXISTS update_revenus_updated_at ON revenus;
  CREATE TRIGGER update_revenus_updated_at BEFORE UPDATE ON revenus FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
  DROP TRIGGER IF EXISTS update_depenses_updated_at ON depenses;
  CREATE TRIGGER update_depenses_updated_at BEFORE UPDATE ON depenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

-- =====================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Activer RLS sur toutes les tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bailleurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE immeubles ENABLE ROW LEVEL SECURITY;
ALTER TABLE unites ENABLE ROW LEVEL SECURITY;
ALTER TABLE locataires ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrats ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenus ENABLE ROW LEVEL SECURITY;
ALTER TABLE depenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bilans_mensuels ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Fonction helper pour vérifier le rôle
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_agent_or_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'agent')
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_bailleur_id()
RETURNS uuid AS $$
  SELECT bailleur_id FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- =====================================================
-- Politiques RLS - USER_PROFILES
-- =====================================================

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "Admins can insert user profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update user profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete user profiles"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================================================
-- Politiques RLS - BAILLEURS
-- =====================================================

CREATE POLICY "Authenticated users can view bailleurs"
  ON bailleurs FOR SELECT
  TO authenticated
  USING (
    is_admin() OR 
    is_agent_or_admin() OR 
    (get_user_role() = 'bailleur' AND id = get_user_bailleur_id())
  );

CREATE POLICY "Agents and admins can insert bailleurs"
  ON bailleurs FOR INSERT
  TO authenticated
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Agents and admins can update bailleurs"
  ON bailleurs FOR UPDATE
  TO authenticated
  USING (is_agent_or_admin())
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Admins can delete bailleurs"
  ON bailleurs FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================================================
-- Politiques RLS - IMMEUBLES
-- =====================================================

CREATE POLICY "Authenticated users can view immeubles"
  ON immeubles FOR SELECT
  TO authenticated
  USING (
    is_admin() OR 
    is_agent_or_admin() OR 
    (get_user_role() = 'bailleur' AND bailleur_id = get_user_bailleur_id()) OR
    get_user_role() = 'comptable'
  );

CREATE POLICY "Agents and admins can insert immeubles"
  ON immeubles FOR INSERT
  TO authenticated
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Agents and admins can update immeubles"
  ON immeubles FOR UPDATE
  TO authenticated
  USING (is_agent_or_admin())
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Admins can delete immeubles"
  ON immeubles FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================================================
-- Politiques RLS - UNITES
-- =====================================================

CREATE POLICY "Authenticated users can view unites"
  ON unites FOR SELECT
  TO authenticated
  USING (
    is_admin() OR 
    is_agent_or_admin() OR 
    get_user_role() = 'comptable' OR
    (get_user_role() = 'bailleur' AND EXISTS (
      SELECT 1 FROM immeubles 
      WHERE immeubles.id = unites.immeuble_id 
      AND immeubles.bailleur_id = get_user_bailleur_id()
    ))
  );

CREATE POLICY "Agents and admins can insert unites"
  ON unites FOR INSERT
  TO authenticated
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Agents and admins can update unites"
  ON unites FOR UPDATE
  TO authenticated
  USING (is_agent_or_admin())
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Admins can delete unites"
  ON unites FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================================================
-- Politiques RLS - LOCATAIRES
-- =====================================================

CREATE POLICY "Agents, admins, and comptables can view locataires"
  ON locataires FOR SELECT
  TO authenticated
  USING (is_agent_or_admin() OR get_user_role() = 'comptable');

CREATE POLICY "Agents and admins can insert locataires"
  ON locataires FOR INSERT
  TO authenticated
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Agents and admins can update locataires"
  ON locataires FOR UPDATE
  TO authenticated
  USING (is_agent_or_admin())
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Admins can delete locataires"
  ON locataires FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================================================
-- Politiques RLS - CONTRATS
-- =====================================================

CREATE POLICY "Authenticated users can view contrats"
  ON contrats FOR SELECT
  TO authenticated
  USING (
    is_admin() OR 
    is_agent_or_admin() OR 
    get_user_role() = 'comptable' OR
    (get_user_role() = 'bailleur' AND EXISTS (
      SELECT 1 FROM unites 
      JOIN immeubles ON immeubles.id = unites.immeuble_id
      WHERE unites.id = contrats.unite_id 
      AND immeubles.bailleur_id = get_user_bailleur_id()
    ))
  );

CREATE POLICY "Agents and admins can insert contrats"
  ON contrats FOR INSERT
  TO authenticated
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Agents and admins can update contrats"
  ON contrats FOR UPDATE
  TO authenticated
  USING (is_agent_or_admin())
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Admins can delete contrats"
  ON contrats FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================================================
-- Politiques RLS - PAIEMENTS
-- =====================================================

CREATE POLICY "Authenticated users can view paiements"
  ON paiements FOR SELECT
  TO authenticated
  USING (
    is_admin() OR 
    is_agent_or_admin() OR 
    get_user_role() = 'comptable' OR
    (get_user_role() = 'bailleur' AND EXISTS (
      SELECT 1 FROM contrats
      JOIN unites ON unites.id = contrats.unite_id
      JOIN immeubles ON immeubles.id = unites.immeuble_id
      WHERE contrats.id = paiements.contrat_id 
      AND immeubles.bailleur_id = get_user_bailleur_id()
    ))
  );

CREATE POLICY "Agents and admins can insert paiements"
  ON paiements FOR INSERT
  TO authenticated
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Agents and admins can update paiements"
  ON paiements FOR UPDATE
  TO authenticated
  USING (is_agent_or_admin())
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Admins can delete paiements"
  ON paiements FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================================================
-- Politiques RLS - REVENUS
-- =====================================================

CREATE POLICY "Admins and comptables can view revenus"
  ON revenus FOR SELECT
  TO authenticated
  USING (is_admin() OR get_user_role() = 'comptable');

CREATE POLICY "Agents and admins can insert revenus"
  ON revenus FOR INSERT
  TO authenticated
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Agents and admins can update revenus"
  ON revenus FOR UPDATE
  TO authenticated
  USING (is_agent_or_admin())
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Admins can delete revenus"
  ON revenus FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================================================
-- Politiques RLS - DEPENSES
-- =====================================================

CREATE POLICY "Admins and comptables can view depenses"
  ON depenses FOR SELECT
  TO authenticated
  USING (is_admin() OR get_user_role() = 'comptable');

CREATE POLICY "Agents and admins can insert depenses"
  ON depenses FOR INSERT
  TO authenticated
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Agents and admins can update depenses"
  ON depenses FOR UPDATE
  TO authenticated
  USING (is_agent_or_admin())
  WITH CHECK (is_agent_or_admin());

CREATE POLICY "Admins can delete depenses"
  ON depenses FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================================================
-- Politiques RLS - BILANS_MENSUELS
-- =====================================================

CREATE POLICY "Authenticated users can view bilans"
  ON bilans_mensuels FOR SELECT
  TO authenticated
  USING (is_admin() OR get_user_role() = 'comptable' OR get_user_role() = 'agent');

CREATE POLICY "Admins can insert bilans"
  ON bilans_mensuels FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update bilans"
  ON bilans_mensuels FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete bilans"
  ON bilans_mensuels FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================================================
-- Politiques RLS - AUDIT_LOGS
-- =====================================================

CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);