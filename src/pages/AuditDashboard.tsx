import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Cpu, Database,
  RefreshCw, TrendingUp, XCircle, Zap, BarChart3, ShieldCheck,
} from 'lucide-react';
import { formatCurrency } from '../lib/formatters';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OutboxEvent {
  id: string;
  event_type: string;
  entity_type: string | null;
  status: string;
  source: string;
  agency_id: string | null;
  created_at: string;
  processed_at: string | null;
}

interface JobStats { pending: number; processing: number; done: number; failed: number; }

interface DriftAlert {
  agency_id: string;
  agency_nom: string;
  period: string;
  ecart: number;
  status: string;
}

interface Anomaly {
  agency_id: string;
  anomaly_type: string;
  entity_id: string;
  details: Record<string, unknown>;
}

interface KpiToday {
  mrr: number;
  paiements_total: number;
  paiements_count: number;
  impayes_count: number;
  active_contracts: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  pending:    'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  processed:  'bg-emerald-100 text-emerald-700',
  done:       'bg-emerald-100 text-emerald-700',
  failed:     'bg-red-100 text-red-700',
};

const ANOMALY_LABELS: Record<string, string> = {
  paiement_sans_contrat:       'Paiement sans contrat',
  unite_loue_sans_contrat_actif: 'Unité occupée sans contrat',
  pilot_inactif:               'Pilote inactif +30j',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-lg font-bold text-slate-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function AuditDashboard() {
  const { profile } = useAuth();
  const { success, error: showError, toasts, removeToast } = useToast();

  const [outboxEvents, setOutboxEvents]   = useState<OutboxEvent[]>([]);
  const [jobStats, setJobStats]           = useState<JobStats>({ pending: 0, processing: 0, done: 0, failed: 0 });
  const [driftAlerts, setDriftAlerts]     = useState<DriftAlert[]>([]);
  const [anomalies, setAnomalies]         = useState<Anomaly[]>([]);
  const [kpiToday, setKpiToday]           = useState<KpiToday | null>(null);
  const [loading, setLoading]             = useState(true);
  const [runningWorker, setRunningWorker] = useState<'finance' | 'analytics' | null>(null);
  const [lastRefresh, setLastRefresh]     = useState<Date>(new Date());

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [
        { data: outbox },
        { data: jobs },
        { data: drift },
        { data: anomalyData },
        { data: kpi },
      ] = await Promise.all([
        supabase
          .from('event_outbox')
          .select('id, event_type, entity_type, status, source, agency_id, created_at, processed_at')
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('job_queue')
          .select('status'),
        supabase
          .from('vw_financial_drift_report')
          .select('agency_id, agency_nom, period, ecart, status')
          .limit(10),
        supabase
          .from('vw_system_anomalies')
          .select('agency_id, anomaly_type, entity_id, details')
          .limit(20),
        profile?.agency_id ? supabase
          .from('kpi_daily')
          .select('mrr, paiements_total, paiements_count, impayes_count, active_contracts')
          .eq('agency_id', profile.agency_id)
          .eq('date', new Date().toISOString().split('T')[0])
          .maybeSingle() : { data: null },
      ]);

      setOutboxEvents(outbox ?? []);

      const stats: JobStats = { pending: 0, processing: 0, done: 0, failed: 0 };
      (jobs ?? []).forEach((j: { status: string }) => {
        if (j.status in stats) (stats as Record<string, number>)[j.status]++;
      });
      setJobStats(stats);
      setDriftAlerts(drift ?? []);
      setAnomalies(anomalyData ?? []);
      setKpiToday(kpi ?? null);
      setLastRefresh(new Date());
    } catch {
      showError('Impossible de charger les données d\'audit');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, profile?.agency_id]);

  useEffect(() => { loadData(); }, [loadData]);

  const runWorker = async (type: 'finance' | 'analytics') => {
    setRunningWorker(type);
    try {
      const { error } = await supabase.functions.invoke(`${type}-worker`, { body: {} });
      if (error) throw error;
      success(`Worker ${type} exécuté avec succès`);
      await loadData();
    } catch {
      showError(`Erreur lors de l'exécution du worker ${type}`);
    } finally {
      setRunningWorker(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="text-center">
          <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">Accès réservé aux administrateurs</p>
        </div>
      </div>
    );
  }

  const pendingOutbox = outboxEvents.filter(e => e.status === 'pending').length;
  const failedJobs    = jobStats.failed;
  const driftCount    = driftAlerts.length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-7 h-7 text-orange-500" />
            Control Tower
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Dernière mise à jour : {lastRefresh.toLocaleTimeString('fr-FR')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => runWorker('finance')}
            disabled={runningWorker !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 transition"
          >
            {runningWorker === 'finance' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Finance Worker
          </button>
          <button
            onClick={() => runWorker('analytics')}
            disabled={runningWorker !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition"
          >
            {runningWorker === 'analytics' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            Analytics Worker
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Alertes rapides */}
      {(pendingOutbox > 0 || failedJobs > 0 || driftCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {pendingOutbox > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{pendingOutbox} événement{pendingOutbox > 1 ? 's' : ''} en attente</p>
                <p className="text-xs text-amber-600">Outbox à traiter</p>
              </div>
            </div>
          )}
          {failedJobs > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">{failedJobs} job{failedJobs > 1 ? 's' : ''} en échec</p>
                <p className="text-xs text-red-600">Intervention requise</p>
              </div>
            </div>
          )}
          {driftCount > 0 && (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl p-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-rose-800">{driftCount} écart{driftCount > 1 ? 's' : ''} comptable{driftCount > 1 ? 's' : ''}</p>
                <p className="text-xs text-rose-600">Ledger ↔ paiements</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI aujourd'hui */}
      {kpiToday && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">KPI du jour</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <KpiCard label="MRR" value={formatCurrency(kpiToday.mrr)} icon={TrendingUp} color="bg-orange-500" />
            <KpiCard label="Encaissé" value={formatCurrency(kpiToday.paiements_total)} sub={`${kpiToday.paiements_count} paiements`} icon={CheckCircle2} color="bg-emerald-500" />
            <KpiCard label="Impayés" value={kpiToday.impayes_count} icon={AlertTriangle} color="bg-red-500" />
            <KpiCard label="Contrats actifs" value={kpiToday.active_contracts} icon={Activity} color="bg-blue-500" />
            <KpiCard label="Jobs en file" value={jobStats.pending + jobStats.processing} sub={`${jobStats.failed} en échec`} icon={Zap} color="bg-purple-500" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Outbox live */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              Event Outbox
            </h2>
            <span className="text-xs text-slate-400">{outboxEvents.length} derniers</span>
          </div>
          <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
            {outboxEvents.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">Aucun événement récent</div>
            ) : outboxEvents.map(ev => (
              <div key={ev.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{ev.event_type}</p>
                  <p className="text-xs text-slate-400">
                    {ev.entity_type} · {ev.source} · {new Date(ev.created_at).toLocaleTimeString('fr-FR')}
                  </p>
                </div>
                <StatusBadge status={ev.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Job Queue */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-500" />
              Job Queue
            </h2>
            <span className="text-xs text-slate-400">Stats actuelles</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { label: 'En attente', count: jobStats.pending, color: 'text-amber-600 bg-amber-50 border-amber-200' },
              { label: 'En cours', count: jobStats.processing, color: 'text-blue-600 bg-blue-50 border-blue-200' },
              { label: 'Terminés', count: jobStats.done, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
              { label: 'En échec', count: jobStats.failed, color: 'text-red-600 bg-red-50 border-red-200' },
            ].map(({ label, count, color }) => (
              <div key={label} className={`rounded-xl border p-3 text-center ${color}`}>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs mt-0.5 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Finance Integrity */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Intégrité financière
            </h2>
            <span className={`text-xs font-semibold ${driftCount === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {driftCount === 0 ? '✓ Tout équilibré' : `${driftCount} écart(s)`}
            </span>
          </div>
          <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
            {driftAlerts.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Ledger = Paiements · Aucun écart</p>
              </div>
            ) : driftAlerts.map((d, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{d.agency_nom}</p>
                  <p className="text-xs text-slate-400">{d.period}</p>
                </div>
                <span className="text-sm font-bold text-red-600">{formatCurrency(Math.abs(d.ecart))}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Anomalies système */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Anomalies système
            </h2>
            <span className={`text-xs font-semibold ${anomalies.length === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {anomalies.length === 0 ? '✓ Système sain' : `${anomalies.length} anomalie(s)`}
            </span>
          </div>
          <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
            {anomalies.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Aucune anomalie détectée</p>
              </div>
            ) : anomalies.map((a, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {ANOMALY_LABELS[a.anomaly_type] ?? a.anomaly_type}
                  </p>
                  <p className="text-xs text-slate-400 font-mono truncate">
                    {JSON.stringify(a.details).slice(0, 80)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
