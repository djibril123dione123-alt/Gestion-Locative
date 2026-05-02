import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Cpu, Database,
  RefreshCw, TrendingUp, XCircle, BarChart3, ShieldCheck,
  Radio, Users, Layers,
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

interface FinanceBlock {
  ledger_balance: number;
  revenue_month: number;
  drift_count: number;
}

interface GrowthBlock {
  mrr: number;
  arr: number;
  agencies_active: number;
  contrats_actifs: number;
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

function SectionTitle({ icon: Icon, label, color = 'text-slate-700' }: {
  icon: React.ElementType; label: string; color?: string;
}) {
  return (
    <h2 className={`text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${color}`}>
      <Icon className="w-4 h-4" />
      {label}
    </h2>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-red-600' : 'text-slate-900'}`}>{value}</span>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function AuditDashboard() {
  const { profile } = useAuth();
  const { success, error: showError, toasts, removeToast } = useToast();

  const [outboxEvents, setOutboxEvents] = useState<OutboxEvent[]>([]);
  const [jobStats, setJobStats]         = useState<JobStats>({ pending: 0, processing: 0, done: 0, failed: 0 });
  const [finance, setFinance]           = useState<FinanceBlock | null>(null);
  const [growth, setGrowth]             = useState<GrowthBlock | null>(null);
  const [loading, setLoading]           = useState(true);
  const [runningWorker, setRunningWorker] = useState<'finance' | 'analytics' | null>(null);
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
        { data: ledger },
        { data: drifts },
        { data: kpi },
        { data: agencies },
      ] = await Promise.all([
        supabase
          .from('event_outbox')
          .select('id,event_type,entity_type,status,source,trace_id,created_at')
          .order('created_at', { ascending: false })
          .limit(40),

        supabase.from('job_queue').select('status'),

        // Ledger balance : somme des crédits de paiement
        supabase
          .from('ledger_entries')
          .select('amount,type')
          .eq('type', 'credit'),

        // Drifts financiers
        supabase
          .from('financial_snapshots')
          .select('id')
          .eq('status', 'drift'),

        // KPI mensuel agence courante
        profile?.agency_id ? supabase
          .from('kpi_monthly')
          .select('mrr,arr,contrats_actifs,impayes_rate,paiements_total')
          .eq('agency_id', profile.agency_id)
          .eq('period', period)
          .maybeSingle() : { data: null },

        // Nombre d'agences actives (super_admin seulement)
        profile?.role === 'super_admin' ? supabase
          .from('agencies')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active') : { data: null, count: 0 },
      ]);

      // Outbox
      setOutboxEvents(outbox ?? []);

      // Jobs
      const stats: JobStats = { pending: 0, processing: 0, done: 0, failed: 0 };
      (jobs ?? []).forEach((j: { status: string }) => {
        if (j.status in stats) (stats as Record<string, number>)[j.status]++;
      });
      setJobStats(stats);

      // Finance block
      const ledgerTotal = (ledger ?? []).reduce((sum: number, e: { amount: number }) => sum + (e.amount ?? 0), 0);
      const revenueMonth = kpi?.paiements_total ?? 0;
      setFinance({
        ledger_balance: ledgerTotal,
        revenue_month:  revenueMonth,
        drift_count:    (drifts ?? []).length,
      });

      // Growth block
      setGrowth({
        mrr:             kpi?.mrr ?? 0,
        arr:             kpi?.arr ?? 0,
        agencies_active: (agencies as unknown as { count: number } | null)?.count ?? 0,
        contrats_actifs: kpi?.contrats_actifs ?? 0,
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

  // ── Realtime — uniquement event_outbox + job_queue ───────────────────────

  useEffect(() => {
    if (!isAdmin) return;

    const ch = supabase
      .channel('v3-audit-live')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_outbox' },
        (payload) => {
          setOutboxEvents(prev => [payload.new as OutboxEvent, ...prev.slice(0, 39)]);
        }
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
      .subscribe(status => setIsLive(status === 'SUBSCRIBED'));

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); setIsLive(false); };
  }, [isAdmin]);

  // ── Worker triggers ──────────────────────────────────────────────────────

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

  const failureRate = jobStats.done + jobStats.failed > 0
    ? Math.round((jobStats.failed / (jobStats.done + jobStats.failed)) * 100)
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
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
          <p className="text-xs text-slate-400 mt-0.5">
            Synchro : {lastRefresh.toLocaleTimeString('fr-FR')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => runWorker('finance')} disabled={runningWorker !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 transition">
            {runningWorker === 'finance'
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Database className="w-4 h-4" />}
            Finance
          </button>
          <button onClick={() => runWorker('analytics')} disabled={runningWorker !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition">
            {runningWorker === 'analytics'
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <BarChart3 className="w-4 h-4" />}
            Analytics
          </button>
          <button onClick={loadData} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Alertes rapides ── */}
      {(jobStats.failed > 0 || (finance?.drift_count ?? 0) > 0) && (
        <div className="flex flex-wrap gap-3">
          {jobStats.failed > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-red-700">
                {jobStats.failed} job{jobStats.failed > 1 ? 's' : ''} en échec
              </span>
            </div>
          )}
          {(finance?.drift_count ?? 0) > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-amber-700">
                {finance!.drift_count} écart{finance!.drift_count > 1 ? 's' : ''} comptable{finance!.drift_count > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── 3 Blocs principaux ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* BLOC 1 — SYSTEM HEALTH */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <SectionTitle icon={Cpu} label="System Health" color="text-slate-600" />
          <div>
            <StatRow
              label="Queue size"
              value={jobStats.pending}
              highlight={jobStats.pending > 50}
            />
            <StatRow
              label="En cours"
              value={jobStats.processing}
            />
            <StatRow
              label="Terminés"
              value={jobStats.done}
            />
            <StatRow
              label="En échec"
              value={jobStats.failed}
              highlight={jobStats.failed > 0}
            />
            <StatRow
              label="Failure rate"
              value={`${failureRate}%`}
              highlight={failureRate > 5}
            />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Outbox en attente</span>
              <span className="text-xs font-semibold text-slate-700">
                {outboxEvents.filter(e => e.status === 'pending').length}
              </span>
            </div>
          </div>
        </div>

        {/* BLOC 2 — FINANCE */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <SectionTitle icon={Database} label="Finance" color="text-orange-600" />
          {finance ? (
            <div>
              <StatRow
                label="Solde ledger"
                value={formatCurrency(finance.ledger_balance)}
              />
              <StatRow
                label="Revenus du mois"
                value={formatCurrency(finance.revenue_month)}
              />
              <StatRow
                label="Écarts comptables"
                value={finance.drift_count === 0 ? '✓ Aucun' : `${finance.drift_count} drift${finance.drift_count > 1 ? 's' : ''}`}
                highlight={finance.drift_count > 0}
              />
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-slate-400">
              {loading ? 'Chargement…' : 'Aucune donnée'}
            </div>
          )}
        </div>

        {/* BLOC 3 — GROWTH */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <SectionTitle icon={TrendingUp} label="Growth" color="text-blue-600" />
          {growth ? (
            <div>
              <StatRow label="MRR"     value={formatCurrency(growth.mrr)} />
              <StatRow label="ARR"     value={formatCurrency(growth.arr)} />
              {profile?.role === 'super_admin' && (
                <StatRow label="Agences actives" value={growth.agencies_active} />
              )}
              <StatRow label="Contrats actifs" value={growth.contrats_actifs} />
              <StatRow
                label="Taux impayés"
                value={`${growth.impayes_rate.toFixed(1)}%`}
                highlight={growth.impayes_rate > 10}
              />
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-slate-400">
              {loading ? 'Chargement…' : 'Aucune donnée'}
            </div>
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
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {outboxEvents.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                {loading ? 'Chargement…' : 'Aucun événement récent'}
              </div>
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
          <div className="p-4 space-y-2">
            {[
              { label: 'En attente',  count: jobStats.pending,    icon: Clock,         color: 'text-amber-600',   bar: 'bg-amber-400' },
              { label: 'En cours',   count: jobStats.processing,  icon: RefreshCw,     color: 'text-blue-600',    bar: 'bg-blue-400' },
              { label: 'Terminés',   count: jobStats.done,        icon: CheckCircle2,  color: 'text-emerald-600', bar: 'bg-emerald-400' },
              { label: 'En échec',   count: jobStats.failed,      icon: XCircle,       color: 'text-red-600',     bar: 'bg-red-400' },
            ].map(({ label, count, icon: Icon, color, bar }) => {
              const total = jobStats.pending + jobStats.processing + jobStats.done + jobStats.failed || 1;
              return (
                <div key={label} className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className={`text-xs font-bold ${color}`}>{count}</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${(count / total) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pt-2 mt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-400">
                  Workers actifs : finance · analytics
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
