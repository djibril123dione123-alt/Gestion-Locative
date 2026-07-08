-- ==============================================================================
-- SAMAY KËUR — HARDENING SÉCURITÉ AUDIT V2 & RÉSOLUTION DES FINDINGS LINTER
-- Migration 20260708000002_audit_v2_security_revokes_and_hardening.sql
-- ==============================================================================

-- 1. P0-1 : Sécurisation de vw_financial_drift_report en SECURITY INVOKER + Filtre Tenant
CREATE OR REPLACE VIEW public.vw_financial_drift_report
WITH (security_invoker = true)
AS
SELECT 
  a.id AS agency_id,
  a.name AS agency_nom,
  COALESCE(le.total_ledger_credits, 0) AS ledger_total_credits,
  COALESCE(pm.total_paiements_payes, 0) AS paiements_total_payes,
  COALESCE(le.total_ledger_credits, 0) - COALESCE(pm.total_paiements_payes, 0) AS ecart_reconciliation,
  NOW() AS last_checked_at
FROM public.agencies a
LEFT JOIN (
  SELECT agency_id, SUM(montant) AS total_ledger_credits
  FROM public.ledger_entries
  WHERE direction = 'credit'
  GROUP BY agency_id
) le ON a.id = le.agency_id
LEFT JOIN (
  SELECT agency_id, SUM(montant_total) AS total_paiements_payes
  FROM public.paiements
  WHERE statut = 'paye'
  GROUP BY agency_id
) pm ON a.id = pm.agency_id
WHERE a.id = COALESCE(
  NULLIF(current_setting('request.jwt.claim.agency_id', true), '')::uuid,
  (SELECT up.agency_id FROM public.user_profiles up WHERE up.id = auth.uid())
);

-- 2. P0-2 : Sécurisation de vw_system_anomalies en SECURITY INVOKER + Filtre Tenant
CREATE OR REPLACE VIEW public.vw_system_anomalies
WITH (security_invoker = true)
AS
SELECT 
  'AGENCY_LONG_TRIAL' AS anomaly_type,
  a.id AS entity_id,
  a.name AS description,
  a.created_at
FROM public.agencies a
WHERE a.status = 'trial' 
  AND a.created_at < NOW() - INTERVAL '30 days'
  AND a.id = COALESCE(
    NULLIF(current_setting('request.jwt.claim.agency_id', true), '')::uuid,
    (SELECT up.agency_id FROM public.user_profiles up WHERE up.id = auth.uid())
  );

-- 3. P0-3, P0-4, P0-5, P0-6 : REVOKE EXECUTE FROM anon et/ou authenticated
DO $$ 
DECLARE
  func_record RECORD;
  func_names_anon TEXT[] := ARRAY[
    'admin_console_snapshot',
    'admin_start_impersonation',
    'admin_audit_action',
    'admin_record_incident',
    'admin_resolve_incident',
    'admin_create_maintenance_announcement',
    'admin_upsert_feature_flag',
    'admin_create_admin_note',
    'admin_create_support_ticket',
    'admin_update_support_ticket',
    'archive_document_registry_duplicates',
    'archive_document_soft',
    'cleanup_temporary_documents',
    'can_upload_document',
    'fn_user_can'
  ];
  func_names_triggers TEXT[] := ARRAY[
    'fn_after_paiement_cash_transition',
    'fn_after_paiement_recompute_echeance',
    'fn_sync_bilan_mensuel_on_payment_update'
  ];
  fn_name TEXT;
BEGIN
  -- Révocation de anon pour fonctions admin & doc
  FOREACH fn_name IN ARRAY func_names_anon LOOP
    FOR func_record IN 
      SELECT pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn_name
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon;', fn_name, func_record.args);
    END LOOP;
  END LOOP;

  -- Révocation de anon ET authenticated pour triggers exposés en RPC
  FOREACH fn_name IN ARRAY func_names_triggers LOOP
    FOR func_record IN 
      SELECT pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn_name
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, authenticated;', fn_name, func_record.args);
    END LOOP;
  END LOOP;
END $$;

-- 4. P1-1, P1-2, P1-3 : Fix search_path mutable sur les fonctions financières et documentaires
DO $$
DECLARE
  func_record RECORD;
  func_names TEXT[] := ARRAY[
    'validate_ledger_integrity',
    'export_certified_ledger',
    'touch_document_registry_updated_at',
    'get_financial_kpis',
    'get_baileur_revenue_breakdown',
    'get_monthly_ledger',
    'get_commission_breakdown',
    'fn_default_page_access'
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
END $$;

-- 5. P2-6 : Index composite haute performance sur ledger_entries
CREATE INDEX IF NOT EXISTS idx_ledger_entries_composite_search 
ON public.ledger_entries(agency_id, type, direction, created_at);
