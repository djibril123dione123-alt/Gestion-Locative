import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check,
  Activity,
  AlertCircle,
  Briefcase,
  Building2,
  ChevronRight,
  CircleUser,
  ClipboardList,
  DoorOpen,
  FileText,
  Home,
  Map as MapIcon,
  MapPin,
  Pencil,
  Percent,
  Plus,
  Search,
  SlidersHorizontal,
  Store,
  Trash2,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

import { ConfirmModal } from '../components/ui/ConfirmModal';
// import { Modal } from '../components/ui/Modal';
import { ToastContainer } from '../components/ui/Toast';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { EmptyState } from '../components/ui/EmptyState';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { SmartCombobox } from '../components/ui/SmartCombobox';
import { MetricCard } from '../components/ui/MetricCard';
import { PageShell } from '../components/ui/PageShell';
import { PremiumButton } from '../components/ui/PremiumButton';
import { PremiumKpiGrid } from '../components/ui/PremiumKpiGrid';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PremiumTableSurface } from '../components/ui/PremiumTableSurface';
import { PremiumToolbar } from '../components/ui/PremiumToolbar';
import { PremiumDrawerShell } from '../components/ui/PremiumDrawerShell';
import { SplitViewShell } from '../components/ui/SplitViewShell';
import { MoneyText } from '../components/ui/MoneyText';
import { PremiumMobileCard } from '../components/ui/PremiumMobileCard';

import { WizardShell, type WizardStep } from '../components/ui/WizardShell';
import { BrandMark } from '../components/brand/BrandLogo';
import { MobileFilterSheet } from '../components/ui/MobileFilterSheet';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useToast } from '../hooks/useToast';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { formatDate } from '../lib/formatters';
import { formatPersonName } from '../lib/people';
import { supabase } from '../lib/supabase';
import { getOrCreateIndividualOwnerBailleur } from '../services/individualOwner';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';

type PatrimoineTab = 'biens' | 'unites';
type DrawerState = { type: 'bien'; id: string } | { type: 'unite'; id: string } | null;
type PropertyFilter = 'all' | 'with_reliquats' | 'without_units' | 'complete' | 'incomplete';
type UnitFilter = 'all' | 'libre' | 'loue' | 'maintenance' | 'late' | 'without_contract';
type DangerTarget = { type: 'bien'; id: string; name: string } | { type: 'unite'; id: string; name: string } | null;
type PropertyColumnKey = 'bien' | 'bailleur' | 'unites' | 'occupation' | 'loyer' | 'reliquats' | 'statut';
type UnitColumnKey = 'unite' | 'bien' | 'locataire' | 'loyer' | 'statut' | 'reliquat';
type PropertyWizardStep = 'main' | 'address' | 'summary';
type UnitWizardStep = 'main' | 'rent' | 'summary';

const PROPERTY_WIZARD_STEPS: WizardStep[] = [
  { id: 'main', label: 'Bien', icon: <Building2 className="h-4 w-4" /> },
  { id: 'address', label: 'Adresse', icon: <MapPin className="h-4 w-4" /> },
  { id: 'summary', label: 'Validation', icon: <ClipboardList className="h-4 w-4" /> },
];

const UNIT_WIZARD_STEPS: WizardStep[] = [
  { id: 'main', label: 'Unité', icon: <DoorOpen className="h-4 w-4" /> },
  { id: 'rent', label: 'Exploitation', icon: <Wallet className="h-4 w-4" /> },
  { id: 'summary', label: 'Validation', icon: <ClipboardList className="h-4 w-4" /> },
];

interface PatrimoineProps {
  initialTab?: PatrimoineTab;
}

interface BailleurRow {
  id: string;
  nom: string | null;
  prenom: string | null;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
  actif?: boolean | null;
}

interface PropertyRow {
  id: string;
  nom: string;
  adresse: string | null;
  quartier: string | null;
  ville: string | null;
  bailleur_id: string | null;
  nombre_unites: number | null;
  description: string | null;
  actif: boolean | null;
  created_at?: string | null;
  bailleurs?: { nom?: string | null; prenom?: string | null } | null;
}

interface UnitRow {
  id: string;
  nom: string;
  numero: string | null;
  etage: string | null;
  loyer_base: number | null;
  statut: string | null;
  immeuble_id: string | null;
  description?: string | null;
  actif?: boolean | null;
  created_at?: string | null;
  immeubles?: { nom?: string | null; bailleur_id?: string | null } | null;
}

interface ContractRow {
  id: string;
  unite_id: string | null;
  date_debut: string | null;
  date_fin: string | null;
  loyer_mensuel: number | null;
  statut: string | null;
  locataires?: { nom?: string | null; prenom?: string | null } | null;
}

interface PaymentRow {
  id: string;
  contrat_id: string | null;
  montant_total: number | null;
  reliquat: number | null;
  statut: string | null;
  mois_concerne: string | null;
  date_paiement: string | null;
  deleted_at?: string | null;
}

interface ExpenseRow {
  id: string;
  immeuble_id: string | null;
  montant: number | null;
  date_depense: string | null;
  categorie: string | null;
  description: string | null;
  actif?: boolean | null;
  deleted_at?: string | null;
}

interface DocumentRow {
  id: string;
  name?: string | null;
  document_category?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  bailleur_id?: string | null;
  created_at?: string | null;
}

interface PatrimoineData {
  bailleurs: BailleurRow[];
  properties: PropertyRow[];
  units: UnitRow[];
  contracts: ContractRow[];
  payments: PaymentRow[];
  expenses: ExpenseRow[];
  documents: DocumentRow[];
}

interface PropertyFormState {
  nom: string;
  type_bien: string;
  adresse: string;
  quartier: string;
  ville: string;
  bailleur_id: string;
  description: string;
}

interface UnitFormState {
  nom: string;
  numero: string;
  etage: string;
  loyer_base: string;
  statut: string;
  immeuble_id: string;
  description: string;
}

interface PropertySummary {
  units: UnitRow[];
  occupiedUnits: number;
  freeUnits: number;
  occupancyRate: number;
  expectedRent: number;
  collected: number;
  reliquats: number;
  expenses: ExpenseRow[];
  contracts: ContractRow[];
  payments: PaymentRow[];
  documents: DocumentRow[];
}

interface UnitSummary {
  contract: ContractRow | null;
  payments: PaymentRow[];
  documents: DocumentRow[];
  reliquat: number;
  latestPayment: PaymentRow | null;
  tenantLabel: string;
  displayStatus: string;
  isLate: boolean;
}

const EMPTY_DATA: PatrimoineData = {
  bailleurs: [],
  properties: [],
  units: [],
  contracts: [],
  payments: [],
  expenses: [],
  documents: [],
};

const PROPERTY_COLUMN_KEYS: PropertyColumnKey[] = ['bien', 'bailleur', 'unites', 'occupation', 'loyer', 'statut', 'reliquats'];
const UNIT_COLUMN_KEYS: UnitColumnKey[] = ['unite', 'bien', 'locataire', 'loyer', 'statut', 'reliquat'];

const PROPERTY_TYPES = ['Immeuble', 'Maison', 'Villa', 'Appartement', 'Boutique', 'Bureau', 'Terrain', 'Local commercial', 'Depot', 'Mixte'];
const UNIT_TYPES = ['Appartement', 'Studio', 'Chambre', 'Boutique', 'Bureau', 'Depot', 'Local commercial', 'Autre'];
const UNIT_STATUSES = [
  { value: 'libre', label: 'Libre' },
  { value: 'loue', label: 'Louee' },
  { value: 'maintenance', label: 'Maintenance' },
];

function normalizeText(value?: string | null) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isOccupiedStatus(value?: string | null) {
  const normalized = normalizeText(value);
  return normalized === 'loue' || normalized === 'louee' || normalized === 'occupee';
}

function isActiveContract(contract?: ContractRow | null) {
  const status = normalizeText(contract?.statut);
  return !!contract && !['resilie', 'resiliee', 'termine', 'terminee', 'archive'].includes(status);
}

function amount(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ownerName(owner?: BailleurRow | PropertyRow['bailleurs'] | null) {
  return formatPersonName(owner, 'Bailleur');
}

function inferPropertyType(property: PropertyRow) {
  const source = normalizeText(`${property.nom} ${property.description ?? ''}`);
  if (source.includes('villa')) return 'Villa';
  if (source.includes('maison')) return 'Maison';
  if (source.includes('appartement')) return 'Appartement';
  if (source.includes('boutique') || source.includes('magasin')) return 'Boutique';
  if (source.includes('bureau')) return 'Bureau';
  if (source.includes('terrain')) return 'Terrain';
  if (source.includes('depot')) return 'Depot';
  if (source.includes('local')) return 'Local commercial';
  return 'Bien locatif';
}

function inferUnitType(unit: UnitRow) {
  const source = normalizeText(`${unit.nom} ${unit.description ?? ''}`);
  if (source.includes('studio')) return 'Studio';
  if (source.includes('chambre')) return 'Chambre';
  if (source.includes('boutique') || source.includes('magasin')) return 'Boutique';
  if (source.includes('bureau')) return 'Bureau';
  if (source.includes('depot')) return 'Depot';
  if (source.includes('local')) return 'Local commercial';
  if (source.includes('appartement') || source.includes('f')) return 'Appartement';
  return 'Unité locative';
}

function getPropertyVisual(property: PropertyRow): { icon: LucideIcon; bg: string; color: string } {
  const type = normalizeText(inferPropertyType(property));
  if (type.includes('villa') || type.includes('maison')) return { icon: Home, bg: 'bg-emerald-50', color: 'text-brand-800' };
  if (type.includes('boutique') || type.includes('local')) return { icon: Store, bg: 'bg-amber-50', color: 'text-amber-800' };
  if (type.includes('bureau')) return { icon: Briefcase, bg: 'bg-sky-50', color: 'text-sky-800' };
  if (type.includes('terrain')) return { icon: MapIcon, bg: 'bg-lime-50', color: 'text-lime-800' };
  if (type.includes('depot')) return { icon: Warehouse, bg: 'bg-slate-100', color: 'text-slate-700' };
  return { icon: Building2, bg: 'bg-emerald-50', color: 'text-brand-800' };
}

function getUnitVisual(unit: UnitRow): { icon: LucideIcon; bg: string; color: string } {
  const type = normalizeText(inferUnitType(unit));
  if (type.includes('boutique') || type.includes('local')) return { icon: Store, bg: 'bg-amber-50', color: 'text-amber-800' };
  if (type.includes('bureau')) return { icon: Briefcase, bg: 'bg-sky-50', color: 'text-sky-800' };
  if (type.includes('depot')) return { icon: Warehouse, bg: 'bg-slate-100', color: 'text-slate-700' };
  if (type.includes('chambre') || type.includes('studio')) return { icon: DoorOpen, bg: 'bg-violet-50', color: 'text-violet-800' };
  return { icon: Home, bg: 'bg-emerald-50', color: 'text-brand-800' };
}

function statusBadgeClass(status: string) {
  const normalized = normalizeText(status);
  if (normalized.includes('retard')) return 'bg-red-50 text-red-700 border-red-200';
  if (normalized.includes('lou') || normalized.includes('actif')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (normalized.includes('sans')) return 'bg-slate-100 text-slate-600 border-slate-200';
  if (normalized.includes('maintenance')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (normalized.includes('libre')) return 'bg-sky-50 text-sky-700 border-sky-200';
  if (normalized.includes('reserv')) return 'bg-violet-50 text-violet-700 border-violet-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function getUnitStatusLabel(unit: UnitRow, summary?: UnitSummary) {
  if (summary?.isLate) return 'En retard';
  const normalized = normalizeText(unit.statut);
  if (normalized === 'loue' || normalized === 'louee') return 'Louée';
  if (normalized === 'maintenance') return 'Maintenance';
  if (normalized === 'reservee') return 'Réservée';
  return 'Libre';
}

function createPropertyForm(): PropertyFormState {
  return {
    nom: '',
    type_bien: '',
    adresse: '',
    quartier: '',
    ville: '',
    bailleur_id: '',
    description: '',
  };
}

function createUnitForm(propertyId = ''): UnitFormState {
  return {
    nom: '',
    numero: '',
    etage: '',
    loyer_base: '',
    statut: 'libre',
    immeuble_id: propertyId,
    description: '',
  };
}

export function Patrimoine({ initialTab = 'biens' }: PatrimoineProps) {
  const { user, profile, agency, accountProfile } = useAuth();
  const isIndividualOwner = accountProfile.isIndividualOwner;
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const planLimits = usePlanLimits();

  const [activeTab, setActiveTab] = useState<PatrimoineTab>(initialTab);
  const [data, setData] = useState<PatrimoineData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyFilter, setPropertyFilter] = useState<PropertyFilter>('all');
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyRow | null>(null);
  const [editingUnit, setEditingUnit] = useState<UnitRow | null>(null);
  const [propertyWizardStep, setPropertyWizardStep] = useState<PropertyWizardStep>('main');
  const [unitWizardStep, setUnitWizardStep] = useState<UnitWizardStep>('main');
  const [propertyForm, setPropertyForm] = useState<PropertyFormState>(createPropertyForm);
  const [unitForm, setUnitForm] = useState<UnitFormState>(() => createUnitForm());
  const [dangerTarget, setDangerTarget] = useState<DangerTarget>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const propertyColumns = useColumnVisibility(
    'patrimoine-biens',
    PROPERTY_COLUMN_KEYS,
    isIndividualOwner ? { bailleur: false } : {},
  );
  const unitColumns = useColumnVisibility('patrimoine-unites', UNIT_COLUMN_KEYS);

  const loadData = useCallback(async () => {
    if (!profile?.agency_id) {
      setLoading(false);
      return;
    }

    if (data.properties.length === 0 && data.units.length === 0) setLoading(true);
    try {
      const result = await readWithCache<PatrimoineData>(
        { agencyId: profile.agency_id, userId: profile.id },
        'patrimoine-module-v2',
        async () => {
          const [bailleursRes, propertiesRes, unitsRes, contractsRes, paymentsRes, expensesRes] = await Promise.all([
            supabase
              .from('bailleurs')
              .select('id, nom, prenom, telephone, email, adresse, actif')
              .eq('agency_id', profile.agency_id)
              .eq('actif', true)
              .order('prenom', { ascending: true }),
            supabase
              .from('immeubles')
              .select('id, nom, adresse, quartier, ville, bailleur_id, nombre_unites, description, actif, created_at, bailleurs(nom, prenom)')
              .eq('agency_id', profile.agency_id)
              .eq('actif', true)
              .order('created_at', { ascending: false }),
            supabase
              .from('unites')
              .select('id, nom, numero, etage, loyer_base, statut, immeuble_id, description, actif, created_at, immeubles(nom, bailleur_id)')
              .eq('agency_id', profile.agency_id)
              .eq('actif', true)
              .order('created_at', { ascending: false }),
            supabase
              .from('contrats')
              .select('id, unite_id, date_debut, date_fin, loyer_mensuel, statut, locataires(nom, prenom)')
              .eq('agency_id', profile.agency_id),
            supabase
              .from('paiements')
              .select('id, contrat_id, montant_total, reliquat, statut, mois_concerne, date_paiement, deleted_at')
              .eq('agency_id', profile.agency_id),
            supabase
              .from('depenses')
              .select('id, immeuble_id, montant, date_depense, categorie, description, actif, deleted_at')
              .eq('agency_id', profile.agency_id),
          ]);

          if (bailleursRes.error) throw bailleursRes.error;
          if (propertiesRes.error) throw propertiesRes.error;
          if (unitsRes.error) throw unitsRes.error;
          if (contractsRes.error) throw contractsRes.error;
          if (paymentsRes.error) throw paymentsRes.error;
          if (expensesRes.error) throw expensesRes.error;

          let documents: DocumentRow[] = [];
          const documentsRes = await supabase
            .from('documents')
            .select('id, name, document_category, entity_type, entity_id, created_at')
            .eq('agency_id', profile.agency_id)
            .limit(350);

          if (!documentsRes.error) {
            documents = (documentsRes.data || []) as DocumentRow[];
          }

          return {
            bailleurs: (bailleursRes.data || []) as BailleurRow[],
            properties: (propertiesRes.data || []) as PropertyRow[],
            units: (unitsRes.data || []) as UnitRow[],
            contracts: (contractsRes.data || []) as ContractRow[],
            payments: (paymentsRes.data || []) as PaymentRow[],
            expenses: (expensesRes.data || []) as ExpenseRow[],
            documents,
          };
        },
        { timeoutMs: 7_000 },
      );

      setData(result.data);
      setCacheTimestamp(result.source === 'cache' ? result.timestamp : null);
    } catch (error) {
      console.error('[Patrimoine] load failed', error);
      toast.error('Patrimoine indisponible pour le moment. Reessayez quand la connexion est stable.');
    } finally {
      setLoading(false);
    }
  }, [data.properties.length, data.units.length, profile?.agency_id, profile?.id, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const propertyById = useMemo(() => new Map(data.properties.map((property) => [property.id, property])), [data.properties]);
  const ownerById = useMemo(() => new Map(data.bailleurs.map((owner) => [owner.id, owner])), [data.bailleurs]);
  const contractsByUnitId = useMemo(() => {
    const map = new Map<string, ContractRow[]>();
    data.contracts.forEach((contract) => {
      if (!contract.unite_id) return;
      const current = map.get(contract.unite_id) ?? [];
      current.push(contract);
      map.set(contract.unite_id, current);
    });
    return map;
  }, [data.contracts]);
  const paymentsByContractId = useMemo(() => {
    const map = new Map<string, PaymentRow[]>();
    data.payments
      .filter((payment) => payment.deleted_at == null)
      .forEach((payment) => {
        if (!payment.contrat_id) return;
        const current = map.get(payment.contrat_id) ?? [];
        current.push(payment);
        map.set(payment.contrat_id, current);
      });
    return map;
  }, [data.payments]);

  const getUnitSummary = useCallback(
    (unit: UnitRow): UnitSummary => {
      const contracts = contractsByUnitId.get(unit.id) ?? [];
      const activeContract = contracts.find(isActiveContract) ?? contracts[0] ?? null;
      const contractIds = contracts.map((contract) => contract.id);
      const payments = contractIds.flatMap((contractId) => paymentsByContractId.get(contractId) ?? []);
      const documents = data.documents.filter((document) => {
        if (document.entity_type === 'unite' && document.entity_id === unit.id) return true;
        return !!activeContract && document.entity_type === 'contrat' && document.entity_id === activeContract.id;
      });
      const reliquat = payments.reduce((sum, payment) => sum + Math.max(0, amount(payment.reliquat)), 0);
      const latestPayment = [...payments].sort((a, b) => String(b.date_paiement ?? '').localeCompare(String(a.date_paiement ?? '')))[0] ?? null;
      const tenantLabel = activeContract?.locataires ? formatPersonName(activeContract.locataires, 'Locataire') : 'Aucun locataire';
      const isLate = reliquat > 0;

      return {
        contract: activeContract,
        payments,
        documents,
        reliquat,
        latestPayment,
        tenantLabel,
        displayStatus: getUnitStatusLabel(unit, { isLate } as UnitSummary),
        isLate,
      };
    },
    [contractsByUnitId, data.documents, paymentsByContractId],
  );

  const getPropertySummary = useCallback(
    (property: PropertyRow): PropertySummary => {
      const units = data.units.filter((unit) => unit.immeuble_id === property.id && unit.actif !== false);
      const contracts = units.flatMap((unit) => contractsByUnitId.get(unit.id) ?? []);
      const contractIds = new Set(contracts.map((contract) => contract.id));
      const payments = data.payments.filter((payment) => payment.contrat_id && contractIds.has(payment.contrat_id) && payment.deleted_at == null);
      const expenses = data.expenses.filter((expense) => expense.immeuble_id === property.id && expense.deleted_at == null && expense.actif !== false);
      const unitIds = new Set(units.map((unit) => unit.id));
      const documents = data.documents.filter((document) => {
        if (document.entity_type === 'immeuble' && document.entity_id === property.id) return true;
        if (document.entity_type === 'unite' && document.entity_id && unitIds.has(document.entity_id)) return true;
        if (document.entity_type === 'contrat' && document.entity_id && contractIds.has(document.entity_id)) return true;
        return document.entity_id === property.id && document.entity_type === 'immeuble';
      });
      const occupiedUnits = units.filter((unit) => isOccupiedStatus(unit.statut) || contractsByUnitId.get(unit.id)?.some(isActiveContract)).length;
      const expectedRent = units.reduce((sum, unit) => sum + amount(unit.loyer_base), 0);
      const collected = payments.reduce((sum, payment) => sum + amount(payment.montant_total), 0);
      const reliquats = payments.reduce((sum, payment) => sum + Math.max(0, amount(payment.reliquat)), 0);

      return {
        units,
        occupiedUnits,
        freeUnits: Math.max(0, units.length - occupiedUnits),
        occupancyRate: units.length > 0 ? Math.round((occupiedUnits / units.length) * 100) : 0,
        expectedRent,
        collected,
        reliquats,
        expenses,
        contracts,
        payments,
        documents,
      };
    },
    [contractsByUnitId, data.documents, data.expenses, data.payments, data.units],
  );

  const summaries = useMemo(() => {
    const property = new Map<string, PropertySummary>();
    const unit = new Map<string, UnitSummary>();
    data.properties.forEach((item) => property.set(item.id, getPropertySummary(item)));
    data.units.forEach((item) => unit.set(item.id, getUnitSummary(item)));
    return { property, unit };
  }, [data.properties, data.units, getPropertySummary, getUnitSummary]);

  const pageStats = useMemo(() => {
    const activeProperties = data.properties.filter((property) => property.actif !== false);
    const activeUnits = data.units.filter((unit) => unit.actif !== false);
    const occupied = activeUnits.filter((unit) => isOccupiedStatus(unit.statut) || contractsByUnitId.get(unit.id)?.some(isActiveContract)).length;
    const expectedRent = activeUnits.reduce((sum, unit) => sum + amount(unit.loyer_base), 0);
    const reliquats = activeUnits.reduce((sum, unit) => sum + (summaries.unit.get(unit.id)?.reliquat ?? 0), 0);
    const collected = data.payments.filter((payment) => payment.deleted_at == null).reduce((sum, payment) => sum + amount(payment.montant_total), 0);

    return {
      properties: activeProperties.length,
      units: activeUnits.length,
      occupied,
      free: Math.max(0, activeUnits.length - occupied),
      occupancyRate: activeUnits.length > 0 ? Math.round((occupied / activeUnits.length) * 100) : 0,
      expectedRent,
      collected,
      reliquats,
    };
  }, [contractsByUnitId, data.payments, data.properties, data.units, summaries.unit]);


  const propertyQuickChipsData = useMemo(() => {
    const baseProperties = data.properties.filter((property) => {
      const search = normalizeText(searchTerm);
      const owner = property.bailleur_id ? ownerById.get(property.bailleur_id) ?? property.bailleurs : property.bailleurs;
      const searchable = normalizeText(`${property.nom} ${property.adresse ?? ''} ${property.quartier ?? ''} ${property.ville ?? ''} ${ownerName(owner)} ${inferPropertyType(property)}`);
      if (search && !searchable.includes(search)) return false;
      if (!isIndividualOwner && ownerFilter !== 'all' && property.bailleur_id !== ownerFilter) return false;
      return true;
    });

    return {
      all: baseProperties.length,
      with_reliquats: baseProperties.filter((property) => (summaries.property.get(property.id)?.reliquats ?? 0) > 0).length,
      without_units: baseProperties.filter((property) => (summaries.property.get(property.id)?.units.length ?? 0) === 0).length,
      complete: baseProperties.filter((property) => property.adresse && property.ville && (summaries.property.get(property.id)?.units.length ?? 0) > 0).length,
      incomplete: baseProperties.filter((property) => !property.adresse || !property.ville || (summaries.property.get(property.id)?.units.length ?? 0) === 0).length,
    };
  }, [data.properties, isIndividualOwner, ownerById, ownerFilter, searchTerm, summaries.property]);

  const propertyQuickChips = useMemo(
    () => [
      { id: 'all', label: 'Tous', count: propertyQuickChipsData.all, isActive: propertyFilter === 'all', onClick: () => setPropertyFilter('all') },
      { id: 'incomplete', label: 'Incomplets', count: propertyQuickChipsData.incomplete, isActive: propertyFilter === 'incomplete', onClick: () => setPropertyFilter('incomplete') },
      { id: 'complete', label: 'Complets', count: propertyQuickChipsData.complete, isActive: propertyFilter === 'complete', onClick: () => setPropertyFilter('complete') },
      { id: 'with_reliquats', label: 'Reliquats', count: propertyQuickChipsData.with_reliquats, isActive: propertyFilter === 'with_reliquats', onClick: () => setPropertyFilter('with_reliquats') },
      { id: 'without_units', label: 'Sans unité', count: propertyQuickChipsData.without_units, isActive: propertyFilter === 'without_units', onClick: () => setPropertyFilter('without_units') },
    ],
    [propertyFilter, propertyQuickChipsData]
  );

  const unitQuickChipsData = useMemo(() => {
    const baseUnits = data.units.filter((unit) => {
      const search = normalizeText(searchTerm);
      const summary = summaries.unit.get(unit.id);
      const property = unit.immeuble_id ? propertyById.get(unit.immeuble_id) : null;
      const searchable = normalizeText(`${unit.nom} ${unit.numero ?? ''} ${unit.etage ?? ''} ${property?.nom ?? ''} ${summary?.tenantLabel ?? ''} ${inferUnitType(unit)}`);
      if (search && !searchable.includes(search)) return false;
      return true;
    });

    return {
      all: baseUnits.length,
      libre: baseUnits.filter((unit) => getUnitStatusLabel(unit, summaries.unit.get(unit.id)) === 'Libre').length,
      loue: baseUnits.filter((unit) => getUnitStatusLabel(unit, summaries.unit.get(unit.id)) === 'Louée').length,
      late: baseUnits.filter((unit) => summaries.unit.get(unit.id)?.isLate).length,
      without_contract: baseUnits.filter((unit) => !summaries.unit.get(unit.id)?.contract).length,
    };
  }, [data.units, propertyById, searchTerm, summaries.unit]);

  const unitQuickChips = useMemo(
    () => [
      { id: 'all', label: 'Toutes', count: unitQuickChipsData.all, isActive: unitFilter === 'all', onClick: () => setUnitFilter('all') },
      { id: 'libre', label: 'Libres', count: unitQuickChipsData.libre, isActive: unitFilter === 'libre', onClick: () => setUnitFilter('libre') },
      { id: 'loue', label: 'Louées', count: unitQuickChipsData.loue, isActive: unitFilter === 'loue', onClick: () => setUnitFilter('loue') },
      { id: 'late', label: 'Retard', count: unitQuickChipsData.late, isActive: unitFilter === 'late', onClick: () => setUnitFilter('late') },
      { id: 'without_contract', label: 'Sans bail', count: unitQuickChipsData.without_contract, isActive: unitFilter === 'without_contract', onClick: () => setUnitFilter('without_contract') },
    ],
    [unitFilter, unitQuickChipsData]
  );
  const filteredProperties = useMemo(() => {
    const search = normalizeText(searchTerm);
    return data.properties.filter((property) => {
      const summary = summaries.property.get(property.id);
      const owner = property.bailleur_id ? ownerById.get(property.bailleur_id) ?? property.bailleurs : property.bailleurs;
      const searchable = normalizeText(`${property.nom} ${property.adresse ?? ''} ${property.quartier ?? ''} ${property.ville ?? ''} ${ownerName(owner)} ${inferPropertyType(property)}`);
      if (search && !searchable.includes(search)) return false;
      if (!isIndividualOwner && ownerFilter !== 'all' && property.bailleur_id !== ownerFilter) return false;
      if (propertyFilter === 'with_reliquats' && (summary?.reliquats ?? 0) <= 0) return false;
      if (propertyFilter === 'without_units' && (summary?.units.length ?? 0) > 0) return false;
      if (propertyFilter === 'complete' && (!property.adresse || !property.ville || (summary?.units.length ?? 0) === 0)) return false;
      if (propertyFilter === 'incomplete' && property.adresse && property.ville && (summary?.units.length ?? 0) > 0) return false;
      return true;
    });
  }, [data.properties, isIndividualOwner, ownerById, ownerFilter, propertyFilter, searchTerm, summaries.property]);

  const filteredUnits = useMemo(() => {
    const search = normalizeText(searchTerm);
    return data.units.filter((unit) => {
      const summary = summaries.unit.get(unit.id);
      const property = unit.immeuble_id ? propertyById.get(unit.immeuble_id) : null;
      const searchable = normalizeText(`${unit.nom} ${unit.numero ?? ''} ${unit.etage ?? ''} ${property?.nom ?? ''} ${summary?.tenantLabel ?? ''} ${inferUnitType(unit)}`);
      if (search && !searchable.includes(search)) return false;
      if (unitFilter === 'libre' && getUnitStatusLabel(unit, summary) !== 'Libre') return false;
      if (unitFilter === 'loue' && getUnitStatusLabel(unit, summary) !== 'Lou\u00e9e') return false;
      if (unitFilter === 'maintenance' && getUnitStatusLabel(unit, summary) !== 'Maintenance') return false;
      if (unitFilter === 'late' && !(summary?.isLate)) return false;
      if (unitFilter === 'without_contract' && summary?.contract) return false;
      return true;
    });
  }, [data.units, propertyById, searchTerm, summaries.unit, unitFilter]);

  const selectedProperty = drawer?.type === 'bien' ? data.properties.find((property) => property.id === drawer.id) ?? null : null;
  const selectedUnit = drawer?.type === 'unite' ? data.units.find((unit) => unit.id === drawer.id) ?? null : null;
  const selectedPropertySummary = selectedProperty ? summaries.property.get(selectedProperty.id) ?? getPropertySummary(selectedProperty) : null;
  const selectedUnitSummary = selectedUnit ? summaries.unit.get(selectedUnit.id) ?? getUnitSummary(selectedUnit) : null;
  const detailPanelOpen = drawer !== null;
  const ownerFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous les bailleurs', subtitle: 'Portefeuille complet' },
      ...data.bailleurs.map((owner) => ({
        value: owner.id,
        label: ownerName(owner),
        subtitle: [owner.telephone, owner.email].filter(Boolean).join(' - ') || 'Propriétaire',
        keywords: `${owner.nom ?? ''} ${owner.prenom ?? ''} ${owner.telephone ?? ''} ${owner.email ?? ''}`,
      })),
    ],
    [data.bailleurs],
  );
  
  

  const openPropertyModal = useCallback(
    async (property?: PropertyRow | null) => {
      setPropertyWizardStep('main');
      if (property) {
        setEditingProperty(property);
        setPropertyForm({
          nom: property.nom ?? '',
          type_bien: inferPropertyType(property),
          adresse: property.adresse ?? '',
          quartier: property.quartier ?? '',
          ville: property.ville ?? '',
          bailleur_id: property.bailleur_id ?? '',
          description: property.description ?? '',
        });
      } else {
        setEditingProperty(null);
        const next = createPropertyForm();
        if (isIndividualOwner) {
          try {
            const owner = await getOrCreateIndividualOwnerBailleur({ profile, agency, accountProfile });
            next.bailleur_id = owner.id;
          } catch (error) {
            console.error('[Patrimoine] owner bailleur unavailable', error);
            toast.error('Impossible de préparer votre profil propriétaire. Réessayez avec une connexion stable.');
            return;
          }
        }
        setPropertyForm(next);
      }
      setPropertyModalOpen(true);
    },
    [accountProfile, agency, isIndividualOwner, profile, toast],
  );

  const openUnitModal = useCallback(
    (unit?: UnitRow | null, propertyId = '') => {
      setUnitWizardStep('main');
      if (unit) {
        setEditingUnit(unit);
        setUnitForm({
          nom: unit.nom ?? '',
          numero: unit.numero ?? '',
          etage: unit.etage ?? '',
          loyer_base: String(unit.loyer_base ?? ''),
          statut: normalizeText(unit.statut) === 'loue' ? 'loue' : normalizeText(unit.statut) === 'maintenance' ? 'maintenance' : 'libre',
          immeuble_id: unit.immeuble_id ?? '',
          description: unit.description ?? '',
        });
      } else {
        setEditingUnit(null);
        setUnitForm(createUnitForm(propertyId));
      }
      setUnitModalOpen(true);
    },
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'unites') setActiveTab('unites');
    if (tab === 'biens' || tab === 'immeubles') setActiveTab('biens');

    const action = params.get('action');
    if (!action || loading || propertyModalOpen || unitModalOpen) return;

    if (action === 'new-unit') {
      setActiveTab('unites');
      openUnitModal();
    } else if (action === 'new') {
      void openPropertyModal();
    } else {
      return;
    }
    params.delete('action');
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true },
    );
  }, [loading, location.pathname, location.search, navigate, openPropertyModal, openUnitModal, propertyModalOpen, unitModalOpen]);

  const closePropertyModal = () => {
    setPropertyModalOpen(false);
    setEditingProperty(null);
    setPropertyWizardStep('main');
    setPropertyForm(createPropertyForm());
  };

  const closeUnitModal = () => {
    setUnitModalOpen(false);
    setEditingUnit(null);
    setUnitWizardStep('main');
    setUnitForm(createUnitForm());
  };

  const reloadAfterMutation = async () => {
    if (profile?.agency_id && profile?.id) {
      await invalidateOperationalCaches(
        { agencyId: profile.agency_id, userId: profile.id },
        ['dashboard', 'patrimoine', 'contrats', 'paiements', 'impayes', 'finances', 'documents'],
      );
      notifyDataChanged(['patrimoine', 'contrats', 'paiements', 'impayes', 'dashboard', 'finances', 'documents']);
    }
    await loadData();
  };

  const handlePropertySubmit = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (!profile?.agency_id) return;
    if (!navigator.onLine) {
      toast.error('Connexion indisponible : création ou modification impossible hors ligne.');
      return;
    }
    if (!editingProperty && !planLimits.canAddImmeuble) {
      toast.error('Limite atteinte sur votre plan actuel. Passez au plan Pro pour continuer.');
      return;
    }

    const nom = propertyForm.nom.trim();
    const adresse = propertyForm.adresse.trim();
    const ville = propertyForm.ville.trim();
    if (!nom || !adresse || !ville) {
      toast.error('Nom, adresse et ville sont obligatoires.');
      return;
    }

    setSaving(true);
    try {
      let bailleurId = propertyForm.bailleur_id;
      if (isIndividualOwner) {
        const owner = await getOrCreateIndividualOwnerBailleur({ profile, agency, accountProfile });
        bailleurId = owner.id;
      }
      if (!bailleurId) {
        toast.error(isIndividualOwner ? 'Profil propriétaire indisponible.' : 'Sélectionnez un bailleur pour rattacher ce bien.');
        return;
      }

      const payload = {
        nom,
        adresse,
        ville,
        quartier: propertyForm.quartier.trim() || null,
        bailleur_id: bailleurId,
        description: propertyForm.description.trim() || null,
      };

      if (editingProperty) {
        const { error } = await supabase.from('immeubles').update(payload).eq('id', editingProperty.id).eq('agency_id', profile.agency_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('immeubles').insert([{ ...payload, agency_id: profile.agency_id, created_by: user?.id ?? null }]);
        if (error) throw error;
      }

      toast.success(editingProperty ? 'Bien mis à jour.' : 'Bien créé.');
      closePropertyModal();
      await reloadAfterMutation();
    } catch (error) {
      console.error('[Patrimoine] save property failed', error);
      toast.error("Impossible d'enregistrer ce bien.");
    } finally {
      setSaving(false);
    }
  };

  const handleUnitSubmit = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (!profile?.agency_id) return;
    if (!navigator.onLine) {
      toast.error('Connexion indisponible : création ou modification impossible hors ligne.');
      return;
    }
    if (!editingUnit && !planLimits.canAddUnite) {
      toast.error('Limite atteinte sur votre plan actuel. Passez au plan Pro pour continuer.');
      return;
    }
    if (!unitForm.immeuble_id) {
      toast.error('Sélectionnez un bien parent pour cette unité.');
      return;
    }
    if (!unitForm.nom.trim() || !unitForm.loyer_base.trim()) {
      toast.error("Type d'unité et loyer sont obligatoires.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nom: unitForm.nom.trim(),
        numero: unitForm.numero.trim() || null,
        etage: unitForm.etage.trim() || null,
        loyer_base: amount(unitForm.loyer_base),
        statut: unitForm.statut,
        immeuble_id: unitForm.immeuble_id,
        description: unitForm.description.trim() || null,
      };

      if (editingUnit) {
        const { error } = await supabase.from('unites').update(payload).eq('id', editingUnit.id).eq('agency_id', profile.agency_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('unites').insert([{ ...payload, agency_id: profile.agency_id, created_by: user?.id ?? null }]);
        if (error) throw error;
      }

      toast.success(editingUnit ? 'Unité mise à jour.' : 'Unité créée.');
      closeUnitModal();
      await reloadAfterMutation();
    } catch (error) {
      console.error('[Patrimoine] save unit failed', error);
      toast.error("Impossible d'enregistrer cette unité.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!dangerTarget || !profile?.agency_id) return;
    if (!navigator.onLine) {
      toast.error('Connexion indisponible : suppression impossible hors ligne.');
      return;
    }
    setDeleting(true);
    try {
      const table = dangerTarget.type === 'bien' ? 'immeubles' : 'unites';
      const { error } = await supabase.from(table).update({ actif: false }).eq('id', dangerTarget.id).eq('agency_id', profile.agency_id);
      if (error) throw error;
      toast.success(dangerTarget.type === 'bien' ? 'Bien archivé.' : 'Unité archivée.');
      setDangerTarget(null);
      setDrawer(null);
      await reloadAfterMutation();
    } catch (error) {
      console.error('[Patrimoine] archive failed', error);
      toast.error("Impossible d'archiver cet élément.");
    } finally {
      setDeleting(false);
    }
  };

  const selectProperty = (property: PropertyRow) => setDrawer({ type: 'bien', id: property.id });
  const selectUnit = (unit: UnitRow) => setDrawer({ type: 'unite', id: unit.id });

  const pageSubtitle = isIndividualOwner
    ? 'Suivez vos biens, vos unités, vos locataires et vos loyers depuis un espace unique.'
    : 'Suivez les biens rattachés aux bailleurs, leurs unités, leur occupation et leur potentiel locatif.';

  if (loading) {
    return <PageSkeleton title={isIndividualOwner ? 'Mes biens' : 'Biens & patrimoine'} variant="analytics" />;
  }

  return (
    <PageShell spacing="compact" variant="dataDense" tone="paper" verticalInset="compact">
      <ToastContainer
        toasts={toast.toasts}
        onRemove={toast.removeToast}
        className={`left-4 right-4 top-4 items-end sm:left-auto ${detailPanelOpen ? 'lg:right-[clamp(24.5rem,36vw,32.5rem)]' : ''}`}
      />
      <div className="space-y-2.5">
        <OfflineDataNotice
          cachedAt={cacheTimestamp}
          onRetry={loadData}
          message="Le patrimoine affiche le dernier état connu. La création et les modifications restent bloquées hors ligne pour protéger les rattachements."
        />

        <SplitViewShell
          isDetailOpen={detailPanelOpen}
          size="compact"
          desktopAt="lg"
          detailClassName="lg:sticky lg:top-2 lg:h-[calc(100dvh-1rem)]"
          mainClassName={detailPanelOpen ? 'hidden lg:block' : ''}
          main={
          <div className="min-w-0 space-y-2.5">
            <PremiumPageHeader
              density="ultraCompact"
              isSplitOpen={detailPanelOpen}
              eyebrow="PORTEFEUILLE LOCATIF"
              title="Biens & patrimoine"
              description={pageSubtitle}
              mobileDescription={isIndividualOwner ? 'Vos biens et unités.' : 'Biens, unités et occupation.'}
              primaryAction={
                <PremiumButton
                  variant={activeTab === 'biens' ? 'create' : 'secondary'}
                  onClick={() => {
                    setActiveTab('biens');
                    void openPropertyModal();
                  }}
                  icon={<Plus className="h-3 w-3" />}
                  className="w-full sm:w-auto !h-7 !min-h-7 !px-2.5 !py-1 !text-[0.7rem]"
                >
                  {isIndividualOwner ? 'Ajouter mon bien' : 'Nouveau bien'}
                </PremiumButton>
              }
              secondaryAction={
                <PremiumButton
                  variant={activeTab === 'unites' ? 'create' : 'secondary'}
                  onClick={() => {
                    setActiveTab('unites');
                    openUnitModal(null, selectedProperty?.id ?? '');
                  }}
                  icon={<DoorOpen className="h-3 w-3" />}
                  className="w-full sm:w-auto !h-7 !min-h-7 !px-2.5 !py-1 !text-[0.7rem]"
                >
                  Nouvelle unité
                </PremiumButton>
              }
            />

        <PremiumKpiGrid variant="dashboard" maxItems={6} density="ultraCompact" ariaLabel="Indicateurs patrimoine">
          <MetricCard density="ultraCompact" label={isIndividualOwner ? 'Biens' : 'Biens'} value={pageStats.properties} icon={Building2} tone="emerald" />
          <MetricCard density="ultraCompact" label="Unités" value={pageStats.units} icon={DoorOpen} tone="blue" />
          <MetricCard density="ultraCompact" label="Occupées" value={pageStats.occupied} icon={Home} tone="emerald" />
          <MetricCard density="ultraCompact" label="Occupation" value={`${pageStats.occupancyRate}%`} icon={Percent} tone="amber" />
          <MetricCard density="ultraCompact" label="Loyers" value={<MoneyText value={pageStats.expectedRent} compact />} icon={Wallet} tone="green" />
          <MetricCard density="ultraCompact" label="Reliquats" value={<MoneyText value={pageStats.reliquats} compact />} icon={AlertCircle} tone="red" />
        </PremiumKpiGrid>

        <PremiumToolbar
          layout="list"
          density="ultraCompact"
          isSplitOpen={detailPanelOpen}
          ariaLabel="Filtres patrimoine"
          quickChips={activeTab === 'biens' ? propertyQuickChips : unitQuickChips}
          tabs={
            <div className="flex gap-0.5 overflow-x-auto rounded-[0.6rem] bg-[#f7f1e7]/75 p-0.5">
              {[
                { id: 'biens' as const, label: 'Biens' },
                { id: 'unites' as const, label: 'Unités' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-7 whitespace-nowrap rounded-[0.45rem] px-2.5 text-[0.7rem] font-semibold transition ${activeTab === tab.id
                      ? 'bg-brand-950 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-emerald-50 hover:text-brand-900'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          }
          search={
            <div className="relative min-w-0 w-full transition-all">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={activeTab === 'biens' ? 'Nom, adresse ou bailleur' : 'Unité, bien ou locataire'}
                className="!h-7 !min-h-7 !py-0 w-full rounded-[0.55rem] border border-emerald-950/10 bg-white/95 pl-7 pr-2.5 text-[0.68rem] leading-none font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none focus:border-brand-700 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          }
          filters={
            <>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="inline-flex h-7 items-center justify-center gap-1 rounded-[0.55rem] border border-slate-200 bg-[#fffdf8] px-2 text-[0.7rem] font-bold text-slate-700 shadow-sm transition hover:border-emerald-100 hover:bg-emerald-50/60 lg:hidden"
              >
                <SlidersHorizontal className="h-3 w-3" />
                Filtres
              </button>
              {activeTab === 'biens' ? (
                <>
                  {!isIndividualOwner && (
                    <SmartCombobox
                      value={ownerFilter}
                      options={ownerFilterOptions}
                      onChange={setOwnerFilter}
                      placeholder="Tous les bailleurs"
                      searchPlaceholder="Rechercher un bailleur..."
                      className={`${detailPanelOpen ? 'hidden xl:block xl:w-28' : 'hidden sm:block sm:w-32 lg:w-36'}`}
                      density="dense"
                    />
                  )}
                  <ColumnPicker
                    columns={PROPERTY_COLUMN_KEYS.filter((key) => !isIndividualOwner || key !== 'bailleur').map((key) => ({ key, label: getPropertyColumnLabel(key), required: key === 'bien' }))}
                    visibility={propertyColumns.visibility}
                    onToggle={propertyColumns.toggle}
                    onSetAll={propertyColumns.setAll}
                    className={`!h-7 !rounded-[0.55rem] !px-2 !py-1 !text-[0.7rem] [&_svg]:!h-3 [&_svg]:!w-3 ${detailPanelOpen ? 'hidden' : ''}`}
                  />
                </>
              ) : (
                <>
                  <ColumnPicker
                    columns={UNIT_COLUMN_KEYS.map((key) => ({ key, label: getUnitColumnLabel(key), required: key === 'unite' }))}
                    visibility={unitColumns.visibility}
                    onToggle={unitColumns.toggle}
                    onSetAll={unitColumns.setAll}
                    className={`!h-7 !rounded-[0.55rem] !px-2 !py-1 !text-[0.7rem] [&_svg]:!h-3 [&_svg]:!w-3 ${detailPanelOpen ? 'hidden' : ''}`}
                  />
                </>
              )}
            </>
          }
        />
          <MobileFilterSheet
            isOpen={mobileFiltersOpen}
            title={activeTab === 'biens' ? 'Filtres biens' : 'Filtres unités'}
            onClose={() => setMobileFiltersOpen(false)}
            onReset={() => {
              setOwnerFilter('all');
              setPropertyFilter('all');
              setUnitFilter('all');
            }}
          >
            {activeTab === 'biens' ? (
              <div className="grid gap-2.5">
                {!isIndividualOwner && (
                  <SmartCombobox
                    value={ownerFilter}
                    options={ownerFilterOptions}
                    onChange={setOwnerFilter}
                    placeholder="Tous les bailleurs"
                    searchPlaceholder="Rechercher un bailleur..."
                  />
                )}
              </div>
            ) : (
              <div className="grid gap-2.5">
                {/* Plus de filtres mobiles ici pour les unités */}
              </div>
            )}
          </MobileFilterSheet>

        <main className="min-w-0">
            {activeTab === 'biens' ? (
              <PropertiesTable
                properties={filteredProperties}
                summaries={summaries.property}
                ownerById={ownerById}
                isIndividualOwner={isIndividualOwner}
                isVisible={propertyColumns.isVisible}
                isSplitOpen={detailPanelOpen}
                selectedId={selectedProperty?.id ?? null}
                onSelect={selectProperty}
                onCreate={() => void openPropertyModal()}
              />
            ) : (
              <UnitsTable
                units={filteredUnits}
                summaries={summaries.unit}
                propertyById={propertyById}
                isVisible={unitColumns.isVisible}
                isSplitOpen={detailPanelOpen}
                selectedId={selectedUnit?.id ?? null}
                onSelect={selectUnit}
                onCreate={() => openUnitModal()}
              />
            )}
          </main>
          </div>
          }
          detail={
            drawer ? (
              <PremiumDrawerShell
                key={selectedProperty?.id || selectedUnit?.id || activeTab}
                open={detailPanelOpen}
                onClose={() => setDrawer(null)}
                size="compact"
                desktopMode="floating"
                desktopAt="lg"
                density="compact"
                eyebrow={selectedProperty ? 'FICHE BIEN' : 'FICHE UNITÉ'}
                avatar={
                  selectedProperty ? (
                    (() => {
                      const visual = getPropertyVisual(selectedProperty);
                      const Icon = visual.icon;
                      return (
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-inner ring-1 ring-emerald-950/10 ${visual.bg} ${visual.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                      );
                    })()
                  ) : selectedUnit ? (
                    (() => {
                      const visual = getUnitVisual(selectedUnit);
                      const Icon = visual.icon;
                      return (
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-inner ring-1 ring-emerald-950/10 ${visual.bg} ${visual.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                      );
                    })()
                  ) : undefined
                }
                title={selectedProperty?.nom ?? selectedUnit?.nom ?? 'Détail patrimoine'}
                description={
                  selectedProperty
                    ? `${inferPropertyType(selectedProperty)} · ${selectedProperty.quartier || selectedProperty.ville || 'Localisation à compléter'}`
                    : selectedUnit
                      ? `${inferUnitType(selectedUnit)} · ${selectedUnit.immeubles?.nom ?? 'Bien parent à choisir'}`
                      : undefined
                }
                bodyClassName="space-y-2.5 pb-20"
              >
                {selectedProperty && selectedPropertySummary && (
                  <PropertyDrawer
                    property={selectedProperty}
                    summary={selectedPropertySummary}
                    owner={selectedProperty.bailleur_id ? ownerById.get(selectedProperty.bailleur_id) ?? selectedProperty.bailleurs : selectedProperty.bailleurs}
                    isIndividualOwner={isIndividualOwner}
                    onEdit={() => void openPropertyModal(selectedProperty)}
                    onAddUnit={() => {
                      setActiveTab('unites');
                      openUnitModal(null, selectedProperty.id);
                    }}
                    onArchive={() => setDangerTarget({ type: 'bien', id: selectedProperty.id, name: selectedProperty.nom })}
                    onNavigate={navigate}
                    onSelectUnit={selectUnit}
                  />
                )}
                {selectedUnit && selectedUnitSummary && (
                  <UnitDrawer
                    unit={selectedUnit}
                    summary={selectedUnitSummary}
                    property={selectedUnit.immeuble_id ? propertyById.get(selectedUnit.immeuble_id) ?? null : null}
                    onEdit={() => openUnitModal(selectedUnit)}
                    onArchive={() => setDangerTarget({ type: 'unite', id: selectedUnit.id, name: selectedUnit.nom })}
                    onNavigate={navigate}
                  />
                )}
              </PremiumDrawerShell>
            ) : undefined
          }
        />
      </div>

      <PropertyModal
        isOpen={propertyModalOpen}
        isIndividualOwner={isIndividualOwner}
        editingProperty={editingProperty}
        form={propertyForm}
        owners={data.bailleurs}
        saving={saving}
        wizardStep={propertyWizardStep}
        onStepChange={setPropertyWizardStep}
        onClose={closePropertyModal}
        onSubmit={handlePropertySubmit}
        onChange={setPropertyForm}
      />

      <UnitModal
        isOpen={unitModalOpen}
        editingUnit={editingUnit}
        form={unitForm}
        properties={data.properties}
        saving={saving}
        wizardStep={unitWizardStep}
        onStepChange={setUnitWizardStep}
        onClose={closeUnitModal}
        onSubmit={handleUnitSubmit}
        onChange={setUnitForm}
      />

      <ConfirmModal
        isOpen={!!dangerTarget}
        onClose={() => setDangerTarget(null)}
        onConfirm={confirmDelete}
        title={dangerTarget?.type === 'bien' ? 'Archiver ce bien ?' : 'Archiver cette unité ?'}
        message={buildDangerMessage(dangerTarget, selectedProperty, selectedPropertySummary, selectedUnit, selectedUnitSummary)}
        confirmLabel="Archiver"
        cancelLabel="Annuler"
        isDestructive
        isLoading={deleting}
      />
    </PageShell>
  );
}

function getPropertyColumnLabel(key: PropertyColumnKey) {
  const labels: Record<PropertyColumnKey, string> = {
    bien: 'Bien',
    bailleur: 'Bailleur',
    unites: 'Unités',
    occupation: 'Occupation',
    loyer: 'Loyer attendu',
    reliquats: 'Reliquats',
    statut: 'Statut',
  };
  return labels[key];
}

function getUnitColumnLabel(key: UnitColumnKey) {
  const labels: Record<UnitColumnKey, string> = {
    unite: 'Unité',
    bien: 'Bien parent',
    locataire: 'Locataire',
    loyer: 'Loyer',
    statut: 'Statut',
    reliquat: 'Reliquat',
  };
  return labels[key];
}

function buildDangerMessage(
  dangerTarget: DangerTarget,
  property: PropertyRow | null,
  propertySummary: PropertySummary | null,
  unit: UnitRow | null,
  unitSummary: UnitSummary | null,
) {
  if (!dangerTarget) return '';
  if (dangerTarget.type === 'bien') {
    const units = propertySummary?.units.length ?? 0;
    const contracts = propertySummary?.contracts.length ?? 0;
    const payments = propertySummary?.payments.length ?? 0;
    const documents = propertySummary?.documents.length ?? 0;
    return `Vous allez archiver "${property?.nom ?? dangerTarget.name}". Relations détectées : ${units} unité(s), ${contracts} location(s), ${payments} paiement(s), ${documents} document(s). Les données restent conservées, mais le bien ne sera plus actif.`;
  }
  return `Vous allez archiver "${unit?.nom ?? dangerTarget.name}". Relations détectées : ${unitSummary?.contract ? '1 bail actif ou historique' : 'aucun bail actif'}, ${unitSummary?.payments.length ?? 0} paiement(s), ${unitSummary?.documents.length ?? 0} document(s).`;
}

function StatusBadge({ label }: { label: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-1.5 py-[2px] text-[0.6rem] font-semibold leading-none ${statusBadgeClass(label)}`}>{label}</span>;
}

function PropertiesTable({
  properties,
  summaries,
  ownerById,
  isIndividualOwner,
  isVisible,
  isSplitOpen,
  selectedId,
  onSelect,
  onCreate,
}: {
  properties: PropertyRow[];
  summaries: Map<string, PropertySummary>;
  ownerById: Map<string, BailleurRow>;
  isIndividualOwner: boolean;
  isVisible: (key: string) => boolean;
  isSplitOpen: boolean;
  selectedId: string | null;
  onSelect: (property: PropertyRow) => void;
  onCreate: () => void;
}) {
  const showColumn = (key: PropertyColumnKey) => {
    if (isSplitOpen) {
      return ['bien', 'occupation', 'reliquats', 'statut'].includes(key);
    }
    return isVisible(key);
  };
  const showActions = !isSplitOpen;

  if (properties.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Aucun bien ajoute pour le moment."
        description="Ajoutez votre premier bien pour commencer a suivre vos unites, locataires et loyers."
        action={{ label: 'Ajouter un bien', onClick: onCreate }}
      />
    );
  }

  return (
    <PremiumTableSurface density="dense" className="bg-white">
        <table className={`hidden lg:table w-full border-collapse table-fixed ${isSplitOpen ? 'min-w-[480px]' : 'min-w-[840px]'}`}>
          <thead className="bg-[#f2efe8]/80 text-left border-b border-emerald-950/10">
            <tr>
              {showColumn('bien') && <th className={`${isSplitOpen ? 'w-[45%] px-3' : 'w-[30%] px-3'} py-2.5 text-left text-[0.62rem] font-bold uppercase tracking-wider text-slate-500`}><span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-slate-400" /> Bien</span></th>}
              {!isIndividualOwner && showColumn('bailleur') && <th className="w-[15%] px-3 py-2.5 text-left text-[0.62rem] font-bold uppercase tracking-wider text-slate-500"><span className="flex items-center gap-1.5"><CircleUser className="h-3.5 w-3.5 text-slate-400" /> Bailleur</span></th>}
              {showColumn('unites') && <th className="w-[10%] px-3 py-2.5 text-center text-[0.62rem] font-bold uppercase tracking-wider text-slate-500">Unités</th>}
              {showColumn('occupation') && <th className={`${isSplitOpen ? 'w-[20%] px-3' : 'w-[12%] px-3'} py-2.5 text-left text-[0.62rem] font-bold uppercase tracking-wider text-slate-500`}><span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-slate-400" /> Occupation</span></th>}
              {showColumn('loyer') && <th className="w-[12%] px-3 py-2.5 text-right text-[0.62rem] font-bold uppercase tracking-wider text-slate-500">Loyer attendu</th>}
              {showColumn('statut') && <th className={`${isSplitOpen ? 'w-[15%] px-3' : 'w-[9%] px-3'} py-2.5 text-center text-[0.62rem] font-bold uppercase tracking-wider text-slate-500`}>Statut</th>}
              {showColumn('reliquats') && <th className={`${isSplitOpen ? 'w-[20%] px-3' : 'w-[12%] px-3'} py-2.5 text-right text-[0.62rem] font-bold uppercase tracking-wider text-slate-500`}><span className="flex items-center justify-end gap-1.5"><AlertCircle className="h-3.5 w-3.5 text-slate-400" /> Reliquats</span></th>}
              {showActions && <th className="w-[4%] px-2 py-2.5"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {properties.map((property) => {
              const summary = summaries.get(property.id);
              const owner = property.bailleur_id ? ownerById.get(property.bailleur_id) ?? property.bailleurs : property.bailleurs;
              const visual = getPropertyVisual(property);
              const Icon = visual.icon;
              const selected = property.id === selectedId;
              const reliquatAmount = summary?.reliquats ?? 0;
              return (
                <tr key={property.id} className={`cursor-pointer border-b border-slate-100 transition-colors duration-150 outline-none hover:bg-[#f8fbf9] ${selected ? 'bg-emerald-50/50 relative z-0 after:absolute after:inset-y-0 after:left-0 after:w-[3px] after:bg-brand-500' : ''}`} onClick={() => onSelect(property)}>
                  {showColumn('bien') && (
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-lg ring-1 ring-black/5 ${visual.bg} ${visual.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[0.78rem] leading-tight font-semibold text-slate-950">
                            {property.nom}
                          </p>
                          <p className="truncate text-[0.64rem] leading-snug font-medium text-slate-500 mt-[1px]">
                            {property.quartier || property.ville || 'Localisation à compléter'}
                            {!isSplitOpen && ` · ${summary?.units.length ?? 0} unité${(summary?.units.length ?? 0) > 1 ? 's' : ''}`}
                            {isSplitOpen && !isIndividualOwner && owner ? ` · ${ownerName(owner)}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                  )}
                  {!isIndividualOwner && showColumn('bailleur') && <td className="py-2.5 px-3 text-[0.75rem] text-slate-700 font-medium"><p className="truncate">{owner ? ownerName(owner) : 'Aucun bailleur'}</p></td>}
                  {showColumn('unites') && <td className="py-2.5 px-3 text-center text-[0.75rem] font-semibold text-slate-700">{summary?.units.length ?? 0}</td>}
                  {showColumn('occupation') && (
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[0.65rem]">
                          <span className="font-semibold text-slate-700">{summary?.occupancyRate ?? 0}%</span>
                          <span className="text-slate-500">{summary?.occupiedUnits ?? 0}/{summary?.units.length ?? 0}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${summary?.occupancyRate ?? 0}%` }} />
                        </div>
                      </div>
                    </td>
                  )}
                  {showColumn('loyer') && <td className="py-2.5 px-3 text-right text-[0.75rem] font-semibold text-slate-700"><MoneyText value={summary?.expectedRent ?? 0} compact={false} /></td>}
                  {showColumn('statut') && <td className="py-2.5 px-3 text-center"><StatusBadge label={(summary?.units.length ?? 0) > 0 ? 'Actif' : 'Sans unité'} /></td>}
                  {showColumn('reliquats') && <td className={`py-2.5 px-3 text-right text-[0.75rem] ${reliquatAmount > 0 ? 'font-semibold text-red-600' : 'font-medium text-slate-400'}`}><MoneyText value={reliquatAmount} compact={false} /></td>}
                  {showActions && <td className="py-2.5 px-3 text-right">
                    <ChevronRight className="h-[10px] w-[10px] text-slate-300 inline-block" />
                  </td>}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="grid gap-2 p-2 lg:hidden">
          {properties.map((property) => {
            const summary = summaries.get(property.id);
            const visual = getPropertyVisual(property);
            const reliquatAmount = summary?.reliquats ?? 0;
            return (
              <PremiumMobileCard
                key={property.id}
                onClick={() => onSelect(property)}
                title={property.nom}
                subtitle={property.adresse && property.ville ? `${property.adresse}, ${property.ville}` : 'Adresse non renseignée'}
                icon={visual.icon}
                status={(summary?.units.length ?? 0) > 0 ? 'Actif' : 'Sans unité'}
                statusTone={(summary?.units.length ?? 0) > 0 ? 'emerald' : 'slate'}
                amount={summary?.expectedRent ?? 0}
                amountLabel="Attendu"
                amountTone={(summary?.expectedRent ?? 0) === 0 ? 'slate' : 'emerald'}
                secondaryAmount={reliquatAmount > 0 ? reliquatAmount : undefined}
                secondaryAmountLabel={reliquatAmount > 0 ? "Reliquats" : undefined}
                secondaryAmountTone="red"
                emphasis="identity"
                topMeta={[
                  { label: 'Unités', value: String(summary?.units.length ?? 0) },
                  { label: 'Occ.', value: `${summary?.occupancyRate ?? 0}%` },
                ]}
                meta={[]}
              />
            );
          })}
        </div>

    </PremiumTableSurface>
  );
}

function UnitsTable({
  units,
  summaries,
  propertyById,
  isVisible,
  isSplitOpen,
  selectedId,
  onSelect,
  onCreate,
}: {
  units: UnitRow[];
  summaries: Map<string, UnitSummary>;
  propertyById: Map<string, PropertyRow>;
  isVisible: (key: string) => boolean;
  isSplitOpen: boolean;
  selectedId: string | null;
  onSelect: (unit: UnitRow) => void;
  onCreate: () => void;
}) {
  const showColumn = (key: UnitColumnKey) => {
    if (isSplitOpen) {
      return ['unite', 'loyer', 'statut', 'reliquat'].includes(key);
    }
    return isVisible(key);
  };
  const showActions = !isSplitOpen;

  if (units.length === 0) {
    return (
      <EmptyState
        icon={DoorOpen}
        title="Aucune unité enregistrée."
        description="Ajoutez une unité pour préparer la mise en location."
        action={{ label: 'Ajouter une unité', onClick: onCreate }}
      />
    );
  }

  return (
    <PremiumTableSurface density="dense" className="bg-white">
        <table className={`hidden lg:table w-full border-collapse table-fixed ${isSplitOpen ? 'min-w-[480px]' : 'min-w-[840px]'}`}>
          <thead className="bg-[#f2efe8]/80 text-left border-b border-emerald-950/10">
            <tr>
              {showColumn('unite') && <th className={`${isSplitOpen ? 'w-[40%] px-3' : 'w-[25%] px-3'} py-2.5 text-left text-[0.62rem] font-bold uppercase tracking-wider text-slate-500`}><span className="flex items-center gap-1.5"><DoorOpen className="h-3.5 w-3.5 text-slate-400" /> Unité</span></th>}
              {showColumn('bien') && <th className="w-[15%] px-3 py-2.5 text-left text-[0.62rem] font-bold uppercase tracking-wider text-slate-500"><span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-slate-400" /> Bien parent</span></th>}
              {showColumn('locataire') && <th className="w-[16%] px-3 py-2.5 text-left text-[0.62rem] font-bold uppercase tracking-wider text-slate-500"><span className="flex items-center gap-1.5"><CircleUser className="h-3.5 w-3.5 text-slate-400" /> Locataire</span></th>}
              {showColumn('loyer') && <th className={`${isSplitOpen ? 'w-[20%] px-3' : 'w-[12%] px-3'} py-2.5 text-right text-[0.62rem] font-bold uppercase tracking-wider text-slate-500`}><span className="flex items-center justify-end gap-1.5">Loyer</span></th>}
              {showColumn('statut') && <th className={`${isSplitOpen ? 'w-[20%] px-3 text-center' : 'w-[10%] px-3 text-left'} py-2.5 text-[0.62rem] font-bold uppercase tracking-wider text-slate-500`}>Statut</th>}
              {showColumn('reliquat') && <th className={`${isSplitOpen ? 'w-[20%] px-3' : 'w-[12%] px-3'} py-2.5 text-right text-[0.62rem] font-bold uppercase tracking-wider text-slate-500`}><span className="flex items-center justify-end gap-1.5"><AlertCircle className="h-3.5 w-3.5 text-slate-400" /> Reliquat</span></th>}
              {showActions && <th className="w-[4%] px-2 py-2.5"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => {
              const summary = summaries.get(unit.id);
              const property = unit.immeuble_id ? propertyById.get(unit.immeuble_id) : null;
              const visual = getUnitVisual(unit);
              const Icon = visual.icon;
              const selected = unit.id === selectedId;
              const reliquatAmount = summary?.reliquat ?? 0;
              return (
                <tr key={unit.id} className={`cursor-pointer border-b border-slate-100 transition-colors duration-150 outline-none hover:bg-[#f8fbf9] ${selected ? 'bg-emerald-50/50 relative z-0 after:absolute after:inset-y-0 after:left-0 after:w-[3px] after:bg-brand-500' : ''}`} onClick={() => onSelect(unit)}>
                  {showColumn('unite') && (
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-lg ring-1 ring-black/5 ${visual.bg} ${visual.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[0.78rem] leading-tight font-semibold text-slate-950">
                            {(() => {
                              const t = inferUnitType(unit);
                              const n = unit.nom || unit.numero || 'A1';
                              return normalizeText(n).includes(normalizeText(t)) ? n : `${t} ${n}`;
                            })()}
                          </p>
                          <p className="truncate text-[0.64rem] leading-snug font-medium text-slate-500 mt-[1px]">
                            {property?.nom ?? 'Aucun bien'} · {summary?.tenantLabel ?? 'Libre'}
                          </p>
                        </div>
                      </div>
                    </td>
                  )}
                  {showColumn('bien') && <td className="py-2.5 px-3 text-[0.75rem] text-slate-700 font-medium"><p className="truncate">{property?.nom ?? unit.immeubles?.nom ?? '-'}</p></td>}
                  {showColumn('locataire') && <td className="py-2.5 px-3 text-[0.75rem] text-slate-700 font-medium"><p className="truncate">{summary?.tenantLabel ?? 'Aucun locataire'}</p></td>}
                  {showColumn('loyer') && <td className="py-2.5 px-3 text-right text-[0.75rem] font-semibold text-slate-700"><MoneyText value={unit.loyer_base ?? 0} compact={false} /></td>}
                  {showColumn('statut') && <td className="py-2.5 px-3 text-center"><StatusBadge label={getUnitStatusLabel(unit, summary)} /></td>}
                  {showColumn('reliquat') && <td className={`py-2.5 px-3 text-right text-[0.75rem] ${reliquatAmount > 0 ? 'font-semibold text-red-600' : 'font-medium text-slate-400'}`}><MoneyText value={reliquatAmount} compact={false} /></td>}
                  {showActions && <td className="py-2.5 px-3 text-right">
                    <ChevronRight className="h-[10px] w-[10px] text-slate-300 inline-block" />
                  </td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="grid gap-2 p-2 lg:hidden">
          {units.map((unit) => {
            const summary = summaries.get(unit.id);
            const property = unit.immeuble_id ? propertyById.get(unit.immeuble_id) : null;
            const visual = getUnitVisual(unit);
            const statusLabel = getUnitStatusLabel(unit, summary);
            const reliquatAmount = summary?.reliquat ?? 0;
            
            return (
              <PremiumMobileCard
                key={unit.id}
                onClick={() => onSelect(unit)}
                eyebrow={property?.nom ?? 'Sans bien'}
                title={unit.nom}
                subtitle={summary?.tenantLabel ?? 'Aucun locataire'}
                icon={visual.icon}
                status={statusLabel}
                statusTone={statusLabel === 'Libre' ? 'emerald' : statusLabel === 'Louée' ? 'blue' : 'slate'}
                amount={unit.loyer_base ?? 0}
                amountLabel="Loyer"
                amountTone={(unit.loyer_base ?? 0) === 0 ? 'slate' : 'slate'}
                secondaryAmount={reliquatAmount > 0 ? reliquatAmount : undefined}
                secondaryAmountLabel={reliquatAmount > 0 ? "Reliquat" : undefined}
                secondaryAmountTone="red"
                emphasis="identity"
                meta={[]}
              />
            );
          })}
        </div>
    </PremiumTableSurface>
  );
}

function PropertyDrawer({
  property,
  summary,
  owner,
  isIndividualOwner,
  onEdit,
  onAddUnit,
  onArchive,
  onNavigate,
  onSelectUnit,
}: {
  property: PropertyRow;
  summary: PropertySummary;
  owner?: BailleurRow | PropertyRow['bailleurs'] | null;
  isIndividualOwner: boolean;
  onEdit: () => void;
  onAddUnit: () => void;
  onArchive: () => void;
  onNavigate: (to: string) => void;
  onSelectUnit: (unit: UnitRow) => void;
}) {
  const hasReliquat = summary.reliquats > 0;
  return (
    <>
      {/* Action principale */}
      <button type="button" onClick={onAddUnit} className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-50 border border-brand-200/60 p-2.5 text-[0.7rem] font-bold text-brand-900 shadow-sm transition hover:bg-brand-100">
        <Plus className="h-4 w-4" />
        Ajouter une unité
      </button>


      <div className="mb-3 grid grid-cols-3 gap-1.5 rounded-xl border border-emerald-950/10 bg-white p-2 shadow-sm">
        <CompactMetric label="Unités" value={String(summary.units.length)} tone="slate" />
        <CompactMetric label="Occupées" value={String(summary.occupiedUnits)} tone="slate" />
        <CompactMetric label="Libres" value={String(summary.units.length - summary.occupiedUnits)} tone="slate" />
        <div className="col-span-3 my-0.5 h-px bg-emerald-950/5" />
        <CompactMetric label="Occupation" value={`${summary.occupancyRate}%`} tone={summary.occupancyRate === 100 ? 'emerald' : 'slate'} />
        <CompactMetric label="Loyers" value={<MoneyText value={summary.expectedRent} compact={true} />} tone="slate" />
        <CompactMetric label="Reliquats" value={<MoneyText value={summary.reliquats} compact={true} />} tone={hasReliquat ? 'red' : 'slate'} />
      </div>

      {/* Informations */}
      <div className="mb-3">
        <CompactSection title="Informations" icon={MapPin}>
          <div className="flex flex-col divide-y divide-slate-100">
            <CompactLabelValue label="Adresse" value={property.adresse || 'À compléter'} />
            <CompactLabelValue label="Ville" value={property.ville || 'À compléter'} />
            {!isIndividualOwner && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[0.7rem] font-semibold text-slate-500">Bailleur</span>
                <button type="button" onClick={() => onNavigate('/bailleurs')} className="flex items-center gap-1 text-[0.7rem] font-bold text-brand-700 hover:text-brand-900 transition">
                  {ownerName(owner)}
                  <span className="text-[0.6rem]">&rarr;</span>
                </button>
              </div>
            )}
          </div>
        </CompactSection>
      </div>

      {/* Actions secondaires */}
      <div className="mb-3">
        <CompactSection title="Actions & Gestion" icon={Pencil}>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={onEdit} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[0.65rem] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
              <Pencil className="h-3.5 w-3.5 text-slate-400" />
              Modifier le bien
            </button>
            <button type="button" onClick={() => onNavigate('/paiements')} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[0.65rem] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
              <Wallet className="h-3.5 w-3.5 text-slate-400" />
              Paiements liés
            </button>
            <button type="button" onClick={() => onNavigate('/documents')} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[0.65rem] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 col-span-2">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              Documents associés
            </button>
          </div>
        </CompactSection>
      </div>

      {/* Onglets liés */}
      <div className="mb-4 overflow-hidden rounded-xl border border-emerald-950/10 bg-white shadow-sm">
        <DrawerTabs
          tabs={[
            {
              label: 'Unités',
              content: summary.units.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                  <p className="text-[0.75rem] font-medium text-slate-600 mb-3">Aucune unité enregistrée.</p>
                  <button type="button" onClick={onAddUnit} className="inline-flex h-7 items-center justify-center gap-1.5 rounded border border-brand-200 bg-brand-50 px-3 text-[0.65rem] font-bold text-brand-900 transition hover:bg-brand-100">Ajouter une unité</button>
                </div>
              ) : (
                <CompactList rows={summary.units.slice(0, 6).map((unit) => ({
                  icon: DoorOpen,
                  title: unit.nom,
                  subtitle: <span className="font-medium text-slate-500"><MoneyText value={unit.loyer_base ?? 0} compact={false} /> · {getUnitStatusLabel(unit)}</span>,
                  onClick: () => onSelectUnit(unit),
                }))} />
              ),
            },
            {
              label: 'Locations',
              content: summary.contracts.length === 0 ? (
                <SoftEmpty text="Aucune location." />
              ) : (
                <CompactList rows={summary.contracts.slice(0, 6).map((contract) => {
                  const unitOfContract = summary.units.find((u) => u.id === contract.unite_id);
                  return {
                    icon: ClipboardList,
                    title: formatPersonName(contract.locataires, 'Locataire'),
                    subtitle: <span className="font-medium text-slate-500">{unitOfContract?.nom || 'Unité'} · <MoneyText value={contract.loyer_mensuel ?? 0} compact={false} /> · {contract.statut === 'actif' ? 'Actif' : 'Historique'}</span>,
                    onClick: () => { window.location.hash = '#/occupants-baux'; },
                  };
                })} />
              ),
            },
            {
              label: 'Documents',
              content: summary.documents.length === 0 ? (
                <SoftEmpty text="Aucun document." />
              ) : (
                <CompactList rows={summary.documents.slice(0, 6).map((document) => ({
                  icon: FileText,
                  title: document.name || document.document_category || 'Document',
                  subtitle: <span className="font-medium text-slate-500">PDF · {formatDate(document.created_at)}</span>,
                  onClick: () => { window.location.hash = '#/documents'; },
                }))} />
              ),
            },
          ]}
        />
      </div>

      {/* Zone sensible */}
      <div className="pt-1 pb-2">
        <p className="mb-1.5 text-[0.6rem] font-black uppercase tracking-wider text-red-800 opacity-60">Archivage</p>
        <button
          type="button"
          onClick={onArchive}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 text-[0.65rem] font-bold text-red-700 transition hover:bg-red-50 hover:border-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Archiver ce bien
        </button>
      </div>
    </>
  );
}

function UnitDrawer({
  unit,
  summary,
  property,
  onEdit,
  onArchive,
  onNavigate,
}: {
  unit: UnitRow;
  summary: UnitSummary;
  property: PropertyRow | null;
  onEdit: () => void;
  onArchive: () => void;
  onNavigate: (to: string) => void;
}) {
  const status = getUnitStatusLabel(unit, summary);
  const hasReliquat = summary.reliquat > 0;
  return (
    <>
      {/* Résumé financier */}
      <div className="mb-3 rounded-xl border border-emerald-950/10 bg-[#fffdf8] p-3 shadow-sm">
        <h4 className="mb-1.5 text-[0.62rem] font-black uppercase tracking-[0.14em] text-slate-400">Résumé financier</h4>
        <div className="flex flex-col gap-1.5 text-[0.74rem] font-medium text-slate-800">
          <div className="flex justify-between">
            <span className="text-slate-500">Loyer mensuel</span>
            <MoneyText value={unit.loyer_base ?? 0} compact={false} />
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Reliquat</span>
            <span className={hasReliquat ? 'text-red-600 font-semibold' : ''}>
              <MoneyText value={summary.reliquat} compact={false} />
            </span>
          </div>
          {summary.latestPayment && (
            <div className="flex justify-between">
              <span className="text-slate-500">Dernier paiement</span>
              <span>{formatDate(summary.latestPayment.date_paiement)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 border-t border-emerald-950/5 mt-0.5">
            <span className="text-slate-500">Situation</span>
            <span className={summary.isLate ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>{status}</span>
          </div>
        </div>
      </div>

      {/* Occupation actuelle */}
      <div className="mb-3">
        <CompactSection title="Occupation actuelle" icon={CircleUser}>
          <div className="flex flex-col divide-y divide-slate-100">
            {summary.contract ? (
              <>
                <CompactLabelValue label="Locataire" value={formatPersonName(summary.contract.locataires, 'Locataire')} />
                {(() => {
                  const lData = summary.contract.locataires as unknown as Array<{ telephone?: string }> | { telephone?: string };
                  const phone = Array.isArray(lData) ? lData[0]?.telephone : lData?.telephone;
                  return phone ? <CompactLabelValue label="Téléphone" value={phone} /> : null;
                })()}
                <CompactLabelValue label="Bien parent" value={property?.nom || unit.immeubles?.nom || 'Aucun bien'} />
                <CompactLabelValue label="Bail" value={summary.contract.statut === 'actif' ? 'Location active' : 'Historique'} />
                {summary.contract.date_debut && (
                  <CompactLabelValue label="Entrée" value={formatDate(summary.contract.date_debut)} />
                )}
              </>
            ) : (
              <>
                <CompactLabelValue label="Bien parent" value={property?.nom || unit.immeubles?.nom || 'Aucun bien'} />
                <div className="py-2.5">
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Unité libre</span>
                </div>
              </>
            )}
          </div>
        </CompactSection>
      </div>

      {/* Paiements récents */}
      <div className="mb-3 overflow-hidden rounded-xl border border-emerald-950/10 bg-white shadow-sm">
        <DrawerTabs
          tabs={[
            {
              label: 'Paiements',
              content: summary.payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                  <p className="text-[0.75rem] font-medium text-slate-600 mb-3">Aucun paiement enregistré.</p>
                  <button type="button" onClick={() => onNavigate('/paiements')} className="inline-flex h-7 items-center justify-center gap-1.5 rounded border border-brand-200 bg-brand-50 px-3 text-[0.65rem] font-bold text-brand-900 transition hover:bg-brand-100">Encaisser un paiement</button>
                </div>
              ) : (
                <CompactList rows={summary.payments.slice(0, 4).map((payment) => ({
                  icon: Wallet,
                  title: <MoneyText value={payment.montant_total ?? 0} compact={false} />,
                  subtitle: <span className="font-medium text-slate-500">{formatDate(payment.date_paiement)} · {(payment.reliquat ?? 0) > 0 ? 'Partiel' : 'Payé'}</span>,
                  onClick: () => { window.location.hash = '#/paiements'; },
                }))} />
              ),
            },
            {
              label: 'Documents',
              content: summary.documents.length === 0 ? (
                <SoftEmpty text="Aucun document." />
              ) : (
                <CompactList rows={summary.documents.slice(0, 4).map((document) => ({
                  icon: FileText,
                  title: document.name || document.document_category || 'Document',
                  subtitle: <span className="font-medium text-slate-500">PDF · {formatDate(document.created_at)}</span>,
                  onClick: () => { window.location.hash = '#/documents'; },
                }))} />
              ),
            },
          ]}
        />
      </div>

      {/* Actions */}
      <div className="mb-4">
        <CompactSection title="Actions & Gestion" icon={Pencil}>
          <div className="grid grid-cols-2 gap-1.5">
            {summary.contract ? (
              <button type="button" onClick={() => onNavigate('/occupants-baux')} className="inline-flex h-8 col-span-2 items-center justify-center gap-1.5 rounded-lg border border-brand-200/60 bg-brand-50 px-2 text-[0.65rem] font-bold text-brand-900 shadow-sm transition hover:bg-brand-100">
                <ClipboardList className="h-3.5 w-3.5 text-brand-700" />
                Voir la location
              </button>
            ) : (
              <button type="button" onClick={() => onNavigate('/occupants-baux')} className="inline-flex h-8 col-span-2 items-center justify-center gap-1.5 rounded-lg border border-brand-200/60 bg-brand-50 px-2 text-[0.65rem] font-bold text-brand-900 shadow-sm transition hover:bg-brand-100">
                <Plus className="h-3.5 w-3.5 text-brand-700" />
                Créer une location
              </button>
            )}
            
            <button type="button" onClick={onEdit} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[0.65rem] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
              <Pencil className="h-3.5 w-3.5 text-slate-400" />
              Modifier l'unité
            </button>
            <button type="button" onClick={() => onNavigate('/documents')} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[0.65rem] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              Documents associés
            </button>
            {hasReliquat && (
              <button type="button" onClick={() => onNavigate('/paiements')} className="inline-flex h-8 col-span-2 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200/60 px-2 text-[0.65rem] font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100">
                <Wallet className="h-3.5 w-3.5 text-emerald-700" />
                Encaisser le reliquat
              </button>
            )}
          </div>
        </CompactSection>
      </div>

      {/* Zone sensible */}
      <div className="pt-1 pb-2">
        <p className="mb-1.5 text-[0.6rem] font-black uppercase tracking-wider text-red-800 opacity-60">Archivage</p>
        <button
          type="button"
          onClick={onArchive}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 text-[0.65rem] font-bold text-red-700 transition hover:bg-red-50 hover:border-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Archiver cette unité
        </button>
      </div>
    </>
  );
}



function CompactMetric({ label, value, tone = 'slate' }: { label: string; value: ReactNode; tone?: 'emerald' | 'red' | 'blue' | 'amber' | 'slate' }) {
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

function CompactSection({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: ReactNode }) {
  return (
    <section className="rounded-[14px] border border-emerald-950/10 bg-white/80 p-2.5 shadow-sm">
      <h3 className="mb-2 flex items-center gap-1.5 text-[0.6rem] font-black uppercase tracking-wider text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

function CompactLabelValue({ label, value }: { label: string; value: ReactNode | null | undefined }) {
  if (!value || value === '-') return null;
  return (
    <div className="flex min-w-0 flex-col gap-0.5 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-[0.42rem]">
      <span className="shrink-0 text-[0.72rem] font-medium text-slate-500 sm:text-[0.66rem]">{label}</span>
      <span className="min-w-0 max-w-full break-words text-left text-[0.74rem] font-semibold text-slate-800 sm:max-w-[62%] sm:truncate sm:text-right sm:text-[0.68rem]">
        {value}
      </span>
    </div>
  );
}

function DrawerTabs({ tabs }: { tabs: Array<{ label: string; content: ReactNode }> }) {
  const [active, setActive] = useState(0);
  return (
    <div className="rounded-xl border border-emerald-950/10 bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
      <div className="flex gap-1 overflow-x-auto scroll-smooth scrollbar-none rounded-lg bg-slate-50 p-1">
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            onClick={(e) => {
              setActive(index);
              e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[0.68rem] font-semibold transition ${active === index ? 'bg-white text-brand-900 shadow-sm ring-1 ring-emerald-950/10' : 'text-slate-500 hover:bg-white/80 hover:text-slate-800'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-2">{tabs[active]?.content}</div>
    </div>
  );
}

function CompactList({ rows }: { rows: Array<{ icon: LucideIcon; title: ReactNode; subtitle: ReactNode; onClick?: () => void }> }) {
  return (
    <div className="space-y-1.5">
      {rows.map((row, index) => {
        const Icon = row.icon;
        const isClickable = !!row.onClick;
        const Wrapper: React.ElementType = isClickable ? 'button' : 'div';
        const wrapperProps = isClickable
          ? {
              type: 'button',
              onClick: row.onClick,
              className: 'group flex w-full items-center justify-between gap-1.5 rounded-lg border border-emerald-950/10 bg-[#fffdf8] p-1.5 text-left shadow-[0_5px_12px_rgba(15,23,42,0.025)] transition hover:bg-emerald-50/50 cursor-pointer focus-visible:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500',
              'aria-label': `Ouvrir ${typeof row.title === 'string' ? row.title : 'les détails'}`,
            }
          : {
              className: 'flex items-center gap-1.5 rounded-lg border border-emerald-950/10 bg-[#fffdf8] p-1.5 shadow-[0_5px_12px_rgba(15,23,42,0.025)]',
            };

        return (
          <Wrapper key={`${typeof row.title === 'string' ? row.title : index}-${index}`} {...(wrapperProps as React.HTMLAttributes<HTMLElement> & { type?: 'button'; onClick?: () => void })}>
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-white text-brand-800 shadow-sm ring-1 ring-black/5">
                <Icon className="h-3 w-3" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[0.72rem] font-semibold text-slate-900">{row.title}</p>
                <p className="line-clamp-1 text-[0.62rem] font-medium text-slate-500">{row.subtitle}</p>
              </div>
            </div>
            {isClickable && (
              <ChevronRight className="mr-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
            )}
          </Wrapper>
        );
      })}
    </div>
  );
}

function SoftEmpty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-emerald-950/15 bg-[#fffaf1] px-3 py-2.5 text-[0.7rem] font-medium leading-4 text-slate-500">{text}</p>;
}


function PropertyWizardStepContext({ step }: { step: PropertyWizardStep }) {
  const copy: Record<PropertyWizardStep, { title?: string; body: string }> = {
    main: { body: 'Structurez un bien rattaché à un bailleur, ses unités et son potentiel locatif.' },
    address: { body: "L'adresse permettra de générer des baux précis et de situer le bien." },
    summary: { title: 'Validation finale', body: 'Cette fiche deviendra la base des unités, loyers, documents et rapports.' },
  };
  const current = copy[step];
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-[0.1rem] flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-emerald-950/10 bg-emerald-50/60 text-emerald-700 sm:h-[18px] sm:w-[18px]">
        <Building2 className="h-2.5 w-2.5" />
      </span>
      <div className="min-w-0">
        {current.title && <p className="text-[0.68rem] font-semibold leading-tight text-slate-900 sm:text-[0.64rem]">{current.title}</p>}
        <p className={`text-[0.68rem] font-medium leading-snug text-slate-600 sm:text-[0.62rem] ${current.title ? 'mt-0.5' : ''}`}>{current.body}</p>
      </div>
    </div>
  );
}

function PropertyWizardRail({ steps, currentStep }: { steps: WizardStep[]; currentStep: number }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5">
        <BrandMark size="sm" tone="dark" animated withTile={false} />
        <div>
          <p className="text-[0.5rem] font-bold uppercase tracking-[0.18em] text-amber-200/68">Portefeuille locatif</p>
          <p className="mt-0.5 text-[0.6rem] font-semibold text-white/[0.56]">Fiche bien guidée</p>
        </div>
      </div>
      <div className="mt-3">
        <p className="max-w-[11rem] text-[0.72rem] font-semibold leading-tight text-white/[0.86]">Structurez un bien rattaché à un bailleur, ses unités et son potentiel locatif.</p>
      </div>
      <div className="relative mt-3 space-y-1">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = index < currentStep;
          return (
            <div key={step.id} className={`flex min-h-[2.05rem] items-center gap-2 rounded-lg border px-2 py-[0.22rem] transition ${isActive ? 'border-amber-100/16 bg-white/[0.038] text-white shadow-[0_3px_8px_rgba(0,0,0,0.036)]' : isComplete ? 'border-white/10 bg-emerald-300/[0.038] text-emerald-50/[0.78]' : 'border-white/[0.075] bg-white/[0.018] text-emerald-50/[0.78]'}`}>
              <span className={`relative z-[1] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[0.5rem] text-[0.58rem] font-semibold ${isActive ? 'bg-[#fff3ce]/94 text-emerald-950 ring-1 ring-amber-100/55' : isComplete ? 'bg-emerald-300/[0.12] text-emerald-50' : 'bg-white/[0.1] text-emerald-50/[0.84]'}`}>
                {isComplete ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.47rem] font-bold uppercase tracking-[0.13em] opacity-75">Étape {index + 1}</span>
                <span className="block truncate text-[0.67rem] font-semibold">{step.label}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-xl border border-white/[0.055] bg-white/[0.026] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
        <p className="text-[0.47rem] font-semibold uppercase tracking-[0.16em] text-amber-100/[0.66]">SOURCE DE VÉRITÉ</p>
        <p className="mt-1 text-[0.58rem] font-medium leading-snug text-emerald-50/[0.56]">Bailleurs, unités, loyers, documents et rapports partiront de cette fiche.</p>
      </div>
    </div>
  );
}

function UnitWizardStepContext({ step }: { step: UnitWizardStep }) {
  const copy: Record<UnitWizardStep, { title?: string; body: string }> = {
    main: { body: "Ajoutez une unité exploitable à un bien existant. L'identité de l'unité doit être claire." },
    rent: { body: "Définissez le loyer cible et le statut actuel de l'unité." },
    summary: { title: 'Validation finale', body: "Cette fiche d'unité vous permettra d'initier des locations, des facturations et des quittances." },
  };
  const current = copy[step];
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-[0.1rem] flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-emerald-950/10 bg-emerald-50/60 text-emerald-700 sm:h-[18px] sm:w-[18px]">
        <DoorOpen className="h-2.5 w-2.5" />
      </span>
      <div className="min-w-0">
        {current.title && <p className="text-[0.68rem] font-semibold leading-tight text-slate-900 sm:text-[0.64rem]">{current.title}</p>}
        <p className={`text-[0.68rem] font-medium leading-snug text-slate-600 sm:text-[0.62rem] ${current.title ? 'mt-0.5' : ''}`}>{current.body}</p>
      </div>
    </div>
  );
}

function UnitWizardRail({ steps, currentStep }: { steps: WizardStep[]; currentStep: number }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5">
        <BrandMark size="sm" tone="dark" animated withTile={false} />
        <div>
          <p className="text-[0.5rem] font-bold uppercase tracking-[0.18em] text-amber-200/68">Portefeuille locatif</p>
          <p className="mt-0.5 text-[0.6rem] font-semibold text-white/[0.56]">Fiche unité guidée</p>
        </div>
      </div>
      <div className="mt-3">
        <p className="max-w-[11rem] text-[0.72rem] font-semibold leading-tight text-white/[0.86]">Ajoutez une unité exploitable à un bien existant.</p>
      </div>
      <div className="relative mt-3 space-y-1">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = index < currentStep;
          return (
            <div key={step.id} className={`flex min-h-[2.05rem] items-center gap-2 rounded-lg border px-2 py-[0.22rem] transition ${isActive ? 'border-amber-100/16 bg-white/[0.038] text-white shadow-[0_3px_8px_rgba(0,0,0,0.036)]' : isComplete ? 'border-white/10 bg-emerald-300/[0.038] text-emerald-50/[0.78]' : 'border-white/[0.075] bg-white/[0.018] text-emerald-50/[0.78]'}`}>
              <span className={`relative z-[1] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[0.5rem] text-[0.58rem] font-semibold ${isActive ? 'bg-[#fff3ce]/94 text-emerald-950 ring-1 ring-amber-100/55' : isComplete ? 'bg-emerald-300/[0.12] text-emerald-50' : 'bg-white/[0.1] text-emerald-50/[0.84]'}`}>
                {isComplete ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.47rem] font-bold uppercase tracking-[0.13em] opacity-75">Étape {index + 1}</span>
                <span className="block truncate text-[0.67rem] font-semibold">{step.label}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-xl border border-white/[0.055] bg-white/[0.026] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
        <p className="text-[0.47rem] font-semibold uppercase tracking-[0.16em] text-amber-100/[0.66]">SOURCE DE VÉRITÉ</p>
        <p className="mt-1 text-[0.58rem] font-medium leading-snug text-emerald-50/[0.56]">L'unité alimente les locations, paiements, documents et rapports.</p>
      </div>
    </div>
  );
}

function PropertyModal({
  isOpen,
  isIndividualOwner,
  editingProperty,
  form,
  owners,
  saving,
  wizardStep,
  onStepChange,
  onClose,
  onSubmit,
  onChange,
}: {
  isOpen: boolean;
  isIndividualOwner: boolean;
  editingProperty: PropertyRow | null;
  form: PropertyFormState;
  owners: BailleurRow[];
  saving: boolean;
  wizardStep: PropertyWizardStep;
  onStepChange: (step: PropertyWizardStep) => void;
  onClose: () => void;
  onSubmit: (event?: React.FormEvent) => void;
  onChange: React.Dispatch<React.SetStateAction<PropertyFormState>>;
}) {
  const toast = useToast();
  const propertyWizardStepIndex = Math.max(0, PROPERTY_WIZARD_STEPS.findIndex((step) => step.id === wizardStep));

  return (
    <WizardShell
      open={isOpen}
      onClose={onClose}
      size="compact"
      variant="workstation"
      tone="owner"
      eyebrow="SAMAY KËUR"
      title={editingProperty ? 'Modifier le bien' : isIndividualOwner ? 'Ajouter mon bien' : 'Nouveau bien'}
      description="Créez une fiche bien exploitable pour le portefeuille locatif."
      steps={PROPERTY_WIZARD_STEPS}
      currentStep={propertyWizardStepIndex}
      contentDescription="Créez une fiche bien exploitable pour le portefeuille locatif."
      stepContext={<PropertyWizardStepContext step={wizardStep} />}
      rail={
        <PropertyWizardRail
          steps={PROPERTY_WIZARD_STEPS}
          currentStep={propertyWizardStepIndex}
        />
      }
      primaryAction={
        <button
          type="button"
          onClick={() => {
            if (wizardStep === 'main') {
              if (!form.nom.trim()) { toast.error('Le nom du bien est requis.'); return; }
              if (!isIndividualOwner && !form.bailleur_id) { toast.error('Veuillez rattacher un bailleur.'); return; }
              onStepChange('address');
            } else if (wizardStep === 'address') {
              if (!form.adresse?.trim()) { toast.error('L\'adresse est requise.'); return; }
              if (!form.ville?.trim()) { toast.error('La ville est requise.'); return; }
              onStepChange('summary');
            } else {
              void onSubmit();
            }
          }}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#073728] via-[#062d23] to-[#041812] px-4 py-2 text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(6,45,35,0.18)] outline-none transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] hover:shadow-[0_14px_28px_rgba(6,45,35,0.22)] focus-visible:ring-2 focus-visible:ring-emerald-700/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {saving ? 'Traitement...' : wizardStep === 'summary' ? (editingProperty ? 'Mettre à jour' : 'Créer le bien') : 'Continuer'}
        </button>
      }
      secondaryAction={
        <button
          type="button"
          onClick={() => {
            if (wizardStep === 'summary') onStepChange('address');
            else if (wizardStep === 'address') onStepChange('main');
            else onClose();
          }}
          disabled={saving}
          className="w-full rounded-xl border border-emerald-950/10 bg-white/85 px-4 py-2 text-[11px] font-semibold text-slate-600 shadow-sm outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-emerald-700/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8] disabled:opacity-50 sm:w-auto"
        >
          {wizardStep === 'main' ? 'Annuler' : 'Retour'}
        </button>
      }
    >
      <div className="space-y-2.5 sm:space-y-3 lg:space-y-4">
        <div className={wizardStep === 'main' ? 'space-y-2.5 sm:space-y-2.5' : 'hidden'}>
          <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-slate-600 sm:text-[0.62rem]">Informations principales</h3>
          <Field label="Nom du bien *">
            <input required value={form.nom} onChange={(event) => onChange((current) => ({ ...current, nom: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 px-3 text-[0.93rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 autofill:bg-white autofill:shadow-[inset_0_0_0px_1000px_white] sm:h-9 sm:rounded-[0.56rem] sm:text-[0.8rem]" placeholder="Residence Keur Amitie" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <SmartCombobox density="compact"
                value={form.type_bien}
                options={[
                  { value: '', label: 'Choisir un type' },
                  ...PROPERTY_TYPES.map((type) => ({ value: type, label: type })),
                  { value: 'Autre', label: 'Autre' },
                ]}
                onChange={(next) => onChange((current) => ({ ...current, type_bien: next }))}
                placeholder="Choisir un type"
                searchPlaceholder="Immeuble, villa, boutique..."
              />
            </Field>
            {!isIndividualOwner && (
            <Field label="Bailleur rattaché *">
              <SmartCombobox density="compact"
                value={form.bailleur_id}
                options={[
                  { value: '', label: 'Sélectionner un bailleur' },
                  ...owners.map((owner) => ({
                    value: owner.id,
                    label: ownerName(owner),
                    subtitle: [owner.telephone, owner.email].filter(Boolean).join(' - ') || 'Propriétaire',
                    keywords: `${owner.nom ?? ''} ${owner.prenom ?? ''} ${owner.telephone ?? ''} ${owner.email ?? ''}`,
                  })),
                ]}
                onChange={(next) => onChange((current) => ({ ...current, bailleur_id: next }))}
                placeholder="Sélectionner un bailleur"
                searchPlaceholder="Rechercher un bailleur..."
                emptyLabel="Aucun bailleur disponible."
                emptyActionLabel="Aller aux bailleurs"
                onEmptyAction={() => {
                  onClose();
                  window.location.hash = '#/bailleurs';
                }}
              />
            </Field>
            )}
          </div>

          <div className="hidden rounded-xl border border-emerald-950/10 bg-white/42 px-3 py-2 shadow-[0_5px_14px_rgba(15,23,42,0.014)] sm:block">
            <div className="min-w-0">
              <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-emerald-800/70">
                Structure immobilière
              </p>
              <p className="mt-0.5 text-[0.68rem] font-medium leading-snug text-slate-600">
                Ce bien servira de conteneur pour vos unités locatives.
              </p>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[0.62rem] font-semibold text-slate-600">
              {['Unités', 'Contrats', 'Dépenses', 'Bilan'].map((item) => (
                <span key={item} className="rounded-full border border-emerald-950/10 bg-[#fffdf8]/80 px-2 py-1">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {isIndividualOwner && wizardStep === 'main' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            Votre profil propriétaire sera rattaché automatiquement à ce bien.
          </div>
        )}

        <div className={wizardStep === 'address' ? 'space-y-2.5 sm:space-y-2.5' : 'hidden'}>
          <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-slate-600 sm:text-[0.62rem]">Adresse et description</h3>
          <Field label="Adresse *">
            <input required value={form.adresse} onChange={(event) => onChange((current) => ({ ...current, adresse: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 px-3 text-[0.93rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 autofill:bg-white autofill:shadow-[inset_0_0_0px_1000px_white] sm:h-9 sm:rounded-[0.56rem] sm:text-[0.8rem]" placeholder="Rue, avenue, adresse principale" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quartier">
              <input value={form.quartier} onChange={(event) => onChange((current) => ({ ...current, quartier: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 px-3 text-[0.93rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 autofill:bg-white autofill:shadow-[inset_0_0_0px_1000px_white] sm:h-9 sm:rounded-[0.56rem] sm:text-[0.8rem]" placeholder="Ouakam, Medina..." />
            </Field>
            <Field label="Ville *">
              <input required value={form.ville} onChange={(event) => onChange((current) => ({ ...current, ville: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 px-3 text-[0.93rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 autofill:bg-white autofill:shadow-[inset_0_0_0px_1000px_white] sm:h-9 sm:rounded-[0.56rem] sm:text-[0.8rem]" placeholder="Dakar" />
            </Field>
          </div>
          <Field label="Description optionnelle">
            <textarea value={form.description} onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} rows={3} className="mt-1 min-h-[3rem] w-full resize-none rounded-xl border border-emerald-950/10 bg-[#fffdf8]/85 px-3 py-1.5 text-[0.88rem] font-medium text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.014)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 autofill:bg-white autofill:shadow-[inset_0_0_0px_1000px_white] sm:min-h-[3.75rem] sm:rounded-[0.7rem] sm:py-[0.5rem] sm:text-[0.8rem]" placeholder="Description du bien..." />
          </Field>
        </div>

        {wizardStep === 'summary' && (
          <div className="space-y-4">
            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
              <div className="overflow-hidden rounded-[0.95rem] border border-emerald-950/10 bg-[#fffdf8]/86 shadow-[0_8px_22px_rgba(15,23,42,0.024)]">
                <div className="flex items-center gap-2 border-b border-slate-100/80 px-3 py-2 sm:py-[0.55rem]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 sm:h-[22px] sm:w-[22px]">
                    <Building2 className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                  </span>
                  <h4 className="text-[0.76rem] font-semibold text-slate-800 sm:text-[0.7rem]">Identité & rattachement</h4>
                </div>
                <div className="min-w-0 divide-y divide-slate-100/80 px-3">
                  <CompactLabelValue label="Nom du bien" value={form.nom || 'Non défini'} />
                  <CompactLabelValue label="Type" value={form.type_bien || 'Autre'} />
                  <CompactLabelValue label="Bailleur rattaché" value={isIndividualOwner ? 'Moi' : ownerName(owners.find((owner) => owner.id === form.bailleur_id) ?? null)} />
                </div>
              </div>

              <div className="overflow-hidden rounded-[0.95rem] border border-emerald-950/10 bg-[#fffdf8]/86 shadow-[0_8px_22px_rgba(15,23,42,0.024)]">
                <div className="flex items-center gap-2 border-b border-slate-100/80 px-3 py-2 sm:py-[0.55rem]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 text-amber-700 sm:h-[22px] sm:w-[22px]">
                    <MapPin className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                  </span>
                  <h4 className="text-[0.76rem] font-semibold text-slate-800 sm:text-[0.7rem]">Adresse & exploitation</h4>
                </div>
                <div className="min-w-0 divide-y divide-slate-100/80 px-3">
                  <CompactLabelValue label="Adresse" value={form.adresse || 'Non définie'} />
                  {form.quartier && <CompactLabelValue label="Quartier" value={form.quartier} />}
                  <CompactLabelValue label="Ville" value={form.ville || 'Non définie'} />
                  <div className="flex items-center justify-between py-2 sm:py-1.5">
                    <span className="text-[0.78rem] font-medium text-slate-500 sm:text-[0.72rem]">Loyer</span>
                    <span className="text-right text-[0.78rem] font-bold text-slate-900 sm:text-[0.72rem]">Issu des unités</span>
                  </div>
                </div>
              </div>
            </div>
            {form.description.trim() && (
              <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3 text-[0.82rem] font-medium leading-relaxed text-slate-600 sm:rounded-2xl sm:p-4">
                {form.description.trim()}
              </div>
            )}
          </div>
        )}
      </div>
    </WizardShell>
  );
}

function UnitModal({
  isOpen,
  editingUnit,
  form,
  properties,
  saving,
  wizardStep,
  onStepChange,
  onClose,
  onSubmit,
  onChange,
}: {
  isOpen: boolean;
  editingUnit: UnitRow | null;
  form: UnitFormState;
  properties: PropertyRow[];
  saving: boolean;
  wizardStep: UnitWizardStep;
  onStepChange: (step: UnitWizardStep) => void;
  onClose: () => void;
  onSubmit: (event?: React.FormEvent) => void;
  onChange: React.Dispatch<React.SetStateAction<UnitFormState>>;
}) {
  const toast = useToast();
  const unitWizardStepIndex = Math.max(0, UNIT_WIZARD_STEPS.findIndex((step) => step.id === wizardStep));

  return (
    <WizardShell
      open={isOpen}
      onClose={onClose}
      size="compact"
      variant="workstation"
      tone="owner"
      eyebrow="SAMAY KËUR"
      title={editingUnit ? "Modifier l'unité" : 'Nouvelle unité locative'}
      description="Définissez les détails de cet espace pour pouvoir y associer un contrat de location."
      steps={UNIT_WIZARD_STEPS}
      currentStep={unitWizardStepIndex}
      contentDescription="Définissez les détails de cet espace pour pouvoir y associer un contrat de location."
      stepContext={<UnitWizardStepContext step={wizardStep} />}
      rail={
        <UnitWizardRail
          steps={UNIT_WIZARD_STEPS}
          currentStep={unitWizardStepIndex}
        />
      }
      primaryAction={
        <button
          type="button"
          onClick={() => {
            if (wizardStep === 'main') {
              if (!form.immeuble_id) { toast.error('Le bien parent est requis.'); return; }
              if (!form.nom.trim()) { toast.error('Le type d\'unité est requis.'); return; }
              onStepChange('rent');
            } else if (wizardStep === 'rent') {
              if (!form.loyer_base.trim() || Number(form.loyer_base) < 0) { toast.error('Le loyer mensuel est invalide.'); return; }
              onStepChange('summary');
            } else {
              void onSubmit();
            }
          }}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#0A3F30]/70 bg-gradient-to-br from-[#073728] via-[#062d23] to-[#041812] px-4 py-2 text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(6,45,35,0.18)] outline-none transition hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] hover:shadow-[0_14px_28px_rgba(6,45,35,0.22)] focus-visible:ring-2 focus-visible:ring-emerald-700/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {saving ? 'Traitement...' : wizardStep === 'summary' ? (editingUnit ? 'Mettre à jour' : 'Créer l\'unité') : 'Continuer'}
        </button>
      }
      secondaryAction={
        <button
          type="button"
          onClick={() => {
            if (wizardStep === 'summary') onStepChange('rent');
            else if (wizardStep === 'rent') onStepChange('main');
            else onClose();
          }}
          disabled={saving}
          className="w-full rounded-xl border border-emerald-950/10 bg-white/85 px-4 py-2 text-[11px] font-semibold text-slate-600 shadow-sm outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-emerald-700/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8] disabled:opacity-50 sm:w-auto"
        >
          {wizardStep === 'main' ? 'Annuler' : 'Retour'}
        </button>
      }
    >
      <div className="space-y-2.5 sm:space-y-3 lg:space-y-4">
        <div className={wizardStep === 'main' ? 'space-y-2.5 sm:space-y-2.5' : 'hidden'}>
          <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-slate-600 sm:text-[0.62rem]">Caractéristiques de l'unité</h3>
          <Field label="Bien parent *">
            <SmartCombobox density="compact"
              value={form.immeuble_id}
              options={[
                { value: '', label: 'Sélectionner un bien' },
                ...properties.map((property) => ({
                  value: property.id,
                  label: property.nom,
                  subtitle: [property.quartier, property.ville, property.adresse].filter(Boolean).join(' - ') || 'Bien',
                  keywords: `${property.nom} ${property.adresse ?? ''} ${property.quartier ?? ''} ${property.ville ?? ''}`,
                })),
              ]}
              onChange={(next) => onChange((current) => ({ ...current, immeuble_id: next }))}
              placeholder="Sélectionner un bien"
              searchPlaceholder="Rechercher un bien..."
              emptyLabel="Aucun bien disponible."
              emptyActionLabel="Créer un bien"
              onEmptyAction={() => {
                onClose();
                window.location.hash = '#/patrimoine?action=new';
              }}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type d'unité *">
              <SmartCombobox density="compact"
                value={form.nom}
                options={[
                  { value: '', label: 'Sélectionner un type' },
                  ...UNIT_TYPES.map((type) => ({ value: type, label: type })),
                ]}
                onChange={(next) => onChange((current) => ({ ...current, nom: next }))}
                placeholder="Sélectionner un type"
                searchPlaceholder="Appartement, studio, boutique..."
              />
          </Field>
          <Field label="Numéro / code">
            <input value={form.numero} onChange={(event) => onChange((current) => ({ ...current, numero: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 px-3 text-[0.93rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 autofill:bg-white autofill:shadow-[inset_0_0_0px_1000px_white] sm:h-9 sm:rounded-[0.56rem] sm:text-[0.8rem]" placeholder="A1, Boutique 3..." />
          </Field>
        </div>

          <div className="hidden rounded-xl border border-emerald-950/10 bg-white/42 px-3 py-2 shadow-[0_5px_14px_rgba(15,23,42,0.014)] sm:block">
            <div className="min-w-0">
              <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-emerald-800/70">
                Espace locatif
              </p>
              <p className="mt-0.5 text-[0.68rem] font-medium leading-snug text-slate-600">
                Cette unité sera rattachée à un bien et pourra être louée.
              </p>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[0.62rem] font-semibold text-slate-600">
              {['Locataires', 'Loyers', 'Quittances', 'États des lieux'].map((item) => (
                <span key={item} className="rounded-full border border-emerald-950/10 bg-[#fffdf8]/80 px-2 py-1">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className={wizardStep === 'rent' ? 'space-y-2.5 sm:space-y-2.5' : 'hidden'}>
        <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-slate-600 sm:text-[0.62rem]">Exploitation locative</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Loyer mensuel *">
            <input required type="number" min="0" value={form.loyer_base} onChange={(event) => onChange((current) => ({ ...current, loyer_base: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 px-3 text-[0.93rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 autofill:bg-white autofill:shadow-[inset_0_0_0px_1000px_white] sm:h-9 sm:rounded-[0.56rem] sm:text-[0.8rem]" placeholder="150000" />
          </Field>
          <Field label="Statut">
            <SmartCombobox density="compact"
              value={form.statut}
              options={UNIT_STATUSES.map((status) => ({ value: status.value, label: status.label }))}
              onChange={(next) => onChange((current) => ({ ...current, statut: next }))}
              placeholder="Statut de l'unité"
              searchPlaceholder="Libre, louée, maintenance..."
            />
          </Field>
        </div>
        <Field label="Étage (optionnel)">
          <input value={form.etage} onChange={(event) => onChange((current) => ({ ...current, etage: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-emerald-950/10 bg-[#fffdf8]/90 px-3 text-[0.93rem] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.012)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400/80 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 autofill:bg-white autofill:shadow-[inset_0_0_0px_1000px_white] sm:h-9 sm:rounded-[0.56rem] sm:text-[0.8rem]" placeholder="RDC, 1er..." />
        </Field>
        <Field label="Description optionnelle">
          <textarea value={form.description} onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} rows={2} className="mt-1 min-h-[3rem] w-full resize-none rounded-xl border border-emerald-950/10 bg-[#fffdf8]/85 px-3 py-1.5 text-[0.88rem] font-medium text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.014)] outline-none transition-all placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-600/30 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 autofill:bg-white autofill:shadow-[inset_0_0_0px_1000px_white] sm:min-h-[2.5rem] sm:rounded-[0.7rem] sm:py-[0.5rem] sm:text-[0.8rem]" placeholder="Détails de l'unité..." />
        </Field>

        <div className="hidden rounded-xl border border-emerald-950/10 bg-white/42 px-3 py-2 shadow-[0_5px_14px_rgba(15,23,42,0.014)] sm:block">
          <div className="min-w-0">
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-emerald-800/70">
              Exploitation locative
            </p>
            <p className="mt-0.5 text-[0.68rem] font-medium leading-snug text-slate-600">
              Ces informations permettront de préparer les locations, paiements et documents associés.
            </p>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[0.62rem] font-semibold text-slate-600">
            {['Bail', 'Paiements', 'Documents', 'Suivi'].map((item) => (
              <span key={item} className="rounded-full border border-emerald-950/10 bg-[#fffdf8]/80 px-2 py-1">
                {item}
              </span>
            ))}
          </div>
        </div>
        </div>

        {wizardStep === 'summary' && (
          <div className="space-y-4">
            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
              <div className="overflow-hidden rounded-[0.95rem] border border-emerald-950/10 bg-[#fffdf8]/86 shadow-[0_8px_22px_rgba(15,23,42,0.024)]">
                <div className="flex items-center gap-2 border-b border-slate-100/80 px-3 py-2 sm:py-[0.55rem]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 sm:h-[22px] sm:w-[22px]">
                    <DoorOpen className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                  </span>
                  <h4 className="text-[0.76rem] font-semibold text-slate-800 sm:text-[0.7rem]">Identité & rattachement</h4>
                </div>
                <div className="min-w-0 divide-y divide-slate-100/80 px-3">
                  <CompactLabelValue label="Nom" value={form.numero ? `${form.nom || 'Unité'} - ${form.numero}` : form.nom || 'Unité sans nom'} />
                  <CompactLabelValue label="Type" value={form.nom || 'Non défini'} />
                  <CompactLabelValue label="Code" value={form.numero || 'Généré automatiquement'} />
                  {form.etage && <CompactLabelValue label="Étage" value={form.etage} />}
                  <CompactLabelValue label="Bien parent" value={properties.find((property) => property.id === form.immeuble_id)?.nom ?? 'Non sélectionné'} />
                </div>
              </div>

              <div className="overflow-hidden rounded-[0.95rem] border border-emerald-950/10 bg-[#fffdf8]/86 shadow-[0_8px_22px_rgba(15,23,42,0.024)]">
                <div className="flex items-center gap-2 border-b border-slate-100/80 px-3 py-2 sm:py-[0.55rem]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 text-amber-700 sm:h-[22px] sm:w-[22px]">
                    <Wallet className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                  </span>
                  <h4 className="text-[0.76rem] font-semibold text-slate-800 sm:text-[0.7rem]">Exploitation locative</h4>
                </div>
                <div className="min-w-0 divide-y divide-slate-100/80 px-3">
                  <div className="flex items-center justify-between py-2 sm:py-1.5">
                    <span className="text-[0.78rem] font-medium text-slate-500 sm:text-[0.72rem]">Loyer</span>
                    <span className="text-right text-[0.78rem] font-bold text-slate-900 sm:text-[0.72rem]">{Number(form.loyer_base || 0).toLocaleString('fr-FR')} F CFA / mois</span>
                  </div>
                  <CompactLabelValue label="Statut" value={UNIT_STATUSES.find((status) => status.value === form.statut)?.label ?? form.statut} />
                </div>
              </div>
            </div>
            {form.description.trim() && (
              <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3 text-[0.82rem] font-medium leading-relaxed text-slate-600 sm:rounded-2xl sm:p-4">
                {form.description.trim()}
              </div>
            )}
          </div>
        )}
      </div>
    </WizardShell>
  );
}



function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">{label}</span>
      {children}
    </label>
  );
}

