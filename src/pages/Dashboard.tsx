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
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
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
        <div className="max-w-sm rounded-2xl border border-red-100 bg-white p-5 text-center shadow-[0_18px_54px_rgba(127,29,29,0.1)]">
          <AlertCircle className="mx-auto mb-3 h-9 w-9 text-red-500" />
          <h2 className="text-lg font-black text-slate-950">Tableau de bord indisponible</h2>
          <p className="mt-2 text-xs leading-5 text-slate-600">{error}</p>
          <PremiumButton
            variant="primary"
            size="sm"
            className="mt-4 !h-8 !px-3 !text-xs"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
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
    <PremiumPageShell className="space-y-2 pb-24 sm:space-y-2.5 lg:pb-5">
      <DashboardHeader
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        onNavigate={onNavigate}
      />

      {cacheTimestamp && <OfflineDataNotice cachedAt={cacheTimestamp} onRetry={loadDashboardData} />}
      <DemoDataLoader variant="resetBanner" onLoaded={loadDashboardData} />

      <DashboardAlert model={model} onNavigate={onNavigate} />

      <MetricGrid model={model} />

      <div className="grid gap-2.5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <DashboardFinancialSummary model={model} />
        </div>
        <div className="lg:col-span-4">
          <DashboardHealthCard model={model} onNavigate={onNavigate} />
        </div>
        <div className="lg:col-span-6">
          <DashboardPriorityList priorities={model.priorities} onNavigate={onNavigate} />
        </div>
        <div className="lg:col-span-6">
          <TopUnpaidList items={model.topUnpaid} onNavigate={onNavigate} />
        </div>
        <div className="lg:col-span-6 xl:col-span-5">
          <DashboardWatchList items={model.watchItems} onNavigate={onNavigate} />
        </div>
        <div className="lg:col-span-6 xl:col-span-7">
          <DashboardActivityFeed items={model.activities} onNavigate={onNavigate} />
        </div>
      </div>

      <div className="hidden sm:block">
        <DashboardQuickActions onNavigate={onNavigate} />
      </div>
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
    page: 'paiements',
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
  const businessRef = firstText(payload, ['locataire', 'occupant', 'bailleur', 'name', 'nom_complet', 'nom', 'prenom', 'reference', 'ref', 'unit', 'unite', 'immeuble', 'document_category', 'title']) ?? 'Dossier en cours';

  let title = 'Action enregistrée';
  if (type.includes('paiement')) {
    title = type.includes('cancel') || type.includes('annul') ? 'Paiement annulé' : 'Paiement encaissé';
  } else if (type.includes('contrat') || type.includes('bail')) {
    title = type.includes('created') || type.includes('create') ? 'Location créée' : type.includes('renew') ? 'Location renouvelée' : 'Contrat généré';
  } else if (type.includes('document')) {
    title = type.includes('created') || type.includes('generate') ? 'Document ajouté' : 'Document traité';
  } else if (type.includes('bailleur')) {
    title = type.includes('created') || type.includes('create') ? 'Bailleur ajouté' : 'Bailleur modifié';
  } else if (type.includes('immeuble')) {
    title = type.includes('created') || type.includes('create') ? 'Bien ajouté' : 'Bien modifié';
  } else if (type.includes('unite')) {
    title = type.includes('created') || type.includes('create') ? 'Unité créée' : 'Unité modifiée';
  } else if (type.includes('locataire')) {
    title = type.includes('created') || type.includes('create') ? 'Locataire ajouté' : 'Locataire modifié';
  } else {
    title = 'Mise à jour système';
  }
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
    <PremiumPageShell className="space-y-2.5 lg:space-y-3">
      <section className="relative overflow-hidden rounded-xl border border-emerald-950/5 bg-[linear-gradient(135deg,#FDFBF7_0%,#F3F9F6_100%)] p-3 shadow-[0_10px_26px_rgba(6,17,13,0.05)] lg:p-4">
        <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-emerald-200/28 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-36 w-36 rounded-full bg-orange-200/18 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand-800 shadow-[0_5px_14px_rgba(0,0,0,0.03)] ring-1 ring-emerald-900/5">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-action-600">Cockpit Samay Këur</p>
          <h2 className="mt-1.5 text-lg font-black tracking-tight text-slate-950 sm:text-xl">
            Votre agence est prête à être structurée.
          </h2>
          <p className="mx-auto mt-1.5 max-w-lg text-xs font-medium leading-4 text-slate-600">
            Commencez par créer votre premier bailleur, puis rattachez ses biens, ses locations et ses paiements.
          </p>
          <div className="mt-3 flex flex-col items-center justify-center gap-1.5 sm:flex-row">
            <PremiumButton
              variant="primary"
              size="sm"
              icon={<UserRound className="h-4 w-4" />}
              onClick={() => onNavigate?.('bailleurs')}
            >
              Créer mon premier bailleur
            </PremiumButton>
            <PremiumButton
              variant="secondary"
              size="sm"
              icon={<LayoutDashboard className="h-4 w-4" />}
              onClick={onStartSetupWizard}
            >
              Reprendre le wizard
            </PremiumButton>
          </div>
        </div>
      </section>

      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(220px,0.7fr)]">
        <section className="rounded-xl border border-emerald-950/10 bg-white/95 p-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-950">Feuille de route</h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.62rem] font-black text-emerald-800">0/4 étapes</span>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              ['Créer un bailleur', 'Le propriétaire légal du bien.', UserRound, '#/bailleurs?action=new'],
              ['Ajouter un bien', 'Rattachez un immeuble ou une maison.', Building2, '#/patrimoine?action=new'],
              ['Créer une location', 'Associez un locataire à une unité.', FileText, '#/occupants-baux?action=new-location'],
              ['Enregistrer un paiement', 'Suivez le premier loyer encaissé.', Wallet, '#/paiements?action=new'],
            ].map(([title, description, Icon, hashUrl], index) => (
              <button
                key={String(title)}
                type="button"
                onClick={() => { window.location.hash = String(hashUrl); }}
                className="flex w-full items-center gap-2 py-2 text-left transition hover:bg-emerald-50/55"
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-md ${index === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-500'}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.72rem] font-black text-slate-950">{index + 1}. {String(title)}</p>
                  <p className="text-[0.62rem] text-slate-600">{String(description)}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-emerald-950/10 bg-[#fffdf8] p-2.5 shadow-sm">
          <h2 className="text-xs font-black text-slate-950">Tester avec des exemples</h2>
          <p className="mt-1 text-[0.68rem] leading-4 text-slate-600">
            Générez des données fictives pour découvrir le cockpit avant de configurer vos vrais dossiers.
          </p>
          <div className="mt-2">
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
  onNavigate: _onNavigate,
}: {
  selectedMonth: string;
  onMonthChange: (value: string) => void;
  onNavigate?: (page: string) => void;
}) {
  return (
    <PremiumPageHeader
      density="ultraCompact"
      eyebrow="PILOTAGE AGENCE"
      title="Tableau de bord"
      description="Vue d'ensemble de vos performances locatives et financières."
      mobileDescription="Performances locatives."
      sideContent={
        <label className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-emerald-950/10 bg-white/95 px-2 text-left text-[0.68rem] font-bold text-slate-800 shadow-[0_2px_8px_rgba(15,23,42,0.03)] transition hover:border-emerald-200">
          <CalendarDays className="h-3.5 w-3.5 text-emerald-700" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => onMonthChange(event.target.value || CURRENT_MONTH)}
            className="w-[6.5rem] bg-transparent text-[0.68rem] font-black text-slate-900 outline-none"
            aria-label="Période du tableau de bord"
          />
        </label>
      }
      primaryAction={
        <PremiumButton
          variant="create"
          size="sm"
          icon={<Wallet className="h-3.5 w-3.5" />}
          onClick={() => { window.location.hash = '#/paiements?action=new'; }}
          className="!h-8 !px-2.5 !text-[0.7rem]"
        >
          Enregistrer un paiement
        </PremiumButton>
      }
    />
  );
}

function DashboardAlert({ model, onNavigate }: { model: ReturnType<typeof buildDashboardModel>; onNavigate?: (page: string) => void }) {
  if (model.reliquats <= 0) {
    return (
      <button
        type="button"
        onClick={() => onNavigate?.('paiements')}
        className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/75 px-3 py-2 text-left shadow-sm transition hover:bg-emerald-50"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-emerald-200">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.82rem] font-black text-emerald-950">Aucun impayé critique ce mois-ci</p>
            <p className="truncate text-[0.7rem] font-medium text-emerald-800">Continuez à suivre les encaissements et les échéances.</p>
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
      className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-left shadow-[0_10px_24px_rgba(185,28,28,0.065)] transition hover:bg-red-50"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white shadow-lg shadow-red-900/15">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[0.82rem] font-black text-red-950">
            {model.unpaidCount} loyer{model.unpaidCount > 1 ? 's' : ''} impayé{model.unpaidCount > 1 ? 's' : ''} à recouvrer
          </p>
          <p className="truncate text-[0.7rem] font-semibold text-red-700">
            <MoneyText value={model.reliquats} /> en attente de paiement
          </p>
        </div>
      </div>
      <span className="hidden rounded-lg border border-red-200 bg-white px-2 py-1 text-[0.65rem] font-black text-red-700 sm:inline-flex">
        Traiter les impayés
      </span>
      <ArrowRight className="h-4 w-4 text-red-700 sm:hidden" />
    </button>
  );
}

function MetricGrid({ model }: { model: ReturnType<typeof buildDashboardModel> }) {
  const metrics = [
    { label: 'Encaissements', amount: model.encaissements, icon: Wallet, tone: 'emerald' as const, helper: `${model.stats.nbPaiementsMois} paiements`, accent: 'Volume locatif' },
    { label: 'Reliquats', amount: model.reliquats, icon: AlertCircle, tone: model.reliquats > 0 ? 'red' as const : 'emerald' as const, helper: `${model.unpaidCount} dossiers`, accent: 'À traiter' },
    { label: 'Net bailleurs', amount: model.netBailleurs, icon: Users, tone: 'emerald' as const, helper: 'À reverser', accent: 'Net propriétaire' },
    { label: 'Commissions', amount: model.commissions, icon: ReceiptText, tone: 'amber' as const, helper: 'Revenus agence', accent: 'Marge brute' },
    { label: 'Baux actifs', value: model.locationsActives, icon: Home, tone: 'slate' as const, helper: `${model.tenants} locataires`, accent: 'En cours' },
    { label: 'Occupation', value: `${model.occupancy}%`, icon: TrendingUp, tone: 'slate' as const, helper: `${model.occupiedUnits}/${model.units} unités`, accent: 'Patrimoine' },
  ];

  return (
    <section className="grid grid-cols-2 gap-1.5 md:grid-cols-3 lg:grid-cols-6">
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
      card: 'border-emerald-200/55 bg-gradient-to-br from-white to-emerald-50/50 shadow-[0_4px_12px_rgba(4,120,87,0.03)] hover:border-emerald-300/70 hover:shadow-[0_8px_20px_rgba(4,120,87,0.05)]',
      icon: 'bg-emerald-50/85 text-emerald-800 ring-1 ring-emerald-200/70',
      accent: 'text-emerald-700 bg-emerald-50 border border-emerald-100',
      amount: 'text-emerald-950',
    },
    red: {
      card: 'border-red-200/60 bg-gradient-to-br from-white to-rose-50/40 shadow-[0_4px_12px_rgba(185,28,28,0.03)] hover:border-red-300/70 hover:shadow-[0_8px_20px_rgba(185,28,28,0.05)]',
      icon: 'bg-red-50/85 text-red-700 ring-1 ring-red-200/70',
      accent: 'text-red-700 bg-red-50 border border-red-100',
      amount: 'text-red-950',
    },
    amber: {
      card: 'border-amber-200/60 bg-gradient-to-br from-white to-amber-50/50 shadow-[0_4px_12px_rgba(154,91,17,0.03)] hover:border-amber-300/70 hover:shadow-[0_8px_20px_rgba(154,91,17,0.05)]',
      icon: 'bg-amber-50/85 text-amber-800 ring-1 ring-amber-200/70',
      accent: 'text-amber-800 bg-amber-50 border border-amber-100',
      amount: 'text-amber-950',
    },
    slate: {
      card: 'border-slate-200/80 bg-gradient-to-br from-white to-slate-50/60 shadow-[0_4px_12px_rgba(15,23,42,0.03)] hover:border-slate-300/80 hover:shadow-[0_8px_20px_rgba(15,23,42,0.05)]',
      icon: 'bg-slate-50/90 text-slate-800 ring-1 ring-slate-200',
      accent: 'text-slate-700 bg-slate-50 border border-slate-200',
      amount: 'text-slate-950',
    },
  }[tone];

  return (
    <article className={`group min-w-0 overflow-hidden rounded-lg border p-1.5 ring-1 ring-white/60 transition duration-300 hover:-translate-y-0.5 sm:p-2 ${styles.card}`}>
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[7px] font-bold uppercase tracking-[0.06em] text-slate-500 sm:text-[8px]">{label}</p>
          <span className={`mt-1 inline-flex rounded px-1 py-0.5 text-[7px] font-bold uppercase tracking-wide sm:text-[7.5px] ${styles.accent}`}>
            {accent}
          </span>
        </div>
        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition duration-300 group-hover:scale-105 ${styles.icon}`}>
          <Icon className="h-2.5 w-2.5" />
        </div>
      </div>

      <div className="mt-1.5 min-w-0">
        {money ? (
          <p className={`truncate text-[0.78rem] font-black tracking-tight tabular-nums sm:text-sm ${styles.amount}`} title={formatCurrency(amount ?? 0)}>
            {money}
          </p>
        ) : (
          <p className={`truncate text-[0.78rem] font-black tracking-tight sm:text-sm ${styles.amount}`}>
            {value}
          </p>
        )}
        <p className="mt-0.5 truncate text-[0.52rem] font-medium text-slate-500">{helper}</p>
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
      <div className="grid gap-1.5 lg:grid-cols-2">
        {priorities.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.page)}
              className="group flex w-full items-center gap-2 rounded-lg border border-emerald-950/10 bg-white/90 p-2 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/55"
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${toneIconClass(item.tone)}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[0.72rem] font-black text-slate-950">{item.title}</p>
                  <span className={`rounded-full px-1.5 py-0.5 text-[0.52rem] font-black ${toneBadgeClass(item.tone)}`}>
                    {item.actionLabel}
                  </span>
                </div>
                <p className="mt-0.5 text-[0.66rem] font-bold text-slate-800">{item.value}</p>
                <p className="truncate text-[0.6rem] font-medium text-slate-500">{item.description}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>
    </DashboardSection>
  );
}

function DashboardFinancialSummary({ model }: { model: ReturnType<typeof buildDashboardModel> }) {
  const hasChartData = model.monthly.some((point) => point.commissions > 0 || point.depenses > 0 || point.marge !== 0);
  return (
    <DashboardSection
      title={`Performance agence — ${model.selectedLabel}`}
      subtitle="Commissions, dépenses et marge nette. Les encaissements restent le volume locatif traité."
    >
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <MiniFinance label="Volume locatif" value={<MoneyText value={model.encaissements} compact />} tone="slate" />
        <MiniFinance label="Commissions" value={<MoneyText value={model.commissions} compact />} tone="emerald" />
        <MiniFinance label="Dépenses" value={<MoneyText value={model.depensesMois} compact />} tone="red" />
        <MiniFinance label="Marge nette" value={<MoneyText value={model.margeNette} compact />} tone={model.margeNette >= 0 ? 'emerald' : 'red'} />
      </div>

      <div className="mt-2 h-32 sm:h-36 lg:h-40">
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
        <div className="mt-3 flex items-center">
          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
            model.commissionChange >= 0 
              ? 'bg-emerald-50 text-emerald-700' 
              : 'bg-rose-50/80 text-rose-500'
          }`}>
            {model.commissionChange >= 0 ? '↗' : '↘'} {Math.abs(model.commissionChange)}%
          </span>
          <span className="ml-2 text-[11px] font-medium text-slate-500">
            sur les commissions vs mois précédent
          </span>
        </div>
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
      <div className="flex items-center gap-2.5">
        <div
          className="grid h-20 w-20 shrink-0 place-items-center rounded-full shadow-inner"
          style={{
            background: `conic-gradient(#047857 ${occupancy * 3.6}deg, #e7ded0 0deg)`,
          }}
          aria-label={`Taux d'occupation ${occupancy}%`}
        >
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white text-center shadow-sm">
            <span className="text-lg font-black text-slate-950">{occupancy}%</span>
            <span className="-mt-2 text-[0.52rem] font-bold uppercase tracking-[0.1em] text-slate-500">Occupé</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <HealthLine label="Unités occupées" value={model.occupiedUnits} tone="emerald" />
          <HealthLine label="Unités libres" value={model.vacantUnits} tone={model.vacantUnits > 0 ? 'amber' : 'slate'} />
          <HealthLine label="Bailleurs actifs" value={model.bailleurs} tone="slate" />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 divide-x divide-emerald-950/10 rounded-lg border border-emerald-950/10 bg-[#fffdf8]">
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
                className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_minmax(4.75rem,max-content)] items-center gap-2.5 py-2.5 text-left transition hover:bg-emerald-50/45"
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${toneIconClass(item.tone)}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.78rem] font-black text-slate-950">{item.title}</p>
                  <p className="truncate text-[0.66rem] font-medium text-slate-500">{item.subtitle}</p>
                </div>
                <div className="min-w-[4.75rem] justify-self-end text-right">
                  {item.amount != null && <p className="text-[0.68rem] font-black text-emerald-800"><MoneyText value={item.amount} compact className="justify-end" /></p>}
                  <p className="whitespace-nowrap text-[0.58rem] font-semibold text-slate-400">{item.meta}</p>
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
              className="grid w-full grid-cols-[0.625rem_minmax(0,1fr)_minmax(4.75rem,max-content)] items-center gap-2.5 py-2.5 text-left transition hover:bg-emerald-50/45"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${item.tone === 'red' ? 'bg-red-500' : item.tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.78rem] font-black text-slate-950">{item.title}</span>
                <span className="block truncate text-[0.66rem] font-medium text-slate-500">{item.subtitle}</span>
              </span>
              {item.value && <span className={`min-w-[4.75rem] justify-self-end whitespace-nowrap text-right text-[0.68rem] font-black ${item.tone === 'red' ? 'text-red-600' : 'text-slate-800'}`}>{item.value}</span>}
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
        <div className="space-y-1.5">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.page)}
              className="group flex w-full items-center gap-2 rounded-lg border border-emerald-950/10 bg-white/85 p-2 text-left transition hover:border-red-200 hover:bg-red-50/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500"
              aria-label={`Traiter l'impayé de ${item.title}`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f7efe2] text-xs font-black text-slate-700 transition group-hover:bg-red-100 group-hover:text-red-700">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.78rem] font-black text-slate-950 transition group-hover:text-red-950">{item.title}</span>
                <span className="block truncate text-[0.66rem] font-medium text-red-600/80 transition group-hover:text-red-700">{item.subtitle}</span>
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-right text-[0.68rem] font-black leading-tight text-red-600 transition group-hover:text-red-700">{item.value}</span>
                <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-red-500" />
              </div>
            </button>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

function DashboardQuickActions({ onNavigate: _onNavigate }: { onNavigate?: (page: string) => void }) {
  const actions = [
    { label: 'Enregistrer paiement', hashUrl: '#/paiements?action=new', icon: Wallet, variant: 'primary' as const },
    { label: 'Nouvelle location', hashUrl: '#/occupants-baux?action=new-location', icon: Plus, variant: 'secondary' as const },
    { label: 'Nouveau bien', hashUrl: '#/patrimoine?action=new', icon: Building2, variant: 'secondary' as const },
    { label: 'Documents', hashUrl: '#/documents', icon: FileText, variant: 'secondary' as const },
    { label: 'Nouveau bailleur', hashUrl: '#/bailleurs?action=new', icon: ReceiptText, variant: 'secondary' as const },
  ];

  return (
    <section className="rounded-xl border border-emerald-950/10 bg-white/88 p-2 shadow-[0_10px_24px_rgba(15,23,42,0.035)]">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[0.82rem] font-black text-slate-950">Actions rapides</h2>
          <p className="text-[0.68rem] font-medium text-slate-500">Accès direct aux flux les plus utilisés.</p>
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
                onClick={() => { window.location.hash = action.hashUrl; }}
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
    <section className="h-full min-w-0 rounded-xl border border-emerald-950/10 bg-white/92 p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.035)] ring-1 ring-white/70">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[0.82rem] font-black text-slate-950">{title}</h2>
          {subtitle && <p className="mt-0.5 line-clamp-2 text-[0.62rem] font-medium leading-3 text-slate-500">{subtitle}</p>}
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
    <div className={`@container rounded-lg border px-2 py-1.5 ${cls}`}>
      <p className="truncate text-[0.5rem] font-black uppercase tracking-[0.1em] opacity-65">{label}</p>
      <p className="mt-0.5 truncate text-[0.7rem] font-black">{value}</p>
    </div>
  );
}

function HealthLine({ label, value, tone }: { label: string; value: ReactNode; tone: 'emerald' | 'amber' | 'slate' }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-[0.64rem] font-semibold text-slate-600">
        <span className={`h-1.5 w-1.5 rounded-full ${tone === 'emerald' ? 'bg-emerald-600' : tone === 'amber' ? 'bg-amber-500' : 'bg-slate-300'}`} />
        {label}
      </span>
      <strong className="text-[0.66rem] font-black text-slate-950">{value}</strong>
    </div>
  );
}

function HealthMini({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="px-2 py-1.5 text-center">
      <p className="text-[0.76rem] font-black text-slate-950">{value}</p>
      <p className="text-[0.5rem] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
    </div>
  );
}

function CompactEmptyState({ icon: Icon, title, text }: { icon: typeof Sparkles; title: string; text: string }) {
  return (
    <div className="grid min-h-20 place-items-center rounded-lg border border-dashed border-emerald-950/15 bg-[#fffdf8] p-2.5 text-center">
      <div>
        <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-[0.7rem] font-black text-slate-950">{title}</p>
        <p className="mt-0.5 text-[0.58rem] font-medium text-slate-500">{text}</p>
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
