/**
 * OccupantsBaux — vue unifiée Locations (Phase 2).
 *
 * Fusionne la lecture Locataires + Contrats en une ligne par bail actif.
 * Ne remplace pas les pages existantes Locataires et Contrats.
 *
 * Colonnes : Locataire · Téléphone · Bien / Unité · Référence · Loyer · Statut · Actions
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Building2,
  CalendarDays,
  ChevronRight,
  FileText,
  Phone,
  RefreshCw,
  Search,
  Users,
  Wallet,
  Activity,
  Archive,
  Ban,
  Check,
  ClipboardList,
  Clock3,
  Download,
  FileCheck2,
  Home,
  Mail,
  Pencil,
  Plus,
  SlidersHorizontal,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useDirectRoute } from '../hooks/useDirectRoute';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { Modal } from '../components/ui/Modal';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { SmartCombobox, type SmartComboboxOption } from '../components/ui/SmartCombobox';
import { MoneyText } from '../components/ui/MoneyText';
import { PremiumMobileCard } from '../components/ui/PremiumMobileCard';
import { BrandMark } from '../components/brand/BrandLogo';
import { WizardShell, type WizardStep } from '../components/ui/WizardShell';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { PremiumButton } from '../components/ui/PremiumButton';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PageShell } from '../components/ui/PageShell';
import { PremiumKpiGrid } from '../components/ui/PremiumKpiGrid';
import { MetricCard } from '../components/ui/MetricCard';
import { PremiumToolbar } from '../components/ui/PremiumToolbar';
import { PremiumTableSurface } from '../components/ui/PremiumTableSurface';
import { SplitViewShell } from '../components/ui/SplitViewShell';
import { PremiumDrawerShell } from '../components/ui/PremiumDrawerShell';
import { useColumnVisibility } from '../hooks/useColumnVisibility';

import {
  occupantsBauxRepository,
  type OccupantBailDetails,
  type ContratStatut,
  type OccupantBailRow,
  type OccupantBailAvailableUnit,
  type OccupantBailPersonInput,
  type OccupantBailPersonOption,
} from '../repositories/occupantsBauxRepository';
import { readWithCache, invalidateOperationalCaches, notifyDataChanged } from '../services/offlineReadCache';
import { formatDate, formatSenegalPhone, normalizeSenegalPhone } from '../lib/formatters';
import {
  IDENTITY_PIECE_OPTIONS,
  formatIdentityNumberInput,
  validateIdentityNumber,
  preventNonDigitKey,
  getIdentityPlaceholder,
  getIdentityMaxLength,
  getIdentityHint,
} from '../lib/senegalIdentity';
import { createContratViaEdge, renewContratViaEdge, updateContratViaEdge } from '../services/api/contratApi';
import { generateContratPDF } from '../lib/pdf';
import { runDocumentGeneration } from '../lib/documentGeneration';

// ─── Types locaux ────────────────────────────────────────────────────────────

type FilterTab = 'tous' | ContratStatut;
type DrawerTab = 'resume' | 'paiements' | 'documents' | 'historique';
type OccupantModalMode = 'create' | 'edit';
type OccupationModalMode = 'create' | 'edit-bail';
type OccupantChoiceMode = 'existing' | 'new';
type LocationWizardStep = 'occupant' | 'unite' | 'conditions' | 'resume';
type PeriodFilter = 'all' | 'starts_this_month' | 'ending_soon' | 'open_ended';

const OCCUPANTS_BAUX_COLUMN_KEYS = ['occupant', 'telephone', 'bien', 'proprietaire', 'reference', 'loyer', 'periode', 'statut'] as const;
type OccupantsBauxColumnKey = typeof OCCUPANTS_BAUX_COLUMN_KEYS[number];

interface TabDef {
  id: FilterTab;
  label: string;
  title: string;
  helper: string;
  icon: LucideIcon;
  tone: 'emerald' | 'blue' | 'amber' | 'red';
}

interface OccupantFormState {
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
  adresse_personnelle: string;
  piece_identite: string;
  type_piece: string;
  numero_piece: string;
}

interface OccupationFormState {
  occupantMode: OccupantChoiceMode;
  occupantSearch: string;
  unitSearch: string;
  locataire_id: string;
  unite_id: string;
  date_debut: string;
  date_fin: string;
  loyer_mensuel: string;
  caution: string;
  commission: string;
  destination: string;
  newOccupant: OccupantFormState;
}

const TABS: TabDef[] = [
  { id: 'tous', label: 'Tous', title: 'LOCATIONS SUIVIES', helper: 'Tous les dossiers', icon: ClipboardList, tone: 'blue' },
  { id: 'actif', label: 'Actifs', title: 'BAUX ACTIFS', helper: 'En cours', icon: Activity, tone: 'emerald' },
  { id: 'expire', label: 'Expirés', title: 'EXPIRÉS', helper: 'À surveiller', icon: Clock3, tone: 'amber' },
  { id: 'resilie', label: 'Résiliés', title: 'RÉSILIÉS', helper: 'Hors cycle actif', icon: Ban, tone: 'red' },
];

const STATUT_BADGE: Record<ContratStatut, { label: string; cls: string }> = {
  actif: { label: 'Actif', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  expire: { label: 'Expiré', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  resilie: { label: 'Résilié', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  archive: { label: 'Archivé', cls: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200' },
  en_attente: { label: 'En attente', cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
};

const ITEMS_PER_PAGE = 15;
const CACHE_KEY = 'occupants-baux-page';

const DRAWER_TABS: Array<{ id: DrawerTab; label: string }> = [
  { id: 'resume', label: 'Résumé' },
  { id: 'paiements', label: 'Paiements' },
  { id: 'documents', label: 'Documents' },
  { id: 'historique', label: 'Historique' },
];

const LOCATION_WIZARD_STEPS: WizardStep[] = [
  { id: 'occupant', label: 'Bail & rattachement' },
  { id: 'conditions', label: 'Conditions' },
  { id: 'resume', label: 'Validation' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fullName(row: OccupantBailRow): string {
  return `${row.prenom} ${row.nom}`.trim();
}

function initialsFromName(first?: string | null, last?: string | null): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || 'LO';
}

function ownerName(row: OccupantBailRow): string {
  const name = `${row.bailleur_prenom ?? ''} ${row.bailleur_nom ?? ''}`.trim();
  return name || 'Propriétaire non renseigné';
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const target = new Date(`${dateIso}T00:00:00.000Z`).getTime();
  const now = new Date(`${todayIso()}T00:00:00.000Z`).getTime();
  return Math.ceil((target - now) / 86_400_000);
}

function canRenew(row: OccupantBailRow): boolean {
  if (row.statut === 'expire') return true;
  const remaining = daysUntil(row.date_fin);
  return row.statut === 'actif' && remaining !== null && remaining <= 90;
}

function emptyOccupantForm(): OccupantFormState {
  return {
    prenom: '',
    nom: '',
    telephone: '',
    email: '',
    adresse_personnelle: '',
    piece_identite: '',
    type_piece: 'CNI',
    numero_piece: '',
  };
}

function emptyOccupationForm(): OccupationFormState {
  return {
    occupantMode: 'existing',
    occupantSearch: '',
    unitSearch: '',
    locataire_id: '',
    unite_id: '',
    date_debut: todayIso(),
    date_fin: addDaysIso(todayIso(), 730),
    loyer_mensuel: '',
    caution: '',
    commission: '',
    destination: 'Habitation',
    newOccupant: emptyOccupantForm(),
  };
}

function occupantFormFromRow(row: OccupantBailRow): OccupantFormState {
  const rawPiece = row.piece_identite ?? '';
  let parsedType = 'CNI';
  let parsedNum = rawPiece;
  if (rawPiece.includes(' - ')) {
    const parts = rawPiece.split(' - ');
    parsedType = parts[0] || 'CNI';
    parsedNum = parts.slice(1).join(' - ');
  }
  return {
    prenom: row.prenom ?? '',
    nom: row.nom ?? '',
    telephone: row.telephone ? formatSenegalPhone(row.telephone, '') : '',
    email: row.email ?? '',
    adresse_personnelle: row.adresse_personnelle ?? '',
    piece_identite: rawPiece,
    type_piece: parsedType,
    numero_piece: parsedNum,
  };
}

function personInputFromForm(form: OccupantFormState): { data: OccupantBailPersonInput | null; error: string | null } {
  const prenom = form.prenom.trim();
  const nom = form.nom.trim();
  const email = form.email.trim();
  const normalizedPhone = normalizeSenegalPhone(form.telephone);

  if (!prenom) return { data: null, error: "Le prénom du locataire est obligatoire." };
  if (!nom) return { data: null, error: "Le nom du locataire est obligatoire." };
  if (!normalizedPhone) return { data: null, error: 'Le téléphone doit être un numéro sénégalais valide.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { data: null, error: "L'email du locataire n'est pas valide." };
  }

  const identityError = validateIdentityNumber(form.numero_piece, form.type_piece);
  if (identityError) {
    return { data: null, error: identityError };
  }

  const numeroPiece = form.numero_piece?.trim() || null;
  const typePiece = form.type_piece || 'CNI';
  const formattedPiece = numeroPiece ? `${typePiece} - ${numeroPiece}` : (form.piece_identite.trim() || null);

  return {
    data: {
      prenom,
      nom,
      telephone: normalizedPhone,
      email: email || null,
      adresse_personnelle: form.adresse_personnelle.trim() || null,
      piece_identite: formattedPiece,
      type_piece: numeroPiece ? typePiece : null,
      numero_piece: numeroPiece,
    },
    error: null,
  };
}

function parsePositiveAmount(value: string, label: string, required = true): { value: number | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) {
    return required ? { value: null, error: `${label} est obligatoire.` } : { value: null, error: null };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || (required && parsed === 0)) {
    return { value: null, error: `${label} doit être un montant positif.` };
  }
  return { value: parsed, error: null };
}

function parseCommission(value: string, isIndividualOwner: boolean): { value: number | null; error: string | null } {
  if (isIndividualOwner) return { value: 0, error: null };
  const parsed = parsePositiveAmount(value, 'La commission agence', false);
  if (parsed.error || parsed.value === null) return parsed;
  if (parsed.value > 100) {
    return { value: null, error: 'La commission agence doit être comprise entre 0 et 100%.' };
  }
  return parsed;
}

function getOccupantsBauxColumnLabel(key: OccupantsBauxColumnKey): string {
  const labels: Record<OccupantsBauxColumnKey, string> = {
    occupant: 'Locataire',
    telephone: 'Téléphone',
    bien: 'Bien / Unité',
    proprietaire: 'Propriétaire',
    reference: 'Référence',
    loyer: 'Loyer',
    periode: 'Période',
    statut: 'Statut',
  };
  return labels[key];
}


// ─── Composant principal ──────────────────────────────────────────────────────

export function OccupantsBaux() {
  const { profile, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const { success: notifySuccess, error: notifyError, toasts, removeToast } = useToast();

  const { clearDirectRouteParams } = useDirectRoute({
    onNew: (params) => {
      const action = params.get('action');
      if (action === 'new-locataire') {
        setOccupantForm(emptyOccupantForm());
        setOccupantModalMode('create');
      } else {
        openCreateOccupation();
        const locataireId = params.get('locataireId');
        const uniteId = params.get('uniteId');
        if (locataireId || uniteId) {
          setOccupationForm((prev) => ({
            ...prev,
            locataire_id: locataireId || prev.locataire_id,
            unite_id: uniteId || prev.unite_id,
          }));
        }
      }
    },
    onSelectId: (id, params) => {
      setSelectedContratId(id);
      const tab = params.get('tab') as DrawerTab | null;
      if (tab) setActiveDrawerTab(tab);
    },
  });

  const [rows, setRows] = useState<OccupantBailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selectedContratId, setSelectedContratId] = useState<string | null>(null);
  const selectedRow = useMemo(() => {
    if (!selectedContratId) return null;
    return rows.find((r) => r.contrat_id === selectedContratId || r.locataire_id === selectedContratId) ?? null;
  }, [rows, selectedContratId]);
  const [activeDrawerTab, setActiveDrawerTab] = useState<DrawerTab>('resume');
  const [details, setDetails] = useState<OccupantBailDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [resiliationTarget, setResiliationTarget] = useState<OccupantBailRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<OccupantBailRow | null>(null);
  const [renewTarget, setRenewTarget] = useState<OccupantBailRow | null>(null);
  const [resiliationForm, setResiliationForm] = useState({ date: todayIso(), motif: '', observations: '' });
  const [renewForm, setRenewForm] = useState({ nouvelle_date_fin: '', nouveau_loyer: '', remarques: '' });
  const [submittingLifecycle, setSubmittingLifecycle] = useState(false);
  const [occupantModalMode, setOccupantModalMode] = useState<OccupantModalMode | null>(null);
  const [occupationModalMode, setOccupationModalMode] = useState<OccupationModalMode | null>(null);
  const [locationWizardStep, setLocationWizardStep] = useState<LocationWizardStep>('occupant');
  const [occupantForm, setOccupantForm] = useState<OccupantFormState>(() => emptyOccupantForm());
  const [occupationForm, setOccupationForm] = useState<OccupationFormState>(() => emptyOccupationForm());
  const [occupantOptions, setOccupantOptions] = useState<OccupantBailPersonOption[]>([]);
  const [availableUnits, setAvailableUnits] = useState<OccupantBailAvailableUnit[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowSubmitting, setWorkflowSubmitting] = useState(false);
  const [pdfGeneratingId, setPdfGeneratingId] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const occupantColumns = useColumnVisibility('occupants-baux', [...OCCUPANTS_BAUX_COLUMN_KEYS], {
    telephone: false,
  });

  // ── Chargement ────────────────────────────────────────────────────────────

  const loadData = useCallback(
    async (force = false) => {
      if (!profile?.agency_id) return;
      const agencyId = profile.agency_id;
      if (rows.length === 0) setLoading(true);
      try {
        const result = await readWithCache<OccupantBailRow[]>(
          { agencyId, userId: profile.id },
          CACHE_KEY,
          async () => {
            const { data, error } = await occupantsBauxRepository.list(agencyId);
            if (error) throw error;
            return data;
          },
          { timeoutMs: 8_000 }
        );
        if (force) {
          // Cache déjà invalidé avant l'appel
        }
        setRows(result.data);
        setCacheTimestamp(result.source === 'cache' ? result.timestamp : null);
      } catch (err) {
        console.error('[OccupantsBaux] load failed', err);
        notifyError('Données indisponibles hors connexion sans cache local.');
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.agency_id, profile?.id]
  );

  const refreshAfterLifecycle = useCallback(async () => {
    if (!profile?.agency_id || !profile?.id) return;
    await invalidateOperationalCaches(
      { agencyId: profile.agency_id, userId: profile.id },
      ['locataires', 'contrats']
    );
    notifyDataChanged(['locataires', 'contrats']);
    await loadData(true);
  }, [loadData, profile?.agency_id, profile?.id]);

  const refreshOccupantsBaux = useCallback(async () => {
    if (!profile?.agency_id || !profile?.id) return;
    await invalidateOperationalCaches(
      { agencyId: profile.agency_id, userId: profile.id },
      ['dashboard', 'locataires', 'contrats', 'patrimoine']
    );
    notifyDataChanged(['locataires', 'contrats', 'dashboard', 'patrimoine']);
    await loadData(true);
  }, [loadData, profile?.agency_id, profile?.id]);

  const loadWorkflowOptions = useCallback(async () => {
    if (!profile?.agency_id) return;
    setWorkflowLoading(true);
    try {
      const [occupantsRes, unitsRes] = await Promise.all([
        occupantsBauxRepository.listOccupants(profile.agency_id),
        occupantsBauxRepository.listAvailableUnits(profile.agency_id),
      ]);
      if (occupantsRes.error) throw occupantsRes.error;
      if (unitsRes.error) throw unitsRes.error;
      setOccupantOptions(occupantsRes.data);
      setAvailableUnits(unitsRes.data);
    } catch (err) {
      console.error('[OccupantsBaux] workflow options failed', err);
      notifyError('Impossible de charger les locataires et unités disponibles.');
    } finally {
      setWorkflowLoading(false);
    }
  }, [notifyError, profile?.agency_id]);

  const openCreateOccupation = useCallback(() => {
    setOccupationForm(emptyOccupationForm());
    setLocationWizardStep('occupant');
    setOccupationModalMode('create');
    void loadWorkflowOptions();
  }, [loadWorkflowOptions]);

  const openEditOccupant = useCallback((row: OccupantBailRow) => {
    setOccupantForm(occupantFormFromRow(row));
    setOccupantModalMode('edit');
  }, []);

  const openEditBail = useCallback((row: OccupantBailRow) => {
    setOccupationForm({
      occupantMode: 'existing',
      occupantSearch: '',
      unitSearch: '',
      locataire_id: row.locataire_id,
      unite_id: row.unite_id,
      date_debut: row.date_debut,
      date_fin: row.date_fin ?? '',
      loyer_mensuel: String(row.loyer_mensuel),
      caution: row.caution != null ? String(row.caution) : '',
      commission: row.commission != null ? String(row.commission) : '',
      destination: row.destination || 'Habitation',
      newOccupant: emptyOccupantForm(),
    });
    setOccupationModalMode('edit-bail');
  }, []);

  const closeOccupantModal = useCallback(() => {
    if (workflowSubmitting) return;
    setOccupantModalMode(null);
    clearDirectRouteParams();
  }, [workflowSubmitting, clearDirectRouteParams]);

  const closeOccupationModal = useCallback(() => {
    if (workflowSubmitting) return;
    setOccupationModalMode(null);
    clearDirectRouteParams();
  }, [workflowSubmitting, clearDirectRouteParams]);

  const submitOccupant = useCallback(async () => {
    if (!profile?.agency_id) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      notifyError("Connexion indisponible : le locataire doit être enregistré par le serveur.");
      return;
    }

    const parsed = personInputFromForm(occupantForm);
    if (parsed.error || !parsed.data) {
      notifyError(parsed.error ?? 'Formulaire locataire invalide.');
      return;
    }

    setWorkflowSubmitting(true);
    try {
      if (occupantModalMode === 'edit' && selectedRow) {
        const { error } = await occupantsBauxRepository.updateOccupant({
          agencyId: profile.agency_id,
          occupantId: selectedRow.locataire_id,
          data: parsed.data,
        });
        if (error) throw error;
        notifySuccess('Locataire mis à jour.');
        setOccupantModalMode(null);
        await refreshOccupantsBaux();
      } else {
        const { data, error } = await occupantsBauxRepository.createOccupant({
          agencyId: profile.agency_id,
          userId: profile.id,
          data: parsed.data,
        });
        if (error) throw error;
        notifySuccess('Locataire créé. Vous pouvez maintenant créer sa location.');
        setOccupantModalMode(null);
        setOccupationForm({
          ...emptyOccupationForm(),
          locataire_id: data?.id ?? '',
          occupantMode: 'existing',
        });
        setLocationWizardStep('occupant');
        setOccupationModalMode('create');
        await loadWorkflowOptions();
      }
    } catch (err) {
      console.error('[OccupantsBaux] save occupant failed', err);
      notifyError("Impossible d'enregistrer le locataire.");
    } finally {
      setWorkflowSubmitting(false);
    }
  }, [loadWorkflowOptions, notifyError, notifySuccess, occupantForm, occupantModalMode, profile?.agency_id, profile?.id, refreshOccupantsBaux, selectedRow]);

  const submitOccupation = useCallback(async () => {
    if (!profile?.agency_id) return;
    if (occupationModalMode === 'create' && locationWizardStep !== 'resume') {
      notifyError('Validez le résumé avant de créer la location.');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      notifyError('Connexion indisponible : le bail doit être confirmé par le serveur.');
      return;
    }


    setWorkflowSubmitting(true);
    try {
      let openContratId: string | null = null;
      if (occupationModalMode === 'edit-bail') {
        if (!selectedRow) throw new Error('Aucune location sélectionnée.');
        if (!occupationForm.date_fin) {
          notifyError('La date de fin est obligatoire pour modifier le bail.');
          return;
        }
        const caution = parsePositiveAmount(occupationForm.caution, 'La caution', false);
        if (caution.error) {
          notifyError(caution.error);
          return;
        }
        const commission = parseCommission(occupationForm.commission, isIndividualOwner);
        if (commission.error) {
          notifyError(commission.error);
          return;
        }
        await updateContratViaEdge({
          id: selectedRow.contrat_id,
          date_fin: occupationForm.date_fin,
          caution: caution.value,
          commission: commission.value,
        });
        notifySuccess('Bail mis à jour.');
      } else {
        let locataireId = occupationForm.locataire_id;
        let createdOccupantId: string | null = null;
        if (occupationForm.occupantMode === 'new') {
          const parsed = personInputFromForm(occupationForm.newOccupant);
          if (parsed.error || !parsed.data) {
            notifyError(parsed.error ?? 'Formulaire du nouveau locataire invalide.');
            return;
          }
          const { data, error } = await occupantsBauxRepository.createOccupant({
            agencyId: profile.agency_id,
            userId: profile.id,
            data: parsed.data,
          });
          if (error || !data?.id) throw error ?? new Error('Locataire non créé.');
          locataireId = data.id;
          createdOccupantId = data.id;
        }
        if (!locataireId) {
          notifyError('Sélectionnez ou créez un locataire.');
          return;
        }
        if (!occupationForm.unite_id) {
          notifyError('Sélectionnez une unité disponible.');
          return;
        }
        const rent = Number(occupationForm.loyer_mensuel);
        if (!Number.isFinite(rent) || rent <= 0) {
          notifyError('Le loyer mensuel doit être un montant positif.');
          return;
        }
        const caution = parsePositiveAmount(occupationForm.caution, 'La caution', false);
        if (caution.error) {
          notifyError(caution.error);
          return;
        }
        const commission = parseCommission(occupationForm.commission, isIndividualOwner);
        if (commission.error) {
          notifyError(commission.error);
          return;
        }
        let createdContratId: string | null = null;
        try {
          const created = await createContratViaEdge({
            locataire_id: locataireId,
            unite_id: occupationForm.unite_id,
            date_debut: occupationForm.date_debut,
            date_fin: occupationForm.date_fin || null,
            loyer_mensuel: rent,
            caution: caution.value,
            commission: commission.value,
            statut: 'actif',
            destination: occupationForm.destination || null,
          });
          createdContratId = created.id;
        } catch (err) {
          if (createdOccupantId) {
            notifyError("Locataire créé, mais la location n'a pas été confirmée. Ouvrez Nouvelle Location et sélectionnez ce locataire pour reprendre.");
            await loadWorkflowOptions();
            return;
          }
          throw err;
        }
        notifySuccess('Nouvelle occupation créée.');
        openContratId = createdContratId;
      }

      setOccupationModalMode(null);
      await refreshOccupantsBaux();
      if (openContratId) {
        const { data: createdRow, error } = await occupantsBauxRepository.getByContractId({
          agencyId: profile.agency_id,
          contratId: openContratId,
        });
        if (!error && createdRow) {
          setSelectedContratId(createdRow.contrat_id);
          setActiveDrawerTab('resume');
        }
      }
    } catch (err) {
      console.error('[OccupantsBaux] save occupation failed', err);
      notifyError(err instanceof Error ? err.message : "Impossible d'enregistrer cette occupation.");
    } finally {
      setWorkflowSubmitting(false);
    }
  }, [isIndividualOwner, loadWorkflowOptions, locationWizardStep, notifyError, notifySuccess, occupationForm, occupationModalMode, profile?.agency_id, profile?.id, refreshOccupantsBaux, selectedRow]);

  const generateContractPdf = useCallback(async (row: OccupantBailRow) => {
    if (!profile?.agency_id) return;
    const agencyId = profile.agency_id;
    setPdfGeneratingId(row.contrat_id);
    try {
      await runDocumentGeneration({
        key: `contrat:${agencyId}:${row.contrat_id}`,
        kind: 'contrat',
        title: 'Préparation du contrat',
        source: 'occupants-baux',
        archiveExpected: true,
        verificationExpected: true,
      }, async (generation) => {
        const { data, error } = await occupantsBauxRepository.contractPdfData({
          agencyId,
          contratId: row.contrat_id,
        });
        if (error) throw error;
        if (!data) throw new Error('Contrat introuvable.');
        await generateContratPDF(data, generation);
      });
      notifySuccess('PDF contrat généré.');
    } catch (err) {
      console.error('[OccupantsBaux] contract PDF failed', err);
      notifyError(err instanceof Error ? err.message : 'Impossible de générer le PDF contrat.');
    } finally {
      setPdfGeneratingId(null);
    }
  }, [notifyError, notifySuccess, profile?.agency_id]);

  const openResiliation = useCallback((row: OccupantBailRow) => {
    setResiliationForm({ date: todayIso(), motif: '', observations: '' });
    setResiliationTarget(row);
  }, []);

  const openRenewal = useCallback((row: OccupantBailRow) => {
    const start = row.date_fin ? addDaysIso(row.date_fin, 1) : todayIso();
    setRenewForm({
      nouvelle_date_fin: addDaysIso(start, 365),
      nouveau_loyer: '',
      remarques: '',
    });
    setRenewTarget(row);
  }, []);

  const submitResiliation = useCallback(async () => {
    if (!resiliationTarget || submittingLifecycle) return;
    if (!resiliationForm.date) {
      notifyError('La date de résiliation est obligatoire.');
      return;
    }
    if (resiliationForm.motif.trim().length < 3) {
      notifyError('Le motif doit contenir au moins 3 caractères.');
      return;
    }

    setSubmittingLifecycle(true);
    try {
      await updateContratViaEdge({
        id: resiliationTarget.contrat_id,
        statut: 'resilie',
        date_fin: resiliationForm.date,
        resiliation_motif: resiliationForm.motif.trim(),
        resiliation_observations: resiliationForm.observations.trim() || null,
      });
      notifySuccess('Bail résilié et unité libérée.');
      setResiliationTarget(null);
      await refreshAfterLifecycle();
    } catch (err) {
      console.error('[OccupantsBaux] resiliation failed', err);
      notifyError(err instanceof Error ? err.message : 'Impossible de résilier ce bail.');
    } finally {
      setSubmittingLifecycle(false);
    }
  }, [notifyError, notifySuccess, refreshAfterLifecycle, resiliationForm, resiliationTarget, submittingLifecycle]);

  const submitArchive = useCallback(async () => {
    if (!archiveTarget || submittingLifecycle) return;
    setSubmittingLifecycle(true);
    try {
      await updateContratViaEdge({
        id: archiveTarget.contrat_id,
        statut: 'archive',
      });
      notifySuccess('Bail archivé.');
      setArchiveTarget(null);
      setSelectedContratId(null);
      await refreshAfterLifecycle();
    } catch (err) {
      console.error('[OccupantsBaux] archive failed', err);
      notifyError(err instanceof Error ? err.message : "Impossible d'archiver ce bail.");
    } finally {
      setSubmittingLifecycle(false);
    }
  }, [archiveTarget, notifyError, notifySuccess, refreshAfterLifecycle, submittingLifecycle]);

  const submitRenewal = useCallback(async () => {
    if (!renewTarget || submittingLifecycle) return;
    if (!renewForm.nouvelle_date_fin) {
      notifyError('La nouvelle date de fin est obligatoire.');
      return;
    }
    const parsedRent = renewForm.nouveau_loyer.trim() ? Number(renewForm.nouveau_loyer) : null;
    if (parsedRent !== null && (!Number.isFinite(parsedRent) || parsedRent <= 0)) {
      notifyError('Le nouveau loyer doit être un montant positif.');
      return;
    }

    setSubmittingLifecycle(true);
    try {
      await renewContratViaEdge({
        id: renewTarget.contrat_id,
        nouvelle_date_fin: renewForm.nouvelle_date_fin,
        nouveau_loyer: parsedRent,
        remarques: renewForm.remarques.trim() || null,
      });
      notifySuccess('Bail renouvelé avec une nouvelle période.');
      setRenewTarget(null);
      setSelectedContratId(null);
      await refreshAfterLifecycle();
    } catch (err) {
      console.error('[OccupantsBaux] renewal failed', err);
      notifyError(err instanceof Error ? err.message : 'Impossible de renouveler ce bail.');
    } finally {
      setSubmittingLifecycle(false);
    }
  }, [notifyError, notifySuccess, refreshAfterLifecycle, renewForm, renewTarget, submittingLifecycle]);

  useEffect(() => {
    if (profile?.agency_id) loadData();
  }, [loadData, profile?.agency_id]);

  const loadDetails = useCallback(
    async (row: OccupantBailRow) => {
      if (!profile?.agency_id) return;
      setDetailsLoading(true);
      setDetailsError(null);
      try {
        const { data, error } = await occupantsBauxRepository.details({
          agencyId: profile.agency_id,
          contratId: row.contrat_id,
          locataireId: row.locataire_id,
          pieceIdentite: row.piece_identite,
        });
        if (error) throw error;
        setDetails(data);
      } catch (err) {
        console.error('[OccupantsBaux] detail load failed', err);
        setDetails(null);
        setDetailsError('Détails indisponibles pour ce bail.');
      } finally {
        setDetailsLoading(false);
      }
    },
    [profile?.agency_id]
  );

  useEffect(() => {
    if (!selectedRow) {
      setDetails(null);
      setDetailsError(null);
      return;
    }
    void loadDetails(selectedRow);
  }, [loadDetails, selectedRow]);

  // ── Filtrage / recherche ──────────────────────────────────────────────────

  const ownerOptions = useMemo(() => {
    const owners = new Map<string, string>();
    rows.forEach((row) => {
      if (row.bailleur_id) owners.set(row.bailleur_id, ownerName(row));
    });
    return Array.from(owners.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const propertyOptions = useMemo(() => {
    const properties = new Map<string, string>();
    rows.forEach((row) => {
      if (row.immeuble_id) properties.set(row.immeuble_id, row.immeuble_nom ?? 'Bien sans nom');
    });
    return Array.from(properties.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const ownerSelectOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous Bailleurs', subtitle: 'Toutes les locations' },
      ...ownerOptions.map(([id, label]) => ({ value: id, label, subtitle: 'Portefeuille propriétaire' })),
    ],
    [ownerOptions],
  );

  const propertySelectOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous Biens', subtitle: 'Toutes les locations' },
      ...propertyOptions.map(([id, label]) => ({ value: id, label, subtitle: 'Bien locatif' })),
    ],
    [propertyOptions],
  );

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const currentMonth = todayIso().slice(0, 7);
    return rows.filter((r) => {
      const matchTab = activeTab === 'tous' || r.statut === activeTab;
      if (!matchTab) return false;
      if (ownerFilter !== 'all' && r.bailleur_id !== ownerFilter) return false;
      if (propertyFilter !== 'all' && r.immeuble_id !== propertyFilter) return false;
      if (periodFilter === 'starts_this_month' && !String(r.date_debut ?? '').startsWith(currentMonth)) return false;
      if (periodFilter === 'ending_soon') {
        const remaining = daysUntil(r.date_fin);
        if (remaining === null || remaining < 0 || remaining > 45) return false;
      }
      if (periodFilter === 'open_ended' && r.date_fin) return false;
      if (!term) return true;
      const haystack = [
        fullName(r),
        r.telephone ?? '',
        r.email ?? '',
        r.piece_identite ?? '',
        r.unite_nom,
        r.immeuble_nom ?? '',
        ownerName(r),
        r.contrat_ref,
        r.destination,
        r.date_debut,
        r.date_fin ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, activeTab, ownerFilter, propertyFilter, periodFilter, searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, activeTab, ownerFilter, propertyFilter, periodFilter]);


  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // ── Compteurs par statut et période ───────────────────────────────────────

  const counts = useMemo(() => {
    const map: Record<string, number> = { tous: rows.length };
    for (const r of rows) {
      map[r.statut] = (map[r.statut] ?? 0) + 1;
    }
    return map;
  }, [rows]);

  const periodCounts = useMemo(() => {
    const currentMonth = todayIso().slice(0, 7);
    let startsThisMonth = 0;
    let endingSoon = 0;
    let openEnded = 0;
    for (const r of rows) {
      if (String(r.date_debut ?? '').startsWith(currentMonth)) startsThisMonth++;
      const remaining = daysUntil(r.date_fin);
      if (remaining !== null && remaining >= 0 && remaining <= 45) endingSoon++;
      if (!r.date_fin) openEnded++;
    }
    return { starts_this_month: startsThisMonth, ending_soon: endingSoon, open_ended: openEnded };
  }, [rows]);

  const activeFilterCount = (ownerFilter !== 'all' ? 1 : 0)
    + (propertyFilter !== 'all' ? 1 : 0)
    + (periodFilter !== 'all' ? 1 : 0)
    + (activeTab !== 'tous' ? 1 : 0);

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setActiveTab('tous');
    setOwnerFilter('all');
    setPropertyFilter('all');
    setPeriodFilter('all');
  }, []);

  const quickChips = useMemo(() => [
    { id: 'all', label: 'Tous', count: counts.tous, isActive: periodFilter === 'all', onClick: () => setPeriodFilter('all') },
    { id: 'starts_this_month', label: 'Débute ce mois', count: periodCounts.starts_this_month, isActive: periodFilter === 'starts_this_month', onClick: () => setPeriodFilter(periodFilter === 'starts_this_month' ? 'all' : 'starts_this_month') },
    { id: 'ending_soon', label: 'Fin proche', count: periodCounts.ending_soon, isActive: periodFilter === 'ending_soon', onClick: () => setPeriodFilter(periodFilter === 'ending_soon' ? 'all' : 'ending_soon') },
    { id: 'open_ended', label: 'Sans date fin', count: periodCounts.open_ended, isActive: periodFilter === 'open_ended', onClick: () => setPeriodFilter(periodFilter === 'open_ended' ? 'all' : 'open_ended') },
  ], [counts.tous, periodFilter, periodCounts]);

  // ─── Skeleton ─────────────────────────────────────────────────────────────

  if (loading) return <PageSkeleton title="Locations" variant="table" />;

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <PageShell spacing="standard" variant="dataDense" tone="paper" verticalInset="compact">
      {/* Notice hors-ligne */}
      <OfflineDataNotice
        cachedAt={cacheTimestamp}
        onRetry={() => void loadData()}
        message="Les données affichées viennent du dernier chargement réussi."
      />

      <div className="mt-2">
        <SplitViewShell
          isDetailOpen={Boolean(selectedRow)}
          size="compact"
          desktopAt="lg"
          detailClassName="lg:sticky lg:top-2 lg:h-[calc(100dvh-1rem)]"
          mainClassName={selectedRow ? 'hidden lg:block' : ''}
          main={
            <div className="flex flex-col gap-4">
              <section className="min-w-0 space-y-3">
          {/* En-tête */}
          <PremiumPageHeader
            density="compact"
            isSplitOpen={Boolean(selectedRow)}
            eyebrow="DOMAINE LOCATIF"
            title="Locations"
            description="Suivez les occupants, baux actifs et unités louées."
            mobileDescription="Occupants, baux et unités."
            primaryAction={
              <PremiumButton
                variant="create"
                type="button"
                onClick={openCreateOccupation}
                icon={<Plus className="h-3.5 w-3.5" />}
                className="w-full sm:w-auto !h-7 !min-h-7 !px-2.5 !py-1 !text-[0.7rem]"
              >
                Nouvelle location
              </PremiumButton>
            }
          />

          {/* KPI cards / filtres */}
          <PremiumKpiGrid density="compact">
            {TABS.map((tab) => (
              <MetricCard
                key={tab.id}
                density="compact"
                title={tab.title}
                value={counts[tab.id] ?? 0}
                helper={tab.helper}
                icon={tab.icon}
                tone={tab.tone}
                onClick={() => setActiveTab(tab.id)}
                isActive={activeTab === tab.id}
                ariaLabel={`${tab.title} : ${counts[tab.id] ?? 0} (${tab.helper})`}
              />
            ))}
          </PremiumKpiGrid>

          {/* Toolbar */}
          <PremiumToolbar
            density="compact"
            search={
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-800" />
                <input
                  type="text"
                  placeholder="Rechercher locataire, bien, référence..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="!min-h-8 !h-8 w-full rounded-[0.6rem] border border-emerald-950/10 bg-white/95 pl-8 pr-3 py-0 text-xs font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
            }
            secondaryActions={
              <>
                <SmartCombobox
                  value={ownerFilter}
                  options={ownerSelectOptions}
                  onChange={setOwnerFilter}
                  placeholder="Tous Bailleurs"
                  searchPlaceholder="Rechercher un bailleur..."
                  className="hidden lg:block lg:w-40 !h-8 !min-h-8"
                  density="compact"
                />
                <SmartCombobox
                  value={propertyFilter}
                  options={propertySelectOptions}
                  onChange={setPropertyFilter}
                  placeholder="Tous Biens"
                  searchPlaceholder="Rechercher un bien..."
                  className="hidden lg:block lg:w-32 !h-8 !min-h-8"
                  density="compact"
                />
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(true)}
                  className={`inline-flex !h-8 !min-h-8 !py-0 flex-shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-[0.6rem] border px-3 text-xs font-bold shadow-sm transition lg:hidden ${activeFilterCount > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-[#fffdf8] text-slate-700 hover:border-emerald-100 hover:bg-emerald-50/60'}`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtres
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-emerald-800 px-1.5 py-0.5 text-[10px] text-white">{activeFilterCount}</span>
                  )}
                </button>
                <ColumnPicker
                  columns={OCCUPANTS_BAUX_COLUMN_KEYS.map((key) => ({
                    key,
                    label: getOccupantsBauxColumnLabel(key),
                  }))}
                  visibility={occupantColumns.visibility}
                  onToggle={(key) => occupantColumns.toggle(key as OccupantsBauxColumnKey)}
                  onSetAll={occupantColumns.setAll}
                  className="!py-1.5 !px-3 !text-xs !rounded-[0.6rem] !h-8 hidden lg:inline-flex"
                />
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex !h-8 !min-h-8 !py-0 items-center gap-1.5 rounded-[0.6rem] border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-600 transition hover:bg-white"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Réinitialiser
                  </button>
                )}
              </>
            }
            quickChips={quickChips}
            meta={(searchTerm || activeFilterCount > 0) ? `${filtered.length} résultat${filtered.length !== 1 ? 's' : ''} affiché${filtered.length !== 1 ? 's' : ''}` : undefined}
          />

          {/* Filtres mobiles */}
          <MobileFilterSheet
            isOpen={mobileFiltersOpen}
            title="Filtres locations"
            onClose={() => setMobileFiltersOpen(false)}
            onReset={resetFilters}
          >
            <div className="grid gap-3">
              <SmartCombobox
                value={ownerFilter}
                options={ownerSelectOptions}
                onChange={setOwnerFilter}
                placeholder="Tous Bailleurs"
                searchPlaceholder="Rechercher un bailleur..."
              />
              <SmartCombobox
                value={propertyFilter}
                options={propertySelectOptions}
                onChange={setPropertyFilter}
                placeholder="Tous Biens"
                searchPlaceholder="Rechercher un bien..."
              />
            </div>
          </MobileFilterSheet>

          {/* Tableau principal */}
          <PremiumTableSurface density="dense" className="bg-white">
            {/* Table desktop / Cards mobile */}
            {paginated.length === 0 ? (
              <EmptyState
                hasSearch={!!searchTerm || activeFilterCount > 0}
                onReset={resetFilters}
              />
            ) : (
              <>
                <div className={`hidden md:block ${selectedRow ? 'overflow-hidden' : 'overflow-x-auto'}`}>
                  <table className={`w-full border-collapse table-fixed ${selectedRow ? 'min-w-[440px]' : 'min-w-[660px]'}`}>
                    <thead className="bg-[#f8f3e8]/70 text-left border-b border-slate-100">
                      <tr>
                        {occupantColumns.isVisible('occupant') && (
                          <th className={`${selectedRow ? 'w-[44%]' : 'w-[20%]'} py-2.5 px-3 text-left text-[0.62rem] font-bold uppercase tracking-wider text-slate-500`}>
                            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-slate-400" /> Locataire</span>
                          </th>
                        )}
                        {occupantColumns.isVisible('telephone') && (
                          <th className={`w-[11%] py-2.5 px-3 text-left text-[0.62rem] font-bold uppercase tracking-wider text-slate-500 ${selectedRow ? 'hidden' : 'hidden lg:table-cell'}`}>
                            <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" /> Téléphone</span>
                          </th>
                        )}
                        {occupantColumns.isVisible('bien') && (
                          <th className={`w-[15%] py-2.5 px-3 text-left text-[0.62rem] font-bold uppercase tracking-wider text-slate-500 ${selectedRow ? 'hidden' : ''}`}>
                            <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-slate-400" /> Bien / Unité</span>
                          </th>
                        )}
                        {occupantColumns.isVisible('proprietaire') && (
                          <th className={`w-[12%] py-2.5 px-3 text-left text-[0.62rem] font-bold uppercase tracking-wider text-slate-500 ${selectedRow ? 'hidden' : 'hidden lg:table-cell'}`}>
                            <span className="flex items-center gap-1.5"><Home className="h-3.5 w-3.5 text-slate-400" /> Propriétaire</span>
                          </th>
                        )}
                        {occupantColumns.isVisible('reference') && (
                          <th className={`w-[9%] py-2.5 px-3 text-left text-[0.62rem] font-bold uppercase tracking-wider text-slate-500 ${selectedRow ? 'hidden' : 'hidden lg:table-cell'}`}>
                            <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-slate-400" /> Référence</span>
                          </th>
                        )}
                        {occupantColumns.isVisible('loyer') && (
                          <th className={`${selectedRow ? 'w-[36%]' : 'w-[14%]'} py-2.5 px-3 text-right text-[0.62rem] font-bold uppercase tracking-wider text-slate-500`}>
                            <span className="flex items-center justify-end gap-1.5"><Wallet className="h-3.5 w-3.5 text-slate-400" /> Loyer</span>
                          </th>
                        )}
                        {occupantColumns.isVisible('periode') && (
                          <th className={`w-[9%] py-2.5 px-3 text-left text-[0.62rem] font-bold uppercase tracking-wider text-slate-500 ${selectedRow ? 'hidden' : 'hidden lg:table-cell'}`}>
                            <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-slate-400" /> Période</span>
                          </th>
                        )}
                        {occupantColumns.isVisible('statut') && (
                          <th className={`${selectedRow ? 'w-[18%]' : 'w-[6%]'} py-2.5 px-3 text-center text-[0.62rem] font-bold uppercase tracking-wider text-slate-500`}>
                            <span className="flex items-center justify-center gap-1.5"><Activity className="h-3.5 w-3.5 text-slate-400" /> Statut</span>
                          </th>
                        )}
                        <th className="w-[4%] px-2 py-2.5"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                      {paginated.map((row) => (
                        <DesktopRow
                          key={row.contrat_id}
                          row={row}
                          selected={selectedRow?.contrat_id === row.contrat_id}
                          compact={Boolean(selectedRow)}
                          isVisible={occupantColumns.isVisible}
                          onSelect={() => {
                        setSelectedContratId(row.contrat_id);
                            setActiveDrawerTab('resume');
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-slate-100 md:hidden">
                  {paginated.map((row) => (
                    <LocationMobileCard
                      key={row.contrat_id}
                      row={row}
                      onSelect={() => {
                        setSelectedContratId(row.contrat_id);
                        setActiveDrawerTab('resume');
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row">
                <p className="text-xs text-slate-500">
                  Page {page} / {totalPages} · {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-1">
                  <PaginationButton onClick={() => setPage(1)} disabled={page === 1} label="«" />
                  <PaginationButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} label="‹" />
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const p = start + i;
                    if (p > totalPages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`h-8 w-8 rounded-lg border text-xs font-semibold transition ${
                          p === page
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <PaginationButton onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} label="›" />
                  <PaginationButton onClick={() => setPage(totalPages)} disabled={page === totalPages} label="»" />
                </div>
              </div>
            )}
          </PremiumTableSurface>
              </section>
            </div>
          }
          detail={
            selectedRow ? (
              <OccupantBailDrawer
                row={selectedRow}
                details={details}
                detailsLoading={detailsLoading}
                detailsError={detailsError}
                isIndividualOwner={isIndividualOwner}
                activeTab={activeDrawerTab}
                onTabChange={setActiveDrawerTab}
                onClose={() => {
                  setSelectedContratId(null);
                  clearDirectRouteParams();
                }}
                onEditOccupant={openEditOccupant}
                onEditBail={openEditBail}
                onGeneratePdf={(row) => void generateContractPdf(row)}
                pdfGenerating={pdfGeneratingId === selectedRow?.contrat_id}
                onResiliate={openResiliation}
                onArchive={setArchiveTarget}
                onRenew={openRenewal}
              />
            ) : undefined
          }
        />
      </div>

      <LifecycleModals
        resiliationTarget={resiliationTarget}
        archiveTarget={archiveTarget}
        renewTarget={renewTarget}
        resiliationForm={resiliationForm}
        renewForm={renewForm}
        submitting={submittingLifecycle}
        onCloseResiliation={() => setResiliationTarget(null)}
        onCloseArchive={() => setArchiveTarget(null)}
        onCloseRenew={() => setRenewTarget(null)}
        onResiliationChange={setResiliationForm}
        onRenewChange={setRenewForm}
        onSubmitResiliation={submitResiliation}
        onSubmitArchive={submitArchive}
        onSubmitRenewal={submitRenewal}
      />

      <OccupantFormModal
        mode={occupantModalMode}
        form={occupantForm}
        submitting={workflowSubmitting}
        onChange={setOccupantForm}
        onClose={closeOccupantModal}
        onSubmit={submitOccupant}
      />

      <OccupationFormModal
        mode={occupationModalMode}
        form={occupationForm}
        wizardStep={locationWizardStep}
        occupantOptions={occupantOptions}
        availableUnits={availableUnits}
        workflowLoading={workflowLoading}
        submitting={workflowSubmitting}
        isIndividualOwner={isIndividualOwner}
        onStepChange={setLocationWizardStep}
        onChange={setOccupationForm}
        onClose={closeOccupationModal}
        onSubmit={submitOccupation}
        onValidationError={notifyError}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </PageShell>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function StatutBadge({ statut }: { statut: ContratStatut }) {
  const { label, cls } = STATUT_BADGE[statut] ?? STATUT_BADGE.en_attente;
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-1.5 py-[2px] text-[0.6rem] font-semibold leading-none ${cls}`}>
      {label}
    </span>
  );
}

function DesktopRow({
  row,
  selected,
  compact,
  isVisible,
  onSelect,
}: {
  row: OccupantBailRow;
  selected: boolean;
  compact: boolean;
  isVisible: (key: OccupantsBauxColumnKey) => boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-slate-100 transition-colors duration-150 outline-none hover:bg-[#f8fbf9] ${selected ? 'bg-emerald-50/50 relative z-0 after:absolute after:inset-y-0 after:left-0 after:w-[3px] after:bg-brand-500' : ''}`}
    >
      {/* Occupant */}
      {isVisible('occupant') && (
        <td className="py-2.5 px-3">
          <div className="min-w-0">
            <p className="truncate text-[0.78rem] leading-tight font-semibold text-slate-950">{fullName(row)}</p>
            {compact ? (
              <p className="truncate text-[0.64rem] leading-snug font-medium text-slate-500 mt-[1px]">
                {row.immeuble_nom ?? '—'} · {row.unite_nom} · {ownerName(row)}
              </p>
            ) : (
              row.email && <a href={`mailto:${row.email}`} onClick={(e) => e.stopPropagation()} className="truncate text-[0.64rem] leading-snug font-medium text-slate-500 mt-[1px] block hover:text-brand-700 hover:underline">{row.email}</a>
            )}
          </div>
        </td>
      )}
      {/* Téléphone */}
      {isVisible('telephone') && (
        <td className={`py-2.5 px-3 whitespace-nowrap text-[0.75rem] text-slate-700 font-medium ${compact ? 'hidden' : 'hidden lg:table-cell'}`}>
          {row.telephone ? (
            <a
              href={`tel:${row.telephone}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-brand-700 hover:underline"
            >
              {formatSenegalPhone(row.telephone)}
            </a>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
      )}
      {/* Bien / Unité */}
      {isVisible('bien') && (
        <td className={`py-2.5 px-3 ${compact ? 'hidden' : ''}`}>
          <div className="min-w-0">
            <p className="truncate text-[0.78rem] leading-tight font-semibold text-slate-950">{row.immeuble_nom ?? '—'}</p>
            <p className="truncate text-[0.64rem] leading-snug font-medium text-slate-500 mt-[1px] flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-slate-300 inline shrink-0" />
              <span className="truncate">{row.unite_nom}</span>
            </p>
          </div>
        </td>
      )}
      {/* Propriétaire */}
      {isVisible('proprietaire') && (
        <td className={`py-2.5 px-3 text-[0.75rem] text-slate-700 font-medium ${compact ? 'hidden' : 'hidden lg:table-cell'}`}>
          <p className="truncate">{ownerName(row)}</p>
        </td>
      )}
      {/* Référence */}
      {isVisible('reference') && (
        <td className={`py-2.5 px-3 ${compact ? 'hidden' : 'hidden lg:table-cell'}`}>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.7rem] font-medium text-slate-700">
            {row.contrat_ref}
          </span>
        </td>
      )}
      {/* Loyer */}
      {isVisible('loyer') && (
        <td className="py-2.5 px-3 text-right text-[0.75rem] font-semibold text-slate-700 whitespace-nowrap">
          <MoneyText value={row.loyer_mensuel} compact={false} />
          <span className="ml-1 text-[0.65rem] font-normal text-slate-400">/ mois</span>
        </td>
      )}
      {/* Période */}
      {isVisible('periode') && (
        <td className={`py-2.5 px-3 text-[0.75rem] text-slate-700 font-medium ${compact ? 'hidden' : 'hidden lg:table-cell'}`}>
          <p className="truncate">
            {formatDate(row.date_debut)}
            {row.date_fin ? ` → ${formatDate(row.date_fin)}` : <span className="text-slate-400"> → ouvert</span>}
          </p>
        </td>
      )}
      {/* Statut */}
      {isVisible('statut') && (
        <td className="py-2.5 px-3 text-center">
          <div className="flex flex-col items-center justify-center gap-1">
            <StatutBadge statut={row.statut} />
            {row.statut === 'actif' && canRenew(row) && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.2 text-[0.6rem] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-200">
                Fin proche
              </span>
            )}
          </div>
        </td>
      )}
      <td className="py-2.5 px-3 text-right">
        <ChevronRight className="h-[10px] w-[10px] text-slate-300 inline-block" />
      </td>
    </tr>
  );
}

function LocationMobileCard({ row, onSelect }: { row: OccupantBailRow; onSelect: () => void }) {
  return (
    <div className="px-2.5 py-1">
      <PremiumMobileCard
        density="compact"
        title={fullName(row)}
        subtitle={<>{row.immeuble_nom ?? 'Bien non renseigné'} · {row.unite_nom} · {ownerName(row)}</>}
        initials={`${row.prenom?.[0] ?? ''}${row.nom?.[0] ?? ''}`.toUpperCase() || 'OB'}
        status={STATUT_BADGE[row.statut]?.label ?? row.statut}
        statusTone={row.statut === 'actif' ? 'emerald' : row.statut === 'expire' ? 'amber' : row.statut === 'resilie' ? 'red' : 'slate'}
        amount={row.loyer_mensuel}
        amountLabel="Loyer"
        amountSuffix="/ mois"
        amountCompact={Number(row.loyer_mensuel ?? 0) >= 1_000_000}
        onClick={onSelect}
      />
    </div>
  );
}

function OccupantBailDrawer({
  row,
  details,
  detailsLoading,
  detailsError,
  isIndividualOwner,
  activeTab,
  onTabChange,
  onClose,
  onEditOccupant,
  onEditBail,
  onGeneratePdf,
  pdfGenerating,
  onResiliate,
  onArchive,
  onRenew,
}: {
  row: OccupantBailRow | null;
  details: OccupantBailDetails | null;
  detailsLoading: boolean;
  detailsError: string | null;
  isIndividualOwner: boolean;
  activeTab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
  onEditOccupant: (row: OccupantBailRow) => void;
  onEditBail: (row: OccupantBailRow) => void;
  onGeneratePdf: (row: OccupantBailRow) => void;
  pdfGenerating: boolean;
  onResiliate: (row: OccupantBailRow) => void;
  onArchive: (row: OccupantBailRow) => void;
  onRenew: (row: OccupantBailRow) => void;
}) {
  if (!row) return null;

  const activeStatus = row.statut === 'actif';
  const canArchive = row.statut === 'resilie' || row.statut === 'expire';
  const reliquatContrat = details?.payments.reduce((sum, payment) => sum + Math.max(0, Number(payment.reliquat ?? 0)), 0) ?? 0;

  return (
    <PremiumDrawerShell
      open={Boolean(row)}
      onClose={onClose}
      size="compact"
      desktopMode="floating"
      desktopAt="lg"
      density="compact"
      eyebrow="FICHE LOCATION"
      avatar={
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-[0.8rem] font-bold text-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-emerald-950/10">
          {initialsFromName(row.prenom, row.nom)}
        </div>
      }
      title={fullName(row)}
      description={
        <div className="mt-1 flex flex-col gap-1.5 text-[0.72rem]">
          <div className="flex flex-wrap items-center gap-2">
            <StatutBadge statut={row.statut} />
            {row.telephone && (
              <span className="flex items-center gap-1 text-slate-500 font-medium">
                <Phone className="h-3 w-3 text-slate-400" />
                <a href={`tel:${row.telephone}`} className="hover:text-brand-700 hover:underline">{formatSenegalPhone(row.telephone)}</a>
              </span>
            )}
            {row.email && (
              <span className="flex min-w-0 items-center gap-1 text-slate-500 font-medium">
                <Mail className="shrink-0 h-3 w-3 text-slate-400" />
                <a href={`mailto:${row.email}`} className="truncate hover:text-brand-700 hover:underline">{row.email}</a>
              </span>
            )}
          </div>
          <div className="pt-1 text-[0.68rem] text-slate-500 font-medium">
            {row.immeuble_nom ?? 'Bien non renseigné'} · {row.unite_nom}
            {row.bailleur_prenom || row.bailleur_nom ? ` · ${ownerName(row)}` : ''}
            {row.contrat_ref ? ` · Réf. ${row.contrat_ref}` : ''}
          </div>
        </div>
      }
      bodyClassName="space-y-2.5 pb-20"
    >
      {/* 1. Action principale */}
      <div className="flex items-center justify-start">
        <button
          type="button"
          onClick={() => onGeneratePdf(row)}
          disabled={pdfGenerating}
          className="inline-flex !h-7 !min-h-7 px-3 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-emerald-700/90 text-[0.7rem] font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {pdfGenerating ? 'Génération...' : 'Contrat PDF'}
        </button>
      </div>

      {/* 2. KPI essentiels au niveau supérieur (Règle des 4 KPI) */}
      <div className="grid grid-cols-2 gap-1.5">
        <CompactMetric label="Loyer" value={<MoneyText value={row.loyer_mensuel} compact />} tone="slate" />
        <CompactMetric label="Reliquats" value={<MoneyText value={reliquatContrat} compact />} tone={reliquatContrat > 0 ? 'red' : 'emerald'} />
        <CompactMetric label="Statut" value={STATUT_BADGE[row.statut]?.label ?? row.statut} tone={row.statut === 'actif' ? 'emerald' : 'slate'} />
        <CompactMetric label="Fin de bail" value={row.date_fin ? formatDate(row.date_fin) : 'Ouvert'} tone="slate" />
      </div>

      {/* 3. Onglets de navigation */}
      <div className="pt-1">
        <div className="flex gap-1 overflow-x-auto scroll-smooth scrollbar-hide no-scrollbar rounded-xl bg-slate-50/80 border border-emerald-950/5 p-1">
          {DRAWER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={(e) => {
                onTabChange(tab.id);
                e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              }}
              className={`whitespace-nowrap rounded-lg px-2 py-1 text-[0.68rem] font-bold transition ${activeTab === tab.id ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-950/5' : 'text-slate-500 hover:text-emerald-900 hover:bg-slate-100'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mt-2.5">
          {activeTab === 'resume' && (
            <DrawerResume
              row={row}
              details={details}
              isIndividualOwner={isIndividualOwner}
              onEditOccupant={() => onEditOccupant(row)}
              onEditBail={() => onEditBail(row)}
              onRenew={() => onRenew(row)}
            />
          )}
          {activeTab === 'paiements' && <DrawerPayments contractId={row.contrat_id} details={details} loading={detailsLoading} error={detailsError} />}
          {activeTab === 'documents' && (
            <DrawerDocuments
              row={row}
              details={details}
              loading={detailsLoading}
              error={detailsError}
              onGeneratePdf={onGeneratePdf}
              pdfGenerating={pdfGenerating}
            />
          )}
          {activeTab === 'historique' && <DrawerHistory details={details} loading={detailsLoading} error={detailsError} />}
        </div>
      </div>

      {/* 4. Danger (tout en bas) */}
      <div className="pt-4 pb-2">
        <p className="mb-1.5 text-[0.6rem] font-black uppercase tracking-wider text-red-800 opacity-60">Résiliation & Archivage</p>
        <div className="flex flex-col gap-1.5">
          {activeStatus && (
            <button
              type="button"
              onClick={() => onResiliate(row)}
              className="inline-flex w-full !h-7 !min-h-7 items-center justify-center gap-1.5 rounded-lg border border-red-100 bg-red-50/50 px-3 text-[0.65rem] font-bold text-red-700 transition hover:bg-red-50 hover:border-red-300"
            >
              <Ban className="h-3.5 w-3.5" />
              Résilier la location
            </button>
          )}
          {canArchive && (
            <button
              type="button"
              onClick={() => onArchive(row)}
              className="inline-flex w-full !h-7 !min-h-7 items-center justify-center gap-1.5 rounded-lg border border-red-100 bg-red-50/50 px-3 text-[0.65rem] font-bold text-red-700 transition hover:bg-red-50 hover:border-red-300"
            >
              <Archive className="h-3.5 w-3.5" />
              Archiver
            </button>
          )}
        </div>
      </div>
    </PremiumDrawerShell>
  );
}

function DrawerResume({
  row,
  details,
  isIndividualOwner,
  onEditOccupant,
  onEditBail,
  onRenew,
}: {
  row: OccupantBailRow;
  details: OccupantBailDetails | null;
  isIndividualOwner: boolean;
  onEditOccupant: () => void;
  onEditBail: () => void;
  onRenew: () => void;
}) {
  const latestPayment = details?.payments[0] ?? null;
  const nextExpectedLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div className="space-y-2">
      {/* Barre d'actions compacte */}
      <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
        <button
          type="button"
          onClick={onEditBail}
          className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[0.68rem] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Pencil className="h-3 w-3 text-slate-400" />
          Modifier bail
        </button>
        <button
          type="button"
          onClick={onEditOccupant}
          className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[0.68rem] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <UserPlus className="h-3 w-3 text-slate-400" />
          Fiche locataire
        </button>
        {canRenew(row) && (
          <button
            type="button"
            onClick={onRenew}
            className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[0.68rem] font-bold text-amber-800 shadow-sm transition hover:bg-amber-100"
          >
            <RefreshCw className="h-3 w-3 text-amber-600" />
            Renouveler le bail
          </button>
        )}
      </div>

      <CompactSection title="Objet de la location" icon={Building2}>
        <div className="flex flex-col divide-y divide-slate-100">
          <div className="flex items-center justify-between py-1">
            <span className="text-[0.68rem] font-semibold text-slate-500">Bien immobilier</span>
            <button
              type="button"
              onClick={() => { window.location.hash = row.immeuble_id ? `#/patrimoine?id=${row.immeuble_id}` : '#/patrimoine'; }}
              className="flex items-center gap-1 text-[0.7rem] font-bold text-brand-700 hover:text-brand-900 transition"
            >
              <span>{row.immeuble_nom || 'Bien non renseigné'}</span>
              <span className="text-[0.65rem]">&rarr;</span>
            </button>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[0.68rem] font-semibold text-slate-500">Unité / Lot</span>
            <button
              type="button"
              onClick={() => { window.location.hash = row.unite_id ? `#/patrimoine?uniteId=${row.unite_id}` : '#/patrimoine'; }}
              className="flex items-center gap-1 text-[0.7rem] font-bold text-brand-700 hover:text-brand-900 transition"
            >
              <span>{row.unite_nom || 'Unité non renseignée'}</span>
              <span className="text-[0.65rem]">&rarr;</span>
            </button>
          </div>
          <CompactLabelValue label="Adresse" value={row.immeuble_adresse || 'Non renseignée'} />
          {!isIndividualOwner && (
            <div className="flex items-center justify-between py-1">
              <span className="text-[0.68rem] font-semibold text-slate-500">Propriétaire</span>
              <button
                type="button"
                onClick={() => { window.location.hash = row.bailleur_id ? `#/bailleurs?id=${row.bailleur_id}` : '#/bailleurs'; }}
                className="flex items-center gap-1 text-[0.7rem] font-bold text-brand-700 hover:text-brand-900 transition"
              >
                <span>{ownerName(row)}</span>
                <span className="text-[0.65rem]">&rarr;</span>
              </button>
            </div>
          )}
        </div>
      </CompactSection>

      <CompactSection title="Locataire" icon={Users}>
        <div className="flex flex-col divide-y divide-slate-100">
          <CompactLabelValue label="Nom" value={fullName(row)} />
          <CompactLabelValue
            label="Téléphone"
            value={
              row.telephone ? (
                <a href={`tel:${row.telephone}`} className="hover:text-brand-700 hover:underline">
                  {formatSenegalPhone(row.telephone)}
                </a>
              ) : (
                'Non renseigné'
              )
            }
          />
          <CompactLabelValue
            label="Email"
            value={
              row.email ? (
                <a href={`mailto:${row.email}`} className="hover:text-brand-700 hover:underline">
                  {row.email}
                </a>
              ) : (
                'Non renseigné'
              )
            }
          />
          <CompactLabelValue label="Adresse" value={row.adresse_personnelle || 'Non renseignée'} />
        </div>
      </CompactSection>

      <CompactSection title="Conditions du bail" icon={FileText}>
        <div className="flex flex-col divide-y divide-slate-100">
          <CompactLabelValue label="Référence" value={row.contrat_ref} />
          <CompactLabelValue label="Destination" value={row.destination || 'Non renseignée'} />
          <CompactLabelValue label="Période" value={`${formatDate(row.date_debut)} → ${row.date_fin ? formatDate(row.date_fin) : 'ouvert'}`} />
          {row.caution !== null && <CompactLabelValue label="Caution" value={<MoneyText value={row.caution} />} />}
          <CompactLabelValue label="Prochain terme" value={nextExpectedLabel} />
          {!isIndividualOwner && row.commission !== null && <CompactLabelValue label="Commission" value={`${row.commission}%`} />}
          <CompactLabelValue label="Dernier paiement" value={latestPayment ? <>{formatDate(latestPayment.date_paiement)} · <MoneyText value={latestPayment.montant_total} /></> : 'Aucun'} />
        </div>
      </CompactSection>
    </div>
  );
}

function DrawerPayments({
  contractId,
  details,
  loading,
  error,
}: {
  contractId?: string;
  details: OccupantBailDetails | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return <DrawerEmpty icon={Wallet} title="Paiements" description="Chargement des paiements liés à ce bail..." />;
  }
  if (error) {
    return <DrawerEmpty icon={Wallet} title="Paiements indisponibles" description={error} />;
  }

  const payments = details?.payments ?? [];
  if (payments.length === 0) {
    return (
      <div className="space-y-3">
        <DrawerEmpty
          icon={Wallet}
          title="Aucun paiement rattaché"
          description="Les paiements liés à ce bail seront affichés ici dès qu'ils existent dans le module Encaissements."
        />
        {contractId && (
          <button
            type="button"
            onClick={() => { window.location.hash = `#/paiements?action=new&contratId=${contractId}`; }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-800"
          >
            <Wallet className="h-3.5 w-3.5" />
            Enregistrer un encaissement
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contractId && (
        <button
          type="button"
          onClick={() => { window.location.hash = `#/paiements?action=new&contratId=${contractId}`; }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-700/20 bg-emerald-50/80 px-3 py-1.5 text-[0.7rem] font-bold text-emerald-900 transition hover:bg-emerald-100"
        >
          <Plus className="h-3.5 w-3.5 text-emerald-700" />
          Nouveau paiement pour ce bail
        </button>
      )}
      <div className="space-y-1">
        {payments.map((payment) => (
          <button
            key={payment.id}
            type="button"
            onClick={() => { window.location.hash = `#/paiements?id=${payment.id}`; }}
          className="group flex w-full items-center justify-between gap-2 rounded-lg border border-emerald-950/10 bg-white px-2 py-1.5 text-left shadow-sm transition hover:bg-slate-50 hover:border-emerald-200"
          aria-label={`Ouvrir le paiement de ${payment.mois_concerne}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 font-bold text-[0.68rem] ring-1 ring-emerald-100">
              <Wallet className="h-3 w-3" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-[0.72rem] text-slate-900"><MoneyText value={payment.montant_total} /></span>
                <span className="rounded px-1 py-0.5 text-[0.56rem] font-bold uppercase bg-emerald-50 text-emerald-700">{payment.statut}</span>
              </div>
              <p className="truncate text-[0.62rem] font-medium text-slate-500">
                {payment.mois_concerne} · {formatDate(payment.date_paiement)}
                {payment.reference ? ` · ${payment.reference}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0 text-right">
            {payment.reliquat !== null && payment.reliquat > 0 && (
              <span className="text-[0.6rem] font-bold text-red-600">Reliquat: <MoneyText value={payment.reliquat} compact /></span>
            )}
            <ChevronRight className="h-3 w-3 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
          </div>
        </button>
      ))}
      </div>
    </div>
  );
}

function DrawerDocuments({
  row,
  details,
  loading,
  error,
  onGeneratePdf,
  pdfGenerating,
}: {
  row: OccupantBailRow;
  details: OccupantBailDetails | null;
  loading: boolean;
  error: string | null;
  onGeneratePdf: (row: OccupantBailRow) => void;
  pdfGenerating: boolean;
}) {
  const documents = details?.documents ?? [];

  return (
    <div className="space-y-1.5">
      <div className="rounded-lg border border-emerald-950/10 bg-white px-2 py-1.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100">
              <FileCheck2 className="h-3 w-3" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[0.72rem] text-slate-900">Contrat de location</p>
              <p className="text-[0.62rem] font-medium text-slate-500 truncate">{row.contrat_ref} · Génération directe</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onGeneratePdf(row)}
            disabled={pdfGenerating}
            className="inline-flex h-6 px-2 items-center justify-center gap-1 rounded-md border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] via-[#06281F] to-[#041812] text-[0.64rem] font-bold text-white shadow transition hover:from-[#0A3F30] hover:to-[#06281F] disabled:opacity-60"
          >
            <Download className="h-3 w-3" />
            {pdfGenerating ? 'Génération...' : 'PDF'}
          </button>
        </div>
      </div>

      {loading && <DrawerEmpty icon={FileText} title="Documents liés" description="Chargement des documents rattachés à ce bail..." />}
      {error && <DrawerEmpty icon={FileText} title="Documents indisponibles" description={error} />}
      {!loading && !error && documents.length === 0 && (
        <DrawerEmpty
          icon={FileText}
          title="Aucun document rattaché"
          description="Le contrat PDF et les documents GED disponibles apparaîtront ici."
        />
      )}
      {!loading && !error && documents.map((document) => (
        <button
          key={`${document.source}-${document.id}`}
          type="button"
          onClick={() => { window.location.hash = document.id ? `#/documents?id=${document.source}-${document.id}` : '#/documents'; }}
          className="group flex w-full items-center justify-between gap-2 rounded-lg border border-emerald-950/10 bg-white px-2 py-1.5 text-left shadow-sm transition hover:bg-slate-50 hover:border-emerald-200"
          aria-label={`Ouvrir le document ${document.title}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-700 ring-1 ring-slate-100 transition group-hover:bg-white group-hover:text-emerald-700 group-hover:ring-emerald-200">
              <FileText className="h-3 w-3" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[0.72rem] text-slate-900 transition group-hover:text-emerald-900">{document.title}</p>
              <p className="truncate text-[0.62rem] font-medium text-slate-500">
                {document.subtitle} · <span className="uppercase text-[0.56rem] font-bold text-slate-400">{document.source === 'registry' ? 'Registre' : document.source === 'profile' ? 'Profil' : 'GED'}</span>
              </p>
            </div>
          </div>
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
        </button>
      ))}
    </div>
  );
}

function DrawerHistory({
  details,
  loading,
  error,
}: {
  details: OccupantBailDetails | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return <DrawerEmpty icon={Clock3} title="Historique" description="Chargement de la timeline du bail..." />;
  }
  if (error) {
    return <DrawerEmpty icon={Clock3} title="Historique indisponible" description={error} />;
  }

  const events = [...(details?.events ?? [])].reverse();
  if (events.length === 0) {
    return (
      <DrawerEmpty
        icon={Clock3}
        title="Historique à venir"
        description="L'historique du bail apparaîtra ici après les prochaines actions du cycle de vie."
      />
    );
  }

  return (
    <div className="rounded-xl border border-emerald-950/10 bg-white p-2.5 shadow-sm">
      <div className="space-y-0">
        {events.map((event, index) => (
          <div key={event.id} className="relative flex gap-2 pb-2.5 last:pb-0">
            {index < events.length - 1 && <div className="absolute left-[0.56rem] top-5 h-[calc(100%-0.75rem)] w-px bg-emerald-100" />}
            <div className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-2 ring-white">
              <Activity className="h-2.5 w-2.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <p className="font-bold text-[0.72rem] text-slate-900">{eventLabel(event.event_type)}</p>
                <span className="text-[0.6rem] font-semibold text-slate-400">{formatDate(event.created_at)}</span>
              </div>
              {eventDescription(event.payload) && (
                <p className="mt-0.5 rounded-md bg-slate-50 px-2 py-1 text-[0.65rem] font-medium leading-3.5 text-slate-600">
                  {eventDescription(event.payload)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function eventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    'contrat.created': 'Création bail',
    'contrat.updated': 'Modification bail',
    'contrat.renewed': 'Renouvellement',
    'contrat.renewal_prepared': 'Préparation renouvellement',
    'contrat.resiliated': 'Résiliation',
    'contrat.archived': 'Archivage',
  };
  return labels[eventType] ?? eventType.replace(/[._]/g, ' ');
}

function payloadText(payload: Record<string, unknown> | null, key: string): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function eventDescription(payload: Record<string, unknown> | null): string | null {
  const motif = payloadText(payload, 'motif') ?? payloadText(payload, 'resiliation_motif');
  const observations = payloadText(payload, 'observations') ?? payloadText(payload, 'resiliation_observations');
  const remarks = payloadText(payload, 'remarks') ?? payloadText(payload, 'remarques');
  const source = motif ?? observations ?? remarks;
  if (source) return source;

  const newContractId = payloadText(payload, 'new_contract_id');
  if (newContractId) return `Nouveau bail créé : ${newContractId.slice(0, 8).toUpperCase()}`;

  return null;
}

function LifecycleModals({
  resiliationTarget,
  archiveTarget,
  renewTarget,
  resiliationForm,
  renewForm,
  submitting,
  onCloseResiliation,
  onCloseArchive,
  onCloseRenew,
  onResiliationChange,
  onRenewChange,
  onSubmitResiliation,
  onSubmitArchive,
  onSubmitRenewal,
}: {
  resiliationTarget: OccupantBailRow | null;
  archiveTarget: OccupantBailRow | null;
  renewTarget: OccupantBailRow | null;
  resiliationForm: { date: string; motif: string; observations: string };
  renewForm: { nouvelle_date_fin: string; nouveau_loyer: string; remarques: string };
  submitting: boolean;
  onCloseResiliation: () => void;
  onCloseArchive: () => void;
  onCloseRenew: () => void;
  onResiliationChange: (next: { date: string; motif: string; observations: string }) => void;
  onRenewChange: (next: { nouvelle_date_fin: string; nouveau_loyer: string; remarques: string }) => void;
  onSubmitResiliation: () => void;
  onSubmitArchive: () => void;
  onSubmitRenewal: () => void;
}) {
  return (
    <>
      <Modal isOpen={Boolean(resiliationTarget)} onClose={onCloseResiliation} title="Résilier le bail">
        <div className="space-y-4">
          <LifecycleIntro
            icon={Ban}
            tone="danger"
            title={resiliationTarget ? fullName(resiliationTarget) : ''}
            description="La résiliation passe par le workflow sécurisé : statut du bail, unité libérée et historique."
          />
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Date de résiliation</span>
            <input
              type="date"
              value={resiliationForm.date}
              onChange={(event) => onResiliationChange({ ...resiliationForm, date: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Motif</span>
            <SmartCombobox
              value={resiliationForm.motif}
              options={[
                { value: '', label: 'Sélectionner un motif' },
                { value: 'Départ volontaire', label: 'Départ volontaire' },
                { value: 'Fin de contrat', label: 'Fin de contrat' },
                { value: 'Impayés', label: 'Impayés' },
                { value: 'Autre', label: 'Autre' },
              ]}
              onChange={(next) => onResiliationChange({ ...resiliationForm, motif: next })}
              placeholder="Sélectionner un motif"
              searchPlaceholder="Rechercher un motif..."
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Commentaire optionnel</span>
            <textarea
              value={resiliationForm.observations}
              onChange={(event) => onResiliationChange({ ...resiliationForm, observations: event.target.value })}
              rows={3}
              className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              placeholder="Contexte, remise des clés, observation interne..."
            />
          </label>
          <ModalActions
            submitting={submitting}
            submitLabel="Confirmer la résiliation"
            onCancel={onCloseResiliation}
            onSubmit={onSubmitResiliation}
            tone="danger"
          />
        </div>
      </Modal>

      <Modal isOpen={Boolean(archiveTarget)} onClose={onCloseArchive} title="Archiver le bail">
        <div className="space-y-4">
          <LifecycleIntro
            icon={Archive}
            title={archiveTarget ? fullName(archiveTarget) : ''}
            description="Le bail sera retiré de la vue principale, sans suppression physique. Il restera traçable."
          />
          <ModalActions
            submitting={submitting}
            submitLabel="Archiver"
            onCancel={onCloseArchive}
            onSubmit={onSubmitArchive}
          />
        </div>
      </Modal>

      <Modal isOpen={Boolean(renewTarget)} onClose={onCloseRenew} title="Renouveler le bail">
        <div className="space-y-4">
          <LifecycleIntro
            icon={RefreshCw}
            title={renewTarget ? fullName(renewTarget) : ''}
            description="Un nouveau bail actif sera créé. L'ancien bail reste conservé pour l'historique."
          />
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Nouvelle date de fin</span>
            <input
              type="date"
              value={renewForm.nouvelle_date_fin}
              onChange={(event) => onRenewChange({ ...renewForm, nouvelle_date_fin: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Nouveau loyer optionnel</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={renewForm.nouveau_loyer}
              onChange={(event) => onRenewChange({ ...renewForm, nouveau_loyer: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              placeholder={renewTarget ? String(renewTarget.loyer_mensuel) : 'Ex. 250000'}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Remarques</span>
            <textarea
              value={renewForm.remarques}
              onChange={(event) => onRenewChange({ ...renewForm, remarques: event.target.value })}
              rows={3}
              className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              placeholder="Conditions particulières ou note interne."
            />
          </label>
          <ModalActions
            submitting={submitting}
            submitLabel="Créer le nouveau bail"
            onCancel={onCloseRenew}
            onSubmit={onSubmitRenewal}
          />
        </div>
      </Modal>
    </>
  );
}

function LifecycleIntro({
  icon: Icon,
  title,
  description,
  tone = 'default',
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className={`rounded-2xl border p-3 ${tone === 'danger' ? 'border-red-100 bg-red-50 text-red-800' : 'border-emerald-100 bg-emerald-50 text-emerald-900'}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-black">{title}</p>
          <p className="mt-1 text-sm font-medium leading-6 opacity-80">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ModalActions({
  submitting,
  submitLabel,
  onCancel,
  onSubmit,
  tone = 'default',
}: {
  submitting: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
      >
        Annuler
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
          tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-800 hover:bg-emerald-900'
        }`}
      >
        {submitting ? 'Traitement...' : submitLabel}
      </button>
    </div>
  );
}

function CompactMetric({ label, value, tone = 'slate' }: { label: string; value: ReactNode; tone?: 'emerald' | 'amber' | 'red' | 'blue' | 'slate' }) {
  const tones = {
    emerald: 'text-emerald-700 bg-emerald-50/40 border-emerald-100',
    amber: 'text-amber-700 bg-amber-50/40 border-amber-100',
    red: 'text-red-700 bg-red-50/40 border-red-100',
    blue: 'text-blue-700 bg-blue-50/40 border-blue-100',
    slate: 'text-slate-700 bg-slate-50/40 border-slate-100',
  };
  return (
    <div className={`rounded-lg border p-1.5 ${tones[tone]}`}>
      <p className="text-[0.54rem] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-0.5 text-[0.76rem] font-extrabold">{value}</p>
    </div>
  );
}

function CompactSection({ title, icon: Icon, children }: { title: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-emerald-950/10 bg-white/80 p-2 shadow-sm">
      <h3 className="mb-1 flex items-center gap-1.5 text-[0.58rem] font-black uppercase tracking-wider text-slate-500">
        {Icon && <Icon className="h-3 w-3 text-slate-400" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

function CompactLabelValue({ label, value }: { label: string; value: ReactNode | null | undefined }) {
  if (!value || value === '-') return null;
  return (
    <div className="flex min-w-0 flex-col gap-0.5 py-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-0.5">
      <span className="shrink-0 text-[0.68rem] font-medium text-slate-500 sm:text-[0.64rem]">{label}</span>
      <span className="min-w-0 max-w-full break-words text-left text-[0.72rem] font-semibold text-slate-800 sm:max-w-[65%] sm:truncate sm:text-right sm:text-[0.66rem]">
        {value}
      </span>
    </div>
  );
}

function DrawerEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-emerald-950/15 bg-[#fffaf1] p-5 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-800 shadow-sm ring-1 ring-black/5">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 font-black text-slate-900">{title}</p>
      <p className="mt-1 text-sm font-medium leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function OccupantFormModal({
  mode,
  form,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: OccupantModalMode | null;
  form: OccupantFormState;
  submitting: boolean;
  onChange: (form: OccupantFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!mode) return null;

  return (
    <Modal isOpen={Boolean(mode)} onClose={onClose} title={mode === 'edit' ? "Modifier le locataire" : 'Nouveau locataire'}>
      <div className="space-y-4">
        <LifecycleIntro
          icon={UserPlus}
          title={mode === 'edit' ? "Identité du locataire" : 'Créer un locataire'}
          description="Ces informations alimentent le bail, les documents et les futures fiches Locations."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Prénom" value={form.prenom} onChange={(value) => onChange({ ...form, prenom: value })} required />
          <TextField label="Nom" value={form.nom} onChange={(value) => onChange({ ...form, nom: value })} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Téléphone" value={form.telephone} onChange={(value) => onChange({ ...form, telephone: value })} placeholder="77 123 45 67" required />
          <label className="block">
            <span className="text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">
              Type de pièce
            </span>
            <div className="mt-1">
              <SmartCombobox
                density="compact"
                value={form.type_piece || 'CNI'}
                options={IDENTITY_PIECE_OPTIONS}
                onChange={(val) => onChange({
                  ...form,
                  type_piece: val,
                  numero_piece: formatIdentityNumberInput(form.numero_piece || '', val),
                })}
                placeholder="Sélectionner le type"
              />
            </div>
          </label>
        </div>
        <label className="block">
          <span className="text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">
            Numéro de pièce
          </span>
          <div className="relative mt-1">
            <input
              type="text"
              value={form.numero_piece || ''}
              onChange={(e) => onChange({
                ...form,
                numero_piece: formatIdentityNumberInput(e.target.value, form.type_piece || 'CNI'),
              })}
              className="mt-0.5 h-9 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 px-3 text-[0.93rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 sm:!h-8 sm:!min-h-8 sm:rounded-[0.6rem] sm:text-[0.8rem]"
              placeholder={getIdentityPlaceholder(form.type_piece || 'CNI')}
              maxLength={getIdentityMaxLength(form.type_piece || 'CNI')}
              inputMode={(form.type_piece || 'CNI').toLowerCase().includes('cni') ? 'numeric' : 'text'}
              onKeyDown={(form.type_piece || 'CNI').toLowerCase().includes('cni') ? preventNonDigitKey : undefined}
              autoCapitalize="characters"
            />
          </div>
          <p className="mt-1 text-[0.66rem] text-slate-500 sm:text-[10px]">
            {getIdentityHint(form.type_piece || 'CNI')}
          </p>
        </label>
        <TextField label="Adresse" value={form.adresse_personnelle} onChange={(value) => onChange({ ...form, adresse_personnelle: value })} placeholder="Adresse personnelle" />
        <ModalActions
          submitting={submitting}
          submitLabel={mode === 'edit' ? 'Enregistrer' : 'Créer le locataire'}
          onCancel={onClose}
          onSubmit={onSubmit}
        />
      </div>
    </Modal>
  );
}

function LocationWizardStepContext({ step }: { step: LocationWizardStep }) {
  const copy: Record<LocationWizardStep, { title?: string; body: string }> = {
    occupant: {
      title: 'Bail & rattachement',
      body: 'Sélectionnez le locataire et l’unité à lui rattacher.',
    },
    unite: {
      title: 'Bail & rattachement',
      body: 'Sélectionnez le locataire et l’unité à lui rattacher.',
    },
    conditions: {
      title: 'Conditions du bail',
      body: 'Définissez la durée, le montant du loyer, la caution et la commission.',
    },
    resume: {
      title: 'Validation finale',
      body: 'Vérifiez le bail et les conditions financières avant de valider.',
    },
  };
  const current = copy[step];
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-[0.1rem] flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-emerald-950/10 bg-emerald-50/60 text-emerald-700 sm:h-[18px] sm:w-[18px]">
        <Users className="h-2.5 w-2.5" />
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

function LocationWizardRail({ steps, currentStep }: { steps: WizardStep[]; currentStep: number }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5">
        <BrandMark size="sm" tone="dark" animated withTile={false} />
        <div>
          <p className="text-[0.5rem] font-bold uppercase tracking-[0.18em] text-amber-200/68">Portefeuille locatif</p>
          <p className="mt-0.5 text-[0.6rem] font-semibold text-white/[0.56]">Contrat de location guidé</p>
        </div>
      </div>

      <div className="mt-3">
        <p className="max-w-[11rem] text-[0.72rem] font-semibold leading-tight text-white/[0.86]">
          Structurez une location et ses conditions de bail.
        </p>
        <p className="mt-1 max-w-[11rem] text-[0.6rem] font-medium leading-snug text-emerald-50/[0.56]">
          Un bail clair pour lier le locataire, l'unité et générer les échéances.
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
        <p className="text-[0.47rem] font-semibold uppercase tracking-[0.16em] text-amber-100/[0.66]">
          SOURCE DE VÉRITÉ
        </p>
        <p className="mt-1 text-[0.58rem] font-medium leading-snug text-emerald-50/[0.56]">
          Cette location activera automatiquement les quittances et le suivi des loyers.
        </p>
      </div>
    </div>
  );
}

function OccupationFormModal({
  mode,
  form,
  wizardStep,
  occupantOptions,
  availableUnits,
  workflowLoading,
  submitting,
  isIndividualOwner,
  onStepChange,
  onChange,
  onClose,
  onSubmit,
  onValidationError,
}: {
  mode: OccupationModalMode | null;
  form: OccupationFormState;
  wizardStep: LocationWizardStep;
  occupantOptions: OccupantBailPersonOption[];
  availableUnits: OccupantBailAvailableUnit[];
  workflowLoading: boolean;
  submitting: boolean;
  isIndividualOwner: boolean;
  onStepChange: (step: LocationWizardStep) => void;
  onChange: (form: OccupationFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  onValidationError: (message: string) => void;
}) {
  const update = (patch: Partial<OccupationFormState>) => onChange({ ...form, ...patch });
  const selectedOccupant = occupantOptions.find((occupant) => occupant.id === form.locataire_id) ?? null;
  const selectedUnit = availableUnits.find((unit) => unit.id === form.unite_id) ?? null;
  const occupantComboboxOptions = useMemo<SmartComboboxOption[]>(
    () => occupantOptions.map((occupant) => ({
      value: occupant.id,
      label: `${occupant.prenom} ${occupant.nom}`.trim(),
      subtitle: [
        occupant.telephone ? formatSenegalPhone(occupant.telephone) : 'Téléphone non renseigné',
        occupant.email || 'Email non renseigné',
      ].join(' · '),
      keywords: [
        occupant.prenom,
        occupant.nom,
        occupant.telephone ?? '',
        occupant.email ?? '',
      ].join(' '),
      initials: initialsFromName(occupant.prenom, occupant.nom),
    })),
    [occupantOptions],
  );
  const unitComboboxOptions = useMemo<SmartComboboxOption[]>(
    () => availableUnits.map((unit) => ({
      value: unit.id,
      label: unit.nom,
      subtitle: [
        unit.immeuble_nom ?? 'Bien non renseigné',
        unit.numero ? `Unité ${unit.numero}` : 'Sans numéro',
        unit.etage ? `Étage ${unit.etage}` : null,
        `${unit.bailleur_prenom ?? ''} ${unit.bailleur_nom ?? ''}`.trim() || null,
      ].filter(Boolean).join(' · '),
      keywords: [
        unit.nom,
        unit.numero ?? '',
        unit.etage ?? '',
        unit.immeuble_nom ?? '',
        unit.bailleur_prenom ?? '',
        unit.bailleur_nom ?? '',
      ].join(' '),
      badge: 'Libre',
      rightLabel: <MoneyText value={unit.loyer_base ?? 0} />,
    })),
    [availableUnits],
  );

  if (!mode) return null;

  if (mode === 'edit-bail') {
    return (
      <Modal isOpen onClose={onClose} title="Modifier le bail">
        <div className="space-y-4">
          <LifecycleIntro
            icon={Pencil}
            title="Données du bail"
            description="Ajustez les informations du bail sans modifier les paiements déjà enregistrés."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Date de début" value={form.date_debut} onChange={(value) => update({ date_debut: value })} type="date" disabled />
            <TextField label="Date de fin" value={form.date_fin} onChange={(value) => update({ date_fin: value })} type="date" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Loyer mensuel" value={form.loyer_mensuel} onChange={(value) => update({ loyer_mensuel: value })} type="number" disabled />
            <TextField label="Caution" value={form.caution} onChange={(value) => update({ caution: value })} type="number" />
          </div>
          {!isIndividualOwner && (
            <TextField label="Commission agence" value={form.commission} onChange={(value) => update({ commission: value })} type="number" />
          )}
          <ModalActions submitting={submitting} submitLabel="Enregistrer le bail" onCancel={onClose} onSubmit={onSubmit} />
        </div>
      </Modal>
    );
  }


  const handleNextStep = (step: LocationWizardStep) => {
    if (step === 'occupant' || step === 'unite') {
      if (form.occupantMode === 'existing' && !form.locataire_id) {
        onValidationError('Sélectionnez un locataire ou créez-en un nouveau.');
        return false;
      }
      if (form.occupantMode === 'new') {
        const parsed = personInputFromForm(form.newOccupant);
        if (parsed.error) {
          onValidationError(parsed.error);
          return false;
        }
      }
      if (!form.unite_id) {
        onValidationError('Sélectionnez une unité disponible.');
        return false;
      }
    }

    if (step === 'conditions') {
      const rent = Number(form.loyer_mensuel);
      if (!form.date_debut || !form.date_fin || !Number.isFinite(rent) || rent <= 0) {
        onValidationError('Renseignez les dates et le loyer mensuel avant le résumé.');
        return false;
      }
    }

    return true;
  };

  const chooseUnit = (unit: OccupantBailAvailableUnit) => {
    update({
      unite_id: unit.id,
      loyer_mensuel: form.loyer_mensuel || String(unit.loyer_base ?? 0),
      caution: form.caution || String(unit.loyer_base ?? 0),
      commission: isIndividualOwner ? '0' : (form.commission || String(unit.bailleur_commission ?? 0)),
    });
  };

  const locationWizardStepIndex = Math.max(0, LOCATION_WIZARD_STEPS.findIndex((s) => s.id === wizardStep || (wizardStep === 'unite' && s.id === 'occupant')));

  return (
    <WizardShell
      open={true}
      onClose={onClose}
      size="compact"
      variant="workstation"
      tone="agency"
      eyebrow="SAMAY KËUR"
      title="Nouvelle location"
      description="Créez un contrat de location rattachant un locataire à une unité."
      steps={LOCATION_WIZARD_STEPS}
      currentStep={locationWizardStepIndex}
      contentDescription="Créez un contrat de location rattachant un locataire à une unité."
      stepContext={(wizardStep !== 'occupant' && wizardStep !== 'unite') ? <LocationWizardStepContext step={wizardStep} /> : undefined}
      rail={
        <LocationWizardRail
          steps={LOCATION_WIZARD_STEPS}
          currentStep={locationWizardStepIndex}
        />
      }
      primaryAction={
        <button
          type="button"
          onClick={() => {
            if (wizardStep === 'occupant' || wizardStep === 'unite') {
              if (!handleNextStep('occupant')) return;
              onStepChange('conditions');
            } else if (wizardStep === 'conditions') {
              if (!handleNextStep('conditions')) return;
              onStepChange('resume');
            } else {
              void onSubmit();
            }
          }}
          disabled={submitting || workflowLoading}
          className="inline-flex h-8 min-h-0 w-full min-w-[7rem] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#073728] via-[#062d23] to-[#041812] px-3 py-1 text-[0.72rem] font-semibold leading-none text-white shadow-[0_10px_22px_rgba(6,45,35,0.16)] outline-none transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] focus-visible:ring-2 focus-visible:ring-emerald-700/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {submitting || workflowLoading ? 'Création...' : wizardStep === 'resume' ? 'Créer la location' : 'Continuer'}
        </button>
      }
      secondaryAction={
        <button
          type="button"
          onClick={() => {
            if (wizardStep === 'resume') onStepChange('conditions');
            else if (wizardStep === 'conditions') onStepChange('occupant');
            else onClose();
          }}
          disabled={submitting || workflowLoading}
          className="inline-flex h-8 min-h-0 w-full min-w-[5.5rem] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-950/10 bg-white/90 px-3 py-1 text-[0.72rem] font-semibold leading-none text-slate-700 shadow-2xs outline-none transition hover:bg-white hover:text-slate-900 sm:w-auto"
        >
          {wizardStep === 'occupant' || wizardStep === 'unite' ? 'Annuler' : 'Retour'}
        </button>
      }
    >
      <div className="space-y-2 sm:space-y-2.5">
        {/* ETAPE 1 : LOCATAIRE ET UNITÉ FUSIONNÉS */}
        {(wizardStep === 'occupant' || wizardStep === 'unite') && (
          <div className="space-y-2">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[0.7rem] font-semibold text-slate-600">
                  Locataire <span className="text-red-600">*</span>
                </label>
                <div className="flex items-center gap-1 text-[0.66rem] font-bold">
                  <button
                    type="button"
                    onClick={() => update({ occupantMode: 'existing' })}
                    className={`rounded-md px-2 py-0.5 transition ${form.occupantMode === 'existing' ? 'bg-[#062d23] text-white shadow-2xs' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}
                  >
                    Existant
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ occupantMode: 'new', locataire_id: '' })}
                    className={`rounded-md px-2 py-0.5 transition ${form.occupantMode === 'new' ? 'bg-[#062d23] text-white shadow-2xs' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}
                  >
                    + Nouveau
                  </button>
                </div>
              </div>

              {form.occupantMode === 'existing' ? (
                <SmartCombobox
                  value={form.locataire_id}
                  options={occupantComboboxOptions}
                  onChange={(value) => update({ locataire_id: value, occupantSearch: '' })}
                  placeholder={workflowLoading ? 'Chargement des locataires...' : 'Rechercher ou choisir un locataire'}
                  searchPlaceholder="Nom, téléphone ou email"
                  emptyLabel="Aucun locataire trouvé"
                  emptyActionLabel="Créer un nouveau locataire"
                  onEmptyAction={() => update({ occupantMode: 'new', locataire_id: '' })}
                  disabled={workflowLoading}
                  density="compact"
                />
              ) : (
                <div className="space-y-2 rounded-xl border border-emerald-950/10 bg-[#fffdf8] p-2 shadow-sm">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <TextField label="Prénom" value={form.newOccupant.prenom} onChange={(value) => update({ newOccupant: { ...form.newOccupant, prenom: value } })} required placeholder="Boury" />
                    <TextField label="Nom" value={form.newOccupant.nom} onChange={(value) => update({ newOccupant: { ...form.newOccupant, nom: value } })} required placeholder="Diallo" />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <TextField label="Téléphone" value={form.newOccupant.telephone} onChange={(value) => update({ newOccupant: { ...form.newOccupant, telephone: value } })} required placeholder="77 123 45 67" />
                    <TextField label="Email" value={form.newOccupant.email} onChange={(value) => update({ newOccupant: { ...form.newOccupant, email: value } })} placeholder="nom@domaine.com" />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                    <label className="block sm:col-span-4">
                      <span className="text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">
                        Type de pièce
                      </span>
                      <div className="mt-0.5">
                        <SmartCombobox
                          density="compact"
                          value={form.newOccupant.type_piece || 'CNI'}
                          options={IDENTITY_PIECE_OPTIONS}
                          onChange={(val) => update({
                            newOccupant: {
                              ...form.newOccupant,
                              type_piece: val,
                              numero_piece: formatIdentityNumberInput(form.newOccupant.numero_piece || '', val),
                            },
                          })}
                          placeholder="Type"
                        />
                      </div>
                    </label>
                    <label className="block sm:col-span-8">
                      <span className="text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">
                        Numéro de pièce
                      </span>
                      <div className="relative mt-0.5">
                        <input
                          type="text"
                          value={form.newOccupant.numero_piece || ''}
                          onChange={(e) => update({
                            newOccupant: {
                              ...form.newOccupant,
                              numero_piece: formatIdentityNumberInput(e.target.value, form.newOccupant.type_piece || 'CNI'),
                            },
                          })}
                          className="mt-0.5 h-9 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 px-3 text-[0.93rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 sm:!h-8 sm:!min-h-8 sm:rounded-[0.6rem] sm:text-[0.8rem]"
                          placeholder={getIdentityPlaceholder(form.newOccupant.type_piece || 'CNI')}
                          maxLength={getIdentityMaxLength(form.newOccupant.type_piece || 'CNI')}
                          inputMode={(form.newOccupant.type_piece || 'CNI').toLowerCase().includes('cni') ? 'numeric' : 'text'}
                          onKeyDown={(form.newOccupant.type_piece || 'CNI').toLowerCase().includes('cni') ? preventNonDigitKey : undefined}
                          autoCapitalize="characters"
                        />
                      </div>
                      <p className="mt-0.5 text-[0.66rem] text-slate-500 sm:text-[10px]">
                        {getIdentityHint(form.newOccupant.type_piece || 'CNI')}
                      </p>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[0.7rem] font-semibold text-slate-600">
                Unité disponible <span className="text-red-600">*</span>
              </label>
              <SmartCombobox
                value={form.unite_id}
                options={unitComboboxOptions}
                onChange={(value) => {
                  const nextUnit = availableUnits.find((unit) => unit.id === value);
                  if (nextUnit) chooseUnit(nextUnit);
                  else update({ unite_id: value, unitSearch: '' });
                }}
                placeholder={workflowLoading ? 'Chargement des unités libres...' : 'Sélectionner une unité disponible'}
                searchPlaceholder="Bien, unité, numéro ou étage"
                emptyLabel="Aucune unité libre trouvée"
                emptyActionLabel="Créer une unité"
                onEmptyAction={() => {
                  onClose();
                  window.location.hash = '#/patrimoine?tab=unites&action=new-unit';
                }}
                disabled={workflowLoading}
                density="compact"
              />
            </div>

            {form.occupantMode === 'existing' && (
              <div className="rounded-xl border border-emerald-950/10 bg-white/50 px-3 py-2.5 shadow-[0_5px_14px_rgba(15,23,42,0.014)]">
                <div className="min-w-0">
                  <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-emerald-800/70">
                    Structure de la location
                  </p>
                  <p className="mt-0.5 text-[0.68rem] font-medium leading-snug text-slate-600">
                    Ce contrat rattachera le locataire sélectionné à l’unité pour en activer la gestion complète.
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.62rem] font-semibold text-slate-600">
                  {['Quittances auto', 'Suivi loyers', 'Échéancier', 'Historique'].map((item) => (
                    <span key={item} className="rounded-full border border-emerald-950/10 bg-[#fffdf8]/90 px-2.5 py-1 shadow-2xs">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ETAPE 2 : CONDITIONS */}
        <div className={wizardStep === 'conditions' ? 'space-y-2.5 sm:space-y-3' : 'hidden'}>
          <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-slate-600 sm:text-[0.62rem]">
            Informations complémentaires
          </h3>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
            <TextField label="Date de début" value={form.date_debut} onChange={(value) => update({ date_debut: value })} type="date" required />
            <TextField label="Date de fin" value={form.date_fin} onChange={(value) => update({ date_fin: value })} type="date" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
            <TextField label="Loyer mensuel" value={form.loyer_mensuel} onChange={(value) => update({ loyer_mensuel: value })} type="number" required suffix="F CFA" />
            <TextField label="Caution" value={form.caution} onChange={(value) => update({ caution: value })} type="number" suffix="F CFA" />
          </div>
          {!isIndividualOwner && (
            <TextField label="Commission agence" value={form.commission} onChange={(value) => update({ commission: value })} type="number" suffix="%" />
          )}

          <div>
            <span className="text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">
              Destination <span className="text-red-500">*</span>
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[
                { value: 'Habitation', label: 'Habitation' },
                { value: 'Commerce', label: 'Commerce' },
                { value: 'Bureau', label: 'Bureau' },
                { value: 'Entrepôt', label: 'Entrepôt' },
                { value: 'Parking', label: 'Parking' },
              ].map((opt) => {
                const active = (form.destination || 'Habitation') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update({ destination: opt.value })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'border border-emerald-700 bg-emerald-700 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ETAPE 3 : VALIDATION (Design identique Capture 2 Bailleurs.tsx) */}
        {wizardStep === 'resume' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 p-3 shadow-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <Check className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900">Validation finale</p>
                <p className="mt-0.5 text-[0.72rem] font-medium leading-relaxed text-slate-600">
                  Cette location sera enregistrée et l'unité passera automatiquement au statut occupée. Vous pourrez ensuite éditer les contrats et quittances.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Carte 1 : Parties & Unité */}
              <div className="rounded-xl border border-emerald-950/10 bg-white p-3.5 shadow-sm">
                <p className="text-[0.68rem] font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                  Locataire & Unité
                </p>
                <div className="space-y-2 text-[0.74rem]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Locataire</span>
                    <span className="font-bold text-slate-900">
                      {form.occupantMode === 'new' ? `${form.newOccupant.prenom} ${form.newOccupant.nom}` : selectedOccupant ? `${selectedOccupant.prenom} ${selectedOccupant.nom}` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Bien / Unité</span>
                    <span className="font-bold text-slate-900">
                      {selectedUnit ? `${selectedUnit.immeuble_nom ?? 'Bien'} · ${selectedUnit.nom}` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Propriétaire</span>
                    <span className="font-bold text-slate-900">
                      {selectedUnit ? `${selectedUnit.bailleur_prenom ?? ''} ${selectedUnit.bailleur_nom ?? ''}`.trim() || '—' : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Destination</span>
                    <span className="font-bold text-slate-900">{form.destination || 'Habitation'}</span>
                  </div>
                </div>
              </div>

              {/* Carte 2 : Gestion financière */}
              <div className="rounded-xl border border-emerald-950/10 bg-white p-3.5 shadow-sm">
                <p className="text-[0.68rem] font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  Conditions du bail
                </p>
                <div className="space-y-2 text-[0.74rem]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Loyer mensuel</span>
                    <span className="font-bold text-slate-900">
                      {form.loyer_mensuel ? <MoneyText value={Number(form.loyer_mensuel)} /> : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Caution</span>
                    <span className="font-bold text-slate-900">
                      {form.caution ? <MoneyText value={Number(form.caution)} /> : '0 F CFA'}
                    </span>
                  </div>
                  {!isIndividualOwner && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Commission agence</span>
                      <span className="font-bold text-slate-900">{form.commission || 0}%</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Période</span>
                    <span className="font-bold text-slate-900">{`${form.date_debut || '—'} → ${form.date_fin || '—'}`}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </WizardShell>
  );
}

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
      <span className="text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
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

function EmptyState({
  hasSearch,
  onReset,
}: {
  hasSearch: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4 shadow-inner">
        <FileText className="w-8 h-8 text-emerald-400" />
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-1">
        {hasSearch ? 'Aucun résultat' : 'Aucune location enregistrée'}
      </h3>
      <p className="text-sm text-slate-500 max-w-xs mb-4">
        {hasSearch
          ? 'Aucune location ne correspond à vos critères. Essayez de modifier la recherche ou les filtres.'
          : 'Créez votre première location pour suivre le locataire, le bail et l’unité depuis un seul endroit.'}
      </p>
      {hasSearch && (
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition"
        >
          Réinitialiser les filtres
        </button>
      )}
    </div>
  );
}

function PaginationButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
    >
      {label}
    </button>
  );
}
