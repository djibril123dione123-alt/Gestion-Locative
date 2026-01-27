/*
  # Migrations critiques - Partie 2 : Table agency_settings

  1. Nouvelle table
    - agency_settings : Configuration globale de l'agence
  
  2. Sécurité
    - RLS activé
    - Tous peuvent lire, seuls admins peuvent modifier
*/

CREATE TABLE IF NOT EXISTS agency_settings (
  id text PRIMARY KEY DEFAULT 'default',

  -- Identité de l'agence
  nom_agence text DEFAULT 'Gestion Locative',
  logo_url text,
  couleur_primaire text DEFAULT '#F58220',
  ninea text,
  adresse text,
  telephone text,
  email text,

  -- Paramètres financiers
  commission_globale decimal(5,2) DEFAULT 10.00,
  commission_personnalisee_par_bailleur boolean DEFAULT false,
  penalite_retard_montant decimal(12,2) DEFAULT 1000.00,
  penalite_retard_delai_jours integer DEFAULT 3,
  devise text DEFAULT 'XOF',

  -- Paramètres documents
  qr_code_quittances boolean DEFAULT true,
  signature_url text,
  pied_page_personnalise text DEFAULT 'Gestion Locative - Dakar, Sénégal',
  format_date text DEFAULT 'JJ/MM/AAAA',

  -- Paramètres fonctionnels
  mode_avance_actif boolean DEFAULT false,
  module_depenses_actif boolean DEFAULT true,
  module_inventaires_actif boolean DEFAULT false,
  module_interventions_actif boolean DEFAULT false,
  champs_personnalises_locataire integer DEFAULT 0,

  -- Mobile Money
  wave_actif boolean DEFAULT false,
  wave_numero text,
  orange_money_actif boolean DEFAULT false,
  orange_money_numero text,
  free_money_actif boolean DEFAULT false,
  free_money_numero text,

  -- Notifications
  email_notifications_actif boolean DEFAULT false,
  sms_notifications_actif boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Créer trigger pour updated_at
DROP TRIGGER IF EXISTS update_agency_settings_updated_at ON agency_settings;
CREATE TRIGGER update_agency_settings_updated_at
  BEFORE UPDATE ON agency_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Activer RLS
ALTER TABLE agency_settings ENABLE ROW LEVEL SECURITY;

-- Politiques RLS : Tous les users authentifiés peuvent lire
CREATE POLICY "Authenticated users can view agency settings"
  ON agency_settings FOR SELECT
  TO authenticated
  USING (true);

-- Seuls les admins peuvent modifier
CREATE POLICY "Admins can update agency settings"
  ON agency_settings FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Contraintes
ALTER TABLE agency_settings DROP CONSTRAINT IF EXISTS check_commission_globale_valide;
ALTER TABLE agency_settings ADD CONSTRAINT check_commission_globale_valide
  CHECK (commission_globale >= 0 AND commission_globale <= 100);

ALTER TABLE agency_settings DROP CONSTRAINT IF EXISTS check_devise_valide;
ALTER TABLE agency_settings ADD CONSTRAINT check_devise_valide
  CHECK (devise IN ('XOF', 'EUR', 'USD', 'GBP', 'CHF'));

-- Insérer les paramètres par défaut
INSERT INTO agency_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;