import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, BarChart3, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../lib/formatters';
import {
  addFooter,
  drawDocumentHeader,
  drawPageBorder,
  drawSectionFrame,
  drawTotalsBlock,
  getAutoTableTheme,
  saveGeneratedPdf,
} from '../lib/pdf';
import { allocateDocumentReference } from '../services/documentTemplateService';
import { PageSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { FinancePageHeader } from '../components/finance/FinancePrimitives';
import { runDocumentGeneration } from '../lib/documentGeneration';

interface CommissionRow {
  id: string;
  montant_total: number;
  part_agence: number;
  date_paiement: string;
  statut: string;
  locataire: string;
  unite: string;
  immeuble: string;
  bailleur: string;
  contrats?: {
    locataires?: { nom?: string | null; prenom?: string | null } | null;
    unites?: {
      nom?: string | null;
      immeubles?: {
        nom?: string | null;
        bailleurs?: { nom?: string | null; prenom?: string | null } | null;
      } | null;
    } | null;
  } | null;
}

interface CommissionChartRow {
  name: string;
  commission: number;
}

export function Commissions() {
  const { profile } = useAuth();
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [chartData, setChartData] = useState<CommissionChartRow[]>([]);
  const [stats, setStats] = useState({
    totalCommission: 0,
    nombrePaiements: 0,
    commissionMoyenne: 0,
  });
  const [loading, setLoading] = useState(true);
  const [exportingLedger, setExportingLedger] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const loadCommissions = useCallback(async () => {
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

      const commissionsData = ((data || []) as unknown as CommissionRow[]).map((p) => ({
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
  }, [profile?.agency_id, selectedMonth]);

  useEffect(() => {
    if (profile?.agency_id) {
      loadCommissions();
    }
  }, [loadCommissions, profile?.agency_id]);

  const exportPDF = async () => {
    const agencyId = profile?.agency_id;
    await runDocumentGeneration(
      {
        key: `commission:${agencyId ?? 'agency'}:${selectedMonth}`,
        kind: 'commission',
        title: 'Préparation du rapport des commissions',
        source: 'commissions',
        archiveExpected: true,
      },
      async (generation) => {
        const reference = await allocateDocumentReference({
          documentType: 'commission',
          entityId: agencyId ?? 'commissions',
          periodKey: selectedMonth,
          prefix: 'COMM',
          fallback: `COMM-${selectedMonth}`,
        });
        generation.report('building-document', { reference });
        const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
        const monthName = new Date(selectedMonth).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });

        drawPageBorder(doc);
        const headerY = await drawDocumentHeader(doc, {}, 'Rapport des commissions', `Période : ${monthName}`, {
          reference,
          issueDate: new Date().toLocaleDateString('fr-FR'),
          documentType: 'Rapport financier',
        });
        const tableTheme = getAutoTableTheme();
        const y = drawTotalsBlock(
          doc,
          14,
          headerY + 6,
          182,
          [
            { label: 'Total commissions', value: formatCurrency(stats.totalCommission), emphasis: true },
            { label: 'Nombre de paiements', value: stats.nombrePaiements.toString() },
            { label: 'Commission moyenne', value: formatCurrency(stats.commissionMoyenne) },
            { label: 'Période', value: monthName },
          ]
        );

        const detailsY = y + 2;
        drawSectionFrame(doc, 14, detailsY, 182, 12, undefined, {
          title: 'Détail des commissions',
          accent: 'primary',
          fill: false,
        });
        autoTable(doc, {
          head: [['Locataire', 'Unité', 'Immeuble', 'Montant', 'Commission']],
          body: commissions.map((c) => [
            c.locataire,
            c.unite,
            c.immeuble,
            formatCurrency(c.montant_total),
            formatCurrency(c.part_agence),
          ]),
          startY: detailsY + 16,
          theme: 'grid',
          ...tableTheme,
          styles: { ...tableTheme.styles, fontSize: 8.2, overflow: 'linebreak' },
          headStyles: { ...tableTheme.headStyles, fontSize: 7.8 },
          margin: { left: 14, right: 14 },
          columnStyles: {
            3: { halign: 'right' },
            4: { halign: 'right', fontStyle: 'bold' },
          },
        });

        addFooter(doc);
        generation.report('securing-document', { reference });
        await saveGeneratedPdf(doc, {
          kind: 'commission',
          title: 'Rapport des commissions',
          fileName: `commissions-${selectedMonth}.pdf`,
          source: 'commissions',
          documentType: 'rapport_bailleur',
          entityId: agencyId ? `commissions-${agencyId}` : 'commissions',
          period: selectedMonth,
          reference,
          data: {
            document: 'commissions',
            selectedMonth,
            commissions,
          },
          generation,
          metadata: {
            documentType: 'commission',
            reference,
            period: monthName,
          },
        });
      },
    );
  };

  const exportSignedLedger = async () => {
    setExportingLedger(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error('Session expirée. Veuillez vous reconnecter.');

      const monthStart = `${selectedMonth}-01`;
      const monthEnd = new Date(selectedMonth + '-01');
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      const dateTo = monthEnd.toISOString().slice(0, 10);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-accounting-ledger`, {
        method: 'POST',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date_from: monthStart, date_to: dateTo }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? `Export impossible (${response.status})`);
      if (payload?.signed_url) window.open(payload.signed_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Export comptable impossible');
    } finally {
      setExportingLedger(false);
    }
  };

  if (loading) {
    return <PageSkeleton title="Commissions" variant="analytics" />;
  }

  return (
    <div className="sk-page-shell space-y-6 lg:space-y-8">
      <FinancePageHeader
        eyebrow="ENCAISSEMENT & FINANCE"
        title="Commissions agence"
        description="Suivez les revenus d'agence et les exports comptables du mois."
        mobileDescription="Commissions agence."
        primaryLabel="Export PDF"
        primaryIcon={<Download className="h-4 w-4" />}
        onPrimary={() => void exportPDF()}
        secondaryLabel={exportingLedger ? 'Signature...' : 'Livre signé CSV'}
        secondaryIcon={<Download className="h-4 w-4" />}
        onSecondary={exportSignedLedger}
        secondaryDisabled={exportingLedger}
      />

      <div className="sk-card p-4 sm:p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">Période</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="sk-input text-sm w-full sm:w-auto"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="sk-card p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 sm:p-3 bg-brand-700 text-white rounded-lg">
              <TrendingUp className="w-4 sm:w-5 h-4 sm:h-5" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-brand-700 font-bold">Total commissions</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-950 mt-1">{formatCurrency(stats.totalCommission)}</p>
        </div>

        <div className="sk-card p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 sm:p-3 bg-green-600 text-white rounded-lg">
              <BarChart3 className="w-4 sm:w-5 h-4 sm:h-5" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-green-700 font-medium">Nombre de paiements</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-950 mt-1">{stats.nombrePaiements}</p>
        </div>

        <div className="sk-card p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 sm:p-3 bg-purple-600 text-white rounded-lg">
              <TrendingUp className="w-4 sm:w-5 h-4 sm:h-5" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-purple-700 font-medium">Commission moyenne</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-950 mt-1">{formatCurrency(stats.commissionMoyenne)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="sk-card-premium p-4 sm:p-6">
          <h3 className="text-base lg:text-lg font-semibold text-slate-900 mb-4">Commissions par immeuble</h3>
          <ResponsiveContainer width="100%" height={200} className="sm:h-[250px]">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="commission" fill="#166534" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="sk-card-premium p-4 sm:p-6">
          <h3 className="text-base lg:text-lg font-semibold text-slate-900 mb-4">Répartition</h3>
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={200} className="sm:h-[250px]">
              <PieChart>
                <Pie data={chartData} dataKey="commission" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {chartData.map((_, idx) => (
                    <Cell key={idx} fill={['#166534', '#10b981', '#f97316', '#ef4444', '#8b5cf6'][idx % 5]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="sk-card-premium p-4 sm:p-6">
        <h3 className="text-base lg:text-lg font-semibold text-slate-900 mb-4">Détail des commissions</h3>

        {commissions.length === 0 ? (
          <EmptyState
            bare
            icon={TrendingUp}
            title="Aucune commission"
            description="Aucune commission enregistrée pour cette période."
          />
        ) : (
          <>
            {/* Mobile: card view */}
            <div className="sm:hidden space-y-3">
              {commissions.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-100 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-700">{c.locataire}</span>
                    <span className="text-xs text-slate-500">{c.date_paiement}</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    <div className="flex justify-between px-4 py-2 text-sm">
                      <span className="text-slate-500">Unité</span>
                      <span className="text-slate-800 font-medium">{c.unite}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2 text-sm">
                      <span className="text-slate-500">Immeuble</span>
                      <span className="text-slate-800">{c.immeuble}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2 text-sm">
                      <span className="text-slate-500">Loyer</span>
                      <span className="text-slate-800 font-medium">{formatCurrency(c.montant_total)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5 text-sm bg-blue-50">
                      <span className="text-blue-700 font-semibold">Commission</span>
                      <span className="text-blue-700 font-bold">{formatCurrency(c.part_agence)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table view */}
            <div className="hidden sm:block overflow-x-auto">
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
          </>
        )}
      </div>
    </div>
  );
}
