-- =============================================================================
-- Migration : 20260505000001_financial_snapshots_reconciliation
-- Objectif  : Couche de réconciliation financière (revenue-grade)
--             Vérifie que SUM(paiements) == SUM(ledger_entries) par période
--             Détecte toute fraude / bug / drift comptable
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLE financial_snapshots
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_snapshots (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id             uuid        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  period                date        NOT NULL,                   -- date_trunc('month')
  total_paiements       numeric(14,2) NOT NULL DEFAULT 0,      -- SUM paiements non-annulés
  total_ledger_credits  numeric(14,2) NOT NULL DEFAULT 0,      -- SUM ledger_entries credit paiement
  diff                  numeric(14,2) GENERATED ALWAYS AS
                          (total_paiements - total_ledger_credits) STORED,
  status                text        NOT NULL DEFAULT 'ok'
                          CHECK (status IN ('ok', 'drift', 'error')),
  drift_details         jsonb,                                  -- détail écart si drift
  computed_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, period)
);

COMMENT ON TABLE  financial_snapshots                       IS 'Réconciliation mensuelle paiements ↔ ledger — outil investisseur';
COMMENT ON COLUMN financial_snapshots.diff                  IS 'Écart auto-calculé : 0 = équilibré, ≠0 = drift à investiguer';
COMMENT ON COLUMN financial_snapshots.status                IS 'ok | drift | error';
COMMENT ON COLUMN financial_snapshots.drift_details         IS 'JSON détaillant les entrées qui causent l''écart';

CREATE INDEX IF NOT EXISTS idx_snapshots_agency_period  ON financial_snapshots(agency_id, period DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_status         ON financial_snapshots(status) WHERE status != 'ok';

-- RLS
ALTER TABLE financial_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snapshots_select_agency" ON financial_snapshots;
CREATE POLICY "snapshots_select_agency" ON financial_snapshots
  FOR SELECT USING (
    agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "snapshots_insert_service" ON financial_snapshots;
CREATE POLICY "snapshots_insert_service" ON financial_snapshots
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "snapshots_update_service" ON financial_snapshots;
CREATE POLICY "snapshots_update_service" ON financial_snapshots
  FOR UPDATE USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FONCTION fn_compute_financial_snapshots — réconciliation mensuelle
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_compute_financial_snapshots(
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
SET search_path = public
AS $$
DECLARE
  v_agency          RECORD;
  v_total_paiements numeric;
  v_total_ledger    numeric;
  v_status          text;
  v_drift_details   jsonb;
BEGIN
  FOR v_agency IN SELECT id FROM agencies LOOP

    -- Somme des paiements non-annulés créés ce mois
    SELECT COALESCE(SUM(montant_total), 0)
    INTO v_total_paiements
    FROM paiements
    WHERE agency_id = v_agency.id
      AND statut    != 'annule'
      AND date_trunc('month', created_at)::date = p_period;

    -- Somme des entrées ledger type='paiement' credit (une par paiement)
    SELECT COALESCE(SUM(montant), 0)
    INTO v_total_ledger
    FROM ledger_entries
    WHERE agency_id = v_agency.id
      AND direction = 'credit'
      AND type      = 'paiement'
      AND date_trunc('month', created_at)::date = p_period;

    v_status := CASE
      WHEN v_total_paiements = v_total_ledger THEN 'ok'
      ELSE 'drift'
    END;

    v_drift_details := CASE
      WHEN v_total_paiements != v_total_ledger THEN
        jsonb_build_object(
          'ecart',               v_total_paiements - v_total_ledger,
          'total_paiements',     v_total_paiements,
          'total_ledger_credits',v_total_ledger,
          'period',              p_period,
          'computed_at',         now()
        )
      ELSE NULL
    END;

    INSERT INTO financial_snapshots (
      agency_id, period,
      total_paiements, total_ledger_credits,
      status, drift_details, computed_at
    )
    VALUES (
      v_agency.id, p_period,
      v_total_paiements, v_total_ledger,
      v_status, v_drift_details, now()
    )
    ON CONFLICT (agency_id, period) DO UPDATE SET
      total_paiements      = EXCLUDED.total_paiements,
      total_ledger_credits = EXCLUDED.total_ledger_credits,
      status               = EXCLUDED.status,
      drift_details        = EXCLUDED.drift_details,
      computed_at          = now();

    -- Retourne la ligne pour audit
    RETURN QUERY SELECT
      v_agency.id,
      p_period,
      v_total_paiements,
      v_total_ledger,
      v_total_paiements - v_total_ledger,
      v_status;

  END LOOP;
END;
$$;

COMMENT ON FUNCTION fn_compute_financial_snapshots(date) IS
  'Réconciliation mensuelle : compare SUM(paiements) vs SUM(ledger credits) par agence. '
  'Retourne les lignes calculées et persiste dans financial_snapshots.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VUE — drift_report (alertes écarts non résolus)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_financial_drift_report AS
SELECT
  fs.agency_id,
  a.nom          AS agency_nom,
  fs.period,
  fs.total_paiements,
  fs.total_ledger_credits,
  fs.diff        AS ecart,
  fs.status,
  fs.drift_details,
  fs.computed_at
FROM financial_snapshots fs
JOIN agencies a ON a.id = fs.agency_id
WHERE fs.status = 'drift'
ORDER BY ABS(fs.diff) DESC, fs.period DESC;

COMMENT ON VIEW vw_financial_drift_report IS
  'Rapports drift comptable — toutes les agences avec écart paiements ↔ ledger';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PG_CRON — Réconciliation mensuelle automatique
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Réconciliation mois précédent — 2h le 2 de chaque mois
    PERFORM cron.unschedule('financial-reconciliation')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'financial-reconciliation');
    PERFORM cron.schedule(
      'financial-reconciliation',
      '0 2 2 * *',
      $$SELECT fn_compute_financial_snapshots(date_trunc('month', CURRENT_DATE - interval '1 month')::date)$$
    );

  END IF;
END;
$$;
