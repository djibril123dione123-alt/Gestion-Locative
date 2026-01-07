/*
  # Migration Multi-Tenant - Partie 5 : Plans et Abonnements

  1. Nouvelles tables
    - subscription_plans : Plans d'abonnement (Basic, Pro, Enterprise)
    - subscriptions : Abonnements des agences
  
  2. Sécurité
    - RLS activé
    - Politiques par agence
*/

-- Table subscription_plans
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
  ('basic', 'Essai Gratuit', 0, 0, 0, 1, 3, 10, 1, '{"support": "email", "trial_days": 30}'::jsonb),
  ('pro', 'Pro - Accès Complet', 15000, 23, 25, 999, 999, 9999, 20, '{"support": "prioritaire", "all_modules": true, "unlimited": true}'::jsonb),
  ('enterprise', 'Enterprise', 0, 0, 0, -1, -1, -1, 100, '{"support": "dedie", "api_access": true, "custom": true, "whitelabel": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table subscriptions
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

-- Politiques subscriptions
DROP POLICY IF EXISTS "Admins can view own subscription" ON subscriptions;
CREATE POLICY "Admins can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_subscriptions_agency_id ON subscriptions(agency_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();