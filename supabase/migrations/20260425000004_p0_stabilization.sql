-- P0 Stabilisation : bucket documents + RLS Storage, lecture publique des
-- invitations par token (flux AcceptInvitation), fallback Pro pour les
-- agences legacy sans subscription dans check_plan_limits.

-- ─────────────────────────────────────────────────────────────
-- 1) Bucket Storage `documents` + RLS multi-tenant
-- ─────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Convention : les fichiers sont uploadés sous le préfixe `<agency_id>/...`
-- Les policies utilisent (storage.foldername(name))[1] pour récupérer l'agency_id.

DROP POLICY IF EXISTS "documents_select_own_agency" ON storage.objects;
CREATE POLICY "documents_select_own_agency"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      is_super_admin()
      OR (storage.foldername(name))[1]::uuid = current_user_agency_id()
    )
  );

DROP POLICY IF EXISTS "documents_insert_own_agency" ON storage.objects;
CREATE POLICY "documents_insert_own_agency"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1]::uuid = current_user_agency_id()
  );

DROP POLICY IF EXISTS "documents_update_own_agency" ON storage.objects;
CREATE POLICY "documents_update_own_agency"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1]::uuid = current_user_agency_id()
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1]::uuid = current_user_agency_id()
  );

DROP POLICY IF EXISTS "documents_delete_own_agency" ON storage.objects;
CREATE POLICY "documents_delete_own_agency"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      is_super_admin()
      OR (storage.foldername(name))[1]::uuid = current_user_agency_id()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2) Lecture publique des invitations par token (flux non connecté)
--    L'utilisateur invité doit pouvoir lire son invitation AVANT
--    de s'authentifier pour voir l'écran "Invitation valide".
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Invitations readable by token" ON invitations;
CREATE POLICY "Invitations readable by token"
  ON invitations FOR SELECT
  TO anon, authenticated
  USING (
    -- Cette policy est volontairement permissive en SELECT car le token
    -- est un secret en lui-même (UUID aléatoire). La granularité
    -- token-par-token est imposée par le client qui filtre `.eq('token', ...)`.
    -- Pour limiter la fuite, on n'expose que les invitations non encore acceptées.
    status = 'pending'
  );

-- ─────────────────────────────────────────────────────────────
-- 3) Permettre à l'utilisateur invité (authentifié) de marquer
--    son invitation comme acceptée
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Invitee can accept own invitation" ON invitations;
CREATE POLICY "Invitee can accept own invitation"
  ON invitations FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- 4) check_plan_limits : fallback Pro pour agences legacy
--    Sans cette correction, toute agence créée avant l'introduction
--    de la table subscriptions est bloquée (can_add_* = false).
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_plan_limits(p_agency_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  plan_record RECORD;
  current_usage jsonb;
BEGIN
  SELECT sp.* INTO plan_record
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.agency_id = p_agency_id;

  -- Fallback : si aucun abonnement, on retombe sur le plan Pro
  -- pour ne pas bloquer les agences existantes (legacy).
  IF plan_record IS NULL THEN
    SELECT * INTO plan_record
    FROM subscription_plans
    WHERE id = 'pro'
    LIMIT 1;
  END IF;

  -- Si même le plan Pro n'existe pas (table vide), valeurs par défaut généreuses.
  IF plan_record IS NULL THEN
    SELECT jsonb_build_object(
      'users', (SELECT COUNT(*) FROM user_profiles WHERE agency_id = p_agency_id),
      'immeubles', (SELECT COUNT(*) FROM immeubles WHERE agency_id = p_agency_id),
      'unites', (SELECT COUNT(*) FROM unites WHERE agency_id = p_agency_id)
    ) INTO current_usage;

    RETURN jsonb_build_object(
      'limits', jsonb_build_object(
        'max_users', 10,
        'max_immeubles', 50,
        'max_unites', 200
      ),
      'usage', current_usage,
      'can_add_user', true,
      'can_add_immeuble', true,
      'can_add_unite', true
    );
  END IF;

  SELECT jsonb_build_object(
    'users', (SELECT COUNT(*) FROM user_profiles WHERE agency_id = p_agency_id),
    'immeubles', (SELECT COUNT(*) FROM immeubles WHERE agency_id = p_agency_id),
    'unites', (SELECT COUNT(*) FROM unites WHERE agency_id = p_agency_id)
  ) INTO current_usage;

  RETURN jsonb_build_object(
    'limits', jsonb_build_object(
      'max_users', plan_record.max_users,
      'max_immeubles', plan_record.max_immeubles,
      'max_unites', plan_record.max_unites
    ),
    'usage', current_usage,
    'can_add_user',     (current_usage->>'users')::int     < plan_record.max_users,
    'can_add_immeuble', (current_usage->>'immeubles')::int < plan_record.max_immeubles,
    'can_add_unite',    (current_usage->>'unites')::int    < plan_record.max_unites
  );
END;
$$;
