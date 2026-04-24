-- Chantier 7: enrichissements Console super_admin
-- Ajoute: tags sur agencies, saas_config (clé/valeur), feature_flags, RLS

-- 1) Tags pour catégoriser/filtrer les agences depuis la Console
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_agencies_tags ON agencies USING GIN (tags);

-- 2) saas_config : configuration globale de la plateforme (clé/valeur jsonb)
CREATE TABLE IF NOT EXISTS saas_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE saas_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin manages saas_config" ON saas_config;
CREATE POLICY "Super admin manages saas_config"
  ON saas_config FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Valeurs par défaut
INSERT INTO saas_config (key, value, description) VALUES
  ('contact', '{"email":"contact@samaykeur.sn","whatsapp":"221774000000"}'::jsonb, 'Coordonnées de contact affichées dans l''app'),
  ('trial_days', '30'::jsonb, 'Durée par défaut de l''essai gratuit (jours)'),
  ('maintenance_mode', 'false'::jsonb, 'Active une bannière de maintenance globale')
ON CONFLICT (key) DO NOTHING;

-- 3) feature_flags : toggles globaux ou par agence
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag text NOT NULL,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flag, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_flag ON feature_flags(flag);
CREATE INDEX IF NOT EXISTS idx_feature_flags_agency ON feature_flags(agency_id);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin manages feature_flags" ON feature_flags;
CREATE POLICY "Super admin manages feature_flags"
  ON feature_flags FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Members read own agency flags" ON feature_flags;
CREATE POLICY "Members read own agency flags"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (
    agency_id IS NULL
    OR agency_id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid())
  );
