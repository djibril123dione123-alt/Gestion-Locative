/**
 * OccupantsBaux — vue unifiée Locations (Phase 2).
 *
 * Fusionne la lecture Locataires + Contrats en une ligne par bail actif.
 * Ne remplace pas les pages existantes Locataires et Contrats.
 *
 * Colonnes : Occupant · Téléphone · Bien / Unité · Référence · Loyer · Statut · Actions
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
  ClipboardList,
  Clock3,
  Download,
  FileCheck2,
  Home,
  Mail,
  MapPin,
  Pencil,
  Plus,
  SlidersHorizontal,
  UserPlus,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { PageSkeleton } from '../components/ui/Skeleton';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { Modal } from '../components/ui/Modal';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { SmartCombobox, type SmartComboboxOption } from '../components/ui/SmartCombobox';
import { MoneyText } from '../components/ui/MoneyText';
import { PremiumMobileCard } from '../components/ui/PremiumMobileCard';
import { ProductWizard, type ProductWizardStep } from '../components/ui/ProductWizard';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
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
import { formatCurrency, formatDate, formatSenegalPhone, normalizeSenegalPhone } from '../lib/formatters';
import { createContratViaEdge, renewContratViaEdge, updateContratViaEdge } from '../services/api/contratApi';
import { generateContratPDF } from '../lib/pdf';

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
  { id: 'tous', label: 'Tous', icon: ClipboardList, tone: 'blue' },
  { id: 'actif', label: 'Actifs', icon: Activity, tone: 'emerald' },
  { id: 'expire', label: 'Expirés', icon: Clock3, tone: 'amber' },
  { id: 'resilie', label: 'Résiliés', icon: Ban, tone: 'red' },
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

const LOCATION_WIZARD_STEPS: ProductWizardStep<LocationWizardStep>[] = [
  { id: 'occupant', label: 'Locataire', icon: Users },
  { id: 'unite', label: 'Unité', icon: Building2 },
  { id: 'conditions', label: 'Conditions', icon: ClipboardList },
  { id: 'resume', label: 'Validation', icon: FileCheck2 },
];

const PERIOD_FILTERS: Array<{ id: PeriodFilter; label: string }> = [
  { id: 'all', label: 'Toute période' },
  { id: 'starts_this_month', label: 'Débute ce mois' },
  { id: 'ending_soon', label: 'Fin proche' },
  { id: 'open_ended', label: 'Sans date fin' },
];

const DESTINATION_OPTIONS: SmartComboboxOption[] = [
  { value: 'Habitation', label: 'Habitation', subtitle: 'Appartement, maison, studio', badge: 'Résidentiel' },
  { value: 'Commerce', label: 'Commerce', subtitle: 'Boutique, point de vente', badge: 'Pro' },
  { value: 'Bureau', label: 'Bureau', subtitle: 'Usage professionnel', badge: 'Pro' },
  { value: 'Entrepôt', label: 'Entrepôt', subtitle: 'Stockage et activité logistique', badge: 'Pro' },
  { value: 'Parking', label: 'Parking', subtitle: 'Place de stationnement', badge: 'Simple' },
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
  return {
    prenom: row.prenom ?? '',
    nom: row.nom ?? '',
    telephone: row.telephone ? formatSenegalPhone(row.telephone, '') : '',
    email: row.email ?? '',
    adresse_personnelle: row.adresse_personnelle ?? '',
    piece_identite: row.piece_identite ?? '',
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

  return {
    data: {
      prenom,
      nom,
      telephone: normalizedPhone,
      email: email || null,
      adresse_personnelle: form.adresse_personnelle.trim() || null,
      piece_identite: form.piece_identite.trim() || null,
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

function getStatusKpiTone(tone: TabDef['tone']): string {
  return {
    emerald: 'bg-emerald-50 text-emerald-800',
    blue: 'bg-stone-50 text-slate-700',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-red-50 text-red-700',
  }[tone];
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function OccupantsBaux() {
  const { profile, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const { success: notifySuccess, error: notifyError, toasts, removeToast } = useToast();

  const [rows, setRows] = useState<OccupantBailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<OccupantBailRow | null>(null);
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

  const handleRefresh = useCallback(async () => {
    if (!profile?.agency_id || !profile?.id) return;
    await invalidateOperationalCaches(
      { agencyId: profile.agency_id, userId: profile.id },
      ['locataires', 'contrats']
    );
    notifyDataChanged(['locataires', 'contrats']);
    await loadData(true);
    notifySuccess('Données actualisées');
  }, [loadData, notifySuccess, profile?.agency_id, profile?.id]);

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
  }, [workflowSubmitting]);

  const closeOccupationModal = useCallback(() => {
    if (workflowSubmitting) return;
    setOccupationModalMode(null);
  }, [workflowSubmitting]);

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
        setLocationWizardStep('unite');
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
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      notifyError('Connexion indisponible : le bail doit être confirmé par le serveur.');
      return;
    }

    if (occupationModalMode === 'create' && locationWizardStep !== 'resume') {
      if (locationWizardStep === 'occupant') {
        if (occupationForm.occupantMode === 'existing' && !occupationForm.locataire_id) {
          notifyError('Sélectionnez un locataire ou créez-en un nouveau.');
          return;
        }
        if (occupationForm.occupantMode === 'new') {
          const parsed = personInputFromForm(occupationForm.newOccupant);
          if (parsed.error) {
            notifyError(parsed.error);
            return;
          }
        }
      }
      if (locationWizardStep === 'unite' && !occupationForm.unite_id) {
        notifyError('Sélectionnez une unité disponible.');
        return;
      }
      if (locationWizardStep === 'conditions') {
        const rent = Number(occupationForm.loyer_mensuel);
        if (!occupationForm.date_debut || !occupationForm.date_fin || !Number.isFinite(rent) || rent <= 0) {
          notifyError('Renseignez les dates et le loyer mensuel avant le résumé.');
          return;
        }
      }
      const currentIndex = LOCATION_WIZARD_STEPS.findIndex((step) => step.id === locationWizardStep);
      const nextStep = LOCATION_WIZARD_STEPS[Math.min(currentIndex + 1, LOCATION_WIZARD_STEPS.length - 1)];
      setLocationWizardStep(nextStep.id);
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
          setSelectedRow(createdRow);
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
    setPdfGeneratingId(row.contrat_id);
    try {
      const { data, error } = await occupantsBauxRepository.contractPdfData({
        agencyId: profile.agency_id,
        contratId: row.contrat_id,
      });
      if (error) throw error;
      if (!data) throw new Error('Contrat introuvable.');
      await generateContratPDF(data);
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
      setSelectedRow(null);
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
      setSelectedRow(null);
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
      { value: 'all', label: 'Tous les propriétaires', subtitle: 'Toutes les locations' },
      ...ownerOptions.map(([id, label]) => ({ value: id, label, subtitle: 'Portefeuille propriétaire' })),
    ],
    [ownerOptions],
  );

  const propertySelectOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous les biens', subtitle: 'Toutes les locations' },
      ...propertyOptions.map(([id, label]) => ({ value: id, label, subtitle: 'Bien locatif' })),
    ],
    [propertyOptions],
  );

  const periodSelectOptions = useMemo(
    () => PERIOD_FILTERS.map((filter) => ({ value: filter.id, label: filter.label })),
    [],
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

  useEffect(() => {
    if (selectedRow && !rows.some((row) => row.contrat_id === selectedRow.contrat_id)) {
      setSelectedRow(null);
    }
  }, [rows, selectedRow]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // ── Compteurs par statut ──────────────────────────────────────────────────

  const counts = useMemo(() => {
    const map: Record<string, number> = { tous: rows.length };
    for (const r of rows) {
      map[r.statut] = (map[r.statut] ?? 0) + 1;
    }
    return map;
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

  // ─── Skeleton ─────────────────────────────────────────────────────────────

  if (loading) return <PageSkeleton title="Locations" variant="table" />;

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Notice hors-ligne */}
      <OfflineDataNotice
        cachedAt={cacheTimestamp}
        onRetry={() => void loadData()}
        message="Les données affichées viennent du dernier chargement réussi."
      />

      <div className={`grid items-start gap-5 ${selectedRow ? 'xl:grid-cols-[minmax(0,1fr)_31.5rem]' : 'grid-cols-1'}`}>
        <section className="min-w-0 space-y-6">
          {/* En-tête */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-action-600">Domaine locatif</p>
              <h1 className="mt-1 font-serif text-3xl font-black tracking-tight text-brand-950 sm:text-4xl">
                Locations
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
                Vue unifiée locataire → bail → unité ·{' '}
                <span className="font-semibold text-emerald-700">{rows.length}</span> location
                {rows.length !== 1 ? 's' : ''} suivie{rows.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                title="Actualiser"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Actualiser</span>
              </button>
              <button
                type="button"
                onClick={openCreateOccupation}
                className="inline-flex items-center gap-2 rounded-xl bg-action-500 px-4 py-2 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:bg-action-600"
              >
                <Plus className="h-4 w-4" />
                Nouvelle location
              </button>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`group flex items-center justify-between gap-3 rounded-[1.05rem] border px-3 py-2.5 text-left shadow-[0_9px_24px_rgba(15,23,42,0.045)] ring-1 ring-white/70 transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-300/35 shadow-emerald-100'
                      : 'border-emerald-950/10 bg-gradient-to-br from-white to-stone-50/70 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/50'
                  }`}
                >
                  <span>
                    <span className={`block text-xl font-black ${activeTab === tab.id ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {counts[tab.id] ?? 0}
                    </span>
                    <span className={`mt-1 block text-xs font-bold uppercase tracking-wide ${activeTab === tab.id ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {tab.label}
                    </span>
                  </span>
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${getStatusKpiTone(tab.tone)}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tableau principal */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Toolbar */}
            <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="relative min-w-0">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher locataire, téléphone, bien, référence..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 w-full rounded-xl border border-emerald-950/10 bg-white/95 pl-9 pr-3 text-sm font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(true)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-[#fffdf8] px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-white lg:hidden"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Filtres
                    {activeFilterCount > 0 && <span className="rounded-full bg-emerald-800 px-1.5 py-0.5 text-[10px] text-white">{activeFilterCount}</span>}
                  </button>
                  <SmartCombobox
                    value={ownerFilter}
                    options={ownerSelectOptions}
                    onChange={setOwnerFilter}
                    placeholder="Tous les propriétaires"
                    searchPlaceholder="Rechercher un propriétaire..."
                    className="hidden lg:block lg:w-56"
                  />
                  <SmartCombobox
                    value={propertyFilter}
                    options={propertySelectOptions}
                    onChange={setPropertyFilter}
                    placeholder="Tous les biens"
                    searchPlaceholder="Rechercher un bien..."
                    className="hidden lg:block lg:w-52"
                  />
                  <SmartCombobox
                    value={periodFilter}
                    options={periodSelectOptions}
                    onChange={(next) => setPeriodFilter(next as PeriodFilter)}
                    placeholder="Période"
                    searchPlaceholder="Rechercher une période..."
                    className="hidden lg:block lg:w-48"
                  />
                  <ColumnPicker
                    columns={OCCUPANTS_BAUX_COLUMN_KEYS.map((key) => ({
                      key,
                      label: getOccupantsBauxColumnLabel(key),
                    }))}
                    visibility={occupantColumns.visibility}
                    onToggle={(key) => occupantColumns.toggle(key as OccupantsBauxColumnKey)}
                    onSetAll={occupantColumns.setAll}
                  />
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600 transition hover:bg-white"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Réinitialiser
                    </button>
                  )}
                </div>
              </div>
              {(searchTerm || activeFilterCount > 0) && (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {filtered.length} résultat{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}
                </p>
              )}
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
                    placeholder="Tous les propriétaires"
                    searchPlaceholder="Rechercher un propriétaire..."
                  />
                  <SmartCombobox
                    value={propertyFilter}
                    options={propertySelectOptions}
                    onChange={setPropertyFilter}
                    placeholder="Tous les biens"
                    searchPlaceholder="Rechercher un bien..."
                  />
                  <SmartCombobox
                    value={periodFilter}
                    options={periodSelectOptions}
                    onChange={(next) => setPeriodFilter(next as PeriodFilter)}
                    placeholder="Période"
                    searchPlaceholder="Rechercher une période..."
                  />
                </div>
              </MobileFilterSheet>
            </div>

            {/* Table desktop / Cards mobile */}
            {paginated.length === 0 ? (
              <EmptyState
                hasSearch={!!searchTerm || activeFilterCount > 0}
                onReset={resetFilters}
              />
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-[#f8f3e8]/70 shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md text-left text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">
                      <tr className="border-b border-slate-100 bg-[#f8f3e8]/70">
                        {occupantColumns.isVisible('occupant') && (
                          <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Locataire</span>
                          </th>
                        )}
                        {occupantColumns.isVisible('telephone') && (
                          <th className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 ${selectedRow ? 'hidden' : 'hidden lg:table-cell'}`}>
                            <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Téléphone</span>
                          </th>
                        )}
                        {occupantColumns.isVisible('bien') && (
                          <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                            <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Bien / Unité</span>
                          </th>
                        )}
                        {occupantColumns.isVisible('proprietaire') && (
                          <th className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 ${selectedRow ? 'hidden' : 'hidden lg:table-cell'}`}>
                            <span className="flex items-center gap-1.5"><Home className="h-3.5 w-3.5" /> Propriétaire</span>
                          </th>
                        )}
                        {occupantColumns.isVisible('reference') && (
                          <th className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 ${selectedRow ? 'hidden' : 'hidden lg:table-cell'}`}>
                            <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Référence</span>
                          </th>
                        )}
                        {occupantColumns.isVisible('loyer') && (
                          <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-400">
                            <span className="flex items-center justify-end gap-1.5"><Wallet className="h-3.5 w-3.5" /> Loyer</span>
                          </th>
                        )}
                        {occupantColumns.isVisible('periode') && (
                          <th className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 ${selectedRow ? 'hidden' : 'hidden lg:table-cell'}`}>
                            <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Période</span>
                          </th>
                        )}
                        {occupantColumns.isVisible('statut') && (
                          <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-400">
                            <span className="flex items-center justify-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Statut</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginated.map((row) => (
                        <DesktopRow
                          key={row.contrat_id}
                          row={row}
                          selected={selectedRow?.contrat_id === row.contrat_id}
                          compact={Boolean(selectedRow)}
                          isVisible={occupantColumns.isVisible}
                          onSelect={() => {
                            setSelectedRow(row);
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
                        setSelectedRow(row);
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
          </div>
        </section>

        <OccupantBailDrawer
          row={selectedRow}
          details={details}
          detailsLoading={detailsLoading}
          detailsError={detailsError}
          isIndividualOwner={isIndividualOwner}
          activeTab={activeDrawerTab}
          onTabChange={setActiveDrawerTab}
          onClose={() => setSelectedRow(null)}
          onEditOccupant={openEditOccupant}
          onEditBail={openEditBail}
          onGeneratePdf={(row) => void generateContractPdf(row)}
          pdfGenerating={pdfGeneratingId === selectedRow?.contrat_id}
          onResiliate={openResiliation}
          onArchive={setArchiveTarget}
          onRenew={openRenewal}
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
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function StatutBadge({ statut }: { statut: ContratStatut }) {
  const { label, cls } = STATUT_BADGE[statut] ?? STATUT_BADGE.en_attente;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>
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
      className={`group cursor-pointer border-b border-slate-100 transition-colors ${selected ? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-200' : 'hover:bg-emerald-50/45'}`}
    >
      {/* Occupant */}
      {isVisible('occupant') && (
        <td className="px-5 py-3.5">
          <p className="font-semibold text-slate-900">{fullName(row)}</p>
          {row.email && <p className="mt-0.5 max-w-[160px] truncate text-xs text-slate-400">{row.email}</p>}
        </td>
      )}
      {/* Téléphone */}
      {isVisible('telephone') && (
        <td className={`px-5 py-3.5 ${compact ? 'hidden' : 'hidden lg:table-cell'}`}>
          {row.telephone ? (
            <a
              href={`tel:${row.telephone}`}
              className="font-medium text-emerald-700 hover:underline"
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
        <td className="px-5 py-3.5">
          <p className="font-medium text-slate-800">{row.immeuble_nom ?? '—'}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <ChevronRight className="h-3 w-3 text-slate-300" />
            {row.unite_nom}
          </p>
        </td>
      )}
      {/* Propriétaire */}
      {isVisible('proprietaire') && (
        <td className={`px-5 py-3.5 ${compact ? 'hidden' : 'hidden lg:table-cell'}`}>
          <p className="max-w-[150px] truncate text-sm font-medium text-slate-700">{ownerName(row)}</p>
        </td>
      )}
      {/* Référence */}
      {isVisible('reference') && (
        <td className={`px-5 py-3.5 ${compact ? 'hidden' : 'hidden lg:table-cell'}`}>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
            {row.contrat_ref}
          </span>
        </td>
      )}
      {/* Loyer */}
      {isVisible('loyer') && (
        <td className="px-5 py-3.5 text-right">
          <MoneyText value={row.loyer_mensuel} className="font-bold text-slate-900" />
          <span className="ml-1 text-xs text-slate-400">/mois</span>
        </td>
      )}
      {/* Période */}
      {isVisible('periode') && (
        <td className={`px-5 py-3.5 ${compact ? 'hidden' : 'hidden lg:table-cell'}`}>
          <p className="text-xs text-slate-600">
            {formatDate(row.date_debut)}
            {row.date_fin && <> → {formatDate(row.date_fin)}</>}
            {!row.date_fin && <span className="text-slate-400"> → ouvert</span>}
          </p>
        </td>
      )}
      {/* Statut */}
      {isVisible('statut') && (
        <td className="px-5 py-3.5 text-center">
          <div className="flex flex-col items-center justify-center gap-1.5">
            <StatutBadge statut={row.statut} />
            {row.statut === 'actif' && canRenew(row) && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-200">
                Fin proche
              </span>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

function LocationMobileCard({ row, onSelect }: { row: OccupantBailRow; onSelect: () => void }) {
  return (
    <div className="px-3 py-2">
      <PremiumMobileCard
        title={fullName(row)}
        subtitle={`${row.telephone ? formatSenegalPhone(row.telephone) : 'Téléphone non renseigné'} · ${row.immeuble_nom ?? 'Bien non renseigné'} · ${row.unite_nom}`}
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

  return (
    <aside className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#fffdf8] shadow-[0_24px_70px_rgba(15,23,42,0.16)] xl:sticky xl:top-4 xl:inset-auto xl:z-auto xl:h-[calc(100vh-2rem)] xl:w-full xl:rounded-3xl xl:border xl:border-emerald-950/10">
      <div className="flex h-full flex-col overflow-y-auto bg-[linear-gradient(180deg,#fff4d9,#fffdf8_11rem)]">
        <div className="border-b border-emerald-950/10 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#9a5b17]">
              Fiche location
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-900 hover:shadow-sm"
              aria-label="Fermer la fiche"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-900 text-xl font-black text-white shadow-lg shadow-emerald-900/15 ring-1 ring-emerald-950/10">
              {`${row.prenom?.[0] ?? ''}${row.nom?.[0] ?? ''}`.toUpperCase() || 'OB'}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 flex-1 truncate text-lg font-black text-brand-950 sm:text-xl">{fullName(row)}</h2>
                <StatutBadge statut={row.statut} />
              </div>
              <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Phone className="h-4 w-4 text-slate-400" />
                {row.telephone ? formatSenegalPhone(row.telephone) : 'Téléphone non renseigné'}
              </p>
              <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-600">
                <Building2 className="h-4 w-4 text-slate-400" />
                {row.immeuble_nom ?? 'Bien non renseigné'} · {row.unite_nom}
              </p>
              <p className="flex items-center gap-2 text-sm font-mono text-slate-500">
                <FileText className="h-4 w-4 text-slate-400" />
                {row.contrat_ref}
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-400">Documents principaux</p>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => onGeneratePdf(row)} disabled={pdfGenerating} className="flex items-center gap-3 rounded-2xl border border-emerald-900/20 bg-gradient-to-br from-white to-emerald-50/70 p-3.5 text-left text-sm font-black text-brand-950 shadow-[0_12px_30px_rgba(6,78,59,0.08)] transition hover:-translate-y-0.5 hover:border-brand-700 hover:shadow-[0_18px_40px_rgba(6,78,59,0.12)] disabled:translate-y-0 disabled:opacity-60">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-800 text-white shadow-sm">
                    <Download className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block">{pdfGenerating ? 'Génération en cours...' : 'Contrat PDF'}</span>
                    <span className="mt-0.5 block text-xs font-semibold text-slate-500">{row.contrat_ref}</span>
                  </span>
                </button>
              </div>
            </div>

            <div>
              <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-400">Gestion</p>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => onEditBail(row)} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-brand-900">
                  <Pencil className="h-4 w-4 text-slate-500" />
                  Modifier la location
                </button>
                <button type="button" onClick={() => onEditOccupant(row)} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-brand-900">
                  <UserPlus className="h-4 w-4 text-slate-500" />
                  Fiche locataire
                </button>
                {canRenew(row) && (
                  <button type="button" onClick={() => onRenew(row)} className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/80 p-3 text-left text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100">
                    <RefreshCw className="h-4 w-4 text-slate-500" />
                    Renouveler la location
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-red-400">Danger</p>
              <div className="flex flex-col gap-2">
                {activeStatus && (
                  <button type="button" onClick={() => onResiliate(row)} className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-100">
                    <Ban className="h-4 w-4" />
                    Résilier la location
                  </button>
                )}
                {canArchive && (
                  <button type="button" onClick={() => onArchive(row)} className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-100">
                    <Archive className="h-4 w-4" />
                    Archiver
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-emerald-950/10 bg-[#fffdf8]/85 px-3 py-2">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-50/80 p-1">
            {DRAWER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-emerald-900 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-white hover:text-emerald-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3.5 p-3.5 sm:p-4">
          {activeTab === 'resume' && <DrawerResume row={row} details={details} isIndividualOwner={isIndividualOwner} />}
          {activeTab === 'paiements' && <DrawerPayments details={details} loading={detailsLoading} error={detailsError} />}
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
    </aside>
  );
}

function DrawerResume({ row, details, isIndividualOwner }: { row: OccupantBailRow; details: OccupantBailDetails | null; isIndividualOwner: boolean }) {
  const reliquatContrat = details?.payments.reduce((sum, payment) => sum + Math.max(0, Number(payment.reliquat ?? 0)), 0) ?? 0;
  const latestPayment = details?.payments[0] ?? null;
  const nextExpectedLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date());
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <MiniMetric label="Loyer mensuel" value={<MoneyText value={row.loyer_mensuel} />} />
        <MiniMetric label="Statut" value={STATUT_BADGE[row.statut]?.label ?? row.statut} />
        <MiniMetric label="Début" value={formatDate(row.date_debut)} />
        <MiniMetric label="Fin" value={row.date_fin ? formatDate(row.date_fin) : 'Ouvert'} />
        <MiniMetric label="Prochain paiement" value={nextExpectedLabel} tone="amber" />
        <MiniMetric label="Reliquat contrat" value={<MoneyText value={reliquatContrat} />} tone={reliquatContrat > 0 ? 'red' : 'emerald'} />
      </div>

      <InfoBlock title="Synthèse opérationnelle">
        <InfoLine icon={Users} label="Propriétaire" value={ownerName(row)} />
        {!isIndividualOwner && <InfoLine icon={Wallet} label="Commission agence" value={row.commission !== null ? `${row.commission}%` : 'Non renseignée'} />}
        <InfoLine icon={Clock3} label="Dernier paiement" value={latestPayment ? <>{formatDate(latestPayment.date_paiement)} · <MoneyText value={latestPayment.montant_total} /></> : 'Aucun paiement récent'} />
      </InfoBlock>

      <InfoBlock title="Locataire">
        <InfoLine icon={Users} label="Nom" value={fullName(row)} />
        <InfoLine icon={Phone} label="Téléphone" value={row.telephone ? formatSenegalPhone(row.telephone) : 'Non renseigné'} />
        <InfoLine icon={Mail} label="Email" value={row.email || 'Non renseigné'} />
        <InfoLine icon={MapPin} label="Adresse" value={row.adresse_personnelle || 'Non renseignée'} />
      </InfoBlock>

      <InfoBlock title="Bail">
        <InfoLine icon={FileText} label="Référence" value={row.contrat_ref} />
        <InfoLine icon={ClipboardList} label="Destination" value={row.destination || 'Non renseignée'} />
        <InfoLine icon={CalendarDays} label="Période" value={`${formatDate(row.date_debut)} → ${row.date_fin ? formatDate(row.date_fin) : 'ouvert'}`} />
        <InfoLine icon={Wallet} label="Loyer" value={<MoneyText value={row.loyer_mensuel} />} />
        {row.caution !== null && <InfoLine icon={Wallet} label="Caution" value={<MoneyText value={row.caution} />} />}
        {!isIndividualOwner && row.commission !== null && <InfoLine icon={Wallet} label="Commission agence" value={`${row.commission}%`} />}
      </InfoBlock>

      <InfoBlock title="Occupation">
        <InfoLine icon={Building2} label="Bien" value={row.immeuble_nom || 'Bien non renseigné'} />
        <InfoLine icon={Home} label="Unité" value={row.unite_nom || 'Unité non renseignée'} />
        <InfoLine icon={MapPin} label="Adresse du bien" value={row.immeuble_adresse || 'Adresse non renseignée'} />
        <InfoLine icon={Users} label="Propriétaire" value={ownerName(row)} />
      </InfoBlock>
    </>
  );
}

function DrawerPayments({
  details,
  loading,
  error,
}: {
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
      <DrawerEmpty
        icon={Wallet}
        title="Aucun paiement rattaché"
        description="Les paiements liés à ce bail seront affichés ici dès qu'ils existent dans le module Encaissements."
      />
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((payment) => (
        <div
          key={payment.id}
          className="rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.035)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-slate-900"><MoneyText value={payment.montant_total} /></p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {payment.mois_concerne} · {formatDate(payment.date_paiement)}
              </p>
              {payment.reference && <p className="mt-1 font-mono text-[0.7rem] text-slate-400">{payment.reference}</p>}
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
              {payment.statut}
            </span>
          </div>
          {payment.reliquat !== null && payment.reliquat > 0 && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              Reliquat restant : <MoneyText value={payment.reliquat} />
            </p>
          )}
        </div>
      ))}
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
    <div className="space-y-3">
      <div className="rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.035)]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900">Contrat de location</p>
            <p className="text-xs font-medium text-slate-500">{row.contrat_ref} · Génération directe depuis Locations</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onGeneratePdf(row)}
          disabled={pdfGenerating}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-950/10 bg-[#fffdf8] px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-brand-900"
        >
          <Download className="h-4 w-4" />
          {pdfGenerating ? 'Génération...' : 'Générer le contrat PDF'}
        </button>
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
        <div
          key={`${document.source}-${document.id}`}
          className="rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.035)]"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-700 ring-1 ring-slate-100">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900">{document.title}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{document.subtitle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400">
                <span>{document.source === 'registry' ? 'Registre' : document.source === 'profile' ? 'Profil' : 'GED'}</span>
                {document.status && <span>· {document.status}</span>}
                {document.created_at && <span>· {formatDate(document.created_at)}</span>}
              </div>
            </div>
          </div>
        </div>
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
    <div className="rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.035)]">
      <div className="space-y-0">
        {events.map((event, index) => (
          <div key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
            {index < events.length - 1 && <div className="absolute left-[0.82rem] top-7 h-[calc(100%-1.3rem)] w-px bg-emerald-100" />}
            <div className="relative z-10 mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-4 ring-white">
              <Activity className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900">{eventLabel(event.event_type)}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">{formatDate(event.created_at)}</p>
              {eventDescription(event.payload) && (
                <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium leading-5 text-slate-600">
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

function MiniMetric({ label, value, tone = 'slate' }: { label: string; value: ReactNode; tone?: 'emerald' | 'amber' | 'red' | 'slate' }) {
  const toneClass = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-800',
    slate: 'border-emerald-950/10 bg-white text-slate-950',
  }[tone];

  return (
    <div className={`rounded-2xl border p-3 shadow-[0_10px_26px_rgba(15,23,42,0.035)] ${toneClass}`}>
      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 whitespace-nowrap text-sm font-black text-current">{value}</p>
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.035)]">
      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-slate-400">{title}</p>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function InfoLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700/55" />
      <div className="min-w-0">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.06em] text-slate-400">{label}</p>
        <p className="break-words font-medium text-slate-700">{value}</p>
      </div>
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
          <TextField label="Prénom" value={form.prenom} onChange={(value) => onChange({ ...form, prenom: value })} />
          <TextField label="Nom" value={form.nom} onChange={(value) => onChange({ ...form, nom: value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Téléphone" value={form.telephone} onChange={(value) => onChange({ ...form, telephone: value })} placeholder="77 123 45 67" />
          <TextField label="Email" value={form.email} onChange={(value) => onChange({ ...form, email: value })} placeholder="locataire@email.com" />
        </div>
        <TextField label="Adresse" value={form.adresse_personnelle} onChange={(value) => onChange({ ...form, adresse_personnelle: value })} placeholder="Adresse personnelle" />
        <TextField label="Pièce d'identité" value={form.piece_identite} onChange={(value) => onChange({ ...form, piece_identite: value })} placeholder="CNI, passeport..." />
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
      rightLabel: formatCurrency(unit.loyer_base ?? 0),
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

  const currentStepIndex = LOCATION_WIZARD_STEPS.findIndex((step) => step.id === wizardStep);
  const canGoBack = currentStepIndex > 0;
  const goBack = () => {
    if (!canGoBack) return;
    onStepChange(LOCATION_WIZARD_STEPS[currentStepIndex - 1].id);
  };
  const chooseUnit = (unit: OccupantBailAvailableUnit) => {
    update({
      unite_id: unit.id,
      loyer_mensuel: form.loyer_mensuel || String(unit.loyer_base ?? 0),
      caution: form.caution || String(unit.loyer_base ?? 0),
      commission: isIndividualOwner ? '0' : (form.commission || String(unit.bailleur_commission ?? 0)),
    });
  };

  return (
    <Modal isOpen onClose={onClose} title="Nouvelle location">
      <ProductWizard
        steps={LOCATION_WIZARD_STEPS}
        activeStep={wizardStep}
        onStepClick={(step, index) => {
          if (index <= currentStepIndex) onStepChange(step);
        }}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={wizardStep === 'occupant' ? onClose : goBack}
              disabled={submitting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {wizardStep === 'occupant' ? 'Annuler' : 'Retour'}
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || workflowLoading}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                wizardStep === 'resume'
                  ? 'bg-gradient-to-br from-brand-950 to-emerald-900 shadow-emerald-950/20 hover:-translate-y-0.5 hover:shadow-emerald-950/25'
                  : 'bg-emerald-800 hover:bg-emerald-900'
              }`}
            >
              {submitting ? 'Traitement...' : wizardStep === 'resume' ? 'Créer la location' : 'Continuer'}
            </button>
          </div>
        }
      >
      <div className="space-y-4">
        {wizardStep === 'occupant' && (
          <div className="space-y-4">
            <LifecycleIntro
              icon={Users}
              title="Choisir le locataire"
              description="Sélectionnez un locataire existant ou créez-le sans quitter le module."
            />
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => update({ occupantMode: 'existing' })}
                className={`rounded-xl px-3 py-2 text-sm font-bold transition ${form.occupantMode === 'existing' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}
              >
                Existant
              </button>
              <button
                type="button"
                onClick={() => update({ occupantMode: 'new', locataire_id: '' })}
                className={`rounded-xl px-3 py-2 text-sm font-bold transition ${form.occupantMode === 'new' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}
              >
                Nouveau
              </button>
            </div>
            {form.occupantMode === 'existing' ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Locataire</span>
                  <SmartCombobox
                    value={form.locataire_id}
                    options={occupantComboboxOptions}
                    onChange={(value) => update({ locataire_id: value, occupantSearch: '' })}
                    placeholder={workflowLoading ? 'Chargement des locataires...' : 'Rechercher ou choisir un locataire'}
                    searchPlaceholder="Nom, téléphone ou email"
                    emptyLabel="Aucun locataire trouvé"
                    disabled={workflowLoading}
                    className="mt-1"
                  />
                </label>
                {selectedOccupant ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                    <p className="text-sm font-black text-emerald-950">{selectedOccupant.prenom} {selectedOccupant.nom}</p>
                    <p className="mt-1 text-xs font-semibold text-emerald-800/80">
                      {selectedOccupant.telephone ? formatSenegalPhone(selectedOccupant.telephone) : 'Téléphone non renseigné'} · {selectedOccupant.email ?? 'Email non renseigné'}
                    </p>
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-emerald-950/10 bg-slate-50 px-3 py-3 text-xs font-semibold leading-5 text-slate-500">
                    Choisissez un locataire existant ou basculez sur “Nouveau” pour créer une fiche locataire.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Prénom" value={form.newOccupant.prenom} onChange={(value) => update({ newOccupant: { ...form.newOccupant, prenom: value } })} />
                  <TextField label="Nom" value={form.newOccupant.nom} onChange={(value) => update({ newOccupant: { ...form.newOccupant, nom: value } })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Téléphone" value={form.newOccupant.telephone} onChange={(value) => update({ newOccupant: { ...form.newOccupant, telephone: value } })} placeholder="77 123 45 67" />
                  <TextField label="Email" value={form.newOccupant.email} onChange={(value) => update({ newOccupant: { ...form.newOccupant, email: value } })} />
                </div>
                <TextField label="Adresse" value={form.newOccupant.adresse_personnelle} onChange={(value) => update({ newOccupant: { ...form.newOccupant, adresse_personnelle: value } })} />
                <TextField label="Pièce d'identité" value={form.newOccupant.piece_identite} onChange={(value) => update({ newOccupant: { ...form.newOccupant, piece_identite: value } })} />
              </div>
            )}
          </div>
        )}

        {wizardStep === 'unite' && (
          <div className="space-y-4">
            <LifecycleIntro
              icon={Building2}
              title="Sélectionner l'unité libre"
              description="La création de la location occupera automatiquement l'unité sélectionnée."
            />
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Unité disponible</span>
              <SmartCombobox
                value={form.unite_id}
                options={unitComboboxOptions}
                onChange={(value) => {
                  const nextUnit = availableUnits.find((unit) => unit.id === value);
                  if (nextUnit) chooseUnit(nextUnit);
                  else update({ unite_id: value, unitSearch: '' });
                }}
                placeholder={workflowLoading ? 'Chargement des unités libres...' : 'Rechercher bien, unité ou numéro'}
                searchPlaceholder="Bien, unité, numéro ou étage"
                emptyLabel="Aucune unité libre trouvée"
                disabled={workflowLoading}
                className="mt-1"
              />
            </label>
            {selectedUnit ? (
              <div className="grid gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 sm:grid-cols-2">
                <MiniMetric label="Bien" value={selectedUnit.immeuble_nom ?? 'Bien non renseigné'} />
                <MiniMetric label="Unité" value={selectedUnit.nom} />
                <MiniMetric label="Propriétaire" value={`${selectedUnit.bailleur_prenom ?? ''} ${selectedUnit.bailleur_nom ?? ''}`.trim() || 'Non renseigné'} />
              <MiniMetric label="Loyer conseillé" value={<MoneyText value={selectedUnit.loyer_base ?? 0} />} />
                <MiniMetric label="Statut" value="Libre" />
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-emerald-950/10 bg-slate-50 px-3 py-3 text-xs font-semibold leading-5 text-slate-500">
                Sélectionnez une unité libre pour préremplir le loyer, la caution et la commission agence si elle existe.
              </p>
            )}
          </div>
        )}

        {wizardStep === 'conditions' && (
          <div className="space-y-4">
            <LifecycleIntro
              icon={FileText}
              title="Conditions du bail"
              description={isIndividualOwner ? 'Mode bailleur individuel : aucune commission agence n’est demandée.' : 'Renseignez les conditions principales sans toucher aux paiements.'}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Date de début" value={form.date_debut} onChange={(value) => update({ date_debut: value })} type="date" />
              <TextField label="Date de fin" value={form.date_fin} onChange={(value) => update({ date_fin: value })} type="date" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Loyer mensuel" value={form.loyer_mensuel} onChange={(value) => update({ loyer_mensuel: value })} type="number" />
              <TextField label="Caution" value={form.caution} onChange={(value) => update({ caution: value })} type="number" />
            </div>
            {!isIndividualOwner && (
              <TextField label="Commission agence" value={form.commission} onChange={(value) => update({ commission: value })} type="number" />
            )}
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Destination</span>
              <SmartCombobox
                value={form.destination}
                options={DESTINATION_OPTIONS}
                onChange={(value) => update({ destination: value })}
                placeholder="Choisir une destination"
                searchPlaceholder="Habitation, commerce, bureau..."
                className="mt-1"
              />
            </label>
            <div className="grid gap-2 rounded-2xl border border-emerald-950/10 bg-white p-3 text-xs font-semibold text-slate-500 sm:grid-cols-3">
              <span>Loyer : <strong className="text-slate-900">{form.loyer_mensuel ? <MoneyText value={Number(form.loyer_mensuel)} /> : 'Non renseigné'}</strong></span>
              <span>Caution : <strong className="text-slate-900">{form.caution ? <MoneyText value={Number(form.caution)} /> : '0 F CFA'}</strong></span>
              <span>Commission : <strong className="text-slate-900">{isIndividualOwner ? '0%' : `${form.commission || 0}%`}</strong></span>
            </div>
          </div>
        )}

        {wizardStep === 'resume' && (
          <div className="space-y-4">
            <LifecycleIntro
              icon={FileCheck2}
              title="Validation finale"
              description="Vérifiez les informations avant création. Cette action enregistrera définitivement la location dans le portefeuille locatif."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniMetric label="Locataire" value={form.occupantMode === 'new' ? `${form.newOccupant.prenom} ${form.newOccupant.nom}` : selectedOccupant ? `${selectedOccupant.prenom} ${selectedOccupant.nom}` : 'Non sélectionné'} />
              <MiniMetric label="Propriétaire" value={selectedUnit ? `${selectedUnit.bailleur_prenom ?? ''} ${selectedUnit.bailleur_nom ?? ''}`.trim() || 'Non renseigné' : 'Non sélectionné'} />
              <MiniMetric label="Bien / unité" value={selectedUnit ? `${selectedUnit.immeuble_nom ?? 'Bien'} · ${selectedUnit.nom}` : 'Non sélectionnée'} />
              <MiniMetric label="Loyer" value={form.loyer_mensuel ? <MoneyText value={Number(form.loyer_mensuel)} /> : 'Non renseigné'} />
              <MiniMetric label="Période" value={`${form.date_debut || '—'} → ${form.date_fin || '—'}`} />
              <MiniMetric label="Caution" value={form.caution ? <MoneyText value={Number(form.caution)} /> : '0 F CFA'} />
              {!isIndividualOwner && <MiniMetric label="Commission agence" value={`${form.commission || 0}%`} />}
              <MiniMetric label="Destination" value={form.destination || 'Habitation'} />
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
              <p className="text-sm font-black text-emerald-950">Validation finale</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-emerald-900/80">
                Cette location sera créée et l'unité passera automatiquement au statut occupée. Aucun paiement n'est enregistré à cette étape.
              </p>
            </div>
          </div>
        )}

      </div>
      </ProductWizard>
    </Modal>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'number' | 'date';
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={type === 'number' ? 'numeric' : undefined}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500"
      />
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
