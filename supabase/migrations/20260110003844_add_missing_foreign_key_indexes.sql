/*
  # Add missing indexes on foreign keys

  1. Performance Optimization
    - Add indexes on all foreign key columns that lack covering indexes
    - Improves JOIN performance and query optimization
    - Helps with cascade operations and referential integrity checks

  2. Tables affected
    - audit_logs: user_id
    - bailleurs: created_by
    - contrats: created_by
    - depenses: created_by, immeuble_id
    - documents: uploaded_by
    - evenements: bailleur_id, created_by, immeuble_id, locataire_id, unite_id
    - immeubles: created_by
    - interventions: created_by
    - inventaires: created_by
    - invitations: invited_by
    - locataires: created_by
    - paiements: created_by
    - revenus: created_by, paiement_id
    - subscriptions: plan_id
    - unites: created_by
*/

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- Bailleurs
CREATE INDEX IF NOT EXISTS idx_bailleurs_created_by ON bailleurs(created_by);

-- Contrats
CREATE INDEX IF NOT EXISTS idx_contrats_created_by ON contrats(created_by);

-- Depenses
CREATE INDEX IF NOT EXISTS idx_depenses_created_by ON depenses(created_by);
CREATE INDEX IF NOT EXISTS idx_depenses_immeuble_id ON depenses(immeuble_id);

-- Documents
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);

-- Evenements
CREATE INDEX IF NOT EXISTS idx_evenements_bailleur_id ON evenements(bailleur_id);
CREATE INDEX IF NOT EXISTS idx_evenements_created_by ON evenements(created_by);
CREATE INDEX IF NOT EXISTS idx_evenements_immeuble_id ON evenements(immeuble_id);
CREATE INDEX IF NOT EXISTS idx_evenements_locataire_id ON evenements(locataire_id);
CREATE INDEX IF NOT EXISTS idx_evenements_unite_id ON evenements(unite_id);

-- Immeubles
CREATE INDEX IF NOT EXISTS idx_immeubles_created_by ON immeubles(created_by);

-- Interventions
CREATE INDEX IF NOT EXISTS idx_interventions_created_by ON interventions(created_by);

-- Inventaires
CREATE INDEX IF NOT EXISTS idx_inventaires_created_by ON inventaires(created_by);

-- Invitations
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON invitations(invited_by);

-- Locataires
CREATE INDEX IF NOT EXISTS idx_locataires_created_by ON locataires(created_by);

-- Paiements
CREATE INDEX IF NOT EXISTS idx_paiements_created_by ON paiements(created_by);

-- Revenus
CREATE INDEX IF NOT EXISTS idx_revenus_created_by ON revenus(created_by);
CREATE INDEX IF NOT EXISTS idx_revenus_paiement_id ON revenus(paiement_id);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);

-- Unites
CREATE INDEX IF NOT EXISTS idx_unites_created_by ON unites(created_by);
