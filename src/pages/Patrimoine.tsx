import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Banknote,
  Briefcase,
  Building2,
  ClipboardList,
  DoorOpen,
  FileText,
  FolderOpen,
  Home,
  KeyRound,
  Map as MapIcon,
  MapPin,
  MoreHorizontal,
  Pencil,
  Percent,
  Plus,
  Search,
  Store,
  Trash2,
  Users,
  Wallet,
  Warehouse,
  X,
  type LucideIcon,
} from 'lucide-react';

import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Modal } from '../components/ui/Modal';
import { ToastContainer } from '../components/ui/Toast';
import { ColumnPicker } from '../components/ui/ColumnPicker';
import { EmptyState } from '../components/ui/EmptyState';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useToast } from '../hooks/useToast';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { formatCurrency, formatDate } from '../lib/formatters';
import { formatPersonName } from '../lib/people';
import { supabase } from '../lib/supabase';
import { getOrCreateIndividualOwnerBailleur } from '../services/individualOwner';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../services/offlineReadCache';

type PatrimoineTab = 'biens' | 'unites';
type DrawerState = { type: 'bien'; id: string } | { type: 'unite'; id: string } | null;
type PropertyFilter = 'all' | 'with_reliquats' | 'without_units' | 'complete' | 'incomplete';
type UnitFilter = 'all' | 'libre' | 'loue' | 'maintenance' | 'late' | 'without_contract';
type DangerTarget = { type: 'bien'; id: string; name: string } | { type: 'unite'; id: string; name: string } | null;
type PropertyColumnKey = 'bien' | 'type' | 'adresse' | 'bailleur' | 'unites' | 'occupation' | 'loyer' | 'reliquats' | 'statut';
type UnitColumnKey = 'unite' | 'type' | 'bien' | 'locataire' | 'loyer' | 'statut' | 'reliquat' | 'bail';

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

const PROPERTY_COLUMN_KEYS: PropertyColumnKey[] = ['bien', 'type', 'adresse', 'bailleur', 'unites', 'occupation', 'loyer', 'reliquats', 'statut'];
const UNIT_COLUMN_KEYS: UnitColumnKey[] = ['unite', 'type', 'bien', 'locataire', 'loyer', 'statut', 'reliquat', 'bail'];
const PROPERTY_DRAWER_HIDDEN_COLUMNS = new Set<PropertyColumnKey>(['type', 'adresse', 'loyer', 'statut']);
const UNIT_DRAWER_HIDDEN_COLUMNS = new Set<UnitColumnKey>(['type', 'bail']);

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

function formatCompactCurrency(value: number) {
  const numeric = amount(value);
  if (Math.abs(numeric) >= 1_000_000) {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(numeric / 1_000_000)} M F CFA`;
  }
  return formatCurrency(numeric);
}

function CurrencyValue({ value, compact = false }: { value: number; compact?: boolean }) {
  const fullValue = formatCurrency(value);
  return (
    <span className="whitespace-nowrap tabular-nums" title={fullValue}>
      {compact ? formatCompactCurrency(value) : fullValue}
    </span>
  );
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
  if (normalized.includes('retard')) return 'bg-red-50 text-red-700 border-red-100';
  if (normalized.includes('lou')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (normalized.includes('maintenance')) return 'bg-amber-50 text-amber-700 border-amber-100';
  if (normalized.includes('libre')) return 'bg-sky-50 text-sky-700 border-sky-100';
  if (normalized.includes('reserv')) return 'bg-violet-50 text-violet-700 border-violet-100';
  return 'bg-slate-50 text-slate-700 border-slate-100';
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
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyRow | null>(null);
  const [editingUnit, setEditingUnit] = useState<UnitRow | null>(null);
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
            .select('id, name, document_category, entity_type, entity_id, bailleur_id, created_at')
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
        return document.bailleur_id === property.bailleur_id;
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
  const propertyFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous les biens', subtitle: 'Aucun filtre métier' },
      { value: 'with_reliquats', label: 'Avec reliquats', subtitle: 'Biens avec reste à recouvrer' },
      { value: 'without_units', label: 'Sans unité', subtitle: 'Biens à structurer' },
      { value: 'complete', label: 'Complets', subtitle: 'Adresse, ville et unités renseignées' },
      { value: 'incomplete', label: 'À compléter', subtitle: 'Informations manquantes' },
    ],
    [],
  );
  const unitFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Toutes les unités', subtitle: 'Aucun filtre métier' },
      { value: 'libre', label: 'Libres', subtitle: 'Disponibles pour une location' },
      { value: 'loue', label: 'Louées', subtitle: 'Avec bail actif ou occupation' },
      { value: 'maintenance', label: 'Maintenance', subtitle: 'Indisponibles temporairement' },
      { value: 'late', label: 'Avec reliquat', subtitle: 'Paiement incomplet détecté' },
      { value: 'without_contract', label: 'Sans bail', subtitle: 'À rattacher à une location' },
    ],
    [],
  );

  const openPropertyModal = useCallback(
    async (property?: PropertyRow | null) => {
      if (property) {
        setEditingProperty(property);
        setPropertyForm({
          nom: property.nom ?? '',
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

    if (params.get('action') !== 'new' || loading || propertyModalOpen) return;
    void openPropertyModal();
    params.delete('action');
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true },
    );
  }, [loading, location.pathname, location.search, navigate, openPropertyModal, propertyModalOpen]);

  const closePropertyModal = () => {
    setPropertyModalOpen(false);
    setEditingProperty(null);
    setPropertyForm(createPropertyForm());
  };

  const closeUnitModal = () => {
    setUnitModalOpen(false);
    setEditingUnit(null);
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

  const handlePropertySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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

  const handleUnitSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
    <div className="min-h-full overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(255,247,230,0.95),transparent_28rem),linear-gradient(180deg,#fffaf1,#f8f4ea_48%,#f7faf8)] px-4 py-4 sm:px-6 lg:px-7">
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <div className="mx-auto max-w-[118rem] space-y-4">
        <OfflineDataNotice
          cachedAt={cacheTimestamp}
          onRetry={loadData}
          message="Le patrimoine affiche le dernier état connu. La création et les modifications restent bloquées hors ligne pour protéger les rattachements."
        />

        <div className={`grid items-start gap-5 ${detailPanelOpen ? 'xl:grid-cols-[minmax(0,1fr)_34rem]' : 'grid-cols-1'}`}>
          <div className="min-w-0 space-y-4">
            <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-action-600">Portefeuille locatif</p>
            <h1 className="mt-1 font-serif text-3xl font-black tracking-tight text-brand-950 sm:text-4xl">Biens & patrimoine</h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{pageSubtitle}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void openPropertyModal()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-900 to-brand-950 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/15 transition hover:-translate-y-0.5 hover:shadow-emerald-950/25"
            >
              <Plus className="h-4 w-4" />
              {isIndividualOwner ? 'Ajouter mon bien' : 'Nouveau bien'}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('unites');
                openUnitModal(null, selectedProperty?.id ?? '');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-950/10 bg-[#fffdf8] px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50"
            >
              <DoorOpen className="h-4 w-4 text-brand-800" />
              Nouvelle unité
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-6">
          <MetricCard label={isIndividualOwner ? 'Biens' : 'Biens'} value={pageStats.properties} icon={Building2} tone="emerald" />
          <MetricCard label="Unités" value={pageStats.units} icon={DoorOpen} tone="blue" />
          <MetricCard label="Occupées" value={pageStats.occupied} icon={Home} tone="emerald" />
          <MetricCard label="Occupation" value={`${pageStats.occupancyRate}%`} icon={Percent} tone="amber" />
          <MetricCard label="Loyers attendus" value={<CurrencyValue value={pageStats.expectedRent} compact />} icon={Wallet} tone="green" wide />
          <MetricCard label="Reliquats" value={<CurrencyValue value={pageStats.reliquats} compact />} icon={AlertCircle} tone="red" wide />
        </section>

        <section className="rounded-2xl border border-emerald-950/10 bg-[#fffdf8]/95 p-3 shadow-[0_14px_40px_rgba(15,23,42,0.055)] ring-1 ring-white/80">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-1.5 overflow-x-auto rounded-xl bg-[#f7f1e7]/75 p-1">
              {[
                { id: 'biens' as const, label: 'Biens' },
                { id: 'unites' as const, label: 'Unités locatives' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-9 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition ${activeTab === tab.id
                      ? 'bg-brand-950 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-emerald-50 hover:text-brand-900'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row lg:max-w-4xl lg:flex-1 lg:justify-end">
              <div className="relative min-w-0 flex-1 lg:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={activeTab === 'biens' ? 'Rechercher nom, adresse, bailleur...' : 'Rechercher unité, bien, locataire...'}
                  className="h-10 w-full rounded-xl border border-emerald-950/10 bg-white/95 pl-9 pr-3 text-sm font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
              {activeTab === 'biens' ? (
                <>
                  {!isIndividualOwner && (
                    <SearchableSelect
                      value={ownerFilter}
                      options={ownerFilterOptions}
                      onChange={setOwnerFilter}
                      placeholder="Tous les bailleurs"
                      searchPlaceholder="Rechercher un bailleur..."
                      className="w-full sm:w-56"
                    />
                  )}
                  <SearchableSelect
                    value={propertyFilter}
                    options={propertyFilterOptions}
                    onChange={(next) => setPropertyFilter(next as PropertyFilter)}
                    placeholder="Tous les biens"
                    searchPlaceholder="Rechercher un filtre..."
                    className="w-full sm:w-52"
                  />
                  <ColumnPicker
                    columns={PROPERTY_COLUMN_KEYS.filter((key) => !isIndividualOwner || key !== 'bailleur').map((key) => ({ key, label: getPropertyColumnLabel(key), required: key === 'bien' }))}
                    visibility={propertyColumns.visibility}
                    onToggle={propertyColumns.toggle}
                    onSetAll={propertyColumns.setAll}
                  />
                </>
              ) : (
                <>
                  <SearchableSelect
                    value={unitFilter}
                    options={unitFilterOptions}
                    onChange={(next) => setUnitFilter(next as UnitFilter)}
                    placeholder="Toutes les unités"
                    searchPlaceholder="Rechercher un filtre..."
                    className="w-full sm:w-56"
                  />
                  <ColumnPicker
                    columns={UNIT_COLUMN_KEYS.map((key) => ({ key, label: getUnitColumnLabel(key), required: key === 'unite' }))}
                    visibility={unitColumns.visibility}
                    onToggle={unitColumns.toggle}
                    onSetAll={unitColumns.setAll}
                  />
                </>
              )}
            </div>
          </div>
        </section>

        <main className="min-w-0">
            {activeTab === 'biens' ? (
              <PropertiesTable
                properties={filteredProperties}
                summaries={summaries.property}
                ownerById={ownerById}
                isIndividualOwner={isIndividualOwner}
                isVisible={propertyColumns.isVisible}
                compact={detailPanelOpen}
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
                compact={detailPanelOpen}
                selectedId={selectedUnit?.id ?? null}
                onSelect={selectUnit}
                onCreate={() => openUnitModal()}
              />
            )}
          </main>
          </div>

          {drawer && (
            <aside className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#fffdf8] shadow-[0_24px_70px_rgba(15,23,42,0.16)] xl:sticky xl:top-4 xl:inset-auto xl:z-auto xl:h-[calc(100vh-2rem)] xl:w-full xl:rounded-3xl xl:border xl:border-emerald-950/10">
              <div className="absolute inset-0 -z-10 bg-slate-900/30 xl:hidden" onClick={() => setDrawer(null)} aria-hidden="true" />
              <div className="relative z-10 flex h-full flex-col overflow-y-auto bg-[#fffdf8]">
                {selectedProperty && selectedPropertySummary && (
                  <PropertyDrawer
                    property={selectedProperty}
                    summary={selectedPropertySummary}
                    owner={selectedProperty.bailleur_id ? ownerById.get(selectedProperty.bailleur_id) ?? selectedProperty.bailleurs : selectedProperty.bailleurs}
                    isIndividualOwner={isIndividualOwner}
                    onClose={() => setDrawer(null)}
                    onEdit={() => void openPropertyModal(selectedProperty)}
                    onAddUnit={() => {
                      setActiveTab('unites');
                      openUnitModal(null, selectedProperty.id);
                    }}
                    onArchive={() => setDangerTarget({ type: 'bien', id: selectedProperty.id, name: selectedProperty.nom })}
                    onNavigate={navigate}
                  />
                )}
                {selectedUnit && selectedUnitSummary && (
                  <UnitDrawer
                    unit={selectedUnit}
                    summary={selectedUnitSummary}
                    property={selectedUnit.immeuble_id ? propertyById.get(selectedUnit.immeuble_id) ?? null : null}
                    onClose={() => setDrawer(null)}
                    onEdit={() => openUnitModal(selectedUnit)}
                    onArchive={() => setDangerTarget({ type: 'unite', id: selectedUnit.id, name: selectedUnit.nom })}
                    onNavigate={navigate}
                  />
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      <PropertyModal
        isOpen={propertyModalOpen}
        isIndividualOwner={isIndividualOwner}
        editingProperty={editingProperty}
        form={propertyForm}
        owners={data.bailleurs}
        saving={saving}
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
    </div>
  );
}

function getPropertyColumnLabel(key: PropertyColumnKey) {
  const labels: Record<PropertyColumnKey, string> = {
    bien: 'Bien',
    type: 'Type',
    adresse: 'Adresse',
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
    type: 'Type',
    bien: 'Bien parent',
    locataire: 'Locataire',
    loyer: 'Loyer',
    statut: 'Statut',
    reliquat: 'Reliquat',
    bail: 'Bail actif',
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
    return `Vous allez archiver "${property?.nom ?? dangerTarget.name}". Relations détectées : ${units} unité(s), ${contracts} contrat(s), ${payments} paiement(s), ${documents} document(s). Les données restent conservées, mais le bien ne sera plus actif.`;
  }
  return `Vous allez archiver "${unit?.nom ?? dangerTarget.name}". Relations détectées : ${unitSummary?.contract ? '1 bail actif ou historique' : 'aucun bail actif'}, ${unitSummary?.payments.length ?? 0} paiement(s), ${unitSummary?.documents.length ?? 0} document(s).`;
}

function MetricCard({ label, value, icon: Icon, tone, wide = false }: { label: string; value: ReactNode; icon: LucideIcon; tone: 'emerald' | 'blue' | 'amber' | 'green' | 'red'; wide?: boolean }) {
  const tones = {
    emerald: { gradient: 'from-white to-emerald-50/65', text: 'text-brand-800', icon: 'bg-emerald-50 text-brand-800 ring-emerald-100' },
    blue: { gradient: 'from-white to-sky-50/65', text: 'text-sky-800', icon: 'bg-sky-50 text-sky-800 ring-sky-100' },
    amber: { gradient: 'from-white to-amber-50/65', text: 'text-amber-800', icon: 'bg-amber-50 text-amber-800 ring-amber-100' },
    green: { gradient: 'from-white to-lime-50/65', text: 'text-emerald-800', icon: 'bg-emerald-50 text-emerald-800 ring-emerald-100' },
    red: { gradient: 'from-white to-red-50/65', text: 'text-red-700', icon: 'bg-red-50 text-red-700 ring-red-100' },
  }[tone];

  return (
    <article className={`min-w-0 rounded-2xl border border-emerald-950/10 bg-gradient-to-br ${tones.gradient} p-3 shadow-[0_10px_28px_rgba(15,23,42,0.045)] ring-1 ring-white/70 ${wide ? 'xl:col-span-1' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`truncate text-[0.68rem] font-bold uppercase tracking-[0.12em] ${tones.text}`}>{label}</p>
          <p className="mt-1.5 truncate text-[1.1rem] font-extrabold tracking-tight text-slate-950 sm:text-[1.18rem]" title={typeof value === 'string' ? value : undefined}>{value}</p>
        </div>
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 ${tones.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ label }: { label: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.67rem] font-semibold ${statusBadgeClass(label)}`}>{label}</span>;
}

function PropertiesTable({
  properties,
  summaries,
  ownerById,
  isIndividualOwner,
  isVisible,
  compact,
  selectedId,
  onSelect,
  onCreate,
}: {
  properties: PropertyRow[];
  summaries: Map<string, PropertySummary>;
  ownerById: Map<string, BailleurRow>;
  isIndividualOwner: boolean;
  isVisible: (key: string) => boolean;
  compact: boolean;
  selectedId: string | null;
  onSelect: (property: PropertyRow) => void;
  onCreate: () => void;
}) {
  const showColumn = (key: PropertyColumnKey) => isVisible(key) && !(compact && PROPERTY_DRAWER_HIDDEN_COLUMNS.has(key));

  if (properties.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Aucun bien ajoute pour le moment."
        description="Ajoutez votre premier bien pour commencer à suivre vos unités, locataires et loyers."
        action={{ label: 'Ajouter un bien', onClick: onCreate }}
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#fffdf7]/95 shadow-[0_18px_48px_rgba(15,23,42,0.06)] ring-1 ring-white/80">
      <div className={`hidden md:block ${compact ? 'overflow-hidden' : 'overflow-x-auto'}`}>
        <table className={`${compact ? 'w-full table-fixed' : 'min-w-[920px]'} divide-y divide-slate-100`}>
          <thead className="bg-[#f8f3e8]/70 text-left text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">
            <tr>
              {showColumn('bien') && <th className={`${compact ? 'w-[32%] px-3' : 'px-4'} py-3`}>Bien</th>}
              {showColumn('type') && <th className="px-4 py-3">Type</th>}
              {showColumn('adresse') && <th className="px-4 py-3">Adresse</th>}
              {!isIndividualOwner && showColumn('bailleur') && <th className={`${compact ? 'w-[19%] px-3' : 'px-4'} py-3`}>Bailleur</th>}
              {showColumn('unites') && <th className={`${compact ? 'w-[10%] px-2' : 'px-4'} py-3 text-center`}>Unités</th>}
              {showColumn('occupation') && <th className={`${compact ? 'w-[18%] px-3' : 'px-4'} py-3`}>Occupation</th>}
              {showColumn('loyer') && <th className="px-4 py-3 text-right">Loyer attendu</th>}
              {showColumn('reliquats') && <th className={`${compact ? 'w-[15%] px-3' : 'px-4'} py-3 text-right`}>Reliquats</th>}
              {showColumn('statut') && <th className="px-4 py-3">Statut</th>}
              <th className={`${compact ? 'w-12 px-2' : 'px-4'} py-3 text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {properties.map((property) => {
              const summary = summaries.get(property.id);
              const owner = property.bailleur_id ? ownerById.get(property.bailleur_id) ?? property.bailleurs : property.bailleurs;
              const visual = getPropertyVisual(property);
              const Icon = visual.icon;
              const selected = property.id === selectedId;
              return (
                <tr key={property.id} className={`cursor-pointer transition ${selected ? 'bg-emerald-50/85 ring-1 ring-inset ring-emerald-200' : 'hover:bg-emerald-50/45'}`} onClick={() => onSelect(property)}>
                  {showColumn('bien') && (
                    <td className={`${compact ? 'px-3' : 'px-4'} py-2.5`}>
                      <div className="flex items-center gap-3">
                        <div className={`flex ${compact ? 'h-8 w-8 rounded-xl' : 'h-9 w-9 rounded-xl'} items-center justify-center ring-1 ring-black/5 ${visual.bg} ${visual.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{property.nom}</p>
                          <p className="truncate text-xs font-medium text-slate-500">{property.quartier || property.ville || 'Localisation à compléter'}</p>
                        </div>
                      </div>
                    </td>
                  )}
                  {showColumn('type') && <td className="px-4 py-2.5 text-sm font-medium text-slate-600">{inferPropertyType(property)}</td>}
                  {showColumn('adresse') && <td className="px-4 py-2.5 text-sm font-medium text-slate-600">{property.adresse || '-'}</td>}
                  {!isIndividualOwner && showColumn('bailleur') && <td className={`${compact ? 'px-3' : 'px-4'} py-2.5 text-sm font-medium text-slate-700`}><p className="truncate">{ownerName(owner)}</p></td>}
                  {showColumn('unites') && <td className={`${compact ? 'px-2' : 'px-4'} py-2.5 text-center text-sm font-semibold text-slate-900`}>{summary?.units.length ?? 0}</td>}
                  {showColumn('occupation') && (
                    <td className={`${compact ? 'px-3' : 'px-4'} py-2.5`}>
                      <div className="flex items-center gap-2">
                        <div className={`${compact ? 'w-14' : 'w-20'} h-2 overflow-hidden rounded-full bg-slate-100`}>
                          <div className="h-full rounded-full bg-brand-800" style={{ width: `${summary?.occupancyRate ?? 0}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600">{summary?.occupancyRate ?? 0}%</span>
                      </div>
                    </td>
                  )}
                  {showColumn('loyer') && <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(summary?.expectedRent ?? 0)}</td>}
                  {showColumn('reliquats') && <td className={`${compact ? 'px-3' : 'px-4'} whitespace-nowrap py-2.5 text-right text-sm font-semibold tabular-nums text-red-600`}>{formatCurrency(summary?.reliquats ?? 0)}</td>}
                  {showColumn('statut') && <td className="px-4 py-2.5"><StatusBadge label={(summary?.units.length ?? 0) > 0 ? 'Actif' : 'Sans unité'} /></td>}
                  <td className={`${compact ? 'px-2' : 'px-4'} py-2.5 text-right`}>
                    <button type="button" onClick={(event) => { event.stopPropagation(); onSelect(property); }} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-brand-900">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 md:hidden">
        {properties.map((property) => {
          const summary = summaries.get(property.id);
          const visual = getPropertyVisual(property);
          const Icon = visual.icon;
          return (
            <button key={property.id} type="button" onClick={() => onSelect(property)} className="rounded-2xl border border-emerald-950/10 bg-white p-3 text-left shadow-sm transition active:scale-[0.99]">
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${visual.bg} ${visual.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-950">{property.nom}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{property.adresse || property.quartier || property.ville || 'Adresse a completer'}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <MiniMetric label="Unités" value={summary?.units.length ?? 0} />
                    <MiniMetric label="Occupation" value={`${summary?.occupancyRate ?? 0}%`} />
                    <MiniMetric label="Loyer" value={formatCurrency(summary?.expectedRent ?? 0)} />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function UnitsTable({
  units,
  summaries,
  propertyById,
  isVisible,
  compact,
  selectedId,
  onSelect,
  onCreate,
}: {
  units: UnitRow[];
  summaries: Map<string, UnitSummary>;
  propertyById: Map<string, PropertyRow>;
  isVisible: (key: string) => boolean;
  compact: boolean;
  selectedId: string | null;
  onSelect: (unit: UnitRow) => void;
  onCreate: () => void;
}) {
  const showColumn = (key: UnitColumnKey) => isVisible(key) && !(compact && UNIT_DRAWER_HIDDEN_COLUMNS.has(key));

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
    <section className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#fffdf7]/95 shadow-[0_18px_48px_rgba(15,23,42,0.06)] ring-1 ring-white/80">
      <div className={`hidden md:block ${compact ? 'overflow-hidden' : 'overflow-x-auto'}`}>
        <table className={`${compact ? 'w-full table-fixed' : 'min-w-[900px]'} divide-y divide-slate-100`}>
          <thead className="bg-[#f8f3e8]/70 text-left text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">
            <tr>
              {showColumn('unite') && <th className={`${compact ? 'w-[23%] px-3' : 'px-4'} py-3`}>Unité</th>}
              {showColumn('type') && <th className="px-4 py-3">Type</th>}
              {showColumn('bien') && <th className={`${compact ? 'w-[20%] px-3' : 'px-4'} py-3`}>Bien parent</th>}
              {showColumn('locataire') && <th className={`${compact ? 'w-[19%] px-3' : 'px-4'} py-3`}>Locataire</th>}
              {showColumn('loyer') && <th className={`${compact ? 'w-[14%] px-3' : 'px-4'} py-3 text-right`}>Loyer</th>}
              {showColumn('statut') && <th className={`${compact ? 'w-[14%] px-3' : 'px-4'} py-3`}>Statut</th>}
              {showColumn('reliquat') && <th className={`${compact ? 'w-[14%] px-3' : 'px-4'} py-3 text-right`}>Reliquat</th>}
              {showColumn('bail') && <th className="px-4 py-3">Bail actif</th>}
              <th className={`${compact ? 'w-12 px-2' : 'px-4'} py-3 text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {units.map((unit) => {
              const summary = summaries.get(unit.id);
              const property = unit.immeuble_id ? propertyById.get(unit.immeuble_id) : null;
              const visual = getUnitVisual(unit);
              const Icon = visual.icon;
              const status = getUnitStatusLabel(unit, summary);
              const selected = unit.id === selectedId;
              return (
                <tr key={unit.id} className={`cursor-pointer transition ${selected ? 'bg-emerald-50/85 ring-1 ring-inset ring-emerald-200' : 'hover:bg-emerald-50/45'}`} onClick={() => onSelect(unit)}>
                  {showColumn('unite') && (
                    <td className={`${compact ? 'px-3' : 'px-4'} py-2.5`}>
                      <div className="flex items-center gap-3">
                        <div className={`flex ${compact ? 'h-8 w-8 rounded-xl' : 'h-9 w-9 rounded-xl'} items-center justify-center ring-1 ring-black/5 ${visual.bg} ${visual.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{unit.nom}</p>
                          <p className="truncate text-xs font-medium text-slate-500">{unit.numero || unit.etage || 'Référence à compléter'}</p>
                        </div>
                      </div>
                    </td>
                  )}
                  {showColumn('type') && <td className="px-4 py-2.5 text-sm font-medium text-slate-600">{inferUnitType(unit)}</td>}
                  {showColumn('bien') && <td className={`${compact ? 'px-3' : 'px-4'} py-2.5 text-sm font-medium text-slate-700`}><p className="truncate">{property?.nom ?? unit.immeubles?.nom ?? '-'}</p></td>}
                  {showColumn('locataire') && <td className={`${compact ? 'px-3' : 'px-4'} py-2.5 text-sm font-medium text-slate-600`}><p className="truncate">{summary?.tenantLabel ?? 'Aucun locataire'}</p></td>}
                  {showColumn('loyer') && <td className={`${compact ? 'px-3' : 'px-4'} whitespace-nowrap py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900`}>{formatCurrency(unit.loyer_base ?? 0)}</td>}
                  {showColumn('statut') && <td className={`${compact ? 'px-3' : 'px-4'} py-2.5`}><StatusBadge label={status} /></td>}
                  {showColumn('reliquat') && <td className={`${compact ? 'px-3' : 'px-4'} whitespace-nowrap py-2.5 text-right text-sm font-semibold tabular-nums text-red-600`}>{formatCurrency(summary?.reliquat ?? 0)}</td>}
                  {showColumn('bail') && <td className="px-4 py-2.5 text-sm font-medium text-slate-600">{summary?.contract ? 'Oui' : 'Non'}</td>}
                  <td className={`${compact ? 'px-2' : 'px-4'} py-2.5 text-right`}>
                    <button type="button" onClick={(event) => { event.stopPropagation(); onSelect(unit); }} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-brand-900">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 md:hidden">
        {units.map((unit) => {
          const summary = summaries.get(unit.id);
          const property = unit.immeuble_id ? propertyById.get(unit.immeuble_id) : null;
          const status = getUnitStatusLabel(unit, summary);
          const visual = getUnitVisual(unit);
          const Icon = visual.icon;
          return (
            <button key={unit.id} type="button" onClick={() => onSelect(unit)} className="rounded-2xl border border-emerald-950/10 bg-white p-3 text-left shadow-sm transition active:scale-[0.99]">
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${visual.bg} ${visual.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-slate-950">{unit.nom}</p>
                    <StatusBadge label={status} />
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500">{property?.nom ?? unit.immeubles?.nom ?? 'Bien parent à choisir'}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <MiniMetric label="Loyer" value={formatCurrency(unit.loyer_base ?? 0)} />
                    <MiniMetric label="Reliquat" value={formatCurrency(summary?.reliquat ?? 0)} />
                    <MiniMetric label="Bail" value={summary?.contract ? 'Oui' : 'Non'} />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-emerald-950/10 bg-[#fffdf8] px-2.5 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.025)]">
      <p className="text-[0.61rem] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-1 truncate whitespace-nowrap text-xs font-semibold tabular-nums text-slate-800">{value}</p>
    </div>
  );
}

function DrawerShell({ children }: { children: ReactNode }) {
  return (
      <section className="h-full max-h-[100dvh] overflow-hidden bg-[#fffdf8]/98 shadow-[0_24px_70px_rgba(15,23,42,0.09)] xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:rounded-3xl xl:border xl:border-emerald-950/10 xl:ring-1 xl:ring-white/80">
      <div className="h-full max-h-[100dvh] overflow-y-auto xl:max-h-[calc(100vh-2rem)]">
        {children}
      </div>
    </section>
  );
}

function DrawerHeader({ icon: Icon, iconClass, title, subtitle, onClose }: { icon: LucideIcon; iconClass: string; title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="border-b border-emerald-950/10 bg-gradient-to-br from-[#fffaf1] via-white to-emerald-50/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/5 ${iconClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-serif text-xl font-bold tracking-tight text-brand-950">{title}</h2>
            <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-500">{subtitle}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-900 hover:shadow-sm">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function PropertyDrawer({
  property,
  summary,
  owner,
  isIndividualOwner,
  onClose,
  onEdit,
  onAddUnit,
  onArchive,
  onNavigate,
}: {
  property: PropertyRow;
  summary: PropertySummary;
  owner?: BailleurRow | PropertyRow['bailleurs'] | null;
  isIndividualOwner: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAddUnit: () => void;
  onArchive: () => void;
  onNavigate: (to: string) => void;
}) {
  const visual = getPropertyVisual(property);
  return (
    <DrawerShell>
      <DrawerHeader
        icon={visual.icon}
        iconClass={`${visual.bg} ${visual.color}`}
        title={property.nom}
        subtitle={`${inferPropertyType(property)} - ${property.quartier || property.ville || 'Localisation à compléter'}`}
        onClose={onClose}
      />
      <div className="space-y-3.5 p-3.5 sm:p-4">
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Unités" value={summary.units.length} />
          <MiniMetric label="Occupées" value={summary.occupiedUnits} />
          <MiniMetric label="Libres" value={summary.freeUnits} />
          <MiniMetric label="Occupation" value={`${summary.occupancyRate}%`} />
          <MiniMetric label="Loyers attendus" value={formatCurrency(summary.expectedRent)} />
          <MiniMetric label="Reliquats" value={formatCurrency(summary.reliquats)} />
        </div>

        <InfoBlock title="Informations">
          <InfoLine icon={MapPin} label="Adresse" value={property.adresse || 'Adresse à compléter'} />
          <InfoLine icon={MapPin} label="Ville" value={property.ville || 'Ville à compléter'} />
          {!isIndividualOwner && <InfoLine icon={Users} label="Bailleur" value={ownerName(owner)} />}
        </InfoBlock>

        <div className="grid grid-cols-2 gap-2">
          <DrawerAction icon={Pencil} label="Modifier" onClick={onEdit} />
          <DrawerAction icon={DoorOpen} label="Ajouter une unité" onClick={onAddUnit} />
          <DrawerAction icon={Wallet} label="Paiements liés" onClick={() => onNavigate('/paiements')} />
          <DrawerAction icon={FolderOpen} label="Documents" onClick={() => onNavigate('/documents')} />
        </div>

        <DrawerTabs
          tabs={[
            {
              label: 'Unités',
              content: summary.units.length === 0 ? (
                <SoftEmpty text="Aucune unité enregistrée pour ce bien." />
              ) : (
                <CompactList rows={summary.units.slice(0, 6).map((unit) => ({
                  icon: DoorOpen,
                  title: unit.nom,
                  subtitle: `${formatCurrency(unit.loyer_base ?? 0)} - ${getUnitStatusLabel(unit)}`,
                }))} />
              ),
            },
            {
              label: 'Contrats',
              content: summary.contracts.length === 0 ? (
                <SoftEmpty text="Les contrats liés à ce bien apparaîtront ici." />
              ) : (
                <CompactList rows={summary.contracts.slice(0, 6).map((contract) => ({
                  icon: ClipboardList,
                  title: formatPersonName(contract.locataires, 'Locataire'),
                  subtitle: `${formatCurrency(contract.loyer_mensuel ?? 0)} - ${contract.statut ?? 'Bail'}`,
                }))} />
              ),
            },
            {
              label: 'Documents',
              content: summary.documents.length === 0 ? (
                <SoftEmpty text="Les documents liés à ce bien apparaîtront ici." />
              ) : (
                <CompactList rows={summary.documents.slice(0, 6).map((document) => ({
                  icon: FileText,
                  title: document.name || document.document_category || 'Document',
                  subtitle: formatDate(document.created_at),
                }))} />
              ),
            },
          ]}
        />

        <button type="button" onClick={onArchive} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-[#fffdf8] px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-50">
          <Trash2 className="h-4 w-4" />
          Archiver ce bien
        </button>
      </div>
    </DrawerShell>
  );
}

function UnitDrawer({
  unit,
  summary,
  property,
  onClose,
  onEdit,
  onArchive,
  onNavigate,
}: {
  unit: UnitRow;
  summary: UnitSummary;
  property: PropertyRow | null;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onNavigate: (to: string) => void;
}) {
  const visual = getUnitVisual(unit);
  const status = getUnitStatusLabel(unit, summary);
  return (
    <DrawerShell>
      <DrawerHeader icon={visual.icon} iconClass={`${visual.bg} ${visual.color}`} title={unit.nom} subtitle={`${inferUnitType(unit)} - ${property?.nom ?? unit.immeubles?.nom ?? 'Bien parent à choisir'}`} onClose={onClose} />
      <div className="space-y-3.5 p-3.5 sm:p-4">
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Loyer mensuel" value={formatCurrency(unit.loyer_base ?? 0)} />
          <MiniMetric label="Statut" value={status} />
          <MiniMetric label="Reliquat" value={formatCurrency(summary.reliquat)} />
          <MiniMetric label="Bail actif" value={summary.contract ? 'Oui' : 'Non'} />
        </div>

        <InfoBlock title="Occupation">
          <InfoLine icon={Users} label="Locataire" value={summary.tenantLabel} />
          <InfoLine icon={Building2} label="Bien parent" value={property?.nom ?? unit.immeubles?.nom ?? 'Non rattaché'} />
          <InfoLine icon={Banknote} label="Dernier paiement" value={summary.latestPayment ? formatDate(summary.latestPayment.date_paiement) : 'Aucun paiement'} />
        </InfoBlock>

        <div className="grid grid-cols-2 gap-2">
          <DrawerAction icon={Pencil} label="Modifier" onClick={onEdit} />
          <DrawerAction icon={Users} label={summary.contract ? 'Voir occupation' : 'Nouvelle occupation'} onClick={() => onNavigate('/occupants-baux')} />
          <DrawerAction icon={KeyRound} label={summary.contract ? 'Voir bail' : 'Créer bail'} onClick={() => onNavigate('/occupants-baux')} />
          <DrawerAction icon={Wallet} label="Paiement" onClick={() => onNavigate('/paiements')} />
        </div>

        <DrawerTabs
          tabs={[
            {
              label: 'Paiements',
              content: summary.payments.length === 0 ? (
                <SoftEmpty text="Les paiements de cette unité apparaîtront ici." />
              ) : (
                <CompactList rows={summary.payments.slice(0, 6).map((payment) => ({
                  icon: Wallet,
                  title: formatCurrency(payment.montant_total ?? 0),
                  subtitle: `${payment.mois_concerne ?? 'Mois'} - ${formatDate(payment.date_paiement)}`,
                }))} />
              ),
            },
            {
              label: 'Documents',
              content: summary.documents.length === 0 ? (
                <SoftEmpty text="Les documents liés à cette unité apparaîtront ici." />
              ) : (
                <CompactList rows={summary.documents.slice(0, 6).map((document) => ({
                  icon: FileText,
                  title: document.name || document.document_category || 'Document',
                  subtitle: formatDate(document.created_at),
                }))} />
              ),
            },
          ]}
        />

        <button type="button" onClick={onArchive} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-[#fffdf8] px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-50">
          <Trash2 className="h-4 w-4" />
          Archiver cette unité
        </button>
      </div>
    </DrawerShell>
  );
}

function DrawerAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-12 flex-col items-center justify-center gap-1.5 rounded-xl border border-emerald-950/10 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.035)] transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-brand-900">
      <Icon className="h-4 w-4 text-slate-400" />
      {label}
    </button>
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

function DrawerTabs({ tabs }: { tabs: Array<{ label: string; content: ReactNode }> }) {
  const [active, setActive] = useState(0);
  return (
    <div className="rounded-2xl border border-emerald-950/10 bg-white p-2.5 shadow-[0_10px_26px_rgba(15,23,42,0.035)]">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1">
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActive(index)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${active === index ? 'bg-white text-brand-900 shadow-sm ring-1 ring-emerald-950/10' : 'text-slate-500 hover:bg-white/80 hover:text-slate-800'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-3">{tabs[active]?.content}</div>
    </div>
  );
}

function CompactList({ rows }: { rows: Array<{ icon: LucideIcon; title: string; subtitle: string }> }) {
  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const Icon = row.icon;
        return (
          <div key={`${row.title}-${index}`} className="flex items-center gap-2 rounded-xl border border-emerald-950/10 bg-[#fffdf8] p-2 shadow-[0_6px_16px_rgba(15,23,42,0.025)]">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white text-brand-800 shadow-sm ring-1 ring-black/5">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{row.title}</p>
              <p className="line-clamp-2 text-xs font-medium text-slate-500">{row.subtitle}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SoftEmpty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-emerald-950/15 bg-[#fffaf1] px-4 py-4 text-xs font-medium leading-5 text-slate-500">{text}</p>;
}

function PropertyModal({
  isOpen,
  isIndividualOwner,
  editingProperty,
  form,
  owners,
  saving,
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
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onChange: React.Dispatch<React.SetStateAction<PropertyFormState>>;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingProperty ? 'Modifier le bien' : isIndividualOwner ? 'Ajouter mon bien' : 'Nouveau bien'}>
      <form onSubmit={onSubmit} className="space-y-3.5">
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-900 sm:text-sm">Informations principales</h3>
          <Field label="Nom du bien *">
            <input required value={form.nom} onChange={(event) => onChange((current) => ({ ...current, nom: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" placeholder="Residence Keur Amitie" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <select value={inferTypeFromName(form.nom, PROPERTY_TYPES)} onChange={(event) => onChange((current) => ({ ...current, nom: event.target.value === 'Autre' ? current.nom : event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100">
                <option value="">Choisir un type</option>
                {PROPERTY_TYPES.map((type) => <option key={type}>{type}</option>)}
                <option>Autre</option>
              </select>
            </Field>
            {!isIndividualOwner && (
            <Field label="Bailleur rattaché *">
              <SearchableSelect
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
              />
            </Field>
            )}
          </div>
        </div>

        {isIndividualOwner && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            Votre profil propriétaire sera rattaché automatiquement à ce bien.
          </div>
        )}
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-900 sm:text-sm">Adresse et description</h3>
          <Field label="Adresse *">
            <input required value={form.adresse} onChange={(event) => onChange((current) => ({ ...current, adresse: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" placeholder="Rue, avenue, adresse principale" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quartier">
              <input value={form.quartier} onChange={(event) => onChange((current) => ({ ...current, quartier: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" placeholder="Ouakam, Medina..." />
            </Field>
            <Field label="Ville *">
              <input required value={form.ville} onChange={(event) => onChange((current) => ({ ...current, ville: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" placeholder="Dakar" />
            </Field>
          </div>
          <Field label="Description optionnelle">
            <textarea value={form.description} onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} rows={3} className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" placeholder="Description du bien..." />
          </Field>
        </div>
        <ModalActions onClose={onClose} saving={saving} submitLabel={editingProperty ? 'Mettre à jour' : 'Créer le bien'} />
      </form>
    </Modal>
  );
}

function UnitModal({
  isOpen,
  editingUnit,
  form,
  properties,
  saving,
  onClose,
  onSubmit,
  onChange,
}: {
  isOpen: boolean;
  editingUnit: UnitRow | null;
  form: UnitFormState;
  properties: PropertyRow[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onChange: React.Dispatch<React.SetStateAction<UnitFormState>>;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingUnit ? "Modifier l'unité" : 'Nouvelle unité locative'}>
      <form onSubmit={onSubmit} className="space-y-3.5">
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-900 sm:text-sm">Caractéristiques de l'unité</h3>
          <Field label="Bien parent *">
            <SearchableSelect
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
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type / nom de l'unité *">
              <select required value={form.nom} onChange={(event) => onChange((current) => ({ ...current, nom: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100">
                <option value="">Sélectionner</option>
              {UNIT_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Numéro / code">
            <input value={form.numero} onChange={(event) => onChange((current) => ({ ...current, numero: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" placeholder="A1, Boutique 3..." />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Étage">
            <input value={form.etage} onChange={(event) => onChange((current) => ({ ...current, etage: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" placeholder="RDC, 1er..." />
          </Field>
          <Field label="Loyer mensuel *">
            <input required type="number" min="0" value={form.loyer_base} onChange={(event) => onChange((current) => ({ ...current, loyer_base: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" placeholder="150000" />
          </Field>
        </div>
        <Field label="Statut">
          <select value={form.statut} onChange={(event) => onChange((current) => ({ ...current, statut: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100">
            {UNIT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </Field>
        <Field label="Description optionnelle">
          <textarea value={form.description} onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} rows={3} className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" placeholder="Détails de l'unité..." />
        </Field>
        </div>
        <ModalActions onClose={onClose} saving={saving} submitLabel={editingUnit ? 'Mettre à jour' : "Créer l'unité"} />
      </form>
    </Modal>
  );
}

function inferTypeFromName(name: string, options: string[]) {
  const normalized = normalizeText(name);
  return options.find((option) => normalized === normalizeText(option)) ?? '';
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function ModalActions({ onClose, saving, submitLabel }: { onClose: () => void; saving: boolean; submitLabel: string }) {
  return (
    <div className="mt-8 flex flex-col-reverse justify-end gap-3 sm:flex-row">
      <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
        Annuler
      </button>
      <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/10 transition hover:bg-emerald-700 disabled:opacity-50">
        {saving ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Enregistrement...
          </>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );
}
