-- =============================================================================
-- Migration : 20260504000001_ledger_event_system
-- Objectif  : Architecture Série A — ledger immutable + event log + pilot tracking + pg_cron
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LEDGER ENTRIES — Journal financier immutable
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ledger_entries (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      uuid        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  type           text        NOT NULL,                             -- 'paiement', 'commission', 'part_bailleur', 'annulation', 'depense'
  direction      text        NOT NULL CHECK (direction IN ('credit', 'debit')),
  montant        numeric(14,2) NOT NULL CHECK (montant > 0),
  reference_type text        NOT NULL,                             -- 'paiements', 'contrats', 'depenses'
  reference_id   uuid        NOT NULL,
  description    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid        REFERENCES auth.users(id)
);

-- Immutabilité : aucun UPDATE ni DELETE permis sur le ledger
CREATE OR REPLACE RULE ledger_no_update AS ON UPDATE TO ledger_entries DO INSTEAD NOTHING;
CREATE OR REPLACE RULE ledger_no_delete AS ON DELETE TO ledger_entries DO INSTEAD NOTHING;

-- Index
CREATE INDEX IF NOT EXISTS idx_ledger_agency_id       ON ledger_entries(agency_id);
CREATE INDEX IF NOT EXISTS idx_ledger_reference_id    ON ledger_entries(reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type_direction  ON ledger_entries(type, direction);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at      ON ledger_entries(created_at DESC);

-- RLS
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledger_select_agency" ON ledger_entries;
CREATE POLICY "ledger_select_agency" ON ledger_entries
  FOR SELECT USING (
    agency_id = (
      SELECT agency_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1
    )
  );

-- Seul le service role peut écrire (Edge Functions)
DROP POLICY IF EXISTS "ledger_insert_service" ON ledger_entries;
CREATE POLICY "ledger_insert_service" ON ledger_entries
  FOR INSERT WITH CHECK (true);  -- restreint par SUPABASE_SERVICE_ROLE_KEY côté Edge Function


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. EVENT LOG — Bus d'événements métier
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    uuid        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  event_type   text        NOT NULL,   -- 'paiement.created', 'contrat.created', 'paiement.cancelled', etc.
  entity_type  text        NOT NULL,   -- 'paiements', 'contrats', 'locataires'
  entity_id    uuid        NOT NULL,
  payload      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid        REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_event_agency_id    ON event_log(agency_id);
CREATE INDEX IF NOT EXISTS idx_event_type         ON event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_entity_id    ON event_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_event_created_at   ON event_log(created_at DESC);

ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_select_agency" ON event_log;
CREATE POLICY "event_select_agency" ON event_log
  FOR SELECT USING (
    agency_id = (
      SELECT agency_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1
    )
  );

DROP POLICY IF EXISTS "event_insert_service" ON event_log;
CREATE POLICY "event_insert_service" ON event_log
  FOR INSERT WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PILOT TRACKING — Colonnes sur agencies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS pilot_status      text        DEFAULT 'trial'
    CHECK (pilot_status IN ('trial', 'pilot', 'active', 'churned')),
  ADD COLUMN IF NOT EXISTS first_payment_at  timestamptz,
  ADD COLUMN IF NOT EXISTS first_contract_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_at     timestamptz;

COMMENT ON COLUMN agencies.pilot_status      IS 'Pipeline pilote : trial → pilot → active → churned';
COMMENT ON COLUMN agencies.first_payment_at  IS 'Date du premier paiement enregistré (activation Série A)';
COMMENT ON COLUMN agencies.first_contract_at IS 'Date du premier contrat créé';
COMMENT ON COLUMN agencies.activation_at     IS 'Date de passage à active (premier paiement + contrat)';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TRIGGER — Ledger + pilot tracking sur INSERT paiement
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_after_paiement_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 4a. Ledger : entrée crédit paiement brut
  INSERT INTO ledger_entries (agency_id, type, direction, montant, reference_type, reference_id, description, created_by)
  VALUES (
    NEW.agency_id,
    'paiement',
    'credit',
    NEW.montant_total,
    'paiements',
    NEW.id,
    'Paiement reçu',
    NEW.created_by
  );

  -- 4b. Ledger : ventilation commission agence
  IF NEW.part_agence IS NOT NULL AND NEW.part_agence > 0 THEN
    INSERT INTO ledger_entries (agency_id, type, direction, montant, reference_type, reference_id, description, created_by)
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

  -- 4c. Ledger : part bailleur
  IF NEW.part_bailleur IS NOT NULL AND NEW.part_bailleur > 0 THEN
    INSERT INTO ledger_entries (agency_id, type, direction, montant, reference_type, reference_id, description, created_by)
    VALUES (
      NEW.agency_id,
      'part_bailleur',
      'debit',
      NEW.part_bailleur,
      'paiements',
      NEW.id,
      'Part bailleur à reverser',
      NEW.created_by
    );
  END IF;

  -- 4d. Pilot tracking : first_payment_at
  UPDATE agencies
    SET first_payment_at = now()
  WHERE id = NEW.agency_id
    AND first_payment_at IS NULL;

  -- 4e. Pilot tracking : activation si first_payment + first_contract présents
  UPDATE agencies
    SET
      activation_at = now(),
      pilot_status  = CASE
                        WHEN pilot_status = 'trial' THEN 'pilot'
                        ELSE pilot_status
                      END
  WHERE id = NEW.agency_id
    AND activation_at IS NULL
    AND first_contract_at IS NOT NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_paiement_insert ON paiements;
CREATE TRIGGER trg_after_paiement_insert
  AFTER INSERT ON paiements
  FOR EACH ROW
  EXECUTE FUNCTION fn_after_paiement_insert();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TRIGGER — Ledger reversal sur annulation paiement
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_after_paiement_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Déclenché uniquement lors du passage à 'annule'
  IF OLD.statut <> 'annule' AND NEW.statut = 'annule' THEN
    INSERT INTO ledger_entries (agency_id, type, direction, montant, reference_type, reference_id, description)
    VALUES (
      NEW.agency_id,
      'annulation',
      'debit',
      NEW.montant_total,
      'paiements',
      NEW.id,
      'Annulation paiement — reversal'
    );

    INSERT INTO event_log (agency_id, event_type, entity_type, entity_id, payload)
    VALUES (
      NEW.agency_id,
      'paiement.cancelled',
      'paiements',
      NEW.id,
      jsonb_build_object('montant', NEW.montant_total, 'previous_statut', OLD.statut)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_paiement_cancel ON paiements;
CREATE TRIGGER trg_after_paiement_cancel
  AFTER UPDATE ON paiements
  FOR EACH ROW
  EXECUTE FUNCTION fn_after_paiement_cancel();


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. FONCTION — Détection impayés quotidienne
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_detect_impayes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrat RECORD;
  v_mois    date;
BEGIN
  -- Pour chaque contrat actif, vérifier si le mois courant a un paiement
  FOR v_contrat IN
    SELECT id, agency_id, loyer_mensuel, commission, locataire_id
    FROM contrats
    WHERE statut = 'actif'
  LOOP
    v_mois := date_trunc('month', CURRENT_DATE)::date;

    -- Si aucun paiement paye ou partiel pour ce mois + contrat
    IF NOT EXISTS (
      SELECT 1 FROM paiements
      WHERE contrat_id    = v_contrat.id
        AND agency_id     = v_contrat.agency_id
        AND mois_concerne >= v_mois
        AND mois_concerne <  v_mois + interval '1 month'
        AND statut IN ('paye', 'partiel')
    ) THEN
      -- Créer ou mettre à jour l'entrée impayé (idempotent)
      INSERT INTO paiements (
        contrat_id, agency_id, montant_total, part_agence, part_bailleur,
        mois_concerne, date_paiement, mode_paiement, statut, notes
      )
      VALUES (
        v_contrat.id,
        v_contrat.agency_id,
        v_contrat.loyer_mensuel,
        ROUND((v_contrat.loyer_mensuel * COALESCE(v_contrat.commission, 0)) / 100),
        v_contrat.loyer_mensuel - ROUND((v_contrat.loyer_mensuel * COALESCE(v_contrat.commission, 0)) / 100),
        v_mois,
        CURRENT_DATE,
        'especes',
        'impaye',
        'Généré automatiquement — impayé détecté'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. FONCTION — Génération quittances mensuelles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_generate_quittances_mensuelles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insère une notification de quittance pour chaque paiement 'paye' du mois précédent
  -- sans quittance déjà générée
  INSERT INTO event_log (agency_id, event_type, entity_type, entity_id, payload)
  SELECT
    p.agency_id,
    'quittance.due',
    'paiements',
    p.id,
    jsonb_build_object(
      'mois', p.mois_concerne,
      'montant', p.montant_total,
      'contrat_id', p.contrat_id
    )
  FROM paiements p
  WHERE p.statut = 'paye'
    AND p.mois_concerne >= date_trunc('month', CURRENT_DATE - interval '1 month')::date
    AND p.mois_concerne <  date_trunc('month', CURRENT_DATE)::date
    AND NOT EXISTS (
      SELECT 1 FROM event_log el
      WHERE el.entity_id = p.id
        AND el.event_type = 'quittance.due'
    );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. PG_CRON — Jobs automatiques (nécessite pg_cron activé dans Supabase)
-- ─────────────────────────────────────────────────────────────────────────────
-- Pour activer pg_cron : Supabase Dashboard → Database → Extensions → pg_cron
-- Puis relancer cette migration ou exécuter le bloc DO ci-dessous.

DO $$
BEGIN
  -- Vérifie si pg_cron est disponible avant de planifier les jobs
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Job 1 : Détection impayés — tous les jours à 6h00
    PERFORM cron.unschedule('detect-impayes')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'detect-impayes');
    PERFORM cron.schedule(
      'detect-impayes',
      '0 6 * * *',
      'SELECT fn_detect_impayes()'
    );

    -- Job 2 : Génération quittances — 1er de chaque mois à 7h00
    PERFORM cron.unschedule('generate-quittances')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-quittances');
    PERFORM cron.schedule(
      'generate-quittances',
      '0 7 1 * *',
      'SELECT fn_generate_quittances_mensuelles()'
    );

  END IF;
END;
$$;
