-- =============================================================================
-- Migration : 20260507000001_autopilot_v3_clean
-- Objectif  : Autopilot V3 — Architecture propre (Série A ready)
--             Suppression V2 : self-heal, rule engine complexe, KPI realtime
--             Remplacement : fn_evaluate_job simple + health snapshot passif
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SUPPRESSION V2 — triggers et fonctions complexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Supprimer le trigger rule engine sur job_queue
DROP TRIGGER IF EXISTS trg_rule_engine ON job_queue;

-- Supprimer les fonctions V2 complexes
DROP FUNCTION IF EXISTS fn_trigger_rule_engine() CASCADE;
DROP FUNCTION IF EXISTS fn_rule_engine(uuid) CASCADE;
DROP FUNCTION IF EXISTS fn_self_heal() CASCADE;
DROP FUNCTION IF EXISTS fn_compute_revenue_quality(uuid, date) CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PG_CRON — Suppression des jobs V2 inutiles
-- ─────────────────────────────────────────────────────────────────────────────

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Supprimer self-heal automatique
    PERFORM cron.unschedule('self-heal')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'self-heal');

    -- Supprimer revenue-quality automatique
    PERFORM cron.unschedule('revenue-quality')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'revenue-quality');

    -- Supprimer cleanup-health
    PERFORM cron.unschedule('cleanup-health')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-health');

  END IF;
END; $do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. fn_evaluate_job — Rule Engine V3 simplifié
--    Rôle unique : assigner priorité + retry_strategy + tagger le type
--    Interdit : auto-correction, mutation hors job_queue, exécution
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_evaluate_job(p_job_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $do$
DECLARE
  v_job      RECORD;
  v_prio     int;
  v_strategy text;
BEGIN
  SELECT * INTO v_job FROM job_queue WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Dead letter si max retries atteint
  IF v_job.retry_count >= v_job.max_retries THEN
    UPDATE job_queue SET retry_strategy = 'dead_letter' WHERE id = p_job_id;
    RETURN;
  END IF;

  -- Priorité par type de job (déterministe, sans lecture externe)
  v_prio := CASE v_job.type
    WHEN 'GENERATE_LEDGER'      THEN 1
    WHEN 'RECONCILE_FINANCE'    THEN 2
    WHEN 'KPI_DAILY_AGGREGATION'THEN 4
    WHEN 'KPI_MONTHLY_AGGREGATION' THEN 5
    WHEN 'UPDATE_COHORT'        THEN 7
    WHEN 'SEND_NOTIFICATION'    THEN 8
    ELSE v_job.priority
  END;

  -- Retry strategy par type
  v_strategy := CASE v_job.type
    WHEN 'GENERATE_LEDGER'      THEN 'exponential'
    WHEN 'RECONCILE_FINANCE'    THEN 'exponential'
    ELSE 'linear'
  END;

  UPDATE job_queue SET
    priority       = v_prio,
    retry_strategy = v_strategy
  WHERE id = p_job_id;
END;
$do$;

-- Trigger AFTER INSERT — classification pure, aucune exécution ni auto-correction
CREATE OR REPLACE FUNCTION fn_trigger_evaluate_job()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $do$
BEGIN
  PERFORM fn_evaluate_job(NEW.id);
  RETURN NEW;
END;
$do$;

DROP TRIGGER IF EXISTS trg_evaluate_job ON job_queue;
CREATE TRIGGER trg_evaluate_job
  AFTER INSERT ON job_queue
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_evaluate_job();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. fn_snapshot_health — Observabilité passive (appelée par les workers)
--    Rôle : lire l'état courant et insérer un snapshot dans system_health
--    Interdit : modifier quoi que ce soit d'autre
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_snapshot_health()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $do$
DECLARE
  v_backlog  int;
  v_failed   int;
  v_orphans  int;
  v_drifts   int;
  v_total    int;
  v_score    numeric;
  v_rate     numeric;
BEGIN
  SELECT COUNT(*) INTO v_backlog FROM job_queue WHERE status = 'pending';
  SELECT COUNT(*) INTO v_failed  FROM job_queue WHERE status = 'failed';
  SELECT COUNT(*) INTO v_orphans
    FROM event_outbox
    WHERE status = 'pending' AND created_at < now() - interval '15 minutes';
  SELECT COUNT(*) INTO v_drifts
    FROM financial_snapshots WHERE status = 'drift';

  SELECT
    COUNT(*) FILTER (WHERE status IN ('done','failed')),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO v_total, v_failed
  FROM job_queue WHERE created_at > now() - interval '1 hour';

  v_rate := CASE WHEN v_total > 0
    THEN ROUND((v_failed::numeric / v_total) * 100, 2)
    ELSE 0
  END;

  v_score := GREATEST(0, LEAST(1,
    1.0
    - (CASE WHEN v_backlog > 100 THEN 0.2 ELSE 0 END)
    - (CASE WHEN v_failed  > 10  THEN 0.3 ELSE LEAST(0.2, v_failed::numeric / 50) END)
    - (CASE WHEN v_orphans > 5   THEN 0.2 ELSE 0 END)
    - (CASE WHEN v_drifts  > 0   THEN 0.15 ELSE 0 END)
  ));

  INSERT INTO system_health (
    queue_backlog, failed_jobs, orphan_events, stale_jobs,
    drift_agencies, worker_latency_ms, failure_rate, health_score, actions_taken
  ) VALUES (
    v_backlog, v_failed, v_orphans, 0,
    v_drifts, 0, v_rate, v_score, '[]'::jsonb
  );

  -- Garder seulement les 200 derniers snapshots
  DELETE FROM system_health
  WHERE id NOT IN (
    SELECT id FROM system_health ORDER BY snapshot_at DESC LIMIT 200
  );
END;
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. fn_enqueue_jobs_from_outbox — Version V3 (inchangée fonctionnellement,
--    on s'assure juste qu'elle insère les bons types V3)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_enqueue_jobs_from_outbox(p_limit int DEFAULT 50)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $do$
DECLARE
  v_event  RECORD;
  v_count  int := 0;
BEGIN
  FOR v_event IN
    SELECT * FROM event_outbox
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Finance jobs → paiements
    IF v_event.event_type IN ('paiement.created','paiement.cancelled') THEN
      INSERT INTO job_queue (type, agency_id, payload, source_event_id, priority, trace_id)
      VALUES ('GENERATE_LEDGER', v_event.agency_id,
        jsonb_build_object('event_id', v_event.id, 'entity_id', v_event.entity_id),
        v_event.id, 1, v_event.trace_id)
      ON CONFLICT DO NOTHING;

      INSERT INTO job_queue (type, agency_id, payload, source_event_id, priority, trace_id)
      VALUES ('RECONCILE_FINANCE', v_event.agency_id,
        jsonb_build_object('period', date_trunc('month', v_event.created_at)::date),
        v_event.id, 2, v_event.trace_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- KPI batch jobs
    IF v_event.event_type IN ('paiement.created','contrat.created','paiement.cancelled') THEN
      INSERT INTO job_queue (type, agency_id, payload, source_event_id, priority, trace_id)
      VALUES ('KPI_DAILY_AGGREGATION', v_event.agency_id,
        jsonb_build_object('date', CURRENT_DATE),
        v_event.id, 4, v_event.trace_id)
      ON CONFLICT DO NOTHING;

      INSERT INTO job_queue (type, agency_id, payload, source_event_id, priority, trace_id)
      VALUES ('KPI_MONTHLY_AGGREGATION', v_event.agency_id,
        jsonb_build_object('period', date_trunc('month', CURRENT_DATE)::date),
        v_event.id, 5, v_event.trace_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Cohort update
    IF v_event.event_type IN ('contrat.created','paiement.created') THEN
      INSERT INTO job_queue (type, agency_id, payload, source_event_id, priority, trace_id)
      VALUES ('UPDATE_COHORT', v_event.agency_id,
        jsonb_build_object('agency_id', v_event.agency_id),
        v_event.id, 7, v_event.trace_id)
      ON CONFLICT DO NOTHING;
    END IF;

    UPDATE event_outbox SET status = 'processed', processed_at = now()
    WHERE id = v_event.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PG_CRON — Mise à jour boucle V3 (outbox, workers, cache uniquement)
-- ─────────────────────────────────────────────────────────────────────────────

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Outbox → jobs (inchangé)
    PERFORM cron.unschedule('enqueue-jobs-from-outbox')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enqueue-jobs-from-outbox');
    PERFORM cron.schedule('enqueue-jobs-from-outbox', '*/5 * * * *',
      'SELECT fn_enqueue_jobs_from_outbox(50)');

    -- Finance worker (inchangé)
    PERFORM cron.unschedule('finance-worker')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finance-worker');
    PERFORM cron.schedule('finance-worker', '*/10 * * * *',
      'SELECT fn_worker_finance(20)');

    -- Analytics worker (inchangé)
    PERFORM cron.unschedule('analytics-worker')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'analytics-worker');
    PERFORM cron.schedule('analytics-worker', '*/15 * * * *',
      'SELECT fn_worker_analytics(30)');

    -- Health snapshot passif toutes les 10 minutes (appelé aussi par les workers)
    PERFORM cron.unschedule('snapshot-health')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'snapshot-health');
    PERFORM cron.schedule('snapshot-health', '*/10 * * * *',
      'SELECT fn_snapshot_health()');

    -- Nettoyage cache expiré (inchangé)
    PERFORM cron.unschedule('cleanup-cache')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-cache');
    PERFORM cron.schedule('cleanup-cache', '0 * * * *',
      'DELETE FROM cache_store WHERE expires_at < now()');

  END IF;
END; $do$;
