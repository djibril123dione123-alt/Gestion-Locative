-- =============================================================================
-- HYPER SQL — Correction COMPLÈTE des avertissements Supabase Advisor
-- Migration : 20260511000001_security_hardening_complete.sql
--
-- Périmètre :
--   1. Vues SECURITY DEFINER     → DROP + CREATE sans l'attribut
--   2. RLS policy toujours true  → job_queue "jobs_insert_service" durcie
--   3. REVOKE EXECUTE FROM anon  → toutes les fonctions SECURITY DEFINER
--      (sauf accept_invitation + get_invitation_by_token : flux onboarding public)
--   4. REVOKE EXECUTE FROM authenticated → fonctions internes (triggers, workers)
--   5. FORCE ROW LEVEL SECURITY  → job_queue (précaution supplémentaire)
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. VUES — suppression de la propriété SECURITY DEFINER
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.vw_financial_drift_report;
CREATE VIEW public.vw_financial_drift_report AS
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
ORDER BY ABS(fs.diff) DESC, fs.period DESC;

COMMENT ON VIEW public.vw_financial_drift_report IS
  'Rapports drift comptable — toutes les agences avec écart paiements ↔ ledger (SECURITY INVOKER)';

-- ──

DROP VIEW IF EXISTS public.vw_system_anomalies;
CREATE VIEW public.vw_system_anomalies AS
  -- Paiements sans contrat valide
  SELECT
    p.agency_id,
    'paiement_sans_contrat'::text                                                AS anomaly_type,
    p.id                                                                         AS entity_id,
    jsonb_build_object('paiement_id', p.id, 'montant', p.montant_total, 'date', p.date_paiement) AS details
  FROM public.paiements p
  LEFT JOIN public.contrats c ON c.id = p.contrat_id AND c.agency_id = p.agency_id
  WHERE c.id IS NULL AND p.statut != 'annule'

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

  UNION ALL

  -- Agences avec pilot_status=trial depuis > 30 jours et aucun paiement
  SELECT
    a.id,
    'pilot_inactif'::text,
    a.id,
    jsonb_build_object('agency_id', a.id, 'nom', a.name, 'since_days',
      EXTRACT(DAY FROM now() - a.created_at)::int)
  FROM public.agencies a
  WHERE a.pilot_status = 'trial'
    AND a.created_at < now() - interval '30 days'
    AND a.first_payment_at IS NULL;

COMMENT ON VIEW public.vw_system_anomalies IS
  'Anomalies système : paiements orphelins, unités incohérentes, pilotes inactifs (SECURITY INVOKER)';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. JOB_QUEUE — correction de la policy INSERT toujours vraie
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_queue FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_insert_service" ON public.job_queue;
CREATE POLICY "jobs_insert_service" ON public.job_queue
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. REVOKE EXECUTE FROM anon
--    Fonctions SECURITY DEFINER non destinées aux visiteurs non connectés
--    Exception gardée : accept_invitation + get_invitation_by_token (flux public)
-- ─────────────────────────────────────────────────────────────────────────────

-- Administration / souscription
REVOKE EXECUTE ON FUNCTION public.activate_subscription(uuid, text, uuid, integer, text)         FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_agency_request(uuid)                                      FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_agency_request(uuid, text)                                 FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_plan_limits(uuid)                                           FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_invitations()                                     FROM anon, PUBLIC;

-- Création de profils (déclenchée par auth hooks, pas par l'API REST)
REVOKE EXECUTE ON FUNCTION public.create_admin_profile(uuid, text, text, text, text)              FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_agent_profile(uuid, text, text, text, text)               FROM anon, PUBLIC;

-- Triggers internes (ne doivent jamais être appelés via REST)
REVOKE EXECUTE ON FUNCTION public.create_agency_settings_on_agency_insert()                         FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, text, text)          FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_after_contrat_insert()                                         FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_after_paiement_cancel()                                        FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_after_paiement_insert()                                        FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_trigger_outbox_contrat()                                       FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_trigger_outbox_paiement()                                      FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_validate_contrat_commission()                                  FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_validate_paiement_integrite()                                  FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_update_bilan_mensuel()                                         FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_table_changes()                                               FROM anon, PUBLIC;

-- Workers / cron (exécutés uniquement via service_role ou pg_cron)
REVOKE EXECUTE ON FUNCTION public.fn_aggregate_kpi_daily(uuid, date)                               FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_aggregate_kpi_monthly(uuid, date)                             FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_compute_financial_snapshots(date)                               FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_detect_impayes()                                               FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_enqueue_jobs_from_outbox(int)                                  FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_evaluate_job(uuid)                                             FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_generate_quittances_mensuelles()                               FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_snapshot_health()                                              FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_worker_analytics(int)                                          FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_worker_finance(int)                                            FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.queue_loyer_encaisse_notification(uuid, uuid)                     FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.queue_renewal_reminders()                                         FROM anon, PUBLIC;

-- Fonctions utilitaires — accès réservé aux utilisateurs connectés
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, text)                                   FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_monthly_revenue(uuid, int)                                    FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_bailleur_id()                                            FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role()                                                   FROM anon, PUBLIC;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. REVOKE EXECUTE FROM authenticated
--    Fonctions purement internes (triggers, workers) : jamais appelées via REST
--    par un utilisateur humain, même connecté.
-- ─────────────────────────────────────────────────────────────────────────────

-- Triggers DB — ne doivent pas être appelables via /rest/v1/rpc
REVOKE EXECUTE ON FUNCTION public.create_agency_settings_on_agency_insert()  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_after_contrat_insert()                   FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_after_paiement_cancel()                  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_after_paiement_insert()                  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_trigger_outbox_contrat()                 FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_trigger_outbox_paiement()                FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_validate_contrat_commission()             FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_validate_paiement_integrite()            FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_update_bilan_mensuel()                   FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_table_changes()                          FROM authenticated;

-- Workers / cron — exécutés uniquement par pg_cron ou service_role
REVOKE EXECUTE ON FUNCTION public.fn_aggregate_kpi_daily(uuid, date)          FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_aggregate_kpi_monthly(uuid, date)        FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_compute_financial_snapshots(date)  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_detect_impayes()                          FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_enqueue_jobs_from_outbox(int)             FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_evaluate_job(uuid)                        FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_generate_quittances_mensuelles()          FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_snapshot_health()                         FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_worker_analytics(int)                     FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_worker_finance(int)                       FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_loyer_encaisse_notification(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_renewal_reminders()                    FROM authenticated;

-- Création de profils — déclenchée uniquement par auth hooks (service_role)
REVOKE EXECUTE ON FUNCTION public.create_admin_profile(uuid, text, text, text, text)       FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_agent_profile(uuid, text, text, text, text)       FROM authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. GRANT EXECUTE explicite — fonctions légitimement appelées par le frontend
--    (réaffirmation après le REVOKE FROM PUBLIC ci-dessus)
-- ─────────────────────────────────────────────────────────────────────────────

-- Flux invitation public (anon doit pouvoir appeler ces deux fonctions)
GRANT EXECUTE ON FUNCTION public.accept_invitation(text)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text)       TO anon, authenticated;

-- Fonctions appelées par le frontend connecté
GRANT EXECUTE ON FUNCTION public.activate_subscription(uuid, text, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_agency_request(uuid)                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_agency_request(uuid, text)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_plan_limits(uuid)                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, text)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_revenue(uuid, int)                           TO authenticated;

-- Fonctions utilitaires utilisées dans les policies RLS
GRANT EXECUTE ON FUNCTION public.get_user_bailleur_id()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin()                TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_agent_or_admin()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin()          TO authenticated;

-- Notification loyer — appelée depuis Edge Functions (service_role) uniquement
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_invitations()                              TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_aggregate_kpi_daily(uuid, date)                       TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_aggregate_kpi_monthly(uuid, date)                     TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_compute_financial_snapshots(date)               TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_detect_impayes()                                       TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_enqueue_jobs_from_outbox(int)                          TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_evaluate_job(uuid)                                     TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_generate_quittances_mensuelles()                       TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_snapshot_health()                                      TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_worker_analytics(int)                                  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_worker_finance(int)                                    TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_loyer_encaisse_notification(uuid, uuid)             TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_renewal_reminders()                                 TO service_role;

COMMIT;
