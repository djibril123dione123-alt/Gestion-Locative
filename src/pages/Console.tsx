import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  Bell,
  Building2,
  CheckCircle,
  ChevronRight,
  ClipboardList,
  Command,
  CreditCard,
  Database,
  FileText,
  Flag,
  Gauge,
  HardDrive,
  KeyRound,
  LifeBuoy,
  Lock,
  LogOut,
  Mail,
  Pause,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { BrandMark } from '../components/brand/BrandLogo';
import { LoadingState } from '../components/ui/LoadingState';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate } from '../lib/formatters';
import { supabase } from '../lib/supabase';

type AdminTab =
  | 'overview'
  | 'organizations'
  | 'subscriptions'
  | 'users'
  | 'product'
  | 'documents'
  | 'support'
  | 'technical'
  | 'security'
  | 'configuration';

type HealthLevel = 'healthy' | 'watch' | 'risk' | 'critical';

interface AgencyStat {
  id: string;
  name: string;
  status: string | null;
  plan: string | null;
  organization_type?: string | null;
  is_bailleur_account?: boolean | null;
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
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}

interface OwnerLog {
  id: string;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  target_type?: string | null;
  target_label?: string | null;
  reason?: string | null;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface AdminIncident {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical' | 'blocking';
  status: string;
  message: string;
  organization_id?: string | null;
  occurrences?: number | null;
  last_seen_at?: string | null;
  created_at: string;
}

interface SupportTicket {
  id: string;
  organization_id?: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
}

interface AdminFeatureFlag {
  id: string;
  key?: string;
  flag_name?: string;
  name?: string;
  description?: string | null;
  status?: string;
  enabled?: boolean;
  owner?: string | null;
  expires_at?: string | null;
  created_at?: string;
}

interface AdminSnapshot {
  generated_at?: string;
  platform?: Record<string, number>;
  incidents?: AdminIncident[];
  tickets?: SupportTicket[];
  feature_flags?: AdminFeatureFlag[];
  audit_logs?: OwnerLog[];
}

const NAV_GROUPS: Array<{
  title: string;
  items: Array<{ id: AdminTab; label: string; icon: React.ElementType; description: string }>;
}> = [
  {
    title: 'Pilotage',
    items: [
      { id: 'overview', label: 'Vue d’ensemble', icon: Gauge, description: 'Santé SaaS, revenus, usage et risques' },
      { id: 'organizations', label: 'Organisations', icon: Building2, description: 'Agences, bailleurs, gestionnaires et groupes' },
      { id: 'subscriptions', label: 'Abonnements', icon: CreditCard, description: 'Plans, quotas, essais et MRR' },
    ],
  },
  {
    title: 'Opérations',
    items: [
      { id: 'users', label: 'Utilisateurs', icon: Users, description: 'Rôles, sessions et accès métier' },
      { id: 'product', label: 'Usage produit', icon: Activity, description: 'Adoption, modules et activité' },
      { id: 'documents', label: 'Documents', icon: FileText, description: 'Métadonnées, QR, erreurs PDF et stockage' },
      { id: 'support', label: 'Support', icon: LifeBuoy, description: 'Tickets, incidents clients et notes internes' },
    ],
  },
  {
    title: 'Contrôle',
    items: [
      { id: 'technical', label: 'Technique', icon: Database, description: 'Erreurs, jobs, backups et performance' },
      { id: 'security', label: 'Sécurité', icon: ShieldCheck, description: 'Audit global, impersonation, accès sensibles' },
      { id: 'configuration', label: 'Configuration', icon: Flag, description: 'Feature flags, modules, emails et annonces' },
    ],
  },
];

const PLAN_PRICES: Record<string, number> = {
  basic: 5000,
  starter: 5000,
  pro: 15000,
  business: 35000,
  enterprise: 0,
};

const ACCOUNT_LABELS: Record<string, string> = {
  agency: 'Agence',
  individual_landlord: 'Bailleur individuel',
  multi_property_landlord: 'Bailleur multi-biens',
  property_manager: 'Gestionnaire',
  group: 'Groupe',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  trial: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  suspended: 'border-red-400/30 bg-red-400/10 text-red-200',
  cancelled: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  past_due: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  new: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  in_progress: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  resolved: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  critical: 'border-red-400/40 bg-red-400/10 text-red-200',
  blocking: 'border-red-500/50 bg-red-500/15 text-red-100',
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function isSettled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getAccountType(agency: AgencyStat) {
  if (agency.is_bailleur_account) return 'individual_landlord';
  return agency.organization_type || 'agency';
}

function getHealthLevel(agency: AgencyStat): HealthLevel {
  const lastActivity = agency.derniere_activite ? new Date(agency.derniere_activite).getTime() : 0;
  const daysInactive = lastActivity ? (Date.now() - lastActivity) / 86_400_000 : 999;
  if (agency.status === 'suspended' || agency.status === 'cancelled') return 'critical';
  if (daysInactive > 30) return 'risk';
  if (daysInactive > 12 || agency.nb_users === 0) return 'watch';
  return 'healthy';
}

function healthCopy(level: HealthLevel) {
  if (level === 'healthy') return { label: 'Sain', className: 'text-emerald-200 bg-emerald-400/10 border-emerald-400/30' };
  if (level === 'watch') return { label: 'À suivre', className: 'text-amber-200 bg-amber-400/10 border-amber-400/30' };
  if (level === 'risk') return { label: 'Risque', className: 'text-orange-200 bg-orange-400/10 border-orange-400/30' };
  return { label: 'Critique', className: 'text-red-200 bg-red-400/10 border-red-400/30' };
}

function safeDate(value?: string | null) {
  return value ? formatDate(value) : '—';
}

function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: string }) {
  const toneClass = STATUS_STYLES[tone] ?? 'border-white/10 bg-white/8 text-slate-200';
  return (
    <span className={classNames('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold', toneClass)}>
      {children}
    </span>
  );
}

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'emerald',
  trend,
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon: React.ElementType;
  tone?: 'emerald' | 'gold' | 'blue' | 'red' | 'slate';
  trend?: string;
}) {
  const toneMap = {
    emerald: 'from-emerald-400/18 to-emerald-400/5 text-emerald-200 border-emerald-400/18',
    gold: 'from-amber-400/18 to-orange-400/5 text-amber-200 border-amber-400/18',
    blue: 'from-sky-400/18 to-cyan-400/5 text-sky-200 border-sky-400/18',
    red: 'from-red-400/18 to-orange-400/5 text-red-200 border-red-400/18',
    slate: 'from-white/10 to-white/5 text-slate-200 border-white/12',
  }[tone];

  return (
    <div className={classNames('rounded-2xl border bg-gradient-to-br p-5 shadow-[0_22px_80px_rgba(0,0,0,0.22)]', toneMap)}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-black tracking-tight text-white sm:text-3xl">{value}</p>
      {(helper || trend) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
          {trend && <span className="rounded-full bg-white/8 px-2 py-1 text-slate-200">{trend}</span>}
          {helper && <span>{helper}</span>}
        </div>
      )}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.045] shadow-[0_20px_80px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-2.5 text-emerald-100">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-sm font-medium text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-black/15 p-8 text-center">
      <p className="font-black text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}

export function Console() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [agencies, setAgencies] = useState<AgencyStat[]>([]);
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [logs, setLogs] = useState<OwnerLog[]>([]);
  const [featureFlags, setFeatureFlags] = useState<AdminFeatureFlag[]>([]);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const platformSnapshot = snapshot?.platform;

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [snapshotResult, agResult, userResult, subResult, logResult, flagResult] = await Promise.allSettled([
        supabase.rpc('admin_console_snapshot'),
        supabase.from('vw_owner_agency_stats').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('*, agencies!left(name)').order('created_at', { ascending: false }).limit(500),
        supabase.from('subscriptions').select('*, agencies!inner(name)').order('created_at', { ascending: false }).limit(300),
        supabase.from('owner_actions_log').select('*').order('created_at', { ascending: false }).limit(120),
        supabase.from('feature_flags').select('*').order('updated_at', { ascending: false }).limit(80),
      ]);

      if (isSettled(snapshotResult) && !snapshotResult.value.error && snapshotResult.value.data) {
        setSnapshot(snapshotResult.value.data as AdminSnapshot);
      }

      if (isSettled(agResult) && !agResult.value.error && agResult.value.data) {
        setAgencies((agResult.value.data as AgencyStat[]).map((agency) => ({
          ...agency,
          status: agency.status ?? 'active',
          plan: agency.plan ?? 'starter',
          volume_paiements: Number(agency.volume_paiements ?? 0),
        })));
      }

      if (isSettled(userResult) && !userResult.value.error && userResult.value.data) {
        setUsers(userResult.value.data.map((user: Record<string, unknown>) => ({
          ...(user as Omit<GlobalUser, 'agency_name'>),
          agency_name: (user.agencies as { name?: string } | null)?.name ?? '—',
        })) as GlobalUser[]);
      }

      if (isSettled(subResult) && !subResult.value.error && subResult.value.data) {
        setSubscriptions(subResult.value.data.map((subscription: Record<string, unknown>) => ({
          ...(subscription as Omit<Subscription, 'agency_name'>),
          agency_name: (subscription.agencies as { name?: string } | null)?.name ?? '—',
        })) as Subscription[]);
      }

      if (isSettled(logResult) && !logResult.value.error && logResult.value.data) {
        setLogs(logResult.value.data as OwnerLog[]);
      }

      if (isSettled(flagResult) && !flagResult.value.error && flagResult.value.data) {
        setFeatureFlags(flagResult.value.data as AdminFeatureFlag[]);
      } else if (snapshot?.feature_flags) {
        setFeatureFlags(snapshot.feature_flags);
      }

      setLastLoadedAt(new Date().toISOString());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [snapshot?.feature_flags]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const computed = useMemo(() => {
    const platform = platformSnapshot ?? {};
    const activeOrganizations = agencies.filter((agency) => (agency.status ?? 'active') === 'active').length;
    const trialOrganizations = agencies.filter((agency) => agency.status === 'trial').length;
    const suspendedOrganizations = agencies.filter((agency) => agency.status === 'suspended').length;
    const individualLandlords = agencies.filter((agency) => getAccountType(agency).includes('landlord')).length;
    const propertyManagers = agencies.filter((agency) => getAccountType(agency) === 'property_manager').length;
    const groups = agencies.filter((agency) => getAccountType(agency) === 'group').length;
    const totalUsers = users.filter((user) => user.role !== 'super_admin').length;
    const activeUsers = users.filter((user) => user.role !== 'super_admin' && user.actif).length;
    const paymentsVolume = agencies.reduce((sum, agency) => sum + Number(agency.volume_paiements ?? 0), 0);
    const estimatedMrr = agencies
      .filter((agency) => ['active', 'trial', null].includes(agency.status))
      .reduce((sum, agency) => sum + (PLAN_PRICES[agency.plan ?? 'starter'] ?? 0), 0);
    const contracts = agencies.reduce((sum, agency) => sum + Number(agency.nb_contrats ?? 0), 0);
    const units = agencies.reduce((sum, agency) => sum + Number(agency.nb_unites ?? 0), 0);
    const riskAccounts = agencies.filter((agency) => ['risk', 'critical'].includes(getHealthLevel(agency))).length;
    const payingOrganizations = agencies.filter((agency) => !['trial', 'cancelled', 'suspended'].includes(agency.status ?? '')).length;
    return {
      totalOrganizations: numberValue(platform.total_organizations) || agencies.length,
      activeOrganizations: numberValue(platform.active_organizations) || activeOrganizations,
      trialOrganizations: numberValue(platform.trial_organizations) || trialOrganizations,
      suspendedOrganizations,
      individualLandlords: numberValue(platform.individual_landlords) || individualLandlords,
      propertyManagers: numberValue(platform.property_managers) || propertyManagers,
      groups: numberValue(platform.groups) || groups,
      totalUsers: numberValue(platform.total_users) || totalUsers,
      activeUsers: numberValue(platform.active_users) || activeUsers,
      paymentsVolume,
      estimatedMrr: numberValue(platform.estimated_mrr) || estimatedMrr,
      totalDocuments: numberValue(platform.total_documents),
      documentsThisMonth: numberValue(platform.documents_this_month),
      contracts,
      units,
      riskAccounts,
      payingOrganizations,
      openIncidents: numberValue(platform.open_incidents) || (snapshot?.incidents ?? []).filter((incident) => !['resolved', 'ignored'].includes(incident.status)).length,
      openTickets: numberValue(platform.open_tickets) || (snapshot?.tickets ?? []).filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length,
    };
  }, [agencies, platformSnapshot, snapshot?.incidents, snapshot?.tickets, users]);

  const filteredAgencies = useMemo(() => {
    const search = query.trim().toLowerCase();
    return agencies.filter((agency) => {
      const type = getAccountType(agency);
      const matchesSearch = !search || `${agency.name} ${agency.plan} ${agency.status} ${type}`.toLowerCase().includes(search);
      const matchesStatus = statusFilter === 'all' || agency.status === statusFilter || getHealthLevel(agency) === statusFilter;
      const matchesType = typeFilter === 'all' || type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [agencies, query, statusFilter, typeFilter]);

  const filteredUsers = useMemo(() => {
    const search = query.trim().toLowerCase();
    return users
      .filter((user) => user.role !== 'super_admin')
      .filter((user) => !search || `${user.prenom} ${user.nom} ${user.email} ${user.role} ${user.agency_name}`.toLowerCase().includes(search));
  }, [query, users]);

  const topOrganizations = useMemo(
    () => [...agencies].sort((a, b) => Number(b.volume_paiements ?? 0) - Number(a.volume_paiements ?? 0)).slice(0, 8),
    [agencies]
  );

  const moduleUsage = useMemo(() => [
    { label: 'Encaissements', value: agencies.reduce((sum, agency) => sum + Number(agency.nb_paiements ?? 0), 0), tone: 'emerald' },
    { label: 'Contrats', value: computed.contracts, tone: 'blue' },
    { label: 'Documents', value: computed.totalDocuments, tone: 'gold' },
    { label: 'Portefeuille', value: computed.units, tone: 'slate' },
    { label: 'Support', value: computed.openTickets, tone: 'red' },
  ], [agencies, computed.contracts, computed.openTickets, computed.totalDocuments, computed.units]);

  const logAdminAction = async (payload: {
    action: string;
    reason: string;
    targetOrganizationId?: string;
    targetLabel?: string;
    metadata?: Record<string, unknown>;
  }) => {
    await supabase.rpc('admin_audit_action', {
      p_action: payload.action,
      p_reason: payload.reason,
      p_target_organization_id: payload.targetOrganizationId ?? null,
      p_target_user_id: null,
      p_metadata: payload.metadata ?? {},
    });
    await supabase.from('owner_actions_log').insert({
      actor_id: profile?.id,
      actor_email: profile?.email,
      action: payload.action,
      target_type: payload.targetOrganizationId ? 'agency' : 'platform',
      target_id: payload.targetOrganizationId ?? null,
      target_label: payload.targetLabel ?? null,
      details: { reason: payload.reason, ...(payload.metadata ?? {}) },
    });
  };

  const updateAgencyStatus = async (agency: AgencyStat, nextStatus: 'active' | 'suspended') => {
    const reason = window.prompt(`Raison obligatoire pour ${nextStatus === 'active' ? 'réactiver' : 'suspendre'} ${agency.name}`);
    if (!reason || reason.trim().length < 8) return;
    const { error } = await supabase.from('agencies').update({ status: nextStatus }).eq('id', agency.id);
    if (error) throw error;
    await logAdminAction({
      action: nextStatus === 'active' ? 'organization_reactivated' : 'organization_suspended',
      reason,
      targetOrganizationId: agency.id,
      targetLabel: agency.name,
      metadata: { previous_status: agency.status, next_status: nextStatus },
    });
    setAgencies((current) => current.map((item) => item.id === agency.id ? { ...item, status: nextStatus } : item));
  };

  const startImpersonation = async (agency: AgencyStat) => {
    const reason = window.prompt(`Raison support obligatoire pour ouvrir une session impersonation sur ${agency.name}`);
    if (!reason || reason.trim().length < 12) return;
    const { error } = await supabase.rpc('admin_start_impersonation', {
      p_target_organization_id: agency.id,
      p_reason: reason,
      p_duration_minutes: 30,
    });
    if (error) throw error;
    alert('Session impersonation préparée et auditée. Branchez ensuite le flux de session temporaire côté auth avant activation utilisateur.');
  };

  const activeItem = NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === tab);

  if (profile?.role !== 'super_admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <div className="max-w-lg rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-200" />
          <h1 className="mt-4 text-2xl font-black">Accès super-admin requis</h1>
          <p className="mt-3 text-sm leading-6 text-red-100/80">
            La console propriétaire est isolée de l’espace client et réservée aux comptes super-admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_0%,rgba(245,130,32,0.16),transparent_24rem),radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.18),transparent_28rem),linear-gradient(135deg,#050807,#0b1512_48%,#111714)] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-80 shrink-0 border-r border-white/10 bg-black/24 p-5 backdrop-blur-2xl xl:block">
          <div className="mb-8 flex items-center gap-4">
            <BrandMark size="sm" tone="dark" animated={false} withTile={false} />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-100">Samay Këur</p>
              <p className="text-xs font-bold text-orange-300">Console propriétaire</p>
            </div>
          </div>

          <div className="mb-5 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4">
            <div className="flex items-center gap-2 text-amber-100">
              <Lock className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.16em]">Zone critique</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-amber-50/70">
              Actions tracées. Accès client direct limité aux besoins support justifiés.
            </p>
          </div>

          <nav className="space-y-6">
            {NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="mb-2 px-2 text-[0.68rem] font-black uppercase tracking-[0.22em] text-slate-500">{group.title}</p>
                <div className="space-y-1">
                  {group.items.map(({ id, label, icon: Icon, description }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={classNames(
                        'group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition',
                        tab === id
                          ? 'border-emerald-300/30 bg-emerald-300/12 text-white shadow-[0_16px_44px_rgba(16,185,129,0.12)]'
                          : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/6 hover:text-white'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-black">{label}</span>
                        <span className="block truncate text-xs font-medium text-slate-500 group-hover:text-slate-400">{description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/72 px-4 py-4 backdrop-blur-2xl sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-orange-300">
                  <Command className="h-4 w-4" />
                  Control Tower
                </div>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">{activeItem?.label ?? 'Console'}</h1>
                <p className="mt-1 text-sm font-medium text-slate-400">{activeItem?.description}</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Recherche globale..."
                    className="w-full rounded-2xl border border-white/10 bg-white/8 py-3 pl-10 pr-4 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-emerald-300/40"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void loadAll()}
                  disabled={refreshing}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-black text-white transition hover:bg-white/12 disabled:opacity-60"
                >
                  <RefreshCw className={classNames('h-4 w-4', refreshing && 'animate-spin')} />
                  Actualiser
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-400/16"
                >
                  <LogOut className="h-4 w-4" />
                  Sortir
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto xl:hidden">
              {NAV_GROUPS.flatMap((group) => group.items).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={classNames(
                    'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-black',
                    tab === id ? 'border-emerald-300/30 bg-emerald-300/12 text-white' : 'border-white/10 bg-white/6 text-slate-300'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6">
            {loading ? (
              <LoadingState label="Console propriétaire" tone="dark" />
            ) : (
              <div className="mx-auto max-w-[1600px] space-y-6">
                {lastLoadedAt && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-semibold text-slate-400">
                    <span>Dernière synchronisation : {formatDate(lastLoadedAt)}</span>
                    <span className="inline-flex items-center gap-2 text-emerald-200">
                      <CheckCircle className="h-4 w-4" />
                      Données agrégées et accès super-admin vérifié
                    </span>
                  </div>
                )}

                {tab === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <KpiCard label="Organisations" value={computed.totalOrganizations} helper={`${computed.activeOrganizations} actives`} icon={Building2} />
                      <KpiCard label="MRR estimé" value={formatCurrency(computed.estimatedMrr)} helper={`${computed.payingOrganizations} comptes payants`} icon={Wallet} tone="gold" />
                      <KpiCard label="Utilisateurs actifs" value={computed.activeUsers} helper={`${computed.totalUsers} utilisateurs métier`} icon={Users} tone="blue" />
                      <KpiCard label="Documents" value={computed.totalDocuments || '—'} helper={`${computed.documentsThisMonth || 0} ce mois`} icon={FileText} tone="slate" />
                      <KpiCard label="Risques ouverts" value={computed.openIncidents + computed.riskAccounts} helper={`${computed.openIncidents} incidents`} icon={AlertTriangle} tone={computed.openIncidents ? 'red' : 'emerald'} />
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                      <SectionCard title="Santé globale de la plateforme" subtitle="Croissance, valeur et adoption produit" icon={Gauge}>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          {[
                            ['Agences', computed.activeOrganizations, computed.totalOrganizations],
                            ['Bailleurs individuels', computed.individualLandlords, computed.totalOrganizations],
                            ['Gestionnaires', computed.propertyManagers, computed.totalOrganizations],
                            ['Groupes', computed.groups, Math.max(computed.totalOrganizations, 1)],
                          ].map(([label, value, total]) => {
                            const percent = Math.min(100, Math.round((Number(value) / Math.max(Number(total), 1)) * 100));
                            return (
                              <div key={label} className="rounded-2xl border border-white/10 bg-black/18 p-4">
                                <div className="mb-3 flex items-center justify-between text-sm font-black text-white">
                                  <span>{label}</span>
                                  <span>{value}</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-orange-300" style={{ width: `${percent}%` }} />
                                </div>
                                <p className="mt-2 text-xs font-semibold text-slate-500">{percent}% du parc</p>
                              </div>
                            );
                          })}
                        </div>
                      </SectionCard>

                      <SectionCard title="Alertes critiques" subtitle="Bruit réduit, priorités visibles" icon={Bell}>
                        <div className="space-y-3">
                          {(snapshot?.incidents ?? []).slice(0, 5).map((incident) => (
                            <div key={incident.id} className="rounded-2xl border border-white/10 bg-black/16 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <Badge tone={incident.severity}>{incident.severity}</Badge>
                                <span className="text-xs font-bold text-slate-500">{safeDate(incident.last_seen_at ?? incident.created_at)}</span>
                              </div>
                              <p className="mt-3 text-sm font-black text-white">{incident.type}</p>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{incident.message}</p>
                            </div>
                          ))}
                          {(snapshot?.incidents ?? []).length === 0 && (
                            <EmptyPanel title="Aucun incident critique" text="La console est prête à recevoir les erreurs PDF, Auth, stockage, RLS et paiements via les tables samay_admin.incidents et system_events." />
                          )}
                        </div>
                      </SectionCard>
                    </div>

                    <SectionCard title="Top organisations" subtitle="Classement par volume d'encaissements observé" icon={TrendingUp}>
                      <OrganizationTable agencies={topOrganizations} onSuspend={updateAgencyStatus} onImpersonate={startImpersonation} compact />
                    </SectionCard>
                  </div>
                )}

                {tab === 'organizations' && (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                      <KpiCard label="Actives" value={computed.activeOrganizations} icon={CheckCircle} />
                      <KpiCard label="En essai" value={computed.trialOrganizations} icon={Sparkles} tone="blue" />
                      <KpiCard label="À risque" value={computed.riskAccounts} icon={ShieldAlert} tone={computed.riskAccounts ? 'red' : 'emerald'} />
                      <KpiCard label="Suspendues" value={computed.suspendedOrganizations} icon={Pause} tone="red" />
                    </div>
                    <SectionCard
                      title="Gestion des organisations"
                      subtitle="Vue tenant : statut, type de compte, quotas et actions sensibles auditées"
                      icon={Building2}
                      action={(
                        <div className="flex flex-wrap gap-2">
                          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-bold text-white">
                            <option value="all">Tous statuts</option>
                            <option value="active">Actif</option>
                            <option value="trial">Essai</option>
                            <option value="suspended">Suspendu</option>
                            <option value="risk">Risque</option>
                          </select>
                          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-bold text-white">
                            <option value="all">Tous types</option>
                            <option value="agency">Agences</option>
                            <option value="individual_landlord">Bailleurs individuels</option>
                            <option value="property_manager">Gestionnaires</option>
                            <option value="group">Groupes</option>
                          </select>
                        </div>
                      )}
                    >
                      <OrganizationTable agencies={filteredAgencies} onSuspend={updateAgencyStatus} onImpersonate={startImpersonation} />
                    </SectionCard>
                  </div>
                )}

                {tab === 'subscriptions' && (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                      <KpiCard label="MRR estimé" value={formatCurrency(computed.estimatedMrr)} icon={Wallet} tone="gold" />
                      <KpiCard label="Payants" value={computed.payingOrganizations} icon={CheckCircle} />
                      <KpiCard label="Essais" value={computed.trialOrganizations} icon={Sparkles} tone="blue" />
                      <KpiCard label="Retards" value={subscriptions.filter((s) => s.status === 'past_due').length} icon={AlertTriangle} tone="red" />
                    </div>
                    <SectionCard title="Abonnements, plans et quotas" subtitle="Starter, Pro, Business, Enterprise avec limites opérationnelles" icon={CreditCard}>
                      <SubscriptionsTable subscriptions={subscriptions} agencies={agencies} />
                    </SectionCard>
                    <SectionCard title="Quotas proches saturation" subtitle="Alertes à 70%, 80%, 90% avant friction client" icon={HardDrive}>
                      <QuotaBoard agencies={agencies} />
                    </SectionCard>
                  </div>
                )}

                {tab === 'users' && (
                  <SectionCard title="Utilisateurs et rôles" subtitle="Recherche globale, statut, organisation et accès métier" icon={Users}>
                    <UsersTable users={filteredUsers} />
                  </SectionCard>
                )}

                {tab === 'product' && (
                  <div className="space-y-6">
                    <SectionCard title="Analytics d'usage produit" subtitle="Ce qui crée réellement de la valeur dans Samay Këur" icon={Activity}>
                      <div className="grid gap-4 md:grid-cols-5">
                        {moduleUsage.map((item) => (
                          <div key={item.label} className="rounded-2xl border border-white/10 bg-black/18 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                            <p className="mt-3 text-2xl font-black text-white">{item.value}</p>
                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                              <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-orange-300" style={{ width: `${Math.min(100, Number(item.value) / Math.max(moduleUsage[0]?.value || 1, 1) * 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                    <SectionCard title="Comptes à relancer" subtitle="Inactivité, onboarding incomplet ou faible usage" icon={TrendingDown}>
                      <OrganizationTable agencies={agencies.filter((agency) => getHealthLevel(agency) !== 'healthy').slice(0, 10)} onSuspend={updateAgencyStatus} onImpersonate={startImpersonation} compact />
                    </SectionCard>
                  </div>
                )}

                {tab === 'documents' && (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                      <KpiCard label="Documents totaux" value={computed.totalDocuments || '—'} icon={FileText} tone="slate" />
                      <KpiCard label="Ce mois" value={computed.documentsThisMonth || 0} icon={Archive} />
                      <KpiCard label="QR vérifiables" value="Actif" helper="Registre documentaire" icon={KeyRound} tone="blue" />
                      <KpiCard label="Accès contenu" value="Limité" helper="Métadonnées par défaut" icon={Lock} tone="gold" />
                    </div>
                    <SectionCard title="Supervision documentaire globale" subtitle="Métadonnées uniquement par défaut : type, statut, stockage, QR et erreurs" icon={FileText}>
                      <div className="grid gap-4 md:grid-cols-3">
                        {['Quittances', 'Contrats', 'Mandats', 'Rapports', 'GED', 'QR consultés'].map((label) => (
                          <div key={label} className="rounded-2xl border border-white/10 bg-black/18 p-5">
                            <p className="text-sm font-black text-white">{label}</p>
                            <p className="mt-2 text-xs leading-5 text-slate-400">Branché sur `document_registry`, `document_verifications` et `samay_admin.document_metrics`.</p>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  </div>
                )}

                {tab === 'support' && (
                  <div className="space-y-6">
                    <SectionCard title="Tickets support" subtitle="Catégories, priorités, statuts et relation incident" icon={LifeBuoy}>
                      <TicketsList tickets={snapshot?.tickets ?? []} agencies={agencies} />
                    </SectionCard>
                    <SectionCard title="Communication admin" subtitle="Digest, annonces, maintenance et messages ciblés" icon={Mail}>
                      <CommunicationPanel />
                    </SectionCard>
                  </div>
                )}

                {tab === 'technical' && (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                      <KpiCard label="Incidents ouverts" value={computed.openIncidents} icon={AlertTriangle} tone={computed.openIncidents ? 'red' : 'emerald'} />
                      <KpiCard label="Backups" value="À vérifier" helper="Dernier statut à brancher" icon={Database} tone="blue" />
                      <KpiCard label="Stockage total" value="Mesure" helper="samay_admin metrics" icon={HardDrive} tone="slate" />
                      <KpiCard label="Jobs" value="Prévu" helper="refresh agrégats" icon={RefreshCw} tone="gold" />
                    </div>
                    <SectionCard title="Monitoring technique" subtitle="Erreurs Supabase, RLS, PDF, Auth, Storage, QR et migrations" icon={Database}>
                      <IncidentsList incidents={snapshot?.incidents ?? []} agencies={agencies} />
                    </SectionCard>
                  </div>
                )}

                {tab === 'security' && (
                  <div className="space-y-6">
                    <SectionCard title="Audit global" subtitle="Actions sensibles, support, changements de plan, impersonation et sécurité" icon={ShieldCheck}>
                      <AuditTable logs={[...(snapshot?.audit_logs ?? []), ...logs].slice(0, 100)} />
                    </SectionCard>
                    <SectionCard title="Impersonation sécurisée" subtitle="Raison obligatoire, durée limitée, audit log et bannière permanente côté client" icon={KeyRound}>
                      <div className="grid gap-4 md:grid-cols-3">
                        {[
                          ['2FA obligatoire', 'À activer avant session réelle utilisateur'],
                          ['Session temporaire', 'Durée limitée entre 5 et 60 minutes'],
                          ['Scope limité', 'Secrets, paiements sensibles et mots de passe exclus'],
                        ].map(([title, text]) => (
                          <div key={title} className="rounded-2xl border border-white/10 bg-black/18 p-5">
                            <p className="font-black text-white">{title}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  </div>
                )}

                {tab === 'configuration' && (
                  <div className="space-y-6">
                    <SectionCard title="Feature flags" subtitle="Déploiement progressif, propriétaire, expiration et impact" icon={Flag}>
                      <FeatureFlagsBoard flags={featureFlags} />
                    </SectionCard>
                    <SectionCard title="Modules par organisation" subtitle="Plan, type de compte, beta, QR, offline, équipe et audit" icon={ClipboardList}>
                      <ModulesMatrix />
                    </SectionCard>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function OrganizationTable({
  agencies,
  onSuspend,
  onImpersonate,
  compact = false,
}: {
  agencies: AgencyStat[];
  onSuspend: (agency: AgencyStat, nextStatus: 'active' | 'suspended') => Promise<void>;
  onImpersonate: (agency: AgencyStat) => Promise<void>;
  compact?: boolean;
}) {
  if (agencies.length === 0) {
    return <EmptyPanel title="Aucune organisation dans ce filtre" text="Ajustez la recherche, le statut ou le type de compte." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            <th className="px-3 py-3">Organisation</th>
            <th className="px-3 py-3">Type</th>
            <th className="px-3 py-3">Plan</th>
            <th className="px-3 py-3">Santé</th>
            <th className="px-3 py-3 text-right">Utilisateurs</th>
            <th className="px-3 py-3 text-right">Unités</th>
            <th className="px-3 py-3 text-right">Contrats</th>
            <th className="px-3 py-3 text-right">Volume</th>
            {!compact && <th className="px-3 py-3">Dernière activité</th>}
            <th className="px-3 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {agencies.map((agency) => {
            const health = healthCopy(getHealthLevel(agency));
            const type = getAccountType(agency);
            return (
              <tr key={agency.id} className="border-b border-white/8 transition hover:bg-white/[0.035]">
                <td className="px-3 py-4">
                  <p className="font-black text-white">{agency.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Créée {safeDate(agency.created_at)}</p>
                </td>
                <td className="px-3 py-4">
                  <p className="font-bold text-slate-200">{ACCOUNT_LABELS[type] ?? type}</p>
                  <p className="mt-1 text-xs text-slate-500">{agency.status ?? 'active'}</p>
                </td>
                <td className="px-3 py-4"><Badge tone={agency.status ?? 'default'}>{agency.plan ?? 'starter'}</Badge></td>
                <td className="px-3 py-4"><span className={classNames('inline-flex rounded-full border px-2.5 py-1 text-xs font-black', health.className)}>{health.label}</span></td>
                <td className="px-3 py-4 text-right font-bold text-slate-200">{agency.nb_users}</td>
                <td className="px-3 py-4 text-right font-bold text-slate-200">{agency.nb_unites}</td>
                <td className="px-3 py-4 text-right font-bold text-slate-200">{agency.nb_contrats}</td>
                <td className="px-3 py-4 text-right font-black text-white">{formatCurrency(agency.volume_paiements ?? 0)}</td>
                {!compact && <td className="px-3 py-4 text-xs font-semibold text-slate-500">{safeDate(agency.derniere_activite)}</td>}
                <td className="px-3 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void onImpersonate(agency)}
                      className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-black text-amber-100 hover:bg-amber-300/16"
                    >
                      Support
                    </button>
                    <button
                      type="button"
                      onClick={() => void onSuspend(agency, agency.status === 'suspended' ? 'active' : 'suspended')}
                      className={classNames(
                        'rounded-xl border px-3 py-2 text-xs font-black',
                        agency.status === 'suspended'
                          ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                          : 'border-red-300/20 bg-red-400/10 text-red-100'
                      )}
                    >
                      {agency.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SubscriptionsTable({ subscriptions, agencies }: { subscriptions: Subscription[]; agencies: AgencyStat[] }) {
  const rows = subscriptions.length
    ? subscriptions
    : agencies.slice(0, 20).map((agency) => ({
      id: agency.id,
      agency_id: agency.id,
      agency_name: agency.name,
      plan_id: agency.plan ?? 'starter',
      status: agency.status === 'trial' ? 'trial' : 'active',
      current_period_start: agency.created_at,
      current_period_end: agency.trial_ends_at,
      created_at: agency.created_at,
    }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            <th className="px-3 py-3">Organisation</th>
            <th className="px-3 py-3">Plan</th>
            <th className="px-3 py-3">Statut</th>
            <th className="px-3 py-3 text-right">MRR</th>
            <th className="px-3 py-3">Début</th>
            <th className="px-3 py-3">Échéance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((subscription) => (
            <tr key={subscription.id} className="border-b border-white/8 hover:bg-white/[0.035]">
              <td className="px-3 py-4 font-black text-white">{subscription.agency_name}</td>
              <td className="px-3 py-4"><Badge>{subscription.plan_id}</Badge></td>
              <td className="px-3 py-4"><Badge tone={subscription.status}>{subscription.status}</Badge></td>
              <td className="px-3 py-4 text-right font-black text-white">{formatCurrency(PLAN_PRICES[subscription.plan_id] ?? 0)}</td>
              <td className="px-3 py-4 text-slate-400">{safeDate(subscription.current_period_start)}</td>
              <td className="px-3 py-4 text-slate-400">{safeDate(subscription.current_period_end)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuotaBoard({ agencies }: { agencies: AgencyStat[] }) {
  const atRisk = agencies
    .map((agency) => ({
      agency,
      unitRatio: Math.min(100, Math.round((agency.nb_unites / (agency.plan === 'starter' || agency.plan === 'basic' ? 3 : agency.plan === 'pro' ? 20 : 100)) * 100)),
      userRatio: Math.min(100, Math.round((agency.nb_users / (agency.plan === 'starter' || agency.plan === 'basic' ? 1 : agency.plan === 'pro' ? 5 : 15)) * 100)),
    }))
    .filter(({ unitRatio, userRatio }) => unitRatio >= 70 || userRatio >= 70)
    .slice(0, 8);

  if (atRisk.length === 0) return <EmptyPanel title="Aucun quota proche saturation" text="Les alertes apparaîtront à partir de 70% d’utilisation." />;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {atRisk.map(({ agency, unitRatio, userRatio }) => (
        <div key={agency.id} className="rounded-2xl border border-white/10 bg-black/18 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-black text-white">{agency.name}</p>
            <Badge tone={unitRatio >= 90 || userRatio >= 90 ? 'critical' : 'past_due'}>{Math.max(unitRatio, userRatio)}%</Badge>
          </div>
          {[
            ['Unités', unitRatio],
            ['Utilisateurs', userRatio],
          ].map(([label, ratio]) => (
            <div key={label} className="mt-4">
              <div className="mb-1 flex justify-between text-xs font-bold text-slate-400"><span>{label}</span><span>{ratio}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-300 to-red-400" style={{ width: `${ratio}%` }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function UsersTable({ users }: { users: GlobalUser[] }) {
  if (users.length === 0) return <EmptyPanel title="Aucun utilisateur trouvé" text="La recherche globale filtre nom, email, rôle et organisation." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            <th className="px-3 py-3">Utilisateur</th>
            <th className="px-3 py-3">Organisation</th>
            <th className="px-3 py-3">Rôle</th>
            <th className="px-3 py-3">Statut</th>
            <th className="px-3 py-3 text-right">Créé</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-white/8 hover:bg-white/[0.035]">
              <td className="px-3 py-4">
                <p className="font-black text-white">{user.prenom} {user.nom}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{user.email}</p>
              </td>
              <td className="px-3 py-4 font-bold text-slate-300">{user.agency_name}</td>
              <td className="px-3 py-4"><Badge>{user.role}</Badge></td>
              <td className="px-3 py-4">{user.actif ? <Badge tone="active">Actif</Badge> : <Badge tone="suspended">Inactif</Badge>}</td>
              <td className="px-3 py-4 text-right text-xs font-semibold text-slate-500">{safeDate(user.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TicketsList({ tickets, agencies }: { tickets: SupportTicket[]; agencies: AgencyStat[] }) {
  if (tickets.length === 0) {
    return <EmptyPanel title="Aucun ticket support" text="Les tickets seront stockés dans samay_admin.support_tickets avec priorité, catégorie, statut et organisation." />;
  }
  return (
    <div className="space-y-3">
      {tickets.map((ticket) => (
        <div key={ticket.id} className="rounded-2xl border border-white/10 bg-black/18 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-black text-white">{ticket.subject}</p>
            <div className="flex gap-2"><Badge tone={ticket.status}>{ticket.status}</Badge><Badge>{ticket.priority}</Badge></div>
          </div>
          <p className="mt-2 text-sm text-slate-400">{agencies.find((agency) => agency.id === ticket.organization_id)?.name ?? 'Organisation non renseignée'} · {ticket.category}</p>
        </div>
      ))}
    </div>
  );
}

function IncidentsList({ incidents, agencies }: { incidents: AdminIncident[]; agencies: AgencyStat[] }) {
  if (incidents.length === 0) {
    return <EmptyPanel title="Aucun incident enregistré" text="Branchez les erreurs client/Edge Functions vers samay_admin.incidents ou system_events pour alimenter cette vue." />;
  }
  return (
    <div className="space-y-3">
      {incidents.map((incident) => (
        <div key={incident.id} className="rounded-2xl border border-white/10 bg-black/18 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><Badge tone={incident.severity}>{incident.severity}</Badge><Badge tone={incident.status}>{incident.status}</Badge></div>
            <p className="text-xs font-bold text-slate-500">{safeDate(incident.last_seen_at ?? incident.created_at)}</p>
          </div>
          <p className="mt-3 font-black text-white">{incident.type}</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">{incident.message}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{agencies.find((agency) => agency.id === incident.organization_id)?.name ?? 'Plateforme'} · {incident.occurrences ?? 1} occurrence(s)</p>
        </div>
      ))}
    </div>
  );
}

function AuditTable({ logs }: { logs: OwnerLog[] }) {
  if (logs.length === 0) return <EmptyPanel title="Audit vide" text="Les actions sensibles seront écrites via admin_audit_action et owner_actions_log." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            <th className="px-3 py-3">Date</th>
            <th className="px-3 py-3">Action</th>
            <th className="px-3 py-3">Cible</th>
            <th className="px-3 py-3">Raison / détails</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-white/8 hover:bg-white/[0.035]">
              <td className="px-3 py-4 text-xs font-semibold text-slate-500">{safeDate(log.created_at)}</td>
              <td className="px-3 py-4"><span className="rounded-lg bg-white/8 px-2 py-1 font-mono text-xs font-bold text-orange-200">{log.action}</span></td>
              <td className="px-3 py-4 font-bold text-slate-300">{log.target_label ?? log.target_type ?? 'Plateforme'}</td>
              <td className="px-3 py-4 text-xs leading-5 text-slate-400">{log.reason ?? JSON.stringify(log.details ?? log.metadata ?? {})}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeatureFlagsBoard({ flags }: { flags: AdminFeatureFlag[] }) {
  const normalized = flags.map((flag) => ({
    ...flag,
    key: flag.key ?? flag.flag_name ?? 'feature_flag',
    name: flag.name ?? flag.flag_name ?? flag.key ?? 'Feature flag',
    status: flag.status ?? (flag.enabled ? 'active' : 'draft'),
  }));

  if (normalized.length === 0) {
    return <EmptyPanel title="Aucun feature flag" text="La migration crée samay_admin.feature_flags et feature_flag_targets pour piloter les rollouts proprement." />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {normalized.map((flag) => (
        <div key={flag.id} className="rounded-2xl border border-white/10 bg-black/18 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm font-black text-orange-200">{flag.key}</p>
              <p className="mt-1 font-black text-white">{flag.name}</p>
            </div>
            <Badge tone={flag.status}>{flag.status}</Badge>
          </div>
          {flag.description && <p className="mt-3 text-sm leading-6 text-slate-400">{flag.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
            <span>Owner : {flag.owner ?? 'À assigner'}</span>
            <span>Expire : {safeDate(flag.expires_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ModulesMatrix() {
  const rows = [
    ['Bailleur individuel', 'Biens, loyers, documents simples, rapports propriétaire', 'Mandats, commissions agence, équipe avancée'],
    ['Gestionnaire', 'Propriétaires, mandats, honoraires, rapports propriétaires', 'Audit complet selon plan'],
    ['Agence Business', 'Équipe, mandats, commissions, audit, GED, QR', 'API/Webhooks hors plan'],
    ['Groupe', 'Supervision multi-agences, reporting consolidé', 'Prévu phase enterprise'],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            <th className="px-3 py-3">Profil</th>
            <th className="px-3 py-3">Modules activés</th>
            <th className="px-3 py-3">Restrictions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([profile, enabled, restricted]) => (
            <tr key={profile} className="border-b border-white/8">
              <td className="px-3 py-4 font-black text-white">{profile}</td>
              <td className="px-3 py-4 text-slate-300">{enabled}</td>
              <td className="px-3 py-4 text-slate-400">{restricted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommunicationPanel() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        ['Digest quotidien', 'Nouveaux comptes, tickets, incidents, quotas et paiements SaaS en retard.'],
        ['Annonces ciblées', 'Tous, plan, type de compte, organisation, rôle ou beta group.'],
        ['Seuils intelligents', 'Alerter seulement si un signal dépasse un seuil opérationnel utile.'],
      ].map(([title, text]) => (
        <div key={title} className="rounded-2xl border border-white/10 bg-black/18 p-5">
          <p className="font-black text-white">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
          <button type="button" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-black text-white">
            Configurer
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
