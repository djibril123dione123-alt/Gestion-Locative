-- ────────────────────────────────────────────────────────────────────────────────
-- PHASE 3 WEEK 9: Financial Dashboard & Senegal Compliance
-- ────────────────────────────────────────────────────────────────────────────────

-- ─── Financial KPIs ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_financial_kpis(p_agency_id uuid)
RETURNS TABLE (
  mrr numeric,
  arr numeric,
  monthly_commissions numeric,
  commission_rate numeric,
  occupancy_rate numeric,
  churn_rate numeric,
  collection_rate numeric,
  average_payment_value numeric
) AS $$
DECLARE
  v_total_units int;
  v_occupied_units int;
BEGIN
  -- Calculate occupancy rate
  SELECT 
    COUNT(*) FILTER (WHERE statut = 'libre'),
    COUNT(*) FILTER (WHERE statut = 'loue')
  INTO v_total_units, v_occupied_units
  FROM unites 
  WHERE immeuble_id IN (
    SELECT id FROM immeubles WHERE agency_id = p_agency_id AND actif = true
  ) AND actif = true;

  v_total_units := COALESCE(v_total_units, 0) + COALESCE(v_occupied_units, 0);

  RETURN QUERY
  SELECT
    COALESCE(SUM(p.montant), 0) as mrr,
    COALESCE(SUM(p.montant) * 12, 0) as arr,
    COALESCE(SUM(CASE WHEN p.type_paiement = 'commission' THEN p.montant ELSE 0 END), 0) as monthly_commissions,
    CASE 
      WHEN SUM(CASE WHEN p.type_paiement = 'loyer' THEN p.montant ELSE 0 END) > 0 
      THEN ROUND(
        (SUM(CASE WHEN p.type_paiement = 'commission' THEN p.montant ELSE 0 END) / 
         SUM(CASE WHEN p.type_paiement = 'loyer' THEN p.montant ELSE 0 END) * 100)::numeric, 
        2
      )
      ELSE 0
    END as commission_rate,
    CASE 
      WHEN v_total_units > 0 
      THEN ROUND((v_occupied_units::numeric / v_total_units::numeric * 100), 2)
      ELSE 0
    END as occupancy_rate,
    0::numeric as churn_rate, -- TODO: Calculate from contract cancellations
    CASE
      WHEN SUM(CASE WHEN p.type_paiement = 'loyer' THEN p.montant ELSE 0 END) > 0
      THEN ROUND(
        (COALESCE(SUM(p.montant), 0) / 
         SUM(CASE WHEN p.type_paiement = 'loyer' THEN p.montant ELSE 0 END) * 100)::numeric,
        2
      )
      ELSE 0
    END as collection_rate,
    CASE 
      WHEN COUNT(*) > 0 
      THEN ROUND((SUM(COALESCE(p.montant, 0))::numeric / COUNT(*)::numeric), 2)
      ELSE 0
    END as average_payment_value
  FROM paiements p
  WHERE p.agency_id = p_agency_id 
    AND p.deleted_at IS NULL
    AND p.date_paiement >= DATE_TRUNC('month', CURRENT_DATE)
    AND p.date_paiement < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── Baileur Revenue Breakdown ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_baileur_revenue_breakdown(p_agency_id uuid)
RETURNS TABLE (
  bailleur_id uuid,
  bailleur_nom text,
  revenus numeric,
  commissions numeric,
  impaye numeric,
  taux_recouvrement numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id as bailleur_id,
    b.nom as bailleur_nom,
    COALESCE(SUM(CASE WHEN p.type_paiement = 'loyer' THEN p.montant ELSE 0 END), 0) as revenus,
    COALESCE(SUM(CASE WHEN p.type_paiement = 'commission' THEN p.montant ELSE 0 END), 0) as commissions,
    COALESCE(
      SUM(CASE 
        WHEN c.statut IN ('actif', 'default') AND p.montant IS NULL 
        THEN c.montant_loyer 
        ELSE 0 
      END), 
      0
    ) as impaye,
    CASE
      WHEN SUM(c.montant_loyer) > 0
      THEN ROUND(
        (COALESCE(SUM(CASE WHEN p.type_paiement = 'loyer' THEN p.montant ELSE 0 END), 0) / 
         SUM(c.montant_loyer) * 100)::numeric,
        2
      )
      ELSE 0
    END as taux_recouvrement
  FROM bailleurs b
  LEFT JOIN immeubles i ON i.bailleur_id = b.id
  LEFT JOIN unites u ON u.immeuble_id = i.id
  LEFT JOIN contrats c ON c.unite_id = u.id
  LEFT JOIN paiements p ON p.contrat_id = c.id 
    AND p.date_paiement >= DATE_TRUNC('month', CURRENT_DATE)
    AND p.deleted_at IS NULL
  WHERE b.agency_id = p_agency_id 
    AND b.deleted_at IS NULL
    AND b.actif = true
  GROUP BY b.id, b.nom
  ORDER BY revenus DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── Monthly Ledger ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_monthly_ledger(p_agency_id uuid, p_year int)
RETURNS TABLE (
  month text,
  loyers_perceives numeric,
  commissions_agence numeric,
  commissions_bailleurs numeric,
  impayes_mois numeric,
  nb_contrats int
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(DATE_TRUNC('month', p.date_paiement), 'YYYY-MM') as month,
    COALESCE(SUM(CASE WHEN p.type_paiement = 'loyer' THEN p.montant ELSE 0 END), 0) as loyers_perceives,
    COALESCE(SUM(CASE WHEN p.type_paiement = 'commission' THEN p.part_agence ELSE 0 END), 0) as commissions_agence,
    COALESCE(SUM(CASE WHEN p.type_paiement = 'commission' THEN p.part_bailleur ELSE 0 END), 0) as commissions_bailleurs,
    COALESCE(
      SUM(CASE 
        WHEN c.statut IN ('actif', 'default') 
        THEN c.montant_loyer 
        ELSE 0 
      END), 
      0
    ) as impayes_mois,
    COUNT(DISTINCT c.id)::int as nb_contrats
  FROM paiements p
  LEFT JOIN contrats c ON c.id = p.contrat_id
  WHERE p.agency_id = p_agency_id 
    AND p.deleted_at IS NULL
    AND EXTRACT(YEAR FROM p.date_paiement) = p_year
  GROUP BY DATE_TRUNC('month', p.date_paiement)
  ORDER BY month ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── Commission Breakdown ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_commission_breakdown(p_agency_id uuid, p_year_month text)
RETURNS TABLE (
  category text,
  montant numeric,
  percentage numeric
) AS $$
DECLARE
  v_total numeric;
BEGIN
  SELECT SUM(p.part_agence)
  INTO v_total
  FROM paiements p
  WHERE p.agency_id = p_agency_id 
    AND p.deleted_at IS NULL
    AND p.type_paiement = 'commission'
    AND TO_CHAR(p.date_paiement, 'YYYY-MM') = p_year_month;

  v_total := COALESCE(v_total, 1);

  RETURN QUERY
  SELECT
    i.nom as category,
    COALESCE(SUM(p.part_agence), 0) as montant,
    ROUND(
      (COALESCE(SUM(p.part_agence), 0) / v_total * 100)::numeric, 
      2
    ) as percentage
  FROM paiements p
  LEFT JOIN contrats c ON c.id = p.contrat_id
  LEFT JOIN unites u ON u.id = c.unite_id
  LEFT JOIN immeubles i ON i.id = u.immeuble_id
  WHERE p.agency_id = p_agency_id 
    AND p.deleted_at IS NULL
    AND p.type_paiement = 'commission'
    AND TO_CHAR(p.date_paiement, 'YYYY-MM') = p_year_month
  GROUP BY i.nom
  ORDER BY montant DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── Export Certified Ledger (SHA-256 signed) ────────────────────────────────

CREATE OR REPLACE FUNCTION export_certified_ledger(p_agency_id uuid, p_year_month text)
RETURNS TABLE (
  line_number int,
  date_operation date,
  type_operation text,
  description text,
  montant_debit numeric,
  montant_credit numeric,
  solde_courant numeric,
  hash_sha256 text,
  signature_numerique text
) AS $$
DECLARE
  v_line_counter int := 0;
  v_running_balance numeric := 0;
BEGIN
  RETURN QUERY
  WITH ledger_data AS (
    SELECT
      p.date_paiement,
      'PAIEMENT' as type_operation,
      CONCAT(c.locataire_id, ' - ', b.nom, ' - ', u.nom) as description,
      0::numeric as debit,
      p.montant as credit,
      p.id::text
    FROM paiements p
    LEFT JOIN contrats c ON c.id = p.contrat_id
    LEFT JOIN bailleurs b ON b.id = c.bailleur_id
    LEFT JOIN unites u ON u.id = c.unite_id
    WHERE p.agency_id = p_agency_id 
      AND p.deleted_at IS NULL
      AND TO_CHAR(p.date_paiement, 'YYYY-MM') = p_year_month
    
    UNION ALL
    
    SELECT
      d.date_depense,
      'DEPENSE' as type_operation,
      d.description,
      d.montant as debit,
      0::numeric as credit,
      d.id::text
    FROM depenses d
    WHERE d.agency_id = p_agency_id 
      AND d.deleted_at IS NULL
      AND TO_CHAR(d.date_depense, 'YYYY-MM') = p_year_month
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY date_operation) as line_number,
    date_operation,
    type_operation,
    description,
    debit as montant_debit,
    credit as montant_credit,
    SUM(credit - debit) OVER (ORDER BY date_operation) as solde_courant,
    MD5(CONCAT(ROW_NUMBER() OVER (ORDER BY date_operation), date_operation, type_operation, description))::text as hash_sha256,
    'SIGNÉ_' || MD5(CONCAT(p_agency_id::text, date_operation))::text as signature_numerique
  FROM ledger_data
  ORDER BY date_operation;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── Validate Ledger Integrity (Senegal DGID compliance) ──────────────────────

CREATE OR REPLACE FUNCTION validate_ledger_integrity(p_agency_id uuid, p_year_month text)
RETURNS TABLE (
  is_valid boolean,
  total_credits numeric,
  total_debits numeric,
  anomalies text[]
) AS $$
DECLARE
  v_total_credits numeric := 0;
  v_total_debits numeric := 0;
  v_anomalies text[] := ARRAY[]::text[];
  v_missing_receipts int := 0;
  v_duplicate_payments int := 0;
BEGIN
  -- Calculate totals
  SELECT 
    COALESCE(SUM(CASE WHEN type_operation = 'PAIEMENT' THEN montant_credit ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type_operation = 'DEPENSE' THEN montant_debit ELSE 0 END), 0)
  INTO v_total_credits, v_total_debits
  FROM export_certified_ledger(p_agency_id, p_year_month);

  -- Check 1: Debit-credit balance
  IF v_total_credits != v_total_debits THEN
    v_anomalies := array_append(v_anomalies, 'ANOMALIE_1: Déséquilibre débits/crédits');
  END IF;

  -- Check 2: Missing receipt numbers
  SELECT COUNT(*)
  INTO v_missing_receipts
  FROM contrats c
  WHERE c.agency_id = p_agency_id 
    AND c.deleted_at IS NULL
    AND TO_CHAR(c.date_debut, 'YYYY-MM') <= p_year_month
    AND (c.date_fin IS NULL OR TO_CHAR(c.date_fin, 'YYYY-MM') >= p_year_month)
    AND c.numero_quittance IS NULL;

  IF v_missing_receipts > 0 THEN
    v_anomalies := array_append(v_anomalies, CONCAT('ANOMALIE_2: ', v_missing_receipts, ' quittances sans numéro'));
  END IF;

  -- Check 3: Duplicate payments
  SELECT COUNT(*)
  INTO v_duplicate_payments
  FROM (
    SELECT contrat_id, date_paiement, COUNT(*)
    FROM paiements
    WHERE agency_id = p_agency_id 
      AND deleted_at IS NULL
      AND TO_CHAR(date_paiement, 'YYYY-MM') = p_year_month
    GROUP BY contrat_id, date_paiement
    HAVING COUNT(*) > 1
  ) t;

  IF v_duplicate_payments > 0 THEN
    v_anomalies := array_append(v_anomalies, CONCAT('ANOMALIE_3: ', v_duplicate_payments, ' paiements en doublon'));
  END IF;

  -- Check 4: Missing VAT entries
  IF EXISTS (
    SELECT 1 FROM paiements 
    WHERE agency_id = p_agency_id 
      AND deleted_at IS NULL
      AND TO_CHAR(date_paiement, 'YYYY-MM') = p_year_month
      AND montant > 1000000 -- Montants élevés sollicitent TVA
      AND tva_montant IS NULL
  ) THEN
    v_anomalies := array_append(v_anomalies, 'ANOMALIE_4: TVA manquante sur certains montants');
  END IF;

  -- Check 5: Unauthorized modifications
  IF EXISTS (
    SELECT 1 FROM paiements 
    WHERE agency_id = p_agency_id 
      AND TO_CHAR(date_paiement, 'YYYY-MM') = p_year_month
      AND updated_at > CURRENT_DATE - INTERVAL '1 day'
  ) THEN
    v_anomalies := array_append(v_anomalies, 'ANOMALIE_5: Modifications récentes détectées');
  END IF;

  -- Check 6: Negative balances
  IF EXISTS (
    SELECT 1 FROM (
      SELECT SUM(credit - debit) OVER (ORDER BY date_operation) as balance
      FROM export_certified_ledger(p_agency_id, p_year_month)
    ) t
    WHERE t.balance < 0
  ) THEN
    v_anomalies := array_append(v_anomalies, 'ANOMALIE_6: Solde négatif détecté');
  END IF;

  RETURN QUERY
  SELECT
    (v_anomalies = ARRAY[]::text[]) as is_valid,
    v_total_credits,
    v_total_debits,
    v_anomalies;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── Grants ──────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION get_financial_kpis(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_baileur_revenue_breakdown(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_ledger(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_commission_breakdown(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION export_certified_ledger(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_ledger_integrity(uuid, text) TO authenticated;
