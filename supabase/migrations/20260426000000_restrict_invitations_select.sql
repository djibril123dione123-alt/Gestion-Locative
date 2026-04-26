-- =====================================================
-- P0 SÉCURITÉ : Restreindre la lecture des invitations
-- =====================================================
--
-- PROBLÈME
-- --------
-- La policy `Invitations readable by token` créée dans
-- `20260425000004_create_invitations_table.sql` autorisait
-- USING (status = 'pending') sans cible authenticated/anon explicite.
-- Conséquence : tout client (y compris anon, donc sans token)
-- pouvait lister TOUTES les invitations en statut `pending`,
-- exposant les emails invités, les agences cibles et les rôles
-- proposés. C'est une fuite d'informations PII de niveau P0.
--
-- SOLUTION
-- --------
-- Le flux d'acceptation d'invitation se fait exclusivement via la
-- RPC `get_invitation_by_token` (SECURITY DEFINER). Cette RPC valide
-- le token UUID avant de retourner UNE seule invitation. Aucun
-- accès direct via SELECT sur la table n'est nécessaire pour le
-- frontend pré-auth.
--
-- On supprime donc la policy permissive et on la remplace par une
-- policy strictement réservée aux utilisateurs authentifiés
-- super_admin / admin de l'agence concernée (qui ont déjà besoin de
-- voir leurs propres invitations dans le back-office).
-- =====================================================

DROP POLICY IF EXISTS "Invitations readable by token" ON invitations;

-- Pas de SELECT pour anon : le seul chemin pré-auth est la RPC
-- get_invitation_by_token, qui est SECURITY DEFINER et bypass RLS.

-- Les super_admins peuvent voir toutes les invitations
CREATE POLICY "super_admin_can_read_all_invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'super_admin'
    )
  );

-- Les admins d'agence peuvent voir les invitations de leur agence
CREATE POLICY "agency_admin_can_read_own_invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
        AND user_profiles.agency_id = invitations.agency_id
    )
  );

COMMENT ON POLICY "super_admin_can_read_all_invitations" ON invitations IS
  'P0 fix: les invitations ne sont plus exposées en lecture anon. Le flux d''acceptation passe par la RPC get_invitation_by_token (SECURITY DEFINER).';
