export interface AgencySettings {
  agency_id: string;
  is_bailleur_account?: boolean;
  organization_type?: 'agence' | 'bailleur_individuel' | 'gestionnaire' | 'groupe' | 'agency' | 'individual_landlord' | 'multi_property_landlord' | 'property_manager' | 'group';
  document_mode?: 'simple' | 'professional' | 'legal';
  enabled_modules?: Record<string, boolean>;
  document_preferences?: {
    header_style?: 'sobriete' | 'institutionnel' | 'moderne';
    show_slogan?: boolean;
    numbering_format?: 'Q-YYYY-0001' | 'SK-Q-0001' | 'AGENCE-YYYY-0001';
    reset_numbering_yearly?: boolean;
    show_document_number?: boolean;
    prefixes?: Record<string, string>;
    qr_documents?: Record<string, boolean>;
    qr_text?: string;
    qr_position?: 'bottom_right' | 'footer' | 'cover';
    confidentiality_notice?: string;
    payment_notice?: string;
    receipt_notice?: string;
    document_options?: Record<string, Record<string, boolean>>;
  };
  proprietaire_info?: Record<string, string | null>;
  nom_agence: string | null;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  site_web: string | null;
  ninea: string | null;
  rc: string | null;
  representant_nom: string | null;
  representant_fonction: string | null;
  manager_id_type: string | null;
  manager_id_number: string | null;
  city: string | null;
  logo_url: string | null;
  logo_position: 'left' | 'center' | 'right' | null;
  couleur_primaire: string | null;
  couleur_secondaire: string | null;
  devise: string | null;
  pied_page_personnalise: string | null;
  signature_url: string | null;
  qr_code_quittances: boolean;
  penalite_retard_montant: number | null;
  penalite_retard_delai_jours: number | null;
  frais_huissier: number | null;
  mention_tribunal: string | null;
  mention_penalites: string | null;
  mention_frais_huissier: string | null;
  mention_litige: string | null;
  commission_globale: number | null;
  commission_personnalisee_par_bailleur: boolean;
  mode_avance_actif: boolean;
  module_depenses_actif: boolean;
  module_inventaires_actif: boolean;
  module_interventions_actif: boolean;
  wave_actif: boolean;
  wave_numero: string | null;
  orange_money_actif: boolean;
  orange_money_numero: string | null;
  free_money_actif: boolean;
  free_money_numero: string | null;
  email_notifications_actif: boolean;
  sms_notifications_actif: boolean;
  champs_personnalises_locataire: number;
  onboarding_completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type AgencySettingsFormInput = Partial<Omit<AgencySettings, 'agency_id' | 'created_at' | 'updated_at'>>;

export const DEFAULT_AGENCY_SETTINGS: AgencySettingsFormInput = {
  nom_agence: 'Gestion Locative',
  adresse: null,
  telephone: null,
  email: null,
  site_web: null,
  ninea: null,
  rc: null,
  representant_nom: null,
  representant_fonction: 'Gerant',
  manager_id_type: 'CNI',
  manager_id_number: null,
  city: 'Dakar',
  logo_url: null,
  logo_position: 'left',
  couleur_primaire: '#F58220',
  couleur_secondaire: '#333333',
  devise: 'XOF',
  pied_page_personnalise: 'Gestion Locative - Dakar, Senegal',
  signature_url: null,
  qr_code_quittances: true,
  penalite_retard_montant: 1000,
  penalite_retard_delai_jours: 3,
  frais_huissier: 37500,
  mention_tribunal: 'Avec attribution exclusive de juridiction au juge des referes du Tribunal de Dakar.',
  mention_penalites: "Il est expressement convenu qu'a defaut de paiement d'un mois de loyer dans les delais impartis (au plus tard le 07 du mois en cours) des penalites seront appliquees. Passe ce delai, la procedure judiciaire sera enclenchee.",
  mention_frais_huissier: "En cas de non-paiement du loyer dans les delais impartis, une somme est prelevee sur la caution pour les frais d'huissier afin d'assignation en expulsion, conformement a la loi senegalaise.",
  mention_litige: "Il est expressement convenu qu'en cas de litige, les frais d'huissier, d'expertises et d'honoraires d'avocat, qui auraient ete engages par le bailleur et ce sur pieces justificatives, seront rembourses par le locataire.",
  commission_globale: 10,
  commission_personnalisee_par_bailleur: false,
  mode_avance_actif: false,
  module_depenses_actif: true,
  module_inventaires_actif: false,
  module_interventions_actif: false,
  wave_actif: false,
  wave_numero: null,
  orange_money_actif: false,
  orange_money_numero: null,
  free_money_actif: false,
  free_money_numero: null,
  email_notifications_actif: false,
  sms_notifications_actif: false,
  champs_personnalises_locataire: 0,
  onboarding_completed_at: null,
};
