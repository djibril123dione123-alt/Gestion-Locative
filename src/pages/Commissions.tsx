import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, BarChart3, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export function Commissions() {
  const { profile } = useAuth();
  const [commissions, setCommissions] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalCommission: 0,
    nombrePaiements: 0,
    commissionMoyenne: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (profile?.agency_id) {
      loadCommissions();
    }
  }, [selectedMonth, profile?.agency_id]);

  const loadCommissions = async () => {
    if (!profile?.agency_id) return;
    setLoading(true);
    try {
      const monthStart = `${selectedMonth}-01`;
      const monthEnd = new Date(selectedMonth + '-01');
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      const monthEndStr = monthEnd.toISOString().slice(0, 10);

      const { data } = await supabase
        .from('paiements')
        .select(`
          id,
          montant_total,
          part_agence,
          date_paiement,
          statut,
          contrats(
            locataires(nom, prenom),
            unites(nom, immeubles(nom, bailleurs(nom, prenom)))
          )
        `)
        .eq('agency_id', profile.agency_id)
        .eq('statut', 'paye')
        .gte('mois_concerne', monthStart)
        .lt('mois_concerne', monthEndStr)
        .order('date_paiement', { ascending: false });

      const commissionsData = (data || []).map((p) => ({
        ...p,
        locataire: p.contrats?.locataires ? `${p.contrats.locataires.prenom} ${p.contrats.locataires.nom}` : '-',
        unite: p.contrats?.unites?.nom || '-',
        immeuble: p.contrats?.unites?.immeubles?.nom || '-',
        bailleur: p.contrats?.unites?.immeubles?.bailleurs
          ? `${p.contrats.unites.immeubles.bailleurs.prenom} ${p.contrats.unites.immeubles.bailleurs.nom}`
          : '-',
      }));

      setCommissions(commissionsData);

      // Statistiques
      const total = commissionsData.reduce((sum, c) => sum + Number(c.part_agence), 0);
      const moyenne = commissionsData.length > 0 ? total / commissionsData.length : 0;

      setStats({
        totalCommission: total,
        nombrePaiements: commissionsData.length,
        commissionMoyenne: moyenne,
      });

      // Données par immeuble pour le graphique
      const byImmeuble: { [key: string]: number } = {};
      commissionsData.forEach((c) => {
        const key = c.immeuble;
        byImmeuble[key] = (byImmeuble[key] || 0) + Number(c.part_agence);
      });

      const chartDataArray = Object.entries(byImmeuble).map(([name, value]) => ({
        name,
        commission: Math.round(Number(value)),
      }));

      setChartData(chartDataArray);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const monthName = new Date(selectedMonth).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });

    doc.setFontSize(20);
    doc.text('RAPPORT DES COMMISSIONS', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Période: ${monthName}`, 14, 30);

    // Statistiques
    doc.autoTable({
      head: [['Élément', 'Valeur']],
      body: [
        ['Total commissions', formatCurrency(stats.totalCommission)],
        ['Nombre de paiements', stats.nombrePaiements.toString()],
        ['Commission moyenne', formatCurrency(stats.commissionMoyenne)],
      ],
      startY: 40,
    });

    // Détails
    doc.autoTable({
      head: [['Locataire', 'Unité', 'Immeuble', 'Montant', 'Commission']],
      body: commissions.map((c) => [
        c.locataire,
        c.unite,
        c.immeuble,
        formatCurrency(c.montant_total),
        formatCurrency(c.part_agence),
      ]),
      startY: (doc as any).lastAutoTable.finalY + 10,
      styles: { fontSize: 9 },
    });

    doc.save(`commissions-${selectedMonth}.pdf`);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(amount);

  if (loading) return <div className="flex items-center justify-center h-full"><div>Chargement...</div></div>;

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Gestion des Commissions</h1>
          <p className="text-slate-600">Suivi des revenus d'agence</p>
        </div>
        <button onClick={exportPDF} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Download className="w-5 h-5" />
          Export PDF
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <label className="block text-sm font-medium text-slate-700 mb-2">Période</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-600 text-white rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm text-blue-700 font-medium">Total commissions</p>
          <p className="text-3xl font-bold text-blue-900">{formatCurrency(stats.totalCommission)}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-green-600 text-white rounded-lg">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm text-green-700 font-medium">Nombre de paiements</p>
          <p className="text-3xl font-bold text-green-900">{stats.nombrePaiements}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-purple-600 text-white rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm text-purple-700 font-medium">Commission moyenne</p>
          <p className="text-3xl font-bold text-purple-900">{formatCurrency(stats.commissionMoyenne)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Commissions par immeuble</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="commission" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Répartition</h3>
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={chartData} dataKey="commission" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {chartData.map((_, idx) => (
                    <Cell key={idx} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Détail des commissions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-3 px-4 text-slate-700">Date</th>
                <th className="text-left py-3 px-4 text-slate-700">Locataire</th>
                <th className="text-left py-3 px-4 text-slate-700">Unité</th>
                <th className="text-left py-3 px-4 text-slate-700">Immeuble</th>
                <th className="text-right py-3 px-4 text-slate-700">Montant loyer</th>
                <th className="text-right py-3 px-4 text-slate-700">Commission</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-3 px-4 text-slate-700">{c.date_paiement}</td>
                  <td className="py-3 px-4 text-slate-700">{c.locataire}</td>
                  <td className="py-3 px-4 text-slate-700">{c.unite}</td>
                  <td className="py-3 px-4 text-slate-700">{c.immeuble}</td>
                  <td className="py-3 px-4 text-right text-slate-700 font-medium">{formatCurrency(c.montant_total)}</td>
                  <td className="py-3 px-4 text-right text-blue-600 font-semibold">{formatCurrency(c.part_agence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}