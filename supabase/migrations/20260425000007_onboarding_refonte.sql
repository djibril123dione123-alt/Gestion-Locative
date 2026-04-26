-- =============================================================================
-- Refonte complète du flux d'onboarding et d'invitation Samay Këur
-- =============================================================================
--
-- Objectifs :
--
--   A. Invitation à une agence existante
--      - Un admin (ou super_admin) crée une invitation depuis Equipe / Console.
--      - Le destinataire reçoit un lien `?token=...`.
--      - Sur AcceptInvitation : la RPC `accept_invitation(token)` s'exécute en
--        SECURITY DEFINER, met à jour `user_profiles.agency_id` + role, et marque
--        l'invitation `accepted`.
--      - L'auto-création du `user_profiles` est déjà gérée par le trigger
--        `on_auth_user_created` → `handle_new_user`.
--
--   B. Demande de création d'agence avec approbation super_admin
--      - L'utilisateur fraîchement inscrit (sans agence, sans invitation) atterrit
--        sur Welcome qui INSERT une ligne dans `agency_creation_requests`
--        (status='pending').
--      - Le super_admin voit la demande dans Console > Demandes.
--      - `approve_agency_request(id)` (SECURITY DEFINER) crée l'agence, ses
--        settings, son abonnement, met à jour `user_profiles.agency_id`+role et
--        log l'action dans `owner_actions_log`.
--      - `reject_agency_request(id, reason)` marque la demande rejetée et log.
--
--   C. Sécurité agence
--      - Suppression de la policy `agencies_insert_authenticated` (trop large) :
--        désormais seul le super_admin peut INSERT directement dans `agencies`.
--        Les utilisateurs lambda passent par la RPC d'approbation
--        (SECURITY DEFINER ⇒ bypass RLS).
--
--   D. Audit
--      - Toutes les approbations / rejets / acceptations d'invitation sont
--        tracées dans `owner_actions_log` (insert via SECURITY DEFINER).
--
-- =============================================================================

-- =============================================================================
-- 0) Nettoyage : autoriser le rôle 'bailleur' dans les invitations
-- =============================================================================

ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
ALTER TABLE invitations
  ADD CONSTRAINT invitations_role_check
  CHECK (role IN ('admin', 'agent', 'comptable', 'bailleur'));

-- =============================================================================
-- 1) Sécurité agences : retirer l'INSERT trop large
-- =============================================================================
-- Note : la policy "Super admin can insert agencies" reste en place pour la
-- Console propriétaire. Les agences créées via la RPC d'approbation passent par
-- SECURITY DEFINER qui bypass RLS.

DROP POLICY IF EXISTS "agencies_insert_authenticated" ON agencies;

-- =============================================================================
-- 2) RPC : get_invitation_by_token (pré-auth, expose info minimale)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv invitations%ROWTYPE;
  v_agency_name text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 THEN
    RETURN jsonb_build_object('found', false, 'reason', 'invalid_token');
  END IF;

  SELECT * INTO v_inv FROM invitations WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'reason', 'not_found');
  END IF;

  SELECT name INTO v_agency_name FROM agencies WHERE id = v_inv.agency_id;

  RETURN jsonb_build_object(
    'found',        true,
    'id',           v_inv.id,
    'email',        v_inv.email,
    'role',         v_inv.role,
    'status',       v_inv.status,
    'agency_id',    v_inv.agency_id,
    'agency_name',  COALESCE(v_agency_name, 'l''agence'),
    'expires_at',   v_inv.expires_at,
    'expired',      (v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

-- =============================================================================
-- 3) RPC : accept_invitation (auth requise)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv         invitations%ROWTYPE;
  v_user_id     uuid := auth.uid();
  v_user_email  text;
  v_agency_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise pour accepter une invitation';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_inv FROM invitations WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation introuvable';
  END IF;

  IF v_inv.status = 'accepted' THEN
    RAISE EXCEPTION 'Cette invitation a déjà été acceptée';
  END IF;

  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now() THEN
    UPDATE invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'Cette invitation a expiré';
  END IF;

  -- Vérification email : on autorise tolérance casse mais on log un warning
  IF lower(v_inv.email) <> lower(COALESCE(v_user_email, '')) THEN
    RAISE EXCEPTION 'Cette invitation est destinée à % (vous êtes connecté en tant que %)',
      v_inv.email, COALESCE(v_user_email, '?');
  END IF;

  -- Auto-création / mise à jour user_profiles
  INSERT INTO user_profiles (id, email, nom, prenom, role, agency_id)
  VALUES (
    v_user_id,
    v_user_email,
    '',
    '',
    v_inv.role::user_role,
    v_inv.agency_id
  )
  ON CONFLICT (id) DO UPDATE
    SET agency_id  = EXCLUDED.agency_id,
        role       = EXCLUDED.role,
        updated_at = now();

  -- Marquer l'invitation acceptée
  UPDATE invitations
     SET status = 'accepted'
   WHERE id = v_inv.id;

  SELECT name INTO v_agency_name FROM agencies WHERE id = v_inv.agency_id;

  -- Audit
  INSERT INTO owner_actions_log (actor_id, actor_email, action, target_type, target_id, target_label, details)
  VALUES (
    v_user_id,
    v_user_email,
    'invitation.accept',
    'invitation',
    v_inv.id,
    COALESCE(v_agency_name, 'agence'),
    jsonb_build_object('agency_id', v_inv.agency_id, 'role', v_inv.role, 'email', v_inv.email)
  );

  RETURN jsonb_build_object(
    'agency_id',   v_inv.agency_id,
    'agency_name', COALESCE(v_agency_name, ''),
    'role',        v_inv.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- =============================================================================
-- 4) Table : agency_creation_requests
-- =============================================================================

CREATE TABLE IF NOT EXISTS agency_creation_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_email     text NOT NULL,
  requester_name      text,
  requester_phone     text,
  agency_name         text NOT NULL,
  agency_phone        text,
  agency_email        text,
  agency_address      text,
  agency_ninea        text,
  agency_devise       text DEFAULT 'XOF',
  is_bailleur_account boolean NOT NULL DEFAULT false,
  status              text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at         timestamptz,
  rejection_reason    text,
  created_agency_id   uuid REFERENCES agencies(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_creation_requests_requester
  ON agency_creation_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_agency_creation_requests_status
  ON agency_creation_requests(status);
CREATE INDEX IF NOT EXISTS idx_agency_creation_requests_created
  ON agency_creation_requests(created_at DESC);

-- Empêcher 2 demandes pending pour le même utilisateur
CREATE UNIQUE INDEX IF NOT EXISTS uniq_agency_request_pending_per_user
  ON agency_creation_requests(requester_id)
  WHERE status = 'pending';

ALTER TABLE agency_creation_requests ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "user_read_own_request"     ON agency_creation_requests;
DROP POLICY IF EXISTS "user_insert_own_request"   ON agency_creation_requests;
DROP POLICY IF EXISTS "user_cancel_own_request"   ON agency_creation_requests;
DROP POLICY IF EXISTS "super_admin_all_requests"  ON agency_creation_requests;

CREATE POLICY "user_read_own_request"
  ON agency_creation_requests FOR SELECT
  TO authenticated
  USING (requester_id = (SELECT auth.uid()));

CREATE POLICY "user_insert_own_request"
  ON agency_creation_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_id = (SELECT auth.uid())
    AND status = 'pending'
  );

-- L'utilisateur peut annuler sa propre demande (status pending → cancelled)
CREATE POLICY "user_cancel_own_request"
  ON agency_creation_requests FOR UPDATE
  TO authenticated
  USING (requester_id = (SELECT auth.uid()) AND status = 'pending')
  WITH CHECK (requester_id = (SELECT auth.uid()) AND status IN ('pending', 'cancelled'));

CREATE POLICY "super_admin_all_requests"
  ON agency_creation_requests FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_agency_request_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_agency_request ON agency_creation_requests;
CREATE TRIGGER trg_touch_agency_request
  BEFORE UPDATE ON agency_creation_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_agency_request_updated_at();

-- =============================================================================
-- 5) RPC : approve_agency_request (super_admin only)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.approve_agency_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request        agency_creation_requests%ROWTYPE;
  v_agency_id      uuid;
  v_role           text;
  v_trial_ends_at  timestamptz := now() + interval '30 days';
  v_actor_email    text;
  v_first_name     text;
  v_last_name      text;
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
  INSERT INTO agencies (name, phone, email, address, ninea, plan, status, trial_ends_at, is_bailleur_account)
  VALUES (
    v_request.agency_name,
    v_request.agency_phone,
    COALESCE(NULLIF(v_request.agency_email, ''), v_request.requester_email),
    v_request.agency_address,
    NULLIF(v_request.agency_ninea, ''),
    'pro',
    'trial',
    v_trial_ends_at,
    COALESCE(v_request.is_bailleur_account, false)
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

  -- Rôle attribué : 'admin' pour une agence, 'bailleur' pour un compte bailleur individuel
  v_role := CASE WHEN COALESCE(v_request.is_bailleur_account, false) THEN 'bailleur' ELSE 'admin' END;

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
      'is_bailleur_account', COALESCE(v_request.is_bailleur_account, false)
    )
  );

  RETURN jsonb_build_object(
    'agency_id',   v_agency_id,
    'role',        v_role,
    'agency_name', v_request.agency_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_agency_request(uuid) TO authenticated;

-- =============================================================================
-- 6) RPC : reject_agency_request (super_admin only)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reject_agency_request(p_request_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request     agency_creation_requests%ROWTYPE;
  v_actor_email text;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Seul un super_admin peut rejeter une demande de création d''agence';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Une raison de rejet est obligatoire';
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_request FROM agency_creation_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Statut de la demande invalide (actuel : %)', v_request.status;
  END IF;

  UPDATE agency_creation_requests
     SET status           = 'rejected',
         reviewed_by      = auth.uid(),
         reviewed_at      = now(),
         rejection_reason = trim(p_reason)
   WHERE id = p_request_id;

  INSERT INTO owner_actions_log (actor_id, actor_email, action, target_type, target_id, target_label, details)
  VALUES (
    auth.uid(),
    v_actor_email,
    'agency_request.reject',
    'agency_creation_request',
    p_request_id,
    v_request.agency_name,
    jsonb_build_object(
      'requester_id',    v_request.requester_id,
      'requester_email', v_request.requester_email,
      'reason',          trim(p_reason)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_agency_request(uuid, text) TO authenticated;

-- =============================================================================
-- 8) Corrections de sécurité RLS
-- =============================================================================

-- Supprimer les politiques trop permissives
DROP POLICY IF EXISTS "Authenticated users can insert agency settings" ON agency_settings;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;

-- Recréer avec des restrictions appropriées
CREATE POLICY "Agency users can insert agency settings"
  ON agency_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    ) OR
    agency_id IS NULL  -- Pour les logs système
  );

-- Pour les tables exposées via pg_graphql, ajouter des politiques de lecture restrictives
-- (mais garder l'accès public pour les cas légitimes comme les invitations)

-- =============================================================================
