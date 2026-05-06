-- =============================================================================
-- Phase 3 P0 hardening: finance, subscription security, outbox recovery
-- =============================================================================
--
-- Goals:
-- 1. Never write ledger revenue for unpaid/pending rent rows.
-- 2. Correct historic ledger pollution with immutable reversal entries.
-- 3. Recompute snapshots from paid/partial payments only.
-- 4. Prevent client-side subscription activation.
-- 5. Restart event_outbox -> job_queue for orphan pending events.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Ledger trigger: only cash-received statuses affect the ledger.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_after_paiement_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only money actually received belongs in the ledger.
  -- 'impaye' is a receivable, not cash. 'en_attente' is not confirmed cash.
  IF NEW.statut NOT IN ('paye', 'partiel') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.ledger_entries (
    agency_id, type, direction, montant, reference_type, reference_id, description, created_by
  )
  VALUES (
    NEW.agency_id,
    'paiement',
    'credit',
    NEW.montant_total,
    'paiements',
    NEW.id,
    'Paiement recu',
    NEW.created_by
  );

  IF NEW.part_agence IS NOT NULL AND NEW.part_agence > 0 THEN
    INSERT INTO public.ledger_entries (
      agency_id, type, direction, montant, reference_type, reference_id, description, created_by
    )
    VALUES (
      NEW.agency_id,
      'commission',
      'credit',
      NEW.part_agence,
      'paiements',
      NEW.id,
      'Commission agence',
      NEW.created_by
    );
  END IF;

  IF NEW.part_bailleur IS NOT NULL AND NEW.part_bailleur > 0 THEN
    INSERT INTO public.ledger_entries (
      agency_id, type, direction, montant, reference_type, reference_id, description, created_by
    )
    VALUES (
      NEW.agency_id,
      'part_bailleur',
      'debit',
      NEW.part_bailleur,
      'paiements',
      NEW.id,
      'Part bailleur a reverser',
      NEW.created_by
    );
  END IF;

  UPDATE public.agencies
    SET first_payment_at = COALESCE(first_payment_at, now())
  WHERE id = NEW.agency_id;

  UPDATE public.agencies
    SET
      activation_at = COALESCE(activation_at, now()),
      pilot_status = CASE WHEN pilot_status = 'trial' THEN 'pilot' ELSE pilot_status END
  WHERE id = NEW.agency_id
    AND first_contract_at IS NOT NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_paiement_insert ON public.paiements;
CREATE TRIGGER trg_after_paiement_insert
  AFTER INSERT ON public.paiements
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_after_paiement_insert();

-- -----------------------------------------------------------------------------
-- 2. Correct historical ledger pollution without deleting immutable history.
-- -----------------------------------------------------------------------------

INSERT INTO public.ledger_entries (
  agency_id, type, direction, montant, reference_type, reference_id, description, created_by
)
SELECT
  l.agency_id,
  CASE
    WHEN l.type = 'paiement' THEN 'correction_paiement'
    WHEN l.type = 'commission' THEN 'correction_commission'
    WHEN l.type = 'part_bailleur' THEN 'correction_part_bailleur'
    ELSE 'correction_ledger'
  END,
  CASE WHEN l.direction = 'credit' THEN 'debit' ELSE 'credit' END,
  l.montant,
  l.reference_type,
  l.reference_id,
  'Correction automatique: ecriture ledger generee pour paiement non encaisse',
  l.created_by
FROM public.ledger_entries l
JOIN public.paiements p ON p.id = l.reference_id
WHERE l.reference_type = 'paiements'
  AND l.type IN ('paiement', 'commission', 'part_bailleur')
  AND p.statut NOT IN ('paye', 'partiel')
  AND NOT EXISTS (
    SELECT 1
    FROM public.ledger_entries c
    WHERE c.reference_type = l.reference_type
      AND c.reference_id = l.reference_id
      AND c.montant = l.montant
      AND c.type = CASE
        WHEN l.type = 'paiement' THEN 'correction_paiement'
        WHEN l.type = 'commission' THEN 'correction_commission'
        WHEN l.type = 'part_bailleur' THEN 'correction_part_bailleur'
        ELSE 'correction_ledger'
      END
  );

-- -----------------------------------------------------------------------------
-- 3. Reconciliation: paid/partial payments vs net payment ledger.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_compute_financial_snapshots(
  p_period date DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS TABLE (
  agency_id   uuid,
  period      date,
  total_pmt   numeric,
  total_ledgr numeric,
  ecart       numeric,
  statut      text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_agency          record;
  v_total_paiements numeric;
  v_total_ledger    numeric;
  v_ecart           numeric;
  v_status          text;
  v_drift_details   jsonb;
BEGIN
  FOR v_agency IN SELECT a.id FROM public.agencies a LOOP
    SELECT COALESCE(SUM(p.montant_total), 0)
    INTO v_total_paiements
    FROM public.paiements p
    WHERE p.agency_id = v_agency.id
      AND p.statut IN ('paye', 'partiel')
      AND date_trunc('month', p.created_at)::date = p_period;

    SELECT COALESCE(SUM(
      CASE
        WHEN le.direction = 'credit' THEN le.montant
        WHEN le.direction = 'debit' THEN -le.montant
        ELSE 0
      END
    ), 0)
    INTO v_total_ledger
    FROM public.ledger_entries le
    WHERE le.agency_id = v_agency.id
      AND le.type IN ('paiement', 'correction_paiement')
      AND date_trunc('month', le.created_at)::date = p_period;

    v_ecart := v_total_paiements - v_total_ledger;
    v_status := CASE WHEN v_ecart = 0 THEN 'ok' ELSE 'drift' END;
    v_drift_details := CASE
      WHEN v_ecart != 0 THEN jsonb_build_object(
        'ecart', v_ecart,
        'total_paiements_paid_or_partial', v_total_paiements,
        'total_ledger_net_cash', v_total_ledger,
        'period', p_period,
        'computed_at', now()
      )
      ELSE NULL
    END;

    INSERT INTO public.financial_snapshots AS fs (
      agency_id, period, total_paiements, total_ledger_credits, status, drift_details, computed_at
    )
    VALUES (
      v_agency.id, p_period, v_total_paiements, v_total_ledger, v_status, v_drift_details, now()
    )
    ON CONFLICT ON CONSTRAINT financial_snapshots_agency_id_period_key DO UPDATE SET
      total_paiements = EXCLUDED.total_paiements,
      total_ledger_credits = EXCLUDED.total_ledger_credits,
      status = EXCLUDED.status,
      drift_details = EXCLUDED.drift_details,
      computed_at = now();

    RETURN QUERY SELECT
      v_agency.id,
      p_period,
      v_total_paiements,
      v_total_ledger,
      v_ecart,
      v_status;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_compute_financial_snapshots(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_compute_financial_snapshots(date) TO service_role;

-- -----------------------------------------------------------------------------
-- 4. Subscription activation: service role only, transaction-verified.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_agency_id      uuid,
  p_plan_id        text,
  p_transaction_id uuid,
  p_amount_xof     integer,
  p_phone          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_txn record;
  v_period_end timestamptz := now() + interval '30 days';
BEGIN
  SELECT *
  INTO v_txn
  FROM public.payment_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSACTION_NOT_FOUND';
  END IF;

  IF v_txn.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  IF v_txn.status <> 'pending' THEN
    RAISE EXCEPTION 'TRANSACTION_NOT_PENDING: %', v_txn.status;
  END IF;

  IF v_txn.agency_id <> p_agency_id
     OR v_txn.plan_id <> p_plan_id
     OR v_txn.amount_xof <> p_amount_xof THEN
    RAISE EXCEPTION 'TRANSACTION_MISMATCH';
  END IF;

  IF v_txn.invoice_token IS NULL THEN
    RAISE EXCEPTION 'TRANSACTION_WITHOUT_INVOICE_TOKEN';
  END IF;

  UPDATE public.agencies SET
    status = 'active',
    plan = p_plan_id,
    last_payment_at = now(),
    next_renewal_at = v_period_end,
    suspension_at = NULL,
    payment_phone = COALESCE(p_phone, payment_phone),
    updated_at = now()
  WHERE id = p_agency_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AGENCY_NOT_FOUND';
  END IF;

  INSERT INTO public.subscriptions (
    agency_id, plan_id, status, current_period_start, current_period_end
  )
  VALUES (p_agency_id, p_plan_id, 'active', now(), v_period_end)
  ON CONFLICT (agency_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'active',
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = now();

  UPDATE public.payment_transactions
  SET status = 'completed', updated_at = now()
  WHERE id = p_transaction_id;

  INSERT INTO public.notification_queue (
    agency_id, type, channel, template_data, scheduled_for
  )
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

REVOKE ALL ON FUNCTION public.activate_subscription(uuid, text, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription(uuid, text, uuid, integer, text)
  TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_invoice_token_unique
  ON public.payment_transactions(invoice_token)
  WHERE invoice_token IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. Outbox recovery and schema compatibility.
-- -----------------------------------------------------------------------------

ALTER TABLE public.job_queue
  ADD COLUMN IF NOT EXISTS retry_strategy text NOT NULL DEFAULT 'linear';

CREATE INDEX IF NOT EXISTS idx_job_queue_retry_strategy
  ON public.job_queue(retry_strategy);

DO $$
BEGIN
  IF to_regclass('public.job_queue') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_proc
       WHERE proname = 'fn_enqueue_jobs_from_outbox'
     ) THEN
    PERFORM public.fn_enqueue_jobs_from_outbox(1000);
  END IF;
END;
$$;

-- Recompute current month after corrections.
SELECT public.fn_compute_financial_snapshots(date_trunc('month', CURRENT_DATE)::date);

COMMIT;
