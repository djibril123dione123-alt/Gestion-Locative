import React, { useState, useEffect, useMemo } from 'react';
import {
  Save,
  Upload,
  AlertCircle,
  FileText,
  Palette,
  Building,
  CheckCircle,
  SlidersHorizontal,
  Edit3,
  Landmark,
  QrCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { AgencySettings, DEFAULT_AGENCY_SETTINGS } from '../types/agency';
import { ToastContainer } from '../components/ui/Toast';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumButton } from '../components/ui/PremiumButton';
import { invalidateAgencySettingsCache } from '../lib/pdf';
import { PageSkeleton } from '../components/ui/Skeleton';
import { formatSenegalPhone, formatSenegalPhoneInput, normalizeSenegalPhone } from '../lib/formatters';

type SettingsState = Omit<AgencySettings, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
};

type SettingsTab = 'general' | 'documents' | 'appearance' | 'modules';
type EmbeddedMode = 'single' | 'documentsIdentity';
type LogoUploadState = 'idle' | 'preview' | 'uploading' | 'done';
type DocumentPreviewType = 'quittance' | 'contrat' | 'mandat' | 'rapport' | 'facture';
type ModuleFieldToggleKey =
  | 'module_depenses_actif'
  | 'module_inventaires_actif'
  | 'module_interventions_actif'
  | 'mode_avance_actif'
  | 'qr_code_quittances';
type ModuleToggleTarget =
  | { kind: 'field'; key: ModuleFieldToggleKey }
  | { kind: 'enabled_modules'; key: string; defaultEnabled?: boolean };

interface SettingsModuleItem {
  label: string;
  description: string;
  impact?: string;
  status: 'system' | 'essential' | 'active' | 'inactive' | 'prepared' | 'plan';
  toggle?: ModuleToggleTarget;
}

interface SettingsModuleCategory {
  category: string;
  description: string;
  items: SettingsModuleItem[];
}

interface ParametresProps {
  initialTab?: SettingsTab;
  embedded?: boolean;
  embeddedMode?: EmbeddedMode;
}

const AGENCY_ASSETS_BUCKET = 'agency-assets';
const LOGO_MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const LOGO_COMPRESSION_THRESHOLD = 1.4 * 1024 * 1024;
const LOGO_MAX_DIMENSION = 1200;

const DOCUMENT_PREVIEWS: Record<DocumentPreviewType, {
  label: string;
  title: string;
  reference: string;
  amount: string;
  meta: string;
}> = {
  quittance: {
    label: 'Quittance',
    title: 'Quittance de loyer',
    reference: 'QIT-2026-07',
    amount: '500 000 F CFA',
    meta: 'Juillet 2026 · Appartement F4',
  },
  contrat: {
    label: 'Contrat',
    title: 'Contrat de bail',
    reference: 'CTR-2026-04',
    amount: '300 000 F CFA / mois',
    meta: 'Bail actif · Unité louée',
  },
  mandat: {
    label: 'Mandat',
    title: 'Mandat de gestion',
    reference: 'MDT-2026-08',
    amount: 'Commission 10%',
    meta: 'Propriétaire · Portefeuille',
  },
  rapport: {
    label: 'Rapport',
    title: 'Rapport bailleur',
    reference: 'RPT-2026-07',
    amount: '1 175 000 F CFA',
    meta: 'Encaissements · Reversements',
  },
  facture: {
    label: 'Facture',
    title: 'Facture de charge',
    reference: 'FAC-2026-21',
    amount: '37 500 F CFA',
    meta: 'Frais huissier · Justificatif',
  },
};

const DOCUMENT_OPTION_LABELS: Record<string, string> = {
  annexes: 'Annexes',
  attachments: 'Pièces jointes',
  agencyDuties: 'Obligations agence',
  commission: 'Commission',
  duration: 'Durée',
  expenses: 'Charges',
  financialSummary: 'Résumé financier',
  fiscalNotice: 'Mention fiscale',
  footer: 'Pied de page',
  legalRepresentative: 'Représentant légal',
  logo: 'Logo',
  ownerDuties: 'Obligations bailleur',
  paymentMethod: 'Mode paiement',
  paymentTerms: 'Conditions paiement',
  payments: 'Paiements',
  penalties: 'Pénalités',
  period: 'Période',
  qr: 'QR Verify',
  receiptNotice: 'Réserve encaissement',
  remainingDue: 'Reliquats',
  signatures: 'Signatures',
  stamp: 'Cachet',
  taxIds: 'NINEA / RC',
  tribunal: 'Tribunal',
};

function getDocumentOptionLabel(key: string) {
  return DOCUMENT_OPTION_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase());
}

function getDocumentModeLabel(mode?: AgencySettings['document_mode']) {
  if (mode === 'legal') return 'Juridique renforcé';
  if (mode === 'simple') return 'Simple';
  return 'Professionnel';
}

function formatCompactDate(value?: string | null) {
  if (!value) return 'Non renseigné';
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const DEFAULT_DOCUMENT_PREFERENCES: NonNullable<AgencySettings['document_preferences']> = {
  header_style: 'institutionnel',
  show_slogan: true,
  numbering_format: 'Q-YYYY-0001',
  reset_numbering_yearly: true,
  show_document_number: true,
  prefixes: {
    quittance: 'QIT',
    contrat: 'CTR',
    mandat: 'MDT',
    rapport: 'RPT',
    facture: 'FAC',
  },
  qr_documents: {
    quittance: true,
    contrat: true,
    mandat: true,
    rapport: true,
    facture: false,
  },
  qr_text: "Scannez pour vérifier l'authenticité.",
  qr_position: 'bottom_right',
  confidentiality_notice: 'Document confidentiel réservé aux parties concernées.',
  payment_notice: 'Paiement attendu selon les modalités prévues au contrat.',
  receipt_notice: "Quittance émise sous réserve d'encaissement effectif.",
  document_options: {
    contrat: {
      logo: true,
      qr: true,
      legalRepresentative: true,
      taxIds: true,
      penalties: true,
      tribunal: true,
      signatures: true,
      annexes: true,
    },
    mandat: {
      commission: true,
      duration: true,
      ownerDuties: true,
      agencyDuties: true,
      signatures: true,
      qr: true,
    },
    quittance: {
      period: true,
      paymentMethod: true,
      remainingDue: true,
      qr: true,
      receiptNotice: true,
      stamp: false,
    },
    rapport: {
      financialSummary: true,
      payments: true,
      remainingDue: true,
      expenses: true,
      commissions: true,
      attachments: true,
      qr: true,
      footer: true,
    },
    facture: {
      taxIds: true,
      paymentTerms: true,
      fiscalNotice: true,
      qr: false,
    },
  },
};

const EMPTY_SETTINGS: Omit<SettingsState, 'agency_id'> = {
  nom_agence: '',
  adresse: '',
  telephone: '',
  email: '',
  site_web: '',
  ninea: '',
  rc: '',
  representant_nom: '',
  representant_fonction: DEFAULT_AGENCY_SETTINGS.representant_fonction ?? 'Gérant',
  manager_id_type: DEFAULT_AGENCY_SETTINGS.manager_id_type ?? 'CNI',
  manager_id_number: '',
  city: DEFAULT_AGENCY_SETTINGS.city ?? 'Dakar',
  logo_url: '',
  logo_position: DEFAULT_AGENCY_SETTINGS.logo_position ?? 'left',
  couleur_primaire: DEFAULT_AGENCY_SETTINGS.couleur_primaire ?? '#F58220',
  couleur_secondaire: DEFAULT_AGENCY_SETTINGS.couleur_secondaire ?? '#333333',
  devise: DEFAULT_AGENCY_SETTINGS.devise ?? 'XOF',
  pied_page_personnalise: DEFAULT_AGENCY_SETTINGS.pied_page_personnalise ?? '',
  signature_url: null,
  qr_code_quittances: true,
  mention_tribunal: DEFAULT_AGENCY_SETTINGS.mention_tribunal ?? '',
  mention_penalites: DEFAULT_AGENCY_SETTINGS.mention_penalites ?? '',
  mention_frais_huissier: DEFAULT_AGENCY_SETTINGS.mention_frais_huissier ?? '',
  mention_litige: DEFAULT_AGENCY_SETTINGS.mention_litige ?? '',
  frais_huissier: DEFAULT_AGENCY_SETTINGS.frais_huissier ?? 37500,
  commission_globale: DEFAULT_AGENCY_SETTINGS.commission_globale ?? 10,
  penalite_retard_montant: DEFAULT_AGENCY_SETTINGS.penalite_retard_montant ?? 1000,
  penalite_retard_delai_jours: DEFAULT_AGENCY_SETTINGS.penalite_retard_delai_jours ?? 3,
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
  document_preferences: DEFAULT_DOCUMENT_PREFERENCES,
};

function getDocumentPreferences(settings: SettingsState): NonNullable<AgencySettings['document_preferences']> {
  return {
    ...DEFAULT_DOCUMENT_PREFERENCES,
    ...(settings.document_preferences ?? {}),
    prefixes: {
      ...DEFAULT_DOCUMENT_PREFERENCES.prefixes,
      ...(settings.document_preferences?.prefixes ?? {}),
    },
    qr_documents: {
      ...DEFAULT_DOCUMENT_PREFERENCES.qr_documents,
      ...(settings.document_preferences?.qr_documents ?? {}),
    },
    document_options: {
      ...DEFAULT_DOCUMENT_PREFERENCES.document_options,
      ...(settings.document_preferences?.document_options ?? {}),
    },
  };
}

function buildSettingsModuleCategories(settings: SettingsState): SettingsModuleCategory[] {
  const enabledModules = settings.enabled_modules ?? {};
  const enabled = (key: string, fallback = true) => {
    const value = enabledModules[key];
    return typeof value === 'boolean' ? value : fallback;
  };
  const optional = (key: ModuleFieldToggleKey, active: boolean): Pick<SettingsModuleItem, 'status' | 'toggle'> => ({
    status: active ? 'active' : 'inactive',
    toggle: { kind: 'field', key },
  });
  const moduleToggle = (
    key: string,
    fallback = true,
  ): Pick<SettingsModuleItem, 'status' | 'toggle'> => {
    const defaultEnabled = key === 'planning' ? true : fallback;
    return {
      status: enabled(key, defaultEnabled) ? 'active' : defaultEnabled ? 'inactive' : 'prepared',
      toggle: { kind: 'enabled_modules', key, defaultEnabled },
    };
  };

  return [
    {
      category: 'Portefeuille locatif',
      description: 'Socle visible dans la navigation principale.',
      items: [
        { label: 'Tableau de bord', description: 'Pilotage quotidien et priorités agence.', impact: 'Accueil', status: 'system' },
        { label: 'Bailleurs', description: 'Propriétaires, rattachements et reversements.', impact: 'Source propriétaire', status: 'system' },
        { label: 'Biens & patrimoine', description: 'Biens, unités et occupation.', impact: 'Source patrimoine', status: 'system' },
        { label: 'Locations / baux', description: 'Occupants, contrats et cycles locatifs.', impact: 'Cycle locatif', status: 'system' },
      ],
    },
    {
      category: 'Finance',
      description: 'Encaissements, charges et pilotage financier.',
      items: [
        { label: 'Encaissements', description: 'Paiements reçus, quittances et statuts.', impact: 'Finance cœur', status: 'system' },
        { label: 'Créances', description: 'Retards, partiels et restes dus.', impact: 'Finance cœur', status: 'system' },
        { label: 'Charges bailleur', description: 'Charges refacturables ou liées au rapport bailleur.', impact: 'Rapports bailleurs', status: 'essential' },
        { label: 'Dépenses agence', description: 'Dépenses opérationnelles internes et justificatifs.', impact: 'Sidebar finance', ...optional('module_depenses_actif', Boolean(settings.module_depenses_actif)) },
        { label: 'Commissions', description: 'Revenus agence et parts de gestion.', impact: 'Marge agence', ...moduleToggle('commissions') },
        { label: 'Rapports avancés', description: 'Synthèses, exports et lecture direction.', impact: 'Pilotage avancé', ...moduleToggle('advanced_reports', Boolean(settings.mode_avance_actif)) },
      ],
    },
    {
      category: 'Documents',
      description: 'GED, vérification publique et modèles.',
      items: [
        { label: 'GED', description: 'Coffre documentaire centralisé.', status: 'system' },
        { label: 'QR Verify', description: 'Preuves publiques et vérification QR.', impact: 'Preuve publique', ...optional('qr_code_quittances', Boolean(settings.qr_code_quittances)) },
        { label: 'Scanner', description: 'Vérification rapide sur mobile.', impact: 'Contrôle terrain', ...moduleToggle('document_scanner') },
        { label: 'Modèles', description: 'Règles documentaires et mentions.', status: 'system' },
      ],
    },
    {
      category: 'Terrain',
      description: 'Opérations et suivi terrain.',
      items: [
        { label: 'États des lieux', description: 'Constats entrée, sortie et inventaires.', ...optional('module_inventaires_actif', Boolean(settings.module_inventaires_actif)) },
        { label: 'Maintenance', description: 'Demandes, interventions et priorités.', ...optional('module_interventions_actif', Boolean(settings.module_interventions_actif)) },
        { label: 'Planning', description: 'Opérations terrain et calendrier.', impact: 'Calendrier équipe', ...moduleToggle('planning', false) },
        {
          label: 'Notifications bailleurs',
          description: 'Emails, SMS et relances selon les réglages agence.',
          impact: 'Communication',
          status: settings.email_notifications_actif || settings.sms_notifications_actif ? 'active' : 'prepared',
        },
      ],
    },
    {
      category: 'Administration',
      description: 'Équipe, permissions, abonnement et audit.',
      items: [
        { label: 'Équipe', description: 'Collaborateurs et invitations.', status: enabled('team') ? 'active' : 'system' },
        { label: 'Permissions', description: 'RBAC, pages visibles et overrides.', status: 'system' },
        { label: 'Abonnement', description: 'Plan, limites et facturation.', status: 'system' },
        { label: 'Audit', description: 'Journal réservé aux administrateurs.', impact: 'Trace sensible', ...moduleToggle('audit_trail', false) },
        { label: 'Mode avancé', description: 'Options expertes pour équipes structurées.', impact: 'Configuration', ...optional('mode_avance_actif', Boolean(settings.mode_avance_actif)) },
      ],
    },
  ];
}

function updateModuleToggle(settings: SettingsState, target: ModuleToggleTarget): SettingsState {
  if (target.kind === 'field') {
    return { ...settings, [target.key]: !settings[target.key] };
  }
  const current = settings.enabled_modules?.[target.key];
  const currentValue = typeof current === 'boolean' ? current : target.defaultEnabled ?? true;
  return {
    ...settings,
    enabled_modules: {
      ...(settings.enabled_modules ?? {}),
      [target.key]: !currentValue,
    },
  };
}

function getLogoExtension(file: File) {
  if (file.type === 'image/svg+xml') return 'svg';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/jpeg') return 'jpg';
  return 'png';
}

function extractAgencyAssetPath(url: string | null | undefined, agencyId: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${AGENCY_ASSETS_BUCKET}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;

  const rawPath = url.slice(markerIndex + marker.length).split('?')[0];
  const path = decodeURIComponent(rawPath);
  if (path.startsWith(`${agencyId}/logos/`) || path.startsWith(`logos/${agencyId}-logo.`)) {
    return path;
  }
  return null;
}

async function compressLogoFile(file: File): Promise<File> {
  if (file.type === 'image/svg+xml' || file.size <= LOGO_COMPRESSION_THRESHOLD) {
    return file;
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });

    const ratio = Math.min(1, LOGO_MAX_DIMENSION / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', 0.92);
    });

    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export function Parametres({ initialTab = 'general', embedded = false, embeddedMode = 'single' }: ParametresProps = {}) {
  const { profile, agency, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const { showToast, toasts, removeToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [editingEmbedded, setEditingEmbedded] = useState(false);
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [logoUploadState, setLogoUploadState] = useState<LogoUploadState>('idle');
  const [documentPreviewType, setDocumentPreviewType] = useState<DocumentPreviewType>('quittance');

  const getOwnerNameFallback = () => {
    const profileName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ').trim();
    return profileName || agency?.name || DEFAULT_AGENCY_SETTINGS.nom_agence || 'Propriétaire';
  };

  useEffect(() => {
    if (profile?.agency_id) {
      loadSettings(profile.agency_id);
    }
  // `loadSettings` is intentionally kept as a local workflow because it may create defaults.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.agency_id]);

  useEffect(() => {
    setActiveTab(initialTab);
    setEditingEmbedded(false);
  }, [initialTab]);

  const loadSettings = async (agencyId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agency_settings')
        .select('*')
        .eq('agency_id', agencyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const nextSettings = data as SettingsState;
        if (isIndividualOwner) {
          const ownerName = nextSettings.representant_nom || nextSettings.nom_agence || getOwnerNameFallback();
          nextSettings.representant_nom = ownerName;
          nextSettings.nom_agence = nextSettings.nom_agence || ownerName;
          nextSettings.representant_fonction = nextSettings.representant_fonction || 'Propriétaire';
        }
        setSettings(nextSettings);
        setLastSavedSnapshot(JSON.stringify(nextSettings));
        if (data.logo_url) {
          setLogoPreview(data.logo_url);
        }
      } else {
        const created = await createDefaultSettings(agencyId);
        if (created) {
          setSettings(created as SettingsState);
          setLastSavedSnapshot(JSON.stringify(created));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Erreur chargement paramètres:', msg);
      showToast('Erreur lors du chargement des paramètres', 'error');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async (agencyId: string): Promise<AgencySettings | null> => {
    try {
      const { data: agency } = await supabase
        .from('agencies')
        .select('name, phone, email, address, ninea')
        .eq('id', agencyId)
        .maybeSingle();

      const ownerName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ').trim()
        || agency?.name
        || DEFAULT_AGENCY_SETTINGS.nom_agence
        || 'Propriétaire';

      const rowToInsert = {
        ...EMPTY_SETTINGS,
        agency_id: agencyId,
        nom_agence: isIndividualOwner ? ownerName : agency?.name ?? DEFAULT_AGENCY_SETTINGS.nom_agence ?? 'Mon Agence',
        adresse: agency?.address ?? '',
        telephone: normalizeSenegalPhone(agency?.phone ?? '') ?? agency?.phone ?? '',
        email: agency?.email ?? '',
        ninea: agency?.ninea ?? '',
        representant_nom: isIndividualOwner ? ownerName : '',
        representant_fonction: isIndividualOwner ? 'Propriétaire' : EMPTY_SETTINGS.representant_fonction,
      };

      const { data, error } = await supabase
        .from('agency_settings')
        .insert(rowToInsert)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          const { data: existing, error: fetchError } = await supabase
            .from('agency_settings')
            .select('*')
            .eq('agency_id', agencyId)
            .single();
          if (fetchError) throw fetchError;
          return existing as AgencySettings;
        }
        throw error;
      }
      return data as AgencySettings;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Erreur création paramètres par défaut:', msg);
      return null;
    }
  };

  const handleSave = async () => {
    if (!profile?.agency_id || !settings) return;

    setSaving(true);
    try {
      const normalizedPhone = settings.telephone ? normalizeSenegalPhone(settings.telephone) : null;
      if (settings.telephone && !normalizedPhone) {
        showToast('Le téléphone de l’agence doit être un numéro sénégalais valide, par exemple 77 123 45 67.', 'error');
        setSaving(false);
        return;
      }
      const ownerNameForDocuments = isIndividualOwner
        ? (settings.representant_nom || settings.nom_agence || getOwnerNameFallback()).trim()
        : '';
      const dataToSave: Omit<AgencySettings, 'created_at' | 'updated_at'> = {
        agency_id: profile.agency_id,
        nom_agence: isIndividualOwner ? ownerNameForDocuments : settings.nom_agence ?? '',
        adresse: settings.adresse ?? '',
        telephone: normalizedPhone ?? '',
        email: settings.email ?? '',
        site_web: settings.site_web ?? '',
        ninea: settings.ninea ?? '',
        rc: settings.rc ?? '',
        representant_nom: isIndividualOwner ? ownerNameForDocuments : settings.representant_nom ?? '',
        representant_fonction: settings.representant_fonction ?? 'Gérant',
        manager_id_type: settings.manager_id_type ?? 'CNI',
        manager_id_number: settings.manager_id_number ?? '',
        city: settings.city ?? 'Dakar',
        logo_url: settings.logo_url ?? '',
        logo_position: settings.logo_position ?? 'left',
        couleur_primaire: settings.couleur_primaire ?? '#F58220',
        couleur_secondaire: settings.couleur_secondaire ?? '#333333',
        mention_tribunal: settings.mention_tribunal ?? '',
        mention_penalites: settings.mention_penalites ?? '',
        mention_frais_huissier: settings.mention_frais_huissier ?? '',
        mention_litige: settings.mention_litige ?? '',
        pied_page_personnalise: settings.pied_page_personnalise ?? '',
        frais_huissier: settings.frais_huissier ?? 37500,
        commission_globale: settings.commission_globale ?? 10,
        penalite_retard_montant: settings.penalite_retard_montant ?? 1000,
        penalite_retard_delai_jours: settings.penalite_retard_delai_jours ?? 3,
        devise: settings.devise ?? 'XOF',
        signature_url: settings.signature_url ?? null,
        qr_code_quittances: settings.qr_code_quittances ?? true,
        commission_personnalisee_par_bailleur: settings.commission_personnalisee_par_bailleur ?? false,
        mode_avance_actif: settings.mode_avance_actif ?? false,
        module_depenses_actif: settings.module_depenses_actif ?? true,
        module_inventaires_actif: settings.module_inventaires_actif ?? false,
        module_interventions_actif: settings.module_interventions_actif ?? false,
        wave_actif: settings.wave_actif ?? false,
        wave_numero: settings.wave_numero ?? null,
        orange_money_actif: settings.orange_money_actif ?? false,
        orange_money_numero: settings.orange_money_numero ?? null,
        free_money_actif: settings.free_money_actif ?? false,
        free_money_numero: settings.free_money_numero ?? null,
        email_notifications_actif: settings.email_notifications_actif ?? false,
        sms_notifications_actif: settings.sms_notifications_actif ?? false,
        champs_personnalises_locataire: settings.champs_personnalises_locataire ?? 0,
        onboarding_completed_at: settings.onboarding_completed_at ?? null,
      };

      if ('document_mode' in settings) {
        dataToSave.document_mode = settings.document_mode ?? (isIndividualOwner ? 'simple' : 'professional');
      }
      if ('enabled_modules' in settings) {
        dataToSave.enabled_modules = settings.enabled_modules ?? {};
      }
      if ('document_preferences' in settings) {
        dataToSave.document_preferences = getDocumentPreferences(settings);
      }
      if ('proprietaire_info' in settings) {
        dataToSave.proprietaire_info = settings.proprietaire_info ?? {};
      }

      const { data: savedData, error } = await supabase
        .from('agency_settings')
        .upsert(dataToSave, { onConflict: 'agency_id', ignoreDuplicates: false })
        .select()
        .single();

      if (error) {
        console.error('Erreur Supabase upsert:', error);
        throw new Error(error.message);
      }

      if (!savedData) {
        throw new Error(
          'Sauvegarde bloquée par les permissions. Vérifiez votre rôle ou contactez l\'administrateur.'
        );
      }

      setSettings(savedData as SettingsState);
      setLastSavedSnapshot(JSON.stringify(savedData));
      invalidateAgencySettingsCache(profile.agency_id);
      showToast('Paramètres enregistrés avec succès', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      console.error('Erreur sauvegarde paramètres:', msg);
      showToast(`Erreur : ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const validateLogoFile = (file: File): string | null => {
    const allowedTypes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return 'Formats acceptés : PNG, SVG, JPG ou WEBP.';
    }
    if (file.size > LOGO_MAX_UPLOAD_SIZE) {
      return "L'image ne doit pas dépasser 5 Mo.";
    }
    return null;
  };

  const uploadLogoFile = async (file: File) => {
    if (!file || !profile?.agency_id || !settings) return;

    const validationError = validateLogoFile(file);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    const previousPreview = logoPreview;
    const previousLogoUrl = settings.logo_url;
    const localPreview = URL.createObjectURL(file);
    setLogoPreview(localPreview);
    setLogoUploadState('preview');

    try {
      setLogoUploadState('uploading');
      const uploadFile = await compressLogoFile(file);
      const fileExt = getLogoExtension(uploadFile);
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${profile.agency_id}/logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(AGENCY_ASSETS_BUCKET)
        .upload(filePath, uploadFile, {
          cacheControl: '31536000',
          contentType: uploadFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from(AGENCY_ASSETS_BUCKET)
        .getPublicUrl(filePath);

      const versionedLogoUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;
      const { data: savedSettings, error: updateError } = await supabase
        .from('agency_settings')
        .update({ logo_url: versionedLogoUrl })
        .eq('agency_id', profile.agency_id)
        .select()
        .maybeSingle();

      if (updateError) {
        await supabase.storage.from(AGENCY_ASSETS_BUCKET).remove([filePath]);
        throw updateError;
      }

      if (!savedSettings) {
        await supabase.storage.from(AGENCY_ASSETS_BUCKET).remove([filePath]);
        throw new Error("Logo uploadé, mais la sauvegarde des paramètres a été refusée par les permissions.");
      }

      const oldAssetPath = extractAgencyAssetPath(previousLogoUrl, profile.agency_id);
      if (oldAssetPath && oldAssetPath !== filePath) {
        await supabase.storage.from(AGENCY_ASSETS_BUCKET).remove([oldAssetPath]);
      }

      setSettings(savedSettings as SettingsState);
      setLastSavedSnapshot(JSON.stringify(savedSettings));
      setLogoPreview(versionedLogoUrl);
      setLogoUploadState('done');
      invalidateAgencySettingsCache(profile.agency_id);
      showToast('Logo uploadé et sauvegardé avec succès', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erreur upload logo:", msg);
      setLogoUploadState('idle');
      setLogoPreview(previousPreview);
      showToast(`Erreur upload logo : ${msg}`, 'error');
    } finally {
      URL.revokeObjectURL(localPreview);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadLogoFile(file);
    e.target.value = '';
  };

  const handleLogoDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadLogoFile(file);
  };

  const tabs = [
    { id: 'general', label: 'Informations générales', icon: Building },
    { id: 'documents', label: 'Modèles de documents', icon: FileText },
    { id: 'appearance', label: 'Apparence', icon: Palette },
    { id: 'modules', label: 'Modules / pages', icon: SlidersHorizontal },
  ];

  const hasUnsavedChanges = useMemo(
    () => Boolean(settings && JSON.stringify(settings) !== lastSavedSnapshot),
    [settings, lastSavedSnapshot]
  );
  const moduleCategories = useMemo(() => (settings ? buildSettingsModuleCategories(settings) : []), [settings]);

  if (loading || !settings) {
    return <PageSkeleton title="Paramètres" variant="form" />;
  }

  const supportsDocumentMode = 'document_mode' in settings;
  const displayName = isIndividualOwner
    ? settings.representant_nom || settings.nom_agence || getOwnerNameFallback()
    : settings.nom_agence || 'Agence non renseignée';
  const documentModeValue = settings.document_mode ?? (isIndividualOwner ? 'simple' : 'professional');
  const documentModeLabel = getDocumentModeLabel(documentModeValue);
  const documentPreferences = getDocumentPreferences(settings);
  const updateDocumentPreferences = (patch: Partial<NonNullable<AgencySettings['document_preferences']>>) => {
    setSettings({
      ...settings,
      document_preferences: {
        ...documentPreferences,
        ...patch,
      },
    });
  };
  const updateDocumentPrefix = (type: DocumentPreviewType, value: string) => {
    updateDocumentPreferences({
      prefixes: {
        ...(documentPreferences.prefixes ?? {}),
        [type]: value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12),
      },
    });
  };
  const toggleDocumentQr = (type: DocumentPreviewType) => {
    updateDocumentPreferences({
      qr_documents: {
        ...(documentPreferences.qr_documents ?? {}),
        [type]: !documentPreferences.qr_documents?.[type],
      },
    });
  };
  const toggleDocumentOption = (type: DocumentPreviewType, key: string) => {
    updateDocumentPreferences({
      document_options: {
        ...(documentPreferences.document_options ?? {}),
        [type]: {
          ...(documentPreferences.document_options?.[type] ?? {}),
          [key]: !documentPreferences.document_options?.[type]?.[key],
        },
      },
    });
  };
  const embeddedFieldClass =
    'h-8 w-full rounded-lg border border-emerald-950/10 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15';
  const embeddedTextareaClass =
    'min-h-[4.25rem] w-full rounded-lg border border-emerald-950/10 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15';
  const embeddedLabelClass = 'mb-1 block text-[0.56rem] font-black uppercase tracking-[0.14em] text-slate-500';

  if (embedded && !editingEmbedded) {
    return (
      <div className="space-y-2">
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <SettingsActionBar
          eyebrow="Lecture premium"
          title={activeTab === 'general'
            ? 'Synthèse organisation'
            : activeTab === 'documents'
              ? embeddedMode === 'documentsIdentity' ? 'Documents & identité' : 'Réglages documentaires'
              : activeTab === 'appearance'
                ? 'Identité visuelle'
                : 'Modules actifs'}
          description="Les informations restent modifiables sans changer la logique existante."
          actionLabel={activeTab === 'general' ? "Modifier l'organisation" : 'Modifier'}
          onAction={() => setEditingEmbedded(true)}
        />

        {activeTab === 'general' && (
          <div className="grid gap-2 lg:grid-cols-2">
            <SettingsInfoCard title="Identité" eyebrow={isIndividualOwner ? 'PROPRIÉTAIRE' : 'AGENCE'} icon={Building}>
              <InfoLine label="Nom" value={displayName} strong />
              <InfoLine label="Téléphone" value={formatSenegalPhone(settings.telephone, 'Non renseigné')} />
              <InfoLine label="Email" value={settings.email} />
              <InfoLine label="Adresse" value={settings.adresse} />
              <InfoLine label="Ville" value={settings.city} />
              <InfoLine label="Site web" value={settings.site_web} />
            </SettingsInfoCard>
            <SettingsInfoCard title="Informations légales" eyebrow="DOCUMENTS" icon={Landmark}>
              {!isIndividualOwner && <InfoLine label="NINEA" value={settings.ninea} strong />}
              {!isIndividualOwner && <InfoLine label="RC" value={settings.rc} />}
              <InfoLine label={isIndividualOwner ? 'Propriétaire' : 'Représentant'} value={settings.representant_nom || displayName} />
              <InfoLine label="Fonction" value={settings.representant_fonction} />
              <InfoLine label="Type pièce" value={settings.manager_id_type} />
              <InfoLine label="Numéro pièce" value={settings.manager_id_number} />
            </SettingsInfoCard>
            <div className="lg:col-span-2 rounded-xl border border-orange-200/70 bg-orange-50/60 px-2 py-1.5 text-[0.62rem] font-medium leading-[0.86rem] text-orange-900 sm:flex sm:items-center sm:gap-2">
              <p className="shrink-0 font-extrabold uppercase tracking-[0.08em]">Utilisation documentaire</p>
              <p className="mt-0.5 sm:mt-0">
                Ces informations apparaissent dans les contrats, mandats, quittances, rapports et documents générés.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="grid gap-2 lg:grid-cols-[minmax(0,0.95fr)_minmax(16rem,1.05fr)]">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <SettingsStatusCard label="Mode documentaire" value={documentModeLabel} icon={FileText} />
              <SettingsStatusCard label="QR Verify" value={settings.qr_code_quittances ? 'Actif' : 'Inactif'} icon={QrCode} />
              <SettingsStatusCard label="Logo" value={logoPreview ? 'Configuré' : 'À ajouter'} icon={Palette} />
              <SettingsStatusCard label="Couleurs" value={`${settings.couleur_primaire ?? '#F58220'} / ${settings.couleur_secondaire ?? '#333333'}`} icon={Sparkles} />
              <SettingsStatusCard label="Pénalités" value={`${settings.penalite_retard_montant ?? 0} F / jour`} icon={ShieldCheck} />
              <SettingsStatusCard label="Mis à jour" value={formatCompactDate(settings.updated_at)} icon={CheckCircle} />
            </div>
            <SettingsDocumentPreview
              title={displayName}
              logoUrl={logoPreview}
              logoPosition={settings.logo_position ?? 'left'}
              primary={settings.couleur_primaire ?? '#F58220'}
              secondary={settings.couleur_secondaire ?? '#333333'}
              tribunal={settings.mention_tribunal}
              footer={settings.pied_page_personnalise}
              qrEnabled={Boolean(settings.qr_code_quittances)}
              mode={documentModeLabel}
              selectedType={documentPreviewType}
              onSelectType={setDocumentPreviewType}
              preferences={documentPreferences}
            />
            <SettingsInfoCard title="Mentions configurées" eyebrow="REGISTRE" icon={FileText} className="lg:col-span-2">
              <InfoLine label="Tribunal" value={settings.mention_tribunal} multiline />
              <InfoLine label="Pied de page" value={settings.pied_page_personnalise} multiline />
              <InfoLine label="Frais huissier" value={`${settings.frais_huissier ?? 0} F CFA`} />
              <InfoLine label="Pénalités" value={settings.mention_penalites} multiline />
            </SettingsInfoCard>
            {embeddedMode === 'documentsIdentity' && (
              <SettingsInfoCard title="Identité visuelle" eyebrow="MARQUE" icon={Palette} className="lg:col-span-2">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <InfoLine label="Logo" value={logoPreview ? 'Logo configuré' : 'Logo à ajouter'} strong />
                    <InfoLine label="Position" value={settings.logo_position} />
                    <ColorLine label="Couleur primaire" value={settings.couleur_primaire ?? '#F58220'} />
                    <ColorLine label="Couleur secondaire" value={settings.couleur_secondaire ?? '#333333'} />
                  </div>
                  <div className="flex h-12 w-20 items-center justify-center rounded-xl border border-emerald-950/10 bg-[#fff8ed] p-2">
                    {logoPreview ? <SafeLogoImage src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain" /> : <Sparkles className="h-5 w-5 text-orange-600" />}
                  </div>
                </div>
              </SettingsInfoCard>
            )}
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="grid gap-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(16rem,1.1fr)]">
            <SettingsInfoCard title="Identité visuelle" eyebrow="MARQUE" icon={Palette}>
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-950/10 bg-white/80 p-2">
                <div className="flex h-9 w-14 items-center justify-center rounded-xl bg-[#fff8ed] p-1.5">
                  {logoPreview ? <SafeLogoImage src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain" /> : <Sparkles className="h-5 w-5 text-orange-600" />}
                </div>
                <div>
                  <p className="text-[0.66rem] font-extrabold text-slate-950">{logoPreview ? 'Logo chargé' : 'Logo à ajouter'}</p>
                  <p className="text-[0.58rem] font-semibold text-slate-500">Position : {settings.logo_position ?? 'left'}</p>
                </div>
              </div>
              <ColorLine label="Primaire" value={settings.couleur_primaire ?? '#F58220'} />
              <ColorLine label="Secondaire" value={settings.couleur_secondaire ?? '#333333'} />
            </SettingsInfoCard>
            <SettingsDocumentPreview
              title={displayName}
              logoUrl={logoPreview}
              logoPosition={settings.logo_position ?? 'left'}
              primary={settings.couleur_primaire ?? '#F58220'}
              secondary={settings.couleur_secondaire ?? '#333333'}
              tribunal={settings.mention_tribunal}
              footer={settings.pied_page_personnalise}
              qrEnabled={Boolean(settings.qr_code_quittances)}
              mode={documentModeLabel}
              selectedType={documentPreviewType}
              onSelectType={setDocumentPreviewType}
              preferences={documentPreferences}
            />
          </div>
        )}

        {activeTab === 'modules' && (
          <SettingsModulesOverview
            modules={moduleCategories}
          />
        )}
      </div>
    );
  }

  if (embedded && editingEmbedded) {
    const showDocumentsIdentity = activeTab === 'documents' && embeddedMode === 'documentsIdentity';

    return (
      <div className="space-y-2.5">
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <div className="flex flex-col gap-2 rounded-xl border border-emerald-950/10 bg-[#fffdf8]/92 px-2.5 py-2 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-emerald-700">
              {hasUnsavedChanges ? 'Modifications en attente' : 'Configuration à jour'}
            </p>
            <p className="truncate text-xs font-semibold text-slate-500">Édition compacte du Control Center.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <PremiumButton variant="secondary" size="sm" onClick={() => setEditingEmbedded(false)}>
              Revenir à l'aperçu
            </PremiumButton>
            <PremiumButton
              variant="create"
              size="sm"
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
              icon={saving ? <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" /> : <Save className="h-4 w-4" />}
            >
              {saving ? 'Enregistrement...' : !hasUnsavedChanges ? 'À jour' : 'Sauvegarder'}
            </PremiumButton>
          </div>
        </div>

        {activeTab === 'general' && (
          <section className="rounded-xl border border-emerald-950/10 bg-white/88 p-2.5 shadow-sm">
            <div className="mb-3 flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                <Building className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-emerald-700">Organisation</p>
                <h3 className="text-[0.82rem] font-extrabold text-slate-950">Modifier les informations officielles</h3>
              </div>
            </div>
            <div className="grid gap-2.5 md:grid-cols-2">
              <label>
                <span className={embeddedLabelClass}>{isIndividualOwner ? 'Nom document' : "Nom de l'agence"}</span>
                <input
                  type="text"
                  value={isIndividualOwner ? settings.representant_nom ?? settings.nom_agence ?? '' : settings.nom_agence ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSettings(isIndividualOwner
                      ? { ...settings, representant_nom: value, nom_agence: value }
                      : { ...settings, nom_agence: value });
                  }}
                  className={embeddedFieldClass}
                />
              </label>
              <label>
                <span className={embeddedLabelClass}>Téléphone</span>
                <input
                  type="text"
                  value={formatSenegalPhone(settings.telephone, '')}
                  onChange={(e) => setSettings({ ...settings, telephone: formatSenegalPhoneInput(e.target.value) })}
                  className={embeddedFieldClass}
                />
              </label>
              <label>
                <span className={embeddedLabelClass}>Email</span>
                <input type="email" value={settings.email ?? ''} onChange={(e) => setSettings({ ...settings, email: e.target.value })} className={embeddedFieldClass} />
              </label>
              <label>
                <span className={embeddedLabelClass}>Site web</span>
                <input type="url" value={settings.site_web ?? ''} onChange={(e) => setSettings({ ...settings, site_web: e.target.value })} className={embeddedFieldClass} />
              </label>
              <label className="md:col-span-2">
                <span className={embeddedLabelClass}>Adresse</span>
                <input type="text" value={settings.adresse ?? ''} onChange={(e) => setSettings({ ...settings, adresse: e.target.value })} className={embeddedFieldClass} />
              </label>
              <label>
                <span className={embeddedLabelClass}>Ville</span>
                <input type="text" value={settings.city ?? ''} onChange={(e) => setSettings({ ...settings, city: e.target.value })} className={embeddedFieldClass} />
              </label>
              {!isIndividualOwner && (
                <label>
                  <span className={embeddedLabelClass}>NINEA</span>
                  <input type="text" value={settings.ninea ?? ''} onChange={(e) => setSettings({ ...settings, ninea: e.target.value })} className={embeddedFieldClass} />
                </label>
              )}
              {!isIndividualOwner && (
                <label>
                  <span className={embeddedLabelClass}>RC</span>
                  <input type="text" value={settings.rc ?? ''} onChange={(e) => setSettings({ ...settings, rc: e.target.value })} className={embeddedFieldClass} />
                </label>
              )}
              {!isIndividualOwner && (
                <label>
                  <span className={embeddedLabelClass}>Représentant légal</span>
                  <input type="text" value={settings.representant_nom ?? ''} onChange={(e) => setSettings({ ...settings, representant_nom: e.target.value })} className={embeddedFieldClass} />
                </label>
              )}
              <label>
                <span className={embeddedLabelClass}>{isIndividualOwner ? 'Qualité' : 'Fonction'}</span>
                <input type="text" value={settings.representant_fonction ?? ''} onChange={(e) => setSettings({ ...settings, representant_fonction: e.target.value })} className={embeddedFieldClass} />
              </label>
              <label>
                <span className={embeddedLabelClass}>Type pièce</span>
                <select value={settings.manager_id_type ?? 'CNI'} onChange={(e) => setSettings({ ...settings, manager_id_type: e.target.value })} className={embeddedFieldClass}>
                  <option value="CNI">CNI</option>
                  <option value="Passeport">Passeport</option>
                  <option value="Carte consulaire">Carte consulaire</option>
                </select>
              </label>
              <label>
                <span className={embeddedLabelClass}>Numéro pièce</span>
                <input type="text" value={settings.manager_id_number ?? ''} onChange={(e) => setSettings({ ...settings, manager_id_number: e.target.value })} className={embeddedFieldClass} />
              </label>
            </div>
          </section>
        )}

        {showDocumentsIdentity && (
          <section className="grid gap-2.5 lg:grid-cols-[minmax(0,0.95fr)_minmax(18rem,1.05fr)]">
            <div className="rounded-xl border border-emerald-950/10 bg-white/88 p-2.5 shadow-sm">
              <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-emerald-700">Documents</p>
              <h3 className="mt-0.5 text-[0.82rem] font-extrabold text-slate-950">Réglages documentaires</h3>
              <div className="mt-2.5 grid gap-2.5">
                {supportsDocumentMode && (
                  <label>
                    <span className={embeddedLabelClass}>Mode documentaire</span>
                    <select
                      value={settings.document_mode ?? (isIndividualOwner ? 'simple' : 'professional')}
                      onChange={(e) => setSettings({ ...settings, document_mode: e.target.value as AgencySettings['document_mode'] })}
                      className={embeddedFieldClass}
                    >
                      <option value="simple">Simple</option>
                      <option value="professional">Professionnel</option>
                      <option value="legal">Juridique renforcé</option>
                    </select>
                  </label>
                )}
                <label>
                  <span className={embeddedLabelClass}>Tribunal compétent</span>
                  <input type="text" value={settings.mention_tribunal ?? ''} onChange={(e) => setSettings({ ...settings, mention_tribunal: e.target.value })} className={embeddedFieldClass} />
                </label>
                <label>
                  <span className={embeddedLabelClass}>Pied de page</span>
                  <input type="text" value={settings.pied_page_personnalise ?? ''} onChange={(e) => setSettings({ ...settings, pied_page_personnalise: e.target.value })} className={embeddedFieldClass} />
                </label>
                <label>
                  <span className={embeddedLabelClass}>Texte pénalités</span>
                  <textarea value={settings.mention_penalites ?? ''} onChange={(e) => setSettings({ ...settings, mention_penalites: e.target.value })} className={embeddedTextareaClass} />
                </label>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <label>
                    <span className={embeddedLabelClass}>Frais huissier</span>
                    <input type="number" value={settings.frais_huissier ?? 0} onChange={(e) => setSettings({ ...settings, frais_huissier: Number(e.target.value) })} className={embeddedFieldClass} />
                  </label>
                  <label>
                    <span className={embeddedLabelClass}>Pénalité / jour</span>
                    <input type="number" value={settings.penalite_retard_montant ?? 0} onChange={(e) => setSettings({ ...settings, penalite_retard_montant: Number(e.target.value) })} className={embeddedFieldClass} />
                  </label>
                  <label>
                    <span className={embeddedLabelClass}>Délai</span>
                    <input type="number" value={settings.penalite_retard_delai_jours ?? 0} onChange={(e) => setSettings({ ...settings, penalite_retard_delai_jours: Number(e.target.value) })} className={embeddedFieldClass} />
                  </label>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label>
                    <span className={embeddedLabelClass}>Style d'entête</span>
                    <select
                      value={documentPreferences.header_style ?? 'institutionnel'}
                      onChange={(event) => updateDocumentPreferences({ header_style: event.target.value as NonNullable<AgencySettings['document_preferences']>['header_style'] })}
                      className={embeddedFieldClass}
                    >
                      <option value="institutionnel">Institutionnel</option>
                      <option value="sobriete">Sobriété</option>
                      <option value="moderne">Moderne</option>
                    </select>
                  </label>
                  <label>
                    <span className={embeddedLabelClass}>Numérotation</span>
                    <select
                      value={documentPreferences.numbering_format ?? 'Q-YYYY-0001'}
                      onChange={(event) => updateDocumentPreferences({ numbering_format: event.target.value as NonNullable<AgencySettings['document_preferences']>['numbering_format'] })}
                      className={embeddedFieldClass}
                    >
                      <option value="Q-YYYY-0001">Q-YYYY-0001</option>
                      <option value="SK-Q-0001">SK-Q-0001</option>
                      <option value="AGENCE-YYYY-0001">AGENCE-YYYY-0001</option>
                    </select>
                  </label>
                </div>
                <div className="rounded-xl border border-emerald-950/10 bg-[#fffdf8] p-2">
                  <p className="text-[0.52rem] font-black uppercase tracking-[0.12em] text-slate-500">Préfixes et QR</p>
                  <div className="mt-2 grid gap-1.5">
                    {(Object.keys(DOCUMENT_PREVIEWS) as DocumentPreviewType[]).map((type) => (
                      <div key={type} className="grid grid-cols-[minmax(0,1fr)_4rem_auto] items-center gap-1.5">
                        <span className="truncate text-[0.62rem] font-extrabold text-slate-700">{DOCUMENT_PREVIEWS[type].label}</span>
                        <input
                          value={documentPreferences.prefixes?.[type] ?? ''}
                          onChange={(event) => updateDocumentPrefix(type, event.target.value)}
                          className="h-7 rounded-lg border border-emerald-950/10 bg-white px-2 text-[0.62rem] font-black uppercase text-slate-800 outline-none focus:ring-2 focus:ring-emerald-700/15"
                        />
                        <button
                          type="button"
                          onClick={() => toggleDocumentQr(type)}
                          className={`h-7 rounded-lg px-2 text-[0.52rem] font-black uppercase tracking-[0.08em] ring-1 transition ${
                            documentPreferences.qr_documents?.[type] !== false
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : 'bg-slate-50 text-slate-500 ring-slate-200'
                          }`}
                        >
                          QR
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className={embeddedLabelClass}>Texte QR</span>
                    <input
                      type="text"
                      value={documentPreferences.qr_text ?? ''}
                      onChange={(event) => updateDocumentPreferences({ qr_text: event.target.value })}
                      className={embeddedFieldClass}
                    />
                  </label>
                  <label>
                    <span className={embeddedLabelClass}>Notice quittance</span>
                    <input
                      type="text"
                      value={documentPreferences.receipt_notice ?? ''}
                      onChange={(event) => updateDocumentPreferences({ receipt_notice: event.target.value })}
                      className={embeddedFieldClass}
                    />
                  </label>
                  <label>
                    <span className={embeddedLabelClass}>Notice paiement</span>
                    <input
                      type="text"
                      value={documentPreferences.payment_notice ?? ''}
                      onChange={(event) => updateDocumentPreferences({ payment_notice: event.target.value })}
                      className={embeddedFieldClass}
                    />
                  </label>
                </div>
                <div className="rounded-xl border border-emerald-950/10 bg-[#fffdf8] p-2">
                  <p className="text-[0.52rem] font-black uppercase tracking-[0.12em] text-slate-500">Options du document aperçu</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(documentPreferences.document_options?.[documentPreviewType] ?? {}).map(([key, enabled]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleDocumentOption(documentPreviewType, key)}
                        className={`rounded-full px-2 py-1 text-[0.52rem] font-black uppercase tracking-[0.08em] ring-1 transition ${
                          enabled
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-slate-50 text-slate-500 ring-slate-200'
                        }`}
                      >
                        {getDocumentOptionLabel(key)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="rounded-xl border border-emerald-950/10 bg-white/88 p-2.5 shadow-sm">
                <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-emerald-700">Identité visuelle</p>
                <h3 className="mt-0.5 text-[0.82rem] font-extrabold text-slate-950">Logo et couleurs</h3>
                <div className="mt-2.5 grid gap-2.5">
                  <label className="block" onDrop={handleLogoDrop} onDragOver={(e) => e.preventDefault()}>
                    <span className={embeddedLabelClass}>{isIndividualOwner ? 'Logo ou signature' : "Logo de l'agence"}</span>
                    <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-emerald-950/15 bg-[#fffdf8] p-2.5">
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <div className="flex h-11 w-16 items-center justify-center rounded-xl bg-white p-2 shadow-sm">
                        {logoPreview ? <SafeLogoImage src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain" /> : <Upload className="h-5 w-5 text-emerald-800" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.72rem] font-extrabold text-slate-950">{logoUploadState === 'uploading' ? 'Upload en cours...' : 'Cliquer ou déposer un logo'}</p>
                        <p className="text-[0.62rem] font-semibold text-slate-500">PNG, SVG, JPG, WEBP jusqu'à 5 Mo.</p>
                      </div>
                    </div>
                  </label>
                  <label>
                    <span className={embeddedLabelClass}>Position logo</span>
                    <select value={settings.logo_position ?? 'left'} onChange={(e) => setSettings({ ...settings, logo_position: e.target.value as AgencySettings['logo_position'] })} className={embeddedFieldClass}>
                      <option value="left">Gauche</option>
                      <option value="center">Centre</option>
                      <option value="right">Droite</option>
                    </select>
                  </label>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <label>
                      <span className={embeddedLabelClass}>Couleur primaire</span>
                      <div className="flex gap-2">
                        <input type="color" value={settings.couleur_primaire ?? '#F58220'} onChange={(e) => setSettings({ ...settings, couleur_primaire: e.target.value })} className="h-10 w-12 rounded-xl border border-emerald-950/10 bg-white p-1" />
                        <input type="text" value={settings.couleur_primaire ?? '#F58220'} onChange={(e) => setSettings({ ...settings, couleur_primaire: e.target.value })} className={embeddedFieldClass} />
                      </div>
                    </label>
                    <label>
                      <span className={embeddedLabelClass}>Couleur secondaire</span>
                      <div className="flex gap-2">
                        <input type="color" value={settings.couleur_secondaire ?? '#333333'} onChange={(e) => setSettings({ ...settings, couleur_secondaire: e.target.value })} className="h-10 w-12 rounded-xl border border-emerald-950/10 bg-white p-1" />
                        <input type="text" value={settings.couleur_secondaire ?? '#333333'} onChange={(e) => setSettings({ ...settings, couleur_secondaire: e.target.value })} className={embeddedFieldClass} />
                      </div>
                    </label>
                  </div>
                </div>
              </div>
              <SettingsDocumentPreview
                title={displayName}
                logoUrl={logoPreview}
                logoPosition={settings.logo_position ?? 'left'}
                primary={settings.couleur_primaire ?? '#F58220'}
                secondary={settings.couleur_secondaire ?? '#333333'}
                tribunal={settings.mention_tribunal}
                footer={settings.pied_page_personnalise}
                qrEnabled={Boolean(settings.qr_code_quittances)}
                mode={documentModeLabel}
                selectedType={documentPreviewType}
                onSelectType={setDocumentPreviewType}
                preferences={documentPreferences}
              />
            </div>
          </section>
        )}

        {activeTab === 'modules' && (
          <section className="rounded-xl border border-emerald-950/10 bg-white/88 p-2.5 shadow-sm">
            <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-emerald-700">Modules & navigation</p>
            <h3 className="mt-0.5 text-[0.82rem] font-extrabold text-slate-950">Matrice de navigation</h3>
            <p className="mt-0.5 text-[0.66rem] leading-4 text-slate-600">
              Les interrupteurs ci-dessous sont uniquement affichés pour les modules déjà reliés aux réglages agence.
            </p>
            <div className="mt-2.5">
              <SettingsModulesOverview
                modules={moduleCategories}
                onToggle={(target) => setSettings(updateModuleToggle(settings, target))}
              />
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className={embedded ? 'space-y-4 sm:space-y-5' : 'space-y-4 px-4 py-4 sm:space-y-5 sm:px-0 sm:py-0'}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {!embedded && (
      <PremiumPageHeader
        density="compact"
        eyebrow="PARAMÈTRES AGENCE"
        title={isIndividualOwner ? 'Paramètres du compte' : 'Paramètres'}
        description={isIndividualOwner
          ? 'Personnalisez vos documents et votre identité propriétaire.'
          : "Personnalisez vos documents et l'identité de votre agence."}
        mobileDescription={hasUnsavedChanges ? 'Modifications en attente.' : 'Paramètres à jour.'}
        primaryAction={
          <PremiumButton
            variant="create"
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            icon={saving ? <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" /> : <Save className="h-4 w-4" />}
          >
            {saving ? 'Enregistrement...' : !hasUnsavedChanges ? 'À jour' : 'Sauvegarder'}
          </PremiumButton>
        }
      />
      )}

      {embedded && (
        <div className="flex flex-col gap-2 rounded-2xl border border-emerald-950/10 bg-[#fffdf8]/92 px-3 py-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-emerald-700">
              {hasUnsavedChanges ? 'Modifications en attente' : 'Configuration à jour'}
            </p>
            <p className="truncate text-xs font-semibold text-slate-500">
              Les changements sont appliqués uniquement après sauvegarde.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <PremiumButton variant="secondary" size="sm" onClick={() => setEditingEmbedded(false)}>
              Revenir à l'aperçu
            </PremiumButton>
            <PremiumButton
              variant="create"
              size="sm"
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
              icon={saving ? <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" /> : <Save className="h-4 w-4" />}
            >
              {saving ? 'Enregistrement...' : !hasUnsavedChanges ? 'À jour' : 'Sauvegarder'}
            </PremiumButton>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {!embedded && (
        <div className="border-b border-slate-200">
          <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide sm:gap-4 sm:px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors sm:px-4 sm:py-4 ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        )}

        <div className={embedded ? 'p-3 sm:p-4' : 'p-4 sm:p-6'}>
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {isIndividualOwner ? 'Nom affiché sur les documents' : "Nom de l'agence"}
                  </label>
                  <input aria-label="Champ de saisie"
                    type="text"
                    value={isIndividualOwner ? settings.representant_nom ?? settings.nom_agence ?? '' : settings.nom_agence ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSettings(isIndividualOwner
                        ? { ...settings, representant_nom: value, nom_agence: value }
                        : { ...settings, nom_agence: value });
                    }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  {isIndividualOwner && (
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Ce nom sert aussi de nom affiché sur les documents propriétaire.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Téléphone
                  </label>
                  <input aria-label="Champ de saisie"
                    type="text"
                    value={formatSenegalPhone(settings.telephone, '')}
                    onChange={(e) => setSettings({ ...settings, telephone: formatSenegalPhoneInput(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input aria-label="Champ de saisie"
                    type="email"
                    value={settings.email ?? ''}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Site web
                  </label>
                  <input
                    type="url"
                    value={settings.site_web ?? ''}
                    onChange={(e) => setSettings({ ...settings, site_web: e.target.value })}
                    placeholder="https://www.example.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Adresse</label>
                  <input aria-label="Champ de saisie"
                    type="text"
                    value={settings.adresse ?? ''}
                    onChange={(e) => setSettings({ ...settings, adresse: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {!isIndividualOwner && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">NINEA</label>
                  <input aria-label="Champ de saisie"
                    type="text"
                    value={settings.ninea ?? ''}
                    onChange={(e) => setSettings({ ...settings, ninea: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                )}

                {!isIndividualOwner && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Registre de Commerce (RC)
                  </label>
                  <input aria-label="Champ de saisie"
                    type="text"
                    value={settings.rc ?? ''}
                    onChange={(e) => setSettings({ ...settings, rc: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                )}

                {!isIndividualOwner && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {isIndividualOwner ? 'Nom du propriétaire' : 'Nom du représentant'}
                  </label>
                  <input aria-label="Champ de saisie"
                    type="text"
                    value={settings.representant_nom ?? ''}
                    onChange={(e) => setSettings({ ...settings, representant_nom: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {isIndividualOwner ? 'Qualité sur les documents' : 'Fonction du représentant'}
                  </label>
                  <input
                    type="text"
                    value={settings.representant_fonction ?? ''}
                    onChange={(e) =>
                      setSettings({ ...settings, representant_fonction: e.target.value })
                    }
                    placeholder={isIndividualOwner ? 'ex: Propriétaire' : 'ex: Gérant, Directeur'}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {isIndividualOwner ? "Type de pièce d'identité" : "Type de pièce d'identité du représentant"}
                  </label>
                  <select aria-label="Sélection"
                    value={settings.manager_id_type ?? 'CNI'}
                    onChange={(e) =>
                      setSettings({ ...settings, manager_id_type: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="CNI">CNI (Carte Nationale d'Identité)</option>
                    <option value="Passeport">Passeport</option>
                    <option value="Carte consulaire">Carte consulaire</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Numéro de pièce d'identité
                  </label>
                  <input
                    type="text"
                    value={settings.manager_id_number ?? ''}
                    onChange={(e) =>
                      setSettings({ ...settings, manager_id_number: e.target.value })
                    }
                    placeholder="ex: 1761198600458"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {isIndividualOwner ? 'Ville' : "Ville de l'agence"}
                  </label>
                  <input
                    type="text"
                    value={settings.city ?? ''}
                    onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                    placeholder="ex: Dakar, Thiès, Saint-Louis"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-6">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium mb-1">
                      {isIndividualOwner ? 'Informations propriétaire' : 'Informations du représentant légal'}
                    </p>
                    <p className="text-orange-700">
                      {isIndividualOwner
                        ? "Ces informations apparaîtront dans les contrats et quittances. Aucun mandat de gérance n'est nécessaire pour vos propres biens."
                        : "Ces informations apparaîtront dans les contrats de location et mandats de gérance. Assurez-vous qu'elles sont exactes et à jour."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-6">
              {supportsDocumentMode && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <label className="block text-sm font-black text-emerald-950 mb-2">
                    Mode documentaire
                  </label>
                  <select aria-label="Sélection"
                    value={settings.document_mode ?? (isIndividualOwner ? 'simple' : 'professional')}
                    onChange={(e) => setSettings({ ...settings, document_mode: e.target.value as AgencySettings['document_mode'] })}
                    className="w-full px-4 py-2 border border-emerald-200 bg-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="simple">Simple - propriétaire individuel</option>
                    <option value="professional">Professionnel - agence ou cabinet</option>
                    <option value="legal">Juridique renforcé</option>
                  </select>
                  <p className="mt-2 text-xs leading-5 text-emerald-800">
                    Ce réglage prépare les variantes de documents sans modifier vos règles métier.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tribunal compétent
                </label>
                <input aria-label="Champ de saisie"
                  type="text"
                  value={settings.mention_tribunal ?? ''}
                  onChange={(e) => setSettings({ ...settings, mention_tribunal: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Texte des pénalités de retard
                </label>
                <textarea aria-label="Zone de texte"
                  value={settings.mention_penalites ?? ''}
                  onChange={(e) =>
                    setSettings({ ...settings, mention_penalites: e.target.value })
                  }
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Pied de page des documents
                </label>
                <input aria-label="Champ de saisie"
                  type="text"
                  value={settings.pied_page_personnalise ?? ''}
                  onChange={(e) =>
                    setSettings({ ...settings, pied_page_personnalise: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Frais d'huissier (F CFA)
                  </label>
                  <input aria-label="Champ de saisie"
                    type="number"
                    value={settings.frais_huissier ?? 0}
                    onChange={(e) =>
                      setSettings({ ...settings, frais_huissier: Number(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Pénalité par jour (F CFA)
                  </label>
                  <input aria-label="Champ de saisie"
                    type="number"
                    value={settings.penalite_retard_montant ?? 0}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        penalite_retard_montant: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Délai pénalités (jours)
                  </label>
                  <input aria-label="Champ de saisie"
                    type="number"
                    value={settings.penalite_retard_delai_jours ?? 0}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        penalite_retard_delai_jours: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Variables disponibles dans les documents</p>
                    <p className="text-blue-700">
                      {isIndividualOwner
                        ? 'Ces paramètres sont automatiquement utilisés dans vos contrats, quittances et factures générés par le système.'
                        : 'Tous ces paramètres sont automatiquement utilisés dans les contrats, mandats et factures générés par le système.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  {isIndividualOwner ? 'Logo ou signature visuelle' : "Logo de l'agence"}
                </label>
                <div className="flex items-start gap-6">
                  <div className="flex-1">
                    <label
                      className="block"
                      onDrop={handleLogoDrop}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      <div className="group rounded-2xl border border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-orange-50/60 p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-100/60 sm:p-8">
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-800 shadow-lg shadow-emerald-100 ring-1 ring-emerald-100 transition-transform group-hover:scale-105">
                          {logoUploadState === 'uploading' ? (
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-200 border-t-orange-500" />
                          ) : (
                            <Upload className="h-7 w-7" />
                          )}
                        </div>
                        <p className="mb-1 text-sm font-black text-slate-900">
                          {logoUploadState === 'uploading'
                            ? 'Upload du logo en cours...'
                            : 'Glissez le logo ici ou cliquez pour uploader'}
                        </p>
                        <p className="text-xs font-medium text-slate-500">
                          PNG, SVG, JPG, WEBP jusqu'à 2 Mo
                        </p>
                      </div>
                    </label>
                  </div>

                  {logoPreview && (
                    <div className="flex-shrink-0">
                      <p className="text-sm font-medium text-slate-700 mb-2">Aperçu</p>
                      <div className="flex h-32 w-48 items-center justify-center rounded-2xl border border-emerald-100 bg-[radial-gradient(circle_at_top,#ecfdf5,white_55%,#fff7ed)] p-4 shadow-inner">
                        <SafeLogoImage
                          src={logoPreview}
                          alt="Logo agence"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Position du logo dans les documents
                </label>
                <div className="flex gap-4">
                  {(['left', 'center', 'right'] as const).map((position) => (
                    <button
                      key={position}
                      onClick={() => setSettings({ ...settings, logo_position: position })}
                      className={`flex-1 px-4 py-3 border-2 rounded-lg transition-colors ${
                        settings.logo_position === position
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {position === 'left' && 'Gauche'}
                      {position === 'center' && 'Centre'}
                      {position === 'right' && 'Droite'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Couleur primaire
                  </label>
                  <div className="flex gap-3">
                    <input aria-label="Champ de saisie"
                      type="color"
                      value={settings.couleur_primaire ?? '#F58220'}
                      onChange={(e) =>
                        setSettings({ ...settings, couleur_primaire: e.target.value })
                      }
                      className="w-20 h-12 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <input aria-label="Champ de saisie"
                      type="text"
                      value={settings.couleur_primaire ?? '#F58220'}
                      onChange={(e) =>
                        setSettings({ ...settings, couleur_primaire: e.target.value })
                      }
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Couleur secondaire
                  </label>
                  <div className="flex gap-3">
                    <input aria-label="Champ de saisie"
                      type="color"
                      value={settings.couleur_secondaire ?? '#333333'}
                      onChange={(e) =>
                        setSettings({ ...settings, couleur_secondaire: e.target.value })
                      }
                      className="w-20 h-12 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <input aria-label="Champ de saisie"
                      type="text"
                      value={settings.couleur_secondaire ?? '#333333'}
                      onChange={(e) =>
                        setSettings({ ...settings, couleur_secondaire: e.target.value })
                      }
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium mb-1">Personnalisation de l'identité visuelle</p>
                    <p className="text-green-700">
                      Ces couleurs seront utilisées dans les en-têtes de vos documents (contrats,
                      mandats, factures) pour refléter votre identité de marque.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'modules' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-950/10 bg-[#fffdf8] p-4 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                      Modules visibles
                    </p>
                    <h3 className="mt-1 text-lg font-black text-slate-950">Gestion modules/pages</h3>
                    <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600">
                      Activez uniquement les espaces utiles à votre agence. Les pages désactivées
                      disparaissent de la navigation et deviennent inaccessibles aux rôles standards.
                    </p>
                  </div>
                  <SlidersHorizontal className="h-5 w-5 text-orange-600" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    key: 'module_depenses_actif',
                    title: 'Dépenses',
                    desc: 'Suivi des charges, dépenses bailleurs et justificatifs.',
                  },
                  {
                    key: 'module_inventaires_actif',
                    title: 'États des lieux',
                    desc: 'Inventaires, entrées, sorties et documents associés.',
                  },
                  {
                    key: 'module_interventions_actif',
                    title: 'Maintenance',
                    desc: 'Demandes d’intervention, suivi technique et priorités.',
                  },
                  {
                    key: 'mode_avance_actif',
                    title: 'Mode avancé',
                    desc: 'Options expertes pour équipes structurées et workflow complet.',
                  },
                ].map((module) => {
                  const key = module.key as keyof Pick<
                    SettingsState,
                    | 'module_depenses_actif'
                    | 'module_inventaires_actif'
                    | 'module_interventions_actif'
                    | 'mode_avance_actif'
                  >;
                  const enabled = Boolean(settings[key]);

                  return (
                    <button
                      key={module.key}
                      type="button"
                      onClick={() => setSettings({ ...settings, [key]: !enabled })}
                      className={`rounded-2xl border p-3 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                        enabled
                          ? 'border-emerald-200 bg-emerald-50/70'
                          : 'border-slate-200 bg-white shadow-slate-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-950">{module.title}</h4>
                          <p className="mt-1 text-xs leading-5 text-slate-600">{module.desc}</p>
                        </div>
                        <span
                          className={`relative mt-0.5 inline-flex h-6 w-10 flex-shrink-0 rounded-full p-1 transition-colors ${
                            enabled ? 'bg-emerald-700' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                              enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </span>
                      </div>
                      <p
                        className={`mt-2 text-[0.62rem] font-black uppercase tracking-[0.16em] ${
                          enabled ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {enabled ? 'Actif' : 'Masqué'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsActionBar({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section className="flex flex-col gap-1.5 rounded-xl border border-emerald-950/10 bg-[#fffdf8]/92 p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[0.46rem] font-black uppercase tracking-[0.14em] text-emerald-700">{eyebrow}</p>
        <h2 className="mt-0.5 text-[0.76rem] font-extrabold text-slate-950">{title}</h2>
        <p className="mt-0.5 text-[0.64rem] leading-[0.88rem] text-slate-600">{description}</p>
      </div>
      <PremiumButton variant="secondary" size="sm" onClick={onAction} icon={<Edit3 className="h-3.5 w-3.5" />}>
        {actionLabel}
      </PremiumButton>
    </section>
  );
}

function SettingsInfoCard({
  title,
  eyebrow,
  icon: Icon,
  children,
  className = '',
}: {
  title: string;
  eyebrow: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`h-full rounded-xl border border-emerald-950/10 bg-white/88 p-2 shadow-sm ${className}`}>
      <div className="mb-1 flex items-center gap-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
          <Icon className="h-2.5 w-2.5" />
        </div>
        <div>
          <p className="text-[0.46rem] font-black uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p>
          <h3 className="text-[0.74rem] font-extrabold text-slate-950">{title}</h3>
        </div>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function InfoLine({ label, value, strong = false, multiline = false }: { label: string; value?: string | null; strong?: boolean; multiline?: boolean }) {
  const resolved = value && String(value).trim() ? String(value) : 'Non renseigné';
  return (
    <div className={`grid gap-2 py-0.5 ${multiline ? '' : 'sm:grid-cols-[5.75rem_minmax(0,1fr)] sm:items-center'}`}>
      <dt className="text-[0.58rem] font-bold text-slate-500">{label}</dt>
      <dd className={`${strong ? 'font-extrabold text-slate-950' : 'font-semibold text-slate-700'} min-w-0 text-[0.66rem] ${multiline ? 'leading-[0.9rem]' : 'truncate sm:text-right'}`} title={resolved}>
        {resolved}
      </dd>
    </div>
  );
}

function SettingsStatusCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-emerald-950/10 bg-white/88 p-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.46rem] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-0.5 truncate text-[0.66rem] font-extrabold text-slate-950" title={value}>{value}</p>
        </div>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
          <Icon className="h-2.5 w-2.5" />
        </div>
      </div>
    </div>
  );
}

function SafeLogoImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Sparkles className="h-5 w-5 text-orange-600" aria-hidden="true" />;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

function ColorLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2.5 py-1.5">
      <span className="text-[0.7rem] font-bold text-slate-500">{label}</span>
      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
        <span className="h-4 w-4 rounded-full border border-slate-200" style={{ backgroundColor: value }} />
        {value}
      </span>
    </div>
  );
}

function SettingsDocumentPreview({
  title,
  logoUrl,
  logoPosition,
  primary,
  secondary,
  tribunal,
  footer,
  qrEnabled,
  mode,
  selectedType,
  onSelectType,
  preferences,
}: {
  title: string;
  logoUrl?: string;
  logoPosition?: AgencySettings['logo_position'];
  primary: string;
  secondary: string;
  tribunal?: string | null;
  footer?: string | null;
  qrEnabled: boolean;
  mode: string;
  selectedType: DocumentPreviewType;
  onSelectType: (type: DocumentPreviewType) => void;
  preferences: NonNullable<AgencySettings['document_preferences']>;
}) {
  const preview = DOCUMENT_PREVIEWS[selectedType];
  const prefix = preferences.prefixes?.[selectedType] ?? preview.reference.split('-')[0];
  const reference = `${prefix}-${preview.reference.split('-').slice(1).join('-') || '2026-001'}`;
  const qrVisible = qrEnabled && preferences.qr_documents?.[selectedType] !== false;
  const headerStyleLabel = preferences.header_style === 'moderne'
    ? 'Moderne'
    : preferences.header_style === 'sobriete'
      ? 'Sobriété'
      : 'Institutionnel';
  const notice = selectedType === 'quittance'
    ? preferences.receipt_notice
    : selectedType === 'facture'
      ? preferences.payment_notice
      : preferences.confidentiality_notice;
  const optionEntries = Object.entries(preferences.document_options?.[selectedType] ?? {})
    .filter(([, enabled]) => Boolean(enabled))
    .slice(0, 6);
  const normalizedLogoPosition = logoPosition ?? 'left';
  const textOrder = normalizedLogoPosition === 'right' ? 'order-1' : 'order-2';
  const logoOrder = normalizedLogoPosition === 'right' ? 'order-2' : 'order-1';
  const headerLayout = normalizedLogoPosition === 'center'
    ? 'flex-col items-center text-center'
    : 'flex-row items-start justify-between';

  return (
    <section className="rounded-xl border border-emerald-950/10 bg-[#fffdf8] p-2 shadow-sm">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.46rem] font-black uppercase tracking-[0.14em] text-[#a45d12]">Aperçu document</p>
          <h3 className="mt-0.5 text-[0.72rem] font-extrabold text-slate-950">Rendu final par document</h3>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
          {(Object.keys(DOCUMENT_PREVIEWS) as DocumentPreviewType[]).map((type) => {
            const active = type === selectedType;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onSelectType(type)}
                className={[
                  'shrink-0 rounded-lg border px-1.5 py-0.5 text-[0.5rem] font-black uppercase tracking-[0.08em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20',
                  active ? 'border-emerald-800 bg-emerald-950 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-800/30',
                ].join(' ')}
              >
                {DOCUMENT_PREVIEWS[type].label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner">
        <div className={`flex gap-2 px-2.5 py-2 ${headerLayout}`} style={{ borderTop: `3px solid ${primary}` }}>
          <div className={`min-w-0 ${textOrder}`}>
            <p className="truncate text-[0.72rem] font-extrabold text-slate-950">{title}</p>
            <p className="text-[0.5rem] font-bold uppercase tracking-[0.12em]" style={{ color: secondary }}>
              {preview.title}
            </p>
            <p className="mt-0.5 text-[0.54rem] font-semibold text-slate-500">{preview.meta}</p>
          </div>
          <div className={`flex shrink-0 items-center gap-1.5 ${logoOrder}`}>
            {qrVisible && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800">
                <QrCode className="h-3.5 w-3.5" />
              </div>
            )}
            <div className="flex h-8 w-12 items-center justify-center rounded-lg bg-slate-50 p-1.5">
              {logoUrl ? <SafeLogoImage src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" /> : <FileText className="h-4 w-4 text-slate-400" />}
            </div>
          </div>
        </div>
        <div className="grid gap-1 px-2.5 py-2 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 px-1.5 py-1">
            <p className="text-[0.46rem] font-black uppercase tracking-[0.1em] text-slate-400">Référence</p>
            <p className="truncate text-[0.62rem] font-extrabold text-slate-800">{reference}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 px-1.5 py-1">
            <p className="text-[0.46rem] font-black uppercase tracking-[0.1em] text-emerald-700">Montant</p>
            <p className="truncate text-[0.62rem] font-extrabold text-emerald-900">{preview.amount}</p>
          </div>
          <div className="rounded-lg bg-orange-50 px-1.5 py-1">
            <p className="text-[0.46rem] font-black uppercase tracking-[0.1em] text-orange-700">Mode</p>
            <p className="truncate text-[0.62rem] font-extrabold text-orange-900">{headerStyleLabel} · {mode}</p>
          </div>
        </div>
        <div className="space-y-1 px-2.5 pb-2 text-[0.56rem] font-semibold text-slate-500">
          <div className="grid gap-1 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-100 bg-white px-1.5 py-1">
              <span className="text-slate-400">Émetteur</span>
              <p className="truncate font-extrabold text-slate-700">{title}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white px-1.5 py-1">
              <span className="text-slate-400">Vérification</span>
              <p className="truncate font-extrabold text-slate-700">{qrVisible ? 'QR public actif' : 'QR masqué'}</p>
            </div>
          </div>
          {optionEntries.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {optionEntries.map(([key]) => (
                <span key={key} className="rounded-full bg-slate-50 px-1.5 py-0.5 text-[0.48rem] font-black uppercase tracking-[0.08em] text-slate-500">
                  {getDocumentOptionLabel(key)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 px-2.5 py-1.5 text-[0.58rem] font-semibold leading-[0.84rem] text-slate-500">
          {notice && <p className="line-clamp-2 text-slate-600">{notice}</p>}
          <p className="truncate">Tribunal : {tribunal || 'Non renseigné'}</p>
          <p className="mt-1 truncate">Pied de page : {footer || 'Non renseigné'}</p>
        </div>
      </div>
    </section>
  );
}

function SettingsModulesOverview({
  modules,
  onToggle,
}: {
  modules: SettingsModuleCategory[];
  onToggle?: (target: ModuleToggleTarget) => void;
}) {
  const statusCopy: Record<SettingsModuleItem['status'], { label: string; className: string }> = {
    system: { label: 'Système', className: 'bg-slate-100 text-slate-600' },
    essential: { label: 'Essentiel', className: 'bg-emerald-50 text-emerald-700' },
    active: { label: 'Actif', className: 'bg-emerald-50 text-emerald-700' },
    inactive: { label: 'Masqué', className: 'bg-orange-50 text-orange-700' },
    prepared: { label: 'Préparé', className: 'bg-blue-50 text-blue-700' },
    plan: { label: 'Plan +', className: 'bg-violet-50 text-violet-700' },
  };

  return (
    <div className="space-y-2">
      <section className="rounded-xl border border-emerald-950/10 bg-gradient-to-br from-[#fffdf8] via-white to-emerald-50/45 p-2 shadow-sm">
        <p className="text-[0.46rem] font-black uppercase tracking-[0.14em] text-emerald-700">Modules & pages</p>
        <h2 className="mt-0.5 text-[0.76rem] font-extrabold text-slate-950">Workspace visible par domaine</h2>
        <p className="mt-0.5 max-w-2xl text-[0.62rem] leading-[0.86rem] text-slate-600">
          Les modules système restent actifs. Les modules optionnels utilisent les réglages existants quand ils sont réellement branchés.
        </p>
      </section>
      <div className="grid gap-2 xl:grid-cols-2">
        {modules.map((group) => {
          const activeCount = group.items.filter((item) => ['system', 'essential', 'active'].includes(item.status)).length;
          return (
          <section key={group.category} className="rounded-xl border border-emerald-950/10 bg-white/88 p-2 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-[0.72rem] font-extrabold text-slate-950">{group.category}</h3>
                <p className="truncate text-[0.56rem] font-semibold text-slate-500">{group.description}</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[0.5rem] font-black uppercase tracking-[0.1em] text-emerald-700">
                {activeCount}/{group.items.length}
              </span>
            </div>
            <div className="mt-1.5 grid gap-1">
              {group.items.map((item) => {
                const status = statusCopy[item.status];
                const toggleTarget = item.toggle ?? null;
                const canToggle = Boolean(onToggle && toggleTarget);
                return (
                  <div key={item.label} className="min-w-0 rounded-lg border border-slate-100 bg-[#fffdf8] px-1.5 py-1">
                    <div className="flex min-w-0 items-center justify-between gap-1.5">
                      <div className="min-w-0">
                        <span className="block truncate text-[0.64rem] font-extrabold text-slate-800">{item.label}</span>
                        <p className="truncate text-[0.56rem] font-medium text-slate-500" title={item.description}>
                          {item.description}
                        </p>
                        {item.impact && (
                          <p className="truncate text-[0.5rem] font-black uppercase tracking-[0.08em] text-slate-400" title={item.impact}>
                            {item.impact}
                          </p>
                        )}
                      </div>
                      {canToggle ? (
                        <button
                          type="button"
                          onClick={() => toggleTarget && onToggle?.(toggleTarget)}
                          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-1 py-0.5 text-[0.48rem] font-black uppercase tracking-[0.08em] text-slate-600 shadow-sm ring-1 ring-emerald-950/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20"
                          aria-pressed={item.status === 'active'}
                        >
                          <span className={`h-3 w-5 rounded-full p-0.5 transition-colors ${item.status === 'active' ? 'bg-emerald-700' : 'bg-slate-200'}`}>
                            <span className={`block h-2 w-2 rounded-full bg-white transition-transform ${item.status === 'active' ? 'translate-x-2' : 'translate-x-0'}`} />
                          </span>
                          {item.status === 'active' ? 'Actif' : 'Masqué'}
                        </button>
                      ) : (
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.46rem] font-black uppercase tracking-[0.1em] ${status.className}`}>
                          {status.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          );
        })}
      </div>
    </div>
  );
}
