import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
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

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
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
        supabase.from('bailleurs').select('*', { count: 'exact', head: true }),
        supabase.from('immeubles').select('*', { count: 'exact', head: true }),
        supabase.from('unites').select('*', { count: 'exact', head: true }),
        supabase.from('unites').select('*', { count: 'exact', head: true }).eq('statut', 'libre'),
        supabase.from('unites').select('*', { count: 'exact', head: true }).eq('statut', 'loue'),
        supabase.from('locataires').select('*', { count: 'exact', head: true }),
        supabase.from('contrats').select('*', { count: 'exact', head: true }).eq('statut', 'actif'),
        supabase
          .from('paiements')
          .select('montant_total, mois_concerne, statut')
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
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

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


  const pieData = [
    { name: 'Louées', value: stats.unitesLouees },
    { name: 'Libres', value: stats.unitesLibres },
  ];

  const COLORS = ['#3b82f6', '#94a3b8'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-slate-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Tableau de bord</h1>
        <p className="text-slate-600">Vue d'ensemble de votre activité immobilière</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Immeubles"
          value={stats.totalImmeubles}
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="Produits totales"
          value={stats.totalUnites}
          subtitle={`${stats.unitesLibres} libres`}
          icon={DoorOpen}
          color="slate"
        />
        <StatCard
          title="Locataires actifs"
          value={stats.totalLocataires}
          subtitle={`${stats.contratsActifs} contrats`}
          icon={Users}
          color="green"
        />
        <StatCard
          title="Taux d'occupation"
          value={`${stats.tauxOccupation.toFixed(1)}%`}
          icon={TrendingUp}
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Finances du mois</h2>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm text-green-700 font-medium">Revenus perçus</p>
                <p className="text-2xl font-bold text-green-900">{formatCurrency(stats.revenusMois)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div>
                <p className="text-sm text-red-700 font-medium">Loyers impayés</p>
                <p className="text-2xl font-bold text-red-900">{formatCurrency(stats.impayesMois)}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Revenus mensuels</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="revenus" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Occupation des produits</h2>
          <ResponsiveContainer width="100%" height={250}>
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

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Statistiques générales</h2>
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

function StatCard({ title, value, subtitle, icon: Icon, color }: any) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-50 text-slate-600',
    green: 'bg-green-50 text-green-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <h3 className="text-sm font-medium text-slate-600 mb-1">{title}</h3>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
