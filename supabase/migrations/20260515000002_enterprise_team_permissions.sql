-- Enterprise RBAC overrides for agency team members.
-- The frontend keeps a premium UX, but this table + RPC make permissions auditable
-- and enforceable from Edge Functions for sensitive mutations.

CREATE TABLE IF NOT EXISTS public.user_page_permissions (
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  page text NOT NULL,
  access_level text NOT NULL DEFAULT 'read'
    CHECK (access_level IN ('none', 'read', 'write', 'admin')),
  can_create boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  can_manage boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, page)
);

CREATE INDEX IF NOT EXISTS idx_user_page_permissions_agency_user
  ON public.user_page_permissions (agency_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_page_permissions_page
  ON public.user_page_permissions (page);

ALTER TABLE public.user_page_permissions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_page_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_page_permissions TO service_role;

DROP TRIGGER IF EXISTS update_user_page_permissions_updated_at ON public.user_page_permissions;
CREATE TRIGGER update_user_page_permissions_updated_at
  BEFORE UPDATE ON public.user_page_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Team can view scoped page permissions" ON public.user_page_permissions;
CREATE POLICY "Team can view scoped page permissions"
  ON public.user_page_permissions
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles admin_profile
      WHERE admin_profile.id = auth.uid()
        AND admin_profile.actif = true
        AND admin_profile.role IN ('admin', 'super_admin')
        AND (
          admin_profile.role = 'super_admin'
          OR admin_profile.agency_id = user_page_permissions.agency_id
        )
    )
  );

DROP POLICY IF EXISTS "Agency admins can create page permissions" ON public.user_page_permissions;
CREATE POLICY "Agency admins can create page permissions"
  ON public.user_page_permissions
  FOR INSERT
  WITH CHECK (
    user_id <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles admin_profile
      WHERE admin_profile.id = auth.uid()
        AND admin_profile.actif = true
        AND admin_profile.role IN ('admin', 'super_admin')
        AND (
          admin_profile.role = 'super_admin'
          OR admin_profile.agency_id = user_page_permissions.agency_id
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles target_profile
      WHERE target_profile.id = user_page_permissions.user_id
        AND target_profile.agency_id = user_page_permissions.agency_id
        AND target_profile.role <> 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Agency admins can update page permissions" ON public.user_page_permissions;
CREATE POLICY "Agency admins can update page permissions"
  ON public.user_page_permissions
  FOR UPDATE
  USING (
    user_id <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles admin_profile
      WHERE admin_profile.id = auth.uid()
        AND admin_profile.actif = true
        AND admin_profile.role IN ('admin', 'super_admin')
        AND (
          admin_profile.role = 'super_admin'
          OR admin_profile.agency_id = user_page_permissions.agency_id
        )
    )
  )
  WITH CHECK (
    user_id <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles target_profile
      WHERE target_profile.id = user_page_permissions.user_id
        AND target_profile.agency_id = user_page_permissions.agency_id
        AND target_profile.role <> 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Agency admins can delete page permissions" ON public.user_page_permissions;
CREATE POLICY "Agency admins can delete page permissions"
  ON public.user_page_permissions
  FOR DELETE
  USING (
    user_id <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles admin_profile
      WHERE admin_profile.id = auth.uid()
        AND admin_profile.actif = true
        AND admin_profile.role IN ('admin', 'super_admin')
        AND (
          admin_profile.role = 'super_admin'
          OR admin_profile.agency_id = user_page_permissions.agency_id
        )
    )
  );

CREATE OR REPLACE FUNCTION public.fn_default_page_access(p_role text, p_page text)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_role = 'super_admin' THEN
    RETURN 'admin';
  END IF;

  IF p_role = 'admin' THEN
    IF p_page IN (
      'dashboard', 'bailleurs', 'immeubles', 'unites', 'locataires', 'contrats',
      'paiements', 'loyers-impayes', 'depenses', 'commissions',
      'tableau-de-bord-financier', 'filtres-avances', 'parametres', 'equipe',
      'abonnement', 'notifications', 'inventaires', 'interventions',
      'calendrier', 'documents', 'audit', 'pricing'
    ) THEN
      RETURN 'admin';
    END IF;
  END IF;

  IF p_role = 'agent' THEN
    IF p_page IN (
      'dashboard', 'locataires', 'contrats', 'paiements', 'loyers-impayes',
      'notifications', 'inventaires', 'interventions', 'calendrier',
      'documents', 'pricing'
    ) THEN
      RETURN 'write';
    END IF;
  END IF;

  IF p_role = 'comptable' THEN
    IF p_page IN ('paiements', 'loyers-impayes', 'contrats', 'locataires', 'notifications', 'pricing') THEN
      RETURN 'read';
    END IF;
  END IF;

  IF p_role = 'bailleur' THEN
    IF p_page IN ('dashboard', 'contrats', 'paiements', 'loyers-impayes', 'notifications', 'pricing') THEN
      RETURN 'read';
    END IF;
  END IF;

  RETURN 'none';
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_user_can(
  p_user_id uuid,
  p_page text,
  p_action text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_perm public.user_page_permissions%ROWTYPE;
  v_access text;
  v_jwt_role text;
BEGIN
  v_jwt_role := COALESCE(auth.jwt() ->> 'role', '');

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id AND v_jwt_role <> 'service_role' THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_profile
  FROM public.user_profiles
  WHERE id = p_user_id
    AND actif = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_profile.role = 'super_admin' THEN
    RETURN true;
  END IF;

  SELECT *
  INTO v_perm
  FROM public.user_page_permissions
  WHERE user_id = p_user_id
    AND page = p_page;

  v_access := COALESCE(v_perm.access_level, public.fn_default_page_access(v_profile.role::text, p_page));

  IF v_access = 'none' THEN
    RETURN false;
  END IF;

  IF p_action = 'view' THEN
    RETURN true;
  END IF;

  IF v_access = 'admin' THEN
    RETURN true;
  END IF;

  IF p_action = 'create' THEN
    RETURN COALESCE(v_perm.can_create, v_access = 'write');
  ELSIF p_action = 'update' THEN
    RETURN COALESCE(v_perm.can_update, v_access = 'write');
  ELSIF p_action = 'delete' THEN
    RETURN COALESCE(v_perm.can_delete, false);
  ELSIF p_action = 'export' THEN
    RETURN COALESCE(v_perm.can_export, v_access IN ('read', 'write'));
  ELSIF p_action = 'manage' THEN
    RETURN COALESCE(v_perm.can_manage, false);
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_user_can(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_user_can(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_user_can(uuid, text, text) TO service_role;

COMMENT ON TABLE public.user_page_permissions IS
  'Per-user agency page/action overrides. Baseline access still comes from user_profiles.role.';

COMMENT ON FUNCTION public.fn_user_can(uuid, text, text) IS
  'Server-side permission check for Edge Functions and sensitive operations.';
