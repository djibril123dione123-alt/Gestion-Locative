-- =============================================================================
-- Finance hardening: partial payments, reliquats, unpaid rent aggregation
-- =============================================================================

BEGIN;

ALTER TABLE public.paiements
  DROP CONSTRAINT IF EXISTS paiements_contrat_mois_unique;

ALTER TABLE public.paiements
  ADD COLUMN IF NOT EXISTS montant_attendu numeric(12,2),
  ADD COLUMN IF NOT EXISTS montant_encaisse_cumul numeric(12,2),
  ADD COLUMN IF NOT EXISTS reliquat numeric(12,2);

ALTER TABLE public.paiements
  DROP CONSTRAINT IF EXISTS paiements_reliquat_non_negative,
  ADD CONSTRAINT paiements_reliquat_non_negative
    CHECK (reliquat IS NULL OR reliquat >= 0);

CREATE INDEX IF NOT EXISTS idx_paiements_cash_echeance
  ON public.paiements (agency_id, contrat_id, mois_concerne)
  WHERE statut IN ('paye', 'partiel') AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_paiements_echeance_all
  ON public.paiements (agency_id, contrat_id, mois_concerne)
  WHERE deleted_at IS NULL;

-- Recompute the current balance of one rent period. Only confirmed cash
-- statuses are counted as paid. Pending/unpaid rows never reduce the due amount.
CREATE OR REPLACE FUNCTION public.fn_recompute_paiement_echeance(
  p_agency_id uuid,
  p_contrat_id uuid,
  p_mois_concerne date
)
RETURNS TABLE (
  montant_attendu numeric,
  montant_encaisse numeric,
  reliquat numeric,
  statut_echeance text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected numeric(12,2);
  v_paid numeric(12,2);
  v_reliquat numeric(12,2);
BEGIN
  SELECT c.loyer_mensuel
  INTO v_expected
  FROM public.contrats c
  WHERE c.id = p_contrat_id
    AND c.agency_id = p_agency_id;

  IF v_expected IS NULL THEN
    RAISE EXCEPTION 'CONTRAT_NOT_FOUND';
  END IF;

  SELECT COALESCE(SUM(p.montant_total), 0)
  INTO v_paid
  FROM public.paiements p
  WHERE p.agency_id = p_agency_id
    AND p.contrat_id = p_contrat_id
    AND p.mois_concerne = p_mois_concerne
    AND p.statut IN ('paye', 'partiel')
    AND p.deleted_at IS NULL;

  IF v_paid > v_expected THEN
    RAISE EXCEPTION
      'OVERPAYMENT: total encaisse % XOF, loyer attendu % XOF',
      v_paid, v_expected;
  END IF;

  v_reliquat := GREATEST(v_expected - v_paid, 0);

  UPDATE public.paiements p
  SET
    montant_attendu = v_expected,
    montant_encaisse_cumul = v_paid,
    reliquat = v_reliquat,
    updated_at = now()
  WHERE p.agency_id = p_agency_id
    AND p.contrat_id = p_contrat_id
    AND p.mois_concerne = p_mois_concerne
    AND p.deleted_at IS NULL;

  RETURN QUERY
  SELECT
    v_expected,
    v_paid,
    v_reliquat,
    CASE
      WHEN v_paid <= 0 THEN 'impaye'
      WHEN v_paid < v_expected THEN 'partiel'
      ELSE 'paye'
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_after_paiement_recompute_echeance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  PERFORM public.fn_recompute_paiement_echeance(
    NEW.agency_id,
    NEW.contrat_id,
    NEW.mois_concerne
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_paiement_recompute_echeance ON public.paiements;
CREATE TRIGGER trg_after_paiement_recompute_echeance
  AFTER INSERT OR UPDATE OF statut, montant_total, deleted_at ON public.paiements
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_after_paiement_recompute_echeance();

CREATE OR REPLACE FUNCTION public.fn_create_paiement_financial(
  p_agency_id uuid,
  p_user_id uuid,
  p_contrat_id uuid,
  p_montant_total numeric,
  p_mois_concerne date,
  p_date_paiement date,
  p_mode_paiement text,
  p_statut text,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS public.paiements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contrat record;
  v_existing public.paiements;
  v_paid_before numeric(12,2);
  v_paid_after numeric(12,2);
  v_commission numeric(8,4);
  v_part_agence numeric(12,2);
  v_part_bailleur numeric(12,2);
  v_effective_statut public.paiement_statut;
  v_inserted public.paiements;
BEGIN
  IF p_montant_total IS NULL OR p_montant_total <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.paiements
    WHERE agency_id = p_agency_id
      AND idempotency_key = p_idempotency_key
      AND deleted_at IS NULL
    LIMIT 1;

    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_agency_id::text || ':' || p_contrat_id::text || ':' || p_mois_concerne::text,
      0
    )
  );

  SELECT id, agency_id, commission, loyer_mensuel, statut
  INTO v_contrat
  FROM public.contrats
  WHERE id = p_contrat_id
    AND agency_id = p_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTRAT_NOT_FOUND';
  END IF;

  IF v_contrat.commission IS NULL THEN
    RAISE EXCEPTION 'COMMISSION_REQUIRED';
  END IF;

  v_commission := v_contrat.commission;
  IF v_commission < 0 OR v_commission > 100 THEN
    RAISE EXCEPTION 'COMMISSION_RANGE';
  END IF;

  IF p_statut = 'impaye' THEN
    RAISE EXCEPTION 'IMPAYE_IS_NOT_A_PAYMENT';
  END IF;

  PERFORM 1
  FROM public.paiements p
  WHERE p.agency_id = p_agency_id
    AND p.contrat_id = p_contrat_id
    AND p.mois_concerne = p_mois_concerne
    AND p.deleted_at IS NULL
  FOR UPDATE;

  SELECT COALESCE(SUM(p.montant_total), 0)
  INTO v_paid_before
  FROM public.paiements p
  WHERE p.agency_id = p_agency_id
    AND p.contrat_id = p_contrat_id
    AND p.mois_concerne = p_mois_concerne
    AND p.statut IN ('paye', 'partiel')
    AND p.deleted_at IS NULL;

  IF p_statut = 'en_attente' THEN
    v_paid_after := v_paid_before;
    v_effective_statut := 'en_attente'::public.paiement_statut;
  ELSE
    v_paid_after := v_paid_before + p_montant_total;
    IF v_paid_after > v_contrat.loyer_mensuel THEN
      RAISE EXCEPTION
        'OVERPAYMENT: total deja encaisse % XOF, nouveau paiement % XOF, loyer attendu % XOF',
        v_paid_before, p_montant_total, v_contrat.loyer_mensuel;
    END IF;

    v_effective_statut := CASE
      WHEN v_paid_after >= v_contrat.loyer_mensuel THEN 'paye'::public.paiement_statut
      ELSE 'partiel'::public.paiement_statut
    END;
  END IF;

  v_part_agence := ROUND((p_montant_total * v_commission) / 100);
  v_part_bailleur := p_montant_total - v_part_agence;

  INSERT INTO public.paiements (
    contrat_id, agency_id, montant_total, mois_concerne, date_paiement,
    mode_paiement, part_agence, part_bailleur, statut, reference, notes,
    idempotency_key, montant_attendu, montant_encaisse_cumul, reliquat,
    created_by
  )
  VALUES (
    p_contrat_id, p_agency_id, p_montant_total, p_mois_concerne, p_date_paiement,
    p_mode_paiement::public.mode_paiement, v_part_agence, v_part_bailleur,
    v_effective_statut, p_reference, p_notes, p_idempotency_key,
    v_contrat.loyer_mensuel, v_paid_after,
    GREATEST(v_contrat.loyer_mensuel - v_paid_after, 0),
    p_user_id
  )
  RETURNING * INTO v_inserted;

  PERFORM public.fn_recompute_paiement_echeance(p_agency_id, p_contrat_id, p_mois_concerne);

  SELECT *
  INTO v_inserted
  FROM public.paiements
  WHERE id = v_inserted.id;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_after_paiement_cash_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.statut IN ('paye', 'partiel') OR NEW.statut NOT IN ('paye', 'partiel') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ledger_entries le
    WHERE le.reference_type = 'paiements'
      AND le.reference_id = NEW.id
      AND le.type = 'paiement'
  ) THEN
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

  IF NEW.part_agence > 0 THEN
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

  IF NEW.part_bailleur > 0 THEN
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_paiement_cash_transition ON public.paiements;
CREATE TRIGGER trg_after_paiement_cash_transition
  AFTER UPDATE OF statut ON public.paiements
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_after_paiement_cash_transition();

CREATE OR REPLACE FUNCTION public.fn_after_paiement_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.statut IN ('paye', 'partiel') AND NEW.statut = 'annule' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.ledger_entries le
      WHERE le.reference_type = 'paiements'
        AND le.reference_id = NEW.id
        AND le.type = 'annulation'
    ) THEN
      INSERT INTO public.ledger_entries (
        agency_id, type, direction, montant, reference_type, reference_id, description, created_by
      )
      VALUES (
        NEW.agency_id,
        'annulation',
        'debit',
        NEW.montant_total,
        'paiements',
        NEW.id,
        'Annulation paiement',
        NEW.created_by
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_paiement_cancel ON public.paiements;
CREATE TRIGGER trg_after_paiement_cancel
  AFTER UPDATE OF statut ON public.paiements
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_after_paiement_cancel();

CREATE OR REPLACE FUNCTION public.fn_update_paiement_financial(
  p_agency_id uuid,
  p_user_id uuid,
  p_id uuid,
  p_montant_total numeric DEFAULT NULL,
  p_mode_paiement text DEFAULT NULL,
  p_statut text DEFAULT NULL,
  p_date_paiement date DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.paiements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.paiements;
  v_contrat record;
  v_new_amount numeric(12,2);
  v_new_status public.paiement_statut;
  v_paid_without_current numeric(12,2);
  v_paid_after numeric(12,2);
  v_part_agence numeric(12,2);
  v_part_bailleur numeric(12,2);
  v_updated public.paiements;
BEGIN
  SELECT *
  INTO v_existing
  FROM public.paiements
  WHERE id = p_id
    AND agency_id = p_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;

  IF v_existing.statut = 'annule' THEN
    RAISE EXCEPTION 'ALREADY_CANCELLED';
  END IF;

  IF p_statut = 'annule' THEN
    RAISE EXCEPTION 'USE_CANCEL_PAYMENT';
  END IF;

  IF p_statut = 'impaye' THEN
    RAISE EXCEPTION 'IMPAYE_IS_NOT_A_PAYMENT';
  END IF;

  IF v_existing.statut IN ('paye', 'partiel')
     AND p_statut IS NOT NULL
     AND p_statut::public.paiement_statut IS DISTINCT FROM v_existing.statut THEN
    RAISE EXCEPTION 'LEDGER_IMMUTABLE: cancel this payment and create a corrected one';
  END IF;

  SELECT id, agency_id, commission, loyer_mensuel
  INTO v_contrat
  FROM public.contrats
  WHERE id = v_existing.contrat_id
    AND agency_id = p_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTRAT_NOT_FOUND';
  END IF;

  IF v_contrat.commission IS NULL THEN
    RAISE EXCEPTION 'COMMISSION_REQUIRED';
  END IF;

  v_new_amount := COALESCE(p_montant_total, v_existing.montant_total);
  IF v_new_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF v_existing.statut IN ('paye', 'partiel')
     AND p_montant_total IS NOT NULL
     AND p_montant_total <> v_existing.montant_total THEN
    RAISE EXCEPTION 'LEDGER_IMMUTABLE: cancel this payment and create a corrected one';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_agency_id::text || ':' || v_existing.contrat_id::text || ':' || v_existing.mois_concerne::text,
      0
    )
  );

  PERFORM 1
  FROM public.paiements p
  WHERE p.agency_id = p_agency_id
    AND p.contrat_id = v_existing.contrat_id
    AND p.mois_concerne = v_existing.mois_concerne
    AND p.deleted_at IS NULL
  FOR UPDATE;

  SELECT COALESCE(SUM(p.montant_total), 0)
  INTO v_paid_without_current
  FROM public.paiements p
  WHERE p.agency_id = p_agency_id
    AND p.contrat_id = v_existing.contrat_id
    AND p.mois_concerne = v_existing.mois_concerne
    AND p.id <> v_existing.id
    AND p.statut IN ('paye', 'partiel')
    AND p.deleted_at IS NULL;

  IF COALESCE(p_statut, v_existing.statut::text) = 'en_attente' THEN
    v_paid_after := v_paid_without_current;
    v_new_status := 'en_attente'::public.paiement_statut;
  ELSE
    v_paid_after := v_paid_without_current + v_new_amount;
    IF v_paid_after > v_contrat.loyer_mensuel THEN
      RAISE EXCEPTION
        'OVERPAYMENT: total deja encaisse % XOF, nouveau paiement % XOF, loyer attendu % XOF',
        v_paid_without_current, v_new_amount, v_contrat.loyer_mensuel;
    END IF;

    v_new_status := CASE
      WHEN v_paid_after >= v_contrat.loyer_mensuel THEN 'paye'::public.paiement_statut
      ELSE 'partiel'::public.paiement_statut
    END;
  END IF;

  v_part_agence := ROUND((v_new_amount * v_contrat.commission) / 100);
  v_part_bailleur := v_new_amount - v_part_agence;

  UPDATE public.paiements
  SET
    montant_total = v_new_amount,
    mode_paiement = COALESCE(p_mode_paiement, v_existing.mode_paiement::text)::public.mode_paiement,
    statut = v_new_status,
    date_paiement = COALESCE(p_date_paiement, v_existing.date_paiement),
    reference = COALESCE(p_reference, v_existing.reference),
    notes = COALESCE(p_notes, v_existing.notes),
    part_agence = v_part_agence,
    part_bailleur = v_part_bailleur,
    montant_attendu = v_contrat.loyer_mensuel,
    montant_encaisse_cumul = v_paid_after,
    reliquat = GREATEST(v_contrat.loyer_mensuel - v_paid_after, 0),
    updated_at = now()
  WHERE id = v_existing.id
  RETURNING * INTO v_updated;

  PERFORM public.fn_recompute_paiement_echeance(
    p_agency_id,
    v_existing.contrat_id,
    v_existing.mois_concerne
  );

  SELECT *
  INTO v_updated
  FROM public.paiements
  WHERE id = v_existing.id;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_recompute_paiement_echeance(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_create_paiement_financial(uuid, uuid, uuid, numeric, date, date, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_update_paiement_financial(uuid, uuid, uuid, numeric, text, text, date, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_recompute_paiement_echeance(uuid, uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_create_paiement_financial(uuid, uuid, uuid, numeric, date, date, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_update_paiement_financial(uuid, uuid, uuid, numeric, text, text, date, text, text) TO service_role;

-- Stop using payments as an unpaid-rent ledger. An unpaid rent is a balance,
-- not a cash/payment row. This prevents daily cron duplication.
CREATE OR REPLACE FUNCTION public.fn_detect_impayes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row record;
  v_mois date := date_trunc('month', CURRENT_DATE)::date;
  v_paid numeric(12,2);
  v_due numeric(12,2);
BEGIN
  FOR v_row IN
    SELECT id, agency_id, loyer_mensuel, locataire_id
    FROM public.contrats
    WHERE statut = 'actif'
  LOOP
    SELECT COALESCE(SUM(p.montant_total), 0)
    INTO v_paid
    FROM public.paiements p
    WHERE p.agency_id = v_row.agency_id
      AND p.contrat_id = v_row.id
      AND p.mois_concerne = v_mois
      AND p.statut IN ('paye', 'partiel')
      AND p.deleted_at IS NULL;

    v_due := GREATEST(v_row.loyer_mensuel - v_paid, 0);

    IF v_due > 0 THEN
      INSERT INTO public.event_log (
        agency_id, event_type, entity_type, entity_id, payload
      )
      SELECT
        v_row.agency_id,
        'loyer.impaye.detected',
        'contrats',
        v_row.id,
        jsonb_build_object(
          'mois', v_mois,
          'montant_attendu', v_row.loyer_mensuel,
          'montant_encaisse', v_paid,
          'reliquat', v_due,
          'locataire_id', v_row.locataire_id
        )
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.event_log el
        WHERE el.agency_id = v_row.agency_id
          AND el.event_type = 'loyer.impaye.detected'
          AND el.entity_type = 'contrats'
          AND el.entity_id = v_row.id
          AND el.payload->>'mois' = v_mois::text
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_update_bilan_mensuel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mois text;
BEGIN
  IF NEW.statut NOT IN ('paye', 'partiel') THEN
    RETURN NEW;
  END IF;

  v_mois := to_char(NEW.mois_concerne, 'YYYY-MM');

  INSERT INTO public.bilans_mensuels (agency_id, mois, total_encaisse, nb_paiements, updated_at)
  VALUES (NEW.agency_id, v_mois, NEW.montant_total, 1, now())
  ON CONFLICT (agency_id, mois)
  DO UPDATE SET
    total_encaisse = bilans_mensuels.total_encaisse + EXCLUDED.total_encaisse,
    nb_paiements = bilans_mensuels.nb_paiements + EXCLUDED.nb_paiements,
    updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_update_bilan_mensuel failed for agency_id=%, mois=%: %',
    NEW.agency_id, v_mois, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_bilan_mensuel_on_payment_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_cash boolean := OLD.statut IN ('paye', 'partiel') AND OLD.deleted_at IS NULL;
  v_new_cash boolean := NEW.statut IN ('paye', 'partiel') AND NEW.deleted_at IS NULL;
  v_mois text;
  v_delta numeric := 0;
  v_count_delta integer := 0;
BEGIN
  IF OLD.mois_concerne IS DISTINCT FROM NEW.mois_concerne THEN
    RAISE EXCEPTION 'PAYMENT_MONTH_IMMUTABLE';
  END IF;

  IF NOT v_old_cash AND v_new_cash THEN
    v_delta := NEW.montant_total;
    v_count_delta := 1;
  ELSIF v_old_cash AND NOT v_new_cash THEN
    v_delta := -OLD.montant_total;
    v_count_delta := -1;
  ELSIF v_old_cash AND v_new_cash AND OLD.montant_total IS DISTINCT FROM NEW.montant_total THEN
    v_delta := NEW.montant_total - OLD.montant_total;
  ELSE
    RETURN NEW;
  END IF;

  v_mois := to_char(NEW.mois_concerne, 'YYYY-MM');

  IF v_delta >= 0 THEN
    INSERT INTO public.bilans_mensuels (agency_id, mois, total_encaisse, nb_paiements, updated_at)
    VALUES (NEW.agency_id, v_mois, v_delta, v_count_delta, now())
    ON CONFLICT (agency_id, mois)
    DO UPDATE SET
      total_encaisse = GREATEST(bilans_mensuels.total_encaisse + EXCLUDED.total_encaisse, 0),
      nb_paiements = GREATEST(bilans_mensuels.nb_paiements + EXCLUDED.nb_paiements, 0),
      updated_at = now();
  ELSE
    UPDATE public.bilans_mensuels
    SET
      total_encaisse = GREATEST(total_encaisse + v_delta, 0),
      nb_paiements = GREATEST(nb_paiements + v_count_delta, 0),
      updated_at = now()
    WHERE agency_id = NEW.agency_id
      AND mois = v_mois;
  END IF;

  RETURN NEW;
EXCEPTION
WHEN raise_exception THEN
  RAISE;
WHEN OTHERS THEN
  RAISE WARNING 'fn_sync_bilan_mensuel_on_payment_update failed for paiement_id=%: %',
    NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_bilan_mensuel_on_payment_update ON public.paiements;
CREATE TRIGGER trg_sync_bilan_mensuel_on_payment_update
  AFTER UPDATE OF statut, montant_total, deleted_at ON public.paiements
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_bilan_mensuel_on_payment_update();

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_agency_id uuid, p_year_month text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bailleurs bigint;
  v_immeubles bigint;
  v_unites bigint;
  v_unites_libres bigint;
  v_unites_louees bigint;
  v_locataires bigint;
  v_contrats bigint;
  v_revenus_mois numeric := 0;
  v_impayes_mois numeric := 0;
  v_nb_payes bigint := 0;
  v_nb_impayes bigint := 0;
  v_month date := to_date(p_year_month || '-01', 'YYYY-MM-DD');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND agency_id = p_agency_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COUNT(*) INTO v_bailleurs FROM public.bailleurs WHERE agency_id = p_agency_id AND actif = true;
  SELECT COUNT(*) INTO v_immeubles FROM public.immeubles WHERE agency_id = p_agency_id AND actif = true;
  SELECT COUNT(*) INTO v_unites FROM public.unites WHERE agency_id = p_agency_id AND actif = true;
  SELECT COUNT(*) INTO v_unites_libres FROM public.unites WHERE agency_id = p_agency_id AND actif = true AND statut = 'libre';
  SELECT COUNT(*) INTO v_unites_louees FROM public.unites WHERE agency_id = p_agency_id AND actif = true AND statut = 'loue';
  SELECT COUNT(*) INTO v_locataires FROM public.locataires WHERE agency_id = p_agency_id AND actif = true;
  SELECT COUNT(*) INTO v_contrats FROM public.contrats WHERE agency_id = p_agency_id AND statut = 'actif';

  SELECT COALESCE(SUM(p.montant_total), 0), COUNT(*)
  INTO v_revenus_mois, v_nb_payes
  FROM public.paiements p
  WHERE p.agency_id = p_agency_id
    AND p.statut IN ('paye', 'partiel')
    AND p.deleted_at IS NULL
    AND date_trunc('month', p.mois_concerne)::date = v_month;

  WITH balances AS (
    SELECT
      c.id,
      c.loyer_mensuel,
      COALESCE(SUM(p.montant_total) FILTER (
        WHERE p.statut IN ('paye', 'partiel') AND p.deleted_at IS NULL
      ), 0) AS paid
    FROM public.contrats c
    LEFT JOIN public.paiements p
      ON p.agency_id = c.agency_id
      AND p.contrat_id = c.id
      AND date_trunc('month', p.mois_concerne)::date = v_month
    WHERE c.agency_id = p_agency_id
      AND c.statut = 'actif'
    GROUP BY c.id, c.loyer_mensuel
  )
  SELECT
    COALESCE(SUM(GREATEST(loyer_mensuel - paid, 0)), 0),
    COUNT(*) FILTER (WHERE GREATEST(loyer_mensuel - paid, 0) > 0)
  INTO v_impayes_mois, v_nb_impayes
  FROM balances;

  RETURN jsonb_build_object(
    'bailleurs', v_bailleurs,
    'immeubles', v_immeubles,
    'unites', v_unites,
    'unites_libres', v_unites_libres,
    'unites_louees', v_unites_louees,
    'locataires', v_locataires,
    'contrats_actifs', v_contrats,
    'revenus_mois', v_revenus_mois,
    'impayes_mois', v_impayes_mois,
    'nb_payes_mois', v_nb_payes,
    'nb_impayes_mois', v_nb_impayes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_revenue(p_agency_id uuid, p_year int)
RETURNS TABLE(month_label text, revenus numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND agency_id = p_agency_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    to_char(gs, 'Mon', 'fr_FR') AS month_label,
    COALESCE(SUM(p.montant_total), 0) AS revenus
  FROM generate_series(
    make_date(p_year, 1, 1),
    make_date(p_year, 12, 1),
    '1 month'::interval
  ) AS gs
  LEFT JOIN public.paiements p
    ON p.agency_id = p_agency_id
    AND p.statut IN ('paye', 'partiel')
    AND p.deleted_at IS NULL
    AND date_trunc('month', p.mois_concerne::date) = gs
  GROUP BY gs
  ORDER BY gs;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_aggregate_kpi_daily(
  p_agency_id uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mrr numeric := 0;
  v_pmt_count int := 0;
  v_pmt_total numeric := 0;
  v_imp_count int := 0;
  v_imp_montant numeric := 0;
  v_new_contracts int := 0;
  v_active_contracts int := 0;
  v_month date := date_trunc('month', p_date)::date;
BEGIN
  SELECT COALESCE(SUM(loyer_mensuel), 0), COUNT(*)
  INTO v_mrr, v_active_contracts
  FROM public.contrats
  WHERE agency_id = p_agency_id
    AND statut = 'actif';

  SELECT COUNT(*), COALESCE(SUM(montant_total), 0)
  INTO v_pmt_count, v_pmt_total
  FROM public.paiements
  WHERE agency_id = p_agency_id
    AND statut IN ('paye', 'partiel')
    AND deleted_at IS NULL
    AND date_paiement = p_date;

  WITH balances AS (
    SELECT
      c.id,
      c.loyer_mensuel,
      COALESCE(SUM(p.montant_total) FILTER (
        WHERE p.statut IN ('paye', 'partiel') AND p.deleted_at IS NULL
      ), 0) AS paid
    FROM public.contrats c
    LEFT JOIN public.paiements p
      ON p.agency_id = c.agency_id
      AND p.contrat_id = c.id
      AND date_trunc('month', p.mois_concerne)::date = v_month
    WHERE c.agency_id = p_agency_id
      AND c.statut = 'actif'
    GROUP BY c.id, c.loyer_mensuel
  )
  SELECT
    COUNT(*) FILTER (WHERE GREATEST(loyer_mensuel - paid, 0) > 0),
    COALESCE(SUM(GREATEST(loyer_mensuel - paid, 0)), 0)
  INTO v_imp_count, v_imp_montant
  FROM balances;

  SELECT COUNT(*)
  INTO v_new_contracts
  FROM public.contrats
  WHERE agency_id = p_agency_id
    AND date_debut = p_date;

  INSERT INTO public.kpi_daily (
    agency_id, date, mrr, paiements_count, paiements_total,
    impayes_count, impayes_montant, new_contracts, active_contracts
  )
  VALUES (
    p_agency_id, p_date, v_mrr, v_pmt_count, v_pmt_total,
    v_imp_count, v_imp_montant, v_new_contracts, v_active_contracts
  )
  ON CONFLICT (agency_id, date) DO UPDATE SET
    mrr = EXCLUDED.mrr,
    paiements_count = EXCLUDED.paiements_count,
    paiements_total = EXCLUDED.paiements_total,
    impayes_count = EXCLUDED.impayes_count,
    impayes_montant = EXCLUDED.impayes_montant,
    new_contracts = EXCLUDED.new_contracts,
    active_contracts = EXCLUDED.active_contracts,
    computed_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_aggregate_kpi_monthly(
  p_agency_id uuid,
  p_period date DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mrr numeric := 0;
  v_pmt_total numeric := 0;
  v_contrats int := 0;
  v_impayes_rate numeric := 0;
  v_new_c int := 0;
  v_cancel_c int := 0;
  v_churn_rate numeric := 0;
  v_mrr_prev numeric := 0;
  v_mrr_growth numeric := 0;
  v_prev_period date := (p_period - interval '1 month')::date;
  v_imp_contracts int := 0;
BEGIN
  SELECT COALESCE(SUM(loyer_mensuel), 0), COUNT(*)
  INTO v_mrr, v_contrats
  FROM public.contrats
  WHERE agency_id = p_agency_id
    AND statut = 'actif';

  SELECT COALESCE(mrr, 0)
  INTO v_mrr_prev
  FROM public.kpi_monthly
  WHERE agency_id = p_agency_id
    AND period = v_prev_period;

  v_mrr_growth := CASE
    WHEN v_mrr_prev > 0 THEN ROUND(((v_mrr - v_mrr_prev) / v_mrr_prev) * 100, 2)
    ELSE 0
  END;

  SELECT COALESCE(SUM(montant_total), 0)
  INTO v_pmt_total
  FROM public.paiements
  WHERE agency_id = p_agency_id
    AND statut IN ('paye', 'partiel')
    AND deleted_at IS NULL
    AND date_trunc('month', mois_concerne::date) = p_period;

  WITH balances AS (
    SELECT
      c.id,
      c.loyer_mensuel,
      COALESCE(SUM(p.montant_total) FILTER (
        WHERE p.statut IN ('paye', 'partiel') AND p.deleted_at IS NULL
      ), 0) AS paid
    FROM public.contrats c
    LEFT JOIN public.paiements p
      ON p.agency_id = c.agency_id
      AND p.contrat_id = c.id
      AND date_trunc('month', p.mois_concerne)::date = p_period
    WHERE c.agency_id = p_agency_id
      AND c.statut = 'actif'
    GROUP BY c.id, c.loyer_mensuel
  )
  SELECT COUNT(*) FILTER (WHERE GREATEST(loyer_mensuel - paid, 0) > 0)
  INTO v_imp_contracts
  FROM balances;

  v_impayes_rate := CASE
    WHEN v_contrats > 0 THEN ROUND((v_imp_contracts::numeric / v_contrats) * 100, 2)
    ELSE 0
  END;

  SELECT COUNT(*)
  INTO v_new_c
  FROM public.contrats
  WHERE agency_id = p_agency_id
    AND date_trunc('month', created_at) = p_period;

  SELECT COUNT(*)
  INTO v_cancel_c
  FROM public.contrats
  WHERE agency_id = p_agency_id
    AND date_trunc('month', updated_at) = p_period
    AND statut IN ('resilie', 'expire');

  v_churn_rate := CASE
    WHEN (v_contrats + v_cancel_c) > 0
      THEN ROUND((v_cancel_c::numeric / (v_contrats + v_cancel_c)) * 100, 2)
    ELSE 0
  END;

  INSERT INTO public.kpi_monthly (
    agency_id, period, mrr, paiements_total, contrats_actifs,
    impayes_rate, new_contracts, cancelled_contracts,
    churn_rate, mrr_prev_period, mrr_growth
  )
  VALUES (
    p_agency_id, p_period, v_mrr, v_pmt_total, v_contrats,
    v_impayes_rate, v_new_c, v_cancel_c,
    v_churn_rate, v_mrr_prev, v_mrr_growth
  )
  ON CONFLICT (agency_id, period) DO UPDATE SET
    mrr = EXCLUDED.mrr,
    paiements_total = EXCLUDED.paiements_total,
    contrats_actifs = EXCLUDED.contrats_actifs,
    impayes_rate = EXCLUDED.impayes_rate,
    new_contracts = EXCLUDED.new_contracts,
    cancelled_contracts = EXCLUDED.cancelled_contracts,
    churn_rate = EXCLUDED.churn_rate,
    mrr_prev_period = EXCLUDED.mrr_prev_period,
    mrr_growth = EXCLUDED.mrr_growth,
    computed_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.fn_detect_impayes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_detect_impayes() TO service_role;

COMMIT;
