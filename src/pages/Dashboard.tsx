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
import { EmptyState } from '../components/ui/EmptyState';
import { FirstStepsChecklist } from '../components/onboarding/FirstStepsChecklist';
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

function AgencyDashboard({ onNavigate, onStartSetupWizard }: DashboardProps = {}) {
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
      <>
        <div className="sk-page-shell space-y-6 lg:space-y-8 animate-fadeIn">
          <section className="sk-premium-panel relative overflow-hidden p-5 sm:p-7 lg:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-emerald-200/40 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-44 w-44 rounded-full bg-orange-200/35 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-brand-800">
                  <Sparkles className="h-4 w-4" />
                  Première connexion
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
                  {accountProfile.isIndividualOwner
                    ? 'Votre espace proprietaire est pret a demarrer.'
                    : 'Structurez votre agence en commencant par un bailleur.'}
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
                  {accountProfile.isIndividualOwner
                    ? 'Ajoutez votre premier bien, puis reliez un locataire, un bail et un premier loyer pour donner vie au tableau de bord.'
                    : "Creez d'abord le bailleur, puis rattachez son bien, ses locataires, ses encaissements et ses quittances."}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <button
                  type="button"
                  onClick={() => onNavigate?.(accountProfile.isIndividualOwner ? 'patrimoine' : 'bailleurs')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-800 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/18 transition hover:-translate-y-0.5 hover:bg-brand-950"
                >
                  {accountProfile.isIndividualOwner ? <Building2 className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                  {accountProfile.isIndividualOwner ? 'Ajouter mon premier bien' : 'Creer mon premier bailleur'}
                </button>
                <button
                  type="button"
                  onClick={onStartSetupWizard}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-900/10 bg-white px-5 py-3 text-sm font-black text-brand-800 shadow-sm transition hover:bg-emerald-50"
                >
                  <Sparkles className="h-5 w-5" />
                  {accountProfile.isIndividualOwner ? 'Ajuster mon profil' : "Ajuster l'agence"}
                </button>
              </div>
            </div>
          </section>

          <FirstStepsChecklist
            onNavigate={onNavigate}
            onStartWizard={onStartSetupWizard}
            onDemoLoaded={loadDashboardData}
            showDemoData
          />

          <div className="sk-card-premium p-8">
            <EmptyState
              icon={Sparkles}
              title={accountProfile.isIndividualOwner ? 'Votre espace proprietaire attend son premier bien.' : 'Votre agence attend son premier bailleur.'}
              description={
                accountProfile.isIndividualOwner
                  ? 'Ajoutez un bien, une unite, un locataire et un bail pour activer le suivi des loyers, impayes et quittances.'
                  : "Creez un bailleur, rattachez son bien, puis ajoutez locataire, bail et paiement pour activer les indicateurs agence."
              }
              action={{
                label: accountProfile.isIndividualOwner ? 'Ajouter mon premier bien' : 'Ajouter un bailleur',
                onClick: () => onNavigate?.(accountProfile.isIndividualOwner ? 'patrimoine' : 'bailleurs'),
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="sk-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-brand-700 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-black text-slate-950">{accountProfile.isIndividualOwner ? 'Parcours proprietaire' : 'Portefeuille agence'}</h3>
              </div>
              <p className="text-sm font-medium text-slate-700">
                {accountProfile.isIndividualOwner
                  ? 'Gerez vos biens, unites, locataires et baux dans une seule plateforme intuitive'
                  : 'Gerez vos bailleurs, biens, unites et locataires dans une seule plateforme intuitive'}
              </p>
            </div>
            <div className="sk-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-action-600 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-black text-slate-950">Suivi financier</h3>
              </div>
              <p className="text-sm font-medium text-slate-700">
                Encaissements, rapports mensuels, detection des impayes automatique et exports PDF
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-green-900">Rapports intelligents</h3>
              </div>
              <p className="text-sm text-green-800">
                {accountProfile.isIndividualOwner
                  ? 'Statistiques en temps reel, revenus mensuels et resume proprietaire automatises'
                  : 'Statistiques en temps reel, graphiques mensuels et bilans automatises pour chaque bailleur'}
              </p>
            </div>
          </div>
        </div>
      </>
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
          title="Contrats actifs"
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
            <StatRow label="Contrats en cours" value={stats.contratsActifs} />
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
