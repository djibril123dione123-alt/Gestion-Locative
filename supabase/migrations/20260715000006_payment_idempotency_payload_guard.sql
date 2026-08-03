-- Harden rent-payment idempotency. A key can only replay the exact command
-- that originally created the payment; reusing it with another payload fails.

ALTER TABLE public.paiements
  ADD COLUMN IF NOT EXISTS idempotency_payload jsonb;

COMMENT ON COLUMN public.paiements.idempotency_payload IS
  'Canonical server-side command payload used to validate safe idempotent replay.';

DROP FUNCTION IF EXISTS public.fn_create_paiement_financial(
  uuid, uuid, uuid, numeric, date, date, text, text, text, text, text
);

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
  p_idempotency_key text DEFAULT NULL,
  p_is_demo_data boolean DEFAULT false
)
RETURNS public.paiements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contrat record;
  v_existing public.paiements;
  v_request_payload jsonb;
  v_paid_before numeric(12,2);
  v_paid_after numeric(12,2);
  v_commission numeric(8,4);
  v_part_agence numeric(12,2);
  v_part_bailleur numeric(12,2);
  v_effective_statut public.paiement_statut;
  v_inserted public.paiements;
  v_lock_id uuid;
  v_idempotency_key text := NULLIF(BTRIM(p_idempotency_key), '');
  v_reference text := NULLIF(BTRIM(p_reference), '');
  v_notes text := NULLIF(BTRIM(p_notes), '');
BEGIN
  IF p_agency_id IS NULL OR p_user_id IS NULL OR p_contrat_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_CONTEXT_REQUIRED';
  END IF;

  IF p_montant_total IS NULL OR p_montant_total <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF p_mois_concerne IS NULL OR p_date_paiement IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_DATE_REQUIRED';
  END IF;

  IF p_mode_paiement NOT IN ('especes', 'virement', 'cheque', 'mobile_money', 'autre') THEN
    RAISE EXCEPTION 'PAYMENT_MODE_INVALID';
  END IF;

  IF p_statut NOT IN ('paye', 'partiel', 'en_attente') THEN
    RAISE EXCEPTION 'PAYMENT_STATUS_INVALID';
  END IF;

  IF v_idempotency_key IS NOT NULL
     AND char_length(v_idempotency_key) NOT BETWEEN 12 AND 120 THEN
    RAISE EXCEPTION 'PAYMENT_IDEMPOTENCY_KEY_INVALID';
  END IF;

  v_request_payload := jsonb_build_object(
    'agency_id', p_agency_id,
    'user_id', p_user_id,
    'contrat_id', p_contrat_id,
    'montant_total', p_montant_total,
    'mois_concerne', p_mois_concerne,
    'date_paiement', p_date_paiement,
    'mode_paiement', p_mode_paiement,
    'statut_demande', p_statut,
    'reference', v_reference,
    'notes', v_notes,
    'is_demo_data', coalesce(p_is_demo_data, false)
  );

  IF v_idempotency_key IS NOT NULL THEN
    -- Serialize every command sharing the same tenant/key, even when the
    -- competing requests target different contracts or accounting periods.
    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_agency_id::text || ':payment:' || v_idempotency_key, 0)
    );

    SELECT *
    INTO v_existing
    FROM public.paiements
    WHERE agency_id = p_agency_id
      AND idempotency_key = v_idempotency_key
      AND deleted_at IS NULL
    LIMIT 1;

    IF FOUND THEN
      IF v_existing.idempotency_payload IS NULL THEN
        RAISE EXCEPTION 'PAYMENT_IDEMPOTENCY_LEGACY_UNVERIFIABLE';
      END IF;

      IF v_existing.idempotency_payload IS DISTINCT FROM v_request_payload THEN
        RAISE EXCEPTION 'PAYMENT_IDEMPOTENCY_CONFLICT';
      END IF;

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

  SELECT p.id
  INTO v_lock_id
  FROM public.paiements p
  WHERE p.agency_id = p_agency_id
    AND p.contrat_id = p_contrat_id
    AND p.mois_concerne = p_mois_concerne
    AND p.deleted_at IS NULL
  ORDER BY p.created_at, p.id
  LIMIT 1
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
    idempotency_key, idempotency_payload,
    montant_attendu, montant_encaisse_cumul, reliquat, created_by,
    is_demo_data
  )
  VALUES (
    p_contrat_id, p_agency_id, p_montant_total, p_mois_concerne, p_date_paiement,
    p_mode_paiement::public.mode_paiement, v_part_agence, v_part_bailleur,
    v_effective_statut, v_reference, v_notes,
    v_idempotency_key, v_request_payload,
    v_contrat.loyer_mensuel, v_paid_after,
    GREATEST(v_contrat.loyer_mensuel - v_paid_after, 0), p_user_id,
    coalesce(p_is_demo_data, false)
  )
  RETURNING * INTO v_inserted;

  PERFORM public.fn_recompute_paiement_echeance(
    p_agency_id,
    p_contrat_id,
    p_mois_concerne
  );

  SELECT *
  INTO v_inserted
  FROM public.paiements
  WHERE id = v_inserted.id;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_paiement_financial(
  uuid, uuid, uuid, numeric, date, date, text, text, text, text, text, boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_create_paiement_financial(
  uuid, uuid, uuid, numeric, date, date, text, text, text, text, text, boolean
) TO service_role;
