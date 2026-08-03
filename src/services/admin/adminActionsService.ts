import { supabase } from '../../lib/supabase';
import type { AdminAgency, AdminFeatureFlag, AdminSubscription, AdminUser, SubscriptionPaymentProof } from './adminConsoleService';
import { writeAdminAudit } from './adminAuditService';

type AuditContext = {
  actorId?: string | null;
  actorEmail?: string | null;
  idempotencyKey?: string;
};

function commandKey(context: AuditContext, command: string, targetId: string) {
  if (context.idempotencyKey) return context.idempotencyKey;
  const nonce = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${command}:${targetId}:${nonce}`;
}

async function runAdminCommand(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

async function recordContextualAudit(input: {
  action: string;
  reason: string;
  context: AuditContext;
  targetOrganizationId?: string | null;
  targetUserId?: string | null;
  targetType: string;
  targetLabel?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return writeAdminAudit({
    action: input.action,
    reason: input.reason,
    targetOrganizationId: input.targetOrganizationId,
    targetUserId: input.targetUserId,
    targetType: input.targetType,
    targetLabel: input.targetLabel,
    actorId: input.context.actorId,
    actorEmail: input.context.actorEmail,
    metadata: {
      ...(input.metadata ?? {}),
      idempotency_key: input.context.idempotencyKey ?? null,
    },
  });
}

export async function changeAgencyStatus(
  agency: AdminAgency,
  nextStatus: 'active' | 'suspended',
  reason: string,
  context: AuditContext,
) {
  await runAdminCommand('admin_change_agency_status', {
    p_agency_id: agency.id,
    p_next_status: nextStatus,
    p_reason: reason,
    p_idempotency_key: commandKey(context, 'agency-status', agency.id),
  });
}

export async function changeAgencyPlan(
  agency: AdminAgency,
  subscription: AdminSubscription | undefined,
  nextPlan: string,
  reason: string,
  context: AuditContext,
) {
  void subscription;
  await runAdminCommand('admin_change_agency_plan', {
    p_agency_id: agency.id,
    p_next_plan: nextPlan,
    p_reason: reason,
    p_idempotency_key: commandKey(context, 'agency-plan', agency.id),
  });
}

export async function extendAgencyTrial(
  agency: AdminAgency,
  days: number,
  reason: string,
  context: AuditContext,
) {
  await runAdminCommand('admin_extend_agency_trial', {
    p_agency_id: agency.id,
    p_days: days,
    p_reason: reason,
    p_idempotency_key: commandKey(context, 'agency-trial', agency.id),
  });
}

export async function closeAgencyAccount(
  agency: Pick<AdminAgency, 'id'>,
  reason: string,
  context: AuditContext,
) {
  const { data, error } = await supabase.functions.invoke('close-agency-account', {
    body: {
      agencyId: agency.id,
      reason,
      idempotencyKey: commandKey(context, 'agency-closure', agency.id),
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.data;
}

export async function approvePaymentProof(
  proof: SubscriptionPaymentProof,
  reason: string,
  context: AuditContext,
) {
  await runAdminCommand('admin_review_subscription_payment_proof', {
    p_proof_id: proof.id,
    p_decision: 'approved',
    p_reason: reason,
    p_idempotency_key: commandKey(context, 'proof-approve', proof.id),
  });
}

export async function rejectPaymentProof(
  proof: SubscriptionPaymentProof,
  reason: string,
  context: AuditContext,
) {
  await runAdminCommand('admin_review_subscription_payment_proof', {
    p_proof_id: proof.id,
    p_decision: 'rejected',
    p_reason: reason,
    p_idempotency_key: commandKey(context, 'proof-reject', proof.id),
  });
}

export async function approveAgencyRequest(requestId: string, reason: string, context: AuditContext) {
  await runAdminCommand('admin_review_agency_request', {
    p_request_id: requestId,
    p_decision: 'approved',
    p_reason: reason,
    p_idempotency_key: commandKey(context, 'agency-request-approve', requestId),
  });
}

export async function rejectAgencyRequest(requestId: string, reason: string, context: AuditContext) {
  await runAdminCommand('admin_review_agency_request', {
    p_request_id: requestId,
    p_decision: 'rejected',
    p_reason: reason,
    p_idempotency_key: commandKey(context, 'agency-request-reject', requestId),
  });
}

export async function createAdminNote(
  organizationId: string,
  note: string,
  visibility: 'internal' | 'support' | 'commercial' | 'security',
  reason: string,
  context: AuditContext,
) {
  const { data, error } = await supabase.rpc('admin_create_admin_note', {
    p_organization_id: organizationId,
    p_note: note,
    p_visibility: visibility,
  });
  if (error) throw error;
  await recordContextualAudit({
    action: 'admin_note_created',
    reason,
    context,
    targetOrganizationId: organizationId,
    targetType: 'admin_note',
    targetLabel: String(data ?? 'note'),
    metadata: { visibility },
  });
}

export async function createSupportTicket(
  organizationId: string,
  subject: string,
  category: string,
  priority: string,
  description: string,
  reason: string,
  context: AuditContext,
) {
  const { data, error } = await supabase.rpc('admin_create_support_ticket', {
    p_organization_id: organizationId,
    p_subject: subject,
    p_category: category,
    p_priority: priority,
    p_description: description || null,
  });
  if (error) throw error;
  await recordContextualAudit({
    action: 'support_ticket_created',
    reason,
    context,
    targetOrganizationId: organizationId,
    targetType: 'support_ticket',
    targetLabel: subject,
    metadata: { ticket_id: data ?? null, category, priority },
  });
}

export async function updateSupportTicket(
  ticketId: string,
  status: string,
  internalNotes: string,
  reason: string,
  context: AuditContext,
) {
  const { error } = await supabase.rpc('admin_update_support_ticket', {
    p_ticket_id: ticketId,
    p_status: status,
    p_internal_notes: internalNotes || null,
  });
  if (error) throw error;
  await recordContextualAudit({
    action: 'support_ticket_updated',
    reason,
    context,
    targetType: 'support_ticket',
    targetLabel: ticketId,
    metadata: { ticket_id: ticketId, status },
  });
}

export async function recordIncident(
  type: string,
  severity: string,
  message: string,
  organizationId: string | null,
  reason: string,
  context: AuditContext,
) {
  const { data, error } = await supabase.rpc('admin_record_incident', {
    p_type: type,
    p_severity: severity,
    p_message: message,
    p_organization_id: organizationId,
    p_metadata: {},
  });
  if (error) throw error;
  await recordContextualAudit({
    action: 'incident_recorded',
    reason,
    context,
    targetOrganizationId: organizationId,
    targetType: 'incident',
    targetLabel: type,
    metadata: { incident_id: data ?? null, severity },
  });
}

export async function resolveIncident(
  incidentId: string,
  resolution: string,
  reason: string,
  context: AuditContext,
) {
  const { error } = await supabase.rpc('admin_resolve_incident', {
    p_incident_id: incidentId,
    p_resolution: resolution,
  });
  if (error) throw error;
  await recordContextualAudit({
    action: 'incident_resolved',
    reason,
    context,
    targetType: 'incident',
    targetLabel: incidentId,
    metadata: { incident_id: incidentId, resolution },
  });
}

export async function createMaintenanceAnnouncement(
  title: string,
  message: string,
  status: string,
  reason: string,
  context: AuditContext,
) {
  const { data, error } = await supabase.rpc('admin_create_maintenance_announcement', {
    p_title: title,
    p_message: message,
    p_status: status,
    p_target: { type: 'all' },
    p_starts_at: null,
    p_ends_at: null,
  });
  if (error) throw error;
  await recordContextualAudit({
    action: 'maintenance_announcement_created',
    reason,
    context,
    targetType: 'maintenance_announcement',
    targetLabel: title,
    metadata: { announcement_id: data ?? null, status },
  });
}

function assertUserCanBeChanged(user: AdminUser, users: AdminUser[], nextRole?: string, nextActive?: boolean) {
  if (user.role === 'super_admin') {
    throw new Error('Un compte super-admin ne peut pas être modifié depuis cette action.');
  }

  const isRemovingAdmin = user.role === 'admin' && ((nextRole != null && nextRole !== 'admin') || nextActive === false);
  if (!isRemovingAdmin || !user.agency_id) return;

  const activeAdminsInAgency = users.filter((candidate) =>
    candidate.agency_id === user.agency_id
    && candidate.role === 'admin'
    && candidate.actif !== false
    && candidate.id !== user.id
  ).length;

  if (activeAdminsInAgency === 0) {
    throw new Error('Action bloquée : cette organisation doit conserver au moins un administrateur actif.');
  }
}

export async function changeUserStatus(
  user: AdminUser,
  users: AdminUser[],
  nextActive: boolean,
  reason: string,
  context: AuditContext,
) {
  assertUserCanBeChanged(user, users, undefined, nextActive);
  await runAdminCommand('admin_update_user_access', {
    p_target_user_id: user.id,
    p_next_role: null,
    p_next_active: nextActive,
    p_next_agency_id: null,
    p_change_agency: false,
    p_reason: reason,
    p_idempotency_key: commandKey(context, 'user-status', user.id),
  });
}

export async function changeUserRole(
  user: AdminUser,
  users: AdminUser[],
  nextRole: 'admin' | 'agent' | 'comptable' | 'bailleur',
  reason: string,
  context: AuditContext,
) {
  assertUserCanBeChanged(user, users, nextRole, undefined);
  await runAdminCommand('admin_update_user_access', {
    p_target_user_id: user.id,
    p_next_role: nextRole,
    p_next_active: null,
    p_next_agency_id: null,
    p_change_agency: false,
    p_reason: reason,
    p_idempotency_key: commandKey(context, 'user-role', user.id),
  });
}

function featureFlagKey(flag: AdminFeatureFlag) {
  return flag.key ?? flag.flag ?? flag.flag_name ?? '';
}

export async function toggleFeatureFlag(
  flag: AdminFeatureFlag,
  nextActive: boolean,
  reason: string,
  context: AuditContext,
) {
  const key = featureFlagKey(flag);
  if (!key) throw new Error("Ce paramètre de fonctionnalité n'a pas de clé exploitable.");

  const rpc = await supabase.rpc('admin_upsert_feature_flag', {
    p_key: key,
    p_name: flag.name ?? key,
    p_description: flag.description ?? null,
    p_status: nextActive ? 'active' : 'draft',
    p_owner: flag.owner ?? null,
    p_expires_at: flag.expires_at ?? null,
  });
  if (rpc.error) throw rpc.error;
  await recordContextualAudit({
    action: 'feature_flag_toggled',
    reason,
    context,
    targetType: 'feature_flag',
    targetLabel: key,
    metadata: { active: nextActive },
  });
}
