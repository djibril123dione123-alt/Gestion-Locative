import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  ShieldCheck,
  LogOut,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  MoreVertical,
  ChevronDown,
  Play,
  Pause,
  Edit3,
  Eye,
  Calendar,
  Activity,
  Globe,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate } from '../lib/formatters';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgencyStat {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  plan: 'basic' | 'pro' | 'enterprise';
  trial_ends_at: string | null;
  created_at: string;
  nb_users: number;
  nb_bailleurs: number;
  nb_immeubles: number;
  nb_unites: number;
  nb_contrats: number;
  nb_paiements: number;
  volume_paiements: number;
  derniere_activite: string | null;
}

interface GlobalUser {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  actif: boolean;
  agency_id: string | null;
  agency_name?: string;
  created_at: string;
  updated_at: string;
}

interface Subscription {
  id: string;
  agency_id: string;
  agency_name: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'past_due';
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}

interface OwnerLog {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_label: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

type Tab = 'dashboard' | 'agences' | 'utilisateurs' | 'abonnements' | 'logs' | 'configuration' | 'support';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active:    { label: 'Active',    color: 'text-emerald-400 bg-emerald-400/10 ring-1 ring-emerald-400/30', icon: CheckCircle },
  trial:     { label: 'Essai',     color: 'text-blue-400 bg-blue-400/10 ring-1 ring-blue-400/30',         icon: Clock },
  suspended: { label: 'Suspendue', color: 'text-red-400 bg-red-400/10 ring-1 ring-red-400/30',             icon: XCircle },
  cancelled: { label: 'Annulée',   color: 'text-slate-400 bg-slate-400/10 ring-1 ring-slate-400/30',      icon: XCircle },
  past_due:  { label: 'En retard', color: 'text-amber-400 bg-amber-400/10 ring-1 ring-amber-400/30',       icon: AlertTriangle },
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  basic:      { label: 'Basic',      color: 'text-slate-300 bg-slate-700' },
  pro:        { label: 'Pro',        color: 'text-orange-300 bg-orange-900/40' },
  enterprise: { label: 'Enterprise', color: 'text-purple-300 bg-purple-900/40' },
};

interface SaasConfigRow { key: string; value: unknown; description: string | null; updated_at: string }

function ConfigurationPanel() {
  const [rows, setRows] = useState<SaasConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('saas_config').select('*').order('key');
    if (data) {
      setRows(data as SaasConfigRow[]);
      const initial: Record<string, string> = {};
      (data as SaasConfigRow[]).forEach((r) => {
        initial[r.key] = JSON.stringify(r.value, null, 2);
      });
      setEdits(initial);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (key: string) => {
    setSaving(key);
    try {
      const parsed = JSON.parse(edits[key]);
      const { error } = await supabase.from('saas_config').update({ value: parsed, updated_at: new Date().toISOString() }).eq('key', key);
      if (error) throw error;
      await load();
    } catch {
      // noop, keep value invalid
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Configuration globale</h2>
        <p className="text-gray-500 text-sm">Paramètres SaaS partagés (JSON)</p>
      </div>
      {loading ? (
        <div className="text-gray-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-gray-500 text-sm">
          Aucune configuration. Appliquez la migration <code className="text-orange-300">20260425000002_add_console_owner_features.sql</code>.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.key} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-mono text-orange-300 text-sm">{r.key}</p>
                  {r.description && <p className="text-xs text-gray-500 mt-1">{r.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => save(r.key)}
                  disabled={saving === r.key}
                  data-testid={`button-save-config-${r.key}`}
                  className="px-3 py-1.5 text-xs rounded bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50"
                >
                  {saving === r.key ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
              <textarea
                value={edits[r.key] ?? ''}
                onChange={(e) => setEdits({ ...edits, [r.key]: e.target.value })}
                rows={4}
                data-testid={`textarea-config-${r.key}`}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded text-sm font-mono text-gray-200"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SupportPanel({ agencies, actorId }: { agencies: AgencyStat[]; actorId: string | undefined }) {
  const [agencyId, setAgencyId] = useState('all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      let userQuery = supabase.from('user_profiles').select('id, agency_id').eq('actif', true);
      if (agencyId !== 'all') userQuery = userQuery.eq('agency_id', agencyId);
      const { data: users, error: usersErr } = await userQuery;
      if (usersErr) throw usersErr;
      if (!users || users.length === 0) {
        setFeedback('Aucun destinataire trouvé.');
        setSending(false);
        return;
      }
      const rows = users
        .filter((u) => u.agency_id)
        .map((u) => ({
          user_id: u.id,
          agency_id: u.agency_id,
          type: 'support',
          title: title.trim(),
          message: message.trim() || null,
          read: false,
        }));
      const { error } = await supabase.from('notifications').insert(rows);
      if (error) throw error;
      if (actorId) {
        await supabase.from('owner_actions_log').insert({
          actor_id: actorId,
          action: 'support_broadcast',
          target_type: 'agency',
          target_label: agencyId === 'all' ? 'Toutes les agences' : agencies.find((a) => a.id === agencyId)?.name ?? agencyId,
          details: { recipients: rows.length, title: title.trim() },
        });
      }
      setFeedback(`Message envoyé à ${rows.length} utilisateur${rows.length > 1 ? 's' : ''}.`);
      setTitle('');
      setMessage('');
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Support et communication</h2>
        <p className="text-gray-500 text-sm">Diffusez une notification à toutes les agences ou à une agence ciblée</p>
      </div>
      <form onSubmit={send} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Cible</label>
          <select
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
            data-testid="select-support-agency"
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded text-gray-200"
          >
            <option value="all">Toutes les agences</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Titre</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="input-support-title"
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded text-gray-200"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            data-testid="textarea-support-message"
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded text-gray-200"
          />
        </div>
        {feedback && <p className="text-sm text-orange-300">{feedback}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending}
            data-testid="button-send-support"
            className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white font-semibold disabled:opacity-50"
          >
            {sending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </form>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: 'text-slate-400 bg-slate-700', icon: Activity };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const p = PLAN_LABELS[plan] ?? { label: plan, color: 'text-slate-400 bg-slate-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${p.color}`}>
      {p.label}
    </span>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-400 font-medium">{label}</p>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ─── Console principale ───────────────────────────────────────────────────────

export function Console() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');

  // ── États données ──
  const [agencies, setAgencies] = useState<AgencyStat[]>([]);
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [logs, setLogs] = useState<OwnerLog[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Recherche / filtres ──
  const [searchAgency, setSearchAgency] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [agRes, userRes, subRes, logRes] = await Promise.all([
        supabase.from('vw_owner_agency_stats').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles')
          .select('*, agencies!left(name)')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('subscriptions')
          .select('*, agencies!inner(name)')
          .order('created_at', { ascending: false }),
        supabase.from('owner_actions_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (agRes.data) setAgencies(agRes.data as AgencyStat[]);
      if (userRes.data) {
        setUsers(userRes.data.map((u: Record<string, unknown>) => ({
          ...u,
          agency_name: (u.agencies as { name?: string } | null)?.name ?? '—',
        })) as GlobalUser[]);
      }
      if (subRes.data) {
        setSubscriptions(subRes.data.map((s: Record<string, unknown>) => ({
          ...s,
          agency_name: (s.agencies as { name?: string } | null)?.name ?? '—',
        })) as Subscription[]);
      }
      if (logRes.data) setLogs(logRes.data as OwnerLog[]);
    } catch (err) {
      console.error('Console: erreur chargement', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Actions agence ────────────────────────────────────────────────────────

  const logOwnerAction = async (
    action: string,
    targetType: string,
    targetId: string,
    targetLabel: string,
    details: Record<string, unknown> = {}
  ) => {
    await supabase.from('owner_actions_log').insert({
      actor_id: profile?.id,
      actor_email: profile?.email,
      action,
      target_type: targetType,
      target_id: targetId,
      target_label: targetLabel,
      details,
    });
  };

  const updateAgencyStatus = async (
    agencyId: string,
    agencyName: string,
    newStatus: 'active' | 'suspended'
  ) => {
    const { error } = await supabase
      .from('agencies')
      .update({ status: newStatus })
      .eq('id', agencyId);

    if (!error) {
      await logOwnerAction(
        newStatus === 'active' ? 'agency_reactivated' : 'agency_suspended',
        'agency', agencyId, agencyName, { new_status: newStatus }
      );
      setAgencies(prev =>
        prev.map(a => a.id === agencyId ? { ...a, status: newStatus } : a)
      );
    }
    setActionMenuId(null);
  };

  const updateAgencyPlan = async (agencyId: string, agencyName: string, newPlan: string) => {
    const { error } = await supabase
      .from('agencies')
      .update({ plan: newPlan })
      .eq('id', agencyId);

    if (!error) {
      await logOwnerAction('agency_plan_changed', 'agency', agencyId, agencyName, { new_plan: newPlan });
      setAgencies(prev =>
        prev.map(a => a.id === agencyId ? { ...a, plan: newPlan as AgencyStat['plan'] } : a)
      );
    }
    setActionMenuId(null);
  };

  const extendTrial = async (agencyId: string, agencyName: string, days: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    const { error } = await supabase
      .from('agencies')
      .update({ trial_ends_at: newDate.toISOString(), status: 'trial' })
      .eq('id', agencyId);

    if (!error) {
      await logOwnerAction('trial_extended', 'agency', agencyId, agencyName, { days, new_end: newDate.toISOString() });
      setAgencies(prev =>
        prev.map(a => a.id === agencyId ? { ...a, status: 'trial', trial_ends_at: newDate.toISOString() } : a)
      );
    }
    setActionMenuId(null);
  };

  // ─── Calculs KPIs ──────────────────────────────────────────────────────────

  const kpis = {
    totalAgencies: agencies.length,
    activeAgencies: agencies.filter(a => a.status === 'active').length,
    trialAgencies: agencies.filter(a => a.status === 'trial').length,
    suspendedAgencies: agencies.filter(a => a.status === 'suspended').length,
    totalUsers: users.filter(u => u.role !== 'super_admin').length,
    activeUsers: users.filter(u => u.actif && u.role !== 'super_admin').length,
    totalVolume: agencies.reduce((s, a) => s + (a.volume_paiements ?? 0), 0),
    totalContrats: agencies.reduce((s, a) => s + (a.nb_contrats ?? 0), 0),
    totalUnites: agencies.reduce((s, a) => s + (a.nb_unites ?? 0), 0),
    newThisMonth: agencies.filter(a => {
      const d = new Date(a.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
  };

  // ─── Filtres ────────────────────────────────────────────────────────────────

  const filteredAgencies = agencies.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(searchAgency.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const filteredUsers = users.filter(u =>
    `${u.nom} ${u.prenom} ${u.email} ${u.agency_name ?? ''}`
      .toLowerCase()
      .includes(searchUser.toLowerCase())
  );

  // ─── UI ─────────────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard',     label: 'Vue globale',   icon: LayoutDashboard },
    { id: 'agences',       label: 'Agences',        icon: Building2 },
    { id: 'utilisateurs',  label: 'Utilisateurs',   icon: Users },
    { id: 'abonnements',   label: 'Abonnements',    icon: CreditCard },
    { id: 'logs',          label: 'Audit',          icon: ShieldCheck },
    { id: 'configuration', label: 'Configuration',  icon: Activity },
    { id: 'support',       label: 'Support',        icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* ── Header ── */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Console Propriétaire</h1>
            <p className="text-xs text-gray-500">Samay Këur — Administration SaaS</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white">{profile?.prenom} {profile?.nom}</p>
            <p className="text-xs text-orange-400 font-semibold uppercase tracking-wide">Super Admin</p>
          </div>
          <button
            onClick={signOut}
            className="p-2 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors"
            title="Déconnexion"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="bg-gray-900 border-b border-gray-800 px-6">
        <div className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto p-6">
        {loading && tab === 'dashboard' ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600" />
          </div>
        ) : (
          <>
            {/* ── Tab: Dashboard ── */}
            {tab === 'dashboard' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Vue globale</h2>
                  <p className="text-gray-500 text-sm">Indicateurs de santé et de croissance du SaaS</p>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                  <KpiCard label="Agences totales"    value={kpis.totalAgencies}    icon={Building2}    color="bg-orange-500/10 text-orange-400" />
                  <KpiCard label="Agences actives"    value={kpis.activeAgencies}   icon={CheckCircle}  color="bg-emerald-500/10 text-emerald-400" sub={`${kpis.trialAgencies} en essai`} />
                  <KpiCard label="Utilisateurs"       value={kpis.totalUsers}       icon={Users}        color="bg-blue-500/10 text-blue-400" sub={`${kpis.activeUsers} actifs`} />
                  <KpiCard label="Unités gérées"      value={kpis.totalUnites}      icon={Building2}    color="bg-purple-500/10 text-purple-400" />
                  <KpiCard label="Nouveaux ce mois"   value={kpis.newThisMonth}     icon={TrendingUp}   color="bg-amber-500/10 text-amber-400" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <KpiCard label="Volume total paiements" value={formatCurrency(kpis.totalVolume)} icon={CreditCard} color="bg-emerald-500/10 text-emerald-400" />
                  <KpiCard label="Contrats actifs"        value={kpis.totalContrats}               icon={Activity}   color="bg-blue-500/10 text-blue-400" />
                  <KpiCard label="Agences suspendues"     value={kpis.suspendedAgencies}           icon={Pause}      color="bg-red-500/10 text-red-400" />
                </div>

                {/* Top agences */}
                <div>
                  <h3 className="text-base font-semibold text-gray-300 mb-4">Top agences par volume</h3>
                  <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="text-left px-4 py-3 text-gray-500 font-medium">Agence</th>
                          <th className="text-center px-4 py-3 text-gray-500 font-medium">Statut</th>
                          <th className="text-center px-4 py-3 text-gray-500 font-medium">Plan</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-medium">Unités</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-medium">Contrats</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-medium">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...agencies]
                          .sort((a, b) => b.volume_paiements - a.volume_paiements)
                          .slice(0, 8)
                          .map(a => (
                            <tr key={a.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-white">{a.name}</p>
                                <p className="text-xs text-gray-500">{formatDate(a.created_at)}</p>
                              </td>
                              <td className="px-4 py-3 text-center"><StatusBadge status={a.status} /></td>
                              <td className="px-4 py-3 text-center"><PlanBadge plan={a.plan} /></td>
                              <td className="px-4 py-3 text-right text-gray-300">{a.nb_unites}</td>
                              <td className="px-4 py-3 text-right text-gray-300">{a.nb_contrats}</td>
                              <td className="px-4 py-3 text-right text-white font-medium">{formatCurrency(a.volume_paiements)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Agences ── */}
            {tab === 'agences' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Gestion des agences</h2>
                    <p className="text-gray-500 text-sm">{filteredAgencies.length} agence{filteredAgencies.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="sm:ml-auto flex items-center gap-3">
                    {/* Filtre statut */}
                    <div className="relative">
                      <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="appearance-none bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="all">Tous les statuts</option>
                        <option value="active">Active</option>
                        <option value="trial">Essai</option>
                        <option value="suspended">Suspendue</option>
                        <option value="cancelled">Annulée</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                    {/* Recherche */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        value={searchAgency}
                        onChange={e => setSearchAgency(e.target.value)}
                        placeholder="Rechercher…"
                        className="pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-48"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="text-left px-4 py-3 text-gray-500 font-medium">Agence</th>
                          <th className="text-center px-4 py-3 text-gray-500 font-medium">Statut</th>
                          <th className="text-center px-4 py-3 text-gray-500 font-medium">Plan</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-medium">Utilisateurs</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-medium">Unités</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-medium">Volume</th>
                          <th className="text-center px-4 py-3 text-gray-500 font-medium">Activité</th>
                          <th className="text-center px-4 py-3 text-gray-500 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAgencies.map(a => (
                          <tr key={a.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-white">{a.name}</p>
                              <p className="text-xs text-gray-500">Créée {formatDate(a.created_at)}</p>
                              {a.status === 'trial' && a.trial_ends_at && (
                                <p className="text-xs text-blue-400 mt-0.5">
                                  Essai jusqu'au {formatDate(a.trial_ends_at)}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center"><StatusBadge status={a.status} /></td>
                            <td className="px-4 py-3 text-center"><PlanBadge plan={a.plan} /></td>
                            <td className="px-4 py-3 text-right text-gray-300">{a.nb_users}</td>
                            <td className="px-4 py-3 text-right text-gray-300">{a.nb_unites}</td>
                            <td className="px-4 py-3 text-right text-white font-medium">{formatCurrency(a.volume_paiements)}</td>
                            <td className="px-4 py-3 text-center text-xs text-gray-500">
                              {a.derniere_activite ? formatDate(a.derniere_activite) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center relative">
                              <button
                                onClick={() => setActionMenuId(actionMenuId === a.id ? null : a.id)}
                                className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {actionMenuId === a.id && (
                                <div className="absolute right-4 top-10 z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-52 py-2">
                                  <p className="px-3 py-1 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                                    {a.name}
                                  </p>
                                  <div className="h-px bg-gray-700 my-1" />

                                  {a.status !== 'active' && (
                                    <button
                                      onClick={() => updateAgencyStatus(a.id, a.name, 'active')}
                                      className="w-full text-left px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-400/10 flex items-center gap-2"
                                    >
                                      <Play className="w-4 h-4" />
                                      Réactiver
                                    </button>
                                  )}
                                  {a.status !== 'suspended' && (
                                    <button
                                      onClick={() => updateAgencyStatus(a.id, a.name, 'suspended')}
                                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 flex items-center gap-2"
                                    >
                                      <Pause className="w-4 h-4" />
                                      Suspendre
                                    </button>
                                  )}
                                  <button
                                    onClick={() => extendTrial(a.id, a.name, 14)}
                                    className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-blue-400/10 flex items-center gap-2"
                                  >
                                    <Calendar className="w-4 h-4" />
                                    +14 jours d'essai
                                  </button>

                                  <div className="h-px bg-gray-700 my-1" />
                                  <p className="px-3 py-1 text-xs text-gray-500 font-semibold uppercase tracking-wide">Changer plan</p>
                                  {(['basic', 'pro', 'enterprise'] as const).map(plan => (
                                    plan !== a.plan && (
                                      <button
                                        key={plan}
                                        onClick={() => updateAgencyPlan(a.id, a.name, plan)}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                        Passer en {PLAN_LABELS[plan].label}
                                      </button>
                                    )
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                        {filteredAgencies.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                              Aucune agence trouvée
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Utilisateurs ── */}
            {tab === 'utilisateurs' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Utilisateurs globaux</h2>
                    <p className="text-gray-500 text-sm">{filteredUsers.filter(u => u.role !== 'super_admin').length} utilisateurs métier</p>
                  </div>
                  <div className="sm:ml-auto">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        value={searchUser}
                        onChange={e => setSearchUser(e.target.value)}
                        placeholder="Rechercher un utilisateur…"
                        className="pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-56"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[700px]">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="text-left px-4 py-3 text-gray-500 font-medium">Utilisateur</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-medium">Agence</th>
                          <th className="text-center px-4 py-3 text-gray-500 font-medium">Rôle</th>
                          <th className="text-center px-4 py-3 text-gray-500 font-medium">Statut</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-medium">Créé</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers
                          .filter(u => u.role !== 'super_admin')
                          .map(u => (
                            <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                              <td className="px-4 py-3">
                                <p className="font-medium text-white">{u.prenom} {u.nom}</p>
                                <p className="text-xs text-gray-500">{u.email}</p>
                              </td>
                              <td className="px-4 py-3 text-gray-300">{u.agency_name}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  u.role === 'admin'     ? 'bg-orange-900/50 text-orange-300' :
                                  u.role === 'agent'     ? 'bg-blue-900/50 text-blue-300' :
                                  u.role === 'comptable' ? 'bg-purple-900/50 text-purple-300' :
                                  u.role === 'bailleur'  ? 'bg-green-900/50 text-green-300' :
                                                           'bg-gray-700 text-gray-300'
                                }`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {u.actif
                                  ? <span className="text-emerald-400 text-xs">● Actif</span>
                                  : <span className="text-red-400 text-xs">● Inactif</span>
                                }
                              </td>
                              <td className="px-4 py-3 text-right text-xs text-gray-500">{formatDate(u.created_at)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Abonnements ── */}
            {tab === 'abonnements' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Abonnements</h2>
                  <p className="text-gray-500 text-sm">{subscriptions.length} abonnement{subscriptions.length !== 1 ? 's' : ''}</p>
                </div>

                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[700px]">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="text-left px-4 py-3 text-gray-500 font-medium">Agence</th>
                          <th className="text-center px-4 py-3 text-gray-500 font-medium">Plan</th>
                          <th className="text-center px-4 py-3 text-gray-500 font-medium">Statut</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-medium">Début</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-medium">Fin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.map(s => (
                          <tr key={s.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                            <td className="px-4 py-3 font-medium text-white">{s.agency_name}</td>
                            <td className="px-4 py-3 text-center"><PlanBadge plan={s.plan_id} /></td>
                            <td className="px-4 py-3 text-center"><StatusBadge status={s.status} /></td>
                            <td className="px-4 py-3 text-right text-gray-400 text-xs">
                              {s.current_period_start ? formatDate(s.current_period_start) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-400 text-xs">
                              {s.current_period_end ? formatDate(s.current_period_end) : '—'}
                            </td>
                          </tr>
                        ))}
                        {subscriptions.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                              Aucun abonnement
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Logs ── */}
            {tab === 'logs' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Journal des actions propriétaire</h2>
                  <p className="text-gray-500 text-sm">Toutes les actions effectuées depuis cette console</p>
                </div>

                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-medium">Action</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-medium">Cible</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-medium">Détails</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map(l => (
                          <tr key={l.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(l.created_at)}</td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs bg-gray-800 px-2 py-1 rounded text-orange-300">{l.action}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-300">{l.target_label ?? '—'}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                              {Object.keys(l.details).length > 0 ? JSON.stringify(l.details) : '—'}
                            </td>
                          </tr>
                        ))}
                        {logs.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                              Aucune action enregistrée
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Configuration ── */}
            {tab === 'configuration' && <ConfigurationPanel />}

            {/* ── Tab: Support ── */}
            {tab === 'support' && <SupportPanel agencies={agencies} actorId={profile?.id} />}
          </>
        )}
      </main>

      {/* Fermer les menus d'action au clic en dehors */}
      {actionMenuId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActionMenuId(null)}
        />
      )}
    </div>
  );
}
