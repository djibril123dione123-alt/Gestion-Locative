-- =============================================================================
-- RPC : get_dashboard_stats
-- Remplace les 8 requêtes parallèles du Dashboard par une seule fonction SQL.
-- Évite de charger des milliers de lignes en mémoire côté client pour calculer
-- des agrégats simples.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_agency_id uuid, p_year_month text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bailleurs      bigint;
  v_immeubles      bigint;
  v_unites         bigint;
  v_unites_libres  bigint;
  v_unites_louees  bigint;
  v_locataires     bigint;
  v_contrats       bigint;
  v_revenus_mois   numeric := 0;
  v_impayes_mois   numeric := 0;
  v_nb_payes       bigint  := 0;
  v_nb_impayes     bigint  := 0;
BEGIN
  -- Vérifie que l'appelant appartient à cette agence (sécurité multi-tenant)
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND agency_id = p_agency_id
  ) AND NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COUNT(*) INTO v_bailleurs FROM bailleurs WHERE agency_id = p_agency_id AND actif = true;
  SELECT COUNT(*) INTO v_immeubles FROM immeubles WHERE agency_id = p_agency_id AND actif = true;
  SELECT COUNT(*) INTO v_unites FROM unites WHERE agency_id = p_agency_id AND actif = true;
  SELECT COUNT(*) INTO v_unites_libres FROM unites WHERE agency_id = p_agency_id AND actif = true AND statut = 'libre';
  SELECT COUNT(*) INTO v_unites_louees FROM unites WHERE agency_id = p_agency_id AND actif = true AND statut = 'loue';
  SELECT COUNT(*) INTO v_locataires FROM locataires WHERE agency_id = p_agency_id AND actif = true;
  SELECT COUNT(*) INTO v_contrats FROM contrats WHERE agency_id = p_agency_id AND statut = 'actif';

  SELECT
    COALESCE(SUM(CASE WHEN statut = 'paye' THEN montant_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN statut = 'impaye' THEN montant_total ELSE 0 END), 0),
    COUNT(CASE WHEN statut = 'paye' THEN 1 END),
    COUNT(CASE WHEN statut = 'impaye' THEN 1 END)
  INTO v_revenus_mois, v_impayes_mois, v_nb_payes, v_nb_impayes
  FROM paiements
  WHERE agency_id = p_agency_id
    AND to_char(mois_concerne, 'YYYY-MM') = p_year_month;

  RETURN jsonb_build_object(
    'bailleurs',        v_bailleurs,
    'immeubles',        v_immeubles,
    'unites',           v_unites,
    'unites_libres',    v_unites_libres,
    'unites_louees',    v_unites_louees,
    'locataires',       v_locataires,
    'contrats_actifs',  v_contrats,
    'revenus_mois',     v_revenus_mois,
    'impayes_mois',     v_impayes_mois,
    'nb_payes_mois',    v_nb_payes,
    'nb_impayes_mois',  v_nb_impayes
  );
END;
$$;

-- Révoque l'accès public, seuls les utilisateurs authentifiés peuvent appeler la fonction
REVOKE ALL ON FUNCTION get_dashboard_stats(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_dashboard_stats(uuid, text) TO authenticated;

-- =============================================================================
-- RPC : get_monthly_revenue
-- Retourne les revenus mois par mois pour une agence et une année donnée.
-- Évite de charger toute l'année en mémoire côté client.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_monthly_revenue(p_agency_id uuid, p_year int)
RETURNS TABLE(month_label text, revenus numeric)
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
    to_char(gs, 'Mon', 'fr_FR') AS month_label,
    COALESCE(SUM(p.montant_total), 0) AS revenus
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
