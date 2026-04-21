/*
  # Super Admin SaaS Owner — Rôle, RLS, vues métriques, log

  Objectif :
  Séparer strictement :
    - admin     → administrateur d'UNE agence cliente (agency_id défini)
    - super_admin → propriétaire du SaaS, accès global (agency_id = null)

  1. Ajouter `super_admin` à l'enum user_role
  2. Ajouter la fonction is_super_admin()
  3. Mettre à jour les RLS : super_admin bypass isolation tenant sur agencies/subscriptions/user_profiles
  4. Créer les vues métriques pour la console propriétaire
  5. Créer la table owner_actions_log pour tracer les actions admin globales
*/

-- ─────────────────────────────────────────────────────────────
-- 1. Ajouter super_admin à l'enum user_role
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'user_role'::regtype
    AND enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'super_admin';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. Fonction is_super_admin()
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- 3. RLS agencies — super_admin voit TOUT
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own agency"       ON agencies;
DROP POLICY IF EXISTS "Admins can update own agency"    ON agencies;
DROP POLICY IF EXISTS "Super admin sees all agencies"   ON agencies;
DROP POLICY IF EXISTS "Super admin manages all agencies" ON agencies;

CREATE POLICY "agency_tenant_select"
  ON agencies FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "agency_tenant_update"
  ON agencies FOR UPDATE
  TO authenticated
  USING (
    is_super_admin()
    OR (
      id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid())
      AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid())
      AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

CREATE POLICY "agency_super_admin_insert"
  ON agencies FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "agency_super_admin_delete"
  ON agencies FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- ─────────────────────────────────────────────────────────────
-- 4. RLS subscriptions — super_admin voit TOUT
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can view own subscription" ON subscriptions;

CREATE POLICY "subscriptions_select"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR agency_id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "subscriptions_super_admin_write"
  ON subscriptions FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ─────────────────────────────────────────────────────────────
-- 5. RLS user_profiles — super_admin voit TOUT
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "super_admin_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "super_admin_profiles_update" ON user_profiles;

CREATE POLICY "super_admin_profiles_select"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR id = auth.uid()
    OR agency_id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "super_admin_profiles_update"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    is_super_admin()
    OR id = auth.uid()
  )
  WITH CHECK (
    is_super_admin()
    OR id = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────
-- 6. Table owner_actions_log — traçabilité des actions owner
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS owner_actions_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email   text,
  action        text NOT NULL,
  target_type   text,
  target_id     uuid,
  target_label  text,
  details       jsonb DEFAULT '{}',
  ip_address    text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_actions_log_actor    ON owner_actions_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_owner_actions_log_action   ON owner_actions_log(action);
CREATE INDEX IF NOT EXISTS idx_owner_actions_log_created  ON owner_actions_log(created_at DESC);

ALTER TABLE owner_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_log_select"
  ON owner_actions_log FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "owner_log_insert"
  ON owner_actions_log FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

-- ─────────────────────────────────────────────────────────────
-- 7. Vue métriques globales agences (pour la console owner)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_owner_agency_stats AS
SELECT
  a.id,
  a.name,
  a.status,
  a.plan,
  a.trial_ends_at,
  a.created_at,
  COUNT(DISTINCT up.id)                                      AS nb_users,
  COUNT(DISTINCT b.id)                                       AS nb_bailleurs,
  COUNT(DISTINCT i.id)                                       AS nb_immeubles,
  COUNT(DISTINCT u.id)                                       AS nb_unites,
  COUNT(DISTINCT c.id)                                       AS nb_contrats,
  COUNT(DISTINCT p.id)                                       AS nb_paiements,
  COALESCE(SUM(p.montant) FILTER (WHERE p.statut = 'paye'), 0) AS volume_paiements,
  MAX(up.updated_at)                                         AS derniere_activite
FROM agencies a
LEFT JOIN user_profiles up  ON up.agency_id = a.id
LEFT JOIN bailleurs b        ON b.agency_id  = a.id
LEFT JOIN immeubles i        ON i.agency_id  = a.id
LEFT JOIN unites u           ON u.agency_id  = a.id
LEFT JOIN contrats c         ON c.agency_id  = a.id
LEFT JOIN paiements p        ON p.agency_id  = a.id
GROUP BY a.id, a.name, a.status, a.plan, a.trial_ends_at, a.created_at;

-- Sécuriser la vue : accessible uniquement au super_admin
REVOKE ALL ON vw_owner_agency_stats FROM PUBLIC;
GRANT SELECT ON vw_owner_agency_stats TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8. subscription_plans RLS — super_admin manage tout
-- ─────────────────────────────────────────────────────────────

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view plans"          ON subscription_plans;
DROP POLICY IF EXISTS "super_admin manages plans"      ON subscription_plans;

CREATE POLICY "plans_select_all"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "plans_super_admin_write"
  ON subscription_plans FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
