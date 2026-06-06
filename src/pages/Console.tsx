import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  Bell,
  Building2,
  CheckCircle,
  ClipboardList,
  Command,
  CreditCard,
  Database,
  Edit3,
  FileText,
  Flag,
  Filter,
  Gauge,
  HardDrive,
  KeyRound,
  LifeBuoy,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Pause,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { BrandMark } from '../components/brand/BrandLogo';
import { AgencyRequestsPanel } from '../components/console/AgencyRequestsPanel';
import {
  CreateAgencyModal,
  EditSubscriptionModal,
  EditUserModal,
  InviteUserModal,
  type SubscriptionRow,
  type UserRow,
} from '../components/console/ConsoleModals';
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
  | 'requests'
  | 'support'
  | 'technical'
  | 'security'
  | 'configuration';

const ADMIN_ROUTE_TABS: Record<string, AdminTab> = {
  dashboard: 'overview',
  console: 'overview',
  agences: 'organizations',
  organisations: 'organizations',
  abonnement: 'subscriptions',
  equipe: 'users',
  utilisateurs: 'users',
  documents: 'documents',
  'documents/scan': 'documents',
  demandes: 'requests',
  support: 'support',
  technique: 'technical',
  technical: 'technical',
  securite: 'security',
  sécurité: 'security',
  configuration: 'configuration',
  notifications: 'support',
  audit: 'security',
  parametres: 'configuration',
  pricing: 'subscriptions',
  'tableau-de-bord-financier': 'product',
};

const ADMIN_TAB_ROUTES: Record<AdminTab, string> = {
  overview: 'dashboard',
  organizations: 'agences',
  subscriptions: 'abonnement',
  users: 'utilisateurs',
  product: 'tableau-de-bord-financier',
  documents: 'documents',
  requests: 'demandes',
  support: 'support',
  technical: 'technique',
  security: 'securite',
  configuration: 'configuration',
};

function getAdminTabFromHash(): AdminTab {
  if (typeof window === 'undefined') return 'overview';
  const hashPage = window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard';
  return ADMIN_ROUTE_TABS[hashPage] ?? 'overview';
}

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
  agency_id?: string | null;
  key?: string;
  flag?: string;
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

interface SaasConfigRow {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

interface AdminReasonAction {
  title: string;
  message: string;
  confirmText?: string;
  destructive?: boolean;
  requireText?: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  minReasonLength?: number;
  onConfirm: (reason: string) => Promise<void> | void;
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
      { id: 'requests', label: 'Demandes', icon: ClipboardList, description: 'Demandes d’intégration et validation des espaces' },
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
  const [tab, setTab] = useState<AdminTab>(() => getAdminTabFromHash());
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
  const [showCreateAgency, setShowCreateAgency] = useState(false);
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editSub, setEditSub] = useState<SubscriptionRow | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<AgencyStat | null>(null);
  const [actionDialog, setActionDialog] = useState<AdminReasonAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const platformSnapshot = snapshot?.platform;

  const selectAdminTab = useCallback((nextTab: AdminTab) => {
    setTab(nextTab);
    if (typeof window === 'undefined') return;
    const nextRoute = ADMIN_TAB_ROUTES[nextTab];
    const nextHash = `#/${nextRoute}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
    }
  }, []);

  useEffect(() => {
    const syncTabWithRoute = () => setTab(getAdminTabFromHash());
    window.addEventListener('hashchange', syncTabWithRoute);
    syncTabWithRoute();
    return () => window.removeEventListener('hashchange', syncTabWithRoute);
  }, []);

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

      let nextSnapshot: AdminSnapshot | null = null;
      if (isSettled(snapshotResult) && !snapshotResult.value.error && snapshotResult.value.data) {
        nextSnapshot = snapshotResult.value.data as AdminSnapshot;
        setSnapshot(nextSnapshot);
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
      } else if (nextSnapshot?.feature_flags) {
        setFeatureFlags(nextSnapshot.feature_flags);
      }

      setLastLoadedAt(new Date().toISOString());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
    const auditPayload = {
      actor_id: profile?.id,
      actor_email: profile?.email,
      action: payload.action,
      target_type: payload.targetOrganizationId ? 'agency' : 'platform',
      target_id: payload.targetOrganizationId ?? null,
      target_label: payload.targetLabel ?? null,
      details: { reason: payload.reason, ...(payload.metadata ?? {}) },
    };

    const [rpcAudit, legacyAudit] = await Promise.allSettled([
      supabase.rpc('admin_audit_action', {
        p_action: payload.action,
        p_reason: payload.reason,
        p_target_organization_id: payload.targetOrganizationId ?? null,
        p_target_user_id: null,
        p_metadata: payload.metadata ?? {},
      }),
      supabase.from('owner_actions_log').insert(auditPayload),
    ]);

    const rpcError = rpcAudit.status === 'fulfilled' ? rpcAudit.value.error : rpcAudit.reason;
    const legacyError = legacyAudit.status === 'fulfilled' ? legacyAudit.value.error : legacyAudit.reason;
    if (rpcError && legacyError) {
      console.warn('[Console] audit best-effort failed', rpcError, legacyError);
    }
  };

  const updateAgencyStatus = (agency: AgencyStat, nextStatus: 'active' | 'suspended') => {
    const isReactivation = nextStatus === 'active';
    setActionDialog({
      title: isReactivation ? 'Réactiver cette organisation' : 'Suspendre cette organisation',
      message: `${agency.name} passera au statut ${isReactivation ? 'actif' : 'suspendu'}. Cette action est auditée et doit avoir une justification claire.`,
      confirmText: isReactivation ? 'Réactiver' : 'Suspendre',
      destructive: !isReactivation,
      minReasonLength: 8,
      reasonPlaceholder: isReactivation ? 'Ex : dossier régularisé, paiement confirmé...' : 'Ex : impayé SaaS, risque sécurité, demande client...',
      onConfirm: async (reason) => {
        const { error } = await supabase.from('agencies').update({ status: nextStatus }).eq('id', agency.id);
        if (error) throw error;
        await logAdminAction({
          action: isReactivation ? 'organization_reactivated' : 'organization_suspended',
          reason,
          targetOrganizationId: agency.id,
          targetLabel: agency.name,
          metadata: { previous_status: agency.status, next_status: nextStatus },
        });
        setAgencies((current) => current.map((item) => item.id === agency.id ? { ...item, status: nextStatus } : item));
        setSelectedAgency((current) => current?.id === agency.id ? { ...current, status: nextStatus } : current);
        setFeedback({ kind: 'success', text: `${agency.name} est maintenant ${isReactivation ? 'active' : 'suspendue'}.` });
      },
    });
  };

  const updateAgencyPlan = (agency: AgencyStat, nextPlan: string) => {
    setActionDialog({
      title: `Changer le plan en ${nextPlan}`,
      message: `${agency.name} changera de plan. Les limites visibles et l'abonnement existant seront alignés si une ligne subscription existe.`,
      confirmText: 'Changer le plan',
      minReasonLength: 8,
      reasonPlaceholder: 'Ex : upgrade validé par commercial, régularisation abonnement...',
      onConfirm: async (reason) => {
        const { error } = await supabase.from('agencies').update({ plan: nextPlan }).eq('id', agency.id);
        if (error) throw error;

        const existingSubscription = subscriptions.find((subscription) => subscription.agency_id === agency.id);
        if (existingSubscription) {
          const { error: subscriptionError } = await supabase.from('subscriptions').update({ plan_id: nextPlan }).eq('id', existingSubscription.id);
          if (subscriptionError) throw subscriptionError;
        }

        await logAdminAction({
          action: 'organization_plan_changed',
          reason,
          targetOrganizationId: agency.id,
          targetLabel: agency.name,
          metadata: { previous_plan: agency.plan, next_plan: nextPlan, subscription_id: existingSubscription?.id ?? null },
        });

        setAgencies((current) => current.map((item) => item.id === agency.id ? { ...item, plan: nextPlan } : item));
        setSelectedAgency((current) => current?.id === agency.id ? { ...current, plan: nextPlan } : current);
        setSubscriptions((current) => current.map((item) => item.agency_id === agency.id ? { ...item, plan_id: nextPlan } : item));
        setFeedback({ kind: 'success', text: `${agency.name} est passé au plan ${nextPlan}.` });
      },
    });
  };

  const extendTrial = (agency: AgencyStat, days: number) => {
    setActionDialog({
      title: `Prolonger l'essai de ${days} jours`,
      message: `${agency.name} repassera en statut trial avec une nouvelle échéance calculée depuis la date la plus récente.`,
      confirmText: 'Prolonger',
      minReasonLength: 8,
      reasonPlaceholder: 'Ex : période pilote validée, dossier commercial en cours...',
      onConfirm: async (reason) => {
        const baseDate = agency.trial_ends_at ? new Date(agency.trial_ends_at) : new Date();
        const nextDate = new Date(Math.max(baseDate.getTime(), Date.now()) + days * 86_400_000).toISOString();
        const { error } = await supabase.from('agencies').update({ status: 'trial', trial_ends_at: nextDate }).eq('id', agency.id);
        if (error) throw error;

        await logAdminAction({
          action: 'organization_trial_extended',
          reason,
          targetOrganizationId: agency.id,
          targetLabel: agency.name,
          metadata: { days, previous_trial_ends_at: agency.trial_ends_at, next_trial_ends_at: nextDate },
        });

        setAgencies((current) => current.map((item) => item.id === agency.id ? { ...item, status: 'trial', trial_ends_at: nextDate } : item));
        setSelectedAgency((current) => current?.id === agency.id ? { ...current, status: 'trial', trial_ends_at: nextDate } : current);
        setFeedback({ kind: 'success', text: `Essai prolongé jusqu'au ${formatDate(nextDate)}.` });
      },
    });
  };

  const deleteAgency = (agency: AgencyStat) => {
    setActionDialog({
      title: 'Supprimer cette organisation ?',
      message: `Cette action est irréversible. Elle supprime l'organisation "${agency.name}", ses accès applicatifs, paramètres, bailleurs, biens, unités, locataires, contrats, paiements, documents/GED, registres QR, invitations et données opérationnelles rattachées. Les comptes Supabase Auth ne sont pas supprimés, mais leurs profils liés à cette organisation sont retirés. Tapez le nom exact et renseignez une raison complète.`,
      confirmText: 'Supprimer',
      destructive: true,
      requireText: agency.name,
      minReasonLength: 12,
      reasonPlaceholder: 'Ex : doublon confirmé, demande contractuelle écrite, tenant de test...',
      onConfirm: async (reason) => {
        const { data, error } = await supabase.rpc('delete_agency_cascade', {
          p_agency_id: agency.id,
          p_reason: reason,
        });
        if (error) throw error;
        const deletionResult = data as { deleted?: Record<string, number>; user_profiles_deleted?: number; storage_objects_deleted?: number } | null;
        const userProfilesDeleted = deletionResult?.user_profiles_deleted ?? deletionResult?.deleted?.user_profiles ?? 0;
        const storageObjectsDeleted = deletionResult?.storage_objects_deleted ?? 0;
        setAgencies((current) => current.filter((item) => item.id !== agency.id));
        setSelectedAgency(null);
        setFeedback({
          kind: 'success',
          text: `${agency.name} a été supprimée via la cascade sécurisée. ${userProfilesDeleted} profil(s) d'accès retiré(s), ${storageObjectsDeleted} objet(s) storage supprimé(s).`,
        });
        void loadAll();
      },
    });
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
                      onClick={() => selectAdminTab(id)}
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
                  onClick={() => setShowCreateAgency(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/12 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-300/18"
                >
                  <Plus className="h-4 w-4" />
                  Organisation
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteUser(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-300/20 bg-orange-300/12 px-4 py-3 text-sm font-black text-orange-100 transition hover:bg-orange-300/18"
                >
                  <UserPlus className="h-4 w-4" />
                  Invitation
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
                  onClick={() => selectAdminTab(id)}
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
                {feedback && (
                  <div className={classNames(
                    'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-bold',
                    feedback.kind === 'success'
                      ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                      : 'border-red-300/25 bg-red-400/10 text-red-100'
                  )}>
                    <span>{feedback.text}</span>
                    <button type="button" onClick={() => setFeedback(null)} className="rounded-lg p-1 hover:bg-white/10">
                      <X className="h-4 w-4" />
                    </button>
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
                      <OrganizationTable
                        agencies={topOrganizations}
                        onOpenDetail={setSelectedAgency}
                        onSuspend={updateAgencyStatus}
                        compact
                      />
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
                      <OrganizationTable
                        agencies={filteredAgencies}
                        onOpenDetail={setSelectedAgency}
                        onSuspend={updateAgencyStatus}
                      />
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
                      <SubscriptionsTable subscriptions={subscriptions} agencies={agencies} onEdit={setEditSub} />
                    </SectionCard>
                    <SectionCard title="Quotas proches saturation" subtitle="Alertes à 70%, 80%, 90% avant friction client" icon={HardDrive}>
                      <QuotaBoard agencies={agencies} />
                    </SectionCard>
                  </div>
                )}

                {tab === 'users' && (
                  <SectionCard
                    title="Utilisateurs et rôles"
                    subtitle="Recherche globale, statut, organisation et accès métier"
                    icon={Users}
                    action={(
                      <button type="button" onClick={() => setShowInviteUser(true)} className="inline-flex items-center gap-2 rounded-xl border border-orange-300/20 bg-orange-300/12 px-3 py-2 text-xs font-black text-orange-100">
                        <UserPlus className="h-4 w-4" />
                        Inviter
                      </button>
                    )}
                  >
                    <UsersTable users={filteredUsers} onEdit={setEditUser} />
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
                      <OrganizationTable
                        agencies={agencies.filter((agency) => getHealthLevel(agency) !== 'healthy').slice(0, 10)}
                        onOpenDetail={setSelectedAgency}
                        onSuspend={updateAgencyStatus}
                        compact
                      />
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

                {tab === 'requests' && (
                  <div className="space-y-6">
                    <SectionCard title="Demandes d'intégration" subtitle="Validation des nouveaux espaces, bailleurs individuels et agences avant accès produit" icon={ClipboardList}>
                      <AgencyRequestsPanel />
                    </SectionCard>
                  </div>
                )}

                {tab === 'support' && (
                  <div className="space-y-6">
                    <SectionCard title="Tickets support" subtitle="Catégories, priorités, statuts et relation incident" icon={LifeBuoy}>
                      <TicketsList tickets={snapshot?.tickets ?? []} agencies={agencies} />
                    </SectionCard>
                    <SectionCard title="Communication admin" subtitle="Digest, annonces, maintenance et messages ciblés" icon={Mail}>
                      <CommunicationPanel agencies={agencies} actorId={profile?.id} actorEmail={profile?.email} onSent={loadAll} />
                    </SectionCard>
                  </div>
                )}

                {tab === 'technical' && (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                      <KpiCard label="Incidents ouverts" value={computed.openIncidents} icon={AlertTriangle} tone={computed.openIncidents ? 'red' : 'emerald'} />
                      <KpiCard label="Backups" value="Non connecté" helper="Aucun statut backup live disponible" icon={Database} tone="blue" />
                      <KpiCard label="Stockage total" value="Non mesuré" helper="Aucun compteur stockage branché" icon={HardDrive} tone="slate" />
                      <KpiCard label="Jobs" value="Non planifié" helper="Aucun job de rafraîchissement actif" icon={RefreshCw} tone="gold" />
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
                    <SectionCard title="Impersonation sécurisée" subtitle="Fonction verrouillée tant que le scope client et la bannière permanente ne sont pas livrés" icon={KeyRound}>
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
                      <FeatureFlagsBoard flags={featureFlags} agencies={agencies} onReload={loadAll} actorId={profile?.id} actorEmail={profile?.email} />
                    </SectionCard>
                    <SectionCard title="Modules par organisation" subtitle="Plan, type de compte, beta, QR, offline, équipe et audit" icon={ClipboardList}>
                      <ModulesMatrix />
                    </SectionCard>
                    <SectionCard title="Configuration SaaS" subtitle="Maintenance, contact, essai, annonces et paramètres JSON globaux" icon={Command}>
                      <ConfigurationPanel actorId={profile?.id} actorEmail={profile?.email} />
                    </SectionCard>
                  </div>
                )}
              </div>
            )}
          </main>
          <OrganizationDetailDrawer
            agency={selectedAgency}
            users={users.filter((user) => user.agency_id === selectedAgency?.id)}
            subscriptions={subscriptions.filter((subscription) => subscription.agency_id === selectedAgency?.id)}
            onClose={() => setSelectedAgency(null)}
            onSuspend={updateAgencyStatus}
            onPlanChange={updateAgencyPlan}
            onExtendTrial={extendTrial}
            onDelete={deleteAgency}
          />
          <CreateAgencyModal
            open={showCreateAgency}
            onClose={() => setShowCreateAgency(false)}
            actorId={profile?.id}
            actorEmail={profile?.email}
            onCreated={loadAll}
          />
          <InviteUserModal
            open={showInviteUser}
            onClose={() => setShowInviteUser(false)}
            agencies={agencies.map((agency) => ({ id: agency.id, name: agency.name, status: agency.status ?? undefined, plan: agency.plan ?? undefined }))}
            actorId={profile?.id}
            actorEmail={profile?.email}
            onInvited={loadAll}
          />
          <EditUserModal
            open={editUser !== null}
            onClose={() => setEditUser(null)}
            user={editUser}
            agencies={agencies.map((agency) => ({ id: agency.id, name: agency.name }))}
            actorId={profile?.id}
            actorEmail={profile?.email}
            onSaved={loadAll}
          />
          <EditSubscriptionModal
            open={editSub !== null}
            onClose={() => setEditSub(null)}
            subscription={editSub}
            actorId={profile?.id}
            actorEmail={profile?.email}
            onSaved={loadAll}
          />
          <AdminReasonDialog
            action={actionDialog}
            busy={actionBusy}
            onClose={() => {
              setActionDialog(null);
              setActionBusy(false);
            }}
            onConfirm={async (reason) => {
              if (!actionDialog) return;
              setActionBusy(true);
              setFeedback(null);
              try {
                await actionDialog.onConfirm(reason);
                setActionDialog(null);
              } catch (error) {
                setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'Action impossible pour le moment.' });
              } finally {
                setActionBusy(false);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function AdminReasonDialog({
  action,
  busy,
  onClose,
  onConfirm,
}: {
  action: AdminReasonAction | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    if (!action) {
      setReason('');
      setConfirmation('');
    }
  }, [action]);

  if (!action) return null;

  const minLength = action.minReasonLength ?? 8;
  const reasonValid = reason.trim().length >= minLength;
  const confirmationValid = !action.requireText || confirmation === action.requireText;
  const canConfirm = reasonValid && confirmationValid && !busy;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button type="button" aria-label="Fermer la confirmation" className="absolute inset-0 bg-black/72 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <section className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#07100d] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={classNames(
              'mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em]',
              action.destructive ? 'border-red-300/30 bg-red-400/10 text-red-100' : 'border-amber-300/30 bg-amber-300/10 text-amber-100'
            )}>
              Action auditée
            </div>
            <h2 className="text-xl font-black text-white">{action.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{action.message}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-2xl border border-white/10 bg-white/8 p-2 text-slate-200 hover:bg-white/12 disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        {action.requireText && (
          <label className="mt-5 block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Confirmation exacte</span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={action.requireText}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-red-300/40"
            />
          </label>
        )}

        <label className="mt-5 block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{action.reasonLabel ?? 'Raison obligatoire'}</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            placeholder={action.reasonPlaceholder ?? 'Expliquez la raison métier ou support de cette action...'}
            className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-orange-300/40"
          />
          <span className={classNames('mt-2 block text-xs font-semibold', reasonValid ? 'text-emerald-200' : 'text-slate-500')}>
            {reason.trim().length}/{minLength} caractères minimum
          </span>
        </label>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-black text-slate-200 hover:bg-white/12 disabled:opacity-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void onConfirm(reason.trim())}
            disabled={!canConfirm}
            className={classNames(
              'inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black disabled:opacity-50',
              action.destructive ? 'border-red-300/25 bg-red-500/14 text-red-100 hover:bg-red-500/20' : 'border-orange-300/25 bg-orange-300/14 text-orange-100 hover:bg-orange-300/20'
            )}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {action.confirmText ?? 'Confirmer'}
          </button>
        </div>
      </section>
    </div>
  );
}

function OrganizationDetailDrawer({
  agency,
  users,
  subscriptions,
  onClose,
  onSuspend,
  onPlanChange,
  onExtendTrial,
  onDelete,
}: {
  agency: AgencyStat | null;
  users: GlobalUser[];
  subscriptions: Subscription[];
  onClose: () => void;
  onSuspend: (agency: AgencyStat, nextStatus: 'active' | 'suspended') => void;
  onPlanChange: (agency: AgencyStat, nextPlan: string) => void;
  onExtendTrial: (agency: AgencyStat, days: number) => void;
  onDelete: (agency: AgencyStat) => void;
}) {
  if (!agency) return null;
  const health = healthCopy(getHealthLevel(agency));
  const accountType = getAccountType(agency);
  const activeSubscription = subscriptions[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fermer la fiche organisation" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#07100d] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone={agency.status ?? 'active'}>{agency.status ?? 'active'}</Badge>
              <span className={classNames('inline-flex rounded-full border px-2.5 py-1 text-xs font-black', health.className)}>{health.label}</span>
              <Badge>{ACCOUNT_LABELS[accountType] ?? accountType}</Badge>
            </div>
            <h2 className="text-2xl font-black text-white">{agency.name}</h2>
            <p className="mt-2 text-sm font-semibold text-slate-400">Créée {safeDate(agency.created_at)} · Dernière activité {safeDate(agency.derniere_activite)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/8 p-2 text-slate-200 hover:bg-white/12">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ['Utilisateurs', agency.nb_users],
            ['Unités', agency.nb_unites],
            ['Contrats', agency.nb_contrats],
            ['Paiements', agency.nb_paiements],
            ['Volume', formatCurrency(agency.volume_paiements ?? 0)],
            ['Bailleurs', agency.nb_bailleurs],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.045] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-white">Plan et abonnement</h3>
              <p className="mt-1 text-sm font-semibold text-slate-400">
                Plan actuel : {agency.plan ?? activeSubscription?.plan_id ?? 'starter'} · Échéance {safeDate(activeSubscription?.current_period_end ?? agency.trial_ends_at)}
              </p>
            </div>
            <Badge tone={activeSubscription?.status ?? agency.status ?? 'active'}>{activeSubscription?.status ?? agency.status ?? 'active'}</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {['starter', 'pro', 'business', 'enterprise'].map((plan) => (
              <button
                type="button"
                key={plan}
                onClick={() => void onPlanChange(agency, plan)}
                disabled={(agency.plan ?? activeSubscription?.plan_id) === plan}
                className="rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-black text-white hover:bg-white/12 disabled:opacity-40"
              >
                {plan}
              </button>
            ))}
            <button type="button" onClick={() => void onExtendTrial(agency, 14)} className="rounded-xl border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-black text-sky-100">
              +14 jours essai
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.045] p-5">
          <h3 className="font-black text-white">Utilisateurs rattachés</h3>
          <div className="mt-4 space-y-3">
            {users.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">Aucun utilisateur rattaché détecté.</p>
            ) : users.slice(0, 8).map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/18 p-3">
                <div>
                  <p className="font-black text-white">{user.prenom} {user.nom}</p>
                  <p className="text-xs font-semibold text-slate-500">{user.email}</p>
                </div>
                <Badge tone={user.actif ? 'active' : 'suspended'}>{user.role}</Badge>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.045] p-5">
          <h3 className="font-black text-white">Actions sensibles</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">Chaque action demande une raison et écrit un audit log best-effort dans la console owner.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/8 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-black text-amber-100">
                <Lock className="h-4 w-4" />
                Impersonation verrouillée
              </div>
              <p className="mt-2 text-xs leading-5 text-amber-50/70">
                L'activation reste désactivée tant que le scope client, la bannière permanente et la sortie de session ne sont pas branchés côté app.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onSuspend(agency, agency.status === 'suspended' ? 'active' : 'suspended')}
              className={classNames(
                'rounded-2xl border px-4 py-3 text-sm font-black',
                agency.status === 'suspended'
                  ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                  : 'border-red-300/20 bg-red-400/10 text-red-100'
              )}
            >
              {agency.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
            </button>
            <button type="button" onClick={() => onDelete(agency)} className="sm:col-span-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100">
              Supprimer l'organisation
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}

function OrganizationTable({
  agencies,
  onOpenDetail,
  onSuspend,
  compact = false,
}: {
  agencies: AgencyStat[];
  onOpenDetail: (agency: AgencyStat) => void;
  onSuspend: (agency: AgencyStat, nextStatus: 'active' | 'suspended') => void;
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
                      onClick={() => onOpenDetail(agency)}
                      className="rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-black text-white hover:bg-white/12"
                    >
                      Détails
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

function SubscriptionsTable({
  subscriptions,
  agencies,
  onEdit,
}: {
  subscriptions: Subscription[];
  agencies: AgencyStat[];
  onEdit: (subscription: SubscriptionRow) => void;
}) {
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
  const canEditRows = subscriptions.length > 0;

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
            <th className="px-3 py-3 text-right">Actions</th>
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
              <td className="px-3 py-4 text-right">
                <button
                  type="button"
                  onClick={() => canEditRows && onEdit(subscription as SubscriptionRow)}
                  disabled={!canEditRows}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-black text-white hover:bg-white/12 disabled:opacity-40"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Modifier
                </button>
              </td>
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

function UsersTable({ users, onEdit }: { users: GlobalUser[]; onEdit: (user: UserRow) => void }) {
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
            <th className="px-3 py-3 text-right">Actions</th>
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
              <td className="px-3 py-4 text-right">
                <button
                  type="button"
                  onClick={() => onEdit(user as UserRow)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-black text-white hover:bg-white/12"
                >
                  <UserCog className="h-3.5 w-3.5" />
                  Modifier
                </button>
              </td>
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

function FeatureFlagsBoard({
  flags,
  agencies,
  onReload,
  actorId,
  actorEmail,
}: {
  flags: AdminFeatureFlag[];
  agencies: AgencyStat[];
  onReload: () => void;
  actorId?: string;
  actorEmail?: string | null;
}) {
  const [form, setForm] = useState({ flag: '', agency_id: '', description: '' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filterAgency, setFilterAgency] = useState('all');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<(AdminFeatureFlag & { key: string; name: string }) | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const normalized = flags.map((flag) => ({
    ...flag,
    key: flag.key ?? flag.flag ?? flag.flag_name ?? 'feature_flag',
    name: flag.name ?? flag.flag_name ?? flag.flag ?? flag.key ?? 'Feature flag',
    status: flag.status ?? (flag.enabled ? 'active' : 'draft'),
    enabled: flag.enabled ?? flag.status === 'active',
  }));

  const visible = normalized.filter((flag) => {
    if (filterAgency === 'all') return true;
    if (filterAgency === 'global') return !flag.agency_id;
    return flag.agency_id === filterAgency;
  });

  const audit = async (action: string, details: Record<string, unknown>) => {
    await supabase.from('owner_actions_log').insert({
      actor_id: actorId,
      actor_email: actorEmail,
      action,
      target_type: 'feature_flag',
      target_label: String(details.flag ?? details.key ?? 'feature_flag'),
      details,
    });
  };

  const create = async () => {
    if (!form.flag.trim()) return;
    setCreating(true);
    setMessage(null);
    try {
      const row = {
        flag: form.flag.trim(),
        agency_id: form.agency_id || null,
        enabled: false,
        description: form.description.trim() || null,
      };
      const { error } = await supabase.from('feature_flags').insert(row);
      if (error) throw error;
      await audit('feature_flag_created', row);
      setForm({ flag: '', agency_id: '', description: '' });
      setMessage({ kind: 'success', text: 'Feature flag créé.' });
      onReload();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Création impossible' });
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (flag: AdminFeatureFlag & { key: string; enabled: boolean }) => {
    setBusyId(flag.id);
    setMessage(null);
    try {
      const nextEnabled = !flag.enabled;
      const { error } = await supabase
        .from('feature_flags')
        .update({ enabled: nextEnabled, updated_at: new Date().toISOString() })
        .eq('id', flag.id);
      if (error) throw error;
      await audit('feature_flag_toggled', { flag: flag.key, enabled: nextEnabled, agency_id: flag.agency_id ?? null });
      setMessage({ kind: 'success', text: `${flag.key} ${nextEnabled ? 'activé' : 'désactivé'}.` });
      onReload();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Mise à jour impossible' });
    } finally {
      setBusyId(null);
    }
  };

  const requestRemove = (flag: AdminFeatureFlag & { key: string; name: string }) => {
    setDeleteTarget(flag);
    setDeleteReason('');
    setDeleteConfirmation('');
    setMessage(null);
  };

  const confirmRemove = async () => {
    if (!deleteTarget) return;
    const flag = deleteTarget;
    setBusyId(flag.id);
    setMessage(null);
    try {
      const { error } = await supabase.from('feature_flags').delete().eq('id', flag.id);
      if (error) throw error;
      await audit('feature_flag_deleted', { flag: flag.key, agency_id: flag.agency_id ?? null, reason: deleteReason.trim() });
      setMessage({ kind: 'success', text: `${flag.key} supprimé.` });
      setDeleteTarget(null);
      setDeleteReason('');
      setDeleteConfirmation('');
      onReload();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Suppression impossible' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
        <input
          value={form.flag}
          onChange={(event) => setForm((current) => ({ ...current, flag: event.target.value }))}
          placeholder="module_mobile_money, new_pdf_engine..."
          className="rounded-2xl border border-white/10 bg-black/24 px-4 py-3 font-mono text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-orange-300/40"
        />
        <select
          value={form.agency_id}
          onChange={(event) => setForm((current) => ({ ...current, agency_id: event.target.value }))}
          className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white"
        >
          <option value="">Global</option>
          {agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}
        </select>
        <button
          type="button"
          onClick={create}
          disabled={creating || !form.flag.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-300/20 bg-orange-300/12 px-4 py-3 text-sm font-black text-orange-100 hover:bg-orange-300/18 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Créer
        </button>
      </div>
      <input
        value={form.description}
        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
        placeholder="Description, impact et raison du flag"
        className="w-full rounded-2xl border border-white/10 bg-black/18 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-orange-300/40"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-slate-500" />
        {[
          ['all', 'Tous'],
          ['global', 'Global'],
          ...agencies.slice(0, 8).map((agency) => [agency.id, agency.name] as [string, string]),
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            onClick={() => setFilterAgency(id)}
            className={classNames(
              'rounded-full border px-3 py-1.5 text-xs font-black',
              filterAgency === id ? 'border-emerald-300/30 bg-emerald-300/12 text-white' : 'border-white/10 bg-white/6 text-slate-400'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <p className={classNames('rounded-2xl border px-4 py-3 text-sm font-bold', message.kind === 'success' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-red-300/20 bg-red-400/10 text-red-100')}>
          {message.text}
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyPanel title="Aucun feature flag" text="Créez un flag global ou ciblé. La table legacy feature_flags reste compatible avec l'app, et samay_admin.feature_flags prendra le relais après migration." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((flag) => (
            <div key={flag.id} className="rounded-2xl border border-white/10 bg-black/18 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-black text-orange-200">{flag.key}</p>
                  <p className="mt-1 font-black text-white">{flag.name}</p>
                </div>
                <Badge tone={flag.enabled ? 'active' : 'cancelled'}>{flag.enabled ? 'Actif' : 'Inactif'}</Badge>
              </div>
              {flag.description && <p className="mt-3 text-sm leading-6 text-slate-400">{flag.description}</p>}
              <div className="mt-4 text-xs font-bold text-slate-500">
                Cible : {flag.agency_id ? agencies.find((agency) => agency.id === flag.agency_id)?.name ?? flag.agency_id : 'Toutes les organisations'}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void toggle(flag)}
                  disabled={busyId === flag.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 disabled:opacity-50"
                >
                  {busyId === flag.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {flag.enabled ? 'Désactiver' : 'Activer'}
                </button>
                <button
                  type="button"
                  onClick={() => requestRemove(flag)}
                  disabled={busyId === flag.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs font-black text-red-100 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Annuler la suppression du feature flag"
            className="absolute inset-0 bg-black/72 backdrop-blur-sm"
            onClick={busyId ? undefined : () => setDeleteTarget(null)}
          />
          <section className="relative w-full max-w-lg rounded-3xl border border-red-300/20 bg-[#07100d] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
            <div className="mb-3 inline-flex rounded-full border border-red-300/30 bg-red-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-red-100">
              Suppression auditée
            </div>
            <h3 className="text-xl font-black text-white">Supprimer le feature flag ?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Cette action retire le flag <span className="font-mono font-black text-orange-100">{deleteTarget.key}</span>. Tapez la clé exacte et ajoutez une raison exploitable.
            </p>
            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Clé exacte</span>
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder={deleteTarget.key}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/24 px-4 py-3 font-mono text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-red-300/40"
              />
            </label>
            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Raison obligatoire</span>
              <textarea
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                rows={3}
                placeholder="Ex : flag expiré, doublon confirmé, rollout remplacé..."
                className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-red-300/40"
              />
            </label>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(busyId)} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-black text-slate-200 hover:bg-white/12 disabled:opacity-50">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirmRemove()}
                disabled={Boolean(busyId) || deleteConfirmation !== deleteTarget.key || deleteReason.trim().length < 8}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300/25 bg-red-500/14 px-4 py-3 text-sm font-black text-red-100 hover:bg-red-500/20 disabled:opacity-50"
              >
                {busyId === deleteTarget.id && <Loader2 className="h-4 w-4 animate-spin" />}
                Supprimer
              </button>
            </div>
          </section>
        </div>
      )}
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

function ConfigurationPanel({
  actorId,
  actorEmail,
}: {
  actorId?: string;
  actorEmail?: string | null;
}) {
  const [rows, setRows] = useState<SaasConfigRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('saas_config').select('*').order('key');
    if (!error && data) {
      const nextRows = data as SaasConfigRow[];
      setRows(nextRows);
      setEdits(Object.fromEntries(nextRows.map((row) => [row.key, JSON.stringify(row.value, null, 2)])));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (row: SaasConfigRow) => {
    setSavingKey(row.key);
    setMessage(null);
    try {
      const parsed = JSON.parse(edits[row.key] ?? 'null');
      const { error } = await supabase
        .from('saas_config')
        .update({ value: parsed, updated_at: new Date().toISOString(), updated_by: actorId ?? null })
        .eq('key', row.key);
      if (error) throw error;
      await supabase.from('owner_actions_log').insert({
        actor_id: actorId,
        actor_email: actorEmail,
        action: 'saas_config_updated',
        target_type: 'saas_config',
        target_label: row.key,
        details: { key: row.key, value: parsed },
      });
      setMessage({ kind: 'success', text: `${row.key} enregistré.` });
      await load();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'JSON invalide ou sauvegarde impossible' });
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm font-bold text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Chargement configuration...</div>;
  }

  if (rows.length === 0) {
    return <EmptyPanel title="Configuration non initialisée" text="La table saas_config sera disponible après application des migrations owner. La console reste utilisable avec les données live." />;
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className={classNames('rounded-2xl border px-4 py-3 text-sm font-bold', message.kind === 'success' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-red-300/20 bg-red-400/10 text-red-100')}>
          {message.text}
        </p>
      )}
      {rows.map((row) => (
        <div key={row.key} className="rounded-2xl border border-white/10 bg-black/18 p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm font-black text-orange-200">{row.key}</p>
              {row.description && <p className="mt-1 text-sm font-semibold text-slate-400">{row.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => void save(row)}
              disabled={savingKey === row.key}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 disabled:opacity-50"
            >
              {savingKey === row.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              Enregistrer
            </button>
          </div>
          <textarea
            value={edits[row.key] ?? ''}
            onChange={(event) => setEdits((current) => ({ ...current, [row.key]: event.target.value }))}
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 font-mono text-xs font-semibold text-slate-100 outline-none focus:border-orange-300/40"
          />
        </div>
      ))}
    </div>
  );
}

function CommunicationPanel({
  agencies,
  actorId,
  actorEmail,
  onSent,
}: {
  agencies: AgencyStat[];
  actorId?: string;
  actorEmail?: string | null;
  onSent: () => void;
}) {
  const [target, setTarget] = useState('all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      let query = supabase.from('user_profiles').select('id, agency_id').eq('actif', true);
      if (target !== 'all') query = query.eq('agency_id', target);
      const { data: recipients, error: recipientsError } = await query;
      if (recipientsError) throw recipientsError;
      const rows = (recipients ?? [])
        .filter((recipient) => recipient.agency_id)
        .map((recipient) => ({
          user_id: recipient.id,
          agency_id: recipient.agency_id,
          type: 'admin_announcement',
          title: title.trim(),
          message: message.trim() || null,
          read: false,
        }));
      if (rows.length === 0) {
        setFeedback({ kind: 'error', text: 'Aucun utilisateur actif trouvé pour cette cible.' });
        return;
      }
      const { error } = await supabase.from('notifications').insert(rows);
      if (error) throw error;
      await supabase.from('owner_actions_log').insert({
        actor_id: actorId,
        actor_email: actorEmail,
        action: 'admin_broadcast_sent',
        target_type: target === 'all' ? 'platform' : 'agency',
        target_id: target === 'all' ? null : target,
        target_label: target === 'all' ? 'Toutes les organisations' : agencies.find((agency) => agency.id === target)?.name ?? target,
        details: { recipients: rows.length, title: title.trim() },
      });
      setTitle('');
      setMessage('');
      setFeedback({ kind: 'success', text: `Message envoyé à ${rows.length} utilisateur${rows.length > 1 ? 's' : ''}.` });
      onSent();
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'Envoi impossible' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
      <form onSubmit={send} className="space-y-4 rounded-2xl border border-white/10 bg-black/18 p-5">
        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
          <select
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white"
          >
            <option value="all">Toutes les organisations</option>
            {agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}
          </select>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Titre de l'annonce ou du message support"
            className="rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-orange-300/40"
          />
        </div>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          placeholder="Message visible dans le centre de notifications client"
          className="w-full rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-orange-300/40"
        />
        {feedback && (
          <p className={classNames('rounded-xl border px-3 py-2 text-sm font-bold', feedback.kind === 'success' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-red-300/20 bg-red-400/10 text-red-100')}>
            {feedback.text}
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending || !title.trim()}
            className="inline-flex items-center gap-2 rounded-2xl border border-orange-300/20 bg-orange-300/12 px-4 py-3 text-sm font-black text-orange-100 hover:bg-orange-300/18 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Envoyer
          </button>
        </div>
      </form>
      <div className="grid gap-4">
        {[
          ['Digest quotidien', 'Nouveaux comptes, tickets, incidents, quotas et paiements SaaS en retard.'],
          ['Annonces ciblées', 'Tous, plan, type de compte, organisation, rôle ou beta group.'],
          ['Seuils intelligents', 'Alerter seulement si un signal dépasse un seuil opérationnel utile.'],
        ].map(([cardTitle, text]) => (
          <div key={cardTitle} className="rounded-2xl border border-white/10 bg-black/18 p-5">
            <p className="font-black text-white">{cardTitle}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
