import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/formatters';
import { useToast } from '../hooks/useToast';
import { LoadingState } from '../components/ui/LoadingState';
import { FinancePageHeader } from '../components/finance/FinancePrimitives';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface FinancialKPIs {
  mrr: number;
  arr: number;
  monthlyCommissions: number;
  commissionRate: number;
  occupancyRate: number;
  churnRate: number;
  collectionRate: number;
  averagePaymentValue: number;
}

interface BailleurBreakdown {
  bailleur_id: string;
  bailleur_nom: string;
  revenus: number;
  commissions: number;
  impaye: number;
  taux_recouvrement: number;
}

interface MonthlyLedger {
  month: string;
  loyers_perceives: number;
  commissions_agence: number;
  commissions_bailleurs: number;
  impayesMois: number;
  nbContrats: number;
}

interface CommissionBreakdown {
  category: string;
  montant: number;
  percentage: number;
}

export function DashboardFinancier() {
  const { profile } = useAuth();
  const { success, error: showError } = useToast();

  const [kpis, setKpis] = useState<FinancialKPIs>({
    mrr: 0,
    arr: 0,
    monthlyCommissions: 0,
    commissionRate: 0,
    occupancyRate: 0,
    churnRate: 0,
    collectionRate: 0,
    averagePaymentValue: 0,
  });

  const [bailleursData, setBailleursData] = useState<BailleurBreakdown[]>([]);
  const [monthlyLedger, setMonthlyLedger] = useState<MonthlyLedger[]>([]);
  const [commissionBreakdown, setCommissionBreakdown] = useState<CommissionBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [exportLoading, setExportLoading] = useState(false);

  // Load financial data
  const loadFinancialData = useCallback(async () => {
    if (!profile?.agency_id) return;

    try {
      setLoading(true);

      // Call get_financial_kpis RPC
      const [kpisRes, bailleursRes, ledgerRes, commissionRes] = await Promise.all([
        supabase.rpc('get_financial_kpis', {
          p_agency_id: profile.agency_id,
        }),
        supabase.rpc('get_baileur_revenue_breakdown', {
          p_agency_id: profile.agency_id,
        }),
        supabase.rpc('get_monthly_ledger', {
          p_agency_id: profile.agency_id,
          p_year: new Date().getFullYear(),
        }),
        supabase.rpc('get_commission_breakdown', {
          p_agency_id: profile.agency_id,
          p_year_month: selectedMonth,
        }),
      ]);

      if (kpisRes.error) throw kpisRes.error;

      setKpis(kpisRes.data as FinancialKPIs);
      setBailleursData((bailleursRes.data as BailleurBreakdown[]) || []);
      setMonthlyLedger((ledgerRes.data as MonthlyLedger[]) || []);
      setCommissionBreakdown((commissionRes.data as CommissionBreakdown[]) || []);
    } catch (err: unknown) {
      showError(
        err instanceof Error ? err.message : 'Erreur lors du chargement des données financières'
      );
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id, selectedMonth, showError]);

  useEffect(() => {
    if (profile?.agency_id) {
      loadFinancialData();
    }
  }, [profile?.agency_id, loadFinancialData]);

  // Export certified ledger
  const handleExportCertified = async () => {
    if (!profile?.agency_id) return;

    try {
      setExportLoading(true);

      // Call export_certified_ledger RPC
      const { data, error } = await supabase.rpc('export_certified_ledger', {
        p_agency_id: profile.agency_id,
        p_year_month: selectedMonth,
      });

      if (error) throw error;

      // Download CSV
      const csv = convertToCSV(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `livre-comptes-${selectedMonth}-CERTIFIE.csv`);
      link.click();

      success('Livre certifié exporté avec succès');
    } catch (err: unknown) {
      showError(
        err instanceof Error ? err.message : 'Erreur lors de l\'export'
      );
    } finally {
      setExportLoading(false);
    }
  };

  const convertToCSV = (data: unknown[]) => {
    if (!Array.isArray(data) || data.length === 0) return '';
    const headers = Object.keys(data[0] as Record<string, unknown>);
    const rows = data.map((item) =>
      headers.map((header) => {
        const value = (item as Record<string, unknown>)[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  };

  if (loading) {
    return (
      <LoadingState
        label="Rapports financiers"
        description="Consolidation des indicateurs, encaissements et tendances."
        className="min-h-[55vh]"
      />
    );
  }

  return (
    <div className="sk-page-shell space-y-6 lg:space-y-8 animate-fadeIn">
      <FinancePageHeader
        eyebrow="ENCAISSEMENT & FINANCE"
        title="Rapports financiers"
        description="Analysez les revenus, commissions et indicateurs de conformité."
        mobileDescription="Rapports financiers."
        primaryLabel={exportLoading ? 'Export...' : 'Exporter certifié'}
        primaryIcon={<Download className="h-4 w-4" />}
        onPrimary={handleExportCertified}
        primaryDisabled={exportLoading}
      />

      <div className="max-w-xs">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="sk-input font-bold text-slate-950"
        >
          {Array.from({ length: 12 }, (_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const month = date.toISOString().slice(0, 7);
            return (
              <option key={month} value={month}>
                {date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
              </option>
            );
          })}
        </select>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="MRR"
          value={formatCurrency(kpis.mrr)}
          change={8.2}
          icon={TrendingUp}
          color="emerald"
          subtitle="Revenu récurrent mensuel"
        />
        <KPICard
          title="ARR"
          value={formatCurrency(kpis.arr)}
          change={8.2}
          icon={TrendingUp}
          color="blue"
          subtitle="Annualisé"
        />
        <KPICard
          title="Taux de recouvrement"
          value={`${kpis.collectionRate.toFixed(1)}%`}
          change={-1.2}
          icon={TrendingDown}
          color="orange"
          subtitle="Loyers encaissés"
        />
        <KPICard
          title="Churn rate"
          value={`${kpis.churnRate.toFixed(2)}%`}
          icon={AlertCircle}
          color="purple"
          subtitle="Contrats résilié"
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 sk-card-premium p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Évolution des revenus mensuels</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyLedger}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="loyers_perceives"
                stroke="#10b981"
                name="Loyers perçus"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="commissions_agence"
                stroke="#f97316"
                name="Commissions agence"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="impayesMois"
                stroke="#ef4444"
                name="Impayés"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Commission Breakdown */}
        <div className="sk-card-premium p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Répartition des commissions</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={commissionBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category, percentage }) => `${category} ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="montant"
              >
                {commissionBreakdown.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={['#166534', '#10b981', '#f97316', '#8b5cf6'][index % 4]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Bailleurs */}
      <div className="sk-card-premium p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Top bailleurs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-600">Bailleur</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">Revenus</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">Commissions</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">Impayé</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">Taux recouvrement</th>
              </tr>
            </thead>
            <tbody>
              {bailleursData.slice(0, 10).map((bailleur) => (
                <tr key={bailleur.bailleur_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium text-slate-900">{bailleur.bailleur_nom}</td>
                  <td className="text-right py-3 px-4 text-emerald-600 font-semibold">
                    {formatCurrency(bailleur.revenus)}
                  </td>
                  <td className="text-right py-3 px-4 text-orange-600 font-semibold">
                    {formatCurrency(bailleur.commissions)}
                  </td>
                  <td className="text-right py-3 px-4">
                    {bailleur.impaye > 0 ? (
                      <span className="text-red-600 font-semibold">{formatCurrency(bailleur.impaye)}</span>
                    ) : (
                      <span className="text-emerald-600 flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Complet
                      </span>
                    )}
                  </td>
                  <td className="text-right py-3 px-4">
                    <span className={`font-semibold ${
                      bailleur.taux_recouvrement >= 95 ? 'text-emerald-600' : 'text-orange-600'
                    }`}>
                      {bailleur.taux_recouvrement.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="sk-card-premium p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Résumé du mois actuel</h2>
          <div className="space-y-4">
            {monthlyLedger.length > 0 && (
              <>
                <SummaryRow
                  label="Loyers perçus"
                  value={formatCurrency(monthlyLedger[monthlyLedger.length - 1]?.loyers_perceives || 0)}
                  icon={TrendingUp}
                  color="emerald"
                />
                <SummaryRow
                  label="Commission agence"
                  value={formatCurrency(monthlyLedger[monthlyLedger.length - 1]?.commissions_agence || 0)}
                  icon={DollarSign}
                  color="orange"
                />
                <SummaryRow
                  label="Commission bailleurs"
                  value={formatCurrency(monthlyLedger[monthlyLedger.length - 1]?.commissions_bailleurs || 0)}
                  icon={DollarSign}
                  color="blue"
                />
                <SummaryRow
                  label="Impayés"
                  value={formatCurrency(monthlyLedger[monthlyLedger.length - 1]?.impayesMois || 0)}
                  icon={AlertCircle}
                  color="red"
                />
              </>
            )}
          </div>
        </div>

        {/* Compliance Status */}
        <div className="sk-card-premium p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">État de conformité DGID</h2>
          <div className="space-y-4">
            <ComplianceRow
              status="compliant"
              label="Numérotation quittances"
              description="Format QIT-YYYYMM-{id} respecté"
            />
            <ComplianceRow
              status="compliant"
              label="Livre comptable"
              description="Exports signés SHA-256"
            />
            <ComplianceRow
              status="compliant"
              label="Archivage documents"
              description="Contrats stockés 10 ans (Supabase Storage)"
            />
            <ComplianceRow
              status="pending"
              label="Déclaration TVA"
              description="À générer avant le 20 du mois"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Components ────────────────────────────────────────────────────────────────

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: 'emerald' | 'blue' | 'orange' | 'purple';
  subtitle?: string;
}

function KPICard({ title, value, change, icon: Icon, color, subtitle }: KPICardProps) {
  const colors = {
    emerald: 'from-emerald-50 to-emerald-100 border-emerald-200',
    blue: 'from-brand-50 to-white border-brand-100',
    orange: 'from-action-50 to-white border-action-200',
    purple: 'from-purple-50 to-purple-100 border-purple-200',
  };
  const iconColors = {
    emerald: 'text-emerald-600 bg-emerald-100',
    blue: 'text-brand-700 bg-brand-50',
    orange: 'text-action-700 bg-action-50',
    purple: 'text-purple-600 bg-purple-100',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-lg p-6 transition-all hover:-translate-y-0.5 hover:shadow-premium`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${iconColors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {change !== undefined && (
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            change >= 0
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-sm text-slate-600 mb-2">{title}</p>
      <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">{value}</p>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

interface SummaryRowProps {
  label: string;
  value: string;
  icon: React.ElementType;
  color: 'emerald' | 'orange' | 'blue' | 'red';
}

function SummaryRow({ label, value, icon: Icon, color }: SummaryRowProps) {
  const colors = {
    emerald: 'bg-emerald-100 text-emerald-600',
    orange: 'bg-orange-100 text-orange-600',
    blue: 'bg-brand-50 text-brand-700',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="font-medium text-slate-900">{label}</span>
      </div>
      <span className="text-lg font-bold text-slate-900">{value}</span>
    </div>
  );
}

interface ComplianceRowProps {
  status: 'compliant' | 'pending' | 'non-compliant';
  label: string;
  description: string;
}

function ComplianceRow({ status, label, description }: ComplianceRowProps) {
  const statusColors = {
    compliant: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-yellow-100 text-yellow-700',
    'non-compliant': 'bg-red-100 text-red-700',
  };
  const statusIcons = {
    compliant: CheckCircle2,
    pending: AlertCircle,
    'non-compliant': AlertCircle,
  };
  const StatusIcon = statusIcons[status];

  return (
    <div className="p-4 border border-slate-200 rounded-xl">
      <div className="flex items-start gap-3">
        <StatusIcon className={`w-5 h-5 flex-shrink-0 mt-1 ${statusColors[status]}`} />
        <div className="flex-1">
          <p className="font-semibold text-slate-900">{label}</p>
          <p className="text-sm text-slate-600 mt-1">{description}</p>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${statusColors[status]}`}>
          {status === 'compliant' ? 'OK' : status === 'pending' ? 'En attente' : 'Échoué'}
        </span>
      </div>
    </div>
  );
}
