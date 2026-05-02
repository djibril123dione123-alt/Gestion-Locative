-- =============================================================================
-- Migration : 20260506000002_autopilot_v2_self_healing
-- Objectif  : Autopilot Engine v2 — Self-Healing + Rule Engine + Observability
--             trace_id · retry_strategy · weight_cost · fn_self_heal
--             unit economics KPI · revenue quality score · fn_rule_engine
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. UPGRADE event_outbox — trace_id + error classification
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE event_outbox
  ADD COLUMN IF NOT EXISTS trace_id    uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS error_class text
    CHECK (error_class IN ('transient','business_rule','system_failure','data_inconsistency'));

CREATE INDEX IF NOT EXISTS idx_outbox_trace ON event_outbox(trace_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. UPGRADE job_queue — orchestration intelligente
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE job_queue
  ADD COLUMN IF NOT EXISTS trace_id           uuid,
  ADD COLUMN IF NOT EXISTS weight_cost        int  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tenant_load_score  numeric(3,2) NOT NULL DEFAULT 0
    CHECK (tenant_load_score BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS retry_strategy     text NOT NULL DEFAULT 'exponential'
    CHECK (retry_strategy IN ('linear','exponential','dead_letter'));

CREATE INDEX IF NOT EXISTS idx_jobs_trace ON job_queue(trace_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. UPGRADE kpi_monthly — Unit Economics + Revenue Quality
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE kpi_monthly
  ADD COLUMN IF NOT EXISTS ltv                  numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cac                  numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ltv_cac_ratio        numeric(6,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_quality_score numeric(3,2) DEFAULT 0
    CHECK (revenue_quality_score BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS recurring_ratio      numeric(5,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS churn_risk           numeric(3,2)  DEFAULT 0
    CHECK (churn_risk BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS payment_consistency  numeric(3,2)  DEFAULT 0
    CHECK (payment_consistency BETWEEN 0 AND 1);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SYSTEM_HEALTH — Table de métriques d'observabilité en temps réel
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_health (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at     timestamptz NOT NULL DEFAULT now(),
  queue_backlog   int         NOT NULL DEFAULT 0,
  failed_jobs     int         NOT NULL DEFAULT 0,
  orphan_events   int         NOT NULL DEFAULT 0,
  stale_jobs      int         NOT NULL DEFAULT 0,
  drift_agencies  int         NOT NULL DEFAULT 0,
  worker_latency_ms int       NOT NULL DEFAULT 0,
  failure_rate    numeric(5,2) NOT NULL DEFAULT 0,
  health_score    numeric(3,2) NOT NULL DEFAULT 1
    CHECK (health_score BETWEEN 0 AND 1),
  actions_taken   jsonb       NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_health_snapshot ON system_health(snapshot_at DESC);

ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_admin" ON system_health
  FOR SELECT USING (
    (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) IN ('admin','super_admin')
  );
CREATE POLICY "health_insert" ON system_health FOR INSERT WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RULE ENGINE — Priorité intelligente des jobs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_rule_engine(p_job_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job        RECORD;
  v_mrr        numeric := 0;
  v_backlog    int;
  v_new_prio   int;
  v_weight     int;
  v_strategy   text;
BEGIN
  SELECT * INTO v_job FROM job_queue WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- MRR de l'agence (dernier mois connu)
  SELECT COALESCE(mrr, 0) INTO v_mrr
  FROM kpi_monthly
  WHERE agency_id = v_job.agency_id
  ORDER BY period DESC LIMIT 1;

  -- Charge globale de la queue
  SELECT COUNT(*) INTO v_backlog FROM job_queue WHERE status = 'pending';

  -- ── Règles de priorité ────────────────────────────────────────────────────
  v_new_prio := v_job.priority;
  v_strategy := 'exponential';
  v_weight   := 1;

  -- Type critique → toujours priorité 1
  IF v_job.type IN ('RECONCILE_FINANCE','GENERATE_LEDGER') THEN
    v_new_prio := 1;
    v_weight   := CASE v_job.type WHEN 'GENERATE_LEDGER' THEN 2 ELSE 1 END;
    v_strategy := 'exponential';

  -- Agence haute valeur (MRR > 500 000 FCFA)
  ELSIF v_mrr > 500000 THEN
    v_new_prio := LEAST(v_new_prio, 2);
    v_strategy := 'exponential';

  -- KPI analytics — moins urgent
  ELSIF v_job.type = 'RECALCUL_KPI' THEN
    v_new_prio := CASE
      WHEN v_backlog > 200 THEN 8   -- Backpressure : différer
      WHEN v_mrr > 100000 THEN 4
      ELSE 6
    END;
    v_weight   := 3;
    v_strategy := 'linear';

  -- Cohort / notifications — basse priorité
  ELSIF v_job.type IN ('UPDATE_COHORT','SEND_NOTIFICATION') THEN
    v_new_prio := CASE WHEN v_backlog > 100 THEN 10 ELSE 7 END;
    v_weight   := 4;
    v_strategy := 'linear';

  -- Dead letter après max_retries
  ELSIF v_job.retry_count >= v_job.max_retries THEN
    v_strategy := 'dead_letter';
  END IF;

  UPDATE job_queue SET
    priority           = v_new_prio,
    weight_cost        = v_weight,
    retry_strategy     = v_strategy,
    tenant_load_score  = CASE
      WHEN v_mrr > 500000 THEN 0.9
      WHEN v_mrr > 100000 THEN 0.6
      ELSE 0.3
    END
  WHERE id = p_job_id;
END; $$;

-- Trigger : rule engine sur chaque INSERT dans job_queue
CREATE OR REPLACE FUNCTION fn_trigger_rule_engine()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM fn_rule_engine(NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_rule_engine ON job_queue;
CREATE TRIGGER trg_rule_engine
  AFTER INSERT ON job_queue FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_rule_engine();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SELF-HEAL ENGINE — Auto-correction du système
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_self_heal()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actions     jsonb  := '[]'::jsonb;
  v_action      text;
  v_drift_row   RECORD;
  v_orphan_cnt  int := 0;
  v_stale_cnt   int := 0;
  v_drift_cnt   int := 0;
  v_start       timestamptz := now();
  v_health      numeric;
BEGIN
  -- ── 1. Orphan events (pending > 10 min sans job associé) ─────────────────
  WITH orphans AS (
    SELECT o.id FROM event_outbox o
    WHERE o.status = 'pending'
      AND o.created_at < now() - interval '10 minutes'
      AND NOT EXISTS (SELECT 1 FROM job_queue j WHERE j.source_event_id = o.id)
  )
  UPDATE event_outbox SET status = 'pending', retry_count = retry_count + 1
  WHERE id IN (SELECT id FROM orphans)
  RETURNING id INTO v_orphan_cnt;

  -- Re-process orphans
  GET DIAGNOSTICS v_orphan_cnt = ROW_COUNT;
  IF v_orphan_cnt > 0 THEN
    PERFORM fn_enqueue_jobs_from_outbox(v_orphan_cnt * 3);
    v_actions := v_actions || jsonb_build_object(
      'action', 'retry_orphan_events', 'count', v_orphan_cnt, 'at', now()
    );
  END IF;

  -- ── 2. Stale processing jobs (bloqués > 30 min) ──────────────────────────
  UPDATE job_queue SET
    status        = 'pending',
    retry_count   = retry_count + 1,
    next_retry_at = now(),
    error         = 'Auto-reset by self-heal: stale processing > 30min',
    error_class   = NULL
  WHERE status = 'processing'
    AND started_at < now() - interval '30 minutes';

  GET DIAGNOSTICS v_stale_cnt = ROW_COUNT;
  IF v_stale_cnt > 0 THEN
    v_actions := v_actions || jsonb_build_object(
      'action', 'reset_stale_jobs', 'count', v_stale_cnt, 'at', now()
    );
  END IF;

  -- ── 3. Drift financier → RECONCILE_FINANCE ───────────────────────────────
  FOR v_drift_row IN
    SELECT agency_id FROM financial_snapshots
    WHERE status = 'drift'
      AND computed_at > now() - interval '7 days'
  LOOP
    INSERT INTO job_queue (type, agency_id, payload, priority, retry_strategy)
    VALUES ('RECONCILE_FINANCE', v_drift_row.agency_id,
      jsonb_build_object('period', date_trunc('month', CURRENT_DATE)::date, 'source', 'self_heal'),
      1, 'exponential')
    ON CONFLICT DO NOTHING;
    v_drift_cnt := v_drift_cnt + 1;
  END LOOP;

  IF v_drift_cnt > 0 THEN
    v_actions := v_actions || jsonb_build_object(
      'action', 'enqueue_reconcile_drift', 'agencies', v_drift_cnt, 'at', now()
    );
  END IF;

  -- ── 4. Dead letter jobs → classify error ─────────────────────────────────
  UPDATE job_queue SET
    retry_strategy = 'dead_letter',
    error_class    = CASE
      WHEN error ILIKE '%constraint%' OR error ILIKE '%rule%' THEN 'business_rule'
      WHEN error ILIKE '%connection%' OR error ILIKE '%timeout%' THEN 'transient'
      WHEN error ILIKE '%null%' OR error ILIKE '%violat%'      THEN 'data_inconsistency'
      ELSE 'system_failure'
    END
  WHERE status = 'failed'
    AND retry_count >= max_retries
    AND retry_strategy != 'dead_letter';

  -- ── 5. Calcul du score de santé système ──────────────────────────────────
  WITH stats AS (
    SELECT
      (SELECT COUNT(*) FROM job_queue WHERE status = 'pending')  AS backlog,
      (SELECT COUNT(*) FROM job_queue WHERE status = 'failed')   AS failed,
      (SELECT COUNT(*) FROM event_outbox WHERE status = 'pending' AND created_at < now() - interval '15 minutes') AS orphans,
      (SELECT COUNT(*) FROM financial_snapshots WHERE status = 'drift') AS drifts
  )
  SELECT GREATEST(0, LEAST(1,
    1.0
    - (CASE WHEN backlog > 100 THEN 0.2 ELSE 0 END)
    - (CASE WHEN failed  > 10  THEN 0.3 ELSE LEAST(0.2, failed::numeric / 50) END)
    - (CASE WHEN orphans > 5   THEN 0.2 ELSE 0 END)
    - (CASE WHEN drifts  > 0   THEN 0.15 ELSE 0 END)
  )) INTO v_health FROM stats;

  -- ── 6. Snapshot system_health ─────────────────────────────────────────────
  INSERT INTO system_health (
    queue_backlog, failed_jobs, orphan_events, stale_jobs,
    drift_agencies, worker_latency_ms, failure_rate, health_score, actions_taken
  )
  SELECT
    (SELECT COUNT(*) FROM job_queue WHERE status = 'pending'),
    (SELECT COUNT(*) FROM job_queue WHERE status = 'failed'),
    v_orphan_cnt,
    v_stale_cnt,
    v_drift_cnt,
    EXTRACT(EPOCH FROM (now() - v_start))::int * 1000,
    CASE WHEN total > 0 THEN ROUND((failed::numeric / total) * 100, 2) ELSE 0 END,
    v_health,
    v_actions
  FROM (
    SELECT
      COUNT(*) FILTER (WHERE status IN ('done','failed')) AS total,
      COUNT(*) FILTER (WHERE status = 'failed')           AS failed
    FROM job_queue WHERE created_at > now() - interval '1 hour'
  ) s;

  RETURN jsonb_build_object(
    'health_score', v_health,
    'actions',      v_actions,
    'orphans_fixed',v_orphan_cnt,
    'stale_fixed',  v_stale_cnt,
    'drifts_queued',v_drift_cnt,
    'duration_ms',  EXTRACT(EPOCH FROM (now() - v_start))::int * 1000
  );
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. REVENUE QUALITY SCORE ENGINE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_compute_revenue_quality(
  p_agency_id uuid,
  p_period    date DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mrr              numeric := 0;
  v_pmt_total        numeric := 0;
  v_recurring_ratio  numeric := 0;
  v_impayes_rate     numeric := 0;
  v_churn_risk       numeric := 0;
  v_consistency      numeric := 0;
  v_quality          numeric := 0;
  v_ltv              numeric := 0;
  v_retention_months numeric := 12; -- hypothèse baseline
BEGIN
  -- MRR courant
  SELECT COALESCE(SUM(loyer_mensuel), 0) INTO v_mrr
  FROM contrats WHERE agency_id = p_agency_id AND statut = 'actif';

  -- Paiements totaux du mois
  SELECT COALESCE(SUM(montant_total), 0) INTO v_pmt_total
  FROM paiements
  WHERE agency_id = p_agency_id AND statut != 'annule'
    AND date_trunc('month', mois_concerne::date) = p_period;

  -- Recurring ratio = MRR / total encaissé (si > 0)
  v_recurring_ratio := CASE WHEN v_pmt_total > 0 THEN LEAST(1, v_mrr / v_pmt_total) ELSE 0 END;

  -- Taux impayés
  SELECT COALESCE(impayes_rate / 100, 0) INTO v_impayes_rate
  FROM kpi_monthly WHERE agency_id = p_agency_id AND period = p_period;

  -- Payment consistency = 1 - taux impayés
  v_consistency := GREATEST(0, 1 - v_impayes_rate);

  -- Churn risk = contrats résiliés récents / total actifs
  WITH churn AS (
    SELECT
      COUNT(*) FILTER (WHERE statut IN ('resilie','expire')
        AND date_trunc('month', updated_at) = p_period) AS cancelled,
      COUNT(*) FILTER (WHERE statut = 'actif') AS actifs
    FROM contrats WHERE agency_id = p_agency_id
  )
  SELECT CASE WHEN (actifs + cancelled) > 0
    THEN ROUND(cancelled::numeric / (actifs + cancelled), 2)
    ELSE 0
  END INTO v_churn_risk FROM churn;

  -- Revenue Quality Score = (recurring_ratio × 0.4 + consistency × 0.4) × (1 - churn_risk × 0.2)
  v_quality := ROUND(
    (v_recurring_ratio * 0.4 + v_consistency * 0.4 + (1 - v_churn_risk) * 0.2),
    2
  );

  -- LTV = MRR × retention estimée (cohort si disponible, sinon 12 mois)
  SELECT COALESCE(
    EXTRACT(MONTH FROM (now() - first_payment_at))::numeric, 12
  ) INTO v_retention_months
  FROM agencies WHERE id = p_agency_id;

  v_ltv := v_mrr * GREATEST(v_retention_months, 1);

  -- Upsert kpi_monthly avec les nouvelles métriques
  INSERT INTO kpi_monthly (
    agency_id, period, mrr, revenue_quality_score,
    recurring_ratio, churn_risk, payment_consistency, ltv
  )
  VALUES (
    p_agency_id, p_period, v_mrr, v_quality,
    ROUND(v_recurring_ratio * 100, 2),
    v_churn_risk, v_consistency, v_ltv
  )
  ON CONFLICT (agency_id, period) DO UPDATE SET
    revenue_quality_score = EXCLUDED.revenue_quality_score,
    recurring_ratio       = EXCLUDED.recurring_ratio,
    churn_risk            = EXCLUDED.churn_risk,
    payment_consistency   = EXCLUDED.payment_consistency,
    ltv                   = EXCLUDED.ltv,
    computed_at           = now();
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Propagation trace_id outbox → job (upgrade fn_enqueue_jobs_from_outbox)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_enqueue_jobs_from_outbox(p_limit int DEFAULT 50)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    IF v_event.event_type IN ('paiement.created','paiement.cancelled') THEN
      INSERT INTO job_queue (type, agency_id, payload, source_event_id, priority, trace_id)
      VALUES ('GENERATE_LEDGER', v_event.agency_id,
        jsonb_build_object('event_id', v_event.id, 'entity_id', v_event.entity_id),
        v_event.id, 1, v_event.trace_id);

      INSERT INTO job_queue (type, agency_id, payload, source_event_id, priority, trace_id)
      VALUES ('RECONCILE_FINANCE', v_event.agency_id,
        jsonb_build_object('period', date_trunc('month', v_event.created_at)::date),
        v_event.id, 3, v_event.trace_id);
    END IF;

    IF v_event.event_type IN ('paiement.created','contrat.created','paiement.cancelled') THEN
      INSERT INTO job_queue (type, agency_id, payload, source_event_id, priority, trace_id)
      VALUES ('RECALCUL_KPI', v_event.agency_id,
        jsonb_build_object('date', CURRENT_DATE, 'period', date_trunc('month', CURRENT_DATE)::date),
        v_event.id, 5, v_event.trace_id);
    END IF;

    IF v_event.event_type IN ('contrat.created','paiement.created') THEN
      INSERT INTO job_queue (type, agency_id, payload, source_event_id, priority, trace_id)
      VALUES ('UPDATE_COHORT', v_event.agency_id,
        jsonb_build_object('agency_id', v_event.agency_id),
        v_event.id, 7, v_event.trace_id);
    END IF;

    UPDATE event_outbox SET status = 'processed', processed_at = now()
    WHERE id = v_event.id;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. PG_CRON — Self-heal + Revenue Quality automatiques
-- ─────────────────────────────────────────────────────────────────────────────

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Self-heal toutes les 30 minutes
    PERFORM cron.unschedule('self-heal')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'self-heal');
    PERFORM cron.schedule('self-heal', '*/30 * * * *',
      'SELECT fn_self_heal()');

    -- Revenue Quality Score : toutes les heures
    PERFORM cron.unschedule('revenue-quality')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'revenue-quality');
    PERFORM cron.schedule('revenue-quality', '0 * * * *',
      'SELECT fn_compute_revenue_quality(id, date_trunc(''month'', CURRENT_DATE)::date) FROM agencies WHERE pilot_status IN (''active'',''trial'')');

    -- Nettoyage snapshots santé vieux > 7 jours
    PERFORM cron.unschedule('cleanup-health')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-health');
    PERFORM cron.schedule('cleanup-health', '0 3 * * *',
      'DELETE FROM system_health WHERE snapshot_at < now() - interval ''7 days''');

  END IF;
END; $do$;
