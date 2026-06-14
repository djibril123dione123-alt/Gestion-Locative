import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Banknote,
  Building2,
  CalendarClock,
  Camera,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  FolderOpen,
  Home,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { applyCfaSettlementTolerance } from '../../lib/cfaSettlement';
import { formatCurrency, formatDate, formatSenegalPhone, formatSenegalPhoneInput, normalizeSenegalPhone } from '../../lib/formatters';
import { formatPersonName } from '../../lib/people';
import { invalidateOperationalCaches, notifyDataChanged, readWithCache } from '../../services/offlineReadCache';
import { getOrCreateIndividualOwnerBailleur, type OwnerBailleur } from '../../services/individualOwner';
import {
  addFooter,
  drawDocumentHeader,
  drawLegalVerificationFooter,
  drawPageBorder,
  drawTotalsBlock,
  getAutoTableTheme,
  saveGeneratedPdf,
} from '../../lib/pdf';
import type { AgencySettings } from '../../types';
import { useToast } from '../../hooks/useToast';
import { OfflineDataNotice } from '../ui/OfflineDataNotice';
import { PageSkeleton } from '../ui/Skeleton';
import { PremiumButton } from '../ui/PremiumButton';
import { MetricCard } from '../ui/MetricCard';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { ToastContainer } from '../ui/Toast';
import { MoneyText } from '../ui/MoneyText';

type OwnerNavigate = (page: string) => void;

interface OwnerWorkspaceProps {
  onNavigate?: OwnerNavigate;
  onStartSetupWizard?: () => void;
}

interface OwnerProperty {
  id: string;
  nom: string;
  adresse?: string | null;
  quartier?: string | null;
  ville?: string | null;
  nombre_unites?: number | null;
  actif?: boolean | null;
  created_at?: string | null;
}

interface OwnerUnit {
  id: string;
  nom: string;
  immeuble_id: string | null;
  loyer_base: number | null;
  statut: string | null;
  actif?: boolean | null;
}

interface OwnerContract {
  id: string;
  unite_id: string | null;
  loyer_mensuel: number | null;
  statut: string | null;
  date_debut: string | null;
  locataires?: { nom?: string | null; prenom?: string | null } | null;
  unites?: { nom?: string | null; immeubles?: { nom?: string | null } | null } | null;
}

interface OwnerPayment {
  id: string;
  contrat_id?: string | null;
  montant_total: number | null;
  part_agence?: number | null;
  part_bailleur?: number | null;
  statut: string | null;
  mois_concerne: string | null;
  date_paiement: string | null;
  created_at: string | null;
  contrats?: {
    loyer_mensuel?: number | null;
    locataires?: { nom?: string | null; prenom?: string | null } | null;
    unites?: { nom?: string | null; immeubles?: { nom?: string | null } | null } | null;
  } | null;
}

interface OwnerDocument {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  createdAt: string | null;
}

interface OwnerExpense {
  id: string;
  montant: number | null;
  date_depense: string | null;
}

interface OwnerSettings {
  nom_agence?: string | null;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
  logo_url?: string | null;
}

interface OwnerWorkspaceData {
  settings: OwnerSettings | null;
  ownerBailleur: OwnerBailleur | null;
  properties: OwnerProperty[];
  units: OwnerUnit[];
  contracts: OwnerContract[];
  payments: OwnerPayment[];
  expenses: OwnerExpense[];
  documents: OwnerDocument[];
}

const EMPTY_DATA: OwnerWorkspaceData = {
  settings: null,
  ownerBailleur: null,
  properties: [],
  units: [],
  contracts: [],
  payments: [],
  expenses: [],
  documents: [],
};

const PROPERTY_ACCENTS = [
  { bg: 'from-emerald-50 to-emerald-100/70', icon: Building2, color: 'text-emerald-800', ring: 'ring-emerald-200' },
  { bg: 'from-amber-50 to-orange-100/70', icon: Home, color: 'text-amber-800', ring: 'ring-amber-200' },
  { bg: 'from-sky-50 to-cyan-100/70', icon: Store, color: 'text-sky-800', ring: 'ring-sky-200' },
  { bg: 'from-violet-50 to-purple-100/70', icon: Landmark, color: 'text-violet-800', ring: 'ring-violet-200' },
];

const AGENCY_ASSETS_BUCKET = 'agency-assets';
const MAX_OWNER_AVATAR_SIZE = 5 * 1024 * 1024;

function getImageExtension(file: File) {
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/svg+xml') return 'svg';
  return 'png';
}

function getCurrentMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function getMonthKey(value?: string | null) {
  return value ? value.slice(0, 7) : '';
}

function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonthLabel(period: string) {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

function createOwnerReportReference(period: string) {
  const compactPeriod = period.replace('-', '');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RPR-${compactPeriod}-${suffix}`;
}

function parseAmount(value: number | string | null | undefined) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function isOccupiedStatus(status?: string | null) {
  const value = String(status ?? '').toLowerCase();
  return value === 'occupee' || value === 'occupée' || value === 'louee' || value === 'louée' || value === 'occupe';
}

function isActiveStatus(status?: string | null) {
  return String(status ?? '').toLowerCase() === 'actif';
}

function paymentOwnerNet(payment: OwnerPayment) {
  return parseAmount(payment.part_bailleur ?? (parseAmount(payment.montant_total) - parseAmount(payment.part_agence)));
}

function getDocumentKind(type: string) {
  const value = type.toLowerCase();
  if (value.includes('rapport')) return { label: 'PDF', tone: 'text-red-700 bg-red-50 border-red-100' };
  if (value.includes('quittance') || value.includes('facture')) return { label: 'DOC', tone: 'text-blue-700 bg-blue-50 border-blue-100' };
  if (value.includes('contrat') || value.includes('mandat')) return { label: 'PDF', tone: 'text-orange-700 bg-orange-50 border-orange-100' };
  return { label: 'GED', tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
}

export function OwnerWorkspace({ onNavigate }: OwnerWorkspaceProps) {
  const { profile, user, agency, accountProfile } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<OwnerWorkspaceData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [reportPeriod, setReportPeriod] = useState(getCurrentMonthKey());
  const [generatingReport, setGeneratingReport] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState<string | null>(null);
  const [removeProfileAvatar, setRemoveProfileAvatar] = useState(false);
  const [profileForm, setProfileForm] = useState({
    prenom: '',
    nom: '',
    telephone: '',
    email: '',
    adresse: '',
  });

  const loadOwnerWorkspace = useCallback(async () => {
    if (!profile?.agency_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const scopedAgencyId = profile.agency_id;
      const result = await readWithCache<OwnerWorkspaceData>(
        { agencyId: scopedAgencyId, userId: profile.id },
        'owner-workspace-dashboard',
        async () => {
          const [settingsRes, ownerBailleur, propertiesRes, unitsRes, contractsRes, paymentsRes, expensesRes, docsRes, registryRes] = await Promise.all([
            supabase
              .from('agency_settings')
              .select('nom_agence, telephone, email, adresse, logo_url')
              .eq('agency_id', scopedAgencyId)
              .maybeSingle(),
            getOrCreateIndividualOwnerBailleur({
              profile,
              agency,
              accountProfile,
            }),
            supabase
              .from('immeubles')
              .select('id, nom, adresse, quartier, ville, nombre_unites, actif, created_at')
              .eq('agency_id', scopedAgencyId)
              .eq('actif', true)
              .order('created_at', { ascending: false }),
            supabase
              .from('unites')
              .select('id, nom, immeuble_id, loyer_base, statut, actif')
              .eq('agency_id', scopedAgencyId)
              .eq('actif', true),
            supabase
              .from('contrats')
              .select('id, unite_id, loyer_mensuel, statut, date_debut, locataires(nom, prenom), unites(nom, immeubles(nom))')
              .eq('agency_id', scopedAgencyId)
              .order('created_at', { ascending: false }),
            supabase
              .from('paiements')
              .select('id, contrat_id, montant_total, part_agence, part_bailleur, statut, mois_concerne, date_paiement, created_at, contrats(loyer_mensuel, locataires(nom, prenom), unites(nom, immeubles(nom)))')
              .eq('agency_id', scopedAgencyId)
              .order('date_paiement', { ascending: false })
              .limit(120),
            supabase
              .from('depenses')
              .select('id, montant, date_depense')
              .eq('agency_id', scopedAgencyId)
              .order('date_depense', { ascending: false })
              .limit(80),
            supabase
              .from('documents')
              .select('id, name, document_category, file_type, created_at')
              .eq('agency_id', scopedAgencyId)
              .is('deleted_at', null)
              .order('created_at', { ascending: false })
              .limit(8),
            supabase
              .from('document_registry')
              .select('id, document_type, reference, period, generated_at, metadata')
              .eq('agency_id', scopedAgencyId)
              .neq('status', 'deleted')
              .order('generated_at', { ascending: false })
              .limit(12),
          ]);

          if (settingsRes.error) throw settingsRes.error;
          if (propertiesRes.error) throw propertiesRes.error;
          if (unitsRes.error) throw unitsRes.error;
          if (contractsRes.error) throw contractsRes.error;
          if (paymentsRes.error) throw paymentsRes.error;
          if (expensesRes.error) throw expensesRes.error;
          if (docsRes.error) throw docsRes.error;
          if (registryRes.error) throw registryRes.error;

          const uploadedDocs = ((docsRes.data ?? []) as Array<{
            id: string;
            name: string;
            document_category?: string | null;
            file_type?: string | null;
            created_at?: string | null;
          }>).map((row) => ({
            id: row.id,
            title: row.name,
            subtitle: row.document_category ?? 'Document',
            type: row.file_type ?? row.document_category ?? 'document',
            createdAt: row.created_at ?? null,
          }));

          const generatedDocs = ((registryRes.data ?? []) as Array<{
            id: string;
            document_type: string;
            reference: string;
            period?: string | null;
            generated_at?: string | null;
            metadata?: { file_name?: string } | null;
          }>).map((row) => ({
            id: row.id,
            title: row.metadata?.file_name ?? row.reference,
            subtitle: row.period ? `${row.document_type.replace(/_/g, ' ')} · ${row.period}` : row.document_type.replace(/_/g, ' '),
            type: row.document_type,
            createdAt: row.generated_at ?? null,
          }));

          const documents = [...uploadedDocs, ...generatedDocs]
            .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
            .slice(0, 6);

          return {
            settings: (settingsRes.data as OwnerSettings | null) ?? null,
            ownerBailleur,
            properties: (propertiesRes.data ?? []) as OwnerProperty[],
            units: (unitsRes.data ?? []) as OwnerUnit[],
            contracts: (contractsRes.data ?? []) as unknown as OwnerContract[],
            payments: (paymentsRes.data ?? []) as unknown as OwnerPayment[],
            expenses: (expensesRes.data ?? []) as OwnerExpense[],
            documents,
          };
        },
        { timeoutMs: 8_000 },
      );

      setData(result.data);
      setCacheTimestamp(result.source === 'cache' ? result.timestamp : null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger votre espace propriétaire.');
    } finally {
      setLoading(false);
    }
  }, [accountProfile, agency, profile]);

  useEffect(() => {
    void loadOwnerWorkspace();
  }, [loadOwnerWorkspace]);

  useEffect(() => {
    const handler = (event: Event) => {
      const domains = (event as CustomEvent<{ domains?: string[] }>).detail?.domains ?? [];
      if (
        domains.length === 0 ||
        domains.some((domain) => ['dashboard', 'patrimoine', 'paiements', 'documents', 'contrats', 'locataires'].includes(domain))
      ) {
        void loadOwnerWorkspace();
      }
    };
    window.addEventListener('samaykeur:data-changed', handler);
    window.addEventListener('paiement:refresh', handler);
    return () => {
      window.removeEventListener('samaykeur:data-changed', handler);
      window.removeEventListener('paiement:refresh', handler);
    };
  }, [loadOwnerWorkspace]);

  const ownerName = useMemo(() => {
    const configured = data.settings?.nom_agence?.trim();
    const profileName = formatPersonName(profile, '');
    if (configured && configured.toLowerCase() !== 'gestion locative') return configured;
    if (profileName) return profileName;
    return agency?.name || 'Propriétaire';
  }, [agency?.name, data.settings?.nom_agence, profile]);

  useEffect(() => {
    if (!isProfileModalOpen) return;
    const nameParts = ownerName.split(/\s+/).filter(Boolean);
    setProfileAvatarFile(null);
    setProfileAvatarPreview(null);
    setRemoveProfileAvatar(false);
    setProfileForm({
      prenom: profile?.prenom || data.ownerBailleur?.prenom || nameParts[0] || '',
      nom: profile?.nom || data.ownerBailleur?.nom || nameParts.slice(1).join(' ') || '',
      telephone: data.settings?.telephone || profile?.telephone || data.ownerBailleur?.telephone || agency?.phone || '',
      email: data.settings?.email || profile?.email || data.ownerBailleur?.email || agency?.email || '',
      adresse: data.settings?.adresse || data.ownerBailleur?.adresse || agency?.address || '',
    });
  }, [
    agency?.address,
    agency?.email,
    agency?.phone,
    data.ownerBailleur?.adresse,
    data.ownerBailleur?.email,
    data.ownerBailleur?.nom,
    data.ownerBailleur?.prenom,
    data.ownerBailleur?.telephone,
    data.settings?.adresse,
    data.settings?.email,
    data.settings?.telephone,
    isProfileModalOpen,
    ownerName,
    profile?.email,
    profile?.nom,
    profile?.prenom,
    profile?.telephone,
  ]);

  useEffect(() => {
    if (!profileAvatarFile) {
      setProfileAvatarPreview(null);
      return;
    }
    const preview = URL.createObjectURL(profileAvatarFile);
    setProfileAvatarPreview(preview);
    setRemoveProfileAvatar(false);
    return () => URL.revokeObjectURL(preview);
  }, [profileAvatarFile]);

  const avatarUrl = useMemo(() => {
    const metadata = user?.user_metadata as { avatar_url?: string; picture?: string } | undefined;
    if (removeProfileAvatar) return metadata?.avatar_url || metadata?.picture || null;
    return profileAvatarPreview || data.settings?.logo_url || agency?.logo_url || metadata?.avatar_url || metadata?.picture || null;
  }, [agency?.logo_url, data.settings?.logo_url, profileAvatarPreview, removeProfileAvatar, user?.user_metadata]);

  const initials = useMemo(() => {
    const parts = ownerName.split(/\s+/).filter(Boolean);
    return `${parts[0]?.[0] ?? 'P'}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }, [ownerName]);

  const summary = useMemo(() => {
    const { start, end } = getCurrentMonthBounds();
    const currentPayments = data.payments.filter((payment) => {
      const date = payment.mois_concerne ?? payment.date_paiement ?? '';
      return date >= start && date < end;
    });
    const currentExpenses = data.expenses.filter((expense) => {
      const date = expense.date_depense ?? '';
      return date >= start && date < end;
    });
    const activeContracts = data.contracts.filter((contract) => isActiveStatus(contract.statut));
    const paidByContract = new Map<string, number>();
    currentPayments.forEach((payment) => {
      if (!payment.contrat_id) return;
      paidByContract.set(payment.contrat_id, (paidByContract.get(payment.contrat_id) ?? 0) + parseAmount(payment.montant_total));
    });

    const contractPaid = activeContracts.map((contract) => {
      const paid = paidByContract.get(contract.id) ?? 0;
      return {
        contract,
        paid,
        due: applyCfaSettlementTolerance(Math.max(0, parseAmount(contract.loyer_mensuel) - paid)),
      };
    });
    const fallbackReliquat = currentPayments
      .filter((payment) => String(payment.statut ?? '').toLowerCase() === 'partiel')
      .reduce((sum, payment) => sum + applyCfaSettlementTolerance(Math.max(0, parseAmount(payment.contrats?.loyer_mensuel) - parseAmount(payment.montant_total))), 0);
    const reliquats = activeContracts.length > 0
      ? contractPaid.reduce((sum, row) => sum + row.due, 0)
      : fallbackReliquat;
    const occupiedUnits = data.units.filter((unit) => isOccupiedStatus(unit.statut)).length;
    const totalUnits = data.units.length;
    const rentPotential = data.units.reduce((sum, unit) => sum + parseAmount(unit.loyer_base), 0);
    const collected = currentPayments.reduce((sum, payment) => sum + parseAmount(payment.montant_total), 0);
    const expenses = currentExpenses.reduce((sum, expense) => sum + parseAmount(expense.montant), 0);
    const netOwner = currentPayments.reduce((sum, payment) => sum + paymentOwnerNet(payment), 0) - expenses;

    return {
      collected,
      reliquats,
      netOwner,
      totalUnits,
      occupiedUnits,
      freeUnits: Math.max(0, totalUnits - occupiedUnits),
      activeContracts: activeContracts.length,
      occupationRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
      rentPotential,
      expenses,
      lateContracts: contractPaid.filter((row) => row.due > 0).length,
    };
  }, [data.contracts, data.expenses, data.payments, data.units]);

  const propertyCards = useMemo(() => (
    data.properties.slice(0, 4).map((property, index) => {
      const units = data.units.filter((unit) => unit.immeuble_id === property.id);
      const occupied = units.filter((unit) => isOccupiedStatus(unit.statut)).length;
      const expectedRent = units.reduce((sum, unit) => sum + parseAmount(unit.loyer_base), 0);
      return {
        property,
        units,
        occupied,
        expectedRent,
        occupation: units.length > 0 ? Math.round((occupied / units.length) * 100) : 0,
        accent: PROPERTY_ACCENTS[index % PROPERTY_ACCENTS.length],
      };
    })
  ), [data.properties, data.units]);

  const reportSummary = useMemo(() => {
    const periodPayments = data.payments.filter((payment) => getMonthKey(payment.mois_concerne ?? payment.date_paiement) === reportPeriod);
    const periodExpenses = data.expenses.filter((expense) => getMonthKey(expense.date_depense) === reportPeriod);
    const activeContracts = data.contracts.filter((contract) => isActiveStatus(contract.statut));
    const paidByContract = new Map<string, number>();
    periodPayments.forEach((payment) => {
      if (!payment.contrat_id) return;
      paidByContract.set(payment.contrat_id, (paidByContract.get(payment.contrat_id) ?? 0) + parseAmount(payment.montant_total));
    });

    const rows = activeContracts.map((contract) => {
      const paid = paidByContract.get(contract.id) ?? 0;
      const rent = parseAmount(contract.loyer_mensuel);
      const remaining = applyCfaSettlementTolerance(Math.max(0, rent - paid));
      return {
        contract,
        rent,
        paid,
        remaining,
        status: remaining === 0 && rent > 0 ? 'Soldé' : paid > 0 ? 'Partiel' : 'Impayé',
      };
    });

    const collected = periodPayments.reduce((sum, payment) => sum + parseAmount(payment.montant_total), 0);
    const expenses = periodExpenses.reduce((sum, expense) => sum + parseAmount(expense.montant), 0);
    const netOwner = periodPayments.reduce((sum, payment) => sum + paymentOwnerNet(payment), 0) - expenses;
    const expectedRent = rows.reduce((sum, row) => sum + row.rent, 0);
    const reliquats = rows.reduce((sum, row) => sum + row.remaining, 0);
    const generatedReports = data.documents
      .filter((document) => document.type.toLowerCase().includes('rapport') || document.title.toLowerCase().includes('rapport'))
      .slice(0, 3);

    return {
      periodPayments,
      rows,
      collected,
      expenses,
      netOwner,
      expectedRent,
      reliquats,
      recoveryRate: expectedRent > 0 ? Math.round((collected / expectedRent) * 100) : 0,
      activeContracts: activeContracts.length,
      generatedReports,
    };
  }, [data.contracts, data.documents, data.expenses, data.payments, reportPeriod]);

  const recentPayments = data.payments.slice(0, 5);
  const recentDocuments = data.documents.slice(0, 5);
  const recentActivity = useMemo(() => {
    const paymentActivities = data.payments.slice(0, 3).map((payment) => ({
      id: `pay-${payment.id}`,
      title: payment.statut === 'partiel' ? 'Paiement partiel reçu' : 'Paiement reçu',
      text: <><MoneyText value={parseAmount(payment.montant_total)} /> · {payment.contrats?.unites?.nom ?? 'Loyer'}</>,
      date: payment.date_paiement ?? payment.created_at,
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    }));
    const documentActivities = data.documents.slice(0, 2).map((document) => ({
      id: `doc-${document.id}`,
      title: 'Document ajouté',
      text: document.title,
      date: document.createdAt,
      icon: FileText,
      tone: 'bg-blue-50 text-blue-700 border-blue-100',
    }));
    const contractActivities = data.contracts.slice(0, 2).map((contract) => ({
      id: `contract-${contract.id}`,
      title: 'Location active',
      text: `${contract.unites?.nom ?? 'Unité'} · ${formatPersonName(contract.locataires, 'Locataire')}`,
      date: contract.date_debut,
      icon: ReceiptText,
      tone: 'bg-orange-50 text-orange-700 border-orange-100',
    }));
    return [...paymentActivities, ...documentActivities, ...contractActivities]
      .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
      .slice(0, 5);
  }, [data.contracts, data.documents, data.payments]);

  const navigateToCreateProperty = useCallback(() => {
    onNavigate?.('patrimoine?action=new');
  }, [onNavigate]);

  const uploadOwnerAvatar = async () => {
    if (!profileAvatarFile || !profile?.agency_id) return null;
    if (!profileAvatarFile.type.startsWith('image/')) {
      throw new Error('La photo de profil doit être une image.');
    }
    if (profileAvatarFile.size > MAX_OWNER_AVATAR_SIZE) {
      throw new Error('La photo de profil doit peser moins de 5 Mo.');
    }

    const fileExt = getImageExtension(profileAvatarFile);
    const filePath = `${profile.agency_id}/owners/profile-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from(AGENCY_ASSETS_BUCKET)
      .upload(filePath, profileAvatarFile, {
        cacheControl: '31536000',
        contentType: profileAvatarFile.type,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from(AGENCY_ASSETS_BUCKET).getPublicUrl(filePath);
    return `${publicUrlData.publicUrl}?v=${Date.now()}`;
  };

  const handleSaveOwnerProfile = async () => {
    if (!profile?.agency_id) return;
    const prenom = profileForm.prenom.trim();
    const nom = profileForm.nom.trim();
    const ownerFullName = [prenom, nom].filter(Boolean).join(' ').trim();
    if (ownerFullName.length < 2) {
      toast.warning('Indiquez au moins votre prénom ou votre nom.');
      return;
    }

    const normalizedPhone = profileForm.telephone.trim()
      ? normalizeSenegalPhone(profileForm.telephone) || profileForm.telephone.trim()
      : null;

    setSavingProfile(true);
    try {
      const email = profileForm.email.trim() || null;
      const adresse = profileForm.adresse.trim() || null;
      const uploadedAvatarUrl = await uploadOwnerAvatar();
      const existingOwnerAvatarUrl = data.settings?.logo_url || agency?.logo_url || null;
      const nextAvatarUrl = removeProfileAvatar ? null : uploadedAvatarUrl || existingOwnerAvatarUrl;

      const updates = [
        supabase
          .from('agency_settings')
          .upsert({
            agency_id: profile.agency_id,
            nom_agence: ownerFullName,
            telephone: normalizedPhone,
            email,
            adresse,
            logo_url: nextAvatarUrl,
          }),
        supabase
          .from('agencies')
          .update({
            name: ownerFullName,
            phone: normalizedPhone,
            address: adresse,
            logo_url: nextAvatarUrl,
          })
          .eq('id', profile.agency_id),
      ];

      if (profile.id) {
        updates.push(
          supabase
            .from('user_profiles')
            .update({
              prenom: prenom || null,
              nom: nom || null,
              telephone: normalizedPhone,
            })
            .eq('id', profile.id),
        );
      }

      if (data.ownerBailleur?.id) {
        updates.push(
          supabase
            .from('bailleurs')
            .update({
              prenom: prenom || data.ownerBailleur.prenom,
              nom: nom || data.ownerBailleur.nom,
              telephone: normalizedPhone,
              email,
              adresse,
            })
            .eq('id', data.ownerBailleur.id)
            .eq('agency_id', profile.agency_id),
        );
      }

      const results = await Promise.all(updates);
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) throw firstError;

      setData((current) => ({
        ...current,
        settings: {
          ...current.settings,
          nom_agence: ownerFullName,
          telephone: normalizedPhone,
          email,
          adresse,
          logo_url: nextAvatarUrl,
        },
        ownerBailleur: current.ownerBailleur
          ? {
              ...current.ownerBailleur,
              prenom: prenom || current.ownerBailleur.prenom,
              nom: nom || current.ownerBailleur.nom,
              telephone: normalizedPhone,
              email,
              adresse,
            }
          : current.ownerBailleur,
      }));
      await invalidateOperationalCaches({ agencyId: profile.agency_id, userId: profile.id }, ['dashboard', 'documents', 'bailleurs']);
      notifyDataChanged(['dashboard', 'documents', 'bailleurs']);
      toast.success('Profil propriétaire mis à jour.');
      setProfileAvatarFile(null);
      setProfileAvatarPreview(null);
      setRemoveProfileAvatar(false);
      setIsProfileModalOpen(false);
      void loadOwnerWorkspace();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de mettre à jour votre profil propriétaire.';
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGenerateOwnerReport = async () => {
    if (!profile?.agency_id) return;
    setGeneratingReport(true);
    try {
      const periodLabel = formatMonthLabel(reportPeriod);
      const reportRef = createOwnerReportReference(reportPeriod);
      const settings: Partial<AgencySettings> = {
        agency_id: profile.agency_id,
        is_bailleur_account: true,
        organization_type: 'individual_landlord',
        document_mode: 'simple',
        nom_agence: ownerName,
        adresse: data.settings?.adresse || agency?.address || null,
        telephone: data.settings?.telephone || profile?.telephone || agency?.phone || null,
        email: data.settings?.email || profile?.email || agency?.email || null,
        logo_url: data.settings?.logo_url || agency?.logo_url || null,
        couleur_primaire: '#064E3B',
        couleur_secondaire: '#F59E0B',
        pied_page_personnalise: `${ownerName} - Résumé propriétaire`,
      };

      const doc = new jsPDF('p', 'mm', 'a4');
      drawPageBorder(doc, settings);
      let y = await drawDocumentHeader(doc, settings, 'Résumé mensuel propriétaire', `Période : ${periodLabel}`, {
        documentType: 'rapport propriétaire',
        reference: reportRef,
        issueDate: formatDate(new Date().toISOString()),
      });

      doc.setFont(undefined as unknown as string, 'normal');
      doc.setFontSize(8.4);
      doc.setTextColor(71, 85, 105);
      doc.text(
        'Synthèse des revenus encaissés, reliquats, charges et locations en cours de votre espace propriétaire.',
        14,
        y + 2,
      );
      y += 9;

      y = drawTotalsBlock(
        doc,
        14,
        y,
        doc.internal.pageSize.getWidth() - 28,
        [
          { label: 'Loyers encaissés', value: formatCurrency(reportSummary.collected) },
          { label: 'Reliquats', value: formatCurrency(reportSummary.reliquats) },
          { label: 'Dépenses', value: formatCurrency(reportSummary.expenses) },
          { label: 'Net propriétaire', value: formatCurrency(reportSummary.netOwner), emphasis: true },
        ],
        settings,
      );

      const rows = reportSummary.rows.map((row) => [
        row.contract.unites?.immeubles?.nom ?? 'Bien',
        row.contract.unites?.nom ?? 'Unité',
        formatPersonName(row.contract.locataires, 'Locataire'),
        formatCurrency(row.rent),
        formatCurrency(row.paid),
        formatCurrency(row.remaining),
        row.status,
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Bien', 'Unité', 'Locataire', 'Loyer', 'Encaissé', 'Reliquat', 'Statut']],
        body: rows.length > 0 ? rows : [['-', '-', 'Aucune location en cours', formatCurrency(0), formatCurrency(0), formatCurrency(0), '-']],
        ...getAutoTableTheme(settings),
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'center' },
        },
        didDrawPage: () => {
          drawPageBorder(doc, settings);
        },
      });

      const tableEnd = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 34;
      doc.setFont(undefined as unknown as string, 'bold');
      doc.setFontSize(8.4);
      doc.setTextColor(15, 23, 42);
      doc.text(`Taux de recouvrement : ${reportSummary.recoveryRate}%`, 14, Math.min(tableEnd + 9, 258));

      try {
        await drawLegalVerificationFooter(doc, {
          ref: reportRef,
          type: 'rapport_bailleur',
          agency: ownerName,
          date: new Date().toISOString(),
          settings,
        });
      } catch {
        // La vérification QR reste non bloquante.
      }
      addFooter(doc, settings);

      await saveGeneratedPdf(doc, {
        kind: 'bilan',
        title: 'Résumé mensuel propriétaire',
        fileName: `resume-proprietaire-${reportPeriod}.pdf`,
        source: 'owner-workspace',
        documentType: 'rapport_bailleur',
        entityId: data.ownerBailleur?.id ?? profile.agency_id,
        period: reportPeriod,
        reference: reportRef,
        data: {
          document: 'rapport_bailleur',
          accountType: 'individual_landlord',
          reportPeriod,
          ownerName,
          totals: {
            collected: reportSummary.collected,
            reliquats: reportSummary.reliquats,
            expenses: reportSummary.expenses,
            netOwner: reportSummary.netOwner,
            recoveryRate: reportSummary.recoveryRate,
          },
        },
        preview: {
          columns: ['Bien', 'Unité', 'Locataire', 'Loyer', 'Encaissé', 'Reliquat', 'Statut'],
          rows: reportSummary.rows.slice(0, 6).map((row) => ({
            Bien: row.contract.unites?.immeubles?.nom ?? 'Bien',
            Unite: row.contract.unites?.nom ?? 'Unité',
            Locataire: formatPersonName(row.contract.locataires, 'Locataire'),
            Loyer: formatCurrency(row.rent),
            Encaisse: formatCurrency(row.paid),
            Reliquat: formatCurrency(row.remaining),
            Statut: row.status,
          })),
          rowCount: reportSummary.rows.length,
          period: periodLabel,
          stats: [
            { label: 'Loyers encaissés', value: formatCurrency(reportSummary.collected) },
            { label: 'Reliquats', value: formatCurrency(reportSummary.reliquats) },
            { label: 'Net propriétaire', value: formatCurrency(reportSummary.netOwner) },
            { label: 'Recouvrement', value: `${reportSummary.recoveryRate}%` },
          ],
        },
      });

      await invalidateOperationalCaches({ agencyId: profile.agency_id, userId: profile.id }, ['dashboard', 'documents', 'finances']);
      notifyDataChanged(['dashboard', 'documents', 'finances']);
      toast.success('Résumé mensuel propriétaire généré et archivé.');
      void loadOwnerWorkspace();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de générer le rapport propriétaire.';
      toast.error(message);
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) {
    return <PageSkeleton title="Espace propriétaire" variant="dashboard" />;
  }

  if (error) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center shadow-2xl shadow-red-950/10">
          <AlertCircle className="mx-auto h-12 w-12 text-red-600" />
          <h1 className="mt-4 text-2xl font-black text-slate-950">Espace propriétaire indisponible</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => void loadOwnerWorkspace()}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-900 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/15"
          >
            <RefreshCw className="h-4 w-4" />
            Recharger
          </button>
        </div>
      </div>
    );
  }

  if (data.properties.length === 0 && data.contracts.length === 0 && !loading) {
    return (
      <div className="sk-page-shell space-y-6 lg:space-y-8 animate-fadeIn min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,244,214,0.95),transparent_30rem),linear-gradient(180deg,#fffaf0,#f8f4ea_46%,#f7fbf8)] px-4 py-6 sm:px-6 lg:px-7">
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-950/5 bg-[linear-gradient(135deg,#FDFBF7_0%,#F3F9F6_100%)] p-8 shadow-[0_24px_60px_rgba(6,17,13,0.06)] lg:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full bg-amber-200/20 blur-3xl" />

          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-brand-800 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-emerald-900/5">
              <Sparkles className="h-8 w-8" />
            </div>
            <h1 className="font-serif text-4xl font-black tracking-tight text-brand-950 sm:text-5xl">
              Votre espace propriétaire est prêt.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg font-medium leading-8 text-slate-600">
              Ajoutez votre premier bien pour commencer le suivi de vos loyers, documents et paiements.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => onNavigate?.('patrimoine')}
                className="inline-flex min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl bg-[#072F24] px-8 py-3 text-base font-black text-white shadow-[0_18px_48px_rgba(7,47,36,0.26)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0A3F30] active:bg-[#041812] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action-500/25"
              >
                <Building2 className="h-5 w-5" />
                Ajouter mon premier bien
              </button>
              <button
                type="button"
                onClick={() => void loadOwnerWorkspace()}
                className="inline-flex min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl border border-emerald-950/10 bg-white px-8 py-3 text-base font-bold text-slate-700 shadow-sm transition-all duration-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action-500/25"
              >
                <RefreshCw className="h-5 w-5" />
                Actualiser
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-2">
            <h2 className="mb-5 text-xl font-black text-slate-950">Feuille de route</h2>
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200/60 bg-white shadow-sm">
              <div className="grid grid-cols-1 divide-y divide-slate-100">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-slate-900">1. Ajouter un bien</h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">À faire</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">Renseignez votre maison, appartement ou immeuble.</p>
                  </div>
                  <button onClick={() => onNavigate?.('patrimoine')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                    Commencer
                  </button>
                </div>
                <div className="flex flex-col gap-4 p-5 opacity-70 sm:flex-row sm:items-center sm:p-6">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <Home className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-slate-900">2. Ajouter une unité si nécessaire</h3>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Découpez le bien en appartements, chambres ou locaux.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-4 p-5 opacity-70 sm:flex-row sm:items-center sm:p-6">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-slate-900">3. Créer une location</h3>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Associez un locataire à une unité.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-4 p-5 opacity-70 sm:flex-row sm:items-center sm:p-6">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <Banknote className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-slate-900">4. Suivre les paiements</h3>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Visualisez loyers encaissés, reliquats et documents.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-5 text-xl font-black text-slate-950">Ce que vous pourrez suivre</h2>
            <div className="flex flex-col gap-4">
              <div className="rounded-[1.5rem] border border-emerald-950/10 bg-[#FDFBF7] p-5 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Wallet className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900">Loyers et encaissements</h3>
                <p className="mt-1 text-sm text-slate-600">Vue claire sur vos revenus réguliers et le net propriétaire.</p>
              </div>
              <div className="rounded-[1.5rem] border border-emerald-950/10 bg-[#FDFBF7] p-5 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900">Reliquats et impayés</h3>
                <p className="mt-1 text-sm text-slate-600">Détection des retards de paiement pour un suivi rigoureux.</p>
              </div>
              <div className="rounded-[1.5rem] border border-emerald-950/10 bg-[#FDFBF7] p-5 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900">Rapports et documents</h3>
                <p className="mt-1 text-sm text-slate-600">Génération automatique des bilans propriétaires en PDF.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(255,244,214,0.95),transparent_30rem),linear-gradient(180deg,#fffaf0,#f8f4ea_46%,#f7fbf8)] px-4 py-4 sm:px-6 lg:px-7">
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <div className="mx-auto max-w-[118rem] space-y-4">
        {cacheTimestamp && <OfflineDataNotice cachedAt={cacheTimestamp} onRetry={loadOwnerWorkspace} />}

        <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-amber-700">
              <Sparkles className="h-3.5 w-3.5" />
              Espace propriétaire
            </div>
            <h1 className="mt-2 font-serif text-3xl font-black tracking-tight text-brand-950 sm:text-4xl">
              Espace propriétaire
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm font-medium leading-6 text-slate-600 sm:text-[0.95rem]">
              Bienvenue {profile?.prenom || ownerName.split(' ')[0] || 'propriétaire'}, suivez vos biens, vos loyers, vos documents et vos rapports depuis un espace unique.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <PremiumButton
              variant="create"
              onClick={navigateToCreateProperty}
              icon={<Plus className="h-4 w-4" />}
            >
              Ajouter un bien
            </PremiumButton>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:gap-3">
          <MetricCard label="Loyers encaissés" value={<MoneyText value={summary.collected} compact />} icon={Wallet} tone="emerald" />
          <MetricCard label="Reliquats" value={<MoneyText value={summary.reliquats} compact />} icon={CalendarClock} tone={summary.reliquats > 0 ? "red" : "emerald"} />
          <MetricCard label="Net propriétaire" value={<MoneyText value={summary.netOwner} compact />} icon={TrendingUp} tone="green" />
          <MetricCard label="Occupation" value={`${summary.occupationRate}%`} icon={Building2} tone="amber" />
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_34rem]">
          <div className="space-y-4">
            <section className="rounded-[1.4rem] border border-emerald-950/10 bg-[#fffdf8]/95 p-4 shadow-[0_18px_54px_rgba(15,23,42,0.07)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-950">Mes biens</h2>
                <button
                  type="button"
                  onClick={() => onNavigate?.('patrimoine')}
                  className="rounded-xl border border-emerald-950/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-emerald-50"
                >
                  Voir tous mes biens
                </button>
              </div>

              {propertyCards.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="Aucun bien ajouté pour le moment."
                  description="Ajoutez votre premier bien pour commencer le suivi des unités, locataires, loyers et documents."
                  action={{ label: 'Ajouter un bien', onClick: navigateToCreateProperty }}
                />
              ) : (
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
                  {propertyCards.map(({ property, units, occupation, expectedRent, accent }) => {
                    const Icon = accent.icon;
                    return (
                      <button
                        key={property.id}
                        type="button"
                        onClick={() => onNavigate?.('patrimoine')}
                        className="group overflow-hidden rounded-2xl border border-emerald-950/10 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-950/10"
                      >
                        <div className={`flex h-20 items-center justify-center bg-gradient-to-br ${accent.bg}`}>
                          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 ring-1 ${accent.ring}`}>
                            <Icon className={`h-7 w-7 ${accent.color}`} />
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="line-clamp-2 min-h-[2.4rem] text-sm font-bold leading-tight text-slate-950">{property.nom}</p>
                          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{property.quartier || property.ville || property.adresse || 'Adresse à compléter'}</p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[0.68rem] font-bold text-emerald-800">{units.length} unité{units.length > 1 ? 's' : ''}</span>
                            <span className="rounded-full bg-amber-50 px-2 py-1 text-[0.68rem] font-bold text-amber-800">{occupation}%</span>
                          </div>
                          <p className="mt-3 text-xs font-bold text-slate-800"><MoneyText value={expectedRent} suffix="/ mois" /></p>
                        </div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={navigateToCreateProperty}
                    className="flex min-h-[10.75rem] flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-900/20 bg-white/70 p-4 text-center text-sm font-bold text-brand-900 transition hover:border-brand-700 hover:bg-emerald-50"
                  >
                    <Plus className="mb-2 h-7 w-7 rounded-full bg-emerald-50 p-1.5 text-brand-800" />
                    Ajouter un bien
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-[1.4rem] border border-emerald-950/10 bg-[#fffdf8]/95 p-4 shadow-[0_18px_54px_rgba(15,23,42,0.07)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-emerald-800">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Bilan propriétaire
                  </div>
                  <h2 className="mt-3 text-xl font-bold text-slate-950">Rapports & revenus</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">Une synthèse claire de vos encaissements, reliquats et charges.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="month"
                    value={reportPeriod}
                    onChange={(event) => setReportPeriod(event.target.value || getCurrentMonthKey())}
                    className="h-10 rounded-xl border border-emerald-950/10 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                    aria-label="Période du rapport propriétaire"
                  />
                  <PremiumButton
                    variant="primary"
                    onClick={() => void handleGenerateOwnerReport()}
                    disabled={generatingReport}
                    icon={generatingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  >
                    Générer mon rapport PDF
                  </PremiumButton>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                <MiniStat label="Encaissé" value={<MoneyText value={reportSummary.collected} compact />} tone="blue" />
                <MiniStat label="Reliquats" value={<MoneyText value={reportSummary.reliquats} compact />} tone="amber" />
                <MiniStat label="Charges" value={<MoneyText value={reportSummary.expenses} compact />} tone="orange" />
                <MiniStat label="Net propriétaire" value={<MoneyText value={reportSummary.netOwner} compact />} tone="blue" />
              </div>

              <div className="mt-3 grid gap-2.5 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-emerald-950/10 bg-white p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-950">Situation de {formatMonthLabel(reportPeriod)}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {reportSummary.activeContracts} location{reportSummary.activeContracts > 1 ? 's' : ''} en cours analysée{reportSummary.activeContracts > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{reportSummary.recoveryRate}% recouvré</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-800 to-amber-400" style={{ width: `${Math.min(100, reportSummary.recoveryRate)}%` }} />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    Loyer attendu : <span className="font-bold text-slate-800"><MoneyText value={reportSummary.expectedRent} /></span>
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-950/10 bg-white p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-950">Derniers rapports</p>
                    <button type="button" onClick={() => onNavigate?.('documents')} className="text-xs font-semibold text-brand-800">Voir GED</button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {reportSummary.generatedReports.length > 0 ? (
                      reportSummary.generatedReports.map((document) => (
                        <CompactRow
                          key={document.id}
                          badge="PDF"
                          badgeClassName="bg-red-50 text-red-700 border-red-100"
                          title={document.title}
                          subtitle={`${document.subtitle} · ${formatDate(document.createdAt)}`}
                        />
                      ))
                    ) : (
                      <p className="rounded-xl border border-dashed border-emerald-950/10 bg-slate-50 px-3 py-3 text-xs font-semibold leading-5 text-slate-500">
                        Aucun rapport propriétaire généré pour le moment.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-3">
              <OwnerListCard
                title="Activité récente"
                actionLabel="Actualiser"
                onAction={() => void loadOwnerWorkspace()}
                emptyTitle="Aucune activité"
                emptyText="Les mouvements récents apparaîtront ici."
                featured
              >
                {recentActivity.map((activity) => (
                  <CompactRow
                    key={activity.id}
                    icon={activity.icon}
                    customTone={activity.tone}
                    title={activity.title}
                    subtitle={<>{activity.text} · {formatDate(activity.date)}</>}
                  />
                ))}
              </OwnerListCard>

              <OwnerListCard
                title="Paiements récents"
                actionLabel="Voir tous"
                onAction={() => onNavigate?.('paiements')}
                emptyTitle="Aucun paiement récent"
                emptyText="Les loyers encaissés apparaîtront ici dès qu'un paiement sera enregistré."
              >
                {recentPayments.map((payment) => (
                  <CompactRow
                    key={payment.id}
                    icon={Banknote}
                    tone="emerald"
                    title={payment.contrats?.unites?.immeubles?.nom ?? payment.contrats?.unites?.nom ?? 'Loyer'}
                    subtitle={`${formatPersonName(payment.contrats?.locataires, 'Locataire')} · ${formatDate(payment.date_paiement)}`}
                    value={<MoneyText value={parseAmount(payment.montant_total)} />}
                  />
                ))}
              </OwnerListCard>

              <OwnerListCard
                title="Documents récents"
                actionLabel="Voir tous"
                onAction={() => onNavigate?.('documents')}
                emptyTitle="Aucun document récent"
                emptyText="Les quittances, contrats et rapports apparaîtront ici."
              >
                {recentDocuments.map((document) => {
                  const kind = getDocumentKind(document.type);
                  return (
                    <CompactRow
                      key={document.id}
                      badge={kind.label}
                      badgeClassName={kind.tone}
                      title={document.title}
                      subtitle={`${document.subtitle} · ${formatDate(document.createdAt)}`}
                    />
                  );
                })}
              </OwnerListCard>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.4rem] border border-emerald-950/10 bg-[#fffdf8]/95 p-4 shadow-[0_18px_54px_rgba(15,23,42,0.07)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-950">Mon profil</h2>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-950/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-emerald-50"
                >
                  <Settings className="h-4 w-4" />
                  Modifier
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-emerald-100 to-amber-100 ring-4 ring-white shadow-lg">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={ownerName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-bold text-brand-900">{initials}</div>
                  )}
                  <span className="absolute bottom-0.5 right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-white ring-4 ring-white">
                    <Camera className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-bold text-slate-950">{ownerName}</h3>
                  <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">Propriétaire</span>
                  <div className="mt-3 space-y-1.5 text-sm font-medium text-slate-600">
                    <p className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-slate-400" />{formatSenegalPhone(data.settings?.telephone || profile?.telephone || agency?.phone, 'Téléphone à compléter')}</p>
                    <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />{data.settings?.email || profile?.email || agency?.email}</p>
                    <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{data.settings?.adresse || agency?.address || 'Adresse à compléter'}</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('documents')}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-950/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-emerald-50"
              >
                <Download className="h-4 w-4" />
                Voir mes documents propriétaire
              </button>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniStat label="Biens" value={data.properties.length} tone="blue" />
                <MiniStat label="Unités" value={summary.totalUnits} tone="orange" />
                <MiniStat label="Locations en cours" value={summary.activeContracts} tone="blue" />
                <MiniStat label="Reliquats" value={<MoneyText value={summary.reliquats} compact />} tone="amber" />
              </div>
            </section>

            <section className="rounded-[1.4rem] border border-emerald-950/10 bg-[#fffdf8]/95 p-4 shadow-[0_16px_44px_rgba(15,23,42,0.05)]">
              <h2 className="text-base font-bold text-slate-950">Accès rapides</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <QuickAction icon={Building2} label="Ajouter un bien" onClick={navigateToCreateProperty} />
                <QuickAction icon={Home} label="Mes biens" onClick={() => onNavigate?.('patrimoine')} />
                <QuickAction icon={Users} label="Mes locations" onClick={() => onNavigate?.('occupants-baux')} />
                <QuickAction icon={FileText} label="Générer rapport" onClick={() => void handleGenerateOwnerReport()} />
                <QuickAction icon={FolderOpen} label="Mes documents" onClick={() => onNavigate?.('documents')} />
                <QuickAction icon={Wallet} label="Mes paiements" onClick={() => onNavigate?.('paiements')} />
              </div>
            </section>

            <section className="relative overflow-hidden rounded-[1.4rem] border border-emerald-200/20 bg-[radial-gradient(circle_at_15%_35%,rgba(245,158,11,0.15),transparent_10rem),linear-gradient(135deg,#063226,#03251f)] p-4 text-white shadow-xl shadow-emerald-950/15">
              <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full border border-emerald-200/10" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-200 ring-1 ring-amber-200/20">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">Conseil du jour</h2>
                  <p className="mt-1.5 text-sm font-medium leading-5 text-emerald-50/85">
                    Maintenez vos documents à jour pour faciliter la gestion de vos biens et accélérer vos rapports mensuels.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="Modifier mon profil propriétaire">
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-950/10 bg-emerald-50/60 p-4">
            <p className="text-sm font-bold text-brand-900">Profil utilisé dans l'espace propriétaire</p>
            <p className="mt-1 text-xs font-medium leading-5 text-emerald-900/70">
              Ces informations alimentent votre carte profil, votre bailleur interne et les documents propriétaire.
            </p>
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-emerald-950/10 bg-white/80 p-4 sm:flex-row sm:items-center">
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-emerald-100 to-amber-100 ring-4 ring-white shadow-md">
              {avatarUrl ? (
                <img src={avatarUrl} alt={ownerName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-black text-brand-900">{initials}</div>
              )}
              <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-white ring-4 ring-white">
                <Camera className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">Photo de profil propriétaire</p>
              <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                Cette photo personnalise votre espace et peut être reprise dans vos documents propriétaire.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-900 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-brand-950">
                  <Camera className="h-4 w-4" />
                  Importer une photo
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setProfileAvatarFile(file);
                      if (file) setRemoveProfileAvatar(false);
                    }}
                  />
                </label>
                {(profileAvatarPreview || data.settings?.logo_url || agency?.logo_url) && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileAvatarFile(null);
                      setProfileAvatarPreview(null);
                      setRemoveProfileAvatar(true);
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-950/10 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Retirer la photo importée
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Prénom</span>
              <input
                value={profileForm.prenom}
                onChange={(event) => setProfileForm((current) => ({ ...current, prenom: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-emerald-950/10 bg-white px-4 text-sm font-bold text-slate-950 outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                placeholder="Ex: Matar"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Nom</span>
              <input
                value={profileForm.nom}
                onChange={(event) => setProfileForm((current) => ({ ...current, nom: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-emerald-950/10 bg-white px-4 text-sm font-bold text-slate-950 outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                placeholder="Ex: Diouf"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Téléphone</span>
              <input
                value={formatSenegalPhoneInput(profileForm.telephone)}
                onChange={(event) => setProfileForm((current) => ({ ...current, telephone: formatSenegalPhoneInput(event.target.value) }))}
                className="h-12 w-full rounded-2xl border border-emerald-950/10 bg-white px-4 text-sm font-bold text-slate-950 outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                placeholder="77 123 45 67"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Email documentaire</span>
              <input
                type="email"
                value={profileForm.email}
                onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-emerald-950/10 bg-white px-4 text-sm font-bold text-slate-950 outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                placeholder="proprietaire@email.com"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Adresse</span>
              <input
                value={profileForm.adresse}
                onChange={(event) => setProfileForm((current) => ({ ...current, adresse: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-emerald-950/10 bg-white px-4 text-sm font-bold text-slate-950 outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
                placeholder="Quartier, ville"
              />
            </label>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <PremiumButton
              variant="secondary"
              onClick={() => setIsProfileModalOpen(false)}
            >
              Annuler
            </PremiumButton>
            <PremiumButton
              variant="primary"
              onClick={() => void handleSaveOwnerProfile()}
              disabled={savingProfile}
              icon={savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            >
              Enregistrer
            </PremiumButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function OwnerListCard({
  title,
  actionLabel,
  onAction,
  emptyTitle,
  emptyText,
  children,
  featured = false,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  emptyTitle: string;
  emptyText: string;
  children: ReactNode;
  featured?: boolean;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className={`rounded-[1.4rem] border p-3.5 shadow-[0_16px_44px_rgba(15,23,42,0.05)] ${
      featured
        ? 'border-emerald-200 bg-gradient-to-br from-white via-emerald-50/65 to-[#fffdf8]'
        : 'border-emerald-950/10 bg-[#fffdf8]/95'
    }`}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        <button type="button" onClick={onAction} className="text-xs font-semibold text-brand-800 hover:text-brand-950">
          {actionLabel}
        </button>
      </div>
      {hasChildren ? (
        <div className="space-y-1.5">{children}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-emerald-950/10 bg-white/70 p-3.5">
          <p className="text-sm font-bold text-slate-800">{emptyTitle}</p>
          <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{emptyText}</p>
        </div>
      )}
    </section>
  );
}

function CompactRow({
  icon: Icon,
  tone = 'emerald',
  customTone,
  badge,
  badgeClassName,
  title,
  subtitle,
  value,
}: {
  icon?: LucideIcon;
  tone?: 'emerald' | 'orange' | 'blue';
  customTone?: string;
  badge?: string;
  badgeClassName?: string;
  title: string;
  subtitle: ReactNode;
  value?: ReactNode;
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  };
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-transparent p-2 transition hover:border-emerald-950/10 hover:bg-white">
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border text-[0.66rem] font-bold ${badgeClassName ?? customTone ?? tones[tone]}`}>
        {badge ?? (Icon ? <Icon className="h-4 w-4" /> : null)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
        <p className="line-clamp-2 text-xs font-medium leading-4 text-slate-500">{subtitle}</p>
      </div>
      {value && <p className="flex-shrink-0 text-right text-xs font-bold text-brand-800">{value}</p>}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: ReactNode; tone: 'blue' | 'orange' | 'amber' | 'red' | 'emerald' }) {
  const tones = {
    blue: 'from-emerald-50 to-[#fffdf8] border-emerald-100 text-brand-900',
    orange: 'from-orange-50 to-red-50 border-orange-100 text-orange-900',
    amber: 'from-amber-50 to-orange-50 border-amber-100 text-amber-900',
    red: 'from-red-50 to-rose-50 border-red-100 text-red-900',
    emerald: 'from-emerald-50 to-teal-50 border-emerald-100 text-emerald-900',
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-2.5 ${tones[tone]}`}>
      <p className="truncate text-[0.66rem] font-semibold uppercase tracking-[0.12em] opacity-80">{label}</p>
      <p className="mt-2 whitespace-nowrap text-base font-bold">{value}</p>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-emerald-950/10 bg-white p-3 text-center text-xs font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-brand-900"
    >
      <Icon className="h-5 w-5 text-slate-600 transition group-hover:text-brand-800" />
      {label}
      <ArrowRight className="h-3.5 w-3.5 text-transparent transition group-hover:text-brand-700" />
    </button>
  );
}
