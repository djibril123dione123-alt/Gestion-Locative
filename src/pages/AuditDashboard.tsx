import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Cpu, Database,
  RefreshCw, TrendingUp, XCircle, BarChart3, ShieldCheck,
  Radio, Users, Layers, Bell,
} from 'lucide-react';
import { formatCurrency } from '../lib/formatters';
import { ToastContainer } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OutboxEvent {
  id: string;
  event_type: string;
  entity_type: string | null;
  status: string;
  source: string;
  trace_id: string | null;
  created_at: string;
}

interface JobStats {
  pending: number;
  processing: number;
  done: number;
  failed: number;
}

interface HealthBlock {
  queue_size: number;
  failure_rate: number;
  processing_time_avg: number;
  ledger_drift: number;
}

interface FinanceBlock {
  mrr: number;
  cash_collected: number;
  ledger_balance: number;
  drift_count: number;
}

interface GrowthBlock {
  arr: number;
  agencies_active: number;
  contrats_actifs: number;
  churn_rate: number;
  mrr_growth: number;
  impayes_rate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending:    'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  processed:  'bg-emerald-100 text-emerald-700',
  done:       'bg-emerald-100 text-emerald-700',
  failed:     'bg-red-100 text-red-700',
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

function BlockTitle({ icon: Icon, label, accent }: {
  icon: React.ElementType; label: string; accent: string;
}) {
  return (
    <div className={`flex items-center gap-2 mb-4 pb-2 border-b ${accent}`}>
      <Icon className="w-4 h-4" />
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
    </div>
  );
}

function Metric({ label, value, highlight, sub }: {
  label: string; value: string | number; highlight?: boolean; sub?: string;
}) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-300">{sub}</p>}
      </div>
      <span className={`text-sm font-bold tabular-nums ${highlight ? 'text-red-600' : 'text-slate-900'}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function AuditDashboard() {
  const { profile } = useAuth();
  const { success, error: showError, toasts, removeToast } = useToast();

  const [outboxEvents, setOutboxEvents] = useState<OutboxEvent[]>([]);
  const [jobStats, setJobStats]         = useState<JobStats>({ pending: 0, processing: 0, done: 0, failed: 0 });
  const [health, setHealth]             = useState<HealthBlock | null>(null);
  const [finance, setFinance]           = useState<FinanceBlock | null>(null);
  const [growth, setGrowth]             = useState<GrowthBlock | null>(null);
  const [loading, setLoading]           = useState(true);
  const [runningWorker, setRunningWorker] = useState<'finance' | 'analytics' | 'notification' | null>(null);
  const [isLive, setIsLive]             = useState(false);
  const [lastRefresh, setLastRefresh]   = useState(new Date());
  const channelRef                      = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const period = new Date().toISOString().slice(0, 7) + '-01';

      const [
        { data: outbox },
        { data: jobs },
        { data: systemSnap },
        { data: ledgerCredits },
        { data: drifts },
        { data: kpi },
        agenciesRes,
      ] = await Promise.all([
        supabase
          .from('event_outbox')
          .select('id,event_type,entity_type,status,source,trace_id,created_at')
          .order('created_at', { ascending: false })
          .limit(40),

        supabase.from('job_queue').select('status'),

        // Dernier snapshot de santé
        supabase
          .from('system_health')
          .select('queue_backlog,failure_rate,processing_time_avg,ledger_drift')
          .order('snapshot_at', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Ledger balance (somme crédits)
        supabase
          .from('ledger_entries')
          .select('amount')
          .eq('type', 'credit'),

        // Drifts financiers
        supabase
          .from('financial_snapshots')
          .select('id')
          .eq('status', 'drift'),

        // KPI mensuel
        profile?.agency_id
          ? supabase
              .from('kpi_monthly')
              .select('mrr,arr,contrats_actifs,impayes_rate,paiements_total,churn_rate,mrr_growth')
              .eq('agency_id', profile.agency_id)
              .eq('period', period)
              .maybeSingle()
          : Promise.resolve({ data: null }),

        // Agences actives (super_admin seulement)
        profile?.role === 'super_admin'
          ? supabase
              .from('agencies')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'active')
          : Promise.resolve({ data: null, count: 0 }),
      ]);

      // Outbox
      setOutboxEvents(outbox ?? []);

      // Jobs
      const stats: JobStats = { pending: 0, processing: 0, done: 0, failed: 0 };
      (jobs ?? []).forEach((j: { status: string }) => {
        if (j.status in stats) (stats as Record<string, number>)[j.status]++;
      });
      setJobStats(stats);

      // Health block — live depuis jobs si pas de snapshot
      const failRate = stats.done + stats.failed > 0
        ? Math.round((stats.failed / (stats.done + stats.failed)) * 100)
        : 0;
      setHealth({
        queue_size:          systemSnap?.queue_backlog ?? stats.pending,
        failure_rate:        systemSnap?.failure_rate  ?? failRate,
        processing_time_avg: systemSnap?.processing_time_avg ?? 0,
        ledger_drift:        systemSnap?.ledger_drift ?? 0,
      });

      // Finance block
      const ledgerBalance = (ledgerCredits ?? []).reduce((s: number, e: { amount: number }) => s + (e.amount ?? 0), 0);
      setFinance({
        mrr:            kpi?.mrr ?? 0,
        cash_collected: kpi?.paiements_total ?? 0,
        ledger_balance: ledgerBalance,
        drift_count:    (drifts ?? []).length,
      });

      // Growth block
      setGrowth({
        arr:             kpi?.arr ?? 0,
        agencies_active: (agenciesRes as { count: number }).count ?? 0,
        contrats_actifs: kpi?.contrats_actifs ?? 0,
        churn_rate:      kpi?.churn_rate ?? 0,
        mrr_growth:      kpi?.mrr_growth ?? 0,
        impayes_rate:    kpi?.impayes_rate ?? 0,
      });

      setLastRefresh(new Date());
    } catch {
      showError('Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, profile?.agency_id, profile?.role]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Realtime — event_outbox + job_queue uniquement ───────────────────────

  useEffect(() => {
    if (!isAdmin) return;

    const ch = supabase
      .channel('v31-audit-live')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_outbox' },
        (payload) => setOutboxEvents(prev => [payload.new as OutboxEvent, ...prev.slice(0, 39)])
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_queue' },
        () => setJobStats(prev => ({ ...prev, pending: prev.pending + 1 }))
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'job_queue' },
        (payload) => {
          const next = payload.new as { status: string };
          const prev_s = payload.old as { status: string };
          setJobStats(prev => {
            const s = { ...prev };
            if (prev_s.status in s) (s as Record<string, number>)[prev_s.status] = Math.max(0, (s as Record<string, number>)[prev_s.status] - 1);
            if (next.status in s) (s as Record<string, number>)[next.status]++;
            return s;
          });
        }
      )
      .subscribe(st => setIsLive(st === 'SUBSCRIBED'));

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); setIsLive(false); };
  }, [isAdmin]);

  // ── Worker invocations ───────────────────────────────────────────────────

  const runWorker = async (type: 'finance' | 'analytics' | 'notification') => {
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

  // ── Guard ────────────────────────────────────────────────────────────────

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

  const hasAlerts = jobStats.failed > 0 || (finance?.drift_count ?? 0) > 0 || (health?.ledger_drift ?? 0) > 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-7 h-7 text-orange-500" />
            Control Tower
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              <Radio className={`w-3 h-3 ${isLive ? 'animate-pulse' : ''}`} />
              {isLive ? 'LIVE' : 'Statique'}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Synchro : {lastRefresh.toLocaleTimeString('fr-FR')}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => runWorker('finance')} disabled={runningWorker !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition">
            {runningWorker === 'finance' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Finance
          </button>
          <button onClick={() => runWorker('analytics')} disabled={runningWorker !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
            {runningWorker === 'analytics' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            Analytics
          </button>
          <button onClick={() => runWorker('notification')} disabled={runningWorker !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition">
            {runningWorker === 'notification' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            Notifs
          </button>
          <button onClick={loadData} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Alertes rapides ── */}
      {hasAlerts && (
        <div className="flex flex-wrap gap-2">
          {jobStats.failed > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-red-700">
                {jobStats.failed} job{jobStats.failed > 1 ? 's' : ''} en échec
              </span>
            </div>
          )}
          {(finance?.drift_count ?? 0) > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-amber-700">
                {finance!.drift_count} écart{finance!.drift_count > 1 ? 's' : ''} ledger
              </span>
            </div>
          )}
          {(health?.ledger_drift ?? 0) > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-orange-700">
                Drift {formatCurrency(health!.ledger_drift)} ce mois
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── 3 Blocs Série A ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* BLOC 1 — SYSTEM HEALTH */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <BlockTitle icon={Cpu} label="System Health" accent="border-slate-200 text-slate-500" />
          <Metric label="Queue size"     value={health?.queue_size ?? jobStats.pending}
            highlight={(health?.queue_size ?? jobStats.pending) > 50} />
          <Metric label="Failure rate"   value={`${health?.failure_rate ?? 0}%`}
            highlight={(health?.failure_rate ?? 0) > 5} />
          <Metric label="Temps traitement" value={health?.processing_time_avg ? `${health.processing_time_avg} ms` : '—'} />
          <Metric label="Ledger drift"   value={health?.ledger_drift ? formatCurrency(health.ledger_drift) : '✓ 0'}
            highlight={(health?.ledger_drift ?? 0) > 0} />
          <div className="mt-3 pt-2 border-t border-slate-50 grid grid-cols-2 gap-2">
            {[
              { label: 'Attente', count: jobStats.pending,    color: 'text-amber-600 bg-amber-50' },
              { label: 'Échec',   count: jobStats.failed,     color: 'text-red-600 bg-red-50' },
            ].map(({ label, count, color }) => (
              <div key={label} className={`rounded-lg p-2 text-center ${color}`}>
                <p className="text-lg font-bold">{count}</p>
                <p className="text-xs font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* BLOC 2 — FINANCE */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <BlockTitle icon={Database} label="Finance" accent="border-orange-100 text-orange-500" />
          {finance ? (
            <>
              <Metric label="MRR"             value={formatCurrency(finance.mrr)} />
              <Metric label="Cash collecté"   value={formatCurrency(finance.cash_collected)}
                sub="paiements ce mois" />
              <Metric label="Solde ledger"    value={formatCurrency(finance.ledger_balance)} />
              <Metric label="Drift check"
                value={finance.drift_count === 0 ? '✓ Équilibré' : `${finance.drift_count} écart${finance.drift_count > 1 ? 's' : ''}`}
                highlight={finance.drift_count > 0} />
            </>
          ) : (
            <p className="text-sm text-slate-400 text-center py-6">{loading ? 'Chargement…' : '—'}</p>
          )}
        </div>

        {/* BLOC 3 — GROWTH */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <BlockTitle icon={TrendingUp} label="Growth" accent="border-blue-100 text-blue-500" />
          {growth ? (
            <>
              <Metric label="ARR"             value={formatCurrency(growth.arr)} sub="MRR × 12" />
              <Metric label="Croissance MRR"
                value={growth.mrr_growth >= 0 ? `+${growth.mrr_growth.toFixed(1)}%` : `${growth.mrr_growth.toFixed(1)}%`}
                highlight={growth.mrr_growth < 0} />
              {profile?.role === 'super_admin' && (
                <Metric label="Agences actives" value={growth.agencies_active} />
              )}
              <Metric label="Contrats actifs" value={growth.contrats_actifs} />
              <Metric label="Churn rate"
                value={`${growth.churn_rate.toFixed(1)}%`}
                highlight={growth.churn_rate > 5} />
              <Metric label="Taux impayés"
                value={`${growth.impayes_rate.toFixed(1)}%`}
                highlight={growth.impayes_rate > 10} />
            </>
          ) : (
            <p className="text-sm text-slate-400 text-center py-6">{loading ? 'Chargement…' : '—'}</p>
          )}
        </div>
      </div>

      {/* ── Pipeline — Event Outbox + Job Queue ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Event Outbox */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-orange-500" />
              Event Outbox
              {isLive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            </h3>
            <span className="text-xs text-slate-400">{outboxEvents.length} récents</span>
          </div>
          <div className="divide-y divide-slate-50 max-h-60 overflow-y-auto">
            {outboxEvents.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">
                {loading ? 'Chargement…' : 'Aucun événement récent'}
              </p>
            ) : outboxEvents.map(ev => (
              <div key={ev.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{ev.event_type}</p>
                  <p className="text-xs text-slate-400">
                    {ev.entity_type ?? '—'} · {new Date(ev.created_at).toLocaleTimeString('fr-FR')}
                    {ev.trace_id && (
                      <span className="ml-2 font-mono text-slate-300">{ev.trace_id.slice(0, 8)}</span>
                    )}
                  </p>
                </div>
                <Badge status={ev.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Job Queue */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
              <Cpu className="w-4 h-4 text-blue-500" />
              Job Queue
              {isLive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            </h3>
            <span className="text-xs text-slate-400">Temps réel</span>
          </div>
          <div className="p-4 space-y-3">
            {[
              { label: 'En attente',  count: jobStats.pending,    icon: Clock,        color: 'text-amber-600',   bar: 'bg-amber-400' },
              { label: 'En cours',   count: jobStats.processing,  icon: RefreshCw,    color: 'text-blue-600',    bar: 'bg-blue-400' },
              { label: 'Terminés',   count: jobStats.done,        icon: CheckCircle2, color: 'text-emerald-600', bar: 'bg-emerald-400' },
              { label: 'En échec',   count: jobStats.failed,      icon: XCircle,      color: 'text-red-600',     bar: 'bg-red-400' },
            ].map(({ label, count, icon: Icon, color, bar }) => {
              const total = jobStats.pending + jobStats.processing + jobStats.done + jobStats.failed || 1;
              return (
                <div key={label} className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                  <div className="flex-1">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className={`text-xs font-bold ${color}`}>{count}</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${bar} rounded-full transition-all duration-300`}
                        style={{ width: `${(count / total) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-slate-50 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-300" />
              <span className="text-xs text-slate-400">Workers : finance · analytics · notification</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
