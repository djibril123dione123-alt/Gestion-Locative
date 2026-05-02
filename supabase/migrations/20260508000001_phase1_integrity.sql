-- =============================================================================
-- Migration Phase 1 — Intégrité financière
--
-- 1. UNIQUE(contrat_id, mois_concerne) sur paiements — empêche le double paiement
-- 2. Commission > 0 (distingue NULL "non configuré" de 0% invalide)
-- 3. Correction get_monthly_revenue (bug to_char 3 args → retourne month_num int)
-- 4. pg_cron scheduling des workers Autopilot (si l'extension est activée)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CONTRAINTE UNIQUE paiements(contrat_id, mois_concerne)
--    Empêche qu'un même contrat ait deux paiements pour le même mois.
--    Si la contrainte existe déjà, on ignore silencieusement.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'paiements_contrat_mois_unique'
  ) THEN
    ALTER TABLE paiements
      ADD CONSTRAINT paiements_contrat_mois_unique
      UNIQUE (contrat_id, mois_concerne);
    RAISE NOTICE 'Contrainte UNIQUE paiements(contrat_id, mois_concerne) créée.';
  ELSE
    RAISE NOTICE 'Contrainte paiements_contrat_mois_unique déjà présente, ignorée.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. COMMISSION > 0 sur les contrats
--    La valeur 0% est sémantiquement équivalente à "non configurée".
--    Distinguer NULL (absent) de 0 (accidentel) protège contre les bugs silencieux
--    où une agence travaille sans commission sans s'en rendre compte.
--    Les contrats existants avec commission = 0 sont mis à NULL (non configurée).
-- ─────────────────────────────────────────────────────────────────────────────

-- Migrer les commission = 0 vers NULL (non configurée) sur les contrats existants
UPDATE contrats SET commission = NULL WHERE commission = 0;

-- Remplacer la contrainte >= 0 par > 0
ALTER TABLE contrats DROP CONSTRAINT IF EXISTS check_commission_contrat_valide;
ALTER TABLE contrats
  ADD CONSTRAINT check_commission_contrat_valide
  CHECK (commission IS NULL OR (commission > 0 AND commission <= 100));

-- Idem pour bailleurs
UPDATE bailleurs SET commission = NULL WHERE commission = 0;
ALTER TABLE bailleurs DROP CONSTRAINT IF EXISTS check_commission_valide;
ALTER TABLE bailleurs
  ADD CONSTRAINT check_commission_valide
  CHECK (commission IS NULL OR (commission > 0 AND commission <= 100));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CORRECTION get_monthly_revenue
--    Ancienne version : to_char(gs, 'Mon', 'fr_FR') — 3 arguments invalides en PG.
--    Nouvelle version : retourne month_num (1–12) + revenus numeric.
--    Le frontend formate le libellé en français via un tableau JS.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_monthly_revenue(p_agency_id uuid, p_year int)
RETURNS TABLE(month_num int, revenus numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND agency_id = p_agency_id
  ) AND NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    EXTRACT(MONTH FROM gs)::int            AS month_num,
    COALESCE(SUM(p.montant_total), 0)      AS revenus
  FROM generate_series(
    make_date(p_year, 1, 1),
    make_date(p_year, 12, 1),
    '1 month'::interval
  ) AS gs
  LEFT JOIN paiements p
    ON p.agency_id = p_agency_id
    AND p.statut = 'paye'
    AND date_trunc('month', p.mois_concerne::date) = gs
  GROUP BY gs
  ORDER BY gs;
END;
$$;

REVOKE ALL ON FUNCTION get_monthly_revenue(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_monthly_revenue(uuid, int) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. pg_cron — Scheduling des workers Autopilot
--    PRÉREQUIS : activer l'extension pg_cron dans Supabase Dashboard > Extensions
--    Si l'extension n'est pas disponible, un NOTICE est émis et la migration continue.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Vérifie si pg_cron est disponible avant d'essayer de l'utiliser
  IF EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    -- Worker finance : toutes les 15 minutes (traite les jobs GENERATE_LEDGER, RECONCILE_FINANCE)
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'autopilot_finance_worker') THEN
      PERFORM cron.schedule(
        'autopilot_finance_worker',
        '*/15 * * * *',
        'SELECT fn_worker_finance()'
      );
    END IF;

    -- Worker analytics : toutes les heures (KPI_DAILY_AGGREGATION, KPI_MONTHLY_AGGREGATION)
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'autopilot_analytics_worker') THEN
      PERFORM cron.schedule(
        'autopilot_analytics_worker',
        '0 * * * *',
        'SELECT fn_worker_analytics()'
      );
    END IF;

    -- Health snapshot : toutes les 30 minutes
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'autopilot_health_snapshot') THEN
      PERFORM cron.schedule(
        'autopilot_health_snapshot',
        '*/30 * * * *',
        'SELECT fn_snapshot_health()'
      );
    END IF;

    RAISE NOTICE 'pg_cron : workers Autopilot planifiés avec succès.';
  ELSE
    RAISE NOTICE 'pg_cron non disponible. Activez l''extension dans Supabase Dashboard > Extensions puis relancez cette migration.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erreur pg_cron (non bloquante) : %', SQLERRM;
END $$;
