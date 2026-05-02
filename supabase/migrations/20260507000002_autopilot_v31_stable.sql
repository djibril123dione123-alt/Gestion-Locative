-- =============================================================================
-- Migration : 20260507000002_autopilot_v31_stable
-- Objectif  : Autopilot V3.1 — Série A stable
--             • job_queue simplifié (drop weight_cost / tenant_load_score / retry_strategy)
--             • kpi_monthly épuré  (drop LTV/CAC complexes, add churn_rate simple)
--             • system_health enrichi (processing_time_avg, ledger_drift, uptime_workers)
--             • fn_evaluate_job V3.1 (priority only, no retry_strategy)
--             • fn_snapshot_health V3.1 (ledger_drift + processing_time_avg)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. JOB_QUEUE — Suppression colonnes complexes V2
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE job_queue
  DROP COLUMN IF EXISTS weight_cost,
  DROP COLUMN IF EXISTS tenant_load_score,
  DROP COLUMN IF EXISTS retry_strategy;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. KPI_MONTHLY — Suppression métriques opaques V2, ajout churn_rate standard
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE kpi_monthly
  DROP COLUMN IF EXISTS ltv,
  DROP COLUMN IF EXISTS cac,
  DROP COLUMN IF EXISTS ltv_cac_ratio,
  DROP COLUMN IF EXISTS revenue_quality_score,
  DROP COLUMN IF EXISTS recurring_ratio,
  DROP COLUMN IF EXISTS churn_risk,
  DROP COLUMN IF EXISTS payment_consistency;

ALTER TABLE kpi_monthly
  ADD COLUMN IF NOT EXISTS churn_rate      numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mrr_prev_period numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mrr_growth      numeric(7,2)  NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SYSTEM_HEALTH — Enrichissement observabilité
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE system_health
  ADD COLUMN IF NOT EXISTS processing_time_avg int         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ledger_drift        numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uptime_workers      jsonb       NOT NULL DEFAULT '{"finance":true,"analytics":true,"notification":true}'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. fn_evaluate_job V3.1 — Priority only, pas de retry_strategy (colonne supprimée)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_evaluate_job(p_job_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $do$
DECLARE
  v_job  RECORD;
  v_prio int;
BEGIN
  SELECT * INTO v_job FROM job_queue WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Priorité déterministe par type — pas de lecture externe, pas de side effect
  v_prio := CASE v_job.type
    WHEN 'GENERATE_LEDGER'           THEN 1
    WHEN 'RECONCILE_FINANCE'         THEN 2
    WHEN 'KPI_DAILY_AGGREGATION'     THEN 4
    WHEN 'KPI_MONTHLY_AGGREGATION'   THEN 5
    WHEN 'UPDATE_COHORT'             THEN 7
    WHEN 'SEND_NOTIFICATION'         THEN 8
    ELSE v_job.priority
  END;

  UPDATE job_queue SET priority = v_prio WHERE id = p_job_id;
END;
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. fn_snapshot_health V3.1 — Inclut ledger_drift et processing_time_avg
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_snapshot_health()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $do$
DECLARE
  v_backlog      int;
  v_failed       int;
  v_orphans      int;
  v_drifts       int;
  v_total        int;
  v_fail_h       int;
  v_score        numeric;
  v_rate         numeric;
  v_drift_amount numeric(14,2) := 0;
  v_avg_ms       int := 0;
BEGIN
  SELECT COUNT(*) INTO v_backlog FROM job_queue WHERE status = 'pending';
  SELECT COUNT(*) INTO v_failed  FROM job_queue WHERE status = 'failed';
  SELECT COUNT(*) INTO v_orphans
    FROM event_outbox
    WHERE status = 'pending' AND created_at < now() - interval '15 minutes';
  SELECT COUNT(*) INTO v_drifts
    FROM financial_snapshots WHERE status = 'drift';

  -- Ledger drift total : somme des écarts sur le mois courant
  SELECT COALESCE(SUM(ABS(diff)), 0) INTO v_drift_amount
    FROM financial_snapshots
    WHERE status = 'drift'
      AND period = date_trunc('month', CURRENT_DATE)::date;

  -- Failure rate (dernière heure)
  SELECT
    COUNT(*) FILTER (WHERE status IN ('done','failed')),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO v_total, v_fail_h
  FROM job_queue WHERE created_at > now() - interval '1 hour';

  v_rate := CASE WHEN v_total > 0
    THEN ROUND((v_fail_h::numeric / v_total) * 100, 2)
    ELSE 0
  END;

  -- Temps moyen de traitement des jobs terminés (dernière heure, en ms)
  SELECT COALESCE(
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000)::int, 0
  ) INTO v_avg_ms
  FROM job_queue
  WHERE status = 'done' AND created_at > now() - interval '1 hour';

  -- Score de santé 0→1
  v_score := GREATEST(0, LEAST(1,
    1.0
    - (CASE WHEN v_backlog > 100 THEN 0.2 ELSE 0 END)
    - (CASE WHEN v_failed  > 10  THEN 0.3 ELSE LEAST(0.2, v_failed::numeric / 50) END)
    - (CASE WHEN v_orphans > 5   THEN 0.2 ELSE 0 END)
    - (CASE WHEN v_drifts  > 0   THEN 0.15 ELSE 0 END)
  ));

  INSERT INTO system_health (
    queue_backlog, failed_jobs, orphan_events, stale_jobs,
    drift_agencies, worker_latency_ms, failure_rate, health_score, actions_taken,
    processing_time_avg, ledger_drift
  ) VALUES (
    v_backlog, v_failed, v_orphans, 0,
    v_drifts, v_avg_ms, v_rate, v_score, '[]'::jsonb,
    v_avg_ms, v_drift_amount
  );

  -- Garder les 200 derniers snapshots
  DELETE FROM system_health
  WHERE id NOT IN (
    SELECT id FROM system_health ORDER BY snapshot_at DESC LIMIT 200
  );
END;
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. fn_aggregate_kpi_monthly V3.1 — Calcule churn_rate et mrr_growth
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_aggregate_kpi_monthly(
  p_agency_id uuid,
  p_period    date DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $do$
DECLARE
  v_mrr           numeric := 0;
  v_pmt_total     numeric := 0;
  v_contrats      int     := 0;
  v_impayes_rate  numeric := 0;
  v_new_c         int     := 0;
  v_cancel_c      int     := 0;
  v_churn_rate    numeric := 0;
  v_mrr_prev      numeric := 0;
  v_mrr_growth    numeric := 0;
  v_prev_period   date;
BEGIN
  v_prev_period := (p_period - interval '1 month')::date;

  -- MRR = somme loyers actifs
  SELECT COALESCE(SUM(loyer_mensuel), 0) INTO v_mrr
  FROM contrats WHERE agency_id = p_agency_id AND statut = 'actif';

  -- MRR période précédente (pour mrr_growth)
  SELECT COALESCE(mrr, 0) INTO v_mrr_prev
  FROM kpi_monthly WHERE agency_id = p_agency_id AND period = v_prev_period;

  v_mrr_growth := CASE WHEN v_mrr_prev > 0
    THEN ROUND(((v_mrr - v_mrr_prev) / v_mrr_prev) * 100, 2)
    ELSE 0
  END;

  -- Paiements du mois
  SELECT COALESCE(SUM(montant_total), 0) INTO v_pmt_total
  FROM paiements
  WHERE agency_id = p_agency_id AND statut != 'annule'
    AND date_trunc('month', mois_concerne::date) = p_period;

  -- Contrats actifs
  SELECT COUNT(*) INTO v_contrats
  FROM contrats WHERE agency_id = p_agency_id AND statut = 'actif';

  -- Taux impayés
  WITH pmts AS (
    SELECT COUNT(*) FILTER (WHERE statut = 'impaye') AS imp,
           COUNT(*) AS total
    FROM paiements WHERE agency_id = p_agency_id
      AND date_trunc('month', mois_concerne::date) = p_period
  )
  SELECT CASE WHEN total > 0 THEN ROUND((imp::numeric / total) * 100, 2) ELSE 0 END
  INTO v_impayes_rate FROM pmts;

  -- Nouveaux contrats
  SELECT COUNT(*) INTO v_new_c
  FROM contrats WHERE agency_id = p_agency_id
    AND date_trunc('month', created_at) = p_period
    AND statut != 'annule';

  -- Contrats résiliés
  SELECT COUNT(*) INTO v_cancel_c
  FROM contrats WHERE agency_id = p_agency_id
    AND date_trunc('month', updated_at) = p_period
    AND statut IN ('resilie','expire');

  -- Churn rate = résiliés / (actifs + résiliés)
  v_churn_rate := CASE WHEN (v_contrats + v_cancel_c) > 0
    THEN ROUND((v_cancel_c::numeric / (v_contrats + v_cancel_c)) * 100, 2)
    ELSE 0
  END;

  INSERT INTO kpi_monthly (
    agency_id, period, mrr, paiements_total, contrats_actifs,
    impayes_rate, new_contracts, cancelled_contracts,
    churn_rate, mrr_prev_period, mrr_growth
  )
  VALUES (
    p_agency_id, p_period, v_mrr, v_pmt_total, v_contrats,
    v_impayes_rate, v_new_c, v_cancel_c,
    v_churn_rate, v_mrr_prev, v_mrr_growth
  )
  ON CONFLICT (agency_id, period) DO UPDATE SET
    mrr                = EXCLUDED.mrr,
    paiements_total    = EXCLUDED.paiements_total,
    contrats_actifs    = EXCLUDED.contrats_actifs,
    impayes_rate       = EXCLUDED.impayes_rate,
    new_contracts      = EXCLUDED.new_contracts,
    cancelled_contracts= EXCLUDED.cancelled_contracts,
    churn_rate         = EXCLUDED.churn_rate,
    mrr_prev_period    = EXCLUDED.mrr_prev_period,
    mrr_growth         = EXCLUDED.mrr_growth,
    computed_at        = now();
END;
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. PG_CRON — Ajout notification-worker
-- ─────────────────────────────────────────────────────────────────────────────

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Notification worker : toutes les 30 minutes
    PERFORM cron.unschedule('notification-worker')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notification-worker');
    PERFORM cron.schedule('notification-worker', '*/30 * * * *',
      'SELECT fn_enqueue_jobs_from_outbox(0)'); -- déclenche via job SEND_NOTIFICATION

  END IF;
END; $do$;
