import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Cpu, Database,
  RefreshCw, TrendingUp, XCircle, Zap, BarChart3, ShieldCheck,
  Heart, Flame, Target, AreaChart, Radio,
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
  trace_id: string | null;
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

interface InvestorKpi {
  mrr: number;
  arr: number;
  ltv: number;
  cac: number;
  ltv_cac_ratio: number;
  revenue_quality_score: number;
  recurring_ratio: number;
  churn_risk: number;
  contrats_actifs: number;
  impayes_rate: number;
  paiements_total: number;
}

interface SystemHealth {
  health_score: number;
  queue_backlog: number;
  failed_jobs: number;
  orphan_events: number;
  drift_agencies: number;
  failure_rate: number;
  snapshot_at: string;
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
  paiement_sans_contrat:         'Paiement sans contrat',
  unite_loue_sans_contrat_actif: 'Unité occupée sans contrat',
  pilot_inactif:                 'Pilote inactif +30j',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

function HealthRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500';
  const label = pct >= 80 ? 'Sain' : pct >= 50 ? 'Dégradé' : 'Critique';
  return (
    <div className="flex flex-col items-center justify-center">
      <div className={`text-3xl font-black ${color}`}>{pct}%</div>
      <div className={`text-xs font-semibold mt-0.5 ${color}`}>{label}</div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color, highlight }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 flex items-start gap-3 ${highlight ? 'border-orange-300 ring-1 ring-orange-200' : 'border-slate-200'}`}>
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

function QualityBar({ label, value, max = 1, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-semibold text-slate-700">{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
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
  const [investorKpi, setInvestorKpi]     = useState<InvestorKpi | null>(null);
  const [systemHealth, setSystemHealth]   = useState<SystemHealth | null>(null);
  const [loading, setLoading]             = useState(true);
  const [runningWorker, setRunningWorker] = useState<'finance' | 'analytics' | 'heal' | null>(null);
  const [isLive, setIsLive]               = useState(false);
  const [lastRefresh, setLastRefresh]     = useState<Date>(new Date());
  const channelRef                        = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const period = today.slice(0, 7) + '-01';

      const [
        { data: outbox },
        { data: jobs },
        { data: drift },
        { data: anomalyData },
        { data: kpi },
        { data: health },
      ] = await Promise.all([
        supabase
          .from('event_outbox')
          .select('id,event_type,entity_type,status,source,agency_id,trace_id,created_at,processed_at')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase.from('job_queue').select('status'),
        supabase
          .from('vw_financial_drift_report')
          .select('agency_id,agency_nom,period,ecart,status')
          .limit(10),
        supabase
          .from('vw_system_anomalies')
          .select('agency_id,anomaly_type,entity_id,details')
          .limit(20),
        profile?.agency_id ? supabase
          .from('kpi_monthly')
          .select('mrr,arr,ltv,cac,ltv_cac_ratio,revenue_quality_score,recurring_ratio,churn_risk,contrats_actifs,impayes_rate,paiements_total')
          .eq('agency_id', profile.agency_id)
          .eq('period', period)
          .maybeSingle() : { data: null },
        supabase
          .from('system_health')
          .select('health_score,queue_backlog,failed_jobs,orphan_events,drift_agencies,failure_rate,snapshot_at')
          .order('snapshot_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setOutboxEvents(outbox ?? []);

      const stats: JobStats = { pending: 0, processing: 0, done: 0, failed: 0 };
      (jobs ?? []).forEach((j: { status: string }) => {
        if (j.status in stats) (stats as Record<string, number>)[j.status]++;
      });
      setJobStats(stats);
      setDriftAlerts(drift ?? []);
      setAnomalies(anomalyData ?? []);
      setInvestorKpi(kpi ?? null);
      setSystemHealth(health ?? null);
      setLastRefresh(new Date());
    } catch {
      showError('Impossible de charger les données d\'audit');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, profile?.agency_id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Real-time Supabase subscriptions ────────────────────────────────────────

  const startRealtime = useCallback(() => {
    if (channelRef.current) return;
    const ch = supabase
      .channel('autopilot-live')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_outbox' },
        (payload) => {
          setOutboxEvents(prev => [payload.new as OutboxEvent, ...prev.slice(0, 39)]);
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_queue' },
        () => {
          setJobStats(prev => ({ ...prev, pending: prev.pending + 1 }));
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'job_queue' },
        (payload) => {
          const j = payload.new as { status: string };
          setJobStats(prev => {
            const next = { ...prev };
            const old = payload.old as { status: string };
            if (old.status in next) (next as Record<string, number>)[old.status] = Math.max(0, (next as Record<string, number>)[old.status] - 1);
            if (j.status in next) (next as Record<string, number>)[j.status]++;
            return next;
          });
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });
    channelRef.current = ch;
  }, []);

  const stopRealtime = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setIsLive(false);
    }
  }, []);

  useEffect(() => {
    startRealtime();
    return () => stopRealtime();
  }, [startRealtime, stopRealtime]);

  // ── Worker invocations ───────────────────────────────────────────────────────

  const runWorker = async (type: 'finance' | 'analytics') => {
    setRunningWorker(type);
    try {
      const { error } = await supabase.functions.invoke(`${type}-worker`, { body: {} });
      if (error) throw error;
      success(`Worker ${type} exécuté`);
      await loadData();
    } catch {
      showError(`Erreur worker ${type}`);
    } finally {
      setRunningWorker(null);
    }
  };

  const runSelfHeal = async () => {
    setRunningWorker('heal');
    try {
      const { data, error } = await supabase.rpc('fn_self_heal');
      if (error) throw error;
      const result = data as { health_score: number; orphans_fixed: number; stale_fixed: number; drifts_queued: number };
      success(`Self-Heal OK · Santé ${Math.round((result.health_score ?? 0) * 100)}% · ${result.orphans_fixed ?? 0} orphelins · ${result.stale_fixed ?? 0} jobs · ${result.drifts_queued ?? 0} drifts`);
      await loadData();
    } catch {
      showError('Erreur Self-Heal');
    } finally {
      setRunningWorker(null);
    }
  };

  // ── Guards ───────────────────────────────────────────────────────────────────

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

  const healthPct    = systemHealth ? Math.round(systemHealth.health_score * 100) : null;
  const healthColor  = healthPct === null ? 'bg-slate-400' : healthPct >= 80 ? 'bg-emerald-500' : healthPct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const pendingOutbox = outboxEvents.filter(e => e.status === 'pending').length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-7 h-7 text-orange-500" />
            Control Tower
            {/* Live indicator */}
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ml-1 ${isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              <Radio className={`w-3 h-3 ${isLive ? 'animate-pulse' : ''}`} />
              {isLive ? 'LIVE' : 'Statique'}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Dernière synchro : {lastRefresh.toLocaleTimeString('fr-FR')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={runSelfHeal} disabled={runningWorker !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-60 transition">
            {runningWorker === 'heal' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
            Self-Heal
          </button>
          <button onClick={() => runWorker('finance')} disabled={runningWorker !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 transition">
            {runningWorker === 'finance' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Finance
          </button>
          <button onClick={() => runWorker('analytics')} disabled={runningWorker !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition">
            {runningWorker === 'analytics' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            Analytics
          </button>
          <button onClick={loadData} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── System Health Banner ── */}
      {systemHealth && (
        <div className={`rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 border ${
          healthPct! >= 80 ? 'bg-emerald-50 border-emerald-200' :
          healthPct! >= 50 ? 'bg-amber-50 border-amber-200' :
          'bg-red-50 border-red-200'}`}>
          <div className="flex-shrink-0">
            <HealthRing score={systemHealth.health_score} />
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              { label: 'Queue backlog', val: systemHealth.queue_backlog, bad: systemHealth.queue_backlog > 50 },
              { label: 'Jobs en échec', val: systemHealth.failed_jobs, bad: systemHealth.failed_jobs > 0 },
              { label: 'Orphelins', val: systemHealth.orphan_events, bad: systemHealth.orphan_events > 0 },
              { label: 'Taux échec', val: `${systemHealth.failure_rate}%`, bad: systemHealth.failure_rate > 5 },
            ].map(({ label, val, bad }) => (
              <div key={label}>
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`font-bold text-base ${bad ? 'text-red-600' : 'text-slate-900'}`}>{val}</p>
              </div>
            ))}
          </div>
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${healthColor}`} />
        </div>
      )}

      {/* ── Alertes rapides ── */}
      {(pendingOutbox > 0 || jobStats.failed > 0 || driftAlerts.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {pendingOutbox > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{pendingOutbox} événement{pendingOutbox > 1 ? 's' : ''} en attente</p>
                <p className="text-xs text-amber-600">Outbox non traité</p>
              </div>
            </div>
          )}
          {jobStats.failed > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">{jobStats.failed} job{jobStats.failed > 1 ? 's' : ''} en échec</p>
                <p className="text-xs text-red-600">Lancer Self-Heal</p>
              </div>
            </div>
          )}
          {driftAlerts.length > 0 && (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl p-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-rose-800">{driftAlerts.length} écart{driftAlerts.length > 1 ? 's' : ''} comptable{driftAlerts.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-rose-600">Ledger ↔ paiements</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Investor KPIs ── */}
      {investorKpi && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AreaChart className="w-4 h-4" /> Métriques Investisseur
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="MRR" value={formatCurrency(investorKpi.mrr)} icon={TrendingUp} color="bg-orange-500" highlight />
            <KpiCard label="ARR" value={formatCurrency(investorKpi.arr)} sub="MRR × 12" icon={AreaChart} color="bg-orange-600" />
            <KpiCard label="LTV" value={formatCurrency(investorKpi.ltv)} sub="Revenu vie client" icon={Target} color="bg-blue-500" />
            <KpiCard
              label="LTV / CAC"
              value={investorKpi.cac > 0 ? `${investorKpi.ltv_cac_ratio}×` : '—'}
              sub={investorKpi.cac > 0 ? `CAC ${formatCurrency(investorKpi.cac)}` : 'CAC non renseigné'}
              icon={Flame}
              color={investorKpi.ltv_cac_ratio >= 3 ? 'bg-emerald-500' : 'bg-amber-500'}
            />
          </div>

          {/* Revenue Quality */}
          {investorKpi.revenue_quality_score > 0 && (
            <div className="mt-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900 text-sm">Revenue Quality Score</h3>
                <span className={`text-2xl font-black ${investorKpi.revenue_quality_score >= 0.7 ? 'text-emerald-500' : investorKpi.revenue_quality_score >= 0.5 ? 'text-amber-500' : 'text-red-500'}`}>
                  {Math.round(investorKpi.revenue_quality_score * 100)}%
                </span>
              </div>
              <div className="space-y-2">
                <QualityBar label="Recurring ratio" value={investorKpi.recurring_ratio} max={100} color="bg-blue-400" />
                <QualityBar label="Payment consistency" value={(1 - (investorKpi.impayes_rate / 100)) * 100} max={100} color="bg-emerald-400" />
                <QualityBar label="Churn risk (bas = bon)" value={(1 - investorKpi.churn_risk) * 100} max={100} color="bg-orange-400" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4 sections grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Event Outbox live */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              Event Outbox
              {isLive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />}
            </h2>
            <span className="text-xs text-slate-400">{outboxEvents.length} derniers</span>
          </div>
          <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
            {outboxEvents.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">Aucun événement récent</div>
            ) : outboxEvents.map(ev => (
              <div key={ev.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{ev.event_type}</p>
                  <p className="text-xs text-slate-400">
                    {ev.entity_type} · {ev.source} · {new Date(ev.created_at).toLocaleTimeString('fr-FR')}
                  </p>
                  {ev.trace_id && (
                    <p className="text-xs text-slate-300 font-mono truncate">{ev.trace_id.slice(0, 8)}…</p>
                  )}
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
              {isLive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />}
            </h2>
            <span className="text-xs text-slate-400">Temps réel</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { label: 'En attente',  count: jobStats.pending,    color: 'text-amber-600 bg-amber-50 border-amber-200' },
              { label: 'En cours',   count: jobStats.processing,  color: 'text-blue-600 bg-blue-50 border-blue-200' },
              { label: 'Terminés',   count: jobStats.done,        color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
              { label: 'En échec',   count: jobStats.failed,      color: 'text-red-600 bg-red-50 border-red-200' },
            ].map(({ label, count, color }) => (
              <div key={label} className={`rounded-xl border p-3 text-center ${color}`}>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs mt-0.5 font-medium">{label}</p>
              </div>
            ))}
          </div>
          <div className="px-4 pb-3">
            <div className="text-xs text-slate-400 space-y-0.5">
              <p>Rule Engine appliqué à chaque job · Retry exponentiel</p>
              <p>Priority 1 = Finance critique · Dead letter après 3 échecs</p>
            </div>
          </div>
        </div>

        {/* Finance Integrity */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Intégrité financière
            </h2>
            <span className={`text-xs font-semibold ${driftAlerts.length === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {driftAlerts.length === 0 ? '✓ Ledger équilibré' : `${driftAlerts.length} écart(s)`}
            </span>
          </div>
          <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
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
                <div className="text-right">
                  <span className="text-sm font-bold text-red-600">{formatCurrency(Math.abs(d.ecart))}</span>
                  <p className="text-xs text-slate-400">écart</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Anomalies & Risk */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Anomalies &amp; Risques
            </h2>
            <span className={`text-xs font-semibold ${anomalies.length === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {anomalies.length === 0 ? '✓ Système sain' : `${anomalies.length} anomalie(s)`}
            </span>
          </div>
          <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
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

          {/* Risk summary */}
          {investorKpi && (
            <div className="border-t border-slate-100 px-4 py-3 grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Impayés', val: `${investorKpi.impayes_rate}%`, bad: investorKpi.impayes_rate > 10 },
                { label: 'Churn risk', val: `${Math.round(investorKpi.churn_risk * 100)}%`, bad: investorKpi.churn_risk > 0.2 },
                { label: 'Contrats actifs', val: investorKpi.contrats_actifs, bad: false },
              ].map(({ label, val, bad }) => (
                <div key={label}>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className={`text-sm font-bold ${bad ? 'text-red-600' : 'text-slate-800'}`}>{val}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Pipeline status ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-400" /> Autopilot Loop
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { label: 'Event Outbox', color: 'bg-orange-100 text-orange-700 border-orange-200' },
            { label: '→', color: 'text-slate-400' },
            { label: 'Rule Engine', color: 'bg-purple-100 text-purple-700 border-purple-200' },
            { label: '→', color: 'text-slate-400' },
            { label: 'Job Queue', color: 'bg-blue-100 text-blue-700 border-blue-200' },
            { label: '→', color: 'text-slate-400' },
            { label: 'Workers', color: 'bg-slate-100 text-slate-700 border-slate-200' },
            { label: '→', color: 'text-slate-400' },
            { label: 'Self-Heal', color: 'bg-rose-100 text-rose-700 border-rose-200' },
            { label: '→', color: 'text-slate-400' },
            { label: 'Ledger + KPI + Cache', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
            { label: '→', color: 'text-slate-400' },
            { label: 'Investor Dashboard', color: 'bg-orange-100 text-orange-700 border-orange-200' },
          ].map((item, i) =>
            item.label === '→'
              ? <span key={i} className={item.color}>{item.label}</span>
              : <span key={i} className={`px-2 py-1 rounded-md border font-medium ${item.color}`}>{item.label}</span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-400">
          <span>⏱ Outbox → Jobs : toutes les 5 min</span>
          <span>⏱ Finance worker : toutes les 10 min</span>
          <span>⏱ Analytics worker : toutes les 15 min</span>
          <span>⏱ Self-Heal : toutes les 30 min</span>
        </div>
      </div>
    </div>
  );
}
