import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  Upload,
  AlertCircle,
  AtSign,
  FileText,
  Palette,
  Building,
  CheckCircle,
  Globe2,
  Edit3,
  Landmark,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { AgencySettings, DEFAULT_AGENCY_SETTINGS } from '../types/agency';
import { ToastContainer } from '../components/ui/Toast';
import { PremiumButton } from '../components/ui/PremiumButton';
import { invalidateAgencySettingsCache } from '../lib/pdf';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { PageSkeleton } from '../components/ui/Skeleton';
import { OrganizationCompliancePanel } from '../components/settings/OrganizationCompliancePanel';
import { ensureE164, formatInternationalPhone, isValidInternationalPhone } from '../lib/formatters';
import { PhoneInput } from '../components/ui/PhoneInput';
import { formatSenegalCniInput, validateSenegalCni } from '../lib/senegalIdentity';
import {
  deleteAgencyIdentityAsset,
  resolveAgencySettingsAssets,
  uploadAgencyIdentityAsset,
  validateAgencyIdentityFile,
} from '../services/agencyIdentityAssets';
import { resolvePublishedDocumentTemplate } from '../services/documentTemplateService';
import { useDocumentPreviewPdf } from '../hooks/useDocumentPreviewPdf';
import { DocumentTemplatePreview } from '../components/documents/DocumentTemplatePreview';
import type { DocumentTemplateContent, DocumentTemplateType } from '../types/documentStudio';

type SettingsState = Omit<AgencySettings, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
};

type SettingsTab = 'general' | 'documents' | 'modules';
type EmbeddedMode = 'single' | 'documentsIdentity';
type LogoUploadState = 'idle' | 'preview' | 'uploading' | 'done';
type DocumentPreviewType = 'quittance' | 'contrat' | 'mandat' | 'rapport' | 'rapport_proprietaire';
type ModuleFieldToggleKey =
  | 'module_depenses_actif'
  | 'module_inventaires_actif'
  | 'module_interventions_actif'
  | 'mode_avance_actif'
  | 'qr_code_quittances'
  | 'email_notifications_actif'
  | 'sms_notifications_actif';
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

const LOGO_COMPRESSION_THRESHOLD = 1.4 * 1024 * 1024;
const LOGO_MAX_DIMENSION = 1200;

/** Libellés des types de document, réutilisés par la matrice de préfixes/QR et le sélecteur d'aperçu. */
const DOCUMENT_PREVIEWS: Record<DocumentPreviewType, { label: string }> = {
  quittance: { label: 'Quittance' },
  contrat: { label: 'Contrat' },
  mandat: { label: 'Mandat' },
  rapport: { label: 'Rapport bailleur' },
  rapport_proprietaire: { label: 'Rapport propriétaire' },
};

/** DocumentPreviewType 'rapport' (historique) correspond au type Studio 'rapport_bailleur'. */
const DOCUMENT_PREVIEW_TEMPLATE_TYPE: Record<DocumentPreviewType, DocumentTemplateType> = {
  quittance: 'quittance',
  contrat: 'contrat',
  mandat: 'mandat',
  rapport: 'rapport_bailleur',
  rapport_proprietaire: 'rapport_proprietaire',
};

function getDocumentModeLabel(mode?: AgencySettings['document_mode']) {
  if (mode === 'legal') return 'Juridique renforcé';
  if (mode === 'simple') return 'Simple';
  return 'Professionnel';
}

function formatCompactDate(value?: string | null) {
  if (!value) return 'Non renseigné';
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function cleanOptionalText(value?: string | null) {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

const NINEA_PATTERN = /^\d{7}\s?\d[A-Z]\d$/;
const RCCM_PATTERN = /^SN-[A-Z]{3}-\d{4}-[AB]-\d{1,7}$/;
const PASSPORT_PATTERN = /^(?:[A-Z]{2}\d{7}|[A-Z]\d{8})$/;

const FIELD_FORMAT_MESSAGES = {
  ninea: 'Le format du NINEA est incorrect. Exemple : 0012345 2G3.',
  rc: 'Le format du registre de commerce est incorrect. Exemple : SN-DKR-2026-B-12345.',
  passport: 'Le format du passeport est incorrect. Exemple : A01234567.',
};

function formatNineaInput(value: string) {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let normalized = '';
  for (const char of raw) {
    const index = normalized.length;
    if ((index <= 7 || index === 9) && /\d/.test(char)) {
      normalized += char;
    } else if (index === 8 && /[A-Z]/.test(char)) {
      normalized += char;
    }
    if (normalized.length >= 10) break;
  }
  return normalized.length > 7 ? `${normalized.slice(0, 7)} ${normalized.slice(7)}` : normalized;
}

function formatRccmInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const raw = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let cursor = raw.startsWith('SN') ? raw.slice(2) : raw;

  const city = cursor.replace(/[^A-Z]/g, '').slice(0, 3);
  cursor = cursor.slice(city.length);

  const year = cursor.replace(/\D/g, '').slice(0, 4);
  cursor = cursor.slice(year.length);

  const type = (cursor.match(/[AB]/)?.[0] ?? '').slice(0, 1);
  const typeIndex = type ? cursor.indexOf(type) + 1 : 0;
  cursor = typeIndex > 0 ? cursor.slice(typeIndex) : cursor;

  const order = cursor.replace(/\D/g, '').slice(0, 7);
  const parts = ['SN'];
  if (city) parts.push(city);
  if (year) parts.push(year);
  if (type) parts.push(type);
  if (order) parts.push(order);
  return parts.join('-');
}

function formatIdentityNumberInput(value: string, type?: string | null) {
  const normalizedType = (type ?? '').toLowerCase();
  if (normalizedType.includes('passeport')) {
    const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let result = '';
    for (const char of raw) {
      const index = result.length;
      if (index === 0 && /[A-Z]/.test(char)) {
        result += char;
      } else if (index === 1 && /[A-Z0-9]/.test(char)) {
        result += char;
      } else if (index >= 2 && /\d/.test(char)) {
        result += char;
      }
      if (result.length >= 9) break;
    }
    return result;
  }
  if (normalizedType.includes('cni')) {
    return formatSenegalCniInput(value);
  }
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
}

function validateNinea(value?: string | null) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) return null;
  return NINEA_PATTERN.test(cleaned) ? null : FIELD_FORMAT_MESSAGES.ninea;
}

function validateRccm(value?: string | null) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) return null;
  return RCCM_PATTERN.test(cleaned) ? null : FIELD_FORMAT_MESSAGES.rc;
}

function preventNonDigitKey(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key.length === 1 && !/^\d$/.test(event.key)) {
    event.preventDefault();
  }
}

function validateIdentityNumber(value?: string | null, type?: string | null, allowIncomplete = true) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) return null;
  const normalizedType = (type ?? '').toLowerCase();
  if (normalizedType.includes('cni')) {
    return validateSenegalCni(cleaned, allowIncomplete);
  }
  if (normalizedType.includes('passeport')) {
    return PASSPORT_PATTERN.test(cleaned) ? null : FIELD_FORMAT_MESSAGES.passport;
  }
  return null;
}

function getOrganizationTypeLabel(value: AgencySettings['organization_type'] | undefined, isIndividualOwner: boolean) {
  if (isIndividualOwner) return 'Bailleur individuel';
  switch (value) {
    case 'bailleur_individuel':
    case 'individual_landlord':
    case 'multi_property_landlord':
      return 'Bailleur individuel';
    case 'gestionnaire':
    case 'property_manager':
      return 'Cabinet / gestionnaire';
    case 'groupe':
    case 'group':
      return 'Groupe immobilier';
    case 'agence':
    case 'agency':
    default:
      return 'Agence immobilière';
  }
}

const DEFAULT_DOCUMENT_PREFERENCES: NonNullable<AgencySettings['document_preferences']> = {
  numbering_format: 'Q-YYYY-0001',
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
  receipt_notice: "Quittance émise sous réserve d'encaissement effectif.",
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
  couleur_secondaire: DEFAULT_AGENCY_SETTINGS.couleur_secondaire ?? '#D9AA5E',
  devise: DEFAULT_AGENCY_SETTINGS.devise ?? 'XOF',
  pied_page_personnalise: DEFAULT_AGENCY_SETTINGS.pied_page_personnalise ?? '',
  signature_url: null,
  stamp_url: null,
  signature_enabled: false,
  stamp_enabled: false,
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
    const configuredValue = enabledModules[key];
    if (fallback === false && configuredValue !== true) {
      return { status: 'prepared' };
    }
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
        { label: 'Reversements bailleurs', description: 'Montants à reverser et net propriétaire.', impact: 'Bailleurs', status: 'essential' },
        { label: 'Charges bailleur', description: 'Charges refacturables ou liées au rapport bailleur.', impact: 'Rapports bailleurs', status: 'essential' },
        { label: 'Dépenses agence', description: 'Dépenses opérationnelles internes et justificatifs.', impact: 'Sidebar finance', ...optional('module_depenses_actif', Boolean(settings.module_depenses_actif)) },
        { label: 'Commissions', description: 'Revenus agence et parts de gestion.', impact: 'Marge agence', ...moduleToggle('commissions') },
        { label: 'Exports finance', description: 'Exports, synthèses et pièces de contrôle.', impact: 'Direction', status: settings.mode_avance_actif ? 'active' : 'prepared' },
        { label: 'Rapports avancés', description: 'Synthèses, exports et lecture direction.', impact: 'Pilotage avancé', ...moduleToggle('advanced_reports', Boolean(settings.mode_avance_actif)) },
      ],
    },
    {
      category: 'Documents',
      description: 'GED, vérification publique et modèles.',
      items: [
        { label: 'GED', description: 'Coffre documentaire centralisé.', status: 'system' },
        { label: 'Quittances PDF', description: 'Quittances générées depuis les encaissements.', impact: 'Encaissements', status: 'essential' },
        { label: 'Contrats PDF', description: 'Contrats, mandats et rapports prêts à produire.', impact: 'Portefeuille', status: 'essential' },
        { label: 'QR Verify', description: 'Preuves publiques et vérification QR.', impact: 'Preuve publique', ...optional('qr_code_quittances', Boolean(settings.qr_code_quittances)) },
        { label: 'Scanner', description: 'Vérification rapide sur mobile.', impact: 'Contrôle terrain', ...moduleToggle('document_scanner') },
        { label: 'Modèles', description: 'Règles documentaires et mentions.', status: 'system' },
        { label: 'Signature / cachet', description: 'Identité officielle appliquée aux PDF.', impact: 'Contrats, mandats, rapports', status: settings.signature_url || settings.stamp_url ? 'active' : 'prepared' },
      ],
    },
    {
      category: 'Terrain',
      description: 'Opérations et suivi terrain.',
      items: [
        { label: 'États des lieux', description: 'Constats entrée, sortie et inventaires.', ...optional('module_inventaires_actif', Boolean(settings.module_inventaires_actif)) },
        { label: 'Maintenance', description: 'Demandes, interventions et priorités.', ...optional('module_interventions_actif', Boolean(settings.module_interventions_actif)) },
        { label: 'Planning', description: 'Opérations terrain et calendrier.', impact: 'Calendrier équipe', ...moduleToggle('planning', false) },
        { label: 'Visites et états', description: 'Suivi terrain léger pour les rendez-vous et contrôles.', impact: 'Mobile terrain', status: 'prepared' },
      ],
    },
    {
      category: 'Communication',
      description: 'Automatisation des échanges avec les bailleurs et locataires.',
      items: [
        { 
          label: 'Emails transactionnels', 
          description: 'Envoi automatisé des quittances, reçus et rapports.', 
          impact: 'Email', 
          ...optional('email_notifications_actif', Boolean(settings.email_notifications_actif)) 
        },
        { 
          label: 'Alertes SMS', 
          description: 'Relances de loyers et alertes d\'impayés via Orange SMS.', 
          impact: 'SMS', 
          ...optional('sms_notifications_actif', Boolean(settings.sms_notifications_actif)) 
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

async function compressLogoFile(file: File): Promise<File> {
  if (file.size <= LOGO_COMPRESSION_THRESHOLD) {
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
  const navigate = useNavigate();
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
  const [signaturePreview, setSignaturePreview] = useState<string>('');
  const [signatureUploadState, setSignatureUploadState] = useState<LogoUploadState>('idle');
  const [stampPreview, setStampPreview] = useState<string>('');
  const [stampUploadState, setStampUploadState] = useState<LogoUploadState>('idle');
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
        const resolved = await resolveAgencySettingsAssets(nextSettings);
        setLogoPreview(resolved.logo_url ?? '');
        setSignaturePreview(resolved.signature_url ?? '');
        setStampPreview(resolved.stamp_url ?? '');
      } else {
        const created = await createDefaultSettings(agencyId);
        if (created) {
          setSettings(created as SettingsState);
          setLastSavedSnapshot(JSON.stringify(created));
          const resolved = await resolveAgencySettingsAssets(created);
          setLogoPreview(resolved.logo_url ?? '');
          setSignaturePreview(resolved.signature_url ?? '');
          setStampPreview(resolved.stamp_url ?? '');
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
        telephone: ensureE164(agency?.phone ?? ''),
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
      const cleanedEmail = cleanOptionalText(settings.email)?.toLowerCase() ?? '';
      const cleanedWebsite = cleanOptionalText(settings.site_web) ?? '';
      const normalizedPhone = settings.telephone ? ensureE164(settings.telephone) : null;
      const officialName = isIndividualOwner
        ? cleanOptionalText(settings.representant_nom || settings.nom_agence)
        : cleanOptionalText(settings.nom_agence);
      if (!officialName) {
        showToast(isIndividualOwner ? 'Le nom du profil propriétaire est obligatoire.' : "Le nom de l'agence est obligatoire.", 'error');
        setSaving(false);
        return;
      }
      if (settings.telephone && !isValidInternationalPhone(normalizedPhone)) {
        showToast('Le téléphone doit être un numéro valide, par exemple 77 123 45 67.', 'error');
        setSaving(false);
        return;
      }
      if (cleanedEmail && !isValidEmail(cleanedEmail)) {
        showToast("L'email doit être valide, par exemple contact@agence.sn.", 'error');
        setSaving(false);
        return;
      }
      const nineaValidationError = isIndividualOwner ? null : validateNinea(settings.ninea);
      const rccmValidationError = isIndividualOwner ? null : validateRccm(settings.rc);
      const identityValidationError = validateIdentityNumber(settings.manager_id_number, settings.manager_id_type, false);
      if (nineaValidationError || rccmValidationError || identityValidationError) {
        showToast(nineaValidationError || rccmValidationError || identityValidationError || 'Vérifiez les identifiants officiels.', 'error');
        setSaving(false);
        return;
      }
      const ownerNameForDocuments = isIndividualOwner
        ? officialName
        : '';
      const normalizedManagerIdType = cleanOptionalText(settings.manager_id_type) ?? 'CNI';
      const dataToSave: Omit<AgencySettings, 'created_at' | 'updated_at'> = {
        agency_id: profile.agency_id,
        nom_agence: isIndividualOwner ? ownerNameForDocuments : officialName,
        adresse: cleanOptionalText(settings.adresse) ?? '',
        telephone: normalizedPhone ?? '',
        email: cleanedEmail,
        site_web: cleanedWebsite,
        ninea: formatNineaInput(settings.ninea ?? ''),
        rc: formatRccmInput(settings.rc ?? ''),
        representant_nom: isIndividualOwner ? ownerNameForDocuments : cleanOptionalText(settings.representant_nom) ?? '',
        representant_fonction: cleanOptionalText(settings.representant_fonction) ?? 'Gérant',
        manager_id_type: normalizedManagerIdType,
        manager_id_number: formatIdentityNumberInput(settings.manager_id_number ?? '', normalizedManagerIdType),
        city: cleanOptionalText(settings.city) ?? 'Dakar',
        logo_url: settings.logo_url ?? '',
        logo_position: settings.logo_position ?? 'left',
        couleur_primaire: settings.couleur_primaire ?? '#F58220',
        couleur_secondaire: settings.couleur_secondaire ?? '#D9AA5E',
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
        stamp_url: settings.stamp_url ?? null,
        signature_enabled: settings.signature_enabled ?? false,
        stamp_enabled: settings.stamp_enabled ?? false,
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
      if ('organization_type' in settings) {
        dataToSave.organization_type = settings.organization_type;
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
      setLogoPreview(savedData.logo_url ?? '');
      setSignaturePreview(savedData.signature_url ?? '');
      setStampPreview(savedData.stamp_url ?? '');
      invalidateAgencySettingsCache(profile.agency_id);
      showToast('Paramètres enregistrés avec succès', 'success');
      if (embedded) {
        setEditingEmbedded(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      console.error('Erreur sauvegarde paramètres:', msg);
      showToast(`Erreur : ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadIdentityAsset = async (
    kind: 'logo' | 'signature' | 'stamp',
    file: File,
    previousPreview: string,
    setPreview: React.Dispatch<React.SetStateAction<string>>,
    setUploadState: React.Dispatch<React.SetStateAction<LogoUploadState>>,
  ) => {
    if (!profile?.agency_id || !settings) return;
    const validationError = validateAgencyIdentityFile(file);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploadState('preview');
    try {
      setUploadState('uploading');
      const uploadFile = await compressLogoFile(file);
      const compressedValidationError = validateAgencyIdentityFile(uploadFile);
      if (compressedValidationError) throw new Error(compressedValidationError);
      const result = await uploadAgencyIdentityAsset({ agencyId: profile.agency_id, kind, file: uploadFile });
      setSettings(result.settings as SettingsState);
      setLastSavedSnapshot(JSON.stringify(result.settings));
      setPreview(result.signedUrl ?? '');
      setUploadState('done');
      invalidateAgencySettingsCache(profile.agency_id);
      showToast(
        kind === 'logo' ? 'Logo sauvegardé.' : kind === 'signature' ? 'Signature sauvegardée.' : 'Cachet officiel sauvegardé.',
        'success',
      );
    } catch (error) {
      setPreview(previousPreview);
      setUploadState('idle');
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[identity-asset] ${kind} upload failed`, message);
      showToast(message, 'error');
    } finally {
      URL.revokeObjectURL(localPreview);
    }
  };

  const removeIdentityAsset = async (
    kind: 'signature' | 'stamp',
    setPreview: React.Dispatch<React.SetStateAction<string>>,
    setUploadState: React.Dispatch<React.SetStateAction<LogoUploadState>>,
  ) => {
    if (!profile?.agency_id || !settings) return;
    setUploadState('uploading');
    try {
      const result = await deleteAgencyIdentityAsset({ agencyId: profile.agency_id, kind });
      setSettings(result.settings as SettingsState);
      setLastSavedSnapshot(JSON.stringify(result.settings));
      setPreview('');
      setUploadState('idle');
      invalidateAgencySettingsCache(profile.agency_id);
      showToast(kind === 'signature' ? 'Signature retirée des prochains documents.' : 'Cachet retiré des prochains documents.', 'success');
    } catch (error) {
      setUploadState('idle');
      showToast(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  const uploadLogoFile = (file: File) => uploadIdentityAsset('logo', file, logoPreview, setLogoPreview, setLogoUploadState);
  const uploadSignatureFile = (file: File) => uploadIdentityAsset('signature', file, signaturePreview, setSignaturePreview, setSignatureUploadState);
  const uploadStampFile = (file: File) => uploadIdentityAsset('stamp', file, stampPreview, setStampPreview, setStampUploadState);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await uploadLogoFile(file);
    event.target.value = '';
  };

  const handleLogoDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) await uploadLogoFile(file);
  };

  const handleSignatureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await uploadSignatureFile(file);
    event.target.value = '';
  };

  const handleSignatureDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) await uploadSignatureFile(file);
  };

  const handleSignatureRemove = () => removeIdentityAsset('signature', setSignaturePreview, setSignatureUploadState);

  const handleStampUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await uploadStampFile(file);
    event.target.value = '';
  };

  const handleStampDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) await uploadStampFile(file);
  };

  const handleStampRemove = () => removeIdentityAsset('stamp', setStampPreview, setStampUploadState);

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
  const officialNameValue = isIndividualOwner
    ? cleanOptionalText(settings.representant_nom || settings.nom_agence)
    : cleanOptionalText(settings.nom_agence);
  const normalizedOrganizationPhone = settings.telephone ? ensureE164(settings.telephone) : null;
  const normalizedOrganizationEmail = cleanOptionalText(settings.email)?.toLowerCase() ?? '';
  const organizationFieldErrors = {
    officialName: officialNameValue
      ? null
      : isIndividualOwner
        ? 'Nom propriétaire obligatoire.'
        : "Nom d'agence obligatoire.",
    phone: settings.telephone && !isValidInternationalPhone(normalizedOrganizationPhone)
      ? 'Numéro invalide, ex. 77 123 45 67.'
      : null,
    email: normalizedOrganizationEmail && !isValidEmail(normalizedOrganizationEmail)
      ? 'Adresse email invalide.'
      : null,
    ninea: isIndividualOwner ? null : validateNinea(settings.ninea),
    rc: isIndividualOwner ? null : validateRccm(settings.rc),
    managerIdNumber: validateIdentityNumber(settings.manager_id_number, settings.manager_id_type),
  };
  const hasOrganizationFieldErrors = Object.values(organizationFieldErrors).some(Boolean);
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
  const embeddedFieldClass =
    'h-8 w-full rounded-lg border border-emerald-950/10 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15';
  const embeddedTextareaClass =
    'min-h-[4.25rem] w-full rounded-lg border border-emerald-950/10 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15';
  const embeddedLabelClass = 'mb-1 block text-[0.56rem] font-black uppercase tracking-[0.14em] text-slate-500';
  const accountTypeLabel = getOrganizationTypeLabel(settings.organization_type, isIndividualOwner);
  const contactComplete = Boolean(normalizedOrganizationPhone && normalizedOrganizationEmail && !organizationFieldErrors.email);
  const addressComplete = Boolean(cleanOptionalText(settings.adresse) && cleanOptionalText(settings.city));
  const representativeComplete = isIndividualOwner
    ? Boolean(cleanOptionalText(settings.representant_nom || settings.nom_agence))
    : Boolean(cleanOptionalText(settings.representant_nom));
  const identityDocumentComplete = Boolean(cleanOptionalText(settings.manager_id_type) && cleanOptionalText(settings.manager_id_number));
  const legalComplete = isIndividualOwner
    ? Boolean(representativeComplete && identityDocumentComplete && !organizationFieldErrors.managerIdNumber)
    : Boolean(cleanOptionalText(settings.ninea) && cleanOptionalText(settings.rc) && representativeComplete && !organizationFieldErrors.ninea && !organizationFieldErrors.rc);
  const organizationComplete = contactComplete && addressComplete && legalComplete;
  const organizationStatus = organizationComplete ? 'Dossier complet' : 'À compléter';
  const organizationStatusTone = organizationComplete ? 'success' : 'warning';
  const organizationCopy = isIndividualOwner
    ? 'Ces informations identifient votre profil propriétaire dans les documents générés.'
    : 'Ces informations identifient votre agence dans les documents générés.';
  const documentImpactItems = isIndividualOwner
    ? ['Quittances', 'Rapports propriétaire', 'Reçus', 'Registre QR']
    : ['Contrats', 'Mandats', 'Quittances', 'Factures', 'Rapports'];
  const organizationMissingItems = [
    officialNameValue ? null : (isIndividualOwner ? 'Nom propriétaire' : "Nom de l'agence"),
    contactComplete ? null : 'Coordonnées',
    addressComplete ? null : 'Adresse',
    legalComplete ? null : (isIndividualOwner ? 'Pièce d’identité' : 'Registre légal'),
  ].filter(Boolean) as string[];
  const organizationSaveDisabled = saving || !hasUnsavedChanges || (activeTab === 'general' && hasOrganizationFieldErrors);
  const organizationInputClass = (error?: string | null) => [
    embeddedFieldClass,
    error ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-500/15' : '',
  ].filter(Boolean).join(' ');
  const identityTypeValue = settings.manager_id_type ?? 'CNI';
  const isPassportIdentity = identityTypeValue.toLowerCase().includes('passeport');
  const isCniIdentity = identityTypeValue.toLowerCase().includes('cni');
  const identityPlaceholder = isPassportIdentity ? 'A01234567' : isCniIdentity ? '1 01 19950825 00123 4' : 'Référence officielle';
  const identityMaxLength = isPassportIdentity ? 9 : isCniIdentity ? 21 : 24;

  if (embedded && !editingEmbedded) {
    const subheaderEyebrow =
      activeTab === 'general'
        ? 'IDENTITÉ'
        : activeTab === 'documents'
          ? 'REGISTRE DOCUMENTAIRE'
          : 'WORKSPACE';
    const subheaderTitle =
      activeTab === 'general'
        ? 'Organisation'
        : activeTab === 'documents'
          ? 'Documents & identité'
          : 'Modules & navigation';
    const subheaderDesc =
      activeTab === 'general'
        ? 'Informations légales utilisées dans les contrats, mandats et documents.'
        : activeTab === 'documents'
          ? 'Identité visuelle, mentions légales et numérotation — la mise en page se règle dans le Studio.'
          : 'Pages visibles, modules actifs et capacités de navigation.';

    return (
      <div className="space-y-3 sm:space-y-4">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <section className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-emerald-950/12 bg-gradient-to-r from-white via-white to-emerald-50/40 px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.08em] text-[#a45d12] shrink-0">
              {subheaderEyebrow}
            </span>
            <div className="flex items-baseline gap-2 min-w-0 truncate">
              <h1 className="font-extrabold text-sm sm:text-[0.92rem] text-slate-900 leading-none shrink-0">
                {subheaderTitle}
              </h1>
              <span className="hidden md:inline text-slate-300">·</span>
              <p className="hidden md:block text-xs text-slate-500 truncate">{subheaderDesc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setEditingEmbedded(true)}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-emerald-950/15 bg-white px-3.5 text-xs font-extrabold text-emerald-950 shadow-2xs transition hover:border-emerald-700 hover:bg-emerald-50/80 active:translate-y-0.5"
            >
              <Edit3 className="h-3.5 w-3.5 text-emerald-700" />
              <span>Modifier</span>
            </button>
          </div>
        </section>

        {activeTab === 'general' && (
          <div className="space-y-2">
            <div className="columns-1 gap-2 lg:columns-2">
              <SettingsInfoCard title="Identité" eyebrow={isIndividualOwner ? 'PROFIL PROPRIÉTAIRE' : 'AGENCE'} icon={Building}>
                <OrganizationInfoLine label={isIndividualOwner ? 'Nom documentaire' : "Nom de l'agence"} value={displayName} strong documentHint="Contrats, quittances, rapports" />
                <OrganizationInfoLine label="Type" value={accountTypeLabel} />
                <OrganizationInfoLine label="Email" value={settings.email} icon={AtSign} />
                <OrganizationInfoLine label="Téléphone" value={formatInternationalPhone(settings.telephone, 'Non renseigné')} icon={Phone} />
                <OrganizationInfoLine label="Site web" value={settings.site_web} icon={Globe2} />
                <ReadinessPill label="Contact" ready={contactComplete} />
              </SettingsInfoCard>

              <SettingsInfoCard title="Adresse" eyebrow="LOCALISATION" icon={MapPin}>
                <OrganizationInfoLine label="Adresse" value={settings.adresse} documentHint="Entêtes et mentions" />
                <OrganizationInfoLine label="Ville" value={settings.city} />
                <OrganizationInfoLine label="Pays" value="Sénégal" />
                <ReadinessPill label="Adresse" ready={addressComplete} />
              </SettingsInfoCard>

              <SettingsInfoCard title="Informations légales" eyebrow="REGISTRE" icon={Landmark}>
                {!isIndividualOwner && <OrganizationInfoLine label="NINEA" value={settings.ninea} strong documentHint="Documents officiels" />}
                {!isIndividualOwner && <OrganizationInfoLine label="RC" value={settings.rc} />}
                <OrganizationInfoLine label="Tribunal" value={settings.mention_tribunal} multiline />
                <ReadinessPill label="Légal" ready={legalComplete} />
              </SettingsInfoCard>

              <SettingsInfoCard title={isIndividualOwner ? 'Identité propriétaire' : 'Représentant légal'} eyebrow="SIGNATURE" icon={UserRound}>
                <OrganizationInfoLine label={isIndividualOwner ? 'Propriétaire' : 'Représentant'} value={isIndividualOwner ? settings.representant_nom || displayName : settings.representant_nom} strong documentHint="Mandats et contrats" />
                <OrganizationInfoLine label="Fonction" value={settings.representant_fonction} />
                <OrganizationInfoLine label="Type pièce" value={settings.manager_id_type} />
                <OrganizationInfoLine label="Numéro pièce" value={settings.manager_id_number} icon={ShieldCheck} />
                {!representativeComplete && (
                  <OrganizationEmptyNotice text={isIndividualOwner ? 'Complétez le nom propriétaire utilisé pour les documents.' : 'Ajoutez le représentant légal avant une présentation client.'} />
                )}
                <ReadinessPill label="Pièce" ready={identityDocumentComplete} />
              </SettingsInfoCard>
            </div>

            <section className="rounded-xl border border-orange-200/70 bg-orange-50/70 p-2.5 shadow-sm">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-orange-700">Impact documentaire</p>
                    <SettingsStatusBadge tone={organizationStatusTone}>{organizationStatus}</SettingsStatusBadge>
                  </div>
                  <p className="mt-1 max-w-3xl text-[0.68rem] font-semibold leading-snug text-orange-950">{organizationCopy}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {documentImpactItems.map((item) => (
                    <span key={item} className="rounded-full border border-orange-200 bg-white/75 px-2 py-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-orange-800">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                <DocumentSignal label="Logo" ready={Boolean(logoPreview || settings.logo_url)} />
                <DocumentSignal label="Cachet / signature" ready={Boolean(signaturePreview || settings.signature_url)} />
                <DocumentSignal label="QR Verify" ready={Boolean(settings.qr_code_quittances)} />
              </div>
              {organizationMissingItems.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {organizationMissingItems.map((item) => (
                    <span key={item} className="rounded-full border border-orange-200 bg-white px-2 py-0.5 text-[0.54rem] font-black uppercase tracking-[0.08em] text-orange-800">
                      À compléter · {item}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'general' && profile?.agency_id && (
          <OrganizationCompliancePanel
            agencyId={profile.agency_id}
            isIndividualOwner={isIndividualOwner}
          />
        )}

        {activeTab === 'documents' && (
          <div className="grid gap-2 lg:grid-cols-[minmax(0,0.78fr)_minmax(22rem,1.22fr)]">
            <div className="grid gap-2">
              <section className="rounded-xl border border-emerald-950/10 bg-gradient-to-br from-[#fffdf8] via-white to-emerald-50/45 p-2 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[0.48rem] font-black uppercase tracking-[0.14em] text-emerald-700">Studio documentaire</p>
                    <h3 className="mt-0.5 text-[0.78rem] font-extrabold text-slate-950">Règles actives et identité</h3>
                    <p className="mt-0.5 text-[0.62rem] font-semibold leading-snug text-slate-500">
                      La preview à droite montre le rendu réel appliqué aux quittances, contrats, mandats, rapports et factures.
                    </p>
                  </div>
                  <SettingsStatusBadge tone={settings.qr_code_quittances ? 'success' : 'warning'}>
                    {settings.qr_code_quittances ? 'QR actif' : 'QR inactif'}
                  </SettingsStatusBadge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <SettingsStatusCard label="Mode" value={documentModeLabel} icon={FileText} />
                  <SettingsStatusCard label="Couleurs" value={`${settings.couleur_primaire ?? '#F58220'} / ${settings.couleur_secondaire ?? '#D9AA5E'}`} icon={Sparkles} />
                  <SettingsStatusCard label="Pénalité de retard" value={`${settings.penalite_retard_montant ?? 0} F / jour`} icon={ShieldCheck} />
                  <SettingsStatusCard label="Mis à jour" value={formatCompactDate(settings.updated_at)} icon={CheckCircle} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <DocumentSignal label="Logo" ready={Boolean(logoPreview || settings.logo_url)} />
                  <DocumentSignal label="Signature" ready={Boolean(signaturePreview || settings.signature_url)} />
                  <DocumentSignal label="Mentions" ready={Boolean(settings.mention_tribunal || settings.pied_page_personnalise)} />
                </div>
                <PremiumButton
                  variant="primary"
                  size="sm"
                  fullWidth
                  className="mt-2"
                  onClick={() => navigate(`/documents/studio?type=${DOCUMENT_PREVIEW_TEMPLATE_TYPE[documentPreviewType]}`)}
                  icon={<FileText className="h-3.5 w-3.5" />}
                >
                  Ouvrir le Studio des modèles
                </PremiumButton>
              </section>

              <SettingsInfoCard title="Mentions officielles" eyebrow="REGISTRE" icon={FileText}>
                <InfoLine label="Clause tribunal" value={settings.mention_tribunal} multiline />
                <InfoLine label="Clause pénalités" value={settings.mention_penalites} multiline />
                <InfoLine label="Pied de page" value={settings.pied_page_personnalise} multiline />
              </SettingsInfoCard>

              {embeddedMode === 'documentsIdentity' && (
                <SettingsInfoCard title="Identité visuelle" eyebrow="MARQUE" icon={Palette}>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <InfoLine label="Logo" value={logoPreview ? 'Logo configuré' : 'Logo à ajouter'} strong />
                      <InfoLine label="Signature" value={signaturePreview ? 'Prête' : 'À ajouter'} strong={Boolean(signaturePreview)} />
                      <InfoLine label="Cachet" value={stampPreview ? 'Prêt' : 'À ajouter'} strong={Boolean(stampPreview)} />
                      <InfoLine label="Position" value={settings.logo_position} />
                      <ColorLine label="Couleur primaire" value={settings.couleur_primaire ?? '#F58220'} />
                      <ColorLine label="Couleur secondaire" value={settings.couleur_secondaire ?? '#D9AA5E'} />
                    </div>
                    <div className="grid gap-1">
                      <div className="flex h-12 w-20 items-center justify-center rounded-xl border border-emerald-950/10 bg-[#fff8ed] p-2">
                        {logoPreview ? <SafeLogoImage src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain" /> : <Sparkles className="h-5 w-5 text-orange-600" />}
                      </div>
                      <div className="flex h-10 w-20 items-center justify-center rounded-xl border border-emerald-950/10 bg-white p-1.5">
                        {signaturePreview ? <SafeLogoImage src={signaturePreview} alt="Signature" className="max-h-full max-w-full object-contain" /> : <span className="text-[0.46rem] font-black uppercase tracking-[0.08em] text-slate-400">Signature</span>}
                      </div>
                      <div className="flex h-10 w-20 items-center justify-center rounded-xl border border-emerald-950/10 bg-white p-1.5">
                        {stampPreview ? <SafeLogoImage src={stampPreview} alt="Cachet" className="max-h-full max-w-full object-contain" /> : <span className="text-[0.46rem] font-black uppercase tracking-[0.08em] text-slate-400">Cachet</span>}
                      </div>
                    </div>
                  </div>
                </SettingsInfoCard>
              )}
            </div>
            <SettingsDocumentPreview
              settings={settings}
              logoUrl={logoPreview}
              signatureUrl={signaturePreview}
              stampUrl={stampPreview}
              selectedType={documentPreviewType}
              onSelectType={setDocumentPreviewType}
              className="lg:min-h-full"
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
        <div className="sticky top-2 z-20 flex flex-col gap-2 rounded-xl border border-emerald-950/15 bg-white/95 p-3 shadow-md backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
              <Building className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-emerald-700">
                  {isIndividualOwner ? 'Profil propriétaire' : 'Dossier agence'}
                </span>
                <SettingsStatusBadge tone={organizationStatusTone}>{organizationStatus}</SettingsStatusBadge>
              </div>
              <p className="truncate text-[0.74rem] font-extrabold text-slate-900">
                {hasUnsavedChanges ? 'Modifications en attente de sauvegarde' : 'Édition des informations officielles'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PremiumButton variant="secondary" size="sm" onClick={() => setEditingEmbedded(false)}>
              Revenir à l'aperçu
            </PremiumButton>
            <PremiumButton
              variant="create"
              size="sm"
              onClick={handleSave}
              disabled={organizationSaveDisabled}
              icon={saving ? <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" /> : <Save className="h-4 w-4" />}
            >
              {saving ? 'Enregistrement...' : !hasUnsavedChanges ? 'À jour' : hasOrganizationFieldErrors && activeTab === 'general' ? 'À corriger' : 'Sauvegarder'}
            </PremiumButton>
          </div>
        </div>

        {hasOrganizationFieldErrors && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-[0.68rem] font-semibold leading-snug">
              Corrigez les champs signalés avant d'enregistrer. Les documents utilisent ces informations comme source officielle.
            </p>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="grid gap-2.5">

            <SettingsEditSection
              icon={Building}
              eyebrow="Identité"
              title={isIndividualOwner ? 'Profil propriétaire' : "Identité de l'organisation"}
              description={isIndividualOwner ? 'Nom visible dans les documents propriétaire.' : "Nom officiel, type et présence en ligne de l'agence."}
            >
              <div className="grid gap-2.5 md:grid-cols-2">
                <FormField label={isIndividualOwner ? 'Nom documentaire' : "Nom de l'agence"} hint="Utilisé dans les documents" error={organizationFieldErrors.officialName} required className="md:col-span-2">
                  <input
                    type="text"
                    value={isIndividualOwner ? settings.representant_nom ?? settings.nom_agence ?? '' : settings.nom_agence ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSettings(isIndividualOwner
                        ? { ...settings, representant_nom: value, nom_agence: value }
                        : { ...settings, nom_agence: value });
                    }}
                    className={organizationInputClass(organizationFieldErrors.officialName)}
                    aria-invalid={Boolean(organizationFieldErrors.officialName)}
                    autoComplete="organization"
                  />
                </FormField>
                <FormField label="Type d'organisation">
                  <input type="text" value={accountTypeLabel} disabled className={`${embeddedFieldClass} bg-slate-50 text-slate-500`} />
                </FormField>
                <FormField label="Site web" optional>
                  <input type="url" value={settings.site_web ?? ''} onChange={(e) => setSettings({ ...settings, site_web: e.target.value })} className={embeddedFieldClass} placeholder="https://..." />
                </FormField>
              </div>
            </SettingsEditSection>

            <SettingsEditSection icon={Phone} eyebrow="Contact" title="Coordonnées" description="Téléphone et email apparaissent dans les entêtes et les contacts documentaires.">
              <div className="grid gap-2.5 md:grid-cols-2">
                <FormField label="Téléphone" error={organizationFieldErrors.phone}>
                  <PhoneInput
                    label=""
                    value={settings.telephone ?? ''}
                    onChange={(value) => setSettings({ ...settings, telephone: value })}
                  />
                </FormField>
                <FormField label="Email" optional hint="Validé à l'enregistrement" error={organizationFieldErrors.email}>
                  <input type="email" value={settings.email ?? ''} onChange={(e) => setSettings({ ...settings, email: e.target.value })} className={organizationInputClass(organizationFieldErrors.email)} placeholder="contact@agence.sn" aria-invalid={Boolean(organizationFieldErrors.email)} autoComplete="email" />
                </FormField>
              </div>
            </SettingsEditSection>

            <SettingsEditSection icon={MapPin} eyebrow="Adresse" title="Adresse de référence" description="Adresse utilisée dans les entêtes et mentions officielles.">
              <div className="grid gap-2.5 md:grid-cols-2">
                <FormField label="Adresse" className="md:col-span-2" optional>
                  <input type="text" value={settings.adresse ?? ''} onChange={(e) => setSettings({ ...settings, adresse: e.target.value })} className={embeddedFieldClass} placeholder="Rue, immeuble, quartier..." />
                </FormField>
                <FormField label="Ville">
                  <input type="text" value={settings.city ?? ''} onChange={(e) => setSettings({ ...settings, city: e.target.value })} className={embeddedFieldClass} placeholder="Dakar" />
                </FormField>
                <div className="rounded-lg border border-emerald-950/10 bg-emerald-50/45 px-2.5 py-2">
                  <p className={embeddedLabelClass}>Pays</p>
                  <p className="text-xs font-extrabold text-slate-800">Sénégal</p>
                  <p className="mt-0.5 text-[0.58rem] font-semibold text-slate-500">Contexte documentaire par défaut.</p>
                </div>
              </div>
            </SettingsEditSection>

            <SettingsEditSection icon={Landmark} eyebrow="Registre" title="Informations légales" description={isIndividualOwner ? 'Renseignez les références utiles si elles doivent apparaître dans les documents.' : 'NINEA, RC et tribunal restent ensemble pour les documents officiels.'}>
              <div className="grid gap-2.5 md:grid-cols-2">
                {!isIndividualOwner && (
                  <FormField label="NINEA" optional hint="Exemple : 0012345 2G3" error={organizationFieldErrors.ninea}>
                    <input
                      type="text"
                      value={settings.ninea ?? ''}
                      onChange={(e) => setSettings({ ...settings, ninea: formatNineaInput(e.target.value) })}
                      className={organizationInputClass(organizationFieldErrors.ninea)}
                      placeholder="0012345 2G3"
                      maxLength={11}
                      inputMode="text"
                      autoCapitalize="characters"
                      aria-invalid={Boolean(organizationFieldErrors.ninea)}
                    />
                  </FormField>
                )}
                {!isIndividualOwner && (
                  <FormField label="Registre de commerce" optional hint="Exemple : SN-DKR-2026-B-12345" error={organizationFieldErrors.rc}>
                    <input
                      type="text"
                      value={settings.rc ?? ''}
                      onChange={(e) => setSettings({ ...settings, rc: formatRccmInput(e.target.value) })}
                      className={organizationInputClass(organizationFieldErrors.rc)}
                      placeholder="SN-DKR-2026-B-12345"
                      maxLength={21}
                      autoCapitalize="characters"
                      aria-invalid={Boolean(organizationFieldErrors.rc)}
                    />
                  </FormField>
                )}
                <FormField label="Tribunal compétent" optional className="md:col-span-2">
                  <input type="text" value={settings.mention_tribunal ?? ''} onChange={(e) => setSettings({ ...settings, mention_tribunal: e.target.value })} className={embeddedFieldClass} />
                </FormField>
              </div>
            </SettingsEditSection>

            <SettingsEditSection icon={UserRound} eyebrow="Signature" title={isIndividualOwner ? 'Identité du propriétaire' : 'Représentant légal'} description="Ces informations sont reprises dans les mandats, contrats et signatures.">
              <div className="grid gap-2.5 md:grid-cols-2">
                {!isIndividualOwner && (
                  <FormField label="Nom du représentant" optional hint="Mandats et contrats">
                    <input type="text" value={settings.representant_nom ?? ''} onChange={(e) => setSettings({ ...settings, representant_nom: e.target.value })} className={embeddedFieldClass} />
                  </FormField>
                )}
                <FormField label={isIndividualOwner ? 'Qualité' : 'Fonction'} optional>
                  <input type="text" value={settings.representant_fonction ?? ''} onChange={(e) => setSettings({ ...settings, representant_fonction: e.target.value })} className={embeddedFieldClass} placeholder={isIndividualOwner ? 'Propriétaire' : 'Gérant'} />
                </FormField>
                <FormField label="Type de pièce" optional>
                  <SmartCombobox
                    density="wizard"
                    value={identityTypeValue}
                    options={[
                      { value: 'CNI', label: 'CNI' },
                      { value: 'Passeport', label: 'Passeport' },
                      { value: 'Carte consulaire', label: 'Carte consulaire' },
                    ]}
                    onChange={(val) => setSettings({
                      ...settings,
                      manager_id_type: val,
                      manager_id_number: formatIdentityNumberInput(settings.manager_id_number ?? '', val),
                    })}
                    placeholder="Sélectionner le type"
                  />
                </FormField>
                <FormField
                  label="Numéro de pièce"
                  optional
                  hint={isPassportIdentity ? 'Exemple : A01234567' : isCniIdentity ? '17 chiffres (format biométrique CEDEAO)' : 'Référence officielle'}
                  error={organizationFieldErrors.managerIdNumber}
                >
                  <input
                    type="text"
                    value={settings.manager_id_number ?? ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      manager_id_number: formatIdentityNumberInput(e.target.value, identityTypeValue),
                    })}
                    className={organizationInputClass(organizationFieldErrors.managerIdNumber)}
                    placeholder={identityPlaceholder}
                    maxLength={identityMaxLength}
                    inputMode={isCniIdentity ? 'numeric' : 'text'}
                    onKeyDown={isCniIdentity ? preventNonDigitKey : undefined}
                    autoCapitalize="characters"
                    aria-invalid={Boolean(organizationFieldErrors.managerIdNumber)}
                  />
                </FormField>
              </div>
            </SettingsEditSection>

            <SettingsEditSection icon={FileText} eyebrow="Source documentaire" title="Impact dans les documents" description="Ce rappel évite de modifier l'identité officielle sans comprendre où elle sera reprise.">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <DocumentImpactMini label={isIndividualOwner ? 'Nom propriétaire' : "Nom agence"} value="Contrats · Quittances · Rapports" ready={Boolean(officialNameValue)} />
                <DocumentImpactMini label="Adresse" value="Entêtes · Mentions" ready={addressComplete} />
                <DocumentImpactMini label={isIndividualOwner ? 'Pièce' : 'NINEA / RC'} value={isIndividualOwner ? 'Mandats · Registre' : 'Documents officiels'} ready={legalComplete} />
                <DocumentImpactMini label="Représentant" value="Mandats · Signatures" ready={representativeComplete} />
              </div>
            </SettingsEditSection>
          </div>
        )}

        {activeTab === 'general' && profile?.agency_id && (
          <OrganizationCompliancePanel
            agencyId={profile.agency_id}
            editable
            isIndividualOwner={isIndividualOwner}
            onSaved={(message) => showToast(message, 'success')}
            onError={(message) => showToast(message, 'error')}
          />
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
                <div className="rounded-xl border border-emerald-950/10 bg-[#fffdf8] p-2">
                  <p className="text-[0.52rem] font-black uppercase tracking-[0.12em] text-slate-500">Préfixes</p>
                  <p className="mt-0.5 text-[0.56rem] font-semibold text-slate-400">La visibilité du QR se règle document par document dans le Studio.</p>
                  <div className="mt-2 grid gap-1.5">
                    {(Object.keys(DOCUMENT_PREVIEWS) as DocumentPreviewType[]).map((type) => (
                      <div key={type} className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-1.5">
                        <span className="truncate text-[0.62rem] font-extrabold text-slate-700">{DOCUMENT_PREVIEWS[type].label}</span>
                        <input
                          value={documentPreferences.prefixes?.[type] ?? ''}
                          onChange={(event) => updateDocumentPrefix(type, event.target.value)}
                          className="h-7 rounded-lg border border-emerald-950/10 bg-white px-2 text-[0.62rem] font-black uppercase text-slate-800 outline-none focus:ring-2 focus:ring-emerald-700/15"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <label>
                  <span className={embeddedLabelClass}>Notice quittance</span>
                  <input
                    type="text"
                    value={documentPreferences.receipt_notice ?? ''}
                    onChange={(event) => updateDocumentPreferences({ receipt_notice: event.target.value })}
                    className={embeddedFieldClass}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="rounded-xl border border-emerald-950/10 bg-white/88 p-2.5 shadow-sm">
                <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-emerald-700">Identité visuelle</p>
                <h3 className="mt-0.5 text-[0.82rem] font-extrabold text-slate-950">Logo et couleurs</h3>
                <div className="mt-2.5 grid gap-2.5">
                  <label className="block" onDrop={handleLogoDrop} onDragOver={(e) => e.preventDefault()}>
                    <span className={embeddedLabelClass}>{isIndividualOwner ? 'Logo du profil' : "Logo de l'agence"}</span>
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
                  <div className="block" onDrop={handleSignatureDrop} onDragOver={(e) => e.preventDefault()}>
                    <span className={embeddedLabelClass}>Signature</span>
                    <div className="flex items-center justify-between gap-2.5 rounded-xl border border-dashed border-emerald-950/15 bg-white p-2.5">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleSignatureUpload}
                          className="hidden"
                        />
                        <div className="flex h-11 w-16 shrink-0 items-center justify-center rounded-xl bg-[#fffdf8] p-2 shadow-sm">
                          {signaturePreview ? <SafeLogoImage src={signaturePreview} alt="Signature" className="max-h-full max-w-full object-contain" /> : <Upload className="h-5 w-5 text-emerald-800" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[0.72rem] font-extrabold text-slate-950">
                            {signatureUploadState === 'uploading' ? 'Upload en cours...' : signaturePreview ? 'Signature prête' : 'Cliquer ou déposer une signature'}
                          </p>
                          <p className="text-[0.62rem] font-semibold text-slate-500">PNG transparent conseillé. Utilisée dans contrats et mandats.</p>
                        </div>
                      </label>
                      {signaturePreview && (
                        <button
                          type="button"
                          onClick={handleSignatureRemove}
                          className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[0.56rem] font-black uppercase tracking-[0.08em] text-red-700 transition hover:bg-red-100"
                          disabled={signatureUploadState === 'uploading'}
                        >
                          Retirer
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="block" onDrop={handleStampDrop} onDragOver={(e) => e.preventDefault()}>
                    <span className={embeddedLabelClass}>Cachet / tampon</span>
                    <div className="flex items-center justify-between gap-2.5 rounded-xl border border-dashed border-emerald-950/15 bg-white p-2.5">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleStampUpload}
                          className="hidden"
                        />
                        <div className="flex h-11 w-16 shrink-0 items-center justify-center rounded-xl bg-[#fffdf8] p-2 shadow-sm">
                          {stampPreview ? <SafeLogoImage src={stampPreview} alt="Cachet" className="max-h-full max-w-full object-contain" /> : <Upload className="h-5 w-5 text-emerald-800" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[0.72rem] font-extrabold text-slate-950">
                            {stampUploadState === 'uploading' ? 'Upload en cours...' : stampPreview ? 'Cachet prêt' : 'Cliquer ou déposer un cachet'}
                          </p>
                          <p className="text-[0.62rem] font-semibold text-slate-500">PNG transparent conseillé. Utilisé partout où le cachet est activé.</p>
                        </div>
                      </label>
                      {stampPreview && (
                        <button
                          type="button"
                          onClick={handleStampRemove}
                          className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[0.56rem] font-black uppercase tracking-[0.08em] text-red-700 transition hover:bg-red-100"
                          disabled={stampUploadState === 'uploading'}
                        >
                          Retirer
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className={embeddedLabelClass}>Position logo</span>
                    <SmartCombobox
                      density="wizard"
                      value={settings.logo_position ?? 'left'}
                      options={[
                        { value: 'left', label: 'Gauche' },
                        { value: 'center', label: 'Centre' },
                        { value: 'right', label: 'Droite' },
                      ]}
                      onChange={(val) => setSettings({ ...settings, logo_position: val as AgencySettings['logo_position'] })}
                      placeholder="Sélectionner la position"
                    />
                  </div>
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
                        <input type="color" value={settings.couleur_secondaire ?? '#D9AA5E'} onChange={(e) => setSettings({ ...settings, couleur_secondaire: e.target.value })} className="h-10 w-12 rounded-xl border border-emerald-950/10 bg-white p-1" />
                        <input type="text" value={settings.couleur_secondaire ?? '#D9AA5E'} onChange={(e) => setSettings({ ...settings, couleur_secondaire: e.target.value })} className={embeddedFieldClass} />
                      </div>
                    </label>
                  </div>
                </div>
              </div>
              <SettingsDocumentPreview
                settings={settings}
                logoUrl={logoPreview}
                signatureUrl={signaturePreview}
                stampUrl={stampPreview}
                selectedType={documentPreviewType}
                onSelectType={setDocumentPreviewType}
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

  // `embedded` est toujours vrai en production (seul point de montage : ParametresHub.tsx,
  // qui passe systematiquement embedded sur ses 3 rendus). Ce repli non-embarque a ete
  // confirme injoignable et supprime (~790 lignes) ; conserve uniquement pour satisfaire
  // le type de retour de la fonction.
  return null;
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
    <section className={`break-inside-avoid mb-2 inline-block w-full rounded-xl border border-emerald-950/10 bg-white/88 p-2 shadow-sm ${className}`}>
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

function OrganizationInfoLine({
  label,
  value,
  strong = false,
  multiline = false,
  icon: Icon,
  documentHint,
}: {
  label: string;
  value?: string | null;
  strong?: boolean;
  multiline?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  documentHint?: string;
}) {
  const resolved = value && String(value).trim() ? String(value) : 'Non renseigné';
  const empty = resolved === 'Non renseigné';
  return (
    <div className={`flex items-start justify-between gap-3 border-b border-slate-100/70 py-1.5 last:border-b-0 ${multiline ? 'flex-col' : ''}`}>
      <dt className="flex min-w-0 shrink-0 items-center gap-1.5 text-[0.66rem] font-bold text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-700/80" />}
        <span>{label}</span>
      </dt>
      <dd className="min-w-0 flex-1 text-right">
        <div
          className={`${strong ? 'font-extrabold text-slate-950' : empty ? 'font-semibold text-slate-400' : 'font-extrabold text-slate-800'} text-[0.7rem] ${multiline ? 'text-left leading-4' : 'truncate'}`}
          title={resolved}
        >
          {resolved}
        </div>
        {documentHint && (
          <span className="mt-0.5 inline-block rounded bg-emerald-50/90 px-1.5 py-0.5 text-[0.48rem] font-black uppercase tracking-[0.08em] text-emerald-800">
            {documentHint}
          </span>
        )}
      </dd>
    </div>
  );
}

function ReadinessPill({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-emerald-950/10 bg-white/80 px-2 py-1">
      <span className="text-[0.55rem] font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <SettingsStatusBadge tone={ready ? 'success' : 'warning'}>{ready ? 'Complet' : 'À compléter'}</SettingsStatusBadge>
    </div>
  );
}

function OrganizationEmptyNotice({ text }: { text: string }) {
  return (
    <div className="my-1 flex items-start gap-1.5 rounded-lg border border-orange-200 bg-orange-50/75 px-2 py-1.5">
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-orange-700" />
      <p className="text-[0.56rem] font-semibold leading-snug text-orange-900">{text}</p>
    </div>
  );
}

function SettingsStatusBadge({ tone = 'neutral', children }: { tone?: 'success' | 'warning' | 'neutral'; children: React.ReactNode }) {
  const classes = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-orange-200 bg-orange-50 text-orange-800',
    neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[0.52rem] font-black uppercase tracking-[0.08em] ${classes}`}>
      {children}
    </span>
  );
}

function DocumentSignal({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-orange-200/70 bg-white/70 px-2 py-1">
      <span className="text-[0.58rem] font-bold text-orange-950">{label}</span>
      <span className={`text-[0.54rem] font-black uppercase tracking-[0.08em] ${ready ? 'text-emerald-700' : 'text-orange-700'}`}>
        {ready ? 'Configuré' : 'À compléter'}
      </span>
    </div>
  );
}

function DocumentImpactMini({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div className="rounded-lg border border-emerald-950/10 bg-white px-2 py-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[0.56rem] font-black uppercase tracking-[0.1em] text-slate-500">{label}</p>
          <p className="mt-0.5 text-[0.62rem] font-semibold leading-snug text-slate-700">{value}</p>
        </div>
        <SettingsStatusBadge tone={ready ? 'success' : 'warning'}>{ready ? 'OK' : 'À compléter'}</SettingsStatusBadge>
      </div>
    </div>
  );
}

function SettingsEditSection({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-emerald-950/10 bg-white/88 p-2.5 shadow-sm">
      <div className="mb-2 flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-emerald-700">{eyebrow}</p>
          <h3 className="text-[0.78rem] font-extrabold text-slate-950">{title}</h3>
          <p className="mt-0.5 text-[0.62rem] font-semibold leading-snug text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function FormField({
  label,
  hint,
  optional = false,
  required = false,
  error,
  className = '',
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  required?: boolean;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[0.7rem] font-extrabold text-slate-800">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        {optional ? (
          <span className="text-[0.6rem] font-semibold text-slate-400">facultatif</span>
        ) : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1 flex items-center gap-1 text-[0.56rem] font-semibold leading-snug text-red-700">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[0.56rem] font-semibold leading-snug text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

function InfoLine({ label, value, strong = false, multiline = false }: { label: string; value?: string | null; strong?: boolean; multiline?: boolean }) {
  const resolved = value && String(value).trim() ? String(value) : 'Non renseigné';
  return (
    <div className={`flex items-start justify-between gap-2 py-1 ${multiline ? 'flex-col' : ''}`}>
      <dt className="shrink-0 text-[0.62rem] font-bold text-slate-500">{label}</dt>
      <dd className={`${strong ? 'font-extrabold text-slate-950' : 'font-semibold text-slate-700'} min-w-0 text-right text-[0.68rem] ${multiline ? 'text-left leading-[0.95rem]' : 'truncate'}`} title={resolved}>
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
  useEffect(() => {
    setFailed(false);
  }, [src]);
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

/**
 * Aperçu "fidèle" au sens strict : le VRAI PDF (buildXxxPreviewDocument, voir
 * src/lib/pdf.ts), généré avec le modèle Studio publié pour ce type de
 * document et les réglages d'identité en cours d'édition sur cette page
 * (même non encore sauvegardés) — jamais une reconstitution HTML approximative.
 */
function SettingsDocumentPreview({
  settings,
  logoUrl,
  signatureUrl,
  stampUrl,
  selectedType,
  onSelectType,
  className = '',
}: {
  settings: Partial<AgencySettings>;
  /** URL signee deja resolue (settings.logo_url n'est qu'un chemin de stockage, pas une URL chargeable). */
  logoUrl?: string;
  signatureUrl?: string;
  stampUrl?: string;
  selectedType: DocumentPreviewType;
  onSelectType: (type: DocumentPreviewType) => void;
  className?: string;
}) {
  const templateType = DOCUMENT_PREVIEW_TEMPLATE_TYPE[selectedType];
  const [content, setContent] = useState<DocumentTemplateContent | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTemplateLoading(true);
    setTemplateError(null);
    resolvePublishedDocumentTemplate(templateType, settings.agency_id)
      .then((resolved) => {
        if (cancelled) return;
        setContent(resolved.content);
      })
      .catch((error) => {
        if (cancelled) return;
        setContent(null);
        setTemplateError(error instanceof Error ? error.message : "Le modèle n'a pas pu être chargé.");
      })
      .finally(() => {
        if (!cancelled) setTemplateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [templateType, settings.agency_id]);

  const previewSettings = useMemo(
    () => ({ ...settings, logo_url: logoUrl || null, signature_url: signatureUrl || null, stamp_url: stampUrl || null }),
    [settings, logoUrl, signatureUrl, stampUrl],
  );
  const preview = useDocumentPreviewPdf(templateType, content, previewSettings);

  return (
    <section className={`rounded-xl border border-emerald-950/10 bg-[#fffdf8] p-2 shadow-sm ${className}`}>
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
      <div className="mt-1.5 h-[34rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner">
        <DocumentTemplatePreview
          blobUrl={preview.blobUrl}
          loading={preview.loading || templateLoading}
          error={templateError ?? preview.error}
          supported={preview.supported}
        />
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
    system: { label: 'Système', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
    essential: { label: 'Essentiel', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    active: { label: 'Pilotable', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    inactive: { label: 'Désactivé', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
    prepared: { label: 'Préparé', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
    plan: { label: 'Plan +', className: 'bg-violet-50 text-violet-700 ring-violet-200' },
  };
  const totalModules = modules.reduce((count, group) => count + group.items.length, 0);
  const activeModules = modules.reduce(
    (count, group) => count + group.items.filter((item) => ['system', 'essential', 'active'].includes(item.status)).length,
    0,
  );
  const configurableModules = modules.reduce(
    (count, group) => count + group.items.filter((item) => Boolean(item.toggle)).length,
    0,
  );
  const moduleSignals = [
    { label: 'Socle agence', value: `${activeModules}/${totalModules}`, tone: 'success' as const },
    { label: 'Pilotables', value: `${configurableModules}`, tone: configurableModules > 0 ? 'success' as const : 'neutral' as const },
    { label: 'Navigation', value: 'Synchronisée', tone: 'success' as const },
  ];

  return (
    <div className="space-y-2">
      <section className="rounded-xl border border-emerald-950/10 bg-white p-2.5 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[0.46rem] font-black uppercase tracking-[0.14em] text-emerald-700">Modules & pages</p>
            <h2 className="mt-0.5 text-[0.76rem] font-extrabold text-slate-950">Workspace visible par domaine</h2>
            <p className="mt-0.5 max-w-2xl text-[0.63rem] leading-[0.9rem] text-slate-600">
              Les modules système restent verrouillés. Les modules pilotables masquent la navigation et verrouillent les permissions sans supprimer les données existantes.
            </p>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-3 lg:w-[23rem]">
            {moduleSignals.map((signal) => (
              <div key={signal.label} className="rounded-lg border border-emerald-950/10 bg-white/82 px-2 py-1 shadow-sm">
                <p className="text-[0.48rem] font-black uppercase tracking-[0.1em] text-slate-500">{signal.label}</p>
                <div className="mt-0.5">
                  <SettingsStatusBadge tone={signal.tone}>{signal.value}</SettingsStatusBadge>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 grid gap-1.5 md:grid-cols-3">
          {[
            ['Navigation', 'Un module désactivé sort des menus actifs.'],
            ['Permissions', 'Les rôles standards ne contournent pas un module verrouillé.'],
            ['Données', 'Aucune donnée métier n’est supprimée par un masquage.'],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-lg border border-emerald-950/10 bg-white/70 px-2 py-1.5">
              <p className="text-[0.58rem] font-extrabold text-slate-800">{title}</p>
              <p className="mt-0.5 text-[0.54rem] font-semibold leading-snug text-slate-500">{copy}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-emerald-950/10 bg-white/90 p-2 shadow-sm">
        {[
          ['Système', 'Indispensable, non désactivable.'],
          ['Essentiel', 'Cœur métier visible pour ce compte.'],
          ['Pilotable', 'Relié aux réglages agence.'],
          ['Préparé', 'Visible comme capacité, sans faux switch.'],
          ['Désactivé', 'Masqué et verrouillé.'],
        ].map(([label, copy]) => (
          <span key={label} className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-100 bg-[#fffdf8] px-2 py-1">
            <span className="text-[0.56rem] font-black uppercase tracking-[0.1em] text-slate-800">{label}</span>
            <span className="hidden text-[0.55rem] font-semibold text-slate-500 md:inline">{copy}</span>
          </span>
        ))}
      </div>
      <div className="columns-1 gap-2 lg:columns-2">
        {modules.map((group) => {
          const activeCount = group.items.filter((item) => ['system', 'essential', 'active'].includes(item.status)).length;
          return (
          <section key={group.category} className="break-inside-avoid mb-2 inline-block w-full rounded-xl border border-emerald-950/10 bg-white p-2 shadow-sm">
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
                  <div key={item.label} className="min-w-0 rounded-lg border border-slate-100 bg-[#fffdf8]/70 px-2 py-1.5">
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
                          {item.status === 'active' ? 'Actif' : 'Off'}
                        </button>
                      ) : (
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.46rem] font-black uppercase tracking-[0.1em] ring-1 ${status.className}`}>
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
