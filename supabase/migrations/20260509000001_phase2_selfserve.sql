-- =============================================================================
-- Migration Phase 2 — Self-Serve : Paiements PayDunya + Notifications + Relances
--
-- 1. Colonnes paiement abonnement sur agencies
-- 2. Table payment_transactions (historique PayDunya)
-- 3. Table notification_queue (emails + SMS sortants)
-- 4. Table demo_data_loaded (flag par agence)
-- 5. Mise à jour plans avec prix + trial 14j
-- 6. RPC activate_subscription (appelé par webhook PayDunya)
-- 7. RPC schedule_renewal_reminders (pg_cron)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. COLONNES PAIEMENT SUR AGENCIES
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agencies' AND column_name='payment_provider') THEN
    ALTER TABLE agencies ADD COLUMN payment_provider text DEFAULT 'paydunya' CHECK (payment_provider IN ('paydunya', 'orange_money', 'wave', 'manual'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agencies' AND column_name='payment_phone') THEN
    ALTER TABLE agencies ADD COLUMN payment_phone text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agencies' AND column_name='last_payment_at') THEN
    ALTER TABLE agencies ADD COLUMN last_payment_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agencies' AND column_name='next_renewal_at') THEN
    ALTER TABLE agencies ADD COLUMN next_renewal_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agencies' AND column_name='suspension_at') THEN
    ALTER TABLE agencies ADD COLUMN suspension_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agencies' AND column_name='welcome_email_sent') THEN
    ALTER TABLE agencies ADD COLUMN welcome_email_sent boolean DEFAULT false;
  END IF;
END $$;

-- Trial 14 jours au lieu de 30 pour les nouvelles inscriptions
ALTER TABLE agencies
  DROP CONSTRAINT IF EXISTS agencies_status_check;
ALTER TABLE agencies
  ADD CONSTRAINT agencies_status_check
  CHECK (status IN ('active', 'suspended', 'trial', 'cancelled'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABLE payment_transactions (audit des paiements PayDunya)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  provider        text NOT NULL DEFAULT 'paydunya',
  provider_ref    text,                        -- token PayDunya
  invoice_token   text,                        -- invoice_token PayDunya
  amount_xof      integer NOT NULL,
  plan_id         text REFERENCES subscription_plans(id),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  phone           text,
  webhook_raw     jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payment_transactions' AND policyname='payment_transactions_agency_select') THEN
    CREATE POLICY payment_transactions_agency_select ON payment_transactions
      FOR SELECT USING (agency_id IN (
        SELECT agency_id FROM user_profiles WHERE id = auth.uid()
      ));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABLE notification_queue (emails + SMS sortants)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  type            text NOT NULL
                  CHECK (type IN (
                    'welcome_email', 'payment_confirmed', 'renewal_reminder',
                    'suspension_warning', 'suspension_notice', 'recovery_email',
                    'loyer_encaisse_bailleur', 'rappel_locataire', 'rapport_mensuel',
                    'impaye_agent_alerte'
                  )),
  channel         text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
  recipient_email text,
  recipient_phone text,
  recipient_name  text,
  subject         text,
  body_html       text,
  body_text       text,
  template_data   jsonb DEFAULT '{}',
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  scheduled_for   timestamptz DEFAULT now(),
  sent_at         timestamptz,
  error           text,
  provider_id     text,                        -- ID Resend ou Orange SMS
  retry_count     int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notif_queue_status_scheduled
  ON notification_queue(status, scheduled_for)
  WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FLAG demo_data_loaded
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agencies' AND column_name='demo_data_loaded') THEN
    ALTER TABLE agencies ADD COLUMN demo_data_loaded boolean DEFAULT false;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. MISE À JOUR PLANS (trial 14j explicite + prix corrects)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO subscription_plans (id, name, price_xof, price_eur, price_usd, max_users, max_immeubles, max_unites, storage_gb, features)
VALUES
  ('basic',      'Essai Gratuit 14j',  0,     0,  0,   1,   3,   10,   1,  '{"support": "email", "trial_days": 14}'::jsonb),
  ('pro',        'Pro',                15000, 23, 25,  999, 999, 9999, 20,  '{"support": "prioritaire", "all_modules": true, "unlimited": true}'::jsonb),
  ('enterprise', 'Enterprise',         0,     0,  0,   -1,  -1,  -1,  100, '{"support": "dedie", "api_access": true, "custom": true, "whitelabel": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  price_xof  = EXCLUDED.price_xof,
  features   = EXCLUDED.features,
  updated_at = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC activate_subscription (appelée par le webhook PayDunya)
--    SERVICE ROLE UNIQUEMENT — ne jamais exposer en client
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION activate_subscription(
  p_agency_id      uuid,
  p_plan_id        text,
  p_transaction_id uuid,
  p_amount_xof     integer,
  p_phone          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_end timestamptz := now() + interval '30 days';
BEGIN
  -- Activer l'agence
  UPDATE agencies SET
    status          = 'active',
    plan            = p_plan_id,
    last_payment_at = now(),
    next_renewal_at = v_period_end,
    suspension_at   = NULL,
    payment_phone   = COALESCE(p_phone, payment_phone),
    updated_at      = now()
  WHERE id = p_agency_id;

  -- Upsert subscription
  INSERT INTO subscriptions (agency_id, plan_id, status, current_period_start, current_period_end)
  VALUES (p_agency_id, p_plan_id, 'active', now(), v_period_end)
  ON CONFLICT (agency_id) DO UPDATE SET
    plan_id               = p_plan_id,
    status                = 'active',
    current_period_start  = now(),
    current_period_end    = v_period_end,
    updated_at            = now();

  -- Marquer la transaction comme complétée
  UPDATE payment_transactions
  SET status = 'completed', updated_at = now()
  WHERE id = p_transaction_id;

  -- Enqueue email de confirmation
  INSERT INTO notification_queue (agency_id, type, channel, template_data, scheduled_for)
  VALUES (
    p_agency_id,
    'payment_confirmed',
    'email',
    jsonb_build_object('plan_id', p_plan_id, 'amount_xof', p_amount_xof, 'period_end', v_period_end),
    now()
  );

  RETURN jsonb_build_object('success', true, 'period_end', v_period_end);
END;
$$;

REVOKE ALL ON FUNCTION activate_subscription(uuid, text, uuid, integer, text) FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RPC queue_renewal_reminders — appeler via pg_cron quotidiennement
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION queue_renewal_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queued int := 0;
BEGIN
  -- J-3 : rappel renouvellement
  INSERT INTO notification_queue (agency_id, type, channel, template_data)
  SELECT a.id, 'renewal_reminder', 'email',
    jsonb_build_object('days_left', 3, 'next_renewal_at', a.next_renewal_at, 'plan', a.plan)
  FROM agencies a
  WHERE a.status = 'active'
    AND a.next_renewal_at BETWEEN now() + interval '2 days 22 hours' AND now() + interval '3 days 2 hours'
    AND NOT EXISTS (
      SELECT 1 FROM notification_queue nq
      WHERE nq.agency_id = a.id AND nq.type = 'renewal_reminder'
        AND nq.created_at > now() - interval '24 hours'
    );

  GET DIAGNOSTICS v_queued = ROW_COUNT;

  -- J0 : suspension warning
  INSERT INTO notification_queue (agency_id, type, channel, template_data)
  SELECT a.id, 'suspension_warning', 'email',
    jsonb_build_object('next_renewal_at', a.next_renewal_at, 'plan', a.plan)
  FROM agencies a
  WHERE a.status = 'active'
    AND a.next_renewal_at < now()
    AND NOT EXISTS (
      SELECT 1 FROM notification_queue nq
      WHERE nq.agency_id = a.id AND nq.type = 'suspension_warning'
        AND nq.created_at > now() - interval '24 hours'
    );

  -- J0 : suspension effective (après 24h de grâce)
  UPDATE agencies SET status = 'suspended', suspension_at = now(), updated_at = now()
  WHERE status = 'active'
    AND next_renewal_at < now() - interval '24 hours';

  -- J+7 : email récupération (depuis suspension)
  INSERT INTO notification_queue (agency_id, type, channel, template_data)
  SELECT a.id, 'recovery_email', 'email',
    jsonb_build_object('suspension_at', a.suspension_at, 'plan', a.plan)
  FROM agencies a
  WHERE a.status = 'suspended'
    AND a.suspension_at BETWEEN now() - interval '7 days 2 hours' AND now() - interval '6 days 22 hours'
    AND NOT EXISTS (
      SELECT 1 FROM notification_queue nq
      WHERE nq.agency_id = a.id AND nq.type = 'recovery_email'
        AND nq.created_at > now() - interval '24 hours'
    );

  RETURN jsonb_build_object('queued', v_queued, 'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION queue_renewal_reminders() FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RPC queue_bailleur_notifications — après encaissement loyer
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION queue_loyer_encaisse_notification(
  p_paiement_id uuid,
  p_agency_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pmt record;
  v_bailleur record;
BEGIN
  SELECT p.montant_total, p.mois_concerne, p.part_bailleur, p.part_agence,
         c.commission, u.nom AS unite_nom,
         b.id AS bailleur_id, b.email AS bailleur_email,
         b.prenom || ' ' || b.nom AS bailleur_nom
  INTO v_pmt
  FROM paiements p
  JOIN contrats c ON c.id = p.contrat_id
  JOIN unites u ON u.id = c.unite_id
  JOIN bailleurs b ON b.id = c.bailleur_id
  WHERE p.id = p_paiement_id AND p.agency_id = p_agency_id;

  IF NOT FOUND OR v_pmt.bailleur_email IS NULL THEN RETURN; END IF;

  INSERT INTO notification_queue (
    agency_id, type, channel, recipient_email, recipient_name,
    subject, template_data, scheduled_for
  ) VALUES (
    p_agency_id,
    'loyer_encaisse_bailleur',
    'email',
    v_pmt.bailleur_email,
    v_pmt.bailleur_nom,
    'Loyer encaissé — ' || v_pmt.unite_nom,
    jsonb_build_object(
      'bailleur_nom',   v_pmt.bailleur_nom,
      'unite_nom',      v_pmt.unite_nom,
      'montant_total',  v_pmt.montant_total,
      'part_bailleur',  v_pmt.part_bailleur,
      'part_agence',    v_pmt.part_agence,
      'commission',     v_pmt.commission,
      'mois_concerne',  v_pmt.mois_concerne
    ),
    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION queue_loyer_encaisse_notification(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION queue_loyer_encaisse_notification(uuid, uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Scheduling pg_cron (si disponible)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    -- Relances renouvellement : chaque jour à 8h
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'renewal_reminders_daily') THEN
      PERFORM cron.schedule('renewal_reminders_daily', '0 8 * * *', 'SELECT queue_renewal_reminders()');
    END IF;

    -- Worker notifications : toutes les 5 minutes
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notification_queue_worker') THEN
      PERFORM cron.schedule('notification_queue_worker', '*/5 * * * *', $$
        SELECT net.http_post(
          url := current_setting('app.supabase_url') || '/functions/v1/send-email',
          headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
          body := '{}'::jsonb
        )
      $$);
    END IF;

    RAISE NOTICE 'pg_cron : relances renouvellement planifiées.';
  ELSE
    RAISE NOTICE 'pg_cron non disponible. Planifiez manuellement les relances.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron erreur (non bloquant) : %', SQLERRM;
END $$;
