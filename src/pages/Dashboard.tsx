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
import { QuickStart } from '../components/ui/QuickStart';
import { EmptyState } from '../components/ui/EmptyState';
import { SetupWizard } from '../components/ui/SetupWizard';

const FR_MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

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
}

export function Dashboard({ onNavigate }: DashboardProps = {}) {
  const { profile, loading: authLoading } = useAuth();
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
  const [showWizard, setShowWizard] = useState(false);

  const loadDashboardData = useCallback(async () => {
    if (!profile?.agency_id) {
      setLoading(false);
      return;
    }

    try {
      const agencyId = profile.agency_id;
      const yearMonth = new Date().toISOString().slice(0, 7);
      const year = new Date().getFullYear();

      // Une seule RPC au lieu de 8 requêtes parallèles
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
      const newStats: DashboardStats = {
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

      setStats(newStats);
      setIsNewUser(
        newStats.totalBailleurs === 0 &&
        newStats.totalImmeubles === 0 &&
        newStats.totalUnites === 0 &&
        newStats.totalLocataires === 0,
      );

      // Revenus mensuels — fallback vers tableau vide si l'extension pg_cron ou la RPC échoue
      if (!monthlyRes.error && monthlyRes.data) {
        const monthly = (monthlyRes.data as { month_num: number; revenus: number }[]).map(
          (row) => ({
            month: FR_MONTHS[(row.month_num ?? 1) - 1] ?? String(row.month_num),
            revenus: Math.round(Number(row.revenus ?? 0)),
          }),
        );
        setMonthlyRevenue(monthly);
      }

      setError(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Une erreur est survenue lors du chargement du tableau de bord.',
      );
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id]);

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

  const pieData = useMemo(
    () => [
      { name: 'Louées', value: stats.unitesLouees },
      { name: 'Libres', value: stats.unitesLibres },
    ],
    [stats.unitesLouees, stats.unitesLibres],
  );

  const COLORS = ['#F58220', '#94a3b8'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-600 mb-4" />
          <p className="text-lg text-slate-600 animate-pulse-soft">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
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
            className="px-6 py-3 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            style={{ background: 'linear-gradient(135deg, #F58220 0%, #E65100 100%)' }}
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
        {showWizard && (
          <SetupWizard
            onClose={() => setShowWizard(false)}
            onComplete={() => {
              setShowWizard(false);
              loadDashboardData();
            }}
          />
        )}
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 animate-fadeIn">
          <div className="animate-slideInLeft">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 bg-clip-text text-transparent mb-2">
              Bienvenue sur Gestion Locative
            </h1>
            <p className="text-slate-600 text-base lg:text-lg">
              Commencez par configurer votre plateforme en quelques étapes simples
            </p>
          </div>

          <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-6 border-2 border-orange-200 animate-slideInUp">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-orange-900 mb-2">Configuration guidée recommandée</h3>
                <p className="text-orange-800 text-sm mb-4">
                  Laissez-vous guider étape par étape pour créer votre premier flux complet en quelques minutes.
                </p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all font-semibold shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Lancer la configuration guidée
                </button>
              </div>
            </div>
          </div>

          <QuickStart onNavigate={onNavigate} />

          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
            <EmptyState
              icon={Sparkles}
              title="Votre tableau de bord est prêt !"
              description="Une fois que vous aurez ajouté vos premiers bailleurs, immeubles et locataires, vous verrez apparaître ici toutes vos statistiques et graphiques en temps réel."
              action={{ label: 'Commencer la configuration', onClick: () => onNavigate?.('bailleurs') }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border-2 border-orange-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-orange-900">Gestion complète</h3>
              </div>
              <p className="text-sm text-orange-800">
                Gérez vos bailleurs, immeubles, unités et locataires dans une seule plateforme intuitive
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-blue-900">Suivi financier</h3>
              </div>
              <p className="text-sm text-blue-800">
                Encaissements, rapports mensuels, détection des impayés automatique et exports PDF
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
                Statistiques en temps réel, graphiques mensuels et bilans automatisés pour chaque bailleur
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 animate-fadeIn">
      <div className="animate-slideInLeft">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 bg-clip-text text-transparent mb-2">
          Tableau de bord
        </h1>
        <p className="text-slate-600 text-base lg:text-lg">Vue d'ensemble de votre activité immobilière</p>
      </div>

      {stats.nbImpayesMois > 0 && (
        <button
          onClick={() => onNavigate?.('loyers-impayes')}
          className="w-full flex items-center justify-between gap-4 bg-red-50 border-2 border-red-200 rounded-2xl p-4 sm:p-5 hover:bg-red-100 transition-colors text-left group"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0 group-hover:bg-red-600 transition-colors">
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

      {/* Résumé financier rapide */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Encaissés ce mois</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-900 truncate">{formatCurrency(stats.revenusMois)}</p>
          <p className="text-xs text-emerald-600 mt-1">
            {stats.nbPaiementsMois} paiement{stats.nbPaiementsMois > 1 ? 's' : ''}
          </p>
        </div>
        <div className={`rounded-xl p-4 border ${stats.impayesMois > 0 ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${stats.impayesMois > 0 ? 'text-red-700' : 'text-slate-500'}`}>
            Impayés ce mois
          </p>
          <p className={`text-xl sm:text-2xl font-bold truncate ${stats.impayesMois > 0 ? 'text-red-900' : 'text-slate-400'}`}>
            {formatCurrency(stats.impayesMois)}
          </p>
          <p className={`text-xs mt-1 ${stats.impayesMois > 0 ? 'text-red-600' : 'text-slate-400'}`}>
            {stats.nbImpayesMois} dossier{stats.nbImpayesMois > 1 ? 's' : ''}
          </p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">Contrats actifs</p>
          <p className="text-xl sm:text-2xl font-bold text-orange-900">{stats.contratsActifs}</p>
          <p className="text-xs text-orange-600 mt-1">{stats.totalLocataires} locataires</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Occupation</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-900">{stats.tauxOccupation.toFixed(0)}%</p>
          <p className="text-xs text-blue-600 mt-1">
            {stats.unitesLouees}/{stats.totalUnites} unités
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard title="Immeubles" value={stats.totalImmeubles} icon={Building2} color="orange" delay={0} />
        <StatCard
          title="Unités totales"
          value={stats.totalUnites}
          subtitle={`${stats.unitesLibres} libres`}
          icon={DoorOpen}
          color="blue"
          delay={100}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-1 bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-200 transition-all duration-300 hover:shadow-xl animate-scaleIn">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-2">Finances du mois</h2>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl transition-all duration-300 hover:scale-105">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-green-700 font-medium">Revenus perçus</p>
                <p className="text-lg sm:text-2xl font-bold text-green-900 truncate">
                  {formatCurrency(stats.revenusMois)}
                </p>
              </div>
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
            </div>
            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-xl transition-all duration-300 hover:scale-105">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-red-700 font-medium">Loyers impayés</p>
                <p className="text-lg sm:text-2xl font-bold text-red-900 truncate">
                  {formatCurrency(stats.impayesMois)}
                </p>
              </div>
              <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600 flex-shrink-0" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-200 transition-all duration-300 hover:shadow-xl animate-scaleIn">
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
              <Bar dataKey="revenus" fill="#F58220" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-200 transition-all duration-300 hover:shadow-xl animate-scaleIn">
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

        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-200 transition-all duration-300 hover:shadow-xl animate-scaleIn">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-4">Statistiques générales</h2>
          <div className="space-y-4">
            <StatRow label="Bailleurs enregistrés" value={stats.totalBailleurs} />
            <StatRow label="Immeubles gérés" value={stats.totalImmeubles} />
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

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: 'orange' | 'blue' | 'slate' | 'green' | 'emerald';
  delay?: number;
}

const COLOR_MAP: Record<StatCardProps['color'], { bg: string; icon: string; text: string }> = {
  orange:  { bg: 'bg-orange-50',  icon: 'text-orange-600',  text: 'text-orange-900'  },
  blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    text: 'text-blue-900'    },
  slate:   { bg: 'bg-slate-100',  icon: 'text-slate-600',   text: 'text-slate-900'   },
  green:   { bg: 'bg-green-50',   icon: 'text-green-600',   text: 'text-green-900'   },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-900' },
};

function StatCard({ title, value, subtitle, icon: Icon, color, delay = 0 }: StatCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div
      className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-200 transition-all duration-300 hover:shadow-xl animate-scaleIn"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${c.bg}`}>
          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${c.icon}`} />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">{value}</p>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
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
