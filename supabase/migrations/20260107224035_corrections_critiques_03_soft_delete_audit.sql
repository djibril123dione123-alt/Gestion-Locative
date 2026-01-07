/*
  # Migrations critiques - Partie 3 : Soft delete et Audit logs

  1. Soft delete
    - Ajout colonnes actif et deleted_at sur paiements et dépenses
  
  2. Audit logs automatiques
    - Fonction générique log_table_changes()
    - Triggers sur tables critiques
  
  3. Sécurité
    - Traçabilité complète des modifications
*/

-- Ajouter colonne actif sur paiements (si n'existe pas déjà)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements' AND column_name = 'actif'
  ) THEN
    ALTER TABLE paiements ADD COLUMN actif boolean DEFAULT true;
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
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'depenses' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE depenses ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- Créer index pour filtrer facilement les enregistrements actifs
CREATE INDEX IF NOT EXISTS idx_paiements_actif ON paiements(actif) WHERE actif = true;
CREATE INDEX IF NOT EXISTS idx_depenses_actif ON depenses(actif) WHERE actif = true;

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