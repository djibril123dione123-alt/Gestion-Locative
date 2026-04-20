/*
  # Correction complète agency_settings : colonnes manquantes + RLS upsert

  1. Colonnes ajoutées si absentes
    - site_web        : site web de l'agence
    - logo_position   : position du logo dans les documents (left / center / right)
    - couleur_secondaire : couleur secondaire pour les documents

  2. RLS consolidée
    - Toutes les anciennes politiques UPDATE/INSERT/SELECT sont supprimées
    - Nouvelles politiques permettant à tous les membres de l'agence de :
      * lire les paramètres de leur agence
      * insérer des paramètres pour leur agence
      * mettre à jour les paramètres de leur agence (upsert = INSERT ON CONFLICT DO UPDATE)

  3. Sécurité maintenue
    - Filtrage strict par agency_id via user_profiles
    - Un user ne peut voir/modifier que les paramètres de son agence
*/

-- ──────────────────────────────────────────
-- 1. Colonnes manquantes
-- ──────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'site_web'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN site_web text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'logo_position'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN logo_position text DEFAULT 'left';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_settings' AND column_name = 'couleur_secondaire'
  ) THEN
    ALTER TABLE agency_settings ADD COLUMN couleur_secondaire text DEFAULT '#333333';
  END IF;
END $$;

-- ──────────────────────────────────────────
-- 2. RLS — supprimer tous les anciens politiques
-- ──────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can view agency settings"   ON agency_settings;
DROP POLICY IF EXISTS "Admins can update agency settings"              ON agency_settings;
DROP POLICY IF EXISTS "Admins can update own agency settings"          ON agency_settings;
DROP POLICY IF EXISTS "Users can view own agency settings"             ON agency_settings;
DROP POLICY IF EXISTS "Users can update own agency settings"           ON agency_settings;
DROP POLICY IF EXISTS "Authenticated users can insert agency settings" ON agency_settings;
DROP POLICY IF EXISTS "All agency users can update settings"           ON agency_settings;
DROP POLICY IF EXISTS "All agency users can view settings"             ON agency_settings;
DROP POLICY IF EXISTS "All agency users can insert settings"           ON agency_settings;

-- ──────────────────────────────────────────
-- 3. RLS — nouvelles politiques consolidées
-- ──────────────────────────────────────────

ALTER TABLE agency_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency_settings_select"
  ON agency_settings FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "agency_settings_insert"
  ON agency_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "agency_settings_update"
  ON agency_settings FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  );
