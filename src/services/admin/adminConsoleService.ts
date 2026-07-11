import { supabase } from '../../lib/supabase';
import { getAdminPlanPrice, normalizeAdminPlanId } from '../../lib/admin/adminPricingCatalog';
import { numberValue } from '../../lib/admin/adminFormatters';

export interface AdminAgency {
  id: string;
  name: string;
  status: string | null;
  plan: string | null;
  organization_type?: string | null;
  is_bailleur_account?: boolean | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  trial_ends_at?: string | null;
  derniere_activite?: string | null;
  nb_users?: number | null;
  nb_unites?: number | null;
  nb_contrats?: number | null;
  nb_paiements?: number | null;
  nb_bailleurs?: number | null;
  volume_paiements?: number | null;
  total_documents?: number | null;
}

export interface AdminUser {
  id: string;
  email: string | null;
  nom?: string | null;
  prenom?: string | null;
  role: string | null;
  actif?: boolean | null;
  agency_id?: string | null;
  agency_name?: string | null;
  created_at?: string | null;
}

export interface AdminSubscription {
  id: string;
  agency_id: string | null;
  agency_name?: string | null;
  plan_id: string | null;
  status: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  created_at?: string | null;
}

export interface SubscriptionPaymentProof {
  id: string;
  agency_id: string;
  subscription_id?: string | null;
  plan_key: string;
  amount: number | string;
  currency?: string | null;
  method: string;
  reference?: string | null;
  payment_date?: string | null;
  proof_file_url?: string | null;
  proof_storage_path?: string | null;
  comment?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_by?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at?: string | null;
  agencies?: { name?: string | null; organization_type?: string | null; is_bailleur_account?: boolean | null } | null;
}

export interface AgencyCreationRequest {
  id: string;
  requester_id?: string | null;
  requester_email?: string | null;
  email?: string | null;
  organization_name?: string | null;
  agency_name?: string | null;
  phone?: string | null;
  requested_plan?: string | null;
  plan?: string | null;
  organization_type?: string | null;
  is_bailleur_account?: boolean | null;
  status: string;
  reason?: string | null;
  rejection_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AdminFeatureFlag {
  id: string;
  key?: string | null;
  flag?: string | null;
  flag_name?: string | null;
  name?: string | null;
  description?: string | null;
  enabled?: boolean | null;
  status?: string | null;
  agency_id?: string | null;
  owner?: string | null;
  expires_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  reason?: string | null;
  target_label?: string | null;
  target_type?: string | null;
  target_organization_id?: string | null;
  target_user_id?: string | null;
  metadata?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
  created_at?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
}

export interface AdminIncident {
  id: string;
  type: string;
  severity?: string | null;
  status?: string | null;
  message?: string | null;
  organization_id?: string | null;
  user_id?: string | null;
  occurrences?: number | null;
  resolution?: string | null;
  owner?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  last_seen_at?: string | null;
}

export interface AdminTicket {
  id: string;
  subject: string;
  status?: string | null;
  priority?: string | null;
  category?: string | null;
  organization_id?: string | null;
  user_id?: string | null;
  description?: string | null;
  internal_notes?: string | null;
  assigned_to?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
}

export interface SaasConfigRow {
  key: string;
  value: unknown;
  description?: string | null;
  updated_at?: string | null;
}

export interface AdminNote {
  id: string;
  organization_id?: string | null;
  author_user_id?: string | null;
  note: string;
  visibility?: string | null;
  created_at?: string | null;
}

export interface AdminNotification {
  id: string;
  severity?: string | null;
  title: string;
  message?: string | null;
  target_organization_id?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
}

export interface AdminSystemEvent {
  id: string;
  event_type: string;
  severity?: string | null;
  organization_id?: string | null;
  user_id?: string | null;
  message: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
}

export interface AdminOrganizationMetric {
  id: string;
  organization_id: string;
  metric_date?: string | null;
  active_users?: number | null;
  total_properties?: number | null;
  total_units?: number | null;
  total_contracts?: number | null;
  total_documents?: number | null;
  storage_used_mb?: number | string | null;
  payments_count?: number | null;
  payments_amount?: number | string | null;
  unpaid_amount?: number | string | null;
  last_activity_at?: string | null;
  health_score?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
}

export interface AdminDocumentRegistryEntry {
  id: string;
  agency_id?: string | null;
  document_type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  reference?: string | null;
  period?: string | null;
  status?: string | null;
  storage_path?: string | null;
  version?: number | null;
  generated_at?: string | null;
  created_at?: string | null;
  agencies?: { name?: string | null } | null;
}

export interface AdminDocumentVerification {
  id: string;
  agency_id?: string | null;
  document_type?: string | null;
  token?: string | null;
  status?: string | null;
  verification_count?: number | null;
  last_verified_at?: string | null;
  created_at?: string | null;
  document_registry_id?: string | null;
  agencies?: { name?: string | null } | null;
}

export interface AdminMaintenanceAnnouncement {
  id: string;
  title: string;
  message: string;
  status?: string | null;
  target?: Record<string, unknown> | null;
  starts_at?: string | null;
  ends_at?: string | null;
  created_by?: string | null;
  created_at?: string | null;
}

export interface AdminPlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  trialOrganizations: number;
  suspendedOrganizations: number;
  individualLandlords: number;
  totalUsers: number;
  activeUsers: number;
  totalDocuments: number;
  documentsThisMonth: number;
  estimatedMrr: number;
  openIncidents: number;
  openTickets: number;
  pendingProofs: number;
  pendingRequests: number;
}

export interface AdminConsoleData {
  generatedAt: string;
  partialErrors: string[];
  platform: AdminPlatformStats;
  agencies: AdminAgency[];
  users: AdminUser[];
  subscriptions: AdminSubscription[];
  proofs: SubscriptionPaymentProof[];
  requests: AgencyCreationRequest[];
  incidents: AdminIncident[];
  tickets: AdminTicket[];
  featureFlags: AdminFeatureFlag[];
  auditLogs: AdminAuditLog[];
  configRows: SaasConfigRow[];
  notes: AdminNote[];
  notifications: AdminNotification[];
  systemEvents: AdminSystemEvent[];
  organizationMetrics: AdminOrganizationMetric[];
  documentRegistry: AdminDocumentRegistryEntry[];
  documentVerifications: AdminDocumentVerification[];
  announcements: AdminMaintenanceAnnouncement[];
}

function readSnapshotPlatform(snapshot: Record<string, unknown> | null | undefined) {
  const platform = (snapshot?.platform ?? {}) as Record<string, unknown>;
  return {
    totalOrganizations: numberValue(platform.total_organizations),
    activeOrganizations: numberValue(platform.active_organizations),
    trialOrganizations: numberValue(platform.trial_organizations),
    suspendedOrganizations: numberValue(platform.suspended_organizations),
    individualLandlords: numberValue(platform.individual_landlords),
    totalUsers: numberValue(platform.total_users),
    activeUsers: numberValue(platform.active_users),
    totalDocuments: numberValue(platform.total_documents),
    documentsThisMonth: numberValue(platform.documents_this_month),
    estimatedMrr: numberValue(platform.estimated_mrr),
    openIncidents: numberValue(platform.open_incidents),
    openTickets: numberValue(platform.open_tickets),
  };
}

export async function loadAdminConsoleData(): Promise<AdminConsoleData> {
  const admin = supabase.schema('samay_admin');
  const results = await Promise.allSettled([
    supabase.rpc('admin_console_snapshot'),
    supabase.from('vw_owner_agency_stats').select('*').order('created_at', { ascending: false }),
    supabase.from('user_profiles').select('*, agencies(name)').order('created_at', { ascending: false }).limit(500),
    supabase.from('subscriptions').select('*, agencies(name)').order('created_at', { ascending: false }).limit(300),
    supabase.from('subscription_payment_proofs').select('*, agencies(name, organization_type, is_bailleur_account)').order('created_at', { ascending: false }).limit(200),
    supabase.from('agency_creation_requests').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('owner_actions_log').select('*').order('created_at', { ascending: false }).limit(120),
    supabase.from('feature_flags').select('*').order('updated_at', { ascending: false }).limit(120),
    supabase.from('saas_config').select('*').order('key'),
    admin.from('admin_notes').select('*').order('created_at', { ascending: false }).limit(200),
    admin.from('admin_notifications').select('*').order('created_at', { ascending: false }).limit(120),
    admin.from('system_events').select('*').order('created_at', { ascending: false }).limit(120),
    admin.from('organization_metrics').select('*').order('metric_date', { ascending: false }).limit(300),
    admin.from('maintenance_announcements').select('*').order('created_at', { ascending: false }).limit(80),
    supabase.from('document_registry').select('*, agencies(name)').order('created_at', { ascending: false }).limit(200),
    supabase.from('document_verifications').select('*, agencies(name)').order('created_at', { ascending: false }).limit(200),
  ]);

  const partialErrors: string[] = [];
  const unpack = <T,>(index: number, label: string, fallback: T): T => {
    const result = results[index];
    if (result.status === 'rejected') {
      partialErrors.push(`${label} indisponible`);
      return fallback;
    }
    const response = result.value as { data?: unknown; error?: { message?: string } | null };
    if (response.error) {
      partialErrors.push(`${label} indisponible`);
      return fallback;
    }
    return (response.data ?? fallback) as T;
  };

  const snapshot = unpack<Record<string, unknown> | null>(0, 'Snapshot plateforme', null);
  const agencies = unpack<AdminAgency[]>(1, 'Organisations', []);
  const usersRaw = unpack<Array<AdminUser & { agencies?: { name?: string | null } | null }>>(2, 'Utilisateurs', []);
  const subscriptionsRaw = unpack<Array<AdminSubscription & { agencies?: { name?: string | null } | null }>>(3, 'Abonnements', []);
  const proofs = unpack<SubscriptionPaymentProof[]>(4, 'Paiements manuels', []);
  const requests = unpack<AgencyCreationRequest[]>(5, 'Demandes', []);
  const legacyLogs = unpack<AdminAuditLog[]>(6, 'Audit historique', []);
  const legacyFlags = unpack<AdminFeatureFlag[]>(7, 'Feature flags', []);
  const configRows = unpack<SaasConfigRow[]>(8, 'Configuration SaaS', []);
  const notes = unpack<AdminNote[]>(9, 'Notes internes', []);
  const notifications = unpack<AdminNotification[]>(10, 'Notifications admin', []);
  const systemEvents = unpack<AdminSystemEvent[]>(11, 'Événements système', []);
  const organizationMetrics = unpack<AdminOrganizationMetric[]>(12, 'Métriques organisations', []);
  const announcements = unpack<AdminMaintenanceAnnouncement[]>(13, 'Annonces maintenance', []);
  const documentRegistry = unpack<AdminDocumentRegistryEntry[]>(14, 'Registry documents', []);
  const documentVerifications = unpack<AdminDocumentVerification[]>(15, 'QR Verify', []);

  const platformFromSnapshot = readSnapshotPlatform(snapshot);
  const auditLogs = ((snapshot?.audit_logs as AdminAuditLog[] | undefined) ?? legacyLogs).slice(0, 120);
  const featureFlags = ((snapshot?.feature_flags as AdminFeatureFlag[] | undefined) ?? legacyFlags).slice(0, 120);
  const incidents = ((snapshot?.incidents as AdminIncident[] | undefined) ?? []).slice(0, 40);
  const tickets = ((snapshot?.tickets as AdminTicket[] | undefined) ?? []).slice(0, 40);

  const users = usersRaw.map((user) => ({ ...user, agency_name: user.agency_name ?? user.agencies?.name ?? null }));
  const subscriptions = subscriptionsRaw.map((sub) => ({ ...sub, agency_name: sub.agency_name ?? sub.agencies?.name ?? null }));
  const estimatedMrr = agencies
    .filter((agency) => ['active', 'trial', null, undefined].includes(agency.status))
    .reduce((sum, agency) => sum + getAdminPlanPrice(normalizeAdminPlanId(agency.plan)), 0);

  return {
    generatedAt: new Date().toISOString(),
    partialErrors,
    agencies,
    users,
    subscriptions,
    proofs,
    requests,
    incidents,
    tickets,
    featureFlags,
    auditLogs,
    configRows,
    notes,
    notifications,
    systemEvents,
    organizationMetrics,
    documentRegistry,
    documentVerifications,
    announcements,
    platform: {
      totalOrganizations: platformFromSnapshot.totalOrganizations || agencies.length,
      activeOrganizations: platformFromSnapshot.activeOrganizations || agencies.filter((agency) => (agency.status ?? 'active') === 'active').length,
      trialOrganizations: platformFromSnapshot.trialOrganizations || agencies.filter((agency) => agency.status === 'trial').length,
      suspendedOrganizations: platformFromSnapshot.suspendedOrganizations || agencies.filter((agency) => agency.status === 'suspended').length,
      individualLandlords: platformFromSnapshot.individualLandlords || agencies.filter((agency) => agency.is_bailleur_account || agency.organization_type === 'individual_landlord').length,
      totalUsers: platformFromSnapshot.totalUsers || users.length,
      activeUsers: platformFromSnapshot.activeUsers || users.filter((user) => user.actif !== false).length,
      totalDocuments: platformFromSnapshot.totalDocuments,
      documentsThisMonth: platformFromSnapshot.documentsThisMonth,
      estimatedMrr: platformFromSnapshot.estimatedMrr || estimatedMrr,
      openIncidents: platformFromSnapshot.openIncidents || incidents.filter((incident) => !['resolved', 'closed'].includes(incident.status ?? '')).length,
      openTickets: platformFromSnapshot.openTickets || tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status ?? '')).length,
      pendingProofs: proofs.filter((proof) => proof.status === 'pending').length,
      pendingRequests: requests.filter((request) => request.status === 'pending').length,
    },
  };
}
