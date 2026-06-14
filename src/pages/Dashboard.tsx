import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate } from '../lib/formatters';
import { applyCfaSettlementTolerance } from '../lib/cfaSettlement';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  DoorOpen,
  FileCheck2,
  FileText,
  Home,
  LayoutDashboard,
  LineChart as LineChartIcon,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PageSkeleton } from '../components/ui/Skeleton';
import { readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { DemoDataLoader } from '../components/billing/DemoDataLoader';
import { OwnerWorkspace } from '../components/owner/OwnerWorkspace';
import { PremiumPageShell } from '../components/ui/PremiumPageShell';
import { PremiumButton } from '../components/ui/PremiumButton';
import { MoneyText } from '../components/ui/MoneyText';

const FR_MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

interface DashboardStats {
  totalBailleurs: number;
  totalImmeubles: number;
  totalUnites: number;
  unitesLibres: number;
  unitesLouees: number;
  totalLocataires: number;
  contratsActifs: number;
  revenusMois: number;
  impayesMois: number;
  nbPaiementsMois: number;
  nbImpayesMois: number;
  tauxOccupation: number;
}

interface MonthlyPoint {
  month: string;
  monthKey: string;
  encaissements: number;
  commissions: number;
  depenses: number;
  impayes: number;
  marge: number;
}

interface PaiementRow {
  id: string;
  contrat_id: string | null;
  montant_total: number | string | null;
  part_agence: number | string | null;
  part_bailleur: number | string | null;
  reliquat: number | string | null;
  statut: string | null;
  mois_concerne: string | null;
  date_paiement: string | null;
  created_at: string | null;
  reference: string | null;
  contrats?: {
    loyer_mensuel?: number | string | null;
    locataires?: { nom?: string | null; prenom?: string | null } | null;
    unites?: {
      id?: string | null;
      nom?: string | null;
      immeubles?: {
        nom?: string | null;
        bailleurs?: { id?: string | null; nom?: string | null; prenom?: string | null } | null;
      } | null;
    } | null;
  } | null;
}

interface ContratRow {
  id: string;
  date_debut: string | null;
  date_fin: string | null;
  loyer_mensuel: number | string | null;
  statut: string | null;
  created_at: string | null;
  locataires?: { nom?: string | null; prenom?: string | null } | null;
  unites?: {
    id?: string | null;
    nom?: string | null;
    immeubles?: {
      nom?: string | null;
      bailleurs?: { id?: string | null; nom?: string | null; prenom?: string | null } | null;
    } | null;
  } | null;
}

interface UniteRow {
  id: string;
  nom: string | null;
  statut: string | null;
  actif: boolean | null;
  loyer_base: number | string | null;
  immeubles?: { nom?: string | null } | null;
}

interface ImmeubleRow {
  id: string;
  nom: string | null;
  actif: boolean | null;
}

interface BailleurRow {
  id: string;
  nom: string | null;
  prenom: string | null;
  actif: boolean | null;
}

interface DepenseRow {
  id: string;
  montant: number | string | null;
  date_depense: string | null;
  categorie: string | null;
  description: string | null;
}

interface DocumentRow {
  id: string;
  name: string | null;
  document_category?: string | null;
  entity_type?: string | null;
  lifecycle_status?: string | null;
  created_at: string | null;
}

interface EventRow {
  id: string;
  event_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
}

interface DashboardData {
  stats: DashboardStats;
  monthly: MonthlyPoint[];
  paiements: PaiementRow[];
  contrats: ContratRow[];
  unites: UniteRow[];
  immeubles: ImmeubleRow[];
  bailleurs: BailleurRow[];
  depenses: DepenseRow[];
  documents: DocumentRow[];
  events: EventRow[];
}

interface DashboardProps {
  onNavigate?: (page: string) => void;
  onStartSetupWizard?: () => void;
}

interface PriorityItem {
  id: string;
  title: string;
  value: ReactNode;
  description: string;
  tone: 'red' | 'amber' | 'emerald' | 'slate';
  icon: typeof AlertCircle;
  actionLabel: string;
  page: string;
}

interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  amount?: number;
  sortAt?: string | null;
  tone: 'emerald' | 'amber' | 'red' | 'slate';
  icon: typeof AlertCircle;
  page: string;
}

interface WatchItem {
  id: string;
  title: string;
  subtitle: string;
  value?: ReactNode;
  tone: 'red' | 'amber' | 'emerald' | 'slate';
  page: string;
}

const EMPTY_STATS: DashboardStats = {
  totalBailleurs: 0,
  totalImmeubles: 0,
  totalUnites: 0,
  unitesLibres: 0,
  unitesLouees: 0,
  totalLocataires: 0,
  contratsActifs: 0,
  revenusMois: 0,
  impayesMois: 0,
  nbPaiementsMois: 0,
  nbImpayesMois: 0,
  tauxOccupation: 0,
};

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function monthKey(value: string | null | undefined): string {
  return String(value ?? '').slice(0, 7);
}

function isPaidStatus(status: string | null | undefined): boolean {
  return status === 'paye' || status === 'partiel';
}

function fullName(person?: { prenom?: string | null; nom?: string | null } | null, fallback = 'Non renseigné'): string {
  const name = `${person?.prenom ?? ''} ${person?.nom ?? ''}`.trim();
  return name || fallback;
}

function relativeDate(value: string | null | undefined): string {
  if (!value) return 'Date non renseignée';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);

  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diff / 60_000));
  if (minutes < 2) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `il y a ${days} j`;
  return formatDate(value);
}

function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const target = new Date(`${value.slice(0, 10)}T00:00:00.000Z`).getTime();
  const now = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - now) / 86_400_000);
}

function monthLabel(key: string): string {
  const [year, rawMonth] = key.split('-');
  const month = Number(rawMonth);
  const label = FR_MONTHS[month - 1] ?? key;
  return `${label} ${year}`;
}

function previousMonthKey(key: string): string {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function logOptionalDashboardError(source: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.warn(`[Dashboard] Source optionnelle indisponible: ${source}`, error);
  }
}

async function optionalQuery<T>(source: string, promise: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  try {
    const result = await promise;
    if (result.error) {
      logOptionalDashboardError(source, result.error);
      return [];
    }
    return (result.data || []) as T[];
  } catch (error) {
    logOptionalDashboardError(source, error);
    return [];
  }
}

function normalizeStats(raw: Record<string, unknown>): DashboardStats {
  const totalUnites = toNumber(raw.unites);
  const unitesLouees = toNumber(raw.unites_louees);
  return {
    totalBailleurs: toNumber(raw.bailleurs),
    totalImmeubles: toNumber(raw.immeubles),
    totalUnites,
    unitesLibres: toNumber(raw.unites_libres),
    unitesLouees,
    totalLocataires: toNumber(raw.locataires),
    contratsActifs: toNumber(raw.contrats_actifs),
    revenusMois: toNumber(raw.revenus_mois),
    impayesMois: toNumber(raw.impayes_mois),
    nbPaiementsMois: toNumber(raw.nb_payes_mois),
    nbImpayesMois: toNumber(raw.nb_impayes_mois),
    tauxOccupation: totalUnites > 0 ? (unitesLouees / totalUnites) * 100 : 0,
  };
}

function buildMonthlyPoints(
  year: number,
  monthlyRevenue: Array<{ month_num: number; revenus: number }>,
  paiements: PaiementRow[],
  depenses: DepenseRow[],
): MonthlyPoint[] {
  return FR_MONTHS.map((month, index) => {
    const monthKeyValue = `${year}-${String(index + 1).padStart(2, '0')}`;
    const rpcRevenue = monthlyRevenue.find((row) => Number(row.month_num) === index + 1)?.revenus;
    const monthPayments = paiements.filter((payment) => monthKey(payment.mois_concerne) === monthKeyValue && isPaidStatus(payment.statut));
    const encaissements = rpcRevenue != null
      ? toNumber(rpcRevenue)
      : monthPayments.reduce((sum, payment) => sum + toNumber(payment.montant_total), 0);
    const commissions = monthPayments.reduce((sum, payment) => sum + toNumber(payment.part_agence), 0);
    const impayes = monthPayments.reduce((sum, payment) => sum + applyCfaSettlementTolerance(toNumber(payment.reliquat)), 0);
    const totalDepenses = depenses
      .filter((depense) => monthKey(depense.date_depense) === monthKeyValue)
      .reduce((sum, depense) => sum + toNumber(depense.montant), 0);

    return {
      month,
      monthKey: monthKeyValue,
      encaissements,
      commissions,
      depenses: totalDepenses,
      impayes,
      marge: commissions - totalDepenses,
    };
  });
}

export function Dashboard({ onNavigate, onStartSetupWizard }: DashboardProps = {}) {
  const { accountProfile } = useAuth();

  if (accountProfile.isIndividualOwner) {
    return <OwnerWorkspace onNavigate={onNavigate} onStartSetupWizard={onStartSetupWizard} />;
  }

  return <AgencyDashboard onNavigate={onNavigate} onStartSetupWizard={onStartSetupWizard} />;
}

function AgencyDashboard({ onNavigate, onStartSetupWizard }: DashboardProps = {}) {
  const { profile, user, loading: authLoading } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    stats: EMPTY_STATS,
    monthly: [],
    paiements: [],
    contrats: [],
    unites: [],
    immeubles: [],
    bailleurs: [],
    depenses: [],
    documents: [],
    events: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);

  const loadDashboardData = useCallback(async () => {
    if (!profile?.agency_id) {
      setLoading(false);
      return;
    }

    try {
      const agencyId = profile.agency_id;
      const year = Number(selectedMonth.slice(0, 4)) || new Date().getFullYear();
      const dashboard = await readWithCache(
        { agencyId, userId: user?.id ?? null },
        `dashboard:${selectedMonth}`,
        async () => {
          const [statsRes, monthlyRes, paiementsRes, contratsRes, unitesRes, immeublesRes, bailleursRes, depensesRes] = await Promise.all([
            supabase.rpc('get_dashboard_stats', {
              p_agency_id: agencyId,
              p_year_month: selectedMonth,
            }),
            supabase.rpc('get_monthly_revenue', {
              p_agency_id: agencyId,
              p_year: year,
            }),
            supabase
              .from('paiements')
              .select('id, contrat_id, montant_total, part_agence, part_bailleur, reliquat, statut, mois_concerne, date_paiement, created_at, reference, contrats(loyer_mensuel, locataires(nom, prenom), unites(id, nom, immeubles(nom, bailleurs(id, nom, prenom))))')
              .eq('agency_id', agencyId)
              .gte('mois_concerne', `${year}-01-01`)
              .order('created_at', { ascending: false })
              .limit(400),
            supabase
              .from('contrats')
              .select('id, date_debut, date_fin, loyer_mensuel, statut, created_at, locataires(nom, prenom), unites(id, nom, immeubles(nom, bailleurs(id, nom, prenom)))')
              .eq('agency_id', agencyId)
              .order('created_at', { ascending: false })
              .limit(500),
            supabase
              .from('unites')
              .select('id, nom, statut, actif, loyer_base, immeubles(nom)')
              .eq('agency_id', agencyId)
              .eq('actif', true)
              .limit(500),
            supabase
              .from('immeubles')
              .select('id, nom, actif')
              .eq('agency_id', agencyId)
              .eq('actif', true)
              .limit(500),
            supabase
              .from('bailleurs')
              .select('id, nom, prenom, actif')
              .eq('agency_id', agencyId)
              .eq('actif', true)
              .limit(500),
            supabase
              .from('depenses')
              .select('id, montant, date_depense, categorie, description')
              .eq('agency_id', agencyId)
              .gte('date_depense', `${year}-01-01`)
              .order('date_depense', { ascending: false })
              .limit(300),
          ]);

          if (statsRes.error) throw statsRes.error;
          if (monthlyRes.error) throw monthlyRes.error;
          if (paiementsRes.error) throw paiementsRes.error;
          if (contratsRes.error) throw contratsRes.error;
          if (unitesRes.error) throw unitesRes.error;
          if (immeublesRes.error) throw immeublesRes.error;
          if (bailleursRes.error) throw bailleursRes.error;
          if (depensesRes.error) throw depensesRes.error;

          const [documents, events] = await Promise.all([
            optionalQuery<DocumentRow>(
              'documents',
              supabase
                .from('documents')
                .select('id, name, document_category, entity_type, lifecycle_status, created_at')
                .eq('agency_id', agencyId)
                .order('created_at', { ascending: false })
                .limit(30),
            ),
            optionalQuery<EventRow>(
              'event_log',
              supabase
                .from('event_log')
                .select('id, event_type, entity_type, entity_id, payload, created_at')
                .eq('agency_id', agencyId)
                .order('created_at', { ascending: false })
                .limit(30),
            ),
          ]);

          const stats = normalizeStats((statsRes.data || {}) as Record<string, unknown>);
          const paiements = (paiementsRes.data || []) as unknown as PaiementRow[];
          const contrats = (contratsRes.data || []) as unknown as ContratRow[];
          const unites = (unitesRes.data || []) as unknown as UniteRow[];
          const immeubles = (immeublesRes.data || []) as unknown as ImmeubleRow[];
          const bailleurs = (bailleursRes.data || []) as unknown as BailleurRow[];
          const depenses = (depensesRes.data || []) as unknown as DepenseRow[];
          const monthlyRevenue = (monthlyRes.data || []) as Array<{ month_num: number; revenus: number }>;

          return {
            stats,
            monthly: buildMonthlyPoints(year, monthlyRevenue, paiements, depenses),
            paiements,
            contrats,
            unites,
            immeubles,
            bailleurs,
            depenses,
            documents,
            events,
          } satisfies DashboardData;
        },
        { timeoutMs: 10_000 },
      );

      setDashboardData(dashboard.data);
      setCacheTimestamp(dashboard.source === 'cache' ? dashboard.timestamp : null);

      const stats = dashboard.data.stats;
      const hasBusinessData =
        stats.totalImmeubles > 0 ||
        stats.totalUnites > 0 ||
        stats.totalLocataires > 0 ||
        stats.contratsActifs > 0 ||
        stats.nbPaiementsMois > 0;
      setIsNewUser(dashboard.source !== 'cache' && stats.totalBailleurs === 0 && !hasBusinessData);
      setError(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Une erreur est survenue lors du chargement du tableau de bord.',
      );
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id, selectedMonth, user?.id]);

  useEffect(() => {
    if (profile?.agency_id) {
      void loadDashboardData();
    } else if (!authLoading && profile && !profile.agency_id) {
      setLoading(false);
      setError('Aucune agence associée à votre compte.');
    } else if (!authLoading && !profile) {
      setLoading(false);
      setError('Impossible de charger votre profil.');
    }
  }, [profile?.agency_id, authLoading, profile, loadDashboardData]);

  useEffect(() => {
    const handler = (event: Event) => {
      const domains = (event as CustomEvent<{ domains?: string[] }>).detail?.domains ?? [];
      if (domains.length === 0 || domains.includes('dashboard')) {
        void loadDashboardData();
      }
    };
    window.addEventListener('samaykeur:data-changed', handler);
    return () => window.removeEventListener('samaykeur:data-changed', handler);
  }, [loadDashboardData]);

  const model = useMemo(() => buildDashboardModel(dashboardData, selectedMonth), [dashboardData, selectedMonth]);

  if (loading) {
    return <PageSkeleton title="Tableau de bord" variant="dashboard" />;
  }

  if (error) {
    return (
      <PremiumPageShell className="flex min-h-full items-center justify-center">
        <div className="max-w-md rounded-[1.75rem] border border-red-100 bg-white p-7 text-center shadow-[0_24px_70px_rgba(127,29,29,0.12)]">
          <AlertCircle className="mx-auto mb-4 h-14 w-14 text-red-500" />
          <h2 className="text-2xl font-black text-slate-950">Tableau de bord indisponible</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{error}</p>
          <PremiumButton
            variant="primary"
            size="lg"
            className="mt-6"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => {
              if (!profile?.agency_id) {
                setError("Votre compte n'a pas d'agence associée.");
                return;
              }
              setError(null);
              setLoading(true);
              void loadDashboardData();
            }}
          >
            Réessayer
          </PremiumButton>
        </div>
      </PremiumPageShell>
    );
  }

  if (isNewUser) {
    return <NewAgencyDashboard onNavigate={onNavigate} onStartSetupWizard={onStartSetupWizard} onLoaded={loadDashboardData} />;
  }

  return (
    <PremiumPageShell className="space-y-4 pb-28 sm:space-y-5 lg:pb-8">
      <DashboardHeader
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        onNavigate={onNavigate}
      />

      {cacheTimestamp && <OfflineDataNotice cachedAt={cacheTimestamp} onRetry={loadDashboardData} />}
      <DemoDataLoader variant="resetBanner" onLoaded={loadDashboardData} />

      <DashboardAlert model={model} onNavigate={onNavigate} />

      <MetricGrid model={model} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.18fr)_minmax(320px,0.72fr)]">
        <div className="order-1">
          <DashboardPriorityList priorities={model.priorities} onNavigate={onNavigate} />
        </div>
        <div className="order-3 xl:order-2">
          <DashboardFinancialSummary model={model} onNavigate={onNavigate} />
        </div>
        <div className="order-4 xl:order-3">
          <DashboardHealthCard model={model} onNavigate={onNavigate} />
        </div>
        <div className="order-5 xl:order-4">
          <DashboardActivityFeed items={model.activities} onNavigate={onNavigate} />
        </div>
        <div className="order-6 xl:order-5">
          <DashboardWatchList items={model.watchItems} onNavigate={onNavigate} />
        </div>
        <div className="order-2 xl:order-6">
          <TopUnpaidList items={model.topUnpaid} onNavigate={onNavigate} />
        </div>
      </div>

      <DashboardQuickActions onNavigate={onNavigate} />
    </PremiumPageShell>
  );
}

function buildDashboardModel(data: DashboardData, selectedMonth: string) {
  const { stats, paiements, contrats, unites, immeubles, bailleurs, depenses, documents, events } = data;
  const previousKey = previousMonthKey(selectedMonth);
  const monthPayments = paiements.filter((payment) => monthKey(payment.mois_concerne) === selectedMonth && isPaidStatus(payment.statut));
  const previousPayments = paiements.filter((payment) => monthKey(payment.mois_concerne) === previousKey && isPaidStatus(payment.statut));
  const monthDepenses = depenses.filter((depense) => monthKey(depense.date_depense) === selectedMonth);
  const activeContracts = contrats.filter((contrat) => contrat.statut === 'actif');

  const encaissements = monthPayments.reduce((sum, payment) => sum + toNumber(payment.montant_total), 0) || stats.revenusMois;
  const previousEncaissements = previousPayments.reduce((sum, payment) => sum + toNumber(payment.montant_total), 0);
  const commissions = monthPayments.reduce((sum, payment) => sum + toNumber(payment.part_agence), 0);
  const previousCommissions = previousPayments.reduce((sum, payment) => sum + toNumber(payment.part_agence), 0);
  const netBailleurs = monthPayments.reduce(
    (sum, payment) => sum + (payment.part_bailleur != null ? toNumber(payment.part_bailleur) : Math.max(0, toNumber(payment.montant_total) - toNumber(payment.part_agence))),
    0,
  );
  const depensesMois = monthDepenses.reduce((sum, depense) => sum + toNumber(depense.montant), 0);
  const reliquatsFromPayments = monthPayments.reduce((sum, payment) => sum + applyCfaSettlementTolerance(toNumber(payment.reliquat)), 0);
  const expectedRent = activeContracts.reduce((sum, contrat) => sum + toNumber(contrat.loyer_mensuel), 0);
  const monthTrend = data.monthly.find((point) => point.monthKey === selectedMonth);
  const margeNette = (monthTrend?.marge ?? commissions - depensesMois);
  const revenueChange = percentChange(encaissements, previousEncaissements);
  const commissionChange = percentChange(commissions, previousCommissions);
  const occupancy = Math.round(stats.tauxOccupation);

  const contractBalances = activeContracts
    .map((contrat) => {
      const paid = monthPayments
        .filter((payment) => payment.contrat_id === contrat.id)
        .reduce((sum, payment) => sum + toNumber(payment.montant_total), 0);
      const loyer = toNumber(contrat.loyer_mensuel);
      const remaining = applyCfaSettlementTolerance(Math.max(0, loyer - paid));
      return {
        id: contrat.id,
        remaining,
        tenant: fullName(contrat.locataires, 'Locataire non renseigné'),
        unit: contrat.unites?.nom ?? 'Unité non renseignée',
        property: contrat.unites?.immeubles?.nom ?? 'Bien non renseigné',
        dateFin: contrat.date_fin,
      };
    })
    .filter((item) => item.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  const contractBalanceTotal = contractBalances.reduce((sum, item) => sum + item.remaining, 0);
  const reliquats = Math.max(applyCfaSettlementTolerance(stats.impayesMois), reliquatsFromPayments, contractBalanceTotal);
  const unpaidCount = reliquats > 0 ? (contractBalances.length || stats.nbImpayesMois) : 0;

  const expiringContracts = activeContracts
    .map((contrat) => ({ contrat, days: daysUntil(contrat.date_fin) }))
    .filter((item): item is { contrat: ContratRow; days: number } => item.days !== null && item.days >= 0 && item.days <= 45)
    .sort((a, b) => a.days - b.days);

  const vacantUnits = unites.filter((unit) => ['libre', 'vacant'].includes(String(unit.statut ?? '').toLowerCase()));
  const pendingDocuments = documents.filter((document) => {
    const status = String(document.lifecycle_status ?? '').toLowerCase();
    return status === 'temporary' || status === 'orphaned';
  });

  const priorities: PriorityItem[] = [
    {
      id: 'unpaid',
      title: 'Relances à suivre',
      value: `${unpaidCount} dossier${unpaidCount > 1 ? 's' : ''}`,
      description: reliquats > 0 ? `${formatCurrency(reliquats)} à recouvrer` : 'Aucun reliquat critique',
      tone: reliquats > 0 ? 'red' : 'emerald',
      icon: reliquats > 0 ? AlertCircle : CheckCircle2,
      actionLabel: 'Voir les impayés',
      page: 'loyers-impayes',
    },
    {
      id: 'expiring',
      title: 'Baux proches échéance',
      value: `${expiringContracts.length} location${expiringContracts.length > 1 ? 's' : ''}`,
      description: expiringContracts.length > 0 ? 'À renouveler ou clôturer' : 'Aucun bail critique',
      tone: expiringContracts.length > 0 ? 'amber' : 'emerald',
      icon: CalendarClock,
      actionLabel: 'Voir les locations',
      page: 'occupants-baux',
    },
    {
      id: 'vacant',
      title: 'Unités libres',
      value: `${vacantUnits.length || stats.unitesLibres} unité${(vacantUnits.length || stats.unitesLibres) > 1 ? 's' : ''}`,
      description: 'Potentiel de remise en location',
      tone: (vacantUnits.length || stats.unitesLibres) > 0 ? 'amber' : 'emerald',
      icon: DoorOpen,
      actionLabel: 'Voir le patrimoine',
      page: 'patrimoine',
    },
    {
      id: 'documents',
      title: 'Documents à classer',
      value: `${pendingDocuments.length} document${pendingDocuments.length > 1 ? 's' : ''}`,
      description: pendingDocuments.length > 0 ? 'À finaliser dans la GED' : 'GED propre ce mois-ci',
      tone: pendingDocuments.length > 0 ? 'amber' : 'slate',
      icon: FileCheck2,
      actionLabel: 'Ouvrir documents',
      page: 'documents',
    },
  ];

  const eventActivities = events.map((event) => mapEventToActivity(event));
  const paymentActivities = monthPayments.slice(0, 5).map((payment) => ({
    id: `payment-${payment.id}`,
    title: 'Paiement encaissé',
    subtitle: `${fullName(payment.contrats?.locataires, 'Locataire')} · ${payment.contrats?.unites?.nom ?? 'Unité'}`,
    meta: relativeDate(payment.created_at || payment.date_paiement),
    sortAt: payment.created_at || payment.date_paiement,
    amount: toNumber(payment.montant_total),
    tone: 'emerald' as const,
    icon: Wallet,
    page: 'paiements',
  }));
  const documentActivities = documents.slice(0, 4).map((document) => ({
    id: `document-${document.id}`,
    title: 'Document généré',
    subtitle: document.name ?? document.document_category ?? 'Document',
    meta: relativeDate(document.created_at),
    sortAt: document.created_at,
    tone: 'slate' as const,
    icon: FileText,
    page: 'documents',
  }));
  const activities = [...eventActivities, ...paymentActivities, ...documentActivities]
    .sort((a, b) => {
      const aTime = new Date(a.sortAt ?? '').getTime();
      const bTime = new Date(b.sortAt ?? '').getTime();
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    })
    .slice(0, 6);

  const watchItems: WatchItem[] = [

    ...expiringContracts.slice(0, 3).map(({ contrat, days }) => ({
      id: `watch-expiring-${contrat.id}`,
      title: fullName(contrat.locataires, 'Location'),
      subtitle: `${contrat.unites?.nom ?? 'Unité'} · expire dans ${days} jour${days > 1 ? 's' : ''}`,
      value: contrat.date_fin ? formatDate(contrat.date_fin) : 'Sans date',
      tone: 'amber' as const,
      page: 'occupants-baux',
    })),
    ...vacantUnits.slice(0, 2).map((unit) => ({
      id: `watch-unit-${unit.id}`,
      title: unit.nom ?? 'Unité libre',
      subtitle: unit.immeubles?.nom ?? 'Bien non renseigné',
      value: <MoneyText value={unit.loyer_base ?? 0} compact />,
      tone: 'slate' as const,
      page: 'patrimoine',
    })),
    ...pendingDocuments.slice(0, 2).map((document) => ({
      id: `watch-document-${document.id}`,
      title: document.name ?? 'Document à classer',
      subtitle: document.document_category ?? 'GED',
      value: 'À traiter',
      tone: 'amber' as const,
      page: 'documents',
    })),
  ].slice(0, 6);

  const topUnpaid: WatchItem[] = contractBalances.slice(0, 5).map((item) => ({
    id: `top-${item.id}`,
    title: item.tenant,
    subtitle: `${item.unit} · ${item.property}`,
    value: formatCurrency(item.remaining),
    tone: 'red',
    page: 'loyers-impayes',
  }));

  const healthMessage = reliquats > 0
    ? 'Attention : plusieurs reliquats doivent être suivis.'
    : occupancy >= 90
      ? 'Portefeuille stable, occupation élevée.'
      : 'Potentiel de croissance : des unités peuvent encore être louées.';

  return {
    selectedLabel: monthLabel(selectedMonth),
    stats,
    encaissements,
    previousEncaissements,
    revenueChange,
    commissionChange,
    reliquats,
    unpaidCount,
    commissions,
    netBailleurs,
    depensesMois,
    margeNette,
    expectedRent,
    occupancy,
    locationsActives: activeContracts.length || stats.contratsActifs,
    properties: immeubles.length || stats.totalImmeubles,
    bailleurs: bailleurs.length || stats.totalBailleurs,
    units: unites.length || stats.totalUnites,
    occupiedUnits: stats.unitesLouees,
    vacantUnits: vacantUnits.length || stats.unitesLibres,
    tenants: stats.totalLocataires,
    monthly: data.monthly,
    priorities,
    activities,
    watchItems,
    topUnpaid,
    healthMessage,
  };
}

function mapEventToActivity(event: EventRow): ActivityItem {
  const type = String(event.event_type ?? 'activity').toLowerCase();
  const payload = event.payload ?? {};
  const amount = firstNumber(payload, ['montant', 'montant_total', 'amount', 'loyer_mensuel']);
  const businessRef = firstText(payload, ['locataire', 'occupant', 'bailleur', 'name', 'nom_complet', 'reference', 'ref', 'unit', 'unite']) ?? 'Dossier Samay Këur';

  const title = type.includes('paiement')
    ? type.includes('cancel') || type.includes('annul') ? 'Paiement annulé' : 'Paiement encaissé'
    : type.includes('contrat') || type.includes('bail')
      ? type.includes('created') || type.includes('create') ? 'Location créée' : type.includes('renew') ? 'Location renouvelée' : 'Location mise à jour'
      : type.includes('document')
        ? type.includes('created') || type.includes('generate') ? 'Document généré' : 'Document traité'
        : type.includes('bailleur')
          ? 'Bailleur mis à jour'
          : type.includes('immeuble') || type.includes('unite')
            ? 'Patrimoine mis à jour'
            : 'Action enregistrée';
  const page = type.includes('paiement')
    ? 'paiements'
    : type.includes('contrat') || type.includes('bail')
      ? 'occupants-baux'
      : type.includes('document')
        ? 'documents'
        : type.includes('bailleur')
          ? 'bailleurs'
          : type.includes('immeuble') || type.includes('unite')
            ? 'patrimoine'
            : 'notifications';

  return {
    id: `event-${event.id}`,
    title,
    subtitle: businessRef,
    meta: relativeDate(event.created_at),
    amount,
    tone: type.includes('cancel') || type.includes('resilie') ? 'red' : type.includes('created') ? 'emerald' : 'slate',
    icon: type.includes('paiement') ? Wallet : type.includes('contrat') ? FileText : Sparkles,
    sortAt: event.created_at,
    page,
  };
}

function firstText(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function firstNumber(payload: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toNumber(payload[key]);
    if (value > 0) {
      return value;
    }
  }
  return undefined;
}

function NewAgencyDashboard({ onNavigate, onStartSetupWizard, onLoaded }: DashboardProps & { onLoaded: () => void }) {
  return (
    <PremiumPageShell className="space-y-6 lg:space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-emerald-950/5 bg-[linear-gradient(135deg,#FDFBF7_0%,#F3F9F6_100%)] p-7 shadow-[0_24px_60px_rgba(6,17,13,0.06)] lg:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full bg-orange-200/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-brand-800 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-emerald-900/5">
            <Sparkles className="h-8 w-8" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-action-600">Cockpit Samay Këur</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Votre agence est prête à être structurée.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-8 text-slate-600 sm:text-lg">
            Commencez par créer votre premier bailleur, puis rattachez ses biens, ses locations et ses paiements.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PremiumButton
              variant="primary"
              size="lg"
              icon={<UserRound className="h-5 w-5" />}
              onClick={() => onNavigate?.('bailleurs')}
            >
              Créer mon premier bailleur
            </PremiumButton>
            <PremiumButton
              variant="secondary"
              size="lg"
              icon={<LayoutDashboard className="h-5 w-5" />}
              onClick={onStartSetupWizard}
            >
              Reprendre le wizard
            </PremiumButton>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <section className="rounded-[1.5rem] border border-emerald-950/10 bg-white/95 p-5 shadow-[0_16px_46px_rgba(15,23,42,0.055)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-950">Feuille de route</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">0/4 étapes</span>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              ['Créer un bailleur', 'Le propriétaire légal du bien.', UserRound, 'bailleurs'],
              ['Ajouter un bien', 'Rattachez un immeuble ou une maison.', Building2, 'patrimoine'],
              ['Créer une location', 'Associez un locataire à une unité.', FileText, 'occupants-baux'],
              ['Enregistrer un paiement', 'Suivez le premier loyer encaissé.', Wallet, 'paiements'],
            ].map(([title, description, Icon, page], index) => (
              <button
                key={String(title)}
                type="button"
                onClick={() => onNavigate?.(String(page))}
                className="flex w-full items-center gap-4 py-4 text-left transition hover:bg-emerald-50/55"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${index === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-500'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-950">{index + 1}. {String(title)}</p>
                  <p className="text-sm text-slate-600">{String(description)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-[1.5rem] border border-emerald-950/10 bg-[#fffdf8] p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Tester avec des exemples</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Générez des données fictives pour découvrir le cockpit avant de configurer vos vrais dossiers.
          </p>
          <div className="mt-5">
            <DemoDataLoader variant="compact" onLoaded={onLoaded} />
          </div>
        </section>
      </div>
    </PremiumPageShell>
  );
}

function DashboardHeader({
  selectedMonth,
  onMonthChange,
  onNavigate,
}: {
  selectedMonth: string;
  onMonthChange: (value: string) => void;
  onNavigate?: (page: string) => void;
}) {
  return (
    <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-action-600">Pilotage agence</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Tableau de bord</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
          Vue unifiée de votre portefeuille locatif, vos encaissements et vos priorités.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:flex xl:items-center">
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-950/10 bg-white/95 px-3 py-2 text-left text-sm font-bold text-slate-800 shadow-sm">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <span className="flex flex-col">
            <span className="text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">Période</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => onMonthChange(event.target.value || CURRENT_MONTH)}
              className="w-36 bg-transparent text-sm font-black text-slate-950 outline-none"
              aria-label="Période du tableau de bord"
            />
          </span>
        </label>

        <PremiumButton
          variant="primary"
          icon={<Wallet className="h-4 w-4" />}
          onClick={() => onNavigate?.('paiements')}
        >
          Enregistrer un paiement
        </PremiumButton>
        <PremiumButton
          variant="secondary"
          icon={<FileText className="h-4 w-4" />}
          onClick={() => onNavigate?.('tableau-de-bord-financier')}
        >
          Générer rapport PDF
        </PremiumButton>
      </div>
    </header>
  );
}

function DashboardAlert({ model, onNavigate }: { model: ReturnType<typeof buildDashboardModel>; onNavigate?: (page: string) => void }) {
  if (model.reliquats <= 0) {
    return (
      <button
        type="button"
        onClick={() => onNavigate?.('paiements')}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/75 px-4 py-3 text-left shadow-sm transition hover:bg-emerald-50"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700 ring-1 ring-emerald-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-emerald-950">Aucun impayé critique ce mois-ci</p>
            <p className="truncate text-sm font-medium text-emerald-800">Continuez à suivre les encaissements et les échéances.</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-emerald-800" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate?.('loyers-impayes')}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-left shadow-[0_14px_36px_rgba(185,28,28,0.08)] transition hover:bg-red-50"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-900/15">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-black text-red-950">
            {model.unpaidCount} loyer{model.unpaidCount > 1 ? 's' : ''} impayé{model.unpaidCount > 1 ? 's' : ''} à recouvrer
          </p>
          <p className="truncate text-sm font-semibold text-red-700">
            <MoneyText value={model.reliquats} /> en attente de paiement
          </p>
        </div>
      </div>
      <span className="hidden rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700 sm:inline-flex">
        Traiter les impayés
      </span>
      <ArrowRight className="h-4 w-4 text-red-700 sm:hidden" />
    </button>
  );
}

function MetricGrid({ model }: { model: ReturnType<typeof buildDashboardModel> }) {
  const metrics = [
    { label: 'Encaissements du mois', amount: model.encaissements, icon: Wallet, tone: 'emerald' as const, helper: `${model.stats.nbPaiementsMois} paiements`, accent: 'Volume locatif' },
    { label: 'Reliquats à recouvrer', amount: model.reliquats, icon: AlertCircle, tone: model.reliquats > 0 ? 'red' as const : 'emerald' as const, helper: `${model.unpaidCount} dossiers`, accent: 'À traiter' },
    { label: 'Net bailleurs', amount: model.netBailleurs, icon: Users, tone: 'emerald' as const, helper: 'À reverser', accent: 'Net propriétaire' },
    { label: 'Commissions agence', amount: model.commissions, icon: ReceiptText, tone: 'amber' as const, helper: 'Revenus agence', accent: 'Marge brute' },
    { label: 'Locations en cours', value: model.locationsActives, icon: Home, tone: 'slate' as const, helper: `${model.tenants} locataires`, accent: 'Actives' },
    { label: 'Occupation', value: `${model.occupancy}%`, icon: TrendingUp, tone: 'slate' as const, helper: `${model.occupiedUnits}/${model.units} unités`, accent: 'Patrimoine' },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
      {metrics.map((metric) => (
        <DashboardKpiCard key={metric.label} {...metric} />
      ))}
    </section>
  );
}

function DashboardKpiCard({
  label,
  value,
  amount,
  helper,
  accent,
  icon: Icon,
  tone,
}: {
  label: string;
  value?: ReactNode;
  amount?: number;
  helper: string;
  accent: string;
  icon: LucideIcon;
  tone: 'emerald' | 'red' | 'amber' | 'slate';
}) {
  const money = amount != null ? formatPrimaryCfa(amount) : null;
  const styles = {
    emerald: {
      card: 'border-emerald-200/55 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.075),transparent_42%),linear-gradient(135deg,#ffffff_0%,#f5fcf8_100%)] shadow-[0_14px_30px_rgba(4,120,87,0.06)] hover:border-emerald-300/70',
      icon: 'bg-emerald-50/85 text-emerald-800 ring-1 ring-emerald-200/70',
      accent: 'bg-emerald-50/80 text-emerald-800 ring-1 ring-emerald-200/70',
      amount: 'text-emerald-950',
      rail: 'from-emerald-300/65 via-emerald-500/65 to-emerald-700/60',
    },
    red: {
      card: 'border-red-200/60 bg-[radial-gradient(circle_at_top_right,rgba(248,113,113,0.075),transparent_42%),linear-gradient(135deg,#ffffff_0%,#fff9f9_100%)] shadow-[0_14px_30px_rgba(185,28,28,0.06)] hover:border-red-300/70',
      icon: 'bg-red-50/85 text-red-700 ring-1 ring-red-200/70',
      accent: 'bg-red-50/80 text-red-700 ring-1 ring-red-200/70',
      amount: 'text-red-950',
      rail: 'from-red-300/65 via-red-400/70 to-red-600/60',
    },
    amber: {
      card: 'border-amber-200/60 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.075),transparent_42%),linear-gradient(135deg,#ffffff_0%,#fffaf2_100%)] shadow-[0_14px_30px_rgba(154,91,17,0.055)] hover:border-amber-300/70',
      icon: 'bg-amber-50/85 text-amber-800 ring-1 ring-amber-200/70',
      accent: 'bg-amber-50/80 text-amber-800 ring-1 ring-amber-200/70',
      amount: 'text-amber-950',
      rail: 'from-amber-300/65 via-amber-500/65 to-amber-700/60',
    },
    slate: {
      card: 'border-slate-200/80 bg-[radial-gradient(circle_at_top_right,rgba(15,23,42,0.04),transparent_42%),linear-gradient(135deg,#ffffff_0%,#f9fafb_100%)] shadow-[0_14px_30px_rgba(15,23,42,0.055)] hover:border-slate-300/80',
      icon: 'bg-slate-50/90 text-slate-800 ring-1 ring-slate-200',
      accent: 'bg-slate-50/85 text-slate-700 ring-1 ring-slate-200',
      amount: 'text-slate-950',
      rail: 'from-slate-300/80 via-slate-500/70 to-slate-700/65',
    },
  }[tone];

  return (
    <article className={`group relative min-w-0 overflow-hidden rounded-[1.15rem] border p-2.5 ring-1 ring-white/80 transition duration-300 hover:-translate-y-0.5 sm:p-3 ${styles.card}`}>
      <div className={`absolute inset-x-4 top-0 h-0.5 rounded-b-full bg-gradient-to-r ${styles.rail}`} />
      <div className="pointer-events-none absolute -right-10 -top-12 h-20 w-20 rounded-full bg-white/45 blur-2xl transition duration-500 group-hover:scale-110" />
      <div className="relative flex min-h-[5.45rem] flex-col justify-between gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[0.54rem] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
            <span className={`mt-1.5 inline-flex rounded-full px-1.5 py-0.5 text-[0.52rem] font-black uppercase tracking-[0.06em] ${styles.accent}`}>
              {accent}
            </span>
          </div>
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition duration-300 group-hover:scale-105 ${styles.icon}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="min-w-0">
          {money ? (
            <p className={`whitespace-nowrap text-[clamp(0.92rem,1.62vw,1.22rem)] font-black leading-none tracking-tight tabular-nums ${styles.amount}`} title={formatCurrency(amount ?? 0)}>
              {money}
            </p>
          ) : (
            <p className={`text-[clamp(1.12rem,1.9vw,1.48rem)] font-black leading-none tracking-tight ${styles.amount}`}>
              {value}
            </p>
          )}
          <p className="mt-1 truncate text-[0.68rem] font-bold text-slate-600">{helper}</p>
        </div>
      </div>
    </article>
  );
}

function formatPrimaryCfa(value: number) {
  return formatCurrency(value).replace(/\s/g, '\u00A0');
}

function DashboardPriorityList({ priorities, onNavigate }: { priorities: PriorityItem[]; onNavigate?: (page: string) => void }) {
  return (
    <DashboardSection title="Priorités du mois" subtitle="Les dossiers qui méritent une action rapide.">
      <div className="space-y-2.5">
        {priorities.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.page)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-emerald-950/10 bg-white/90 p-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/55"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneIconClass(item.tone)}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-black text-slate-950">{item.title}</p>
                  <span className={`rounded-full px-2 py-1 text-[0.65rem] font-black ${toneBadgeClass(item.tone)}`}>
                    {item.actionLabel}
                  </span>
                </div>
                <p className="mt-0.5 text-sm font-bold text-slate-800">{item.value}</p>
                <p className="truncate text-xs font-medium text-slate-500">{item.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>
    </DashboardSection>
  );
}

function DashboardFinancialSummary({ model, onNavigate }: { model: ReturnType<typeof buildDashboardModel>; onNavigate?: (page: string) => void }) {
  const hasChartData = model.monthly.some((point) => point.commissions > 0 || point.depenses > 0 || point.marge !== 0);
  return (
    <DashboardSection
      title={`Performance agence — ${model.selectedLabel}`}
      subtitle="Commissions, dépenses et marge nette. Les encaissements restent le volume locatif traité."
      action={<button type="button" onClick={() => onNavigate?.('tableau-de-bord-financier')} className="text-xs font-black text-emerald-800 hover:text-emerald-950">Voir le détail financier</button>}
    >
      <div className="grid gap-2.5 sm:grid-cols-4">
        <MiniFinance label="Volume locatif" value={<MoneyText value={model.encaissements} compact />} tone="slate" />
        <MiniFinance label="Commissions" value={<MoneyText value={model.commissions} compact />} tone="emerald" />
        <MiniFinance label="Dépenses" value={<MoneyText value={model.depensesMois} compact />} tone="red" />
        <MiniFinance label="Marge nette" value={<MoneyText value={model.margeNette} compact />} tone={model.margeNette >= 0 ? 'emerald' : 'red'} />
      </div>

      <div className="mt-4 h-56 sm:h-64">
        {hasChartData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={model.monthly} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="#E7DED0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelClassName="font-bold text-slate-900"
                contentStyle={{ borderRadius: '14px', border: '1px solid #d9e4dc', boxShadow: '0 18px 44px rgba(15,23,42,0.10)' }}
              />
              <Bar dataKey="commissions" name="Commissions" fill="#047857" radius={[8, 8, 0, 0]} maxBarSize={26} />
              <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" radius={[8, 8, 0, 0]} maxBarSize={20} />
              <Line type="monotone" dataKey="marge" name="Marge nette" stroke="#9A5B11" strokeWidth={2.5} dot={false} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <CompactEmptyState icon={LineChartIcon} title="Aucune donnée agence" text="Les commissions, dépenses et marges apparaîtront ici." />
        )}
      </div>

      {model.commissionChange !== null && (
        <p className={`mt-2 text-xs font-bold ${model.commissionChange >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
          {model.commissionChange >= 0 ? '↗' : '↘'} {Math.abs(model.commissionChange)}% sur les commissions vs mois précédent
        </p>
      )}
    </DashboardSection>
  );
}

function DashboardHealthCard({ model, onNavigate }: { model: ReturnType<typeof buildDashboardModel>; onNavigate?: (page: string) => void }) {
  const occupancy = Math.max(0, Math.min(100, model.occupancy));
  return (
    <DashboardSection
      title="Santé du portefeuille"
      subtitle={model.healthMessage}
      action={<button type="button" onClick={() => onNavigate?.('patrimoine')} className="text-xs font-black text-emerald-800 hover:text-emerald-950">Voir patrimoine</button>}
    >
      <div className="flex items-center gap-4">
        <div
          className="grid h-32 w-32 shrink-0 place-items-center rounded-full shadow-inner"
          style={{
            background: `conic-gradient(#047857 ${occupancy * 3.6}deg, #e7ded0 0deg)`,
          }}
          aria-label={`Taux d'occupation ${occupancy}%`}
        >
          <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center shadow-sm">
            <span className="text-2xl font-black text-slate-950">{occupancy}%</span>
            <span className="-mt-3 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-slate-500">Occupé</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <HealthLine label="Unités occupées" value={model.occupiedUnits} tone="emerald" />
          <HealthLine label="Unités libres" value={model.vacantUnits} tone={model.vacantUnits > 0 ? 'amber' : 'slate'} />
          <HealthLine label="Bailleurs actifs" value={model.bailleurs} tone="slate" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 divide-x divide-emerald-950/10 rounded-2xl border border-emerald-950/10 bg-[#fffdf8]">
        <HealthMini label="Biens" value={model.properties} />
        <HealthMini label="Unités" value={model.units} />
        <HealthMini label="Locataires" value={model.tenants} />
      </div>
    </DashboardSection>
  );
}

function DashboardActivityFeed({ items, onNavigate }: { items: ActivityItem[]; onNavigate?: (page: string) => void }) {
  return (
    <DashboardSection title="Activité récente" subtitle="Les derniers mouvements de votre agence.">
      {items.length === 0 ? (
        <CompactEmptyState icon={Sparkles} title="Aucune activité récente" text="Les paiements, locations, documents et rapports apparaîtront ici." />
      ) : (
        <div className="divide-y divide-emerald-950/10">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate?.(item.page)}
                className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-emerald-50/45"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneIconClass(item.tone)}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-950">{item.title}</p>
                  <p className="truncate text-xs font-medium text-slate-500">{item.subtitle}</p>
                </div>
                <div className="shrink-0 text-right">
                  {item.amount != null && <p className="text-xs font-black text-emerald-800"><MoneyText value={item.amount} compact /></p>}
                  <p className="text-[0.68rem] font-semibold text-slate-400">{item.meta}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </DashboardSection>
  );
}

function DashboardWatchList({ items, onNavigate }: { items: WatchItem[]; onNavigate?: (page: string) => void }) {
  return (
    <DashboardSection title="À surveiller cette semaine" subtitle="Échéances, documents et unités disponibles.">
      {items.length === 0 ? (
        <CompactEmptyState icon={CheckCircle2} title="Rien de critique" text="Aucune échéance urgente pour le moment." />
      ) : (
        <div className="divide-y divide-emerald-950/10">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.page)}
              className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-emerald-50/45"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${item.tone === 'red' ? 'bg-red-500' : item.tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-slate-950">{item.title}</span>
                <span className="block truncate text-xs font-medium text-slate-500">{item.subtitle}</span>
              </span>
              {item.value && <span className={`text-xs font-black ${item.tone === 'red' ? 'text-red-600' : 'text-slate-800'}`}>{item.value}</span>}
            </button>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

function TopUnpaidList({ items, onNavigate }: { items: WatchItem[]; onNavigate?: (page: string) => void }) {
  return (
    <DashboardSection title="Top impayés" subtitle="Les dossiers à traiter en premier.">
      {items.length === 0 ? (
        <CompactEmptyState icon={ShieldCheck} title="Aucun top impayé" text="Les dossiers en retard apparaîtront ici." />
      ) : (
        <div className="space-y-2.5">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.page)}
              className="flex w-full items-center gap-3 rounded-xl border border-emerald-950/10 bg-white/85 p-3 text-left transition hover:bg-red-50/50"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f7efe2] text-xs font-black text-slate-700">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-slate-950">{item.title}</span>
                <span className="block truncate text-xs font-medium text-red-600">{item.subtitle}</span>
              </span>
              <span className="shrink-0 text-right text-xs font-black leading-tight text-red-600">{item.value}</span>
            </button>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

function DashboardQuickActions({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const actions = [
    { label: 'Enregistrer paiement', page: 'paiements', icon: Wallet, variant: 'primary' as const },
    { label: 'Nouvelle location', page: 'occupants-baux', icon: Plus, variant: 'secondary' as const },
    { label: 'Nouveau bien', page: 'patrimoine', icon: Building2, variant: 'secondary' as const },
    { label: 'Documents', page: 'documents', icon: FileText, variant: 'secondary' as const },
    { label: 'Rapport PDF', page: 'tableau-de-bord-financier', icon: ReceiptText, variant: 'secondary' as const },
  ];

  return (
    <section className="rounded-[1.35rem] border border-emerald-950/10 bg-white/88 p-3 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-950">Actions rapides</h2>
          <p className="text-xs font-medium text-slate-500">Accès direct aux flux les plus utilisés.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <PremiumButton
                key={action.label}
                variant={action.variant}
                size="sm"
                icon={<Icon className="h-4 w-4" />}
                onClick={() => onNavigate?.(action.page)}
                className="justify-center"
              >
                {action.label}
              </PremiumButton>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DashboardSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-[1.35rem] border border-emerald-950/10 bg-white/92 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.055)] ring-1 ring-white/70 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-black text-slate-950">{title}</h2>
          {subtitle && <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-5 text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MiniFinance({ label, value, tone }: { label: string; value: ReactNode; tone: 'emerald' | 'red' | 'slate' }) {
  const cls = tone === 'emerald'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-900'
      : 'border-emerald-950/10 bg-[#fffdf8] text-slate-900';
  return (
    <div className={`rounded-xl border px-3 py-2 ${cls}`}>
      <p className="truncate text-[0.62rem] font-black uppercase tracking-[0.12em] opacity-65">{label}</p>
      <p className="mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}

function HealthLine({ label, value, tone }: { label: string; value: ReactNode; tone: 'emerald' | 'amber' | 'slate' }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <span className={`h-2.5 w-2.5 rounded-full ${tone === 'emerald' ? 'bg-emerald-600' : tone === 'amber' ? 'bg-amber-500' : 'bg-slate-300'}`} />
        {label}
      </span>
      <strong className="text-sm font-black text-slate-950">{value}</strong>
    </div>
  );
}

function HealthMini({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="text-lg font-black text-slate-950">{value}</p>
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}

function CompactEmptyState({ icon: Icon, title, text }: { icon: typeof Sparkles; title: string; text: string }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-emerald-950/15 bg-[#fffdf8] p-5 text-center">
      <div>
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" />
        </div>
        <p className="font-black text-slate-950">{title}</p>
        <p className="mt-1 text-sm font-medium text-slate-500">{text}</p>
      </div>
    </div>
  );
}

function toneIconClass(tone: 'red' | 'amber' | 'emerald' | 'slate') {
  if (tone === 'red') return 'bg-red-50 text-red-700 ring-1 ring-red-100';
  if (tone === 'amber') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
  if (tone === 'emerald') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
  return 'bg-slate-50 text-slate-700 ring-1 ring-slate-100';
}

function toneBadgeClass(tone: 'red' | 'amber' | 'emerald' | 'slate') {
  if (tone === 'red') return 'bg-red-50 text-red-700 ring-1 ring-red-100';
  if (tone === 'amber') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
  if (tone === 'emerald') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
  return 'bg-slate-50 text-slate-600 ring-1 ring-slate-100';
}
