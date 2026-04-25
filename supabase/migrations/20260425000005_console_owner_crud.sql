-- Console propriétaire — CRUD complet
--
-- Objectif : donner au super_admin un accès complet aux opérations de la
-- Console (créer une agence, inviter un utilisateur dans n'importe quelle
-- agence, modifier le rôle/agence d'un utilisateur, modifier un abonnement,
-- supprimer une agence). Le tenant isolation pour les autres rôles reste
-- intacte.
--
-- Pré-requis : la fonction is_super_admin() est définie dans la migration
-- 20260420000002_add_super_admin_role_and_console.sql.

-- ─────────────────────────────────────────────────────────────
-- 1) invitations : super_admin peut TOUT faire (toutes agences)
--    Les policies "Admins can ..." existantes restent valables pour
--    les admins d'agence (chacun dans son tenant).
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Super admin can view all invitations" ON invitations;
CREATE POLICY "Super admin can view all invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (is_super_admin());

DROP POLICY IF EXISTS "Super admin can create invitations" ON invitations;
CREATE POLICY "Super admin can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Super admin can update invitations" ON invitations;
CREATE POLICY "Super admin can update invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Super admin can delete invitations" ON invitations;
CREATE POLICY "Super admin can delete invitations"
  ON invitations FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- ─────────────────────────────────────────────────────────────
-- 2) Confort : index sur user_profiles.agency_id pour les JOINs
--    de la Console (souvent absent sur les vieux schémas).
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_profiles_agency_id ON user_profiles(agency_id);

-- ─────────────────────────────────────────────────────────────
-- Notes :
-- - agencies : INSERT/DELETE super_admin déjà couvert par
--   agency_super_admin_insert / agency_super_admin_delete
--   (migration 20260420000002).
-- - subscriptions : ALL super_admin déjà couvert par
--   subscriptions_super_admin_write (migration 20260420000002).
-- - user_profiles UPDATE par super_admin déjà couvert par
--   user_profiles_update (migration 20260425000003).
-- - La création d'un compte auth.users (avec mot de passe) ne peut PAS
--   être faite depuis le front avec la clé anon. Le flux retenu est :
--   le super_admin crée une invitation → l'invité s'inscrit lui-même
--   via /AcceptInvitation et son user_profiles est rattaché à l'agence
--   et au rôle de l'invitation.
-- - Le rôle super_admin n'est volontairement pas attribuable via
--   invitations (CHECK sur invitations.role limite à admin/agent/comptable).
--   La promotion d'un utilisateur en super_admin reste une opération SQL
--   manuelle pour des raisons de sécurité.
-- ─────────────────────────────────────────────────────────────
