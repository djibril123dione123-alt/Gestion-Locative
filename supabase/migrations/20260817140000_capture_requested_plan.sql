-- =============================================================================
-- Migration : agency_creation_requests capture le plan choisi par le prospect
--
-- Avant cette migration, approve_agency_request créait TOUJOURS l'agence avec
-- plan='pro', peu importe ce que le prospect avait sélectionné sur la page
-- tarifs (le choix n'était même pas collecté). L'agence démarre son essai de
-- 30 jours sur le plan demandé ; le montant réellement facturé au premier
-- paiement reste de toute façon recalculé côté serveur (initiate-payment),
-- donc ce champ ne fait que refléter fidèlement l'intention du prospect —
-- il ne devient jamais lui-même une source de prix.
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agency_creation_requests' AND column_name='requested_plan') THEN
    ALTER TABLE agency_creation_requests ADD COLUMN requested_plan text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agency_creation_requests_requested_plan_check') THEN
    ALTER TABLE agency_creation_requests
      ADD CONSTRAINT agency_creation_requests_requested_plan_check
      CHECK (requested_plan IS NULL OR requested_plan IN ('starter', 'pro', 'business'));
  END IF;
END $$;

-- approve_agency_request : utilise requested_plan (repli sur 'pro' si absent,
-- pour les demandes déjà en attente créées avant cette migration).
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
  v_plan              text;
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

  v_plan := COALESCE(v_request.requested_plan, 'pro');

  -- Création de l'agence (le trigger create_agency_settings_on_insert s'occupe
  -- de la ligne agency_settings par défaut)
  INSERT INTO agencies (name, phone, email, address, ninea, plan, status, trial_ends_at, is_bailleur_account, founder_eligible)
  VALUES (
    v_request.agency_name,
    v_request.agency_phone,
    COALESCE(NULLIF(v_request.agency_email, ''), v_request.requester_email),
    v_request.agency_address,
    NULLIF(v_request.agency_ninea, ''),
    v_plan,
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
  VALUES (v_agency_id, v_plan, 'active', v_trial_ends_at)
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
      'founder_eligible',  v_founder_eligible,
      'plan',              v_plan
    )
  );

  RETURN jsonb_build_object(
    'agency_id',   v_agency_id,
    'role',        v_role,
    'agency_name', v_request.agency_name,
    'founder_eligible', v_founder_eligible,
    'plan', v_plan
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_agency_request(uuid) TO authenticated;
