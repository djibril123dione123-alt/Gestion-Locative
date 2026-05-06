-- =============================================================================
-- Phase 3 hardening: subscription payment idempotency
-- =============================================================================
-- Prevent double-clicks, browser refreshes and retry storms from creating
-- multiple pending PayDunya invoices for the same agency/payment attempt.

BEGIN;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_agency_idempotency
  ON public.payment_transactions(agency_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_pending_watchdog
  ON public.payment_transactions(status, created_at)
  WHERE status = 'pending';

COMMIT;
