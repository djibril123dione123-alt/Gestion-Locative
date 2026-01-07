/*
  ============================================================
  MIGRATIONS CRITIQUES À APPLIQUER SUR SUPABASE
  ============================================================

  Date : 2026-01-07
  Priorité : P0 (BLOQUANT)

  Ces migrations corrigent les problèmes critiques identifiés dans l'audit :
  1. Colonnes manquantes dans tables existantes
  2. Création table agency_settings
  3. Soft delete sur paiements et dépenses
  4. Triggers audit_logs automatiques

  IMPORTANT : Exécuter dans l'ordre, section par section
*/

-- ============================================================
-- SECTION 1 : AJOUT COLONNES MANQUANTES
-- ============================================================

/*
  Problème #2 : Champ commission manquant dans table bailleurs
  Impact : Commission par bailleur non persistée
*/
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bailleurs' AND column_name = 'commission'
  ) THEN
    ALTER TABLE bailleurs ADD COLUMN commission decimal(5,2) DEFAULT 10.00;
    COMMENT ON COLUMN bailleurs.commission IS 'Taux de commission appliqué aux contrats de ce bailleur (%)';
  END IF;
END $$;

/*
  Problème #3 : Champ debut_contrat manquant dans table bailleurs
  Impact : Date de début du mandat bailleur non sauvegardée
*/
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bailleurs' AND column_name = 'debut_contrat'
  ) THEN
    ALTER TABLE bailleurs ADD COLUMN debut_contrat date;
    COMMENT ON COLUMN bailleurs.debut_contrat IS 'Date de début du mandat de gérance';
  END IF;
END $$;

/*
  Problème #4 : Champ destination manquant dans table contrats
  Impact : Destination du bien (Habitation/Commercial) non sauvegardée
*/
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contrats' AND column_name = 'destination'
  ) THEN
    ALTER TABLE contrats ADD COLUMN destination text DEFAULT 'Habitation';
    COMMENT ON COLUMN contrats.destination IS 'Destination du bien loué : Habitation ou Commercial';
  END IF;
END $$;

-- Ajouter contrainte pour valider les valeurs de destination
ALTER TABLE contrats DROP CONSTRAINT IF EXISTS check_destination_valide;
ALTER TABLE contrats ADD CONSTRAINT check_destination_valide
  CHECK (destination IN ('Habitation', 'Commercial', 'Mixte'));

-- ============================================================
-- SECTION 2 : RENOMMER COLONNE pourcentage_agence → commission
-- ============================================================

/*
  Harmoniser la nomenclature : le frontend utilise "commission"
  mais la DB utilise "pourcentage_agence"
*/
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contrats' AND column_name = 'pourcentage_agence'
  ) THEN
    ALTER TABLE contrats RENAME COLUMN pourcentage_agence TO commission;
    COMMENT ON COLUMN contrats.commission IS 'Taux de commission agence pour ce contrat (%)';
  END IF;
END $$;

-- ============================================================
-- SECTION 3 : CRÉATION TABLE AGENCY_SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS agency_settings (
  id text PRIMARY KEY DEFAULT 'default',

  -- Identité de l'agence
  nom_agence text DEFAULT 'Gestion Locative',
  logo_url text,
  couleur_primaire text DEFAULT '#F58220',
  ninea text,
  adresse text,
  telephone text,
  email text,

  -- Paramètres financiers
  commission_globale decimal(5,2) DEFAULT 10.00,
  commission_personnalisee_par_bailleur boolean DEFAULT false,
  penalite_retard_montant decimal(12,2) DEFAULT 1000.00,
  penalite_retard_delai_jours integer DEFAULT 3,
  devise text DEFAULT 'XOF',

  -- Paramètres documents
  qr_code_quittances boolean DEFAULT true,
  signature_url text,
  pied_page_personnalise text DEFAULT 'Gestion Locative - Dakar, Sénégal',
  format_date text DEFAULT 'JJ/MM/AAAA',

  -- Paramètres fonctionnels
  mode_avance_actif boolean DEFAULT false,
  module_depenses_actif boolean DEFAULT true,
  module_inventaires_actif boolean DEFAULT false,
  module_interventions_actif boolean DEFAULT false,
  champs_personnalises_locataire integer DEFAULT 0,

  -- Mobile Money
  wave_actif boolean DEFAULT false,
  wave_numero text,
  orange_money_actif boolean DEFAULT false,
  orange_money_numero text,
  free_money_actif boolean DEFAULT false,
  free_money_numero text,

  -- Notifications
  email_notifications_actif boolean DEFAULT false,
  sms_notifications_actif boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE agency_settings IS 'Paramètres de configuration globale de l''agence (une seule ligne)';

-- Créer trigger pour updated_at
DROP TRIGGER IF EXISTS update_agency_settings_updated_at ON agency_settings;
CREATE TRIGGER update_agency_settings_updated_at
  BEFORE UPDATE ON agency_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Activer RLS
ALTER TABLE agency_settings ENABLE ROW LEVEL SECURITY;

-- Politiques RLS : Tous les users authentifiés peuvent lire
CREATE POLICY "Authenticated users can view agency settings"
  ON agency_settings FOR SELECT
  TO authenticated
  USING (true);

-- Seuls les admins peuvent modifier
CREATE POLICY "Admins can update agency settings"
  ON agency_settings FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Insérer les paramètres par défaut
INSERT INTO agency_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION 4 : SOFT DELETE SUR PAIEMENTS ET DÉPENSES
-- ============================================================

/*
  Problème #13 : Pas de soft delete sur paiements et dépenses
  Risque : Perte définitive de données financières critiques
*/

-- Ajouter colonne actif sur paiements (si n'existe pas déjà)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements' AND column_name = 'actif'
  ) THEN
    ALTER TABLE paiements ADD COLUMN actif boolean DEFAULT true;
    COMMENT ON COLUMN paiements.actif IS 'Soft delete : false = enregistrement supprimé logiquement';
  END IF;
END $$;

-- Ajouter colonne actif sur depenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'depenses' AND column_name = 'actif'
  ) THEN
    ALTER TABLE depenses ADD COLUMN actif boolean DEFAULT true;
    COMMENT ON COLUMN depenses.actif IS 'Soft delete : false = enregistrement supprimé logiquement';
  END IF;
END $$;

-- Ajouter colonne deleted_at pour traçabilité
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE paiements ADD COLUMN deleted_at timestamptz;
    COMMENT ON COLUMN paiements.deleted_at IS 'Date de suppression logique';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'depenses' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE depenses ADD COLUMN deleted_at timestamptz;
    COMMENT ON COLUMN depenses.deleted_at IS 'Date de suppression logique';
  END IF;
END $$;

-- Créer index pour filtrer facilement les enregistrements actifs
CREATE INDEX IF NOT EXISTS idx_paiements_actif ON paiements(actif) WHERE actif = true;
CREATE INDEX IF NOT EXISTS idx_depenses_actif ON depenses(actif) WHERE actif = true;

-- ============================================================
-- SECTION 5 : TRIGGERS AUDIT_LOGS AUTOMATIQUES
-- ============================================================

/*
  Problème #23 : Table audit_logs existe mais n'est pas alimentée
  Solution : Créer triggers automatiques sur tables critiques
*/

-- Fonction générique pour logger les modifications
CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (table_name, record_id, action, new_data, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, user_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_table_changes() IS 'Fonction générique pour logger toutes les modifications dans audit_logs';

-- Créer triggers sur tables critiques
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['bailleurs', 'immeubles', 'unites', 'locataires', 'contrats', 'paiements', 'depenses']
  LOOP
    -- Supprimer trigger existant si présent
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_changes ON %I', table_name, table_name);

    -- Créer nouveau trigger
    EXECUTE format('
      CREATE TRIGGER audit_%I_changes
      AFTER INSERT OR UPDATE OR DELETE ON %I
      FOR EACH ROW EXECUTE FUNCTION log_table_changes()',
      table_name, table_name
    );
  END LOOP;
END $$;

-- ============================================================
-- SECTION 6 : CONTRAINTES DE VALIDATION SERVEUR
-- ============================================================

/*
  Problème #5 : Validation serveur absente
  Solution : Ajouter contraintes CHECK sur colonnes critiques
*/

-- Bailleurs : Commission entre 0 et 100%
ALTER TABLE bailleurs DROP CONSTRAINT IF EXISTS check_commission_valide;
ALTER TABLE bailleurs ADD CONSTRAINT check_commission_valide
  CHECK (commission IS NULL OR (commission >= 0 AND commission <= 100));

-- Contrats : Loyer strictement positif
ALTER TABLE contrats DROP CONSTRAINT IF EXISTS check_loyer_positif;
ALTER TABLE contrats ADD CONSTRAINT check_loyer_positif
  CHECK (loyer_mensuel > 0);

-- Contrats : Commission entre 0 et 100%
ALTER TABLE contrats DROP CONSTRAINT IF EXISTS check_commission_contrat_valide;
ALTER TABLE contrats ADD CONSTRAINT check_commission_contrat_valide
  CHECK (commission IS NULL OR (commission >= 0 AND commission <= 100));

-- Contrats : Date fin après date début
ALTER TABLE contrats DROP CONSTRAINT IF EXISTS check_dates_coherentes;
ALTER TABLE contrats ADD CONSTRAINT check_dates_coherentes
  CHECK (date_fin IS NULL OR date_fin > date_debut);

-- Paiements : Montants positifs
ALTER TABLE paiements DROP CONSTRAINT IF EXISTS check_montants_positifs;
ALTER TABLE paiements ADD CONSTRAINT check_montants_positifs
  CHECK (montant_total > 0 AND part_agence >= 0 AND part_bailleur >= 0);

-- Paiements : Somme des parts = montant total
ALTER TABLE paiements DROP CONSTRAINT IF EXISTS check_parts_coherentes;
ALTER TABLE paiements ADD CONSTRAINT check_parts_coherentes
  CHECK (abs((part_agence + part_bailleur) - montant_total) < 0.01);

-- Dépenses : Montant positif
ALTER TABLE depenses DROP CONSTRAINT IF EXISTS check_depense_positive;
ALTER TABLE depenses ADD CONSTRAINT check_depense_positive
  CHECK (montant > 0);

-- Unités : Loyer base positif
ALTER TABLE unites DROP CONSTRAINT IF EXISTS check_loyer_base_positif;
ALTER TABLE unites ADD CONSTRAINT check_loyer_base_positif
  CHECK (loyer_base > 0);

-- Agency settings : Commission globale valide
ALTER TABLE agency_settings DROP CONSTRAINT IF EXISTS check_commission_globale_valide;
ALTER TABLE agency_settings ADD CONSTRAINT check_commission_globale_valide
  CHECK (commission_globale >= 0 AND commission_globale <= 100);

-- Agency settings : Devise valide
ALTER TABLE agency_settings DROP CONSTRAINT IF EXISTS check_devise_valide;
ALTER TABLE agency_settings ADD CONSTRAINT check_devise_valide
  CHECK (devise IN ('XOF', 'EUR', 'USD', 'GBP', 'CHF'));

-- ============================================================
-- SECTION 7 : VUES MATÉRIALISÉES POUR PERFORMANCE
-- ============================================================

/*
  Problème #11 : Requêtes multiples non optimisées sur Dashboard
  Solution : Créer vue matérialisée avec KPIs pré-calculés
*/

CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_kpis AS
SELECT
  -- Compteurs de base
  (SELECT COUNT(*) FROM bailleurs WHERE actif = true) as total_bailleurs,
  (SELECT COUNT(*) FROM immeubles WHERE actif = true) as total_immeubles,
  (SELECT COUNT(*) FROM unites WHERE actif = true) as total_unites,
  (SELECT COUNT(*) FROM unites WHERE statut = 'loue' AND actif = true) as unites_louees,
  (SELECT COUNT(*) FROM locataires WHERE actif = true) as total_locataires,
  (SELECT COUNT(*) FROM contrats WHERE statut = 'actif') as contrats_actifs,

  -- Financiers du mois en cours
  (SELECT COALESCE(SUM(part_agence), 0)
   FROM paiements
   WHERE actif = true
   AND date_paiement >= date_trunc('month', CURRENT_DATE)
   AND statut = 'paye') as revenus_mois_actuel,

  (SELECT COALESCE(SUM(montant), 0)
   FROM depenses
   WHERE actif = true
   AND date_depense >= date_trunc('month', CURRENT_DATE)) as depenses_mois_actuel,

  -- Taux d'occupation
  CASE
    WHEN (SELECT COUNT(*) FROM unites WHERE actif = true) > 0
    THEN ROUND(((SELECT COUNT(*) FROM unites WHERE statut = 'loue' AND actif = true)::numeric /
                (SELECT COUNT(*) FROM unites WHERE actif = true)::numeric * 100), 2)
    ELSE 0
  END as taux_occupation,

  now() as last_refresh;

COMMENT ON MATERIALIZED VIEW dashboard_kpis IS 'KPIs pré-calculés pour le dashboard (rafraîchir toutes les heures)';

-- Index pour accès rapide
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_kpis_refresh_idx ON dashboard_kpis(last_refresh);

-- Fonction pour rafraîchir la vue
CREATE OR REPLACE FUNCTION refresh_dashboard_kpis()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_kpis;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_dashboard_kpis() IS 'Rafraîchit les KPIs du dashboard (à appeler via cron toutes les heures)';

-- ============================================================
-- SECTION 8 : FONCTIONS UTILITAIRES
-- ============================================================

/*
  Fonction pour calculer les loyers impayés automatiquement
*/
CREATE OR REPLACE FUNCTION get_loyers_impayes(mois_lookback integer DEFAULT 6)
RETURNS TABLE (
  contrat_id uuid,
  locataire_nom text,
  locataire_prenom text,
  unite_nom text,
  immeuble_nom text,
  loyer_mensuel decimal,
  mois_impaye date,
  montant_impaye decimal
) AS $$
BEGIN
  RETURN QUERY
  WITH mois_range AS (
    SELECT generate_series(
      date_trunc('month', CURRENT_DATE - (mois_lookback || ' months')::interval),
      date_trunc('month', CURRENT_DATE - interval '1 month'),
      '1 month'::interval
    )::date AS mois
  ),
  contrats_actifs AS (
    SELECT
      c.id,
      c.locataire_id,
      c.unite_id,
      c.loyer_mensuel,
      l.nom as loc_nom,
      l.prenom as loc_prenom,
      u.nom as unit_nom,
      i.nom as imm_nom
    FROM contrats c
    JOIN locataires l ON l.id = c.locataire_id
    JOIN unites u ON u.id = c.unite_id
    JOIN immeubles i ON i.id = u.immeuble_id
    WHERE c.statut = 'actif'
  )
  SELECT
    ca.id as contrat_id,
    ca.loc_nom as locataire_nom,
    ca.loc_prenom as locataire_prenom,
    ca.unit_nom as unite_nom,
    ca.imm_nom as immeuble_nom,
    ca.loyer_mensuel,
    mr.mois as mois_impaye,
    ca.loyer_mensuel as montant_impaye
  FROM contrats_actifs ca
  CROSS JOIN mois_range mr
  WHERE NOT EXISTS (
    SELECT 1 FROM paiements p
    WHERE p.contrat_id = ca.id
    AND p.mois_concerne = mr.mois
    AND p.statut = 'paye'
    AND p.actif = true
  )
  ORDER BY mr.mois DESC, ca.loc_nom;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_loyers_impayes IS 'Retourne la liste des loyers impayés sur les N derniers mois';

-- ============================================================
-- FIN DES MIGRATIONS
-- ============================================================

/*
  VÉRIFICATIONS POST-MIGRATION :

  1. Vérifier les colonnes ajoutées :
     SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name IN ('bailleurs', 'contrats')
     ORDER BY table_name, ordinal_position;

  2. Tester la vue matérialisée :
     SELECT * FROM dashboard_kpis;

  3. Vérifier les triggers audit :
     SELECT trigger_name, event_manipulation, event_object_table
     FROM information_schema.triggers
     WHERE trigger_name LIKE 'audit_%';

  4. Tester un INSERT et vérifier audit_logs :
     INSERT INTO bailleurs (nom, prenom, telephone) VALUES ('Test', 'Audit', '123456789');
     SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1;

  5. Rafraîchir la vue dashboard :
     SELECT refresh_dashboard_kpis();
*/
