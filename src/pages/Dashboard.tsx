import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/formatters';
import {
  Building2,
  TrendingUp,
  DollarSign,
  AlertCircle,
  DoorOpen,
  Sparkles,
  FileText,
  UserRound,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PageSkeleton } from '../components/ui/Skeleton';

import { readWithCache } from '../services/offlineReadCache';
import { OfflineDataNotice } from '../components/ui/OfflineDataNotice';
import { DemoDataLoader } from '../components/billing/DemoDataLoader';
import { OwnerWorkspace } from '../components/owner/OwnerWorkspace';

const FR_MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

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

interface DashboardProps {
  onNavigate?: (page: string) => void;
  onStartSetupWizard?: () => void;
}

export function Dashboard({ onNavigate, onStartSetupWizard }: DashboardProps = {}) {
  const { accountProfile } = useAuth();

  if (accountProfile.isIndividualOwner) {
    return <OwnerWorkspace onNavigate={onNavigate} onStartSetupWizard={onStartSetupWizard} />;
  }

  return <AgencyDashboard onNavigate={onNavigate} onStartSetupWizard={onStartSetupWizard} />;
}

function AgencyDashboard({ onNavigate }: DashboardProps = {}) {
  const { profile, user, accountProfile, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
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
  });
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenus: number }[]>([]);
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
      const dashboard = await readWithCache(
        { agencyId, userId: user?.id ?? null },
        'dashboard',
        async () => {
          const yearMonth = new Date().toISOString().slice(0, 7);
          const year = new Date().getFullYear();

          const [statsRes, monthlyRes] = await Promise.all([
            supabase.rpc('get_dashboard_stats', {
              p_agency_id: agencyId,
              p_year_month: yearMonth,
            }),
            supabase.rpc('get_monthly_revenue', {
              p_agency_id: agencyId,
              p_year: year,
            }),
          ]);

          if (statsRes.error) throw statsRes.error;

          const d = statsRes.data as Record<string, unknown>;
          const nextStats: DashboardStats = {
            totalBailleurs:  Number(d.bailleurs       ?? 0),
            totalImmeubles:  Number(d.immeubles        ?? 0),
            totalUnites:     Number(d.unites           ?? 0),
            unitesLibres:    Number(d.unites_libres    ?? 0),
            unitesLouees:    Number(d.unites_louees    ?? 0),
            totalLocataires: Number(d.locataires       ?? 0),
            contratsActifs:  Number(d.contrats_actifs  ?? 0),
            revenusMois:     Number(d.revenus_mois     ?? 0),
            impayesMois:     Number(d.impayes_mois     ?? 0),
            nbPaiementsMois: Number(d.nb_payes_mois    ?? 0),
            nbImpayesMois:   Number(d.nb_impayes_mois  ?? 0),
            tauxOccupation:
              Number(d.unites ?? 0) > 0
                ? (Number(d.unites_louees ?? 0) / Number(d.unites ?? 0)) * 100
                : 0,
          };

          const nextMonthly = !monthlyRes.error && monthlyRes.data
            ? (monthlyRes.data as { month_num: number; revenus: number }[]).map((row) => ({
                month: FR_MONTHS[(row.month_num ?? 1) - 1] ?? String(row.month_num),
                revenus: Math.round(Number(row.revenus ?? 0)),
              }))
            : [];

          return { stats: nextStats, monthlyRevenue: nextMonthly };
        },
        { timeoutMs: 7_000 },
      );

      setStats(dashboard.data.stats);
      setMonthlyRevenue(dashboard.data.monthlyRevenue);
      setCacheTimestamp(dashboard.source === 'cache' ? dashboard.timestamp : null);
      const stats = dashboard.data.stats;
      const hasBusinessData =
        stats.totalImmeubles > 0 ||
        stats.totalUnites > 0 ||
        stats.totalLocataires > 0 ||
        stats.contratsActifs > 0 ||
        stats.nbPaiementsMois > 0;
      const isEmptyAgency = stats.totalBailleurs === 0 && !hasBusinessData;
      const isEmptyIndividualOwner = accountProfile.isIndividualOwner && !hasBusinessData;

      setIsNewUser(dashboard.source !== 'cache' && (isEmptyIndividualOwner || isEmptyAgency));
      setError(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Une erreur est survenue lors du chargement du tableau de bord.',
      );
    } finally {
      setLoading(false);
    }
  }, [accountProfile.isIndividualOwner, profile?.agency_id, user?.id]);

  useEffect(() => {
    if (profile?.agency_id) {
      loadDashboardData();
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

  const pieData = useMemo(
    () => [
      { name: 'Louées', value: stats.unitesLouees },
      { name: 'Libres', value: stats.unitesLibres },
    ],
    [stats.unitesLouees, stats.unitesLibres],
  );

  const COLORS = ['#166534', '#cbd5e1'];

  if (loading) {
    return <PageSkeleton title="Tableau de bord" variant="dashboard" />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Erreur de chargement</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => {
              if (!profile?.agency_id) {
                setError("Votre compte n'a pas d'agence associée.");
                return;
              }
              setError(null);
              setLoading(true);
              loadDashboardData();
            }}
            className="px-6 py-3 bg-brand-700 text-white rounded-lg font-bold shadow-premium hover:bg-brand-800 transition-all duration-300"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (isNewUser) {
    return (
      <div className="sk-page-shell space-y-6 lg:space-y-8 animate-fadeIn">
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-950/5 bg-[linear-gradient(135deg,#FDFBF7_0%,#F3F9F6_100%)] p-8 shadow-[0_24px_60px_rgba(6,17,13,0.06)] lg:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full bg-orange-200/20 blur-3xl" />

          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-brand-800 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-emerald-900/5">
              <Sparkles className="h-8 w-8" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Votre agence est prête à être structurée.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg font-medium leading-8 text-slate-600">
              Commencez par créer votre premier bailleur, puis rattachez ses biens, ses locataires et ses paiements.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => onNavigate?.('bailleurs')}
                className="inline-flex min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl bg-[#072F24] px-8 py-3 text-base font-black text-white shadow-[0_18px_48px_rgba(7,47,36,0.26)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0A3F30] active:bg-[#041812] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action-500/25"
              >
                <UserRound className="h-5 w-5" />
                Créer mon premier bailleur
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-950">Feuille de route</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">
                0/4 étapes
              </span>
            </div>
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200/60 bg-white shadow-sm">
              <div className="grid grid-cols-1 divide-y divide-slate-100">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-slate-900">1. Créer un bailleur</h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">À faire</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">Le propriétaire légal du bien.</p>
                  </div>
                  <button onClick={() => onNavigate?.('bailleurs')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                    Commencer
                  </button>
                </div>
                <div className="flex flex-col gap-4 p-5 opacity-70 sm:flex-row sm:items-center sm:p-6">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-slate-900">2. Ajouter un bien</h3>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Rattachez un immeuble ou une maison au bailleur.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-4 p-5 opacity-70 sm:flex-row sm:items-center sm:p-6">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <FileText className="h-6 w-6" />
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
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-slate-900">4. Enregistrer un paiement</h3>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Suivez le premier loyer et le net bailleur.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-5 text-xl font-black text-slate-950">Progression</h2>
            <div className="rounded-[1.5rem] border border-emerald-950/10 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm font-bold text-slate-900">
                  <span>Mise en route</span>
                  <span className="text-emerald-700">0%</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: '0%' }} />
                </div>
              </div>
              <p className="text-sm font-medium leading-relaxed text-slate-600">
                Votre portefeuille sera actif dès que le premier bailleur sera créé.
              </p>
            </div>

            <h2 className="mb-5 mt-8 text-xl font-black text-slate-950">Exemples</h2>
            <div className="rounded-[1.5rem] border border-slate-200/50 bg-[#FDFBF7] p-5 shadow-sm">
              <p className="mb-4 text-sm font-medium leading-relaxed text-slate-600">
                Vous voulez tester avant de configurer vos vrais bailleurs ? Générez des données fictives.
              </p>
              <DemoDataLoader variant="compact" onLoaded={loadDashboardData} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sk-page-shell space-y-5 lg:space-y-6 animate-fadeIn">
      <div className="animate-slideInLeft">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-950 mb-2">
          Tableau de bord
        </h1>
        <p className="text-slate-600 text-base lg:text-lg">Vue d'ensemble de votre activité immobilière</p>
      </div>

      {cacheTimestamp && (
        <OfflineDataNotice
          cachedAt={cacheTimestamp}
          onRetry={loadDashboardData}
        />
      )}

      <DemoDataLoader variant="resetBanner" onLoaded={loadDashboardData} />

      {stats.nbImpayesMois > 0 && (
        <button
          onClick={() => onNavigate?.('loyers-impayes')}
          className="w-full flex items-center justify-between gap-4 bg-red-50 border border-red-200 rounded-lg p-4 sm:p-5 hover:bg-red-100 transition-colors text-left group shadow-sm"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0 group-hover:bg-red-700 transition-colors">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-red-900 text-base sm:text-lg">
                {stats.nbImpayesMois} loyer{stats.nbImpayesMois > 1 ? 's' : ''} impayé
                {stats.nbImpayesMois > 1 ? 's' : ''} ce mois
              </p>
              <p className="text-sm text-red-700 font-medium truncate">
                {formatCurrency(stats.impayesMois)} en attente de recouvrement
              </p>
            </div>
          </div>
          <span className="flex-shrink-0 text-sm font-semibold text-red-700 bg-red-100 border border-red-300 px-3 py-1.5 rounded-lg group-hover:bg-red-200 transition-colors whitespace-nowrap">
            Voir les impayés →
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6 2xl:gap-5">
        <KpiCard
          title="Encaissements"
          value={formatCurrency(stats.revenusMois)}
          subtitle={`${stats.nbPaiementsMois} paiement${stats.nbPaiementsMois > 1 ? 's' : ''}`}
          icon={DollarSign}
          tone="emerald"
        />
        <KpiCard
          title="Impayés"
          value={formatCurrency(stats.impayesMois)}
          subtitle={`${stats.nbImpayesMois} dossier${stats.nbImpayesMois > 1 ? 's' : ''}`}
          icon={AlertCircle}
          tone={stats.impayesMois > 0 ? 'red' : 'slate'}
        />
        <KpiCard
          title="Locations en cours"
          value={stats.contratsActifs}
          subtitle={`${stats.totalLocataires} locataires`}
          icon={FileText}
          tone="brand"
        />
        <KpiCard
          title="Occupation"
          value={`${stats.tauxOccupation.toFixed(0)}%`}
          subtitle={`${stats.unitesLouees}/${stats.totalUnites} unités`}
          icon={TrendingUp}
          tone="blue"
        />
        <KpiCard
          title="Immeubles"
          value={stats.totalImmeubles}
          subtitle="Patrimoine géré"
          icon={Building2}
          tone="orange"
        />
        <KpiCard
          title="Unités"
          value={stats.totalUnites}
          subtitle={`${stats.unitesLibres} libres`}
          icon={DoorOpen}
          tone="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-1 sk-card-premium p-4 sm:p-6 transition-all duration-300 animate-scaleIn">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-2">Priorites du mois</h2>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 sm:p-4 bg-brand-50 rounded-lg transition-all duration-300 hover:-translate-y-0.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-green-700 font-medium">Paiements saisis</p>
                <p className="text-lg sm:text-2xl font-bold text-green-900 truncate">
                  {stats.nbPaiementsMois} paiement{stats.nbPaiementsMois > 1 ? 's' : ''}
                </p>
              </div>
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
            </div>
            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-xl transition-all duration-300 hover:scale-105">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-red-700 font-medium">Relances a suivre</p>
                <p className="text-lg sm:text-2xl font-bold text-red-900 truncate">
                  {stats.nbImpayesMois} dossier{stats.nbImpayesMois > 1 ? 's' : ''}
                </p>
              </div>
              <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600 flex-shrink-0" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 sk-card-premium p-4 sm:p-6 transition-all duration-300 animate-scaleIn">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-4">Revenus mensuels</h2>
          <ResponsiveContainer width="100%" height={200} className="sm:h-[250px]">
            <BarChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Bar dataKey="revenus" fill="#166534" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="sk-card-premium p-4 sm:p-6 transition-all duration-300 animate-scaleIn">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-4">Occupation des unités</h2>
          <ResponsiveContainer width="100%" height={200} className="sm:h-[250px]">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props: { name: string; percent?: number }) =>
                  `${props.name} ${(((props.percent ?? 0) * 100).toFixed(0))}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="sk-card-premium p-4 sm:p-6 transition-all duration-300 animate-scaleIn">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-4">Statistiques générales</h2>
          <div className="space-y-4">
            {!accountProfile.isIndividualOwner && <StatRow label="Bailleurs enregistrés" value={stats.totalBailleurs} />}
            <StatRow label={accountProfile.isIndividualOwner ? 'Biens suivis' : 'Immeubles gérés'} value={stats.totalImmeubles} />
            <StatRow label="Unités disponibles" value={stats.unitesLibres} />
            <StatRow label="Unités louées" value={stats.unitesLouees} />
            <StatRow label="Locations en cours" value={stats.contratsActifs} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Composants internes ──────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  tone: 'orange' | 'blue' | 'slate' | 'brand' | 'emerald' | 'red';
}

const KPI_TONES: Record<KpiCardProps['tone'], { card: string; iconWrap: string; icon: string; title: string; value: string; subtitle: string }> = {
  orange: {
    card: 'border-action-100 bg-gradient-to-br from-white to-action-50/45',
    iconWrap: 'bg-action-50 ring-action-100',
    icon: 'text-action-700',
    title: 'text-action-800',
    value: 'text-slate-950',
    subtitle: 'text-slate-600',
  },
  blue: {
    card: 'border-sky-100 bg-gradient-to-br from-white to-sky-50/55',
    iconWrap: 'bg-sky-50 ring-sky-100',
    icon: 'text-sky-700',
    title: 'text-sky-800',
    value: 'text-slate-950',
    subtitle: 'text-slate-600',
  },
  slate: {
    card: 'border-slate-200 bg-white',
    iconWrap: 'bg-slate-100 ring-slate-200',
    icon: 'text-slate-600',
    title: 'text-slate-600',
    value: 'text-slate-950',
    subtitle: 'text-slate-500',
  },
  brand: {
    card: 'border-brand-100 bg-gradient-to-br from-white to-brand-50/55',
    iconWrap: 'bg-brand-50 ring-brand-100',
    icon: 'text-brand-700',
    title: 'text-brand-800',
    value: 'text-slate-950',
    subtitle: 'text-slate-600',
  },
  emerald: {
    card: 'border-emerald-100 bg-gradient-to-br from-white to-emerald-50/55',
    iconWrap: 'bg-emerald-50 ring-emerald-100',
    icon: 'text-emerald-700',
    title: 'text-emerald-800',
    value: 'text-emerald-950',
    subtitle: 'text-emerald-700',
  },
  red: {
    card: 'border-red-200 bg-gradient-to-br from-white to-red-50/70',
    iconWrap: 'bg-red-50 ring-red-200',
    icon: 'text-red-700',
    title: 'text-red-700',
    value: 'text-red-950',
    subtitle: 'text-red-700',
  },
};

function KpiCard({ title, value, subtitle, icon: Icon, tone }: KpiCardProps) {
  const c = KPI_TONES[tone];
  return (
    <div
      className={`min-w-0 rounded-2xl border p-3 shadow-[0_14px_34px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(15,23,42,0.10)] sm:p-3.5 2xl:p-4 ${c.card}`}
    >
      <div className="flex min-h-[96px] flex-col justify-between gap-3 2xl:min-h-[112px]">
        <div className="flex items-center justify-between gap-2">
          <p className={`min-w-0 truncate text-[0.66rem] font-black uppercase tracking-[0.14em] ${c.title}`}>
            {title}
          </p>
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ring-1 2xl:h-9 2xl:w-9 ${c.iconWrap}`}>
            <Icon className={`h-4 w-4 2xl:h-5 2xl:w-5 ${c.icon}`} />
          </div>
        </div>
        <div className="min-w-0">
          <p className={`truncate text-xl font-black leading-tight tracking-tight sm:text-2xl ${c.value}`}>
            {value}
          </p>
          {subtitle && (
            <p className={`mt-1 truncate text-xs font-semibold ${c.subtitle}`}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatRowProps {
  label: string;
  value: number;
}

function StatRow({ label, value }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}
