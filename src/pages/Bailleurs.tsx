import React, { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { ToastContainer } from '../components/ui/Toast';
import {
  Plus,
  Search,
  FileText,
  AlertCircle,
  Ban,
  ShieldAlert,
  Building2,
  Home,
  ClipboardList,
  Wallet,
  ReceiptText,
  Users,
  Phone,
  Mail,
  MapPin,
  SlidersHorizontal,
  X,
  BarChart3,
  FolderOpen,
  CreditCard,
  CircleUser,
  DoorOpen,
  Percent,
  ChevronRight,
} from 'lucide-react';
import {
  addFooter,
  drawDocumentHeader,
  drawLegalVerificationFooter,
  drawPageBorder,
  drawTotalsBlock,
  generateMandatBailleurPDF,
  getAutoTableTheme,
  saveGeneratedPdf,
} from '../lib/pdf';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { translateSupabaseError, getSuccessMessage } from '../lib/errorMessages';
import { formatDate, formatSenegalPhone, formatSenegalPhoneInput, normalizeSenegalPhone } from '../lib/formatters';
import { formatPersonName } from '../lib/people';
import { PremiumFilterSelect } from '../components/ui/PremiumFilterSelect';
import { PremiumToolbar } from '../components/ui/PremiumToolbar';
import { PremiumTableSurface } from '../components/ui/PremiumTableSurface';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { MiniMetric } from '../components/ui/MetricCard';
import { MoneyText } from '../components/ui/MoneyText';
import { PremiumMobileCard } from '../components/ui/PremiumMobileCard';
import { ProductWizard, type ProductWizardStep } from '../components/ui/ProductWizard';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { PremiumButton } from '../components/ui/PremiumButton';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { PageSkeleton } from '../components/ui/Skeleton';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import {
  updateBailleurLifecycleViaEdge,
  type BailleurLifecycleStatus,
  type BailleurLifecycleImpacts,
} from '../services/api/bailleurApi';
import type { AgencySettings } from '../types/agency';
import { PageShell } from '../components/ui/PageShell';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumKpiGrid } from '../components/ui/PremiumKpiGrid';
import { MetricCard } from '../components/ui/MetricCard';

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

const BAILLEUR_WIZARD_STEPS: ProductWizardStep<BailleurWizardStep>[] = [
  { id: 'identity', label: 'Identité', icon: CircleUser },
  { id: 'admin', label: 'Gestion', icon: Wallet },
  { id: 'summary', label: 'Validation', icon: ShieldAlert },
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

type DrawerTab = 'overview' | 'biens' | 'contrats' | 'paiements' | 'depenses' | 'rapports' | 'documents';
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
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'rapports', label: 'Rapports' },
  { id: 'biens', label: 'Biens' },
  { id: 'paiements', label: 'Paiements' },
];

const DRAWER_MORE_TABS: Array<{ id: DrawerTab; label: string }> = [
  { id: 'documents', label: 'Documents' },
  { id: 'contrats', label: 'Locations liées' },
  { id: 'depenses', label: 'Dépenses' },
];

/**
 * Composant d'alerte pour les erreurs
 */
const ErrorAlert: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
    <div className="flex-1">
      <p className="text-sm text-red-800">{message}</p>
    </div>
    <button
      onClick={onClose}
      className="text-red-700 hover:text-red-900 transition"
    >
      ×
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
    <div className="rounded-2xl border border-dashed border-emerald-950/15 bg-[#fffdf7]/85 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50/85 text-emerald-800 ring-1 ring-emerald-100">
        <FolderOpen className="h-4 w-4" />
      </div>
      <p className="mt-3 text-sm font-bold text-slate-950">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-500">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
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
    <div className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#fffdf8] shadow-[0_10px_26px_rgba(15,23,42,0.035)]">
      {rows.map((row) => {
        const isClickable = !!row.onClick;
        const content = (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950">{row.title}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{row.subtitle}</p>
            </div>
            <div className="shrink-0 flex flex-col items-end text-right">
              {row.value && <p className="text-sm font-bold text-slate-950">{row.value}</p>}
              <div className="mt-1 flex items-center justify-end gap-1.5">
                {row.badge && <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">{row.badge}</span>}
                {isClickable && <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />}
              </div>
            </div>
          </>
        );

        return isClickable ? (
          <button
            key={row.id}
            type="button"
            onClick={row.onClick}
            className="group flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5 text-left transition last:border-b-0 hover:bg-emerald-50/50 focus-visible:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
            aria-label={`Ouvrir ${row.title}`}
          >
            {content}
          </button>
        ) : (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5 last:border-b-0"
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
  .toLocaleLowerCase('fr-FR')
  .replace(/(^|[\s'-])(\p{L})/gu, (_, separator: string, letter: string) => `${separator}${letter.toLocaleUpperCase('fr-FR')}`);

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
              .select('agency_id, nom_agence, adresse, telephone, email, logo_url, couleur_primaire, couleur_secondaire, pied_page_personnalise')
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
          const documentsRes = await supabase
            .from('documents')
            .select('id, name, document_category, entity_type, entity_id, lifecycle_status, created_at')
            .eq('agency_id', profile.agency_id)
            .limit(300);
          if (!documentsRes.error) {
            documents = (documentsRes.data || []) as DetailDocument[];
          }

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
    if (filteredBailleurs.length === 0) {
      setSelectedBailleurId(null);
      setDetailOpen(false);
      return;
    }
    if (selectedBailleurId && !filteredBailleurs.some((item) => item.id === selectedBailleurId)) {
      setSelectedBailleurId(null);
      setDetailOpen(false);
    }
  }, [filteredBailleurs, selectedBailleurId]);

  const selectedBailleur = useMemo(
    () => bailleurs.find((item) => item.id === selectedBailleurId) ?? null,
    [bailleurs, selectedBailleurId],
  );
  const selectedSummary = selectedBailleur ? summariesByBailleur[selectedBailleur.id] ?? emptySummary() : emptySummary();
  const detailPanelOpen = detailOpen && !!selectedBailleur;

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

    try {
      setIsSubmitting(true);
      setError(null);

      const submitData = {
        nom: formData.nom,
        prenom: formData.prenom,
        telephone: normalizedPhone,
        email: formData.email || null,
        adresse: formData.adresse || null,
        piece_identite: formData.piece_identite || null,
        notes: formData.notes || null,
        commission: formData.commission ? parseFloat(formData.commission) : null,
        debut_contrat: formData.debut_contrat,
        updated_at: new Date().toISOString(),
      };

      if (editingBailleur) {

        const { error: updateError } = await supabase
          .from('bailleurs')
          .update(submitData)
          .eq('id', editingBailleur.id);

        if (updateError) throw updateError;
        toast.success(getSuccessMessage('update', 'Bailleur'));
      } else {
        // Création
        const { error: insertError } = await supabase
          .from('bailleurs')
          .insert([{
            ...submitData,
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
      piece_identite: bailleur.piece_identite || '',
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
      await generateMandatBailleurPDF(bailleur as unknown as Parameters<typeof generateMandatBailleurPDF>[0]);
    } catch (err) {
      console.error('Erreur génération PDF:', err);
      setError('Impossible de générer le mandat PDF.');
    }
  };

  const handleGenerateBailleurReport = async (bailleur: Bailleur) => {
    const summary = summariesByBailleur[bailleur.id] ?? emptySummary();
    const reportPaiements = summary.paiements.filter((paiement) => String(paiement.mois_concerne ?? paiement.date_paiement ?? '').startsWith(reportMonth));
    const reportDepenses = summary.depenses.filter((depense) => String(depense.date_depense ?? '').startsWith(reportMonth));
    const getPaymentNet = (paiement: DetailPaiement) => Number(paiement.part_bailleur ?? (Number(paiement.montant_total ?? 0) - Number(paiement.part_agence ?? 0)));
    const totalLoyers = reportPaiements.reduce((sum, paiement) => sum + Number(paiement.montant_total ?? 0), 0);
    const totalReliquats = reportPaiements.reduce((sum, paiement) => sum + Math.max(Number(paiement.reliquat ?? 0), 0), 0);
    const totalCommissions = reportPaiements.reduce((sum, paiement) => sum + Number(paiement.part_agence ?? 0), 0);
    const totalNet = reportPaiements.reduce((sum, paiement) => sum + getPaymentNet(paiement), 0);
    const totalDepenses = reportDepenses.reduce((sum, depense) => sum + Number(depense.montant ?? 0), 0);

    if (reportPaiements.length === 0 && summary.immeubles.length === 0) {
      toast.warning('Aucune donnée à consolider pour ce bailleur sur la période sélectionnée.');
      return;
    }

    try {
      setGeneratingReport(true);
      const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const settings: Partial<AgencySettings> = {
        ...(pageData.agencySettings ?? {}),
        agency_id: pageData.agencySettings?.agency_id ?? profile?.agency_id ?? undefined,
        is_bailleur_account: accountProfile.isIndividualOwner,
        organization_type: accountProfile.type,
      };
      const periodLabel = formatMonthLabel(reportMonth);
      const reportRef = `RBL-${reportMonth}-${bailleur.id.slice(0, 8).toUpperCase()}`;
      const reportTitle = accountProfile.isIndividualOwner ? 'Résumé mensuel propriétaire' : 'Rapport mensuel bailleur';
      const netLabel = accountProfile.isIndividualOwner ? 'Revenus nets' : 'Net à reverser';
      const tableTheme = getAutoTableTheme(settings);
      const recoveryBase = totalLoyers + totalReliquats;
      const recoveryRate = recoveryBase > 0 ? Math.round((totalLoyers / recoveryBase) * 100) : 100;

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
      autoTable(doc, {
        body: [
          ['Loyers encaissés', formatCurrency(totalLoyers), 'Reliquats à suivre', formatCurrency(totalReliquats)],
          [accountProfile.isIndividualOwner ? 'Frais / dépenses' : 'Commissions agence', formatCurrency(accountProfile.isIndividualOwner ? totalDepenses : totalCommissions), netLabel, formatCurrency(totalNet)],
          ['Taux de recouvrement', `${recoveryRate}%`, 'Biens concernés', String(summary.immeubles.length)],
        ],
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
        totalReliquats > 0
          ? `Les reliquats ouverts représentent ${formatCurrency(totalReliquats)} et doivent rester prioritaires dans le suivi de gestion.`
          : 'Aucun reliquat significatif n’est rattaché aux paiements enregistrés sur cette période.',
        `Le montant ${netLabel.toLowerCase()} ressort à ${formatCurrency(totalNet)}.`,
      ].join(' ');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const summaryLines = doc.splitTextToSize(summaryText, 178);
      doc.text(summaryLines, 14, y);
      y += summaryLines.length * 4.7 + 9;

      sectionTitle('Détail par bien', 'Lecture par immeuble, unité, locataire et situation financière.');
      const contractById = new Map(summary.contrats.map((contrat) => [contrat.id, contrat]));
      const unitById = new Map(summary.unites.map((unite) => [unite.id, unite]));
      const rows = reportPaiements.map((paiement) => {
        const contrat = paiement.contrat_id ? contractById.get(paiement.contrat_id) : null;
        const unite = contrat?.unite_id ? unitById.get(contrat.unite_id) : null;
        const immeuble = summary.immeubles.find((item) => item.id === unite?.immeuble_id);
        return {
          id: paiement.id,
          immeuble: immeuble?.nom ?? 'Bien non renseigné',
          unite: unite?.nom ?? 'Unité non renseignée',
          locataire: contrat?.locataires ? formatPersonName(contrat.locataires, '') : 'Locataire non renseigné',
          loyer: formatCurrency(contrat?.loyer_mensuel ?? 0),
          statut: Number(paiement.reliquat ?? 0) > 0 ? 'Partiel' : 'Soldé',
          encaisse: formatCurrency(paiement.montant_total),
          reliquat: formatCurrency(paiement.reliquat),
          net: formatCurrency(getPaymentNet(paiement)),
        };
      });

      autoTable(doc, {
        head: [['Bien', 'Unité', 'Locataire', 'Loyer', 'Statut', 'Encaissé', 'Reliquat', 'Net']],
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

      if (reportDepenses.length > 0) {
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
          { label: 'Loyers encaissés', value: formatCurrency(totalLoyers) },
          { label: 'Reliquats à suivre', value: formatCurrency(totalReliquats) },
          ...(accountProfile.isIndividualOwner ? [{ label: 'Dépenses', value: formatCurrency(totalDepenses) }] : [{ label: 'Commissions agence', value: formatCurrency(totalCommissions) }]),
          { label: netLabel, value: formatCurrency(totalNet), emphasis: true },
        ],
        settings,
      );

      try {
        await drawLegalVerificationFooter(doc, {
          ref: reportRef,
          type: 'rapport_bailleur',
          agency: settings.nom_agence ?? 'Samay Këur',
          date: new Date().toISOString(),
          settings,
        });
      } catch {
        // Le QR de vérification est non bloquant pour ne pas empêcher la génération.
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
        data: {
          document: 'rapport_bailleur',
          reportMonth,
          bailleur,
          totals: { totalLoyers, totalReliquats, totalCommissions, totalDepenses, totalNet, recoveryRate },
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
   * Fermeture du modal
   */
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBailleur(null);
    setError(null);
    setBailleurWizardStep('identity');
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
  const ALL_COLUMN_KEYS_BAILLEURS = ['bailleur', 'telephone', 'commission', 'biens', 'unites', 'reliquats', 'net', 'statut'] as const;
  type BailleurColumnKey = typeof ALL_COLUMN_KEYS_BAILLEURS[number];
  const DETAIL_OPEN_HIDDEN_COLUMNS = new Set<BailleurColumnKey>(['telephone', 'commission', 'biens', 'unites', 'statut']);
  const { visibility: colVis, toggle: colToggle, setAll: colSetAll, isVisible: colIsVisible } = useColumnVisibility(
    'bailleurs-v3',
    [...ALL_COLUMN_KEYS_BAILLEURS],
    { telephone: false, commission: false }
  );
  const showBailleurColumn = (key: BailleurColumnKey) => colIsVisible(key) && !(detailPanelOpen && DETAIL_OPEN_HIDDEN_COLUMNS.has(key));

  const allColumns = [
    { key: 'bailleur', label: 'Bailleur', required: true },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'commission', label: 'Commission' },
    { key: 'biens', label: 'Biens' },
    { key: 'unites', label: 'Unités' },
    { key: 'reliquats', label: 'Reliquats' },
    { key: 'net', label: 'Net' },
    { key: 'statut', label: 'Statut', required: true },
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
        <div className="grid gap-3 xl:grid-cols-2">
          <section className="rounded-2xl border border-emerald-950/10 bg-[#fffdf8] p-3.5 shadow-[0_14px_34px_rgba(15,23,42,0.045)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Résumé paiements</p>
                <p className="mt-0.5 text-[0.95rem] font-extrabold tabular-nums text-slate-950"><MoneyText value={selectedSummary.loyers} /></p>
              </div>
              <div
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-center text-[9px] font-black text-brand-950"
                aria-label={`Taux de recouvrement ${paidRate}%`}
              >
                <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
                  <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#d1fae5" strokeWidth="4" />
                  <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#047857" strokeWidth="4" strokeDasharray={`${paidRate} ${100 - paidRate}`} />
                </svg>
                <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#fffdf8]">{paidRate}%</span>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Commissions</span><strong className="font-bold"><MoneyText value={selectedSummary.commissions} /></strong></div>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Net à reverser</span><strong className="font-bold text-emerald-800"><MoneyText value={selectedSummary.net} /></strong></div>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Reliquats</span><strong className={`font-bold ${selectedSummary.reliquats > 0 ? 'text-red-600' : 'text-slate-900'}`}><MoneyText value={selectedSummary.reliquats} /></strong></div>
            </div>
          </section>
          <section className="rounded-2xl border border-emerald-950/10 bg-[#fffdf8] p-3.5 shadow-[0_14px_34px_rgba(15,23,42,0.045)]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Activité récente</p>
              <button type="button" onClick={() => setActiveDrawerTab('paiements')} className="text-xs font-bold text-emerald-800 hover:text-emerald-950">Voir tout</button>
            </div>
            <div className="mt-3 space-y-2">
              {recentActivity.length === 0 ? (
                <EmptyDrawerState title="Aucune activité récente" description="Les contrats, paiements et documents de ce bailleur apparaîtront ici." />
              ) : recentActivity.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="flex items-start gap-2.5 rounded-xl bg-slate-50/80 px-2.5 py-1.5 ring-1 ring-slate-100">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#fffdf8] text-emerald-700 shadow-sm"><Icon className="h-3 w-3" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.7rem] font-semibold text-slate-900">{item.title}</p>
                      <p className="truncate text-[0.6rem] text-slate-500">{item.detail}</p>
                    </div>
                    <span className="text-[9px] font-semibold text-slate-400">{formatDate(item.date)}</span>
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
        <EmptyDrawerState title="Aucun bien rattaché" description="Ajoutez un bien pour commencer à suivre les unités, locataires et loyers de ce bailleur." actionLabel="Ajouter un bien" onAction={() => { window.location.hash = '#/patrimoine'; }} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#fffdf8]">
          {selectedSummary.immeubles.map((immeuble) => {
            const units = selectedSummary.unites.filter((unite) => unite.immeuble_id === immeuble.id);
            const occupied = units.filter((unite) => unite.statut === 'loue').length;
            const potential = units.reduce((sum, unite) => sum + Number(unite.loyer_base ?? 0), 0);
            const rate = units.length ? Math.round((occupied / units.length) * 100) : 0;
            return (
              <button
                key={immeuble.id}
                type="button"
                onClick={() => { window.location.hash = '#/patrimoine'; }}
                className="group flex w-full flex-col gap-2.5 border-b border-slate-100 px-3.5 py-3 text-left last:border-b-0 hover:bg-emerald-50/50 focus-visible:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 sm:flex-row sm:items-center sm:justify-between"
                aria-label={`Ouvrir le bien ${immeuble.nom}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950">{immeuble.nom}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{[immeuble.adresse, immeuble.quartier, immeuble.ville].filter(Boolean).join(', ') || 'Adresse non renseignée'}</p>
                </div>
                <div className="flex-shrink-0 text-sm text-slate-600">{units.length} unité{units.length > 1 ? 's' : ''} · {rate}% occupé</div>
                <div className="flex flex-shrink-0 items-center justify-end gap-2 text-right">
                  <div className="text-sm font-bold text-slate-950"><MoneyText value={potential} /></div>
                  <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
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
          onClick: () => { window.location.hash = '#/occupants-baux'; },
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
          onClick: () => { window.location.hash = '#/paiements'; },
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
          onClick: () => { window.location.hash = '#/depenses'; },
        }))} />
      );
    }

    if (activeDrawerTab === 'rapports') {
      return (
        <div className="space-y-3">
          <section className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#fffdf8] shadow-[0_16px_42px_rgba(15,23,42,0.055)]">
            <div className="bg-[linear-gradient(135deg,#fff4d8,#fffdf8)] p-4 text-brand-950">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9a5b17]">Registre financier</p>
                  <p className="mt-1 text-base font-black">Rapport bailleur</p>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-slate-600">
                    Synthèse propriétaire préparée depuis cette fiche et archivée dans la GED.
                  </p>
                </div>
                <label className="min-w-[10rem] text-xs font-semibold text-slate-600">
                  Période
                  <input
                    {...{ type: 'month' }}
                    value={reportMonth}
                    onChange={(event) => setReportMonth(event.target.value || currentMonthInput())}
                    className="mt-1 w-full rounded-xl border border-amber-200 bg-[#fffdf8] px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-emerald-200 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
              </div>
            </div>
            <div className="p-4">
              <div className="rounded-xl border border-emerald-950/10 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-900">
                Bilan préparé pour <strong className="font-black">{formatMonthLabel(reportMonth)}</strong> · {selectedSummary.immeubles.length} bien{selectedSummary.immeubles.length > 1 ? 's' : ''} · {reportPaiements.length} paiement{reportPaiements.length > 1 ? 's' : ''}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <MiniMetric label="Loyers" value={<MoneyText value={reportLoyers} />} tone="emerald" />
                <MiniMetric label="Reliquats" value={<MoneyText value={reportReliquats} />} tone="red" />
                <MiniMetric label="Commissions" value={<MoneyText value={reportCommissions} />} tone="amber" />
                <MiniMetric label="Dépenses" value={<MoneyText value={reportExpenses} />} tone="blue" />
                <MiniMetric label="Net" value={<MoneyText value={reportNet} />} tone="slate" />
                <MiniMetric label="Documents" value={String(reportDocuments.length)} tone="slate" />
              </div>
              <button
                type="button"
                onClick={() => void handleGenerateBailleurReport(selectedBailleur)}
                disabled={generatingReport}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] via-[#06281F] to-[#041812] px-3.5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-950/18 transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <BarChart3 className="h-4 w-4" />
                {generatingReport ? 'Génération...' : 'Générer bilan PDF'}
              </button>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Le PDF est archivé avec le type <strong className="font-bold text-slate-700">rapport_bailleur</strong>, rattaché à cette fiche et vérifiable depuis la GED.
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
              onClick: () => { window.location.hash = '#/documents'; },
            }))} />
          )}
        </div>
      );
    }

    return selectedSummary.documents.length === 0 ? (
      <EmptyDrawerState title="Aucun document lié" description="Mandats, contrats, quittances et rapports apparaîtront ici lorsqu’ils seront générés ou uploadés." />
    ) : (
      <CompactList rows={selectedSummary.documents.slice(0, 8).map((document) => ({
        id: document.id,
        title: document.name || 'Document sans nom',
        subtitle: `Le ${formatDate(document.created_at)}`,
        badge: document.lifecycle_status || document.document_category || 'GED',
        onClick: () => { window.location.hash = '#/documents'; },
      }))} />
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

      <div className="flex min-h-full">
        <div className={`flex-1 min-w-0 transition-all duration-300 ${detailPanelOpen ? 'hidden xl:block xl:pr-[31.5rem]' : ''}`}>
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
                  onClick={() => { setBailleurWizardStep('identity'); setIsModalOpen(true); }}
                  icon={<Plus className="h-4 w-4" />}
                  className="w-full sm:w-auto !py-1.5 !px-3 !text-[0.8rem] !h-8"
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
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-800" />
                  <input
                    type="text"
                    placeholder="Propriétaire, téléphone, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 w-full rounded-[0.6rem] border border-emerald-950/10 bg-white/95 pl-8 pr-3 text-xs font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
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
              <div className={`hidden lg:block ${detailPanelOpen ? 'overflow-hidden' : 'overflow-x-auto'}`}>
                <table className={`w-full border-collapse table-fixed ${detailPanelOpen ? 'min-w-[620px]' : 'min-w-[840px]'}`}>
                  <thead className="bg-[#f8f3e8]/70 text-left">
                    <tr>
                      {showBailleurColumn('bailleur') && <th className={`${detailPanelOpen ? 'w-[56%]' : 'w-[36%]'} px-3.5 py-1.5 text-left text-[0.64rem] font-semibold uppercase tracking-wider text-slate-500`}><span className="flex items-center gap-1.5"><CircleUser className="h-3 w-3 text-slate-400" /> Bailleur</span></th>}
                      {showBailleurColumn('telephone') && <th className="w-[12%] px-3.5 py-1.5 text-left text-[0.64rem] font-semibold uppercase tracking-wider text-slate-500"><span className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-400" /> Téléphone</span></th>}
                      {showBailleurColumn('commission') && <th className="w-[8%] px-3.5 py-1.5 text-left text-[0.64rem] font-semibold uppercase tracking-wider text-slate-500"><span className="flex items-center gap-1.5"><Percent className="h-3 w-3 text-slate-400" /> Commission</span></th>}
                      {showBailleurColumn('biens') && <th className="w-[8%] px-3.5 py-1.5 text-left text-[0.64rem] font-semibold uppercase tracking-wider text-slate-500"><span className="flex items-center gap-1.5"><Building2 className="h-3 w-3 text-slate-400" /> Biens</span></th>}
                      {showBailleurColumn('unites') && <th className="w-[8%] px-3.5 py-1.5 text-left text-[0.64rem] font-semibold uppercase tracking-wider text-slate-500"><span className="flex items-center gap-1.5"><DoorOpen className="h-3 w-3 text-slate-400" /> Unités</span></th>}
                      {showBailleurColumn('reliquats') && <th className={`${detailPanelOpen ? 'w-[20%]' : 'w-[17%]'} px-3.5 py-1.5 text-right text-[0.64rem] font-semibold uppercase tracking-wider text-slate-500`}><span className="flex items-center gap-1.5 justify-end"><AlertCircle className="h-3 w-3 text-slate-400" /> Reliquats</span></th>}
                      {showBailleurColumn('net') && <th className={`${detailPanelOpen ? 'w-[20%]' : 'w-[17%]'} px-3.5 py-1.5 text-right text-[0.64rem] font-semibold uppercase tracking-wider text-slate-500`}><span className="flex items-center gap-1.5 justify-end"><Wallet className="h-3 w-3 text-slate-400" /> Net</span></th>}
                      {showBailleurColumn('statut') && <th className="w-[10%] px-3.5 py-1.5 text-left text-[0.64rem] font-semibold uppercase tracking-wider text-slate-500"><span className="flex items-center gap-1.5">Statut</span></th>}
                      <th className="w-[4%] px-2 py-1.5"><span className="sr-only">Ouvrir</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBailleurs.map((bailleur) => {
                      const summary = summariesByBailleur[bailleur.id] ?? emptySummary();
                      const selected = bailleur.id === selectedBailleurId;

                      const isReliquatPositif = summary.reliquats > 0;
                      const isNetPositif = summary.net > 0;
                      const rawStatusLabel = getStatusLabel(bailleur);

                      let subtitleText = '';
                      if (detailPanelOpen) {
                        subtitleText = `${rawStatusLabel} · ${summary.immeubles.length} bien${summary.immeubles.length > 1 ? 's' : ''} · ${summary.unites.length} unité${summary.unites.length > 1 ? 's' : ''}`;
                        if (isReliquatPositif) subtitleText += ' · à suivre';
                        else if (isNetPositif) subtitleText += ' · net positif';
                      } else {
                        if (isReliquatPositif) subtitleText = 'À suivre';
                        else if (isNetPositif) subtitleText = 'Net positif';
                      }

                      return (
                        <tr
                          key={bailleur.id}
                          onClick={() => { setSelectedBailleurId(bailleur.id); setDetailOpen(true); }}
                          className={`cursor-pointer border-b border-slate-100 transition-colors duration-150 outline-none hover:bg-emerald-50/40 focus-visible:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300 ${selected ? 'bg-emerald-50/60 relative z-0 after:absolute after:inset-y-0 after:left-0 after:w-1 after:bg-brand-600' : ''}`}
                        >
                          {showBailleurColumn('bailleur') && <td className="px-3.5 py-1.5">
                            <div className="flex items-center gap-2">
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[0.68rem] font-black shadow-inner ring-1 ${getAvatarTone(bailleur, selected)}`}>{getInitials(bailleur)}</div>
                              <div className="min-w-0">
                                <p className="truncate text-[0.82rem] leading-tight font-semibold text-slate-950">{displayBailleurName(bailleur)}</p>
                                {subtitleText && <p className="truncate text-[0.68rem] leading-snug text-slate-500 mt-0.5">{subtitleText}</p>}
                              </div>
                            </div>
                          </td>}
                          {showBailleurColumn('telephone') && <td className="whitespace-nowrap px-3.5 py-1.5 text-[0.75rem] text-slate-700">{bailleur.telephone ? <a href={`tel:${bailleur.telephone}`} onClick={(e) => e.stopPropagation()} className="hover:text-brand-700 hover:underline">{formatSenegalPhone(bailleur.telephone)}</a> : ''}</td>}
                          {showBailleurColumn('commission') && <td className="whitespace-nowrap px-3.5 py-1.5 text-[0.75rem] font-medium text-slate-700">{formatCommission(bailleur.commission)}</td>}
                          {showBailleurColumn('biens') && <td className="px-3.5 py-1.5 text-[0.8rem] font-medium text-slate-700">{summary.immeubles.length}</td>}
                          {showBailleurColumn('unites') && <td className="px-3.5 py-1.5 text-[0.8rem] font-medium text-slate-700">{summary.unites.length}</td>}
                          {showBailleurColumn('reliquats') && <td className="whitespace-nowrap px-3.5 py-1.5 text-right text-[0.82rem] font-bold tabular-nums text-red-600"><MoneyText value={summary.reliquats} /></td>}
                          {showBailleurColumn('net') && <td className="whitespace-nowrap px-3.5 py-1.5 text-right text-[0.82rem] font-bold tabular-nums text-emerald-800"><MoneyText value={summary.net} /></td>}
                          {showBailleurColumn('statut') && <td className="px-3.5 py-1.5">
                            <span className="inline-flex px-1.5 py-0.5 text-[9px] rounded uppercase font-medium bg-slate-100 text-slate-700">{rawStatusLabel}</span>
                          </td>}
                          <td className="px-2 py-1.5 text-right">
                            <ChevronRight className="h-3 w-3 text-slate-300 inline-block" />
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
                      subtitle={bailleur.telephone ? <a href={`tel:${bailleur.telephone}`} onClick={(e) => e.stopPropagation()} className="hover:text-brand-700 hover:underline">{formatSenegalPhone(bailleur.telephone)}</a> : 'Téléphone non renseigné'}
                      initials={getInitials(bailleur)}
                      status={getStatusLabel(bailleur)}
                      statusTone={bailleur.actif ? 'emerald' : 'slate'}
                      amount={summary.net}
                      amountLabel="Net"
                      meta={[
                        { label: 'Biens', value: summary.immeubles.length },
                        { label: 'Reliquat', value: <MoneyText value={summary.reliquats} compact />, tone: summary.reliquats > 0 ? 'red' : 'slate' },
                      ]}
                    />
                  );
                })}
              </div>
            </>
          )}
          </PremiumTableSurface>
        </section>
        </div>

      {detailPanelOpen && (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-hidden bg-[#fffdf8] shadow-[0_24px_70px_rgba(15,23,42,0.16)] xl:w-[31.5rem] xl:border-l xl:border-emerald-950/10">
          <div className="absolute inset-0 -z-10 bg-slate-900/30 xl:hidden" onClick={() => setDetailOpen(false)} aria-hidden="true" />
            <div className="relative z-10 flex h-full flex-col overflow-y-auto bg-[#fffdf8]">
              {!selectedBailleur ? (
                <div className="flex min-h-full items-center justify-center p-6">
                  <EmptyDrawerState title="Sélectionnez un bailleur" description="Consultez ses biens, paiements, documents et rapports sans quitter le portefeuille." />
                </div>
              ) : (
                <div className="min-h-full bg-[linear-gradient(180deg,#fff5dc,#fffdf8_10.5rem)]">
                  <div className="border-b border-emerald-950/10 p-3.5 sm:p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#9a5b17]">Fiche propriétaire</p>
                      <button type="button" onClick={() => setDetailOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label="Fermer la fiche">
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black shadow-lg shadow-emerald-900/15 ring-1 ${getAvatarTone(selectedBailleur, true)}`}>
                        {getInitials(selectedBailleur)}
                        <span className="absolute -right-0.5 bottom-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5 text-sm text-slate-600">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="min-w-0 flex-1 truncate text-base font-black text-brand-950 sm:text-lg">{displayBailleurName(selectedBailleur)}</h2>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${selectedBailleur.actif ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                            {getStatusLabel(selectedBailleur)}
                          </span>
                        </div>
                        <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{selectedBailleur.telephone ? <a href={`tel:${selectedBailleur.telephone}`} className="hover:text-brand-700 hover:underline">{formatSenegalPhone(selectedBailleur.telephone)}</a> : 'Téléphone non renseigné'}</p>
                        <p className="flex items-center gap-2 truncate"><Mail className="h-4 w-4 text-slate-400" />{selectedBailleur.email ? <a href={`mailto:${selectedBailleur.email}`} className="hover:text-brand-700 hover:underline">{selectedBailleur.email}</a> : 'Email non renseigné'}</p>
                        <p className="flex items-center gap-2 truncate"><MapPin className="h-4 w-4 text-slate-400" />{selectedBailleur.adresse || 'Adresse non renseignée'}</p>
                        <p className="mt-2.5 rounded-xl border border-emerald-950/10 bg-[#fffdf8]/85 px-2.5 py-1.5 text-[0.65rem] font-bold leading-5 text-slate-600 shadow-sm">
                          Portefeuille actif · {selectedSummary.immeubles.length} bien{selectedSummary.immeubles.length > 1 ? 's' : ''} · {selectedSummary.activeContracts} location{selectedSummary.activeContracts > 1 ? 's' : ''} · <span className="text-emerald-800"><MoneyText value={selectedSummary.net} compact /></span> net à reverser
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-4">
                      <div>
                        <p className="mb-2 text-[0.66rem] font-black uppercase tracking-[0.12em] text-[#9a5b17]">Actions principales</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => void handleGenerateBailleurReport(selectedBailleur)} disabled={generatingReport} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] via-[#06281F] to-[#041812] px-3 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-950/18 transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"><BarChart3 className="h-4 w-4" />Rapport PDF</button>
                          <button type="button" onClick={() => handleGenerateMandat(selectedBailleur)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-3 py-2.5 text-sm font-black text-amber-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-100"><FileText className="h-4 w-4" />Mandat PDF</button>
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-[0.66rem] font-black uppercase tracking-[0.12em] text-slate-400">Gestion</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => handleEdit(selectedBailleur)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-950/10 bg-[#fffdf8] px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-brand-900"><FileText className="h-4 w-4" />Modifier</button>
                          <button type="button" onClick={() => setActiveDrawerTab('paiements')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-950/10 bg-[#fffdf8] px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-brand-900"><Wallet className="h-4 w-4" />Paiements</button>
                          <button type="button" onClick={() => setActiveDrawerTab('documents')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-950/10 bg-[#fffdf8] px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-brand-900"><FileText className="h-4 w-4" />Documents</button>
                          <button type="button" onClick={() => setActiveDrawerTab('biens')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-950/10 bg-[#fffdf8] px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-brand-900"><Building2 className="h-4 w-4" />Biens</button>
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-[0.66rem] font-black uppercase tracking-[0.12em] text-red-400">Danger</p>
                        <button type="button" onClick={() => openLifecycleModal(selectedBailleur)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-[#fffdf8] px-3 py-2.5 text-sm font-semibold text-red-600 shadow-sm transition hover:border-red-200 hover:bg-red-50"><Ban className="h-4 w-4" />Résilier</button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 p-3">
                    <div className="grid grid-cols-3 gap-2">
                      <MiniMetric label="Loyers" value={<MoneyText value={selectedSummary.loyers} compact />} tone="emerald" />
                      <MiniMetric label="Reliquats" value={<MoneyText value={selectedSummary.reliquats} compact />} tone="red" />
                      <MiniMetric label="Net" value={<MoneyText value={selectedSummary.net} compact />} tone="emerald" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <MiniMetric label="Biens" value={String(selectedSummary.immeubles.length)} tone="blue" />
                      <MiniMetric label="Unités" value={String(selectedSummary.unites.length)} tone="amber" />
                      <MiniMetric label="Locations" value={String(selectedSummary.activeContracts)} tone="slate" />
                    </div>
                  </div>

                  <div className="border-y border-emerald-950/10 bg-[#fffdf8]/85 px-2.5 py-2">
                    <div className="flex gap-1 overflow-x-auto scroll-smooth scrollbar-none rounded-xl bg-[#fff4df]/80 p-1.5">
                      {[...DRAWER_PRIMARY_TABS, ...DRAWER_MORE_TABS].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={(e) => {
                            setActiveDrawerTab(tab.id);
                            e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                          }}
                          className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition ${activeDrawerTab === tab.id
                              ? 'bg-emerald-900 text-white shadow-sm'
                              : 'text-slate-500 hover:bg-[#fffdf8] hover:text-emerald-900'
                            }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5">{renderDrawerTab()}</div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Modal de création/édition */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingBailleur ? 'Modifier le bailleur' : 'Nouveau bailleur'}
        description="Créez la fiche propriétaire pour lui rattacher des biens, des contrats, et automatiser ses redditions."
      >
        <div className="space-y-4 lg:space-y-6">
          {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

          <ProductWizard
            steps={BAILLEUR_WIZARD_STEPS}
            activeStep={bailleurWizardStep}
            onStepChange={(step) => setBailleurWizardStep(step)}
            onCancel={closeModal}
            onFinalSubmit={() => void handleSubmit()}
            finalSubmitLabel={editingBailleur ? 'Mettre à jour' : 'Créer le bailleur'}
            isSubmitting={isSubmitting}
          >
          <div className={bailleurWizardStep === 'identity' ? 'space-y-4' : 'hidden'}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-900 sm:text-sm">
              Informations principales
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-4">
              <TextField label="Prénom" value={formData.prenom} onChange={(v) => setFormData({ ...formData, prenom: v })} required placeholder="Amadou" />
              <TextField label="Nom" value={formData.nom} onChange={(v) => setFormData({ ...formData, nom: v })} required placeholder="Diop" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-4">
              <TextField type="tel" label="Téléphone" value={formData.telephone} onChange={(v) => setFormData({ ...formData, telephone: formatSenegalPhoneInput(v) })} required placeholder="+221 77 123 45 67" />
              <TextField type="email" label="Email" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} placeholder="amadou.diop@example.com" />
            </div>
          </div>

          <div className={bailleurWizardStep === 'admin' ? 'space-y-4' : 'hidden'}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-900 sm:text-sm">
              Informations complémentaires
            </h3>
            
            <TextField label="Adresse" value={formData.adresse} onChange={(v) => setFormData({ ...formData, adresse: v })} placeholder="123 Avenue Blaise Diagne, Dakar" />
            <TextField label="Pièce d'identité" value={formData.piece_identite} onChange={(v) => setFormData({ ...formData, piece_identite: v })} placeholder="CNI N° 1234567890123" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-4">
              <TextField type="number" step="0.1" min="0" max="100" label="Commission (%)" value={formData.commission} onChange={(v) => setFormData({ ...formData, commission: v })} required placeholder="10" helperText="Taux de commission appliqué aux contrats" />
              <TextField type="date" label="Début du contrat" value={formData.debut_contrat} onChange={(v) => setFormData({ ...formData, debut_contrat: v })} required />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                placeholder="Notes supplémentaires..."
              />
            </div>
          </div>

          {bailleurWizardStep === 'summary' && (
            <div className="space-y-4">
              <WizardIntro title="Validation finale" description="Vérifiez les informations avant création. Cette action enregistrera définitivement la fiche dans le portefeuille locatif." />
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniMetric label="Nom complet" value={titleCaseName(`${formData.prenom || '-'} ${formData.nom || ''}`.trim())} tone="emerald" />
                <MiniMetric label="Téléphone" value={formData.telephone || 'Non renseigné'} />
                <MiniMetric label="Email" value={formData.email || 'Non renseigné'} />
                <MiniMetric label="Commission" value={`${formData.commission || 0}%`} tone="amber" />
                <MiniMetric label="Début mandat" value={formData.debut_contrat || 'Non renseigné'} />
                <MiniMetric label="Pièce d'identité" value={formData.piece_identite || 'Non renseignée'} />
                <MiniMetric label="Adresse" value={formData.adresse || 'Non renseignée'} className="sm:col-span-2" />
                {formData.notes.trim() && <MiniMetric label="Notes" value={formData.notes.trim()} className="sm:col-span-2" />}
              </div>
            </div>
          )}
          </ProductWizard>
        </div>
      </Modal>

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

// ─── Sous-composants Formulaires Premium ─────────────────────────────────────

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
  helperText?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{label} {required && <span className="text-red-500">*</span>}</span>
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
        inputMode={type === 'number' ? 'numeric' : undefined}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500"
      />
      {helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
    </label>
  );
}

function WizardIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-emerald-950/10 bg-gradient-to-br from-[#fffaf1] to-white p-4 shadow-sm">
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{description}</p>
    </div>
  );
}

