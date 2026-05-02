/*
  # Intégrité financière — Contraintes CHECK + Triggers + Fix bilans_mensuels

  Ce fichier est IDEMPOTENT — il peut être rejoué N fois sans erreur.

  ─────────────────────────────────────────────────────────────────────────────
  PARTIE 1 — Fix schéma bilans_mensuels
    La table `bilans_mensuels` était définie sans `agency_id`, `total_encaisse`
    ni `nb_paiements`. Le frontend (LoyersImpayes.tsx) écrit déjà vers ces
    colonnes : le décalage provoquait des erreurs silencieuses en production.
    Cette migration aligne la table sur le code existant.

  PARTIE 2 — Contraintes CHECK (idempotentes)
    Réappliquées depuis 20260127193800 pour garantir leur présence sur toute
    instance (prod, staging, ou DB créée avant cette migration).
    + 2 nouvelles contraintes jamais définies auparavant.

  PARTIE 3 — Triggers PL/pgSQL (validation serveur)
    Messages d'erreur métier en français, remontés directement au frontend via
    la propriété `message` des erreurs Supabase.

  PARTIE 4 — Trigger alimentation bilans_mensuels
    Alimente automatiquement la table après chaque INSERT paiement 'paye'.
  ─────────────────────────────────────────────────────────────────────────────
*/


-- =============================================================================
-- PARTIE 1 — FIX SCHÉMA bilans_mensuels
-- =============================================================================

-- 1a. Ajouter agency_id (colonne multi-tenant manquante)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bilans_mensuels' AND column_name = 'agency_id'
  ) THEN
    ALTER TABLE bilans_mensuels
      ADD COLUMN agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 1b. Ajouter total_encaisse (utilisé par le frontend)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bilans_mensuels' AND column_name = 'total_encaisse'
  ) THEN
    ALTER TABLE bilans_mensuels
      ADD COLUMN total_encaisse decimal(12,2) DEFAULT 0;
  END IF;
END $$;

-- 1c. Ajouter nb_paiements (utilisé par le frontend)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bilans_mensuels' AND column_name = 'nb_paiements'
  ) THEN
    ALTER TABLE bilans_mensuels
      ADD COLUMN nb_paiements integer DEFAULT 0;
  END IF;
END $$;

-- 1d. Supprimer l'ancienne contrainte UNIQUE sur mois seul (sans agency_id)
--     Elle empêchait d'avoir un bilan par agence par mois (multi-tenant).
ALTER TABLE bilans_mensuels DROP CONSTRAINT IF EXISTS bilans_mensuels_mois_key;

-- 1e. Ajouter la contrainte UNIQUE correcte (agency_id, mois)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bilans_mensuels_agency_mois_key'
  ) THEN
    ALTER TABLE bilans_mensuels
      ADD CONSTRAINT bilans_mensuels_agency_mois_key UNIQUE (agency_id, mois);
  END IF;
END $$;

-- 1f. RLS : mettre à jour les policies bilans_mensuels pour filtrer par agency_id
--     Les anciennes policies n'avaient pas de filtre agency_id.
DROP POLICY IF EXISTS "Users can read own bilans"       ON bilans_mensuels;
DROP POLICY IF EXISTS "Users can insert own bilans"     ON bilans_mensuels;
DROP POLICY IF EXISTS "Users can update own bilans"     ON bilans_mensuels;
DROP POLICY IF EXISTS "Users can delete own bilans"     ON bilans_mensuels;

-- Recréer avec isolation multi-tenant correcte
DROP POLICY IF EXISTS "bilans_select_own_agency"  ON bilans_mensuels;
DROP POLICY IF EXISTS "bilans_insert_own_agency"  ON bilans_mensuels;
DROP POLICY IF EXISTS "bilans_update_own_agency"  ON bilans_mensuels;
DROP POLICY IF EXISTS "bilans_delete_own_agency"  ON bilans_mensuels;

CREATE POLICY "bilans_select_own_agency"
  ON bilans_mensuels FOR SELECT
  TO authenticated
  USING (
    agency_id IS NULL
    OR agency_id = current_user_agency_id()
    OR is_super_admin()
  );

CREATE POLICY "bilans_insert_own_agency"
  ON bilans_mensuels FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id = current_user_agency_id()
    OR is_super_admin()
  );

CREATE POLICY "bilans_update_own_agency"
  ON bilans_mensuels FOR UPDATE
  TO authenticated
  USING (
    agency_id = current_user_agency_id()
    OR is_super_admin()
  );

CREATE POLICY "bilans_delete_own_agency"
  ON bilans_mensuels FOR DELETE
  TO authenticated
  USING (
    agency_id = current_user_agency_id()
    OR is_super_admin()
  );


-- =============================================================================
-- PARTIE 2 — CONTRAINTES CHECK (idempotentes)
-- =============================================================================

-- ── paiements ──────────────────────────────────────────────────────────────

-- C1. montant_total > 0, parts non négatives
ALTER TABLE paiements DROP CONSTRAINT IF EXISTS check_montants_positifs;
ALTER TABLE paiements ADD CONSTRAINT check_montants_positifs
  CHECK (montant_total > 0 AND part_agence >= 0 AND part_bailleur >= 0);

-- C2. part_agence + part_bailleur ≈ montant_total (tolérance 1 centime)
ALTER TABLE paiements DROP CONSTRAINT IF EXISTS check_parts_coherentes;
ALTER TABLE paiements ADD CONSTRAINT check_parts_coherentes
  CHECK (abs((part_agence + part_bailleur) - montant_total) < 0.01);

-- ── contrats ───────────────────────────────────────────────────────────────

-- C3. commission dans les bornes légales [0, 100]
ALTER TABLE contrats DROP CONSTRAINT IF EXISTS check_commission_contrat_valide;
ALTER TABLE contrats ADD CONSTRAINT check_commission_contrat_valide
  CHECK (commission IS NULL OR (commission >= 0 AND commission <= 100));

-- C4. NOUVEAU — contrat actif = commission obligatoire
--     Enforce côté DB la règle métier CommissionRequiredError du frontend.
ALTER TABLE contrats DROP CONSTRAINT IF EXISTS check_contrat_actif_commission_requise;
ALTER TABLE contrats ADD CONSTRAINT check_contrat_actif_commission_requise
  CHECK (statut != 'actif' OR commission IS NOT NULL);

-- C5. loyer mensuel strictement positif
ALTER TABLE contrats DROP CONSTRAINT IF EXISTS check_loyer_positif;
ALTER TABLE contrats ADD CONSTRAINT check_loyer_positif
  CHECK (loyer_mensuel > 0);

-- C6. NOUVEAU — caution non négative
ALTER TABLE contrats DROP CONSTRAINT IF EXISTS check_caution_non_negative;
ALTER TABLE contrats ADD CONSTRAINT check_caution_non_negative
  CHECK (caution IS NULL OR caution >= 0);

-- C7. dates cohérentes
ALTER TABLE contrats DROP CONSTRAINT IF EXISTS check_dates_coherentes;
ALTER TABLE contrats ADD CONSTRAINT check_dates_coherentes
  CHECK (date_fin IS NULL OR date_fin > date_debut);

-- ── bailleurs ──────────────────────────────────────────────────────────────

-- C8. commission bailleur dans les bornes
ALTER TABLE bailleurs DROP CONSTRAINT IF EXISTS check_commission_valide;
ALTER TABLE bailleurs ADD CONSTRAINT check_commission_valide
  CHECK (commission IS NULL OR (commission >= 0 AND commission <= 100));

-- ── depenses ───────────────────────────────────────────────────────────────

-- C9. montant dépense strictement positif
ALTER TABLE depenses DROP CONSTRAINT IF EXISTS check_depense_positive;
ALTER TABLE depenses ADD CONSTRAINT check_depense_positive
  CHECK (montant > 0);


-- =============================================================================
-- PARTIE 3 — TRIGGER VALIDATION PAIEMENTS
-- =============================================================================
-- Les triggers donnent des messages d'erreur métier en français, plus lisibles
-- que les violations de CHECK constraint brutes.

CREATE OR REPLACE FUNCTION fn_validate_paiement_integrite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ecart decimal(12,2);
BEGIN
  -- montant_total strictement positif
  IF NEW.montant_total IS NULL OR NEW.montant_total <= 0 THEN
    RAISE EXCEPTION 'PAIEMENT_MONTANT_INVALIDE: Le montant total doit être strictement positif (reçu: %).',
      COALESCE(NEW.montant_total::text, 'NULL')
      USING ERRCODE = 'check_violation';
  END IF;

  -- parts non négatives
  IF NEW.part_agence IS NULL OR NEW.part_agence < 0 THEN
    RAISE EXCEPTION 'PAIEMENT_PART_INVALIDE: La part agence ne peut pas être négative (reçu: %).',
      COALESCE(NEW.part_agence::text, 'NULL')
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.part_bailleur IS NULL OR NEW.part_bailleur < 0 THEN
    RAISE EXCEPTION 'PAIEMENT_PART_INVALIDE: La part bailleur ne peut pas être négative (reçu: %).',
      COALESCE(NEW.part_bailleur::text, 'NULL')
      USING ERRCODE = 'check_violation';
  END IF;

  -- cohérence : part_agence + part_bailleur ≈ montant_total
  v_ecart := abs((NEW.part_agence + NEW.part_bailleur) - NEW.montant_total);
  IF v_ecart >= 0.01 THEN
    RAISE EXCEPTION
      'PAIEMENT_PARTS_INCOHERENTES: part_agence (%) + part_bailleur (%) = % ≠ montant_total (%). Recalculez via commissionService.',
      NEW.part_agence,
      NEW.part_bailleur,
      (NEW.part_agence + NEW.part_bailleur),
      NEW.montant_total
      USING ERRCODE = 'check_violation';
  END IF;

  -- champs obligatoires
  IF NEW.contrat_id IS NULL THEN
    RAISE EXCEPTION 'PAIEMENT_CONTRAT_MANQUANT: Le contrat est obligatoire.'
      USING ERRCODE = 'not_null_violation';
  END IF;

  IF NEW.mois_concerne IS NULL THEN
    RAISE EXCEPTION 'PAIEMENT_MOIS_MANQUANT: Le mois concerné est obligatoire.'
      USING ERRCODE = 'not_null_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_paiement_integrite ON paiements;
CREATE TRIGGER trg_validate_paiement_integrite
  BEFORE INSERT OR UPDATE ON paiements
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_paiement_integrite();


-- =============================================================================
-- PARTIE 3b — TRIGGER VALIDATION CONTRATS
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_validate_contrat_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Contrat actif : commission obligatoire dans les bornes
  IF NEW.statut = 'actif' THEN
    IF NEW.commission IS NULL THEN
      RAISE EXCEPTION
        'COMMISSION_REQUISE: Un contrat actif doit avoir un taux de commission défini. '
        'Configurez la commission avant d''activer ce contrat.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.commission < 0 OR NEW.commission > 100 THEN
      RAISE EXCEPTION
        'COMMISSION_HORS_BORNES: Le taux de commission doit être compris entre 0 et 100 (reçu: %).',
        NEW.commission
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- loyer mensuel positif
  IF NEW.loyer_mensuel IS NULL OR NEW.loyer_mensuel <= 0 THEN
    RAISE EXCEPTION
      'CONTRAT_LOYER_INVALIDE: Le loyer mensuel doit être strictement positif (reçu: %).',
      COALESCE(NEW.loyer_mensuel::text, 'NULL')
      USING ERRCODE = 'check_violation';
  END IF;

  -- dates cohérentes
  IF NEW.date_fin IS NOT NULL AND NEW.date_fin <= NEW.date_debut THEN
    RAISE EXCEPTION
      'CONTRAT_DATES_INCOHERENTES: La date de fin (%) doit être postérieure à la date de début (%).',
      NEW.date_fin, NEW.date_debut
      USING ERRCODE = 'check_violation';
  END IF;

  -- caution non négative
  IF NEW.caution IS NOT NULL AND NEW.caution < 0 THEN
    RAISE EXCEPTION
      'CONTRAT_CAUTION_INVALIDE: La caution ne peut pas être négative (reçu: %).',
      NEW.caution
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_contrat_commission ON contrats;
CREATE TRIGGER trg_validate_contrat_commission
  BEFORE INSERT OR UPDATE ON contrats
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_contrat_commission();


-- =============================================================================
-- PARTIE 4 — TRIGGER ALIMENTATION bilans_mensuels
-- =============================================================================
-- Alimente automatiquement la table après chaque INSERT paiement 'paye'.
-- Le bloc EXCEPTION rend le trigger non bloquant : le paiement est enregistré
-- même si le bilan ne peut pas être mis à jour.

CREATE OR REPLACE FUNCTION fn_update_bilan_mensuel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mois text;
BEGIN
  -- Seulement pour les paiements effectivement encaissés
  IF NEW.statut <> 'paye' THEN
    RETURN NEW;
  END IF;

  -- Clé mois au format 'YYYY-MM' (même format que le frontend)
  v_mois := to_char(NEW.mois_concerne, 'YYYY-MM');

  INSERT INTO bilans_mensuels (agency_id, mois, total_encaisse, nb_paiements, updated_at)
  VALUES (NEW.agency_id, v_mois, NEW.montant_total, 1, now())
  ON CONFLICT (agency_id, mois)
  DO UPDATE SET
    total_encaisse = bilans_mensuels.total_encaisse + EXCLUDED.total_encaisse,
    nb_paiements   = bilans_mensuels.nb_paiements   + EXCLUDED.nb_paiements,
    updated_at     = now();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Non bloquant : log dans pg_log mais ne bloque pas l'INSERT paiement.
  RAISE WARNING 'fn_update_bilan_mensuel: erreur non bloquante pour agency_id=%, mois=% — %',
    NEW.agency_id, v_mois, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_bilan_mensuel ON paiements;
CREATE TRIGGER trg_update_bilan_mensuel
  AFTER INSERT ON paiements
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_bilan_mensuel();


-- =============================================================================
-- VÉRIFICATION — Requête de contrôle à exécuter après application
-- =============================================================================
--
-- 1. Lister toutes les contraintes CHECK actives :
--
--    SELECT conrelid::regclass AS table, conname, pg_get_constraintdef(oid)
--    FROM pg_constraint
--    WHERE conrelid IN (
--      'paiements'::regclass, 'contrats'::regclass,
--      'bailleurs'::regclass, 'depenses'::regclass
--    ) AND contype = 'c'
--    ORDER BY table, conname;
--
-- 2. Lister les triggers actifs :
--
--    SELECT event_object_table, trigger_name, action_timing, event_manipulation
--    FROM information_schema.triggers
--    WHERE trigger_name LIKE 'trg_%'
--    ORDER BY event_object_table, trigger_name;
--
-- Résultat attendu :
--   Contraintes : 9 CHECK sur paiements/contrats/bailleurs/depenses
--   Triggers    : trg_validate_paiement_integrite, trg_validate_contrat_commission,
--                 trg_update_bilan_mensuel
