-- =============================================================================
-- Migration : 20260506000001_autopilot_engine
-- Objectif  : Autopilot Engine Série A
--             event_outbox + job_queue + KPI tables + SQL workers + pg_cron
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EVENT_OUTBOX — Source unique de vérité des événements système
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_outbox (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid        REFERENCES agencies(id) ON DELETE CASCADE,
  event_type    text        NOT NULL,
  entity_type   text,
  entity_id     uuid,
  payload       jsonb,
  status        text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  retry_count   int         NOT NULL DEFAULT 0,
  error         text,
  source        text        NOT NULL DEFAULT 'frontend'
                  CHECK (source IN ('frontend', 'edge-function', 'cron', 'trigger')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

COMMENT ON TABLE event_outbox IS
  'Journal système primaire. TOUTE action métier écrit ici en premier. '
  'Les workers lisent cet outbox pour déclencher les effets de bord.';

CREATE INDEX IF NOT EXISTS idx_outbox_status        ON event_outbox(status) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_outbox_agency_type   ON event_outbox(agency_id, event_type);
CREATE INDEX IF NOT EXISTS idx_outbox_created_at    ON event_outbox(created_at DESC);

ALTER TABLE event_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outbox_select_agency" ON event_outbox;
CREATE POLICY "outbox_select_agency" ON event_outbox
  FOR SELECT USING (
    agency_id = (SELECT agency_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "outbox_insert_all" ON event_outbox;
CREATE POLICY "outbox_insert_all" ON event_outbox
  FOR INSERT WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. JOB_QUEUE — Orchestration asynchrone
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_queue (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text        NOT NULL,
  agency_id       uuid        REFERENCES agencies(id) ON DELETE CASCADE,
  payload         jsonb,
  status          text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  priority        int         NOT NULL DEFAULT 5,  -- 1 (haute) → 10 (basse)
  retry_count     int         NOT NULL DEFAULT 0,
  max_retries     int         NOT NULL DEFAULT 3,
  next_retry_at   timestamptz NOT NULL DEFAULT now(),
  source_event_id uuid        REFERENCES event_outbox(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  error           text
);

COMMENT ON TABLE job_queue IS
  'Queue de jobs asynchrones. Types : GENERATE_LEDGER, RECONCILE_FINANCE, '
  'RECALCUL_KPI, SYNC_POSTHOG, SEND_NOTIFICATION, UPDATE_COHORT.';

CREATE INDEX IF NOT EXISTS idx_jobs_status_retry   ON job_queue(status, next_retry_at) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_jobs_agency_type    ON job_queue(agency_id, type);
CREATE INDEX IF NOT EXISTS idx_jobs_priority       ON job_queue(priority, created_at) WHERE status = 'pending';

ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_select_admin"   ON job_queue;
DROP POLICY IF EXISTS "jobs_insert_service" ON job_queue;
CREATE POLICY "jobs_select_admin" ON job_queue
  FOR SELECT USING (
    (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) IN ('admin', 'super_admin')
    OR agency_id = (SELECT agency_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
  );
CREATE POLICY "jobs_insert_service" ON job_queue
  FOR INSERT WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. KPI_DAILY — Métriques quotidiennes par agence
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kpi_daily (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         uuid        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  date              date        NOT NULL,
  mrr               numeric(14,2) NOT NULL DEFAULT 0,
  paiements_count   int         NOT NULL DEFAULT 0,
  paiements_total   numeric(14,2) NOT NULL DEFAULT 0,
  impayes_count     int         NOT NULL DEFAULT 0,
  impayes_montant   numeric(14,2) NOT NULL DEFAULT 0,
  new_contracts     int         NOT NULL DEFAULT 0,
  active_contracts  int         NOT NULL DEFAULT 0,
  computed_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, date)
);

CREATE INDEX IF NOT EXISTS idx_kpi_daily_agency_date ON kpi_daily(agency_id, date DESC);

ALTER TABLE kpi_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kpi_daily_agency" ON kpi_daily;
DROP POLICY IF EXISTS "kpi_daily_insert" ON kpi_daily;
DROP POLICY IF EXISTS "kpi_daily_update" ON kpi_daily;
CREATE POLICY "kpi_daily_agency" ON kpi_daily
  FOR SELECT USING (agency_id = (SELECT agency_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1));
CREATE POLICY "kpi_daily_insert" ON kpi_daily FOR INSERT WITH CHECK (true);
CREATE POLICY "kpi_daily_update" ON kpi_daily FOR UPDATE USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. KPI_MONTHLY — Métriques mensuelles (MRR, ARR, retention)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kpi_monthly (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id        uuid        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  period           date        NOT NULL,
  mrr              numeric(14,2) NOT NULL DEFAULT 0,
  arr              numeric(14,2) GENERATED ALWAYS AS (mrr * 12) STORED,
  paiements_total  numeric(14,2) NOT NULL DEFAULT 0,
  contrats_actifs  int         NOT NULL DEFAULT 0,
  impayes_rate     numeric(5,2) NOT NULL DEFAULT 0,
  new_contracts    int         NOT NULL DEFAULT 0,
  cancelled_contracts int      NOT NULL DEFAULT 0,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, period)
);

CREATE INDEX IF NOT EXISTS idx_kpi_monthly_agency_period ON kpi_monthly(agency_id, period DESC);

ALTER TABLE kpi_monthly ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kpi_monthly_agency" ON kpi_monthly;
DROP POLICY IF EXISTS "kpi_monthly_insert" ON kpi_monthly;
DROP POLICY IF EXISTS "kpi_monthly_update" ON kpi_monthly;
CREATE POLICY "kpi_monthly_agency" ON kpi_monthly
  FOR SELECT USING (agency_id = (SELECT agency_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1));
CREATE POLICY "kpi_monthly_insert" ON kpi_monthly FOR INSERT WITH CHECK (true);
CREATE POLICY "kpi_monthly_update" ON kpi_monthly FOR UPDATE USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. AGENCY_COHORT — Tracking conversion & rétention pilotes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agency_cohort (
  agency_id              uuid PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  signup_week            date,
  first_contract_week    date,
  first_payment_week     date,
  conversion_time_days   int,
  pilot_to_active_days   int,
  retention_30d          bool NOT NULL DEFAULT false,
  retention_60d          bool NOT NULL DEFAULT false,
  retention_90d          bool NOT NULL DEFAULT false,
  churn_score            numeric(3,2) DEFAULT 0 CHECK (churn_score BETWEEN 0 AND 1),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agency_cohort ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cohort_super_admin" ON agency_cohort;
CREATE POLICY "cohort_super_admin" ON agency_cohort
  FOR ALL USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin');


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. CACHE_STORE — Cache KPI dashboard (TTL automatique)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cache_store (
  key          text        PRIMARY KEY,
  value        jsonb       NOT NULL,
  agency_id    uuid        REFERENCES agencies(id) ON DELETE CASCADE,
  ttl_seconds  int         NOT NULL DEFAULT 3600,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz GENERATED ALWAYS AS
                 (created_at + (ttl_seconds || ' seconds')::interval) STORED
);

CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_store(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_agency  ON cache_store(agency_id);

ALTER TABLE cache_store ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cache_agency" ON cache_store;
DROP POLICY IF EXISTS "cache_insert" ON cache_store;
DROP POLICY IF EXISTS "cache_update" ON cache_store;
DROP POLICY IF EXISTS "cache_delete" ON cache_store;
CREATE POLICY "cache_agency" ON cache_store
  FOR SELECT USING (agency_id = (SELECT agency_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
                    OR agency_id IS NULL);
CREATE POLICY "cache_insert" ON cache_store FOR INSERT WITH CHECK (true);
CREATE POLICY "cache_update" ON cache_store FOR UPDATE USING (true);
CREATE POLICY "cache_delete" ON cache_store FOR DELETE USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. TRIGGER — event_outbox auto-alimenté par INSERT paiements/contrats
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_trigger_outbox_paiement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO event_outbox (agency_id, event_type, entity_type, entity_id, payload, source)
  VALUES (
    NEW.agency_id,
    CASE TG_OP WHEN 'INSERT' THEN 'paiement.created' ELSE 'paiement.updated' END,
    'paiements',
    NEW.id,
    jsonb_build_object('statut', NEW.statut, 'montant', NEW.montant_total, 'contrat_id', NEW.contrat_id),
    'trigger'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_outbox_paiement_insert ON paiements;
CREATE TRIGGER trg_outbox_paiement_insert
  AFTER INSERT ON paiements FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_outbox_paiement();

DROP TRIGGER IF EXISTS trg_outbox_paiement_cancel ON paiements;
CREATE TRIGGER trg_outbox_paiement_cancel
  AFTER UPDATE ON paiements FOR EACH ROW
  WHEN (OLD.statut IS DISTINCT FROM NEW.statut AND NEW.statut = 'annule')
  EXECUTE FUNCTION fn_trigger_outbox_paiement();

CREATE OR REPLACE FUNCTION fn_trigger_outbox_contrat()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO event_outbox (agency_id, event_type, entity_type, entity_id, payload, source)
  VALUES (
    NEW.agency_id,
    CASE TG_OP WHEN 'INSERT' THEN 'contrat.created' ELSE 'contrat.updated' END,
    'contrats',
    NEW.id,
    jsonb_build_object('statut', NEW.statut, 'loyer', NEW.loyer_mensuel),
    'trigger'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_outbox_contrat_insert ON contrats;
CREATE TRIGGER trg_outbox_contrat_insert
  AFTER INSERT ON contrats FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_outbox_contrat();


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. FONCTION — Enqueue jobs depuis event_outbox
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_enqueue_jobs_from_outbox(p_limit int DEFAULT 50)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event   RECORD;
  v_count   int := 0;
BEGIN
  FOR v_event IN
    SELECT * FROM event_outbox
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Finance worker jobs
    IF v_event.event_type IN ('paiement.created', 'paiement.cancelled') THEN
      INSERT INTO job_queue (type, agency_id, payload, source_event_id, priority)
      VALUES ('GENERATE_LEDGER', v_event.agency_id,
        jsonb_build_object('event_id', v_event.id, 'entity_id', v_event.entity_id),
        v_event.id, 1);

      INSERT INTO job_queue (type, agency_id, payload, source_event_id, priority)
      VALUES ('RECONCILE_FINANCE', v_event.agency_id,
        jsonb_build_object('period', date_trunc('month', v_event.created_at)::date),
        v_event.id, 3);
    END IF;

    -- Analytics worker jobs
    IF v_event.event_type IN ('paiement.created', 'contrat.created', 'paiement.cancelled') THEN
      INSERT INTO job_queue (type, agency_id, payload, source_event_id, priority)
      VALUES ('RECALCUL_KPI', v_event.agency_id,
        jsonb_build_object('date', CURRENT_DATE, 'period', date_trunc('month', CURRENT_DATE)::date),
        v_event.id, 5);
    END IF;

    -- Cohort update
    IF v_event.event_type IN ('contrat.created', 'paiement.created') THEN
      INSERT INTO job_queue (type, agency_id, payload, source_event_id, priority)
      VALUES ('UPDATE_COHORT', v_event.agency_id,
        jsonb_build_object('agency_id', v_event.agency_id),
        v_event.id, 7);
    END IF;

    -- Mark processed
    UPDATE event_outbox SET status = 'processed', processed_at = now()
    WHERE id = v_event.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END; $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. WORKER SQL — Finance (GENERATE_LEDGER, RECONCILE_FINANCE)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_worker_finance(p_batch_size int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job       RECORD;
  v_done      int := 0;
  v_failed    int := 0;
BEGIN
  FOR v_job IN
    SELECT * FROM job_queue
    WHERE type IN ('GENERATE_LEDGER', 'RECONCILE_FINANCE')
      AND status = 'pending'
      AND next_retry_at <= now()
    ORDER BY priority ASC, created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE job_queue SET status = 'processing', started_at = now() WHERE id = v_job.id;

    BEGIN
      IF v_job.type = 'RECONCILE_FINANCE' THEN
        PERFORM fn_compute_financial_snapshots(
          COALESCE((v_job.payload->>'period')::date, date_trunc('month', CURRENT_DATE)::date)
        );
      END IF;
      -- GENERATE_LEDGER: ledger already handled by triggers, mark done
      UPDATE job_queue SET status = 'done', completed_at = now() WHERE id = v_job.id;
      v_done := v_done + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE job_queue SET
        status      = CASE WHEN retry_count >= max_retries THEN 'failed' ELSE 'pending' END,
        retry_count = retry_count + 1,
        next_retry_at = now() + interval '5 minutes' * (retry_count + 1),
        error       = SQLERRM
      WHERE id = v_job.id;
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('done', v_done, 'failed', v_failed, 'processed_at', now());
END; $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. WORKER SQL — Analytics (RECALCUL_KPI, UPDATE_COHORT)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_aggregate_kpi_daily(
  p_agency_id uuid,
  p_date      date DEFAULT CURRENT_DATE
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mrr              numeric;
  v_pmt_count        int;
  v_pmt_total        numeric;
  v_imp_count        int;
  v_imp_montant      numeric;
  v_new_contracts    int;
  v_active_contracts int;
BEGIN
  -- MRR = somme loyers contrats actifs
  SELECT COALESCE(SUM(loyer_mensuel), 0) INTO v_mrr
  FROM contrats WHERE agency_id = p_agency_id AND statut = 'actif';

  -- Paiements du jour
  SELECT COUNT(*), COALESCE(SUM(montant_total), 0) INTO v_pmt_count, v_pmt_total
  FROM paiements
  WHERE agency_id = p_agency_id AND statut != 'annule'
    AND date_paiement = p_date;

  -- Impayés courants
  SELECT COUNT(*), COALESCE(SUM(montant_total), 0) INTO v_imp_count, v_imp_montant
  FROM paiements
  WHERE agency_id = p_agency_id AND statut = 'impaye';

  -- Contrats ce jour
  SELECT COUNT(*) INTO v_new_contracts
  FROM contrats WHERE agency_id = p_agency_id AND date_debut = p_date;

  -- Total actifs
  SELECT COUNT(*) INTO v_active_contracts
  FROM contrats WHERE agency_id = p_agency_id AND statut = 'actif';

  INSERT INTO kpi_daily (agency_id, date, mrr, paiements_count, paiements_total,
    impayes_count, impayes_montant, new_contracts, active_contracts)
  VALUES (p_agency_id, p_date, v_mrr, v_pmt_count, v_pmt_total,
    v_imp_count, v_imp_montant, v_new_contracts, v_active_contracts)
  ON CONFLICT (agency_id, date) DO UPDATE SET
    mrr             = EXCLUDED.mrr,
    paiements_count = EXCLUDED.paiements_count,
    paiements_total = EXCLUDED.paiements_total,
    impayes_count   = EXCLUDED.impayes_count,
    impayes_montant = EXCLUDED.impayes_montant,
    new_contracts   = EXCLUDED.new_contracts,
    active_contracts= EXCLUDED.active_contracts,
    computed_at     = now();
END; $$;


CREATE OR REPLACE FUNCTION fn_aggregate_kpi_monthly(
  p_agency_id uuid,
  p_period    date DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mrr           numeric;
  v_pmt_total     numeric;
  v_actifs        int;
  v_imp_rate      numeric;
  v_new_c         int;
  v_cancelled_c   int;
BEGIN
  SELECT COALESCE(SUM(loyer_mensuel), 0) INTO v_mrr
  FROM contrats WHERE agency_id = p_agency_id AND statut = 'actif';

  SELECT COALESCE(SUM(montant_total), 0) INTO v_pmt_total
  FROM paiements
  WHERE agency_id = p_agency_id AND statut != 'annule'
    AND date_trunc('month', mois_concerne::date) = p_period;

  SELECT COUNT(*) INTO v_actifs FROM contrats WHERE agency_id = p_agency_id AND statut = 'actif';

  -- Taux impayés = impayés / (impayés + paye) pour ce mois
  WITH stats AS (
    SELECT
      SUM(CASE WHEN statut = 'impaye' THEN 1 ELSE 0 END) AS nb_imp,
      COUNT(*) AS nb_total
    FROM paiements
    WHERE agency_id = p_agency_id
      AND date_trunc('month', mois_concerne::date) = p_period
      AND statut IN ('paye', 'impaye', 'partiel')
  )
  SELECT CASE WHEN nb_total > 0 THEN ROUND((nb_imp::numeric / nb_total) * 100, 2) ELSE 0 END
  INTO v_imp_rate FROM stats;

  SELECT COUNT(*) INTO v_new_c
  FROM contrats WHERE agency_id = p_agency_id
    AND date_trunc('month', date_debut::date) = p_period;

  SELECT COUNT(*) INTO v_cancelled_c
  FROM contrats WHERE agency_id = p_agency_id AND statut IN ('resilie', 'expire')
    AND date_trunc('month', updated_at) = p_period;

  INSERT INTO kpi_monthly (agency_id, period, mrr, paiements_total, contrats_actifs,
    impayes_rate, new_contracts, cancelled_contracts)
  VALUES (p_agency_id, p_period, v_mrr, v_pmt_total, v_actifs, v_imp_rate, v_new_c, v_cancelled_c)
  ON CONFLICT (agency_id, period) DO UPDATE SET
    mrr                 = EXCLUDED.mrr,
    paiements_total     = EXCLUDED.paiements_total,
    contrats_actifs     = EXCLUDED.contrats_actifs,
    impayes_rate        = EXCLUDED.impayes_rate,
    new_contracts       = EXCLUDED.new_contracts,
    cancelled_contracts = EXCLUDED.cancelled_contracts,
    computed_at         = now();
END; $$;


CREATE OR REPLACE FUNCTION fn_worker_analytics(p_batch_size int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job    RECORD;
  v_done   int := 0;
  v_failed int := 0;
BEGIN
  FOR v_job IN
    SELECT DISTINCT ON (agency_id, type) *
    FROM job_queue
    WHERE type IN ('RECALCUL_KPI', 'UPDATE_COHORT', 'SYNC_POSTHOG')
      AND status = 'pending'
      AND next_retry_at <= now()
    ORDER BY agency_id, type, priority ASC, created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE job_queue SET status = 'processing', started_at = now() WHERE id = v_job.id;
    BEGIN
      IF v_job.type = 'RECALCUL_KPI' THEN
        PERFORM fn_aggregate_kpi_daily(
          v_job.agency_id,
          COALESCE((v_job.payload->>'date')::date, CURRENT_DATE)
        );
        PERFORM fn_aggregate_kpi_monthly(
          v_job.agency_id,
          COALESCE((v_job.payload->>'period')::date, date_trunc('month', CURRENT_DATE)::date)
        );
      END IF;

      IF v_job.type = 'UPDATE_COHORT' THEN
        INSERT INTO agency_cohort (agency_id, signup_week, first_contract_week, first_payment_week,
          conversion_time_days, retention_30d, retention_60d, retention_90d, updated_at)
        SELECT
          a.id,
          date_trunc('week', a.created_at)::date,
          date_trunc('week', a.first_contract_at)::date,
          date_trunc('week', a.first_payment_at)::date,
          EXTRACT(DAY FROM (a.first_payment_at - a.created_at))::int,
          (a.first_payment_at IS NOT NULL AND a.first_payment_at <= a.created_at + interval '30 days'),
          (a.first_payment_at IS NOT NULL AND a.first_payment_at <= a.created_at + interval '60 days'),
          (a.first_payment_at IS NOT NULL AND a.first_payment_at <= a.created_at + interval '90 days'),
          now()
        FROM agencies a
        WHERE a.id = v_job.agency_id
        ON CONFLICT (agency_id) DO UPDATE SET
          first_contract_week  = EXCLUDED.first_contract_week,
          first_payment_week   = EXCLUDED.first_payment_week,
          conversion_time_days = EXCLUDED.conversion_time_days,
          retention_30d        = EXCLUDED.retention_30d,
          retention_60d        = EXCLUDED.retention_60d,
          retention_90d        = EXCLUDED.retention_90d,
          updated_at           = now();
      END IF;

      UPDATE job_queue SET status = 'done', completed_at = now() WHERE id = v_job.id;
      v_done := v_done + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE job_queue SET
        status        = CASE WHEN retry_count >= max_retries THEN 'failed' ELSE 'pending' END,
        retry_count   = retry_count + 1,
        next_retry_at = now() + interval '5 minutes' * (retry_count + 1),
        error         = SQLERRM
      WHERE id = v_job.id;
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('done', v_done, 'failed', v_failed, 'processed_at', now());
END; $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. VUE — Anomalies système (audit dashboard)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_system_anomalies AS
  -- Paiements sans contrat valide
  SELECT
    p.agency_id,
    'paiement_sans_contrat' AS anomaly_type,
    p.id                    AS entity_id,
    jsonb_build_object('paiement_id', p.id, 'montant', p.montant_total, 'date', p.date_paiement) AS details
  FROM paiements p
  LEFT JOIN contrats c ON c.id = p.contrat_id AND c.agency_id = p.agency_id
  WHERE c.id IS NULL AND p.statut != 'annule'

  UNION ALL

  -- Unités 'loue' sans contrat actif
  SELECT
    u.agency_id,
    'unite_loue_sans_contrat_actif',
    u.id,
    jsonb_build_object('unite_id', u.id, 'nom', u.nom)
  FROM unites u
  WHERE u.statut = 'loue'
    AND NOT EXISTS (
      SELECT 1 FROM contrats c WHERE c.unite_id = u.id AND c.statut = 'actif'
    )

  UNION ALL

  -- Agences avec pilot_status=trial depuis > 30 jours et aucun paiement
  SELECT
    a.id,
    'pilot_inactif',
    a.id,
    jsonb_build_object('agency_id', a.id, 'nom', a.nom, 'since_days',
      EXTRACT(DAY FROM now() - a.created_at)::int)
  FROM agencies a
  WHERE a.pilot_status = 'trial'
    AND a.created_at < now() - interval '30 days'
    AND a.first_payment_at IS NULL;

COMMENT ON VIEW vw_system_anomalies IS
  'Anomalies système : paiements orphelins, unités incohérentes, pilotes inactifs.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 12. PG_CRON — Autopilot loop
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Outbox → jobs : toutes les 5 minutes (min interval pg_cron = 1 min)
    PERFORM cron.unschedule('enqueue-jobs-from-outbox')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enqueue-jobs-from-outbox');
    PERFORM cron.schedule('enqueue-jobs-from-outbox', '*/5 * * * *',
      'SELECT fn_enqueue_jobs_from_outbox(50)');

    -- Finance worker : toutes les 10 minutes
    PERFORM cron.unschedule('finance-worker')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finance-worker');
    PERFORM cron.schedule('finance-worker', '*/10 * * * *',
      'SELECT fn_worker_finance(20)');

    -- Analytics worker : toutes les 15 minutes
    PERFORM cron.unschedule('analytics-worker')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'analytics-worker');
    PERFORM cron.schedule('analytics-worker', '*/15 * * * *',
      'SELECT fn_worker_analytics(20)');

    -- Nettoyage cache expiré : toutes les heures
    PERFORM cron.unschedule('cleanup-cache')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-cache');
    PERFORM cron.schedule('cleanup-cache', '0 * * * *',
      'DELETE FROM cache_store WHERE expires_at < now()');

  END IF;
END; $$;
