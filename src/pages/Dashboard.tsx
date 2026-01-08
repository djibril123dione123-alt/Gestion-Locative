import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  AlertCircle,
  DoorOpen
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

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
  tauxOccupation: number;
}

export function Dashboard() {
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
    tauxOccupation: 0,
  });
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [profile?.agency_id, authLoading, profile]);

  const loadDashboardData = useCallback(async () => {
    if (!profile?.agency_id) return;

    try {
      const agencyId = profile.agency_id;

      const [
        { count: bailleursCount },
        { count: immeublesCount },
        { count: unitesCount },
        { count: unitesLibresCount },
        { count: unitesLoueesCount },
        { count: locatairesCount },
        { count: contratsCount },
        { data: paiementsData },
      ] = await Promise.all([
        supabase.from('bailleurs').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId),
        supabase.from('immeubles').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId),
        supabase.from('unites').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId),
        supabase.from('unites').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('statut', 'libre'),
        supabase.from('unites').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('statut', 'loue'),
        supabase.from('locataires').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId),
        supabase.from('contrats').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('statut', 'actif'),
        supabase
          .from('paiements')
          .select('montant_total, mois_concerne, statut')
          .eq('agency_id', agencyId)
          .gte('mois_concerne', new Date(new Date().getFullYear(), 0, 1).toISOString()),
      ]);

      const currentMonth = new Date().toISOString().slice(0, 7);
      const revenusMois = paiementsData
        ?.filter(p => p.mois_concerne.startsWith(currentMonth) && p.statut === 'paye')
        .reduce((sum, p) => sum + Number(p.montant_total), 0) || 0;

      const impayesMois = paiementsData
        ?.filter(p => p.mois_concerne.startsWith(currentMonth) && p.statut === 'impaye')
        .reduce((sum, p) => sum + Number(p.montant_total), 0) || 0;

      const monthlyData = processMonthlyRevenue(paiementsData || []);

      const tauxOccupation = unitesCount ? ((unitesLoueesCount || 0) / unitesCount) * 100 : 0;

      setStats({
        totalBailleurs: bailleursCount || 0,
        totalImmeubles: immeublesCount || 0,
        totalUnites: unitesCount || 0,
        unitesLibres: unitesLibresCount || 0,
        unitesLouees: unitesLoueesCount || 0,
        totalLocataires: locatairesCount || 0,
        contratsActifs: contratsCount || 0,
        revenusMois,
        impayesMois,
        tauxOccupation,
      });

      setMonthlyRevenue(monthlyData);
      setError(null);
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
      setError(error.message || 'Une erreur est survenue lors du chargement du tableau de bord.');
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id]);

  const processMonthlyRevenue = (paiements: any[]) => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const currentYear = new Date().getFullYear();

    const data = months.map((month, index) => {
      const monthStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
      const revenus = paiements
        .filter(p => p.mois_concerne.startsWith(monthStr) && p.statut === 'paye')
        .reduce((sum, p) => sum + Number(p.montant_total), 0);

      return { month, revenus: Math.round(revenus) };
    });

    return data;
  };

const formatCurrency = (amount: number) => {
  if (!amount) return '0 F CFA';
  return (
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 })
      .format(amount)
      .replace(/\u00A0/g, ' ') + ' F CFA'
  );
};


  const pieData = useMemo(() => [
    { name: 'Louées', value: stats.unitesLouees },
    { name: 'Libres', value: stats.unitesLibres },
  ], [stats.unitesLouees, stats.unitesLibres]);

  const COLORS = ['#F58220', '#94a3b8'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-600 mb-4"></div>
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 animate-fadeIn">
      <div className="animate-slideInLeft">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 bg-clip-text text-transparent mb-2">
          Tableau de bord
        </h1>
        <p className="text-slate-600 text-base lg:text-lg">Vue d'ensemble de votre activité immobilière</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          title="Immeubles"
          value={stats.totalImmeubles}
          icon={Building2}
          color="orange"
          delay="0"
        />
        <StatCard
          title="Produits totales"
          value={stats.totalUnites}
          subtitle={`${stats.unitesLibres} libres`}
          icon={DoorOpen}
          color="blue"
          delay="100"
        />
        <StatCard
          title="Locataires actifs"
          value={stats.totalLocataires}
          subtitle={`${stats.contratsActifs} contrats`}
          icon={Users}
          color="green"
          delay="200"
        />
        <StatCard
          title="Taux d'occupation"
          value={`${stats.tauxOccupation.toFixed(1)}%`}
          icon={TrendingUp}
          color="emerald"
          delay="300"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-1 bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-200 transition-all duration-300 hover:shadow-xl animate-scaleIn">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-2">Finances du mois</h2>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl transition-all duration-300 hover:scale-105">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-green-700 font-medium">Revenus perçus</p>
                <p className="text-lg sm:text-2xl font-bold text-green-900 truncate">{formatCurrency(stats.revenusMois)}</p>
              </div>
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-xl transition-all duration-300 hover:scale-105">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-red-700 font-medium">Loyers impayés</p>
                <p className="text-lg sm:text-2xl font-bold text-red-900 truncate">{formatCurrency(stats.impayesMois)}</p>
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
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-4">Occupation des produits</h2>
          <ResponsiveContainer width="100%" height={200} className="sm:h-[250px]">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
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
            <StatRow label="Produits disponibles" value={stats.unitesLibres} />
            <StatRow label="Produits louées" value={stats.unitesLouees} />
            <StatRow label="Locataires actifs" value={stats.totalLocataires} />
            <StatRow label="Contrats en cours" value={stats.contratsActifs} />
          </div>
        </div>
      </div>
    </div>
  );
}

const StatCard = memo(({ title, value, subtitle, icon: Icon, color, delay }: any) => {
  const colorClasses = {
    orange: 'bg-gradient-to-br from-orange-50 to-orange-100 text-orange-600',
    blue: 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600',
    slate: 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600',
    green: 'bg-gradient-to-br from-green-50 to-green-100 text-green-600',
    emerald: 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600',
  };

  return (
    <div
      className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-200 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 animate-slideInUp"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className={`p-2 sm:p-3 rounded-xl ${colorClasses[color]} transition-transform duration-300 hover:scale-110`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>
      <h3 className="text-xs sm:text-sm font-medium text-slate-600 mb-1">{title}</h3>
      <p className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">{value}</p>
      {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
});

StatCard.displayName = 'StatCard';

const StatRow = memo(({ label, value }: { label: string; value: number }) => {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
});

StatRow.displayName = 'StatRow';
