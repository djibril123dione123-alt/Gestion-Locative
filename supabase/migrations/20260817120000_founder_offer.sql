-- =============================================================================
-- Migration : Offre Fondateurs (essai 30 jours + tarif préférentiel 12 cycles)
--
-- 1. Table générique app_settings (réutilisable pour de futurs interrupteurs)
--    + fonction founder_offer_enabled() + RPC admin set_founder_offer_enabled()
-- 2. Colonnes fondateur sur agencies (éligibilité + compteur de cycles)
-- 3. Colonne founder_price_xof sur subscription_plans (source unique du prix)
-- 4. Colonne is_founder_cycle sur payment_transactions (traçabilité)
-- 5. approve_agency_request : fixe founder_eligible selon l'état de l'offre
--    au moment de la création de l'agence (éligibilité automatique, décision
--    validée : reste acquise même si l'offre publique est désactivée ensuite)
-- 6. activate_subscription : incrémente le compteur de cycles fondateurs
--    quand le paiement confirmé était au tarif fondateur
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. app_settings — interrupteurs plateforme génériques
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_settings' AND policyname='app_settings_super_admin_all') THEN
    CREATE POLICY app_settings_super_admin_all ON app_settings
      FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
  END IF;
END $$;

INSERT INTO app_settings (key, value)
VALUES ('founder_offer_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION founder_offer_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value = 'true'::jsonb FROM app_settings WHERE key = 'founder_offer_enabled'),
    false
  );
$$;

REVOKE ALL ON FUNCTION founder_offer_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION founder_offer_enabled() TO authenticated, service_role;

-- RPC pour couper/rouvrir l'offre sans nouvelle migration (super_admin only).
CREATE OR REPLACE FUNCTION set_founder_offer_enabled(p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Seul un super_admin peut modifier l''Offre Fondateurs';
  END IF;

  INSERT INTO app_settings (key, value, updated_at)
  VALUES ('founder_offer_enabled', to_jsonb(p_enabled), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN jsonb_build_object('founder_offer_enabled', p_enabled);
END;
$$;

REVOKE ALL ON FUNCTION set_founder_offer_enabled(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_founder_offer_enabled(boolean) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Colonnes fondateur sur agencies
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agencies' AND column_name='founder_eligible') THEN
    ALTER TABLE agencies ADD COLUMN founder_eligible boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agencies' AND column_name='founder_paid_cycles_used') THEN
    ALTER TABLE agencies ADD COLUMN founder_paid_cycles_used integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agencies' AND column_name='founder_cycles_total') THEN
    ALTER TABLE agencies ADD COLUMN founder_cycles_total integer NOT NULL DEFAULT 12;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Prix fondateur par plan — NULL = pas de tarif fondateur pour ce plan.
--    Seuls pro et business sont concernés (décision validée avec l'équipe :
--    starter et enterprise restent hors offre).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_plans' AND column_name='founder_price_xof') THEN
    ALTER TABLE subscription_plans ADD COLUMN founder_price_xof integer;
  END IF;
END $$;

UPDATE subscription_plans SET founder_price_xof = 12000 WHERE id = 'pro';
UPDATE subscription_plans SET founder_price_xof = 29000 WHERE id = 'business';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Traçabilité paiement : ce paiement a-t-il consommé un cycle fondateur ?
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_transactions' AND column_name='is_founder_cycle') THEN
    ALTER TABLE payment_transactions ADD COLUMN is_founder_cycle boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. approve_agency_request — ajoute founder_eligible à la création de l'agence.
--    Reproduction complète de la fonction (migration 20260425000007) + 1 champ.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_agency_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request           agency_creation_requests%ROWTYPE;
  v_agency_id         uuid;
  v_role              text;
  v_trial_ends_at     timestamptz := now() + interval '30 days';
  v_actor_email       text;
  v_first_name        text;
  v_last_name         text;
  v_founder_eligible  boolean := founder_offer_enabled();
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Seul un super_admin peut approuver une demande de création d''agence';
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_request FROM agency_creation_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Statut de la demande invalide (actuel : %)', v_request.status;
  END IF;

  -- Création de l'agence (le trigger create_agency_settings_on_insert s'occupe
  -- de la ligne agency_settings par défaut)
  INSERT INTO agencies (name, phone, email, address, ninea, plan, status, trial_ends_at, is_bailleur_account, founder_eligible)
  VALUES (
    v_request.agency_name,
    v_request.agency_phone,
    COALESCE(NULLIF(v_request.agency_email, ''), v_request.requester_email),
    v_request.agency_address,
    NULLIF(v_request.agency_ninea, ''),
    'pro',
    'trial',
    v_trial_ends_at,
    COALESCE(v_request.is_bailleur_account, false),
    v_founder_eligible
  )
  RETURNING id INTO v_agency_id;

  -- Mise à jour des settings (le trigger a inséré la ligne par défaut)
  UPDATE agency_settings
     SET nom_agence = v_request.agency_name,
         telephone  = v_request.agency_phone,
         email      = COALESCE(NULLIF(v_request.agency_email, ''), v_request.requester_email),
         adresse    = v_request.agency_address,
         ninea      = NULLIF(v_request.agency_ninea, ''),
         devise     = COALESCE(NULLIF(v_request.agency_devise, ''), 'XOF')
   WHERE agency_id = v_agency_id;

  -- Abonnement
  INSERT INTO subscriptions (agency_id, plan_id, status, current_period_end)
  VALUES (v_agency_id, 'pro', 'active', v_trial_ends_at)
  ON CONFLICT DO NOTHING;

  -- Rôle attribué : un bailleur individuel est administrateur de son propre espace.
  -- Le rôle 'bailleur' reste réservé aux accès propriétaires en lecture dans une agence tierce.
  v_role := 'admin';

  -- Décomposition du nom complet (best-effort)
  v_first_name := COALESCE(NULLIF(split_part(COALESCE(v_request.requester_name, ''), ' ', 1), ''), '');
  v_last_name  := COALESCE(NULLIF(trim(substring(COALESCE(v_request.requester_name, '') FROM position(' ' IN COALESCE(v_request.requester_name, '') || ' ') + 1)), ''), '');

  -- Rattachement utilisateur (création si profil manquant)
  INSERT INTO user_profiles (id, email, nom, prenom, role, agency_id)
  VALUES (
    v_request.requester_id,
    v_request.requester_email,
    v_last_name,
    v_first_name,
    v_role::user_role,
    v_agency_id
  )
  ON CONFLICT (id) DO UPDATE
    SET agency_id  = EXCLUDED.agency_id,
        role       = EXCLUDED.role,
        updated_at = now();

  -- Marquer la demande approuvée
  UPDATE agency_creation_requests
     SET status            = 'approved',
         reviewed_by       = auth.uid(),
         reviewed_at       = now(),
         created_agency_id = v_agency_id
   WHERE id = p_request_id;

  -- Audit
  INSERT INTO owner_actions_log (actor_id, actor_email, action, target_type, target_id, target_label, details)
  VALUES (
    auth.uid(),
    v_actor_email,
    'agency_request.approve',
    'agency_creation_request',
    p_request_id,
    v_request.agency_name,
    jsonb_build_object(
      'agency_id',         v_agency_id,
      'requester_id',      v_request.requester_id,
      'requester_email',   v_request.requester_email,
      'role',              v_role,
      'is_bailleur_account', COALESCE(v_request.is_bailleur_account, false),
      'founder_eligible',  v_founder_eligible
    )
  );

  RETURN jsonb_build_object(
    'agency_id',   v_agency_id,
    'role',        v_role,
    'agency_name', v_request.agency_name,
    'founder_eligible', v_founder_eligible
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_agency_request(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. activate_subscription — incrémente le compteur de cycles fondateurs quand
--    le paiement confirmé était au tarif fondateur. L'éligibilité elle-même
--    (founder_eligible) n'est jamais retirée ici : seul le compteur de cycles
--    utilisés avance, ce qui laisse le prix repasser naturellement au tarif
--    public au 13e cycle (cycles_used >= cycles_total), sans jamais renier
--    l'avantage déjà acquis par l'agence.
--
--    Reproduction complète de la version durcie (migration
--    20260512000001_phase3_finance_security_hardening.sql — verrou de ligne,
--    vérification transaction/agence/montant, idempotence) + le seul ajout
--    du compteur de cycles fondateurs.
--
--    Postgres identifie une fonction par son nom + la liste de ses types de
--    paramètres : ajouter un paramètre, même avec une valeur par défaut, crée
--    une surcharge distincte plutôt que de remplacer l'existante. On supprime
--    donc explicitement l'ancienne signature (5 arguments) pour n'avoir
--    qu'une seule version d'activate_subscription — sinon un appel qui
--    omettrait p_is_founder_cycle risquerait de continuer à résoudre vers
--    l'ancienne fonction (sans logique fondateur) au lieu de la nouvelle.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.activate_subscription(uuid, text, uuid, integer, text);

CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_agency_id         uuid,
  p_plan_id           text,
  p_transaction_id    uuid,
  p_amount_xof        integer,
  p_phone             text DEFAULT NULL,
  p_is_founder_cycle  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_txn record;
  v_period_end timestamptz := now() + interval '30 days';
BEGIN
  SELECT *
  INTO v_txn
  FROM public.payment_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSACTION_NOT_FOUND';
  END IF;

  IF v_txn.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  IF v_txn.status <> 'pending' THEN
    RAISE EXCEPTION 'TRANSACTION_NOT_PENDING: %', v_txn.status;
  END IF;

  IF v_txn.agency_id <> p_agency_id
     OR v_txn.plan_id <> p_plan_id
     OR v_txn.amount_xof <> p_amount_xof THEN
    RAISE EXCEPTION 'TRANSACTION_MISMATCH';
  END IF;

  IF v_txn.invoice_token IS NULL THEN
    RAISE EXCEPTION 'TRANSACTION_WITHOUT_INVOICE_TOKEN';
  END IF;

  UPDATE public.agencies SET
    status                    = 'active',
    plan                      = p_plan_id,
    last_payment_at           = now(),
    next_renewal_at           = v_period_end,
    suspension_at             = NULL,
    payment_phone             = COALESCE(p_phone, payment_phone),
    founder_paid_cycles_used  = CASE
      WHEN p_is_founder_cycle THEN LEAST(founder_cycles_total, founder_paid_cycles_used + 1)
      ELSE founder_paid_cycles_used
    END,
    updated_at = now()
  WHERE id = p_agency_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AGENCY_NOT_FOUND';
  END IF;

  INSERT INTO public.subscriptions (
    agency_id, plan_id, status, current_period_start, current_period_end
  )
  VALUES (p_agency_id, p_plan_id, 'active', now(), v_period_end)
  ON CONFLICT (agency_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'active',
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = now();

  UPDATE public.payment_transactions
  SET status = 'completed', updated_at = now()
  WHERE id = p_transaction_id;

  INSERT INTO public.notification_queue (
    agency_id, type, channel, template_data, scheduled_for
  )
  VALUES (
    p_agency_id,
    'payment_confirmed',
    'email',
    jsonb_build_object('plan_id', p_plan_id, 'amount_xof', p_amount_xof, 'period_end', v_period_end, 'is_founder_cycle', p_is_founder_cycle),
    now()
  );

  RETURN jsonb_build_object('success', true, 'period_end', v_period_end);
END;
$$;

REVOKE ALL ON FUNCTION public.activate_subscription(uuid, text, uuid, integer, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription(uuid, text, uuid, integer, text, boolean)
  TO service_role;
