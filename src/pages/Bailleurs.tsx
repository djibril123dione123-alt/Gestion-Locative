import React, { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ToastContainer } from '../components/ui/Toast';
import {
  Plus,
  Search,
  FileText,
  AlertCircle,
  ShieldAlert,
  Building2,
  Home,
  ClipboardList,
  Wallet,
  ReceiptText,
  Users,
  Phone,
  Mail,
  SlidersHorizontal,
  BarChart3,
  FolderOpen,
  CreditCard,
  CircleUser,
  Percent,
  ChevronRight,
  MapPin,
  Calendar,
  User,
  Briefcase,
  Check,
  X,
} from 'lucide-react';
import {
  addFooter,
  drawDocumentHeader,
  drawLegalVerificationFooter,
  drawPageBorder,
  drawSectionFrame,
  drawTotalsBlock,
  generateMandatBailleurPDF,
  getAutoTableTheme,
  saveGeneratedPdf,
} from '../lib/pdf';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { translateSupabaseError, getSuccessMessage } from '../lib/errorMessages';
import { formatDate, formatSenegalPhone, normalizeSenegalPhone, isValidSenegalPhone, formatSenegalPhoneInput } from '../lib/formatters';
import { formatPersonName } from '../lib/people';
import { PremiumFilterSelect } from '../components/ui/PremiumFilterSelect';
import { PremiumToolbar } from '../components/ui/PremiumToolbar';
import { PremiumTableSurface } from '../components/ui/PremiumTableSurface';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { MoneyText } from '../components/ui/MoneyText';
import { WizardShell, type WizardStep } from '../components/ui/WizardShell';
import { PremiumMobileCard } from '../components/ui/PremiumMobileCard';
import { resolveAgencySettingsAssets } from '../services/agencyIdentityAssets';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { PremiumButton } from '../components/ui/PremiumButton';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { useDirectRoute } from '../hooks/useDirectRoute';
import { PageSkeleton } from '../components/ui/Skeleton';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import {
  updateBailleurLifecycleViaEdge,
  type BailleurLifecycleStatus,
  type BailleurLifecycleImpacts,
} from '../services/api/bailleurApi';
import type { AgencySettings } from '../types/agency';
import {
  allocateDocumentReference,
  resolvePublishedDocumentTemplate,
} from '../services/documentTemplateService';
import { PageShell } from '../components/ui/PageShell';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumKpiGrid } from '../components/ui/PremiumKpiGrid';
import { MetricCard } from '../components/ui/MetricCard';
import { SplitViewShell } from '../components/ui/SplitViewShell';
import { PremiumDrawerShell } from '../components/ui/PremiumDrawerShell';
import { BrandMark } from '../components/brand/BrandLogo';
import { createOwnerReportSnapshot } from '../services/api/documentSnapshotApi';
import { runDocumentGeneration } from '../lib/documentGeneration';
import { BailleurCompliancePanel } from '../components/bailleurs/BailleurCompliancePanel';

/**
 * Interface Bailleur avec les champs commission et debut_contrat
 */
interface Bailleur {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  piece_identite: string | null;
  notes: string | null;
  commission: number | null;
  debut_contrat: string | null;
  actif: boolean;
  statut?: string | null;
  resiliation_date?: string | null;
  resiliation_motif?: string | null;
  resiliation_observations?: string | null;
  created_at: string;
  updated_at?: string;
}

interface FormData {
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  adresse: string;
  piece_identite: string;
  notes: string;
  commission: string;
  debut_contrat: string;
}

interface LifecycleFormData {
  statut: BailleurLifecycleStatus;
  date: string;
  motif: string;
  observations: string;
  acknowledge_impacts: boolean;
}

type BailleurWizardStep = 'identity' | 'admin' | 'summary';

const BAILLEUR_WIZARD_STEPS: WizardStep[] = [
  { id: 'identity', label: 'Identité', icon: <CircleUser className="h-4 w-4" /> },
  { id: 'admin', label: 'Gestion', icon: <Wallet className="h-4 w-4" /> },
  { id: 'summary', label: 'Validation', icon: <ShieldAlert className="h-4 w-4" /> },
];

interface DetailImmeuble {
  id: string;
  nom: string;
  adresse: string | null;
  quartier?: string | null;
  ville?: string | null;
  bailleur_id: string | null;
  nombre_unites?: number | null;
  actif?: boolean | null;
}

interface DetailUnite {
  id: string;
  nom: string;
  immeuble_id: string | null;
  loyer_base: number | null;
  statut: string | null;
  actif?: boolean | null;
}

interface DetailContrat {
  id: string;
  unite_id: string | null;
  date_debut: string | null;
  date_fin: string | null;
  loyer_mensuel: number | null;
  statut: string | null;
  locataires?: { nom?: string | null; prenom?: string | null } | null;
}

interface DetailPaiement {
  id: string;
  contrat_id: string | null;
  montant_total: number | null;
  part_agence: number | null;
  part_bailleur: number | null;
  reliquat: number | null;
  statut: string | null;
  mois_concerne: string | null;
  date_paiement: string | null;
  reference?: string | null;
  deleted_at?: string | null;
}

interface DetailDepense {
  id: string;
  immeuble_id: string | null;
  montant: number | null;
  date_depense: string | null;
  categorie: string | null;
  description: string | null;
  actif?: boolean | null;
  deleted_at?: string | null;
}

interface DetailDocument {
  id: string;
  name?: string | null;
  source?: string | null;
  document_category?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  bailleur_id?: string | null;
  lifecycle_status?: string | null;
  created_at?: string | null;
}

interface BailleurPageData {
  bailleurs: Bailleur[];
  immeubles: DetailImmeuble[];
  unites: DetailUnite[];
  contrats: DetailContrat[];
  paiements: DetailPaiement[];
  depenses: DetailDepense[];
  documents: DetailDocument[];
  agencySettings: Partial<AgencySettings> | null;
}

interface BailleurSummary {
  immeubles: DetailImmeuble[];
  unites: DetailUnite[];
  contrats: DetailContrat[];
  paiements: DetailPaiement[];
  depenses: DetailDepense[];
  documents: DetailDocument[];
  loyers: number;
  reliquats: number;
  commissions: number;
  net: number;
  occupiedUnits: number;
  activeContracts: number;
}

type DrawerTab = 'overview' | 'biens' | 'contrats' | 'paiements' | 'depenses' | 'rapports' | 'documents' | 'conformite';
type BailleurFilter = 'all' | 'with_reliquats' | 'without_reliquats' | 'with_biens' | 'without_biens' | 'high_commission' | 'active' | 'inactive' | 'with_net';

const EMPTY_PAGE_DATA: BailleurPageData = {
  bailleurs: [],
  immeubles: [],
  unites: [],
  contrats: [],
  paiements: [],
  depenses: [],
  documents: [],
  agencySettings: null,
};

type PdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

const DRAWER_PRIMARY_TABS: Array<{ id: DrawerTab; label: string }> = [
  { id: 'overview', label: 'Vue' },
  { id: 'rapports', label: 'Rapports' },
  { id: 'biens', label: 'Biens' },
  { id: 'paiements', label: 'Paiements' },
];

const DRAWER_MORE_TABS: Array<{ id: DrawerTab; label: string }> = [
  { id: 'documents', label: 'Docs' },
  { id: 'contrats', label: 'Contrats' },
  { id: 'depenses', label: 'Dépenses' },
  { id: 'conformite', label: 'Conformité' },
];

/**
 * Composant d'alerte pour les erreurs
 */
const ErrorAlert: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
  <div className="mb-3 px-3 py-2.5 bg-red-50/80 border border-red-200/60 rounded-md flex items-center gap-2">
    <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
    <div className="flex-1">
      <p className="text-[11px] font-medium text-red-800">{message}</p>
    </div>
    <button
      onClick={onClose}
      className="text-red-600 hover:text-red-900 transition rounded-sm hover:bg-red-100/50 p-0.5"
      title="Fermer"
      aria-label="Fermer"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
);

function EmptyDrawerState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-[14px] border border-dashed border-emerald-950/15 bg-[#fffdf7]/85 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
      <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50/85 text-emerald-800 ring-1 ring-emerald-100">
        <FolderOpen className="h-3.5 w-3.5" />
      </div>
      <p className="mt-2 text-[0.72rem] font-bold text-slate-950">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[0.62rem] leading-snug text-slate-500">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[0.65rem] font-bold text-emerald-800 transition hover:bg-emerald-100"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function CompactList({
  rows,
}: {
  rows: Array<{ id: string; title: string; subtitle: ReactNode; value?: ReactNode; badge?: string; onClick?: () => void }>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-emerald-950/10 bg-white/50 shadow-sm">
      {rows.map((row) => {
        const isClickable = !!row.onClick;
        const content = (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.65rem] font-bold text-slate-800">{row.title}</p>
              <p className="mt-0.5 line-clamp-1 text-[0.58rem] font-medium text-slate-500">{row.subtitle}</p>
            </div>
            <div className="shrink-0 flex flex-col items-end text-right">
              {row.value && <p className="text-[0.68rem] font-bold text-slate-800">{row.value}</p>}
              <div className="mt-0.5 flex items-center justify-end gap-1.5">
                {row.badge && <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-600 ring-1 ring-slate-200/50">{row.badge}</span>}
                {isClickable && <ChevronRight className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />}
              </div>
            </div>
          </>
        );

        return isClickable ? (
          <button
            key={row.id}
            type="button"
            onClick={row.onClick}
            className="group flex w-full items-center justify-between gap-2 border-b border-emerald-950/5 px-2.5 py-1.5 text-left transition last:border-b-0 hover:bg-emerald-50/50 focus-visible:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
            aria-label={`Ouvrir ${row.title}`}
          >
            {content}
          </button>
        ) : (
          <div
            key={row.id}
            className="flex items-center justify-between gap-2 border-b border-emerald-950/5 px-2.5 py-1.5 last:border-b-0"
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}


const todayInput = () => new Date().toISOString().split('T')[0];
const currentMonthInput = () => new Date().toISOString().slice(0, 7);

const formatCurrency = (value: number | null | undefined) => {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(safeAmount)).replace(/\u202f|\u00a0/g, ' ');
  return `${formatted} F CFA`;
};

const formatPdfNumber = (value: number | null | undefined) => {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(safeAmount)).replace(/\u202f|\u00a0/g, ' ');
};

const formatMonthLabel = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return 'Période non renseignée';
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1));
};

const getInitials = (bailleur?: Pick<Bailleur, 'prenom' | 'nom'> | null) => {
  const letters = [bailleur?.prenom?.[0], bailleur?.nom?.[0]].filter(Boolean).join('');
  return letters.toUpperCase() || 'SK';
};

const titleCaseName = (value: string) => value
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('fr-FR')
  .replace(/(^|[\s'-])(\p{L})/gu, (_, separator: string, letter: string) => `${separator}${letter.toLocaleUpperCase('fr-FR')}`);

const isValidPersonNamePart = (value: string) => {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.length < 2) return false;
  return /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u.test(cleaned);
};

const sanitizeSenegalCni = (value: string) => value.replace(/\D/g, '').slice(0, 17);

const formatSenegalCni = (value: string) => {
  const digits = sanitizeSenegalCni(value);
  const groups = [
    digits.slice(0, 1),
    digits.slice(1, 3),
    digits.slice(3, 11),
    digits.slice(11, 16),
    digits.slice(16, 17),
  ].filter(Boolean);
  return groups.join(' ');
};

const isValidSenegalCni = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return true;
  if (digits.length !== 17) return false;
  if (!['1', '2'].includes(digits[0])) return false;

  const birthDate = digits.slice(3, 11);
  const year = Number(birthDate.slice(0, 4));
  const month = Number(birthDate.slice(4, 6));
  const day = Number(birthDate.slice(6, 8));
  if (year < 1900 || year > new Date().getFullYear()) return false;
  if (month < 1 || month > 12) return false;

  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};

const getSenegalCniError = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length !== 17) return "Le numéro d'identité doit contenir 17 chiffres.";
  if (!['1', '2'].includes(digits[0])) return "Le numéro d'identité doit commencer par 1 ou 2.";
  return isValidSenegalCni(value) ? null : "La date de naissance de la pièce d'identité n'est pas valide.";
};

const displayBailleurName = (bailleur?: Pick<Bailleur, 'prenom' | 'nom'> | null) => {
  if (!bailleur) return 'Bailleur';
  return titleCaseName(formatPersonName(bailleur, 'Bailleur'));
};

const AVATAR_TONES = [
  'bg-emerald-100 text-emerald-800 ring-emerald-200/70',
  'bg-teal-100 text-teal-800 ring-teal-200/70',
  'bg-amber-100 text-amber-800 ring-amber-200/70',
  'bg-sky-100 text-sky-800 ring-sky-200/70',
  'bg-violet-100 text-violet-800 ring-violet-200/70',
  'bg-stone-100 text-stone-800 ring-stone-200/70',
];

const getAvatarTone = (bailleur?: Pick<Bailleur, 'id' | 'prenom' | 'nom'> | null, selected = false) => {
  if (selected) return 'bg-emerald-800 text-white ring-emerald-700/70';
  const seed = `${bailleur?.id ?? ''}${bailleur?.prenom ?? ''}${bailleur?.nom ?? ''}`;
  const total = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_TONES[total % AVATAR_TONES.length];
};

const getStatusLabel = (bailleur: Bailleur) => {
  if (bailleur.statut && bailleur.statut !== 'actif') return bailleur.statut;
  return bailleur.actif ? 'Actif' : 'Inactif';
};

const getDocumentRoleLabel = (document: DetailDocument) => {
  const raw = [document.document_category, document.entity_type, document.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (raw.includes('mandat')) return 'Mandat';
  if (raw.includes('contrat') || raw.includes('bail')) return 'Contrat';
  if (raw.includes('quittance') || raw.includes('facture')) return 'Quittance';
  if (raw.includes('rapport') || raw.includes('bilan')) return 'Rapport';
  return 'Document';
};

const isReportDocument = (document: DetailDocument) => getDocumentRoleLabel(document) === 'Rapport';

const emptySummary = (): BailleurSummary => ({
  immeubles: [],
  unites: [],
  contrats: [],
  paiements: [],
  depenses: [],
  documents: [],
  loyers: 0,
  reliquats: 0,
  commissions: 0,
  net: 0,
  occupiedUnits: 0,
  activeContracts: 0,
});

function buildBailleurSummary(bailleurId: string, data: BailleurPageData): BailleurSummary {
  const immeubles = data.immeubles.filter((item) => item.bailleur_id === bailleurId && item.actif !== false);
  const immeubleIds = new Set(immeubles.map((item) => item.id));
  const unites = data.unites.filter((item) => item.immeuble_id && immeubleIds.has(item.immeuble_id) && item.actif !== false);
  const uniteIds = new Set(unites.map((item) => item.id));
  const contrats = data.contrats.filter((item) => item.unite_id && uniteIds.has(item.unite_id));
  const contratIds = new Set(contrats.map((item) => item.id));
  const paiements = data.paiements.filter((item) => item.contrat_id && contratIds.has(item.contrat_id) && item.deleted_at == null && item.statut !== 'annule');
  const depenses = data.depenses.filter((item) => item.immeuble_id && immeubleIds.has(item.immeuble_id) && item.deleted_at == null && item.actif !== false);
  const entityIds = new Set<string>([
    bailleurId,
    ...immeubles.map((item) => item.id),
    ...unites.map((item) => item.id),
    ...contrats.map((item) => item.id),
    ...paiements.map((item) => item.id),
  ]);
  const documents = data.documents.filter((item) => {
    if (item.lifecycle_status === 'deleted' || item.lifecycle_status === 'archived') return false;
    if (item.entity_id === bailleurId && item.entity_type === 'bailleur') return true;
    return Boolean(item.entity_id && entityIds.has(item.entity_id));
  });

  return {
    immeubles,
    unites,
    contrats,
    paiements,
    depenses,
    documents,
    loyers: paiements.reduce((sum, item) => sum + Number(item.montant_total ?? 0), 0),
    reliquats: paiements.reduce((sum, item) => sum + Math.max(Number(item.reliquat ?? 0), 0), 0),
    commissions: paiements.reduce((sum, item) => sum + Number(item.part_agence ?? 0), 0),
    net: paiements.reduce((sum, item) => sum + Number(item.part_bailleur ?? 0), 0),
    occupiedUnits: unites.filter((item) => item.statut === 'loue').length,
    activeContracts: contrats.filter((item) => item.statut === 'actif').length,
  };
}

/**
 * Composant principal - Gestion des Bailleurs
 */
export function Bailleurs() {
  const { user, profile, accountProfile } = useAuth();
  const toast = useToast();

  const { clearDirectRouteParams } = useDirectRoute({
    onNew: () => {
      setEditingBailleur(null);
      setBailleurWizardStep('identity');
      setIsModalOpen(true);
    },
    onSelectId: (id, params) => {
      setSelectedBailleurId(id);
      setDetailOpen(true);
      const tab = params.get('tab') as DrawerTab | null;
      if (tab) setActiveDrawerTab(tab);
    },
  });

  // États
  const [bailleurs, setBailleurs] = useState<Bailleur[]>([]);
  const [pageData, setPageData] = useState<BailleurPageData>(EMPTY_PAGE_DATA);
  const [selectedBailleurId, setSelectedBailleurId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<DrawerTab>('overview');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState<BailleurFilter>('all');
  const [reportMonth, setReportMonth] = useState(currentMonthInput);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBailleur, setEditingBailleur] = useState<Bailleur | null>(null);
  const [bailleurWizardStep, setBailleurWizardStep] = useState<BailleurWizardStep>('identity');
  const [isDirty, setIsDirty] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lifecycleTarget, setLifecycleTarget] = useState<Bailleur | null>(null);
  const [lifecycleForm, setLifecycleForm] = useState<LifecycleFormData>({
    statut: 'resilie',
    date: todayInput(),
    motif: '',
    observations: '',
    acknowledge_impacts: false,
  });
  const [lifecycleImpacts, setLifecycleImpacts] = useState<BailleurLifecycleImpacts | null>(null);
  const [loadingImpacts, setLoadingImpacts] = useState(false);
  const [isLifecycleSubmitting, setIsLifecycleSubmitting] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);

  // État du formulaire avec commission et debut_contrat
  const [formData, setFormData] = useState<FormData>({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    adresse: '',
    piece_identite: '',
    notes: '',
    commission: '',
    debut_contrat: '',
  });

  const resetForm = useCallback(() => {
    setFormData({
      nom: '',
      prenom: '',
      telephone: '',
      email: '',
      adresse: '',
      piece_identite: '',
      notes: '',
      commission: '',
      debut_contrat: '',
    });
    setBailleurWizardStep('identity');
    setIsDirty(false);
  }, []);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBailleur(null);
    resetForm();
    setError(null);
    clearDirectRouteParams();
  };

  /**
   * Fonction de chargement des bailleurs
   */
  const loadBailleurs = useCallback(async () => {
    if (!profile?.agency_id) return;

    try {
      if (bailleurs.length === 0) setLoading(true);
      setError(null);

      const result = await readWithCache<BailleurPageData>(
        { agencyId: profile.agency_id, userId: user?.id ?? null },
        'bailleurs-page',
        async () => {
          const [
            bailleursRes,
            immeublesRes,
            unitesRes,
            contratsRes,
            paiementsRes,
            depensesRes,
            settingsRes,
          ] = await Promise.all([
            supabase
              .from('bailleurs')
              .select('*')
              .eq('agency_id', profile.agency_id)
              .eq('actif', true)
              .order('created_at', { ascending: false }),
            supabase
              .from('immeubles')
              .select('id, nom, adresse, quartier, ville, bailleur_id, nombre_unites, actif')
              .eq('agency_id', profile.agency_id),
            supabase
              .from('unites')
              .select('id, nom, immeuble_id, loyer_base, statut, actif')
              .eq('agency_id', profile.agency_id),
            supabase
              .from('contrats')
              .select('id, unite_id, date_debut, date_fin, loyer_mensuel, statut, locataires(nom, prenom)')
              .eq('agency_id', profile.agency_id),
            supabase
              .from('paiements')
              .select('id, contrat_id, montant_total, part_agence, part_bailleur, reliquat, statut, mois_concerne, date_paiement, reference, deleted_at')
              .eq('agency_id', profile.agency_id),
            supabase
              .from('depenses')
              .select('id, immeuble_id, montant, date_depense, categorie, description, actif, deleted_at')
              .eq('agency_id', profile.agency_id),
            supabase
              .from('agency_settings')
              .select('agency_id, nom_agence, adresse, telephone, email, site_web, ninea, rc, logo_url, couleur_primaire, couleur_secondaire, pied_page_personnalise')
              .eq('agency_id', profile.agency_id)
              .maybeSingle(),
          ]);

          if (bailleursRes.error) throw bailleursRes.error;
          if (immeublesRes.error) throw immeublesRes.error;
          if (unitesRes.error) throw unitesRes.error;
          if (contratsRes.error) throw contratsRes.error;
          if (paiementsRes.error) throw paiementsRes.error;
          if (depensesRes.error) throw depensesRes.error;
          if (settingsRes.error) throw settingsRes.error;

          let documents: DetailDocument[] = [];
          const [documentsRes, registryRes] = await Promise.all([
            supabase
              .from('documents')
              .select('id, name, document_category, entity_type, entity_id, lifecycle_status, created_at')
              .eq('agency_id', profile.agency_id)
              .limit(300),
            supabase
              .from('document_registry')
              .select('id, reference, document_type, entity_id, status, generated_at')
              .eq('agency_id', profile.agency_id)
              .limit(300),
          ]);
          const rawDocs = (documentsRes.data || []) as DetailDocument[];
          type RegistryDocumentRow = {
            id: string;
            reference: string | null;
            document_type: string | null;
            entity_id: string | null;
            status: string | null;
            generated_at: string | null;
          };
          const regDocs: DetailDocument[] = ((registryRes.data || []) as RegistryDocumentRow[]).map((r) => ({
            id: r.id,
            name: r.reference || r.document_type || 'Document généré',
            document_category: r.document_type,
            entity_type: 'registry',
            entity_id: r.entity_id,
            lifecycle_status: r.status,
            created_at: r.generated_at || new Date().toISOString(),
          }));
          documents = [...rawDocs, ...regDocs];

          return {
            bailleurs: (bailleursRes.data || []) as Bailleur[],
            immeubles: (immeublesRes.data || []) as DetailImmeuble[],
            unites: (unitesRes.data || []) as DetailUnite[],
            contrats: (contratsRes.data || []) as DetailContrat[],
            paiements: (paiementsRes.data || []) as DetailPaiement[],
            depenses: (depensesRes.data || []) as DetailDepense[],
            documents,
            agencySettings: (settingsRes.data || null) as Partial<AgencySettings> | null,
          };
        },
        { timeoutMs: 7_000 },
      );

      setPageData(result.data);
      setBailleurs(result.data.bailleurs);
      setCacheTimestamp(result.source === 'cache' ? result.timestamp : null);
    } catch (err) {
      console.error('Erreur lors du chargement des bailleurs:', err);
      const errorMessage = translateSupabaseError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [bailleurs.length, profile?.agency_id, toast, user?.id]);

  /**
   * Chargement initial des bailleurs
   */
  useEffect(() => {
    if (profile?.agency_id) {
      loadBailleurs();
    }
  }, [loadBailleurs, profile?.agency_id]);

  /**
   * Recherche textuelle des bailleurs
   */
  const searchedBailleurs = useMemo(() => {
    if (!searchTerm.trim()) return bailleurs;

    const searchLower = searchTerm.toLowerCase();
    return bailleurs.filter(b => {
      const searchableText = [
        formatPersonName(b, ''),
        b.telephone,
        b.email || '',
        b.adresse || '',
        b.piece_identite || ''
      ].join(' ').toLowerCase();

      return searchableText.includes(searchLower);
    });
  }, [searchTerm, bailleurs]);

  const summariesByBailleur = useMemo(() => {
    return bailleurs.reduce<Record<string, BailleurSummary>>((acc, bailleur) => {
      acc[bailleur.id] = buildBailleurSummary(bailleur.id, pageData);
      return acc;
    }, {});
  }, [bailleurs, pageData]);

  /**
   * Filtrage métier des bailleurs, combiné avec la recherche.
   */
  const filteredBailleurs = useMemo(() => {
    return searchedBailleurs.filter((bailleur) => {
      const summary = summariesByBailleur[bailleur.id] ?? emptySummary();
      switch (activeFilter) {
        case 'with_reliquats':
          return summary.reliquats > 0;
        case 'without_reliquats':
          return summary.reliquats <= 0;
        case 'with_biens':
          return summary.immeubles.length > 0;
        case 'without_biens':
          return summary.immeubles.length === 0;
        case 'high_commission':
          return Number(bailleur.commission ?? 0) >= 10;
        case 'active':
          return bailleur.actif && (bailleur.statut ?? 'actif') === 'actif';
        case 'inactive':
          return !bailleur.actif || (bailleur.statut != null && bailleur.statut !== 'actif');
        case 'with_net':
          return summary.net > 0;
        case 'all':
        default:
          return true;
      }
    });
  }, [activeFilter, searchedBailleurs, summariesByBailleur]);

  useEffect(() => {
    if (loading || bailleurs.length === 0) return;
    if (selectedBailleurId && !bailleurs.some((item) => item.id === selectedBailleurId)) {
      setSelectedBailleurId(null);
      setDetailOpen(false);
    }
  }, [loading, bailleurs, selectedBailleurId]);

  const selectedBailleur = useMemo(
    () => bailleurs.find((item) => item.id === selectedBailleurId) ?? null,
    [bailleurs, selectedBailleurId],
  );
  const selectedSummary = selectedBailleur ? summariesByBailleur[selectedBailleur.id] ?? emptySummary() : emptySummary();
  const detailPanelOpen = detailOpen && !!selectedBailleur;
  const bailleurWizardStepIndex = Math.max(0, BAILLEUR_WIZARD_STEPS.findIndex((step) => step.id === bailleurWizardStep));

  const globalKpis = useMemo(() => {
    const summaries = Object.values(summariesByBailleur);
    return {
      activeBailleurs: bailleurs.filter((item) => item.actif && (item.statut ?? 'actif') === 'actif').length,
      reliquats: summaries.reduce((sum, item) => sum + item.reliquats, 0),
      net: summaries.reduce((sum, item) => sum + item.net, 0),
      commissions: summaries.reduce((sum, item) => sum + item.commissions, 0),
      immeubles: summaries.reduce((sum, item) => sum + item.immeubles.length, 0),
      unites: summaries.reduce((sum, item) => sum + item.unites.length, 0),
    };
  }, [bailleurs, summariesByBailleur]);

  /**
   * Soumission du formulaire
   */
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Validation basique
    if (!formData.prenom.trim() || !formData.nom.trim() || !formData.telephone.trim()) {
      setError('Les champs Prénom, Nom et Téléphone sont obligatoires.');
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('Connexion indisponible : enregistrement impossible hors ligne.');
      toast.error('Connexion indisponible : enregistrement impossible hors ligne.');
      return;
    }

    const normalizedPhone = normalizeSenegalPhone(formData.telephone);
    if (!normalizedPhone) {
      setError('Le numéro de téléphone doit être un numéro sénégalais valide, par exemple 77 123 45 67.');
      return;
    }

    if (!formData.debut_contrat) {
      setError('La date de début du contrat est obligatoire.');
      return;
    }

    if (!isValidPersonNamePart(formData.prenom) || !isValidPersonNamePart(formData.nom)) {
      setError("Le prénom et le nom doivent contenir uniquement des lettres, espaces, apostrophes ou tirets.");
      return;
    }

    const cniError = getSenegalCniError(formData.piece_identite);
    if (cniError) {
      setError(cniError);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const commissionNum = typeof formData.commission === 'string' ? parseFloat(formData.commission) : formData.commission;
      const normalizedIdentityNumber = sanitizeSenegalCni(formData.piece_identite);
      const bailleurData = {
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim(),
        telephone: normalizedPhone,
        email: formData.email.trim() || null,
        adresse: formData.adresse.trim() || null,
        piece_identite: normalizedIdentityNumber || null,
        notes: formData.notes.trim() || null,
        commission: commissionNum || 0,
        debut_contrat: formData.debut_contrat,
        updated_at: new Date().toISOString(),
      };

      if (editingBailleur) {
        const { error: updateError } = await supabase
          .from('bailleurs')
          .update(bailleurData)
          .eq('id', editingBailleur.id);

        if (updateError) throw updateError;
        toast.success(getSuccessMessage('update', 'Bailleur'));
      } else {
        // Création
        const { error: insertError } = await supabase
          .from('bailleurs')
          .insert([{
            ...bailleurData,
            agency_id: profile?.agency_id,
            created_by: user?.id,
            actif: true
          }]);

        if (insertError) throw insertError;
        toast.success(getSuccessMessage('create', 'Bailleur'));
      }

      closeModal();
      if (profile?.agency_id && profile?.id) {
        await invalidateOperationalCaches(
          { agencyId: profile.agency_id, userId: profile.id },
          ['bailleurs', 'patrimoine', 'dashboard', 'finances', 'documents'],
        );
        notifyDataChanged(['bailleurs', 'patrimoine', 'dashboard', 'finances', 'documents']);
      }
      await loadBailleurs();
    } catch (err: unknown) {
      console.error('Erreur lors de l\'enregistrement:', err);
      const errorMessage = translateSupabaseError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Ouverture du modal en mode édition
   */
  const handleEdit = useCallback((bailleur: Bailleur) => {
    setEditingBailleur(bailleur);
    setFormData({
      nom: bailleur.nom,
      prenom: bailleur.prenom,
      telephone: formatSenegalPhone(bailleur.telephone, ''),
      email: bailleur.email || '',
      adresse: bailleur.adresse || '',
      piece_identite: formatSenegalCni(bailleur.piece_identite || ''),
      notes: bailleur.notes || '',
      commission: bailleur.commission ? bailleur.commission.toString() : '',
      debut_contrat: bailleur.debut_contrat || '',
    });
    setError(null);
    setBailleurWizardStep('identity');
    setIsModalOpen(true);
  }, []);

  const loadLifecycleImpacts = async (bailleur: Bailleur) => {
    if (!profile?.agency_id) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLifecycleImpacts(null);
      setLoadingImpacts(false);
      return;
    }
    setLoadingImpacts(true);
    try {
      const { data: immeubles } = await supabase
        .from('immeubles')
        .select('id')
        .eq('agency_id', profile.agency_id)
        .eq('bailleur_id', bailleur.id)
        .eq('actif', true);

      const immeubleIds = (immeubles || []).map((row) => row.id);
      let unitesLiees = 0;
      let contratsActifs = 0;

      if (immeubleIds.length > 0) {
        const { data: unites } = await supabase
          .from('unites')
          .select('id')
          .eq('agency_id', profile.agency_id)
          .in('immeuble_id', immeubleIds);

        const uniteIds = (unites || []).map((row) => row.id);
        unitesLiees = uniteIds.length;

        if (uniteIds.length > 0) {
          const { count } = await supabase
            .from('contrats')
            .select('id', { count: 'exact', head: true })
            .eq('agency_id', profile.agency_id)
            .eq('statut', 'actif')
            .in('unite_id', uniteIds);
          contratsActifs = count ?? 0;
        }
      }

      setLifecycleImpacts({
        immeubles_actifs: immeubleIds.length,
        unites_liees: unitesLiees,
        contrats_actifs: contratsActifs,
      });
    } catch (err) {
      console.error('Erreur lors du calcul des impacts bailleur:', err);
      setLifecycleImpacts(null);
    } finally {
      setLoadingImpacts(false);
    }
  };

  const handleCloseAttempt = () => {
    if (isDirty) setShowCloseConfirm(true);
    else closeModal();
  };

  const handleConfirmClose = () => {
    setShowCloseConfirm(false);
    closeModal();
  };

  const openModal = (bailleur?: Bailleur) => {
    if (bailleur) handleEdit(bailleur);
    else {
      setEditingBailleur(null);
      resetForm();
      setIsModalOpen(true);
    }
  };

  const openLifecycleModal = (bailleur: Bailleur) => {
    setLifecycleTarget(bailleur);
    setLifecycleForm({
      statut: 'resilie',
      date: todayInput(),
      motif: '',
      observations: '',
      acknowledge_impacts: false,
    });
    setLifecycleImpacts(null);
    setError(null);
    void loadLifecycleImpacts(bailleur);
  };

  const closeLifecycleModal = () => {
    if (isLifecycleSubmitting) return;
    setLifecycleTarget(null);
    setLifecycleImpacts(null);
    setLifecycleForm({
      statut: 'resilie',
      date: todayInput(),
      motif: '',
      observations: '',
      acknowledge_impacts: false,
    });
    setIsDirty(false);
  };

  const confirmLifecycle = async () => {
    if (!lifecycleTarget) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('Connexion indisponible : cette action métier doit être confirmée par le serveur.');
      return;
    }
    if (!lifecycleForm.motif.trim() || lifecycleForm.motif.trim().length < 3) {
      setError('Le motif doit contenir au moins 3 caractères.');
      return;
    }
    if (!lifecycleForm.date) {
      setError("La date de prise d'effet est obligatoire.");
      return;
    }

    try {
      setIsLifecycleSubmitting(true);
      setError(null);
      await updateBailleurLifecycleViaEdge({
        id: lifecycleTarget.id,
        statut: lifecycleForm.statut,
        date: lifecycleForm.date,
        motif: lifecycleForm.motif.trim(),
        observations: lifecycleForm.observations.trim() || null,
        acknowledge_impacts: lifecycleForm.acknowledge_impacts,
      });
      toast.success('Cycle de vie du bailleur mis à jour');
      setLifecycleTarget(null);
      setLifecycleImpacts(null);
      if (profile?.agency_id && profile?.id) {
        await invalidateOperationalCaches(
          { agencyId: profile.agency_id, userId: profile.id },
          ['bailleurs', 'patrimoine', 'dashboard', 'finances'],
        );
        notifyDataChanged(['bailleurs', 'patrimoine', 'dashboard', 'finances']);
      }
      await loadBailleurs();
    } catch (err) {
      console.error('Erreur cycle de vie bailleur:', err);
      const errorMessage = err instanceof Error ? err.message : translateSupabaseError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLifecycleSubmitting(false);
    }
  };

  /**
   * Génération du PDF du mandat
   */
  const handleGenerateMandat = async (bailleur: Bailleur) => {
    try {
      await runDocumentGeneration({
        key: `mandat:${profile?.agency_id ?? 'tenant'}:${bailleur.id}`,
        kind: 'mandat',
        title: 'Préparation du mandat de gestion',
        source: 'bailleurs',
        archiveExpected: true,
        verificationExpected: true,
      }, async (generation) => {
        await generateMandatBailleurPDF(
          bailleur as unknown as Parameters<typeof generateMandatBailleurPDF>[0],
          generation,
        );
      });
    } catch (err) {
      console.error('Erreur génération PDF:', err);
      setError('Impossible de générer le mandat PDF.');
    }
  };

  const handleGenerateBailleurReport = async (bailleur: Bailleur) => {
    try {
      setGeneratingReport(true);
      await runDocumentGeneration({
        key: `rapport-bailleur:${profile?.agency_id ?? 'tenant'}:${bailleur.id}:${reportMonth}`,
        kind: 'bilan',
        title: accountProfile.isIndividualOwner ? 'Préparation du résumé propriétaire' : 'Préparation du rapport bailleur',
        source: 'bailleurs',
        archiveExpected: true,
        verificationExpected: true,
      }, async (generation) => {
      if (!profile?.agency_id) throw new Error('Organisation introuvable.');
      const snapshot = await createOwnerReportSnapshot({
        agencyId: profile.agency_id,
        bailleurId: bailleur.id,
        month: reportMonth,
        documentKind: accountProfile.isIndividualOwner ? 'rapport_proprietaire' : 'rapport_bailleur',
      });
      const reportData = snapshot.payload;
      const reportDepenses = reportData.expenses;
      const totalLoyers = Number(reportData.totals.collected);
      const totalReliquats = Number(reportData.totals.arrears);
      const totalCommissions = Number(reportData.totals.commissions);
      const totalDepenses = Number(reportData.totals.expenses);
      const totalNet = Number(reportData.totals.netToPay);
      const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const settings = await resolveAgencySettingsAssets({
        ...(pageData.agencySettings ?? {}),
        agency_id: pageData.agencySettings?.agency_id ?? profile?.agency_id ?? undefined,
        is_bailleur_account: accountProfile.isIndividualOwner,
        organization_type: accountProfile.type,
      });
      const reportTemplateType = accountProfile.isIndividualOwner ? 'rapport_proprietaire' : 'rapport_bailleur';
      const reportTemplate = await resolvePublishedDocumentTemplate(reportTemplateType, settings.agency_id);
      settings.document_preferences = {
        ...(settings.document_preferences ?? {}),
        header_style: reportTemplate.content.style.header,
        show_document_number: reportTemplate.content.style.showDocumentNumber,
      };
      if (!reportTemplate.content.style.showLogo) settings.logo_url = null;
      const enabledReportSections = new Set(
        reportTemplate.content.blocks
          .filter((block) => block.enabled && block.systemKey)
          .map((block) => block.systemKey),
      );
      const periodLabel = formatMonthLabel(reportMonth);
      const reportRef = await allocateDocumentReference({
        documentType: reportTemplateType,
        entityId: bailleur.id,
        periodKey: reportMonth,
        format: settings.document_preferences?.numbering_format,
        prefix: settings.document_preferences?.prefixes?.rapport ?? 'RPT',
        fallback: `RBL-${reportMonth}-${bailleur.id.slice(0, 8).toUpperCase()}`,
      });
      generation.report('building-document', { reference: reportRef });
      const reportTitle = accountProfile.isIndividualOwner ? 'Résumé mensuel propriétaire' : 'Rapport mensuel bailleur';
      const netLabel = accountProfile.isIndividualOwner ? 'Revenus nets' : 'Net à reverser';
      const tableTheme = getAutoTableTheme(settings);
      const recoveryRate = Number(reportData.totals.recoveryRate);

      drawPageBorder(doc, settings);
      let y = await drawDocumentHeader(doc, settings, reportTitle, formatPersonName(bailleur, ''), {
        reference: reportRef,
        issueDate: new Date().toLocaleDateString('fr-FR'),
        documentType: 'Rapport financier',
      }) + 8;

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - 26) {
          addFooter(doc, settings);
          doc.addPage();
          drawPageBorder(doc, settings);
          y = 24;
        }
      };

      const sectionTitle = (title: string, subtitle?: string) => {
        ensureSpace(subtitle ? 18 : 12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        doc.text(title, 14, y);
        if (subtitle) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.2);
          doc.setTextColor(100, 116, 139);
          doc.text(subtitle, 14, y + 5);
          y += 10;
        } else {
          y += 5.5;
        }
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.12);
        doc.line(14, y, pageWidth - 14, y);
        y += 5.5;
      };

      sectionTitle('Indicateurs du mois', `Période analysée : ${periodLabel}`);
      const indicatorItems: Array<[string, string]> = [
        ...(enabledReportSections.has('collections') ? [['Loyers encaissés', formatCurrency(totalLoyers)] as [string, string]] : []),
        ...(enabledReportSections.has('arrears') ? [['Reliquats à suivre', formatCurrency(totalReliquats)] as [string, string]] : []),
        ...(enabledReportSections.has('commissions') && !accountProfile.isIndividualOwner
          ? [['Commissions agence', formatCurrency(totalCommissions)] as [string, string]]
          : []),
        [netLabel, formatCurrency(totalNet)],
        ['Taux de recouvrement', `${recoveryRate}%`],
        ...(enabledReportSections.has('occupancy')
          ? [[
              'Biens concernés',
              String(new Set(reportData.contracts.map((contract) => contract.immeuble_id)).size),
            ] as [string, string]]
          : []),
      ];
      const indicatorBody: string[][] = [];
      for (let index = 0; index < indicatorItems.length; index += 2) {
        const left = indicatorItems[index];
        const right = indicatorItems[index + 1] ?? ['', ''];
        indicatorBody.push([left[0], left[1], right[0], right[1]]);
      }
      autoTable(doc, {
        body: indicatorBody,
        startY: y,
        theme: 'grid',
        ...tableTheme,
        styles: {
          ...tableTheme.styles,
          fontSize: 8.5,
          cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
        },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 42 },
          1: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 40 },
          2: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 44 },
          3: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
        },
      });
      y = ((doc as PdfWithAutoTable).lastAutoTable?.finalY ?? y) + 11;

      sectionTitle('Synthèse propriétaire');
      const summaryText = [
        `Sur la période ${periodLabel}, ${formatPersonName(bailleur, '')} présente ${formatCurrency(totalLoyers)} de loyers encaissés.`,
        enabledReportSections.has('arrears') && totalReliquats > 0
          ? `Les reliquats ouverts représentent ${formatCurrency(totalReliquats)} et doivent rester prioritaires dans le suivi de gestion.`
          : enabledReportSections.has('arrears')
            ? "Aucun reliquat significatif n'est rattaché aux paiements enregistrés sur cette période."
            : '',
        `Le montant ${netLabel.toLowerCase()} ressort à ${formatCurrency(totalNet)}.`,
      ].join(' ');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const summaryLines = doc.splitTextToSize(summaryText, 178);
      doc.text(summaryLines, 14, y);
      y += summaryLines.length * 4.7 + 9;

      const rows = reportData.contracts.map((contract) => ({
        id: contract.contrat_id,
        immeuble: contract.immeuble || 'Bien non renseigné',
        unite: contract.unite || 'Unité non renseignée',
        locataire: contract.locataire || 'Locataire non renseigné',
        loyer: formatPdfNumber(Number(contract.loyer_mensuel)),
        statut: Number(contract.reliquat) > 0 ? 'Partiel' : 'Soldé',
        encaisse: formatPdfNumber(Number(contract.encaisse)),
        reliquat: formatPdfNumber(Number(contract.reliquat)),
        net: formatPdfNumber(Number(contract.part_bailleur)),
      }));

      if (enabledReportSections.has('collections') || enabledReportSections.has('occupancy')) {
      sectionTitle('Détail par bien', 'Lecture par immeuble, unité, locataire et situation financière.');
      autoTable(doc, {
        head: [['Bien', 'Unité', 'Locataire', 'Loyer (F CFA)', 'Statut', 'Encaissé (F CFA)', 'Reliquat (F CFA)', 'Net (F CFA)']],
        body: rows.length
          ? rows.map((row) => [row.immeuble, row.unite, row.locataire, row.loyer, row.statut, row.encaisse, row.reliquat, row.net])
          : [['-', '-', 'Aucun paiement enregistré sur la période', '-', '-', '-', '-', '-']],
        startY: y,
        theme: 'grid',
        ...tableTheme,
        styles: {
          ...tableTheme.styles,
          fontSize: 7.4,
          cellPadding: { top: 2.4, right: 2.1, bottom: 2.4, left: 2.1 },
          overflow: 'linebreak',
        },
        headStyles: {
          ...tableTheme.headStyles,
          fontSize: 7.2,
        },
        margin: { left: 14, right: 14 },
        columnStyles: {
          3: { halign: 'right', cellWidth: 20 },
          5: { halign: 'right', cellWidth: 22 },
          6: { halign: 'right', cellWidth: 22 },
          7: { halign: 'right', cellWidth: 24 },
        },
      });
      y = ((doc as PdfWithAutoTable).lastAutoTable?.finalY ?? y) + 10;
      }

      // --- DIAGRAMME FINANCIER ---
      if (enabledReportSections.has('collections') || enabledReportSections.has('expenses') || enabledReportSections.has('commissions')) {
        sectionTitle('Répartition financière');
        const chartY = y;

        const chartData = [
          { label: 'Revenus bruts', value: totalLoyers, color: [16, 185, 129] as [number, number, number] },
          { label: 'Déductions', value: totalCommissions + totalDepenses, color: [244, 63, 94] as [number, number, number] },
          { label: netLabel, value: totalNet, color: [15, 23, 42] as [number, number, number] }
        ];

        const maxVal = Math.max(...chartData.map(d => d.value));
        const chartWidth = 110;
        const barHeight = 5.5;
        const spacing = 4.5;

        chartData.forEach((item, idx) => {
          const itemY = chartY + idx * (barHeight + spacing);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(71, 85, 105);
          doc.text(item.label, 14, itemY + 4);

          const barWidth = maxVal > 0 ? (item.value / maxVal) * chartWidth : 0;

          doc.setFillColor(241, 245, 249);
          doc.roundedRect(42, itemY, chartWidth, barHeight, 1, 1, 'F');

          if (barWidth > 0) {
            doc.setFillColor(...item.color);
            doc.roundedRect(42, itemY, barWidth, barHeight, 1, 1, 'F');
          }

          doc.setTextColor(15, 23, 42);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.text(formatCurrency(item.value), 42 + chartWidth + 6, itemY + 4);
        });

        y = chartY + chartData.length * (barHeight + spacing) + 12;
      }
      // --- FIN DIAGRAMME ---

      if (enabledReportSections.has('expenses') && reportDepenses.length > 0) {
        ensureSpace(34);
        sectionTitle('Dépenses rattachées');
        autoTable(doc, {
          head: [['Date', 'Catégorie', 'Description', 'Montant']],
          body: reportDepenses.slice(0, 12).map((depense) => [
            formatDate(depense.date_depense),
            depense.categorie ?? 'Dépense',
            depense.description ?? 'Sans description',
            formatCurrency(depense.montant),
          ]),
          startY: y,
          theme: 'grid',
          ...tableTheme,
          margin: { left: 14, right: 14 },
          columnStyles: { 3: { halign: 'right' } },
        });
        y = ((doc as PdfWithAutoTable).lastAutoTable?.finalY ?? y) + 10;
      }

      ensureSpace(42);
      y = drawTotalsBlock(
        doc,
        14,
        y,
        pageWidth - 28,
        [
          ...(enabledReportSections.has('collections') ? [{ label: 'Loyers encaissés', value: formatCurrency(totalLoyers) }] : []),
          ...(enabledReportSections.has('arrears') ? [{ label: 'Reliquats à suivre', value: formatCurrency(totalReliquats) }] : []),
          ...(accountProfile.isIndividualOwner && enabledReportSections.has('expenses')
            ? [{ label: 'Dépenses', value: formatCurrency(totalDepenses) }]
            : !accountProfile.isIndividualOwner && enabledReportSections.has('commissions')
              ? [{ label: 'Commissions agence', value: formatCurrency(totalCommissions) }]
              : []),
          { label: netLabel, value: formatCurrency(totalNet), emphasis: true },
        ],
        settings,
      );

      ensureSpace(34);
      const closingY = drawSectionFrame(doc, 14, y, pageWidth - 28, 30, settings, {
        title: 'Reversement et authentification',
        subtitle: `${netLabel} : ${formatCurrency(totalNet)}`,
        accent: 'neutral',
      });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(71, 85, 105);
      const closingLines = doc.splitTextToSize(
        `Aucune note particulière pour cette période. Le rapport consolide les encaissements, reliquats, ${accountProfile.isIndividualOwner ? 'dépenses' : 'commissions'} et montants nets issus du registre financier Samay Këur.`,
        pageWidth - 42,
      );
      doc.text(closingLines, 19, closingY);
      y += 38;

      const reportQrEnabled =
        reportTemplate.content.style.showQr &&
        enabledReportSections.has('qr_verification');
      if (reportQrEnabled) {
        generation.report('securing-document', {
          reference: reportRef,
          verificationStatus: 'pending',
        });
        await drawLegalVerificationFooter(doc, {
          ref: reportRef,
          type: 'rapport_bailleur',
          agency: settings.nom_agence ?? 'Samay Këur',
          date: new Date().toISOString(),
          settings,
        });
      }
      addFooter(doc, settings);

      await saveGeneratedPdf(doc, {
        kind: 'bilan',
        title: accountProfile.isIndividualOwner ? 'Résumé mensuel propriétaire' : 'Rapport bailleur',
        fileName: `${accountProfile.isIndividualOwner ? 'resume-proprietaire' : 'rapport-bailleur'}-${bailleur.nom}-${reportMonth}.pdf`,
        source: 'bailleurs',
        documentType: 'rapport_bailleur',
        entityId: bailleur.id,
        period: reportMonth,
        reference: reportRef,
        generation,
        verificationExpected: reportQrEnabled,
        metadata: {
          documentType: accountProfile.isIndividualOwner
            ? 'rapport_proprietaire'
            : 'rapport_bailleur',
          reference: reportRef,
          agencyName: settings.nom_agence ?? 'Samay Këur',
          subject: accountProfile.isIndividualOwner
            ? 'Résumé financier mensuel propriétaire'
            : 'Rapport financier de gestion locative',
          partyName: formatPersonName(bailleur, ''),
          period: periodLabel,
          createdAt: new Date(),
        },
        data: {
          document: 'rapport_bailleur',
          reportMonth,
          bailleur,
          financialSnapshot: {
            id: snapshot.snapshotId,
            fingerprint: snapshot.fingerprint,
            createdAt: snapshot.createdAt,
            schemaVersion: reportData.schemaVersion,
          },
          totals: { totalLoyers, totalReliquats, totalCommissions, totalDepenses, totalNet, recoveryRate },
          template: {
            revisionId: reportTemplate.revisionId,
            revision: reportTemplate.revision,
            checksum: reportTemplate.checksum,
            source: reportTemplate.source,
            rendererVersion: reportTemplate.rendererVersion,
          },
        },
        template: reportTemplate,
        assetUrls: {
          logo: settings.logo_url,
          signature: settings.signature_enabled ? settings.signature_url : null,
          stamp: settings.stamp_enabled ? settings.stamp_url : null,
        },
        preview: {
          columns: ['Bien', 'Unité', 'Locataire', 'Statut', 'Encaissé', 'Reliquat', 'Net'],
          rows: rows.slice(0, 6).map((row) => ({
            Bien: row.immeuble,
            Unite: row.unite,
            Locataire: row.locataire,
            Statut: row.statut,
            Encaisse: row.encaisse,
            Reliquat: row.reliquat,
            Net: row.net,
          })),
          rowCount: rows.length,
          period: periodLabel,
          stats: [
            { label: 'Loyers encaissés', value: formatCurrency(totalLoyers) },
            { label: 'Reliquats', value: formatCurrency(totalReliquats) },
            { label: netLabel, value: formatCurrency(totalNet) },
            { label: 'Recouvrement', value: `${recoveryRate}%` },
          ],
        },
      });

      toast.success('Rapport bailleur généré et archivé.');
      if (profile?.agency_id && profile?.id) {
        await invalidateOperationalCaches(
          { agencyId: profile.agency_id, userId: profile.id },
          ['bailleurs', 'documents', 'finances'],
        );
        notifyDataChanged(['bailleurs', 'documents', 'finances']);
      }
      await loadBailleurs();
      setActiveDrawerTab('rapports');
      });
    } catch (err) {
      console.error('Erreur génération rapport bailleur:', err);
      const errorMessage = translateSupabaseError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setGeneratingReport(false);
    }
  };



  /**
   * Formatage de la commission
   */
  const formatCommission = (commission: number | null): string => {
    if (!commission) return '-';
    return `${commission}%`;
  };

  /**
   * Configuration des colonnes du tableau
   */
  const ALL_COLUMN_KEYS_BAILLEURS = ['bailleur', 'telephone', 'commission', 'reliquats', 'net'] as const;
  type BailleurColumnKey = typeof ALL_COLUMN_KEYS_BAILLEURS[number];
  const DETAIL_OPEN_HIDDEN_COLUMNS = new Set<BailleurColumnKey>(['telephone']);
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility(
    'bailleurs-v5',
    [...ALL_COLUMN_KEYS_BAILLEURS],
    { telephone: true, commission: true }
  );
  const showBailleurColumn = (key: BailleurColumnKey) => colIsVisible(key) && !(detailPanelOpen && DETAIL_OPEN_HIDDEN_COLUMNS.has(key));

  const allColumns = [
    { key: 'bailleur', label: 'Bailleur', required: true },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'commission', label: 'Commission' },
    { key: 'reliquats', label: 'Reliquats' },
    { key: 'net', label: 'Net' },
  ];

  const filterOptions: Array<{ id: BailleurFilter; label: string; helper: string }> = [
    { id: 'without_reliquats', label: 'Sans reliquats', helper: 'Dossiers soldés' },
    { id: 'with_biens', label: 'Avec biens', helper: 'Portefeuille rattaché' },
    { id: 'high_commission', label: 'Commission élevée', helper: '10% et plus' },
    { id: 'active', label: 'Actifs', helper: 'Mandats en cours' },
    { id: 'inactive', label: 'Résiliés / suspendus', helper: 'Hors cycle actif' },
  ];

  const quickChipsData = useMemo(() => {
    return {
      all: bailleurs.length,
      with_reliquats: bailleurs.filter(b => (summariesByBailleur[b.id]?.reliquats ?? 0) > 0).length,
      with_net: bailleurs.filter(b => (summariesByBailleur[b.id]?.net ?? 0) > 0).length,
      without_biens: bailleurs.filter(b => (summariesByBailleur[b.id]?.immeubles.length ?? 0) === 0).length,
    };
  }, [bailleurs, summariesByBailleur]);

  const quickChips = useMemo(() => [
    { id: 'all', label: 'Tous', count: quickChipsData.all, isActive: activeFilter === 'all', onClick: () => setActiveFilter('all') },
    { id: 'with_reliquats', label: 'À suivre', count: quickChipsData.with_reliquats, isActive: activeFilter === 'with_reliquats', onClick: () => setActiveFilter('with_reliquats') },
    { id: 'with_net', label: 'À reverser', count: quickChipsData.with_net, isActive: activeFilter === 'with_net', onClick: () => setActiveFilter('with_net') },
    { id: 'without_biens', label: 'Sans bien', count: quickChipsData.without_biens, isActive: activeFilter === 'without_biens', onClick: () => setActiveFilter('without_biens') },
  ], [activeFilter, quickChipsData]);

  const renderDrawerTab = () => {
    if (!selectedBailleur) return null;
    if (activeDrawerTab === 'conformite') {
      return (
        <BailleurCompliancePanel
          bailleurId={selectedBailleur.id}
          editable={profile?.role === 'admin' || profile?.role === 'super_admin'}
          onSaved={toast.success}
          onError={toast.error}
        />
      );
    }
    const recentPaiements = selectedSummary.paiements
      .slice()
      .sort((a, b) => String(b.date_paiement ?? '').localeCompare(String(a.date_paiement ?? '')))
      .slice(0, 5);
    const recentActivity = [
      ...selectedSummary.paiements.slice(0, 3).map((paiement) => ({
        id: `paiement-${paiement.id}`,
        icon: CreditCard,
        title: 'Paiement reçu',
        detail: <><MoneyText value={paiement.montant_total} /> · {paiement.mois_concerne ?? 'Période non renseignée'}</>,
        date: paiement.date_paiement,
      })),
      ...selectedSummary.contrats.slice(0, 2).map((contrat) => ({
        id: `contrat-${contrat.id}`,
        icon: FileText,
        title: 'Contrat suivi',
        detail: <>{contrat.locataires ? formatPersonName(contrat.locataires, '') : 'Locataire non renseigné'} · <MoneyText value={contrat.loyer_mensuel} /></>,
        date: contrat.date_debut,
      })),
    ].slice(0, 5);
    const reportDocuments = selectedSummary.documents.filter(isReportDocument);
    const reportPaiements = selectedSummary.paiements.filter((paiement) => String(paiement.mois_concerne ?? paiement.date_paiement ?? '').startsWith(reportMonth));
    const reportDepenses = selectedSummary.depenses.filter((depense) => String(depense.date_depense ?? '').startsWith(reportMonth));
    const reportLoyers = reportPaiements.reduce((sum, paiement) => sum + Number(paiement.montant_total ?? 0), 0);
    const reportReliquats = reportPaiements.reduce((sum, paiement) => sum + Math.max(Number(paiement.reliquat ?? 0), 0), 0);
    const reportCommissions = reportPaiements.reduce((sum, paiement) => sum + Number(paiement.part_agence ?? 0), 0);
    const reportNet = reportPaiements.reduce((sum, paiement) => sum + Number(paiement.part_bailleur ?? 0), 0);
    const reportExpenses = reportDepenses.reduce((sum, depense) => sum + Number(depense.montant ?? 0), 0);

    if (activeDrawerTab === 'overview') {
      const paidBase = selectedSummary.loyers + selectedSummary.reliquats;
      const paidRate = paidBase > 0 ? Math.min(100, Math.round((selectedSummary.loyers / paidBase) * 100)) : 100;
      return (
        <div className="grid gap-2">
          <section className="rounded-xl border border-emerald-950/10 bg-white/80 p-2 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[8.5px] font-black uppercase tracking-[0.12em] text-slate-400">Résumé paiements</p>
                <p className="mt-0.5 text-[0.75rem] font-extrabold tabular-nums text-slate-900"><MoneyText value={selectedSummary.loyers} /></p>
              </div>
              <div
                className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-center text-[8px] font-black text-brand-950"
                aria-label={`Taux de recouvrement ${paidRate}%`}
              >
                <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
                  <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#d1fae5" strokeWidth="4" />
                  <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#047857" strokeWidth="4" strokeDasharray={`${paidRate} ${100 - paidRate}`} />
                </svg>
                <span className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white">{paidRate}%</span>
              </div>
            </div>
            <div className="mt-2 space-y-1 text-[0.6rem]">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-500">Commissions</span><strong className="font-bold text-slate-700"><MoneyText value={selectedSummary.commissions} /></strong></div>
              <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-500">Net à reverser</span><strong className="font-bold text-emerald-800"><MoneyText value={selectedSummary.net} /></strong></div>
              <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-500">Reliquats</span><strong className={`font-bold ${selectedSummary.reliquats > 0 ? 'text-red-600' : 'text-slate-700'}`}><MoneyText value={selectedSummary.reliquats} /></strong></div>
            </div>
          </section>
          <section className="rounded-xl border border-emerald-950/10 bg-white/80 p-2 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[8.5px] font-black uppercase tracking-[0.12em] text-slate-400">Activité récente</p>
              <button type="button" onClick={() => setActiveDrawerTab('paiements')} className="text-[0.6rem] font-bold text-emerald-800 hover:text-emerald-950">Voir tout</button>
            </div>
            <div className="mt-2 space-y-1.5">
              {recentActivity.length === 0 ? (
                <EmptyDrawerState title="Aucune activité récente" description="Les contrats, paiements et documents de ce bailleur apparaîtront ici." />
              ) : recentActivity.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="flex items-center gap-1.5 rounded-md bg-slate-50/80 px-1.5 py-1 ring-1 ring-emerald-950/5">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white text-emerald-700 shadow-sm"><Icon className="h-3 w-3" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.62rem] font-bold text-slate-900">{item.title}</p>
                      <p className="truncate text-[0.55rem] font-medium text-slate-500">{item.detail}</p>
                    </div>
                    <span className="text-[7.5px] font-bold text-slate-400">{formatDate(item.date)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      );
    }

    if (activeDrawerTab === 'biens') {
      return selectedSummary.immeubles.length === 0 ? (
        <EmptyDrawerState title="Aucun bien rattaché" description="Ajoutez un bien pour commencer à suivre les unités, locataires et loyers de ce bailleur." actionLabel="Ajouter un bien" onAction={() => { window.location.hash = `#/patrimoine?action=new&bailleurId=${selectedBailleur.id}`; }} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-emerald-950/10 bg-white/50 shadow-sm">
          {selectedSummary.immeubles.map((immeuble) => {
            const units = selectedSummary.unites.filter((unite) => unite.immeuble_id === immeuble.id);
            const occupied = units.filter((unite) => unite.statut === 'loue').length;
            const potential = units.reduce((sum, unite) => sum + Number(unite.loyer_base ?? 0), 0);
            const rate = units.length ? Math.round((occupied / units.length) * 100) : 0;
            return (
              <button
                key={immeuble.id}
                type="button"
                onClick={() => { window.location.hash = `#/patrimoine?id=${immeuble.id}`; }}
                className="group flex w-full items-center justify-between gap-2 border-b border-emerald-950/5 px-2 py-1.5 text-left last:border-b-0 hover:bg-emerald-50/50 focus-visible:bg-emerald-50"
                aria-label={`Ouvrir le bien ${immeuble.nom}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.68rem] font-bold text-slate-800">{immeuble.nom}</p>
                  <p className="truncate text-[0.58rem] font-medium text-slate-500">{[immeuble.adresse, immeuble.quartier, immeuble.ville].filter(Boolean).join(', ') || 'Adresse non renseignée'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="hidden shrink-0 text-right text-[0.58rem] font-medium text-slate-500 sm:block">
                    {units.length} u. · {rate}%
                  </div>
                  <div className="shrink-0 text-right text-[0.68rem] font-bold text-slate-800"><MoneyText value={potential} /></div>
                  <ChevronRight className="h-2.5 w-2.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    if (activeDrawerTab === 'contrats') {
      return selectedSummary.contrats.length === 0 ? (
        <EmptyDrawerState title="Aucun contrat lié" description="Les baux associés aux unités de ce bailleur apparaîtront ici." />
      ) : (
        <CompactList rows={selectedSummary.contrats.map((contrat) => ({
          id: contrat.id,
          title: contrat.locataires ? formatPersonName(contrat.locataires, '') : 'Locataire non renseigné',
          subtitle: `Début ${formatDate(contrat.date_debut)} · Fin ${formatDate(contrat.date_fin)}`,
          value: <MoneyText value={contrat.loyer_mensuel} />,
          badge: contrat.statut ?? '—',
          onClick: () => { window.location.hash = `#/occupants-baux?id=${contrat.id}`; },
        }))} />
      );
    }

    if (activeDrawerTab === 'paiements') {
      return recentPaiements.length === 0 ? (
        <EmptyDrawerState title="Aucun paiement enregistré" description="Les encaissements apparaîtront ici dès les premiers loyers saisis." />
      ) : (
        <CompactList rows={recentPaiements.map((paiement) => ({
          id: paiement.id,
          title: paiement.mois_concerne || 'Mois non précisé',
          subtitle: `Le ${formatDate(paiement.date_paiement)} · Réf. ${paiement.reference || '—'}`,
          value: <MoneyText value={paiement.montant_total} />,
          badge: paiement.statut ?? undefined,
          onClick: () => { window.location.hash = `#/paiements?id=${paiement.id}`; },
        }))} />
      );
    }

    if (activeDrawerTab === 'depenses') {
      return selectedSummary.depenses.length === 0 ? (
        <EmptyDrawerState title="Aucune dépense liée" description="Les charges rattachées aux biens de ce bailleur apparaîtront ici." />
      ) : (
        <CompactList rows={selectedSummary.depenses.slice(0, 8).map((depense) => ({
          id: depense.id,
          title: depense.categorie || 'Dépense',
          subtitle: `Le ${formatDate(depense.date_depense)} · ${depense.description || 'Autre'}`,
          value: <MoneyText value={depense.montant} />,
          badge: depense.actif === false ? 'Inactif' : undefined,
          onClick: () => { window.location.hash = `#/depenses?id=${depense.id}`; },
        }))} />
      );
    }

    if (activeDrawerTab === 'rapports') {
      return (
        <div className="space-y-2.5">
          <section className="overflow-hidden rounded-xl border border-emerald-950/10 bg-white/80 shadow-sm">
            <div className="bg-[linear-gradient(135deg,#fff4d8,#fffdf8)] p-2 sm:p-2.5 text-brand-950">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#9a5b17]">Registre financier</p>
                  <p className="mt-0.5 text-[0.7rem] font-black leading-tight truncate">Rapport bailleur</p>
                  <p className="mt-0.5 max-w-[10rem] sm:max-w-[12rem] text-[0.58rem] leading-snug font-medium text-slate-600">
                    Synthèse propriétaire archivée dans la GED.
                  </p>
                </div>
                <div className="shrink-0">
                  <label className="sr-only">Période</label>
                  <div className="relative">
                    <Calendar className="absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-emerald-800/70" />
                    <input
                      {...{ type: 'month' }}
                      value={reportMonth}
                      onChange={(event) => setReportMonth(event.target.value || currentMonthInput())}
                      className="h-6 w-[7.5rem] rounded-md border border-amber-200/60 bg-white pl-5 pr-1.5 py-0 text-[10px] sm:text-[11px] font-bold text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-2 sm:p-2.5">
              <div className="rounded-md border border-emerald-950/5 bg-emerald-50/50 px-2 py-1.5 text-[0.62rem] text-emerald-900 font-medium">
                Bilan préparé pour <strong className="font-bold">{formatMonthLabel(reportMonth)}</strong> · {selectedSummary.immeubles.length} bien{selectedSummary.immeubles.length > 1 ? 's' : ''} · {reportPaiements.length} paiement{reportPaiements.length > 1 ? 's' : ''}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                <MicroMetric label="Loyers" value={<MoneyText value={reportLoyers} compact />} tone="emerald" />
                <MicroMetric label="Reliquats" value={<MoneyText value={reportReliquats} compact />} tone="red" />
                <MicroMetric label="Commissions" value={<MoneyText value={reportCommissions} compact />} tone="amber" />
                <MicroMetric label="Dépenses" value={<MoneyText value={reportExpenses} compact />} tone="blue" />
                <MicroMetric label="Net" value={<MoneyText value={reportNet} compact />} tone="slate" />
                <MicroMetric label="Documents" value={String(reportDocuments.length)} tone="slate" />
              </div>
              <button
                type="button"
                onClick={() => void handleGenerateBailleurReport(selectedBailleur)}
                disabled={generatingReport}
                className="mt-2.5 inline-flex w-full h-7 items-center justify-center gap-1.5 rounded-md border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] via-[#06281F] to-[#041812] px-2.5 text-[0.65rem] font-bold text-white shadow-sm shadow-emerald-950/10 transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <BarChart3 className="h-3 w-3" />
                {generatingReport ? 'Génération...' : 'Générer bilan PDF'}
              </button>
              <p className="mt-1.5 text-[0.55rem] leading-snug font-medium text-slate-500">
                Le PDF est archivé avec le type <strong className="font-bold text-slate-600">rapport_bailleur</strong>.
              </p>
            </div>
          </section>
          {reportDocuments.length === 0 ? (
            <EmptyDrawerState
              title="Aucun rapport généré pour ce bailleur"
              description="Les rapports permettront de résumer les loyers, reliquats, commissions, dépenses et net à reverser."
            />
          ) : (
            <CompactList rows={reportDocuments.slice(0, 5).map((document) => ({
              id: document.id,
              title: document.name || 'Bilan',
              subtitle: `Le ${formatDate(document.created_at)}`,
              badge: 'PDF',
              onClick: () => { window.location.hash = document.id ? `#/documents?id=generated-${document.id}` : '#/documents'; },
            }))} />
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-950/10 bg-emerald-50/40 p-3">
          <div>
            <p className="text-xs font-bold text-slate-800">Documents & Preuves</p>
            <p className="text-[0.65rem] text-slate-600">Mandats, contrats, quittances et rapports associés</p>
          </div>
          <button
            type="button"
            onClick={() => { window.location.hash = '#/documents'; }}
            className="inline-flex !h-7 !min-h-7 items-center gap-1.5 rounded-lg bg-emerald-800 px-2.5 text-[0.68rem] font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            + Coffre GED
          </button>
        </div>
        {selectedSummary.documents.length === 0 ? (
          <EmptyDrawerState title="Aucun document lié" description="Mandats, contrats, quittances et rapports apparaîtront ici. Cliquez sur Coffre GED pour en importer." />
        ) : (
          <CompactList rows={selectedSummary.documents.slice(0, 10).map((document) => ({
            id: document.id,
            title: document.name || 'Document sans nom',
            subtitle: `Le ${formatDate(document.created_at)}`,
            badge: document.lifecycle_status || document.document_category || 'GED',
            onClick: () => { window.location.hash = document.id ? `#/documents?id=${document.source || 'generated'}-${document.id}` : '#/documents'; },
          }))} />
        )}
      </div>
    );
  };

  /**
   * Affichage du loader
   */
  if (loading) {
    return <PageSkeleton title="Bailleurs" variant="table" />;
  }

  return (
    <PageShell spacing="standard" variant="dataDense" tone="paper" verticalInset="compact">
      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}
      {cacheTimestamp && (
        <OfflineDataNotice
          cachedAt={cacheTimestamp}
          onRetry={loadBailleurs}
          retrying={loading}
        />
      )}

      <div className="mt-2">
        <SplitViewShell
          isDetailOpen={detailPanelOpen}
          size="compact"
          desktopAt="lg"
          detailClassName="lg:sticky lg:top-2 lg:h-[calc(100dvh-1rem)]"
          mainClassName={detailPanelOpen ? 'hidden lg:block' : ''}
          main={
            <div className="flex flex-col gap-4">
          <section className="min-w-0 space-y-4">
            <PremiumPageHeader
              density="compact"
              eyebrow="PORTEFEUILLE PROPRIÉTAIRE"
              title="Bailleurs"
              description="Gérez propriétaires, revenus et documents."
              mobileDescription="Propriétaires et reversements."
              primaryAction={
                <PremiumButton
                  variant="create"
                  onClick={() => openModal()}
                  icon={<Plus className="h-3.5 w-3.5" />}
                  className="w-full sm:w-auto !h-7 !min-h-7 !px-2.5 !py-1 !text-[0.7rem]"
                >
                  Nouveau bailleur
                </PremiumButton>
              }
            />

            <PremiumKpiGrid density="compact">
              <MetricCard
                density="compact"
                title="BAILLEURS ACTIFS"
                icon={Users}
                value={globalKpis.activeBailleurs.toString()}
                helper="Dans la base"
                tone="emerald"
              />
              <MetricCard
                density="compact"
                title="RELIQUATS"
                icon={AlertCircle}
                value={<MoneyText value={globalKpis.reliquats} compact />}
                helper="Paiements partiels"
                tone="danger"
              />
              <MetricCard
                density="compact"
                title="NET BAILLEURS"
                icon={Wallet}
                value={<MoneyText value={globalKpis.net} compact />}
                helper="Parts bailleurs"
                tone="financial"
              />
              <MetricCard
                density="compact"
                title="COMMISSIONS"
                icon={ReceiptText}
                value={<MoneyText value={globalKpis.commissions} compact />}
                helper={`${globalKpis.immeubles} biens · ${globalKpis.unites} unités`}
                tone="neutral"
              />
            </PremiumKpiGrid>

            <PremiumToolbar
              density="compact"
              search={
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-800" />
                  <input
                    type="text"
                    placeholder="Propriétaire, téléphone, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="!min-h-8 !h-8 w-full rounded-[0.6rem] border border-emerald-950/10 bg-white/95 pl-8 pr-3 py-0 text-xs font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
              }
              secondaryActions={
                <>
                  <PremiumFilterSelect
                    value={filterOptions.some(o => o.id === activeFilter) ? activeFilter : ''}
                    placeholder="Autres filtres"
                    options={filterOptions.map(o => ({ value: o.id, label: o.label }))}
                    onChange={(val) => setActiveFilter((val as BailleurFilter) || 'all')}
                    className="hidden w-[9.5rem] lg:block"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFilters(true)}
                    className={`inline-flex h-8 flex-shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-[0.6rem] border px-3 py-1.5 text-xs font-bold shadow-sm transition lg:hidden ${filterOptions.some(o => o.id === activeFilter) ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-[#fffdf8] text-slate-700 hover:border-emerald-100 hover:bg-emerald-50/60'}`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filtres
                    {filterOptions.some(o => o.id === activeFilter) && (
                      <span className="rounded-full bg-emerald-800 px-1.5 py-0.5 text-[10px] text-white">1</span>
                    )}
                  </button>
                  <ColumnPicker
                    columns={allColumns}
                    visibility={colVis}
                    onToggle={colToggle}
                    onSetAll={colSetAll}
                    className="!py-1.5 !px-3 !text-xs !rounded-[0.6rem] !h-8 hidden lg:inline-flex"
                  />
                </>
              }
              quickChips={quickChips}
            />

          <PremiumTableSurface>
            <MobileFilterSheet
              isOpen={showFilters}
              title="Filtres bailleurs"
              onClose={() => setShowFilters(false)}
              onReset={() => setActiveFilter('all')}
            >
              <div className="grid gap-1.5">
                {filterOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setActiveFilter(option.id)}
                    className={`rounded-xl border px-2 py-1.5 text-left transition ${activeFilter === option.id ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-100 bg-[#fffdf8] text-slate-600 hover:border-emerald-100 hover:bg-emerald-50/60'}`}
                  >
                    <span className="block text-[11px] font-bold">{option.label}</span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">{option.helper}</span>
                  </button>
                ))}
              </div>
            </MobileFilterSheet>

          {filteredBailleurs.length === 0 ? (
            <div className="p-8">
              <EmptyDrawerState
                title={searchTerm || activeFilter !== 'all' ? 'Aucun bailleur trouvé' : 'Aucun bailleur enregistré'}
                description={searchTerm || activeFilter !== 'all' ? 'Essayez une autre recherche ou retirez les filtres actifs.' : 'Ajoutez votre premier bailleur pour structurer votre portefeuille locatif.'}
                actionLabel={!searchTerm && activeFilter === 'all' ? 'Créer mon premier bailleur' : (activeFilter !== 'all' ? 'Réinitialiser les filtres' : undefined)}
                onAction={!searchTerm && activeFilter === 'all' ? () => { setBailleurWizardStep('identity'); setIsModalOpen(true); } : (activeFilter !== 'all' ? () => setActiveFilter('all') : undefined)}
              />
            </div>
          ) : (
            <>
              <div className="hidden lg:block overflow-x-auto">
                <table className={`w-full border-collapse table-fixed ${detailPanelOpen ? 'min-w-[460px]' : 'min-w-[640px]'}`}>
                  <thead className="bg-[#f8f3e8]/70 text-left">
                    <tr>
                      {showBailleurColumn('bailleur') && <th className={`${detailPanelOpen ? 'w-[38%]' : 'w-[30%]'} px-2 py-1.5 text-left text-[0.6rem] font-semibold uppercase tracking-wider text-slate-500`}><span className="flex items-center gap-1.5"><CircleUser className="h-3 w-3 text-slate-400" /> Bailleur</span></th>}
                      {showBailleurColumn('telephone') && <th className="w-[18%] px-2 py-1.5 text-left text-[0.6rem] font-semibold uppercase tracking-wider text-slate-500"><span className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-400" /> Téléphone</span></th>}
                      {showBailleurColumn('commission') && <th className={`${detailPanelOpen ? 'w-[18%]' : 'w-[14%]'} px-2 py-1.5 text-left text-[0.6rem] font-semibold uppercase tracking-wider text-slate-500`}><span className="flex items-center gap-1.5"><Percent className="h-3 w-3 text-slate-400" /> Commission</span></th>}
                      {showBailleurColumn('reliquats') && <th className={`${detailPanelOpen ? 'w-[21%]' : 'w-[18%]'} px-2 py-1.5 text-right text-[0.6rem] font-semibold uppercase tracking-wider text-slate-500`}><span className="flex items-center gap-1.5 justify-end"><AlertCircle className="h-3 w-3 text-slate-400" /> Reliquats</span></th>}
                      {showBailleurColumn('net') && <th className={`${detailPanelOpen ? 'w-[21%]' : 'w-[18%]'} px-2 py-1.5 text-right text-[0.6rem] font-semibold uppercase tracking-wider text-slate-500`}><span className="flex items-center gap-1.5 justify-end"><Wallet className="h-3 w-3 text-slate-400" /> Net</span></th>}
                      <th className="w-[2%] px-2 py-1.5"><span className="sr-only">Ouvrir</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBailleurs.map((bailleur) => {
                      const summary = summariesByBailleur[bailleur.id] ?? emptySummary();
                      const selected = bailleur.id === selectedBailleurId;

                      const isReliquatPositif = summary.reliquats > 0;
                      const isNetPositif = summary.net > 0;
                      const rawStatusLabel = getStatusLabel(bailleur);

                      let subtitleText = `${rawStatusLabel} · ${summary.immeubles.length} bien${summary.immeubles.length > 1 ? 's' : ''} · ${summary.unites.length} unité${summary.unites.length > 1 ? 's' : ''}`;
                      if (isReliquatPositif) subtitleText += ' · à suivre';
                      else if (isNetPositif) subtitleText += ' · net positif';

                      return (
                        <tr
                          key={bailleur.id}
                          onClick={() => { setSelectedBailleurId(bailleur.id); setDetailOpen(true); }}
                          className={`cursor-pointer border-b border-slate-100 transition-colors duration-150 outline-none hover:bg-emerald-50/40 focus-visible:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300 ${selected ? 'bg-emerald-50/60 relative z-0 after:absolute after:inset-y-0 after:left-0 after:w-1 after:bg-brand-600' : ''}`}
                        >
                          {showBailleurColumn('bailleur') && <td className="px-2 py-1.5">
                            <div className="flex items-center gap-2">
                              <div className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-[0.62rem] font-black shadow-inner ring-1 ${getAvatarTone(bailleur, selected)}`}>{getInitials(bailleur)}</div>
                              <div className="min-w-0">
                                <p className="truncate text-[0.78rem] leading-tight font-semibold text-slate-950">{displayBailleurName(bailleur)}</p>
                                {subtitleText && <p className="truncate text-[0.64rem] leading-snug text-slate-500 mt-0.5">{subtitleText}</p>}
                              </div>
                            </div>
                          </td>}
                          {showBailleurColumn('telephone') && <td className="whitespace-nowrap px-2 py-1.5 text-[0.68rem] font-medium text-slate-600">{bailleur.telephone ? <a href={`tel:${bailleur.telephone}`} onClick={(e) => e.stopPropagation()} className="hover:text-brand-700 hover:underline">{formatSenegalPhone(bailleur.telephone)}</a> : ''}</td>}
                          {showBailleurColumn('commission') && <td className="whitespace-nowrap px-2 py-1.5 text-[0.68rem] font-medium text-slate-600">{formatCommission(bailleur.commission)}</td>}
                          {showBailleurColumn('reliquats') && <td className={`whitespace-nowrap px-2 py-1.5 text-right text-[0.72rem] font-semibold tabular-nums ${summary.reliquats > 0 ? 'text-red-600' : 'text-slate-400 font-medium'}`}><MoneyText value={summary.reliquats} /></td>}
                          {showBailleurColumn('net') && <td className={`whitespace-nowrap px-2 py-1.5 text-right text-[0.72rem] font-semibold tabular-nums ${summary.net > 0 ? 'text-emerald-800' : 'text-slate-400 font-medium'}`}><MoneyText value={summary.net} /></td>}
                          <td className="px-2 py-1.5 text-right">
                            <ChevronRight className="h-[10px] w-[10px] text-slate-300 inline-block" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 p-3 lg:hidden">
                {filteredBailleurs.map((bailleur) => {
                  const summary = summariesByBailleur[bailleur.id] ?? emptySummary();
                  return (
                    <PremiumMobileCard
                      key={bailleur.id}
                      onClick={() => { setSelectedBailleurId(bailleur.id); setDetailOpen(true); }}
                      title={displayBailleurName(bailleur)}
                      subtitle={`${summary.immeubles.length} bien${summary.immeubles.length > 1 ? 's' : ''} · ${summary.unites.length} unité${summary.unites.length > 1 ? 's' : ''}`}
                      initials={getInitials(bailleur)}
                      avatarSize="md"
                      emphasis="identity"
                      status={getStatusLabel(bailleur)}
                      statusTone={bailleur.actif ? 'emerald' : 'slate'}
                      amount={summary.net}
                      amountLabel="Net bailleur"
                      amountTone={summary.net > 0 ? 'emerald' : 'slate'}
                      secondaryAmount={summary.reliquats > 0 ? summary.reliquats : undefined}
                      secondaryAmountLabel={summary.reliquats > 0 ? "Reliquat" : undefined}
                      secondaryAmountTone="red"
                    />
                  );
                })}
              </div>
            </>
          )}
          </PremiumTableSurface>
        </section>
            </div>
          }
          detail={
            selectedBailleur && (
              <PremiumDrawerShell
                open={detailPanelOpen}
                onClose={() => {
                  setDetailOpen(false);
                  clearDirectRouteParams();
                }}
                size="compact"
                desktopMode="floating"
                desktopAt="lg"
                density="compact"
                eyebrow="FICHE PROPRIÉTAIRE"
                avatar={
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-[0.8rem] font-bold text-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-emerald-950/10">
                    {displayBailleurName(selectedBailleur).slice(0, 2).toUpperCase()}
                  </div>
                }
                title={displayBailleurName(selectedBailleur)}
                description={
                  <div className="mt-1 flex flex-col gap-1.5 text-[0.72rem]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ${selectedBailleur.actif ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {getStatusLabel(selectedBailleur)}
                      </span>
                      {selectedBailleur.telephone && <span className="flex items-center gap-1 text-slate-500 font-medium"><Phone className="h-3 w-3" />{formatSenegalPhone(selectedBailleur.telephone)}</span>}
                      {selectedBailleur.email && <span className="flex min-w-0 items-center gap-1 text-slate-500 font-medium"><Mail className="shrink-0 h-3 w-3" /><span className="truncate">{selectedBailleur.email}</span></span>}
                    </div>
                    <div className="pt-1 text-[0.68rem] text-slate-500 font-medium">
                      {selectedSummary.immeubles.length} bien{selectedSummary.immeubles.length > 1 ? 's' : ''} · {selectedSummary.unites.length} unité{selectedSummary.unites.length > 1 ? 's' : ''}
                      {selectedSummary.net > 0 && ' · net positif'}
                      {selectedSummary.reliquats > 0 && ' · reliquats à suivre'}
                    </div>
                  </div>
                }
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-start">
                    <button type="button" onClick={() => void handleGenerateBailleurReport(selectedBailleur)} disabled={generatingReport} className="inline-flex !h-7 !min-h-7 px-3 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-emerald-700/90 text-[0.7rem] font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                      <BarChart3 className="h-3.5 w-3.5" />
                      {generatingReport ? 'Génération...' : 'Rapport PDF'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <CompactMetric label="Net" value={<MoneyText value={selectedSummary.net} compact />} tone="emerald" />
                    <CompactMetric label="Reliquats" value={<MoneyText value={selectedSummary.reliquats} compact />} tone="red" />
                    <CompactMetric label="Biens" value={String(selectedSummary.immeubles.length)} tone="blue" />
                    <CompactMetric label="Unités" value={String(selectedSummary.unites.length)} tone="amber" />
                  </div>

                  <div className="grid gap-2.5">
                    {(selectedBailleur.telephone || selectedBailleur.email || selectedBailleur.adresse) && (
                      <CompactSection title="Coordonnées" icon={MapPin}>
                        <div className="flex flex-col divide-y divide-slate-100 min-w-0">
                          <CompactLabelValue label="Téléphone" value={selectedBailleur.telephone ? formatSenegalPhone(selectedBailleur.telephone) : null} />
                          <CompactLabelValue label="Email" value={selectedBailleur.email} />
                          <CompactLabelValue label="Adresse" value={selectedBailleur.adresse} />
                        </div>
                      </CompactSection>
                    )}

                    <CompactSection title="Gestion & Contrats" icon={FileText}>
                      <div className="flex flex-col divide-y divide-slate-100 min-w-0">
                        <CompactLabelValue label="Début de mandat" value={selectedBailleur.debut_contrat ? new Date(selectedBailleur.debut_contrat).toLocaleDateString('fr-FR') : null} />
                        <CompactLabelValue label="Commission" value={formatCommission(selectedBailleur.commission)} />
                      </div>
                      <div className="mt-2.5 grid grid-cols-2 gap-2 min-w-0">
                        <button type="button" onClick={() => handleEdit(selectedBailleur)} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[0.65rem] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 min-w-0"><FileText className="shrink-0 h-3.5 w-3.5 text-slate-400" /><span className="truncate">Modifier</span></button>
                        <button type="button" onClick={() => handleGenerateMandat(selectedBailleur)} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[0.65rem] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 min-w-0"><FileText className="shrink-0 h-3.5 w-3.5 text-slate-400" /><span className="truncate">Mandat PDF</span></button>
                      </div>
                    </CompactSection>
                  </div>

                  <div className="pt-1">
                    <div className="flex gap-1 overflow-x-auto scroll-smooth scrollbar-hide no-scrollbar rounded-xl bg-slate-50/80 border border-emerald-950/5 p-1">
                      {[...DRAWER_PRIMARY_TABS, ...DRAWER_MORE_TABS].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={(e) => {
                            setActiveDrawerTab(tab.id);
                            e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                          }}
                          className={`whitespace-nowrap rounded-lg px-2 py-1 text-[0.68rem] font-bold transition ${activeDrawerTab === tab.id ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-950/5' : 'text-slate-500 hover:text-emerald-900 hover:bg-slate-100'}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2.5">{renderDrawerTab()}</div>
                  </div>

                  <div className="pt-4 pb-2">
                    <p className="mb-1.5 text-[0.6rem] font-black uppercase tracking-wider text-red-800 opacity-60">Archivage</p>
                    <button
                      type="button"
                      onClick={() => openLifecycleModal(selectedBailleur)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 text-[0.65rem] font-bold text-red-700 transition hover:bg-red-50 hover:border-red-300"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Résilier le bailleur
                    </button>
                  </div>
                </div>
              </PremiumDrawerShell>
            )
          }
        />
      </div>

      {/* Modal de création/édition */}
      <WizardShell
        open={isModalOpen}
        onClose={handleCloseAttempt}
        size="compact"
        variant="workstation"
        tone="owner"
        eyebrow="SAMAY KËUR"
        title={editingBailleur ? 'Modifier le bailleur' : 'Nouveau bailleur'}
        description="Créez une fiche propriétaire exploitable."
        steps={BAILLEUR_WIZARD_STEPS}
        currentStep={bailleurWizardStepIndex}
        contentDescription="Créez une fiche propriétaire exploitable."
        stepContext={<BailleurWizardStepContext step={bailleurWizardStep} />}
        rail={
          <BailleurWizardRail
            steps={BAILLEUR_WIZARD_STEPS}
            currentStep={bailleurWizardStepIndex}
          />
        }
        primaryAction={
          <button
            type="button"
            onClick={() => {
              if (bailleurWizardStep === 'identity') {
                if (!formData.prenom.trim()) { setError('Le prénom est obligatoire.'); return; }
                if (!formData.nom.trim()) { setError('Le nom est obligatoire.'); return; }
                if (!isValidPersonNamePart(formData.prenom) || !isValidPersonNamePart(formData.nom)) { setError("Le prénom et le nom doivent contenir uniquement des lettres, espaces, apostrophes ou tirets."); return; }
                if (!formData.telephone.trim()) { setError('Le téléphone est obligatoire.'); return; }
                if (!isValidSenegalPhone(formData.telephone)) { setError('Numéro invalide. Exemple : +221 77 123 45 67'); return; }
                if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setError('Email invalide. Exemple : nom@domaine.com'); return; }
                setError(null);
                setBailleurWizardStep('admin');
              } else if (bailleurWizardStep === 'admin') {
                const cniError = getSenegalCniError(formData.piece_identite);
                if (cniError) { setError(cniError); return; }
                if (formData.commission && (parseFloat(formData.commission) < 0 || parseFloat(formData.commission) > 100)) { setError("La commission doit être comprise entre 0 et 100%."); return; }
                if (!formData.debut_contrat) { setError('Le début de gestion est obligatoire.'); return; }
                setError(null);
                setBailleurWizardStep('summary');
              } else {
                void handleSubmit();
              }
            }}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#073728] via-[#062d23] to-[#041812] px-4 py-2 text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(6,45,35,0.18)] outline-none transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] hover:shadow-[0_14px_28px_rgba(6,45,35,0.22)] focus-visible:ring-2 focus-visible:ring-emerald-700/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {isSubmitting ? 'Traitement...' : bailleurWizardStep === 'summary' ? (editingBailleur ? 'Enregistrer' : 'Créer le bailleur') : 'Continuer'}
          </button>
        }
        secondaryAction={
          <button
            type="button"
            onClick={() => {
              if (bailleurWizardStep === 'summary') setBailleurWizardStep('admin');
              else if (bailleurWizardStep === 'admin') setBailleurWizardStep('identity');
              else handleCloseAttempt();
            }}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-emerald-950/10 bg-white/85 px-4 py-2 text-[11px] font-semibold text-slate-600 shadow-sm outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-emerald-700/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8] disabled:opacity-50 sm:w-auto"
          >
            {bailleurWizardStep === 'identity' ? 'Annuler' : 'Retour'}
          </button>
        }
      >
        <div className="space-y-2.5 sm:space-y-3 lg:space-y-4">
          {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

          <div className={bailleurWizardStep === 'identity' ? 'space-y-2.5 sm:space-y-2.5' : 'hidden'}>
            <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-slate-600 sm:text-[0.62rem]">
              Informations principales
            </h3>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
              <TextField label="Prénom" value={formData.prenom} onChange={(v) => { setIsDirty(true); setFormData({ ...formData, prenom: v }); }} required placeholder="Amadou" />
              <TextField label="Nom" value={formData.nom} onChange={(v) => { setIsDirty(true); setFormData({ ...formData, nom: v }); }} required placeholder="Diop" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
              <TextField
                type="tel"
                label="Téléphone"
                value={formData.telephone}
                onChange={(v) => {
                  const val = formatSenegalPhoneInput(v);
                  if (val !== formData.telephone) setIsDirty(true);
                  setFormData({ ...formData, telephone: val });
                }}
                required
                placeholder="77 123 45 67"
              />
              <TextField type="email" label="Email" value={formData.email || ''} onChange={(v) => { setIsDirty(true); setFormData({ ...formData, email: v }); }} placeholder="nom@domaine.com" />
            </div>

            <div className="hidden rounded-xl border border-emerald-950/10 bg-white/42 px-3 py-2 shadow-[0_5px_14px_rgba(15,23,42,0.014)] sm:block">
              <div className="min-w-0">
                <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-emerald-800/70">
                  Base de rattachement
                </p>
                <p className="mt-0.5 text-[0.68rem] font-medium leading-snug text-slate-600">
                  Cette fiche deviendra la base du portefeuille propriétaire.
                </p>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[0.62rem] font-semibold text-slate-600">
                {['Biens', 'Mandats', 'Rapports', 'Reversements'].map((item) => (
                  <span key={item} className="rounded-full border border-emerald-950/10 bg-[#fffdf8]/80 px-2 py-1">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className={bailleurWizardStep === 'admin' ? 'space-y-2.5 sm:space-y-3' : 'hidden'}>
            <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-slate-600 sm:text-[0.62rem]">
              Informations complémentaires
            </h3>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
              <TextField label="Adresse" value={formData.adresse || ''} onChange={(v) => { setIsDirty(true); setFormData({ ...formData, adresse: v }); }} placeholder="123 Avenue Blaise Diagne, Dakar" />
              <TextField
                label="Pièce d'identité"
                value={formData.piece_identite || ''}
                onChange={(v) => {
                  const val = formatSenegalCni(v);
                  setIsDirty(true);
                  setFormData({ ...formData, piece_identite: val });
                }}
                placeholder="1 01 20050927 12345 6"
                inputMode="numeric"
                maxLength={21}
                helperText="17 chiffres · Exemple : 1 45 19990101 12345 6"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
              <TextField
                type="text"
                inputMode="decimal"
                label="Commission"
                value={formData.commission}
                onChange={(v) => {
                  const val = v.replace(/[^0-9.,]/g, '').replace(',', '.');
                  if (val.split('.').length > 2) return;
                  if (val === '') {
                    setIsDirty(true);
                    setFormData({ ...formData, commission: '' });
                    return;
                  }
                  const num = parseFloat(val);
                  if (num >= 0 && num <= 100) {
                    setIsDirty(true);
                    setFormData({ ...formData, commission: val });
                  }
                }}
                required
                placeholder="10"
                suffix="%"
              />
              <TextField type="date" label="Début de gestion" value={formData.debut_contrat || ''} onChange={(v) => { setIsDirty(true); setFormData({ ...formData, debut_contrat: v }); }} required />
            </div>

            <div>
              <label className="mb-1 block text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem]">Notes</label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => { setIsDirty(true); setFormData({ ...formData, notes: e.target.value }); }}
                rows={2}
                className="mt-1 min-h-[3rem] w-full resize-none rounded-xl border border-emerald-950/10 bg-[#fffdf8]/85 px-3 py-1.5 text-[0.88rem] font-medium text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.014)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 autofill:bg-white autofill:shadow-[inset_0_0_0px_1000px_white] sm:min-h-[3.75rem] sm:rounded-[0.7rem] sm:py-[0.5rem] sm:text-[0.8rem]"
                placeholder="Notes supplémentaires..."
              />
            </div>
          </div>

          {bailleurWizardStep === 'summary' && (
            <div className="space-y-3 sm:space-y-4">
              <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                <div className="overflow-hidden rounded-[0.95rem] border border-emerald-950/10 bg-[#fffdf8]/86 shadow-[0_8px_22px_rgba(15,23,42,0.024)]">
                  <div className="flex items-center gap-2 border-b border-slate-100/80 px-3 py-2 sm:py-[0.55rem]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 sm:h-[22px] sm:w-[22px]">
                      <User className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                    </span>
                    <h4 className="text-[0.76rem] font-semibold text-slate-800 sm:text-[0.7rem]">Identité & contact</h4>
                  </div>
                  <div className="min-w-0 divide-y divide-slate-100/80 px-3">
                    <CompactLabelValue label="Nom complet" value={titleCaseName(formatPersonName({ prenom: formData.prenom, nom: formData.nom }))} />
                    <CompactLabelValue label="Téléphone" value={isValidSenegalPhone(formData.telephone) ? `+221 ${formatSenegalPhone(formData.telephone, formData.telephone)}` : formData.telephone} />
                    {formData.email && <CompactLabelValue label="Email" value={formData.email} />}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[0.95rem] border border-emerald-950/10 bg-[#fffdf8]/86 shadow-[0_8px_22px_rgba(15,23,42,0.024)]">
                  <div className="flex items-center gap-2 border-b border-slate-100/80 px-3 py-2 sm:py-[0.55rem]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 text-amber-700 sm:h-[22px] sm:w-[22px]">
                      <Briefcase className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                    </span>
                    <h4 className="text-[0.76rem] font-semibold text-slate-800 sm:text-[0.7rem]">Gestion</h4>
                  </div>
                  <div className="min-w-0 divide-y divide-slate-100/80 px-3">
                    {formData.adresse && <CompactLabelValue label="Adresse" value={formData.adresse} />}
                    {formData.piece_identite && <CompactLabelValue label="Pièce d'identité" value={formatSenegalCni(formData.piece_identite)} />}
                    <CompactLabelValue label="Commission" value={`${formData.commission || 0}%`} />
                    {formData.debut_contrat && <CompactLabelValue label="Début de gestion" value={formatDate(formData.debut_contrat)} />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </WizardShell>

      <ConfirmModal
        isOpen={showCloseConfirm}
        title="Quitter sans enregistrer ?"
        message="Les informations saisies seront perdues."
        confirmLabel="Quitter"
        cancelLabel="Annuler"
        onConfirm={handleConfirmClose}
        onClose={() => setShowCloseConfirm(false)}
        isDestructive
      />

      <Modal
        isOpen={!!lifecycleTarget}
        onClose={closeLifecycleModal}
        title="Cycle de vie du bailleur"
      >
        {lifecycleTarget && (
          <div className="space-y-5">
            {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

            <div className="rounded-[1.25rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
                <div>
                  <p className="text-sm font-black text-amber-950">
                    Action métier sensible
                  </p>
                  <p className="mt-1 text-sm leading-6 text-amber-900">
                    La résiliation conserve l'historique financier et documentaire. Les biens,
                    contrats et encaissements liés restent traçables.
                  </p>
                </div>
              </div>
            </div>

            <div className="sk-card-premium p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Bailleur concerné</p>
              <p className="mt-1 text-xl font-black text-slate-950">
                {lifecycleTarget.prenom} {lifecycleTarget.nom}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Commission {formatCommission(lifecycleTarget.commission)} · début {formatDate(lifecycleTarget.debut_contrat)}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sk-metric-tile">
                <Building2 className="h-5 w-5 text-brand-700" />
                <p className="mt-3 text-xs font-bold uppercase text-slate-500">Immeubles</p>
                <p className="text-2xl font-black text-slate-950">
                  {loadingImpacts ? '...' : lifecycleImpacts?.immeubles_actifs ?? 0}
                </p>
              </div>
              <div className="sk-metric-tile">
                <Home className="h-5 w-5 text-brand-700" />
                <p className="mt-3 text-xs font-bold uppercase text-slate-500">Unités liées</p>
                <p className="text-2xl font-black text-slate-950">
                  {loadingImpacts ? '...' : lifecycleImpacts?.unites_liees ?? 0}
                </p>
              </div>
              <div className="sk-metric-tile">
                <ClipboardList className="h-5 w-5 text-brand-700" />
                <p className="mt-3 text-xs font-bold uppercase text-slate-500">Locations en cours</p>
                <p className="text-2xl font-black text-slate-950">
                  {loadingImpacts ? '...' : lifecycleImpacts?.contrats_actifs ?? 0}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Statut</label>
                <SmartCombobox
                  value={lifecycleForm.statut}
                  options={[
                    { value: 'resilie', label: 'Résilié' },
                    { value: 'suspendu', label: 'Suspendu' },
                    { value: 'cloture', label: 'Clôturé' },
                    { value: 'archive', label: 'Archivé' },
                  ]}
                  onChange={(next) => setLifecycleForm({ ...lifecycleForm, statut: next as BailleurLifecycleStatus })}
                  placeholder="Statut"
                  searchPlaceholder="Rechercher un statut..."
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Date d'effet</label>
                <input aria-label="Champ de saisie"
                  type="date"
                  value={lifecycleForm.date}
                  onChange={(e) => setLifecycleForm({ ...lifecycleForm, date: e.target.value })}
                  className="sk-input"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Motif</label>
              <input
                value={lifecycleForm.motif}
                onChange={(e) => setLifecycleForm({ ...lifecycleForm, motif: e.target.value })}
                className="sk-input"
                placeholder="Fin de mandat, changement de gestion, décision du bailleur..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Observations</label>
              <textarea
                value={lifecycleForm.observations}
                onChange={(e) => setLifecycleForm({ ...lifecycleForm, observations: e.target.value })}
                rows={3}
                className="sk-input resize-none"
                placeholder="Notes internes, prochaines actions, documents à récupérer..."
              />
            </div>

            <label className="flex items-start gap-3 rounded-[1.25rem] border border-emerald-950/10 bg-emerald-50/50 p-4 shadow-sm">
              <input
                type="checkbox"
                checked={lifecycleForm.acknowledge_impacts}
                onChange={(e) => setLifecycleForm({ ...lifecycleForm, acknowledge_impacts: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
              />
              <span className="text-sm leading-6 text-slate-700">
                Je confirme avoir vérifié les impacts sur les biens, locations en cours,
                locataires et encaissements futurs.
              </span>
            </label>

            <div className="flex flex-col-reverse gap-3 border-t border-emerald-950/10 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeLifecycleModal}
                disabled={isLifecycleSubmitting}
                className="sk-action sk-action-secondary justify-center"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmLifecycle}
                disabled={isLifecycleSubmitting || !lifecycleForm.acknowledge_impacts}
                className="sk-action sk-action-danger justify-center disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLifecycleSubmitting ? 'Validation...' : 'Valider le changement'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Conteneur de toasts */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </PageShell>
  );
}

function BailleurWizardStepContext({ step }: { step: BailleurWizardStep }) {
  const copy: Record<BailleurWizardStep, { title?: string; body: string }> = {
    identity: {
      body: 'Identifiez le propriétaire avant de lui rattacher des biens, mandats et documents.',
    },
    admin: {
      body: 'Cadrez le mandat, la commission et le début de gestion.',
    },
    summary: {
      title: 'Validation finale',
      body: 'La fiche sera ajoutée au portefeuille propriétaire. Vous pourrez ensuite rattacher biens, mandats et documents.',
    },
  };
  const current = copy[step];

  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-[0.1rem] flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-emerald-950/10 bg-emerald-50/60 text-emerald-700 sm:h-[18px] sm:w-[18px]">
        <ShieldAlert className="h-2.5 w-2.5" />
      </span>
      <div className="min-w-0">
        {current.title && (
          <p className="text-[0.68rem] font-semibold leading-tight text-slate-900 sm:text-[0.64rem]">
            {current.title}
          </p>
        )}
        <p className="min-w-0 text-[0.72rem] font-medium leading-snug text-slate-600 sm:text-[0.66rem]">
          {current.body}
        </p>
      </div>
    </div>
  );
}

function BailleurWizardRail({ steps, currentStep }: { steps: WizardStep[]; currentStep: number }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5">
        <BrandMark size="sm" tone="dark" animated withTile={false} />
        <div>
          <p className="text-[0.5rem] font-bold uppercase tracking-[0.18em] text-amber-200/68">Portefeuille propriétaire</p>
          <p className="mt-0.5 text-[0.6rem] font-semibold text-white/[0.56]">Fiche propriétaire guidée</p>
        </div>
      </div>

      <div className="mt-3">
        <p className="max-w-[11rem] text-[0.72rem] font-semibold leading-tight text-white/[0.86]">
          Structurez le portefeuille propriétaire.
        </p>
        <p className="mt-1 max-w-[11rem] text-[0.6rem] font-medium leading-snug text-emerald-50/[0.56]">
          Une fiche claire pour rattacher biens, mandats et reversements.
        </p>
      </div>

      <div className="relative mt-3 space-y-1">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = index < currentStep;

          return (
            <div
              key={step.id}
              className={`flex min-h-[2.05rem] items-center gap-2 rounded-lg border px-2 py-[0.22rem] transition ${
                isActive
                  ? 'border-amber-100/16 bg-white/[0.038] text-white shadow-[0_3px_8px_rgba(0,0,0,0.036)]'
                  : isComplete
                    ? 'border-white/10 bg-emerald-300/[0.038] text-emerald-50/[0.78]'
                    : 'border-white/[0.075] bg-white/[0.018] text-emerald-50/[0.78]'
              }`}
            >
              <span
                className={`relative z-[1] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[0.5rem] text-[0.58rem] font-semibold ${
                  isActive
                    ? 'bg-[#fff3ce]/94 text-emerald-950 ring-1 ring-amber-100/55'
                    : isComplete
                      ? 'bg-emerald-300/[0.12] text-emerald-50'
                      : 'bg-white/[0.1] text-emerald-50/[0.84]'
                }`}
              >
                {isComplete ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.47rem] font-bold uppercase tracking-[0.13em] opacity-75">
                  Étape {index + 1}
                </span>
                <span className="block truncate text-[0.67rem] font-semibold">{step.label}</span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.055] bg-white/[0.026] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
        <p className="text-[0.47rem] font-semibold uppercase tracking-[0.16em] text-amber-100/[0.66]">SOURCE DE VÉRITÉ</p>
        <p className="mt-1 text-[0.58rem] font-medium leading-snug text-emerald-50/[0.56]">
          Biens, mandats, rapports et reversements partiront de cette fiche.
        </p>
      </div>
    </div>
  );
}
// --- Sous-composants Formulaires Premium -------------------------------------

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  required = false,
  step,
  min,
  max,
  maxLength,
  inputMode,
  suffix,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'number' | 'date';
  disabled?: boolean;
  required?: boolean;
  step?: string;
  min?: string;
  max?: string;
  maxLength?: number;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  suffix?: string;
  helperText?: string;
}) {
  return (
    <label className="block">
      <span className="text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">{label} {required && <span className="text-red-500">*</span>}</span>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          step={step}
          min={min}
          max={max}
          maxLength={maxLength}
          inputMode={inputMode || (type === 'number' ? 'numeric' : type === 'tel' ? 'tel' : undefined)}
          className={`mt-0.5 h-9 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 text-[0.93rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 disabled:bg-slate-50 disabled:text-slate-500 autofill:bg-white autofill:shadow-[inset_0_0_0px_1000px_white] sm:!h-8 sm:!min-h-8 sm:rounded-[0.6rem] sm:text-[0.8rem] ${suffix ? 'pl-3 pr-8' : 'px-3'}`}
        />
        {suffix && <span className="absolute bottom-3 right-3 text-[0.72rem] font-semibold text-slate-400 sm:bottom-2 sm:text-[0.68rem]">{suffix}</span>}
      </div>
      {helperText && <p className="mt-1 text-[0.66rem] text-slate-500 sm:text-[10px]">{helperText}</p>}
    </label>
  );
}

function CompactMetric({ label, value, tone = 'slate' }: { label: string; value: ReactNode; tone?: 'emerald'|'red'|'blue'|'amber'|'slate' }) {
  const tones = {
    emerald: 'text-emerald-700 bg-emerald-50/40 border-emerald-100',
    red: 'text-red-700 bg-red-50/40 border-red-100',
    blue: 'text-blue-700 bg-blue-50/40 border-blue-100',
    amber: 'text-amber-700 bg-amber-50/40 border-amber-100',
    slate: 'text-slate-700 bg-slate-50/40 border-slate-100',
  };
  return (
    <div className={`rounded-lg border p-1.5 ${tones[tone]}`}>
      <p className="text-[0.54rem] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-0.5 text-[0.76rem] font-extrabold">{value}</p>
    </div>
  );
}

function MicroMetric({ label, value, tone = 'slate' }: { label: string; value: ReactNode; tone?: 'emerald'|'red'|'blue'|'amber'|'slate' }) {
  const tones = {
    emerald: 'text-emerald-700 bg-emerald-50/40 border-emerald-100',
    red: 'text-red-700 bg-red-50/40 border-red-100',
    blue: 'text-blue-700 bg-blue-50/40 border-blue-100',
    amber: 'text-amber-700 bg-amber-50/40 border-amber-100',
    slate: 'text-slate-700 bg-slate-50/40 border-slate-100',
  };
  return (
    <div className={`rounded-md border px-1.5 py-1 ${tones[tone]}`}>
      <p className="text-[0.5rem] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-0.5 text-[0.65rem] font-bold">{value}</p>
    </div>
  );
}

function CompactSection({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-[14px] border border-emerald-950/10 bg-white/80 p-2.5 shadow-sm">
      <h3 className="mb-2 flex items-center gap-1.5 text-[0.6rem] font-black uppercase tracking-wider text-slate-500 min-w-0">
        {Icon && <Icon className="shrink-0 h-3.5 w-3.5 text-slate-400" />}
        <span className="truncate">{title}</span>
      </h3>
      <div className="min-w-0">
        {children}
      </div>
    </section>
  );
}

function CompactLabelValue({ label, value }: { label: string; value: ReactNode | null | undefined }) {
  if (!value || value === '—') return null;
  const isIdentity = label.toLowerCase().includes('identit');
  const isName = label === 'Nom complet';
  return (
    <div className={`flex min-w-0 items-start justify-between gap-3 ${isName ? 'py-1.5 sm:py-[0.55rem]' : 'py-1.5 sm:py-[0.42rem]'}`}>
      <span className="shrink-0 text-[0.72rem] font-medium text-slate-500 sm:text-[0.66rem] mt-[2px]">{label}</span>
      <span
        className={`min-w-0 flex-1 text-right font-semibold break-words ${isIdentity ? 'tabular-nums tracking-[-0.01em] text-slate-700' : ''} ${isName ? 'text-[0.82rem] text-slate-950 sm:text-[0.74rem]' : 'text-[0.74rem] text-slate-800 sm:text-[0.68rem]'}`}
        style={{ overflowWrap: 'anywhere' }}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </span>
    </div>
  );
}

