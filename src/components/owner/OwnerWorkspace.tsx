import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
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
  Mail,
  MapPin,
  Plus,
  ReceiptText,
  RefreshCw,
  Settings,
  Sparkles,
  Store,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate, formatSenegalPhone } from '../../lib/formatters';
import { formatPersonName } from '../../lib/people';
import { readWithCache } from '../../services/offlineReadCache';
import { OfflineDataNotice } from '../ui/OfflineDataNotice';
import { PageSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';

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
  properties: OwnerProperty[];
  units: OwnerUnit[];
  contracts: OwnerContract[];
  payments: OwnerPayment[];
  expenses: OwnerExpense[];
  documents: OwnerDocument[];
}

const EMPTY_DATA: OwnerWorkspaceData = {
  settings: null,
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

function getCurrentMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
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

export function OwnerWorkspace({ onNavigate, onStartSetupWizard }: OwnerWorkspaceProps) {
  const { profile, user, agency } = useAuth();
  const [data, setData] = useState<OwnerWorkspaceData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);

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
          const [settingsRes, propertiesRes, unitsRes, contractsRes, paymentsRes, expensesRes, docsRes, registryRes] = await Promise.all([
            supabase
              .from('agency_settings')
              .select('nom_agence, telephone, email, adresse, logo_url')
              .eq('agency_id', scopedAgencyId)
              .maybeSingle(),
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
              .limit(40),
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
              .limit(8),
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
  }, [profile?.agency_id, profile?.id]);

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
    if (profileName) return profileName;
    if (configured && configured.toLowerCase() !== 'gestion locative') return configured;
    return agency?.name || 'Propriétaire';
  }, [agency?.name, data.settings?.nom_agence, profile]);

  const avatarUrl = useMemo(() => {
    const metadata = user?.user_metadata as { avatar_url?: string; picture?: string } | undefined;
    return metadata?.avatar_url || metadata?.picture || data.settings?.logo_url || agency?.logo_url || null;
  }, [agency?.logo_url, data.settings?.logo_url, user?.user_metadata]);

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
        due: Math.max(0, parseAmount(contract.loyer_mensuel) - paid),
      };
    });
    const fallbackReliquat = currentPayments
      .filter((payment) => String(payment.statut ?? '').toLowerCase() === 'partiel')
      .reduce((sum, payment) => sum + Math.max(0, parseAmount(payment.contrats?.loyer_mensuel) - parseAmount(payment.montant_total)), 0);
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
      return {
        property,
        units,
        occupied,
        occupation: units.length > 0 ? Math.round((occupied / units.length) * 100) : 0,
        accent: PROPERTY_ACCENTS[index % PROPERTY_ACCENTS.length],
      };
    })
  ), [data.properties, data.units]);

  const recentPayments = data.payments.slice(0, 5);
  const recentDocuments = data.documents.slice(0, 5);
  const recentActivity = useMemo(() => {
    const paymentActivities = data.payments.slice(0, 3).map((payment) => ({
      id: `pay-${payment.id}`,
      title: payment.statut === 'partiel' ? 'Paiement partiel reçu' : 'Paiement reçu',
      text: `${formatCurrency(parseAmount(payment.montant_total))} · ${payment.contrats?.unites?.nom ?? 'Loyer'}`,
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
      title: 'Contrat actif',
      text: `${contract.unites?.nom ?? 'Unité'} · ${formatPersonName(contract.locataires, 'Locataire')}`,
      date: contract.date_debut,
      icon: ReceiptText,
      tone: 'bg-orange-50 text-orange-700 border-orange-100',
    }));
    return [...paymentActivities, ...documentActivities, ...contractActivities]
      .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
      .slice(0, 5);
  }, [data.contracts, data.documents, data.payments]);

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

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(255,244,214,0.95),transparent_30rem),linear-gradient(180deg,#fffaf0,#f8f4ea_46%,#f7fbf8)] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[118rem] space-y-5">
        {cacheTimestamp && <OfflineDataNotice cachedAt={cacheTimestamp} onRetry={loadOwnerWorkspace} />}

        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em] text-amber-700">
              <Sparkles className="h-3.5 w-3.5" />
              Espace propriétaire
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Espace propriétaire
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
              Bienvenue {profile?.prenom || ownerName.split(' ')[0] || 'propriétaire'}, suivez vos biens, vos loyers, vos documents et vos rapports depuis un espace unique.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => onNavigate?.('tableau-de-bord-financier')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-950/10 bg-[#fffdf8] px-4 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            >
              <FileText className="h-4 w-4 text-brand-800" />
              Générer rapport PDF
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('patrimoine')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-900 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-brand-950"
            >
              <Plus className="h-4 w-4" />
              Ajouter un bien
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <OwnerKpi title="Loyers encaissés" value={formatCurrency(summary.collected)} subtitle="Ce mois-ci" icon={Wallet} tone="emerald" />
          <OwnerKpi title="Reliquats à recouvrer" value={formatCurrency(summary.reliquats)} subtitle={`${summary.lateContracts} contrat${summary.lateContracts > 1 ? 's' : ''} en retard`} icon={CalendarClock} tone="red" />
          <OwnerKpi title="Net propriétaire" value={formatCurrency(summary.netOwner)} subtitle={`${formatCurrency(summary.expenses)} de charges`} icon={TrendingUp} tone="green" />
          <OwnerKpi title="Taux d'occupation" value={`${summary.occupationRate}%`} subtitle={`${summary.occupiedUnits} unité${summary.occupiedUnits > 1 ? 's' : ''} sur ${summary.totalUnits} occupée${summary.totalUnits > 1 ? 's' : ''}`} icon={Building2} tone="amber" />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
          <div className="space-y-5">
            <section className="rounded-3xl border border-emerald-950/10 bg-[#fffdf8]/95 p-4 shadow-[0_20px_70px_rgba(15,23,42,0.08)] sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black text-slate-950">Mes biens</h2>
                <button
                  type="button"
                  onClick={() => onNavigate?.('patrimoine')}
                  className="rounded-xl border border-emerald-950/10 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-emerald-50"
                >
                  Voir tous mes biens
                </button>
              </div>

              {propertyCards.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="Aucun bien ajouté pour le moment."
                  description="Ajoutez votre premier bien pour commencer le suivi des unités, locataires, loyers et documents."
                  action={{ label: 'Ajouter un bien', onClick: () => onNavigate?.('patrimoine') }}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                  {propertyCards.map(({ property, units, occupation, accent }) => {
                    const Icon = accent.icon;
                    return (
                      <button
                        key={property.id}
                        type="button"
                        onClick={() => onNavigate?.('patrimoine')}
                        className="group overflow-hidden rounded-2xl border border-emerald-950/10 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/10"
                      >
                        <div className={`flex h-24 items-center justify-center bg-gradient-to-br ${accent.bg}`}>
                          <div className={`flex h-16 w-16 items-center justify-center rounded-3xl bg-white/70 ring-1 ${accent.ring}`}>
                            <Icon className={`h-8 w-8 ${accent.color}`} />
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="line-clamp-2 min-h-[2.4rem] text-sm font-black leading-tight text-slate-950">{property.nom}</p>
                          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{property.quartier || property.ville || property.adresse || 'Adresse à compléter'}</p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[0.68rem] font-black text-emerald-800">{units.length} unité{units.length > 1 ? 's' : ''}</span>
                            <span className="rounded-full bg-amber-50 px-2 py-1 text-[0.68rem] font-black text-amber-800">{occupation}%</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => onNavigate?.('patrimoine')}
                    className="flex min-h-[12.5rem] flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-900/20 bg-white/70 p-4 text-center font-black text-brand-900 transition hover:border-brand-700 hover:bg-emerald-50"
                  >
                    <Plus className="mb-3 h-8 w-8 rounded-full bg-emerald-50 p-1.5 text-brand-800" />
                    Ajouter un bien
                  </button>
                </div>
              )}
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <OwnerListCard
                title="Paiements récents"
                actionLabel="Voir tous"
                onAction={() => onNavigate?.('paiements')}
                emptyTitle="Aucun paiement récent"
                emptyText="Les loyers encaissés apparaîtront ici."
              >
                {recentPayments.map((payment) => (
                  <CompactRow
                    key={payment.id}
                    icon={Banknote}
                    tone="emerald"
                    title={payment.contrats?.unites?.immeubles?.nom ?? payment.contrats?.unites?.nom ?? 'Loyer'}
                    subtitle={`${formatPersonName(payment.contrats?.locataires, 'Locataire')} · ${formatDate(payment.date_paiement)}`}
                    value={formatCurrency(parseAmount(payment.montant_total))}
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

              <OwnerListCard
                title="Activité récente"
                actionLabel="Actualiser"
                onAction={() => void loadOwnerWorkspace()}
                emptyTitle="Aucune activité"
                emptyText="Les mouvements récents apparaîtront ici."
              >
                {recentActivity.map((activity) => (
                  <CompactRow
                    key={activity.id}
                    icon={activity.icon}
                    customTone={activity.tone}
                    title={activity.title}
                    subtitle={`${activity.text} · ${formatDate(activity.date)}`}
                  />
                ))}
              </OwnerListCard>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-emerald-950/10 bg-[#fffdf8]/95 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-950">Mon profil</h2>
                <button
                  type="button"
                  onClick={onStartSetupWizard ?? (() => onNavigate?.('parametres'))}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-950/10 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-emerald-50"
                >
                  <Settings className="h-4 w-4" />
                  Modifier
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-emerald-100 to-amber-100 ring-8 ring-white shadow-lg">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={ownerName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-black text-brand-900">{initials}</div>
                  )}
                  <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-white ring-4 ring-white">
                    <Camera className="h-4 w-4" />
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-2xl font-black text-slate-950">{ownerName}</h3>
                  <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800">Propriétaire</span>
                  <div className="mt-3 space-y-1.5 text-sm font-semibold text-slate-600">
                    <p className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-slate-400" />{formatSenegalPhone(data.settings?.telephone || profile?.telephone || agency?.phone, 'Téléphone à compléter')}</p>
                    <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />{data.settings?.email || profile?.email || agency?.email}</p>
                    <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{data.settings?.adresse || agency?.address || 'Adresse à compléter'}</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('documents')}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-950/10 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-emerald-50"
              >
                <Download className="h-4 w-4" />
                Voir mes documents propriétaire
              </button>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniStat label="Biens" value={data.properties.length} tone="blue" />
                <MiniStat label="Unités" value={summary.totalUnits} tone="orange" />
                <MiniStat label="Contrats actifs" value={summary.activeContracts} tone="blue" />
                <MiniStat label="Reliquats" value={formatCurrency(summary.reliquats)} tone="amber" />
              </div>
            </section>

            <section className="rounded-3xl border border-emerald-950/10 bg-[#fffdf8]/95 p-5 shadow-[0_18px_54px_rgba(15,23,42,0.06)]">
              <h2 className="text-lg font-black text-slate-950">Accès rapides</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <QuickAction icon={Building2} label="Ajouter un bien" onClick={() => onNavigate?.('patrimoine')} />
                <QuickAction icon={FileText} label="Générer rapport" onClick={() => onNavigate?.('tableau-de-bord-financier')} />
                <QuickAction icon={FolderOpen} label="Mes documents" onClick={() => onNavigate?.('documents')} />
                <QuickAction icon={Wallet} label="Mes paiements" onClick={() => onNavigate?.('paiements')} />
              </div>
            </section>

            <section className="relative overflow-hidden rounded-3xl border border-emerald-200/20 bg-[radial-gradient(circle_at_15%_35%,rgba(245,158,11,0.18),transparent_10rem),linear-gradient(135deg,#063226,#03251f)] p-5 text-white shadow-2xl shadow-emerald-950/20">
              <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full border border-emerald-200/10" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-200 ring-1 ring-amber-200/20">
                  <Sparkles className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-base font-black">Conseil du jour</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-emerald-50/85">
                    Maintenez vos documents à jour pour faciliter la gestion de vos biens et accélérer vos rapports mensuels.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

interface OwnerKpiProps {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  tone: 'emerald' | 'red' | 'green' | 'amber';
}

const KPI_TONES: Record<OwnerKpiProps['tone'], { title: string; icon: string; bg: string; badge: string }> = {
  emerald: { title: 'text-brand-800', icon: 'text-brand-800 bg-emerald-100', bg: 'from-white to-emerald-50/70', badge: 'text-emerald-700 bg-emerald-50' },
  red: { title: 'text-red-700', icon: 'text-red-700 bg-red-100', bg: 'from-white to-red-50/70', badge: 'text-red-700 bg-red-50' },
  green: { title: 'text-emerald-800', icon: 'text-emerald-800 bg-emerald-100', bg: 'from-white to-emerald-50/70', badge: 'text-emerald-700 bg-emerald-50' },
  amber: { title: 'text-amber-700', icon: 'text-amber-800 bg-amber-100', bg: 'from-white to-amber-50/70', badge: 'text-amber-700 bg-amber-50' },
};

function OwnerKpi({ title, value, subtitle, icon: Icon, tone }: OwnerKpiProps) {
  const colors = KPI_TONES[tone];
  return (
    <article className={`min-w-0 rounded-2xl border border-emerald-950/10 bg-gradient-to-br ${colors.bg} p-3 shadow-[0_14px_44px_rgba(15,23,42,0.07)] sm:p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate text-[0.68rem] font-black uppercase tracking-[0.14em] ${colors.title}`}>{title}</p>
          <p className="mt-2 truncate text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{value}</p>
          <p className="mt-1 truncate text-xs font-bold text-slate-500">{subtitle}</p>
        </div>
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${colors.icon}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </article>
  );
}

function OwnerListCard({
  title,
  actionLabel,
  onAction,
  emptyTitle,
  emptyText,
  children,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  emptyTitle: string;
  emptyText: string;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="rounded-3xl border border-emerald-950/10 bg-[#fffdf8]/95 p-4 shadow-[0_18px_54px_rgba(15,23,42,0.06)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-slate-950">{title}</h2>
        <button type="button" onClick={onAction} className="text-xs font-black text-brand-800 hover:text-brand-950">
          {actionLabel}
        </button>
      </div>
      {hasChildren ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-emerald-950/10 bg-white/70 p-4">
          <p className="text-sm font-black text-slate-800">{emptyTitle}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{emptyText}</p>
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
  subtitle: string;
  value?: string;
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-transparent p-2 transition hover:border-emerald-950/10 hover:bg-white">
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border text-xs font-black ${badgeClassName ?? customTone ?? tones[tone]}`}>
        {badge ?? (Icon ? <Icon className="h-4 w-4" /> : null)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-900">{title}</p>
        <p className="truncate text-xs font-semibold text-slate-500">{subtitle}</p>
      </div>
      {value && <p className="flex-shrink-0 text-xs font-black text-brand-800">{value}</p>}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone: 'blue' | 'orange' | 'amber' }) {
  const tones = {
    blue: 'from-sky-50 to-blue-50 border-sky-100 text-blue-900',
    orange: 'from-orange-50 to-red-50 border-orange-100 text-orange-900',
    amber: 'from-amber-50 to-orange-50 border-amber-100 text-amber-900',
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-3 ${tones[tone]}`}>
      <p className="truncate text-[0.66rem] font-black uppercase tracking-[0.12em] opacity-80">{label}</p>
      <p className="mt-2 truncate text-base font-black">{value}</p>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-emerald-950/10 bg-white p-3 text-center text-xs font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-brand-900"
    >
      <Icon className="h-6 w-6 text-slate-600 transition group-hover:text-brand-800" />
      {label}
      <ArrowRight className="h-3.5 w-3.5 text-transparent transition group-hover:text-brand-700" />
    </button>
  );
}
