-- Finance Locative Phase 1
-- Server-side financial read models + protected expense mutations.
-- React displays; PostgreSQL calculates.

CREATE OR REPLACE FUNCTION public.fn_finance_open_receivables(
  p_agency_id uuid,
  p_start date DEFAULT NULL,
  p_end date DEFAULT NULL
)
RETURNS TABLE (
  id text,
  contrat_id uuid,
  bailleur_id uuid,
  locataire_nom text,
  locataire_prenom text,
  telephone_locataire text,
  unite_nom text,
  immeuble_nom text,
  bailleur_nom text,
  bailleur_prenom text,
  montant_attendu numeric,
  montant_encaisse numeric,
  montant_du numeric,
  mois_concerne date,
  date_echeance date,
  statut text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_agency uuid;
  v_role text;
  v_profile_bailleur_id uuid;
  v_is_owner_account boolean := false;
  v_start date;
  v_end date;
  v_tolerance numeric := 3;
BEGIN
  SELECT up.agency_id, up.role::text, up.bailleur_id, COALESCE(a.is_bailleur_account, false)
  INTO v_profile_agency, v_role, v_profile_bailleur_id, v_is_owner_account
  FROM public.user_profiles up
  LEFT JOIN public.agencies a ON a.id = up.agency_id
  WHERE up.id = v_user_id
    AND COALESCE(up.actif, true) = true;

  IF v_user_id IS NULL OR v_profile_agency IS NULL OR v_profile_agency <> p_agency_id THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN';
  END IF;

  v_start := COALESCE(date_trunc('month', p_start)::date, date_trunc('month', CURRENT_DATE - interval '12 months')::date);
  v_end := COALESCE(date_trunc('month', p_end)::date, date_trunc('month', CURRENT_DATE + interval '2 months')::date);

  IF v_end < v_start THEN
    RAISE EXCEPTION 'FINANCE_INVALID_PERIOD';
  END IF;

  RETURN QUERY
  WITH contract_months AS (
    SELECT
      c.id AS contrat_id,
      i.bailleur_id,
      COALESCE(l.nom, '')::text AS locataire_nom,
      COALESCE(l.prenom, '')::text AS locataire_prenom,
      COALESCE(l.telephone, '')::text AS telephone_locataire,
      COALESCE(u.nom, '')::text AS unite_nom,
      COALESCE(i.nom, '')::text AS immeuble_nom,
      COALESCE(b.nom, '')::text AS bailleur_nom,
      COALESCE(b.prenom, '')::text AS bailleur_prenom,
      c.loyer_mensuel::numeric AS montant_attendu,
      c.date_debut,
      month_item.month_start::date AS mois_concerne
    FROM public.contrats c
    JOIN public.locataires l ON l.id = c.locataire_id
    JOIN public.unites u ON u.id = c.unite_id
    JOIN public.immeubles i ON i.id = u.immeuble_id
    LEFT JOIN public.bailleurs b ON b.id = i.bailleur_id
    CROSS JOIN LATERAL generate_series(
      GREATEST(date_trunc('month', c.date_debut)::date, v_start),
      LEAST(COALESCE(date_trunc('month', c.date_fin)::date, v_end), v_end),
      interval '1 month'
    ) AS month_item(month_start)
    WHERE c.agency_id = p_agency_id
      AND c.statut IN ('actif', 'expire', 'resilie')
      AND (c.statut = 'actif' OR c.date_fin IS NOT NULL)
      AND (
        v_role <> 'bailleur'
        OR v_is_owner_account
        OR v_profile_bailleur_id IS NULL
        OR i.bailleur_id = v_profile_bailleur_id
      )
  ),
  paid AS (
    SELECT
      p.contrat_id,
      date_trunc('month', p.mois_concerne)::date AS mois_concerne,
      COALESCE(SUM(p.montant_total), 0)::numeric AS montant_encaisse,
      MIN(p.date_paiement)::date AS premiere_date_paiement
    FROM public.paiements p
    WHERE p.agency_id = p_agency_id
      AND p.statut IN ('paye', 'partiel')
      AND p.deleted_at IS NULL
    GROUP BY p.contrat_id, date_trunc('month', p.mois_concerne)::date
  ),
  rows AS (
    SELECT
      cm.*,
      COALESCE(pa.montant_encaisse, 0)::numeric AS montant_encaisse,
      GREATEST(cm.montant_attendu - COALESCE(pa.montant_encaisse, 0), 0)::numeric AS raw_montant_du,
      make_date(
        EXTRACT(year FROM cm.mois_concerne)::int,
        EXTRACT(month FROM cm.mois_concerne)::int,
        LEAST(
          EXTRACT(day FROM cm.date_debut)::int,
          EXTRACT(day FROM (date_trunc('month', cm.mois_concerne) + interval '1 month - 1 day'))::int
        )
      )::date AS due_date
    FROM contract_months cm
    LEFT JOIN paid pa
      ON pa.contrat_id = cm.contrat_id
     AND pa.mois_concerne = cm.mois_concerne
  )
  SELECT
    (rows.contrat_id::text || '-' || to_char(rows.mois_concerne, 'YYYY-MM'))::text AS id,
    rows.contrat_id,
    rows.bailleur_id,
    rows.locataire_nom,
    rows.locataire_prenom,
    rows.telephone_locataire,
    rows.unite_nom,
    rows.immeuble_nom,
    rows.bailleur_nom,
    rows.bailleur_prenom,
    rows.montant_attendu,
    rows.montant_encaisse,
    CASE WHEN rows.raw_montant_du <= v_tolerance THEN 0 ELSE rows.raw_montant_du END AS montant_du,
    rows.mois_concerne,
    rows.due_date AS date_echeance,
    CASE
      WHEN rows.montant_encaisse > 0 AND rows.raw_montant_du > v_tolerance THEN 'partiel'
      WHEN rows.due_date > CURRENT_DATE THEN 'a_venir'
      ELSE 'en_retard'
    END::text AS statut
  FROM rows
  WHERE rows.raw_montant_du > v_tolerance
  ORDER BY
    CASE
      WHEN rows.montant_encaisse > 0 AND rows.raw_montant_du > v_tolerance THEN 1
      WHEN rows.due_date > CURRENT_DATE THEN 2
      ELSE 0
    END,
    rows.due_date ASC,
    rows.locataire_nom ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_finance_agency_summary(
  p_agency_id uuid,
  p_start date,
  p_end date
)
RETURNS TABLE (
  loyers_encaisses numeric,
  commissions_agence numeric,
  net_bailleurs numeric,
  depenses_total numeric,
  reliquats_ouverts numeric,
  impayes_en_retard numeric,
  echeances_ouvertes integer,
  paiements_count integer,
  contrats_actifs integer,
  solde_operationnel numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_agency uuid;
  v_start date := COALESCE(p_start, date_trunc('month', CURRENT_DATE)::date);
  v_end date := COALESCE(p_end, (date_trunc('month', CURRENT_DATE) + interval '1 month')::date);
BEGIN
  SELECT agency_id INTO v_profile_agency
  FROM public.user_profiles
  WHERE id = v_user_id
    AND COALESCE(actif, true) = true;

  IF v_user_id IS NULL OR v_profile_agency IS NULL OR v_profile_agency <> p_agency_id THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN';
  END IF;

  RETURN QUERY
  WITH payments AS (
    SELECT
      COALESCE(SUM(p.montant_total), 0)::numeric AS loyers_encaisses,
      COALESCE(SUM(p.part_agence), 0)::numeric AS commissions_agence,
      COALESCE(SUM(p.part_bailleur), 0)::numeric AS net_bailleurs,
      COUNT(*)::int AS paiements_count
    FROM public.paiements p
    WHERE p.agency_id = p_agency_id
      AND p.statut IN ('paye', 'partiel')
      AND p.deleted_at IS NULL
      AND p.mois_concerne >= v_start
      AND p.mois_concerne < v_end
  ),
  expenses AS (
    SELECT COALESCE(SUM(d.montant), 0)::numeric AS depenses_total
    FROM public.depenses d
    WHERE d.agency_id = p_agency_id
      AND COALESCE(d.actif, true) = true
      AND d.deleted_at IS NULL
      AND d.date_depense >= v_start
      AND d.date_depense < v_end
  ),
  receivables AS (
    SELECT
      COALESCE(SUM(r.montant_du), 0)::numeric AS reliquats_ouverts,
      COALESCE(SUM(r.montant_du) FILTER (WHERE r.statut IN ('en_retard', 'partiel')), 0)::numeric AS impayes_en_retard,
      COUNT(*)::int AS echeances_ouvertes
    FROM public.fn_finance_open_receivables(p_agency_id, v_start, (v_end - interval '1 day')::date) r
  ),
  active_contracts AS (
    SELECT COUNT(*)::int AS contrats_actifs
    FROM public.contrats c
    WHERE c.agency_id = p_agency_id
      AND c.statut = 'actif'
  )
  SELECT
    payments.loyers_encaisses,
    payments.commissions_agence,
    payments.net_bailleurs,
    expenses.depenses_total,
    receivables.reliquats_ouverts,
    receivables.impayes_en_retard,
    receivables.echeances_ouvertes,
    payments.paiements_count,
    active_contracts.contrats_actifs,
    (payments.commissions_agence - expenses.depenses_total)::numeric AS solde_operationnel
  FROM payments, expenses, receivables, active_contracts;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_finance_owner_summary(
  p_agency_id uuid,
  p_start date,
  p_end date,
  p_bailleur_id uuid DEFAULT NULL
)
RETURNS TABLE (
  bailleur_id uuid,
  bailleur_nom text,
  bailleur_prenom text,
  loyers_encaisses numeric,
  commissions_agence numeric,
  net_bailleur numeric,
  depenses_total numeric,
  reliquats_ouverts numeric,
  contrats_actifs integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_agency uuid;
  v_role text;
  v_profile_bailleur_id uuid;
  v_is_owner_account boolean := false;
  v_start date := COALESCE(p_start, date_trunc('month', CURRENT_DATE)::date);
  v_end date := COALESCE(p_end, (date_trunc('month', CURRENT_DATE) + interval '1 month')::date);
BEGIN
  SELECT up.agency_id, up.role::text, up.bailleur_id, COALESCE(a.is_bailleur_account, false)
  INTO v_profile_agency, v_role, v_profile_bailleur_id, v_is_owner_account
  FROM public.user_profiles up
  LEFT JOIN public.agencies a ON a.id = up.agency_id
  WHERE up.id = v_user_id
    AND COALESCE(up.actif, true) = true;

  IF v_user_id IS NULL OR v_profile_agency IS NULL OR v_profile_agency <> p_agency_id THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN';
  END IF;

  IF v_role = 'bailleur' AND NOT v_is_owner_account AND v_profile_bailleur_id IS NOT NULL
     AND p_bailleur_id IS NOT NULL AND p_bailleur_id <> v_profile_bailleur_id THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN';
  END IF;

  RETURN QUERY
  WITH owners AS (
    SELECT b.id, b.nom, b.prenom
    FROM public.bailleurs b
    WHERE b.agency_id = p_agency_id
      AND COALESCE(b.actif, true) = true
      AND (p_bailleur_id IS NULL OR b.id = p_bailleur_id)
      AND (
        v_role <> 'bailleur'
        OR v_is_owner_account
        OR v_profile_bailleur_id IS NULL
        OR b.id = v_profile_bailleur_id
      )
  ),
  payment_rollup AS (
    SELECT
      i.bailleur_id,
      COALESCE(SUM(p.montant_total), 0)::numeric AS loyers_encaisses,
      COALESCE(SUM(p.part_agence), 0)::numeric AS commissions_agence,
      COALESCE(SUM(p.part_bailleur), 0)::numeric AS net_bailleur
    FROM public.paiements p
    JOIN public.contrats c ON c.id = p.contrat_id
    JOIN public.unites u ON u.id = c.unite_id
    JOIN public.immeubles i ON i.id = u.immeuble_id
    WHERE p.agency_id = p_agency_id
      AND p.statut IN ('paye', 'partiel')
      AND p.deleted_at IS NULL
      AND p.mois_concerne >= v_start
      AND p.mois_concerne < v_end
    GROUP BY i.bailleur_id
  ),
  expense_rollup AS (
    SELECT
      i.bailleur_id,
      COALESCE(SUM(d.montant), 0)::numeric AS depenses_total
    FROM public.depenses d
    JOIN public.immeubles i ON i.id = d.immeuble_id
    WHERE d.agency_id = p_agency_id
      AND COALESCE(d.actif, true) = true
      AND d.deleted_at IS NULL
      AND d.date_depense >= v_start
      AND d.date_depense < v_end
    GROUP BY i.bailleur_id
  ),
  receivable_rollup AS (
    SELECT
      r.bailleur_id,
      COALESCE(SUM(r.montant_du), 0)::numeric AS reliquats_ouverts
    FROM public.fn_finance_open_receivables(p_agency_id, v_start, (v_end - interval '1 day')::date) r
    GROUP BY r.bailleur_id
  ),
  contract_rollup AS (
    SELECT
      i.bailleur_id,
      COUNT(*)::int AS contrats_actifs
    FROM public.contrats c
    JOIN public.unites u ON u.id = c.unite_id
    JOIN public.immeubles i ON i.id = u.immeuble_id
    WHERE c.agency_id = p_agency_id
      AND c.statut = 'actif'
    GROUP BY i.bailleur_id
  )
  SELECT
    owners.id AS bailleur_id,
    owners.nom::text AS bailleur_nom,
    owners.prenom::text AS bailleur_prenom,
    COALESCE(payment_rollup.loyers_encaisses, 0),
    COALESCE(payment_rollup.commissions_agence, 0),
    COALESCE(payment_rollup.net_bailleur, 0),
    COALESCE(expense_rollup.depenses_total, 0),
    COALESCE(receivable_rollup.reliquats_ouverts, 0),
    COALESCE(contract_rollup.contrats_actifs, 0)
  FROM owners
  LEFT JOIN payment_rollup ON payment_rollup.bailleur_id = owners.id
  LEFT JOIN expense_rollup ON expense_rollup.bailleur_id = owners.id
  LEFT JOIN receivable_rollup ON receivable_rollup.bailleur_id = owners.id
  LEFT JOIN contract_rollup ON contract_rollup.bailleur_id = owners.id
  ORDER BY owners.nom ASC, owners.prenom ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_finance_assert_depense_permission(
  p_agency_id uuid,
  p_action text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_agency uuid;
  v_can boolean := false;
BEGIN
  SELECT agency_id INTO v_profile_agency
  FROM public.user_profiles
  WHERE id = v_user_id
    AND COALESCE(actif, true) = true;

  IF v_user_id IS NULL OR v_profile_agency IS NULL OR v_profile_agency <> p_agency_id THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN';
  END IF;

  SELECT COALESCE(public.fn_user_can(v_user_id, 'depenses', p_action), false) INTO v_can;
  IF NOT v_can THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN';
  END IF;

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_finance_create_depense(
  p_agency_id uuid,
  p_montant numeric,
  p_date_depense date,
  p_categorie text,
  p_description text DEFAULT NULL,
  p_beneficiaire text DEFAULT NULL,
  p_immeuble_id uuid DEFAULT NULL,
  p_piece_justificative text DEFAULT NULL
)
RETURNS public.depenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_depense public.depenses;
BEGIN
  v_user_id := public.fn_finance_assert_depense_permission(p_agency_id, 'create');

  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'DEPENSE_AMOUNT_INVALID';
  END IF;

  IF p_immeuble_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.immeubles i WHERE i.id = p_immeuble_id AND i.agency_id = p_agency_id
  ) THEN
    RAISE EXCEPTION 'DEPENSE_IMMEUBLE_NOT_FOUND';
  END IF;

  INSERT INTO public.depenses (
    agency_id, montant, date_depense, categorie, description, beneficiaire,
    immeuble_id, piece_justificative, created_by, actif, deleted_at
  )
  VALUES (
    p_agency_id, p_montant, p_date_depense, p_categorie, p_description, p_beneficiaire,
    p_immeuble_id, p_piece_justificative, v_user_id, true, NULL
  )
  RETURNING * INTO v_depense;

  INSERT INTO public.event_log (agency_id, event_type, entity_type, entity_id, payload, created_by)
  VALUES (
    p_agency_id,
    'depense.created',
    'depenses',
    v_depense.id,
    jsonb_build_object('montant', v_depense.montant, 'categorie', v_depense.categorie),
    v_user_id
  );

  RETURN v_depense;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_finance_update_depense(
  p_agency_id uuid,
  p_id uuid,
  p_montant numeric,
  p_date_depense date,
  p_categorie text,
  p_description text DEFAULT NULL,
  p_beneficiaire text DEFAULT NULL,
  p_immeuble_id uuid DEFAULT NULL,
  p_piece_justificative text DEFAULT NULL
)
RETURNS public.depenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_depense public.depenses;
BEGIN
  v_user_id := public.fn_finance_assert_depense_permission(p_agency_id, 'update');

  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'DEPENSE_AMOUNT_INVALID';
  END IF;

  IF p_immeuble_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.immeubles i WHERE i.id = p_immeuble_id AND i.agency_id = p_agency_id
  ) THEN
    RAISE EXCEPTION 'DEPENSE_IMMEUBLE_NOT_FOUND';
  END IF;

  UPDATE public.depenses
  SET montant = p_montant,
      date_depense = p_date_depense,
      categorie = p_categorie,
      description = p_description,
      beneficiaire = p_beneficiaire,
      immeuble_id = p_immeuble_id,
      piece_justificative = COALESCE(p_piece_justificative, piece_justificative),
      updated_at = now()
  WHERE id = p_id
    AND agency_id = p_agency_id
    AND deleted_at IS NULL
    AND COALESCE(actif, true) = true
  RETURNING * INTO v_depense;

  IF v_depense.id IS NULL THEN
    RAISE EXCEPTION 'DEPENSE_NOT_FOUND';
  END IF;

  INSERT INTO public.event_log (agency_id, event_type, entity_type, entity_id, payload, created_by)
  VALUES (
    p_agency_id,
    'depense.updated',
    'depenses',
    v_depense.id,
    jsonb_build_object('montant', v_depense.montant, 'categorie', v_depense.categorie),
    v_user_id
  );

  RETURN v_depense;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_finance_cancel_depense(
  p_agency_id uuid,
  p_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.depenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_depense public.depenses;
BEGIN
  v_user_id := public.fn_finance_assert_depense_permission(p_agency_id, 'delete');

  UPDATE public.depenses
  SET actif = false,
      deleted_at = now(),
      updated_at = now()
  WHERE id = p_id
    AND agency_id = p_agency_id
    AND deleted_at IS NULL
  RETURNING * INTO v_depense;

  IF v_depense.id IS NULL THEN
    RAISE EXCEPTION 'DEPENSE_NOT_FOUND';
  END IF;

  INSERT INTO public.event_log (agency_id, event_type, entity_type, entity_id, payload, created_by)
  VALUES (
    p_agency_id,
    'depense.cancelled',
    'depenses',
    v_depense.id,
    jsonb_build_object('montant', v_depense.montant, 'reason', p_reason),
    v_user_id
  );

  RETURN v_depense;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_finance_open_receivables(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_finance_agency_summary(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_finance_owner_summary(uuid, date, date, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_finance_assert_depense_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_finance_create_depense(uuid, numeric, date, text, text, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_finance_update_depense(uuid, uuid, numeric, date, text, text, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_finance_cancel_depense(uuid, uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_finance_open_receivables(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_finance_agency_summary(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_finance_owner_summary(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_finance_create_depense(uuid, numeric, date, text, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_finance_update_depense(uuid, uuid, numeric, date, text, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_finance_cancel_depense(uuid, uuid, text) TO authenticated;
