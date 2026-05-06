-- =============================================================================
-- Fix Autopilot analytics worker locking
-- =============================================================================
-- Postgres rejects FOR UPDATE on a DISTINCT ON query. The previous function
-- therefore crashed before processing any analytics backlog. This version locks
-- a deterministic batch of pending jobs directly and lets idempotent KPI/cohort
-- upserts absorb duplicates safely.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_worker_analytics(p_batch_size int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job    RECORD;
  v_done   int := 0;
  v_failed int := 0;
BEGIN
  FOR v_job IN
    SELECT *
    FROM public.job_queue
    WHERE type IN ('RECALCUL_KPI', 'UPDATE_COHORT', 'SYNC_POSTHOG')
      AND status = 'pending'
      AND next_retry_at <= now()
    ORDER BY priority ASC, created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.job_queue
    SET status = 'processing', started_at = now()
    WHERE id = v_job.id;

    BEGIN
      IF v_job.type = 'RECALCUL_KPI' THEN
        PERFORM public.fn_aggregate_kpi_daily(
          v_job.agency_id,
          COALESCE((v_job.payload->>'date')::date, CURRENT_DATE)
        );
        PERFORM public.fn_aggregate_kpi_monthly(
          v_job.agency_id,
          COALESCE((v_job.payload->>'period')::date, date_trunc('month', CURRENT_DATE)::date)
        );
      END IF;

      IF v_job.type = 'UPDATE_COHORT' THEN
        INSERT INTO public.agency_cohort (
          agency_id, signup_week, first_contract_week, first_payment_week,
          conversion_time_days, retention_30d, retention_60d, retention_90d, updated_at
        )
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
        FROM public.agencies a
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

      UPDATE public.job_queue
      SET status = 'done', completed_at = now()
      WHERE id = v_job.id;
      v_done := v_done + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.job_queue
      SET
        status        = CASE WHEN retry_count >= max_retries THEN 'failed' ELSE 'pending' END,
        retry_count   = retry_count + 1,
        next_retry_at = now() + interval '5 minutes' * (retry_count + 1),
        error         = SQLERRM
      WHERE id = v_job.id;
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('done', v_done, 'failed', v_failed, 'processed_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.fn_worker_analytics(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_worker_analytics(int) TO service_role;

COMMIT;
