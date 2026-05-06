-- =============================================================================
-- Phase 3 hardening: stale subscription payment watchdog
-- =============================================================================
-- A PayDunya invoice can remain pending forever if the browser is closed, the
-- callback never arrives, or the provider has an incident. This RPC gives
-- service-role workers/admin maintenance a safe way to expire old pending rows
-- without touching fresh payments.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_expire_stale_payment_transactions(
  p_grace_minutes integer DEFAULT 1440
)
RETURNS TABLE (
  expired_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_grace_minutes < 60 THEN
    RAISE EXCEPTION 'GRACE_PERIOD_TOO_SHORT';
  END IF;

  UPDATE public.payment_transactions
  SET
    status = 'failed',
    updated_at = now(),
    webhook_raw = COALESCE(webhook_raw, '{}'::jsonb) || jsonb_build_object(
      'watchdog', 'expired_stale_pending',
      'expired_at', now(),
      'grace_minutes', p_grace_minutes
    )
  WHERE status = 'pending'
    AND created_at < now() - make_interval(mins => p_grace_minutes);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_expire_stale_payment_transactions(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_expire_stale_payment_transactions(integer)
  TO service_role;

COMMIT;
