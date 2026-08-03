-- =============================================================================
-- Migration : 20260708000001_security_search_path_and_ledger_fix
-- Objectif  : P0/P1 Security & Integrity Hardening (Audit V2 - Objectif 90+/100)
--             1. FIX search_path mutable sur fonctions financières (linter 0011)
--             2. RLS Hardening : TO service_role sur tables outbox/ledger/jobs
--             3. Vues SECURITY INVOKER + isolation tenant stricte
--             4. Suppression clause agency_id IS NULL sur bilans_mensuels
--             5. Trigger fn_update_bilan_mensuel bloquant (business) / queue (tech)
--             6. Unification documentaire storage_path / file_url
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FIX search_path mutable sur fonctions financières & critiques (linter 0011)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  func_record RECORD;
  func_names TEXT[] := ARRAY[
    'validate_ledger_integrity',
    'export_certified_ledger',
    'get_financial_kpis',
    'get_baileur_revenue_breakdown',
    'get_monthly_ledger',
    'get_commission_breakdown',
    'fn_default_page_access',
    'touch_document_registry_updated_at'
  ];
  fn_name TEXT;
BEGIN
  FOREACH fn_name IN ARRAY func_names LOOP
    FOR func_record IN 
      SELECT pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn_name
    LOOP
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp;', fn_name, func_record.args);
    END LOOP;
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS Hardening : TO service_role direct (Correction contradiction authenticated)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "outbox_insert_service" ON public.event_outbox;
DROP POLICY IF EXISTS "outbox_insert_all" ON public.event_outbox;
CREATE POLICY "outbox_insert_service" ON public.event_outbox
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "event_insert_service" ON public.event_log;
CREATE POLICY "event_insert_service" ON public.event_log
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "ledger_insert_service" ON public.ledger_entries;
CREATE POLICY "ledger_insert_service" ON public.ledger_entries
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "snapshots_insert_service" ON public.financial_snapshots;
CREATE POLICY "snapshots_insert_service" ON public.financial_snapshots
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "snapshots_update_service" ON public.financial_snapshots;
CREATE POLICY "snapshots_update_service" ON public.financial_snapshots
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "health_insert" ON public.system_health;
DROP POLICY IF EXISTS "health_insert_service" ON public.system_health;
CREATE POLICY "health_insert_service" ON public.system_health
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "kpi_daily_insert_service" ON public.kpi_daily;
CREATE POLICY "kpi_daily_insert_service" ON public.kpi_daily
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "kpi_daily_update_service" ON public.kpi_daily;
CREATE POLICY "kpi_daily_update_service" ON public.kpi_daily
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "kpi_monthly_insert_service" ON public.kpi_monthly;
CREATE POLICY "kpi_monthly_insert_service" ON public.kpi_monthly
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "kpi_monthly_update_service" ON public.kpi_monthly;
CREATE POLICY "kpi_monthly_update_service" ON public.kpi_monthly
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cache_insert_service" ON public.cache_store;
CREATE POLICY "cache_insert_service" ON public.cache_store
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "cache_update_service" ON public.cache_store;
CREATE POLICY "cache_update_service" ON public.cache_store
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cache_delete_service" ON public.cache_store;
CREATE POLICY "cache_delete_service" ON public.cache_store
  FOR DELETE TO service_role USING (true);

DROP POLICY IF EXISTS "jobs_insert_service" ON public.job_queue;
CREATE POLICY "jobs_insert_service" ON public.job_queue
  FOR INSERT TO service_role WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Vues SECURITY INVOKER + isolation tenant explicite
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.vw_financial_drift_report CASCADE;
CREATE OR REPLACE VIEW public.vw_financial_drift_report WITH (security_invoker = true) AS
SELECT
  fs.agency_id,
  a.name         AS agency_nom,
  fs.period,
  fs.total_paiements,
  fs.total_ledger_credits,
  fs.diff        AS ecart,
  fs.status,
  fs.drift_details,
  fs.computed_at
FROM public.financial_snapshots fs
JOIN public.agencies a ON a.id = fs.agency_id
WHERE fs.status = 'drift'
  AND (fs.agency_id = public.current_user_agency_id() OR public.is_super_admin())
ORDER BY ABS(fs.diff) DESC, fs.period DESC;

COMMENT ON VIEW public.vw_financial_drift_report IS
  'Rapport drift comptable certifié tenant-safe (SECURITY INVOKER)';

DROP VIEW IF EXISTS public.vw_system_anomalies CASCADE;
CREATE OR REPLACE VIEW public.vw_system_anomalies WITH (security_invoker = true) AS
  -- Paiements sans contrat valide
  SELECT
    p.agency_id,
    'paiement_sans_contrat'::text AS anomaly_type,
    p.id                          AS entity_id,
    jsonb_build_object('paiement_id', p.id, 'montant', p.montant_total, 'date', p.date_paiement) AS details
  FROM public.paiements p
  LEFT JOIN public.contrats c ON c.id = p.contrat_id AND c.agency_id = p.agency_id
  WHERE c.id IS NULL AND p.statut != 'annule'
    AND (p.agency_id = public.current_user_agency_id() OR public.is_super_admin())

  UNION ALL

  -- Unités 'loue' sans contrat actif
  SELECT
    u.agency_id,
    'unite_loue_sans_contrat_actif'::text,
    u.id,
    jsonb_build_object('unite_id', u.id, 'nom', u.nom)
  FROM public.unites u
  WHERE u.statut = 'loue'
    AND NOT EXISTS (
      SELECT 1 FROM public.contrats c WHERE c.unite_id = u.id AND c.statut = 'actif'
    )
    AND (u.agency_id = public.current_user_agency_id() OR public.is_super_admin())

  UNION ALL

  -- Agences avec pilot_status=trial depuis > 30 jours (étanchéité stricte tenant)
  SELECT
    a.id,
    'pilot_inactif'::text,
    a.id,
    jsonb_build_object('agency_id', a.id, 'nom', a.name, 'since_days',
      EXTRACT(DAY FROM now() - a.created_at)::int)
  FROM public.agencies a
  WHERE a.pilot_status = 'trial'
    AND a.created_at < now() - interval '30 days'
    AND a.first_payment_at IS NULL
    AND (a.id = public.current_user_agency_id() OR public.is_super_admin());

COMMENT ON VIEW public.vw_system_anomalies IS
  'Anomalies système tenant-safe (SECURITY INVOKER)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Supprimer la clause agency_id IS NULL sur bilans_mensuels
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bilans_select_agency" ON public.bilans_mensuels;

CREATE POLICY "bilans_select_agency" ON public.bilans_mensuels
  FOR SELECT USING (
    agency_id = public.current_user_agency_id()
    OR public.is_super_admin()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Table de queue de réconciliation des bilans en échec & fonction durcie
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bilan_reconciliation_queue (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  mois_concerne date        NOT NULL,
  paiement_id   uuid,
  status        text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  retry_count   int         NOT NULL DEFAULT 0,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz,
  UNIQUE (agency_id, mois_concerne, paiement_id)
);

ALTER TABLE public.bilan_reconciliation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bilan_queue_select_admin" ON public.bilan_reconciliation_queue;
CREATE POLICY "bilan_queue_select_admin" ON public.bilan_reconciliation_queue
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS "bilan_queue_service_only" ON public.bilan_reconciliation_queue;
CREATE POLICY "bilan_queue_service_only" ON public.bilan_reconciliation_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_bilan_queue_pending
  ON public.bilan_reconciliation_queue(status, created_at)
  WHERE status IN ('pending', 'failed');

CREATE OR REPLACE FUNCTION public.fn_update_bilan_mensuel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_agency_id         uuid;
  v_mois              date;
  v_total_loyers      numeric := 0;
  v_total_commissions numeric := 0;
  v_total_net         numeric := 0;
  v_total_depenses    numeric := 0;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_agency_id := OLD.agency_id;
    v_mois      := date_trunc('month', OLD.mois_concerne)::date;
  ELSE
    v_agency_id := NEW.agency_id;
    v_mois      := date_trunc('month', NEW.mois_concerne)::date;
  END IF;

  -- Garde bloquante : erreur business
  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'BILAN_UPDATE_FORBIDDEN: agency_id manquant sur le paiement';
  END IF;

  -- Recalcul des agrégats du mois
  SELECT
    COALESCE(SUM(CASE WHEN statut IN ('paye', 'partiel') THEN montant_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN statut IN ('paye', 'partiel') THEN part_agence   ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN statut IN ('paye', 'partiel') THEN part_bailleur ELSE 0 END), 0)
  INTO v_total_loyers, v_total_commissions, v_total_net
  FROM public.paiements
  WHERE agency_id = v_agency_id
    AND date_trunc('month', mois_concerne)::date = v_mois
    AND deleted_at IS NULL;

  SELECT COALESCE(SUM(montant), 0)
  INTO v_total_depenses
  FROM public.depenses
  WHERE agency_id = v_agency_id
    AND date_trunc('month', date_depense)::date = v_mois
    AND actif = true
    AND deleted_at IS NULL;

  -- Upsert — erreurs techniques envoyées dans la queue pour rejeu asynchrone
  BEGIN
    INSERT INTO public.bilans_mensuels (
      agency_id, mois_concerne,
      total_loyers, total_commissions, net_bailleur,
      total_depenses, solde_net, updated_at
    )
    VALUES (
      v_agency_id, v_mois,
      v_total_loyers, v_total_commissions, v_total_net,
      v_total_depenses, v_total_commissions - v_total_depenses, now()
    )
    ON CONFLICT (agency_id, mois_concerne) DO UPDATE SET
      total_loyers      = EXCLUDED.total_loyers,
      total_commissions = EXCLUDED.total_commissions,
      net_bailleur      = EXCLUDED.net_bailleur,
      total_depenses    = EXCLUDED.total_depenses,
      solde_net         = EXCLUDED.solde_net,
      updated_at        = now();

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.bilan_reconciliation_queue (
      agency_id, mois_concerne, paiement_id, error_message
    )
    VALUES (
      v_agency_id, v_mois,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      SQLERRM
    )
    ON CONFLICT (agency_id, mois_concerne, paiement_id) DO UPDATE SET
      retry_count   = bilan_reconciliation_queue.retry_count + 1,
      error_message = EXCLUDED.error_message,
      status        = 'pending',
      processed_at  = NULL;

    RAISE LOG 'BILAN_QUEUED: agency=% mois=% paiement=% err=%',
      v_agency_id, v_mois,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      SQLERRM;
  END;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Unification storage_path et dépréciation file_url sur documents
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.documents
  ALTER COLUMN file_url DROP NOT NULL;

UPDATE public.documents
SET storage_path = coalesce(storage_path, file_url)
WHERE storage_path IS NULL;

COMMENT ON COLUMN public.documents.file_url IS
  'Deprecated: utiliser storage_path (source unique de vérité du bucket storage)';
