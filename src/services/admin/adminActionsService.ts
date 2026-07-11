import { supabase } from '../../lib/supabase';
import { writeAdminAudit, type AdminAuditPayload } from './adminAuditService';
import type { AdminAgency, AdminFeatureFlag, AdminSubscription, AdminUser, SubscriptionPaymentProof } from './adminConsoleService';

type AuditContext = Pick<AdminAuditPayload, 'actorId' | 'actorEmail'>;

async function auditedAction(payload: AdminAuditPayload, mutation: () => Promise<void>) {
  await writeAdminAudit(payload);
  await mutation();
}

export async function changeAgencyStatus(
  agency: AdminAgency,
  nextStatus: 'active' | 'suspended',
  reason: string,
  context: AuditContext,
) {
  await auditedAction({
    ...context,
    action: 'agency_status_changed',
    reason,
    targetOrganizationId: agency.id,
    targetType: 'agency',
    targetLabel: agency.name,
    metadata: { previous_status: agency.status, next_status: nextStatus },
  }, async () => {
    const { error } = await supabase.from('agencies').update({ status: nextStatus }).eq('id', agency.id);
    if (error) throw error;
  });
}

export async function changeAgencyPlan(
  agency: AdminAgency,
  subscription: AdminSubscription | undefined,
  nextPlan: string,
  reason: string,
  context: AuditContext,
) {
  await auditedAction({
    ...context,
    action: 'agency_plan_changed',
    reason,
    targetOrganizationId: agency.id,
    targetType: 'agency',
    targetLabel: agency.name,
    metadata: { previous_plan: agency.plan ?? subscription?.plan_id, next_plan: nextPlan, subscription_id: subscription?.id ?? null },
  }, async () => {
    const agencyUpdate = await supabase.from('agencies').update({ plan: nextPlan }).eq('id', agency.id);
    if (agencyUpdate.error) throw agencyUpdate.error;
    if (subscription?.id) {
      const subUpdate = await supabase.from('subscriptions').update({ plan_id: nextPlan }).eq('id', subscription.id);
      if (subUpdate.error) throw subUpdate.error;
    }
  });
}

export async function extendAgencyTrial(
  agency: AdminAgency,
  days: number,
  reason: string,
  context: AuditContext,
) {
  const nextDate = new Date(Date.now() + days * 86_400_000).toISOString();
  await auditedAction({
    ...context,
    action: 'agency_trial_extended',
    reason,
    targetOrganizationId: agency.id,
    targetType: 'agency',
    targetLabel: agency.name,
    metadata: { days, trial_ends_at: nextDate },
  }, async () => {
    const { error } = await supabase.from('agencies').update({ status: 'trial', trial_ends_at: nextDate }).eq('id', agency.id);
    if (error) throw error;
  });
}

export async function deleteAgencyCascade(
  agency: AdminAgency,
  reason: string,
  context: AuditContext,
) {
  await auditedAction({
    ...context,
    action: 'agency_deleted',
    reason,
    targetOrganizationId: agency.id,
    targetType: 'agency',
    targetLabel: agency.name,
    metadata: { confirmation: agency.name, rpc: 'delete_agency_cascade' },
  }, async () => {
    const { error } = await supabase.rpc('delete_agency_cascade', { p_agency_id: agency.id });
    if (error) throw error;
  });
}

export async function approvePaymentProof(
  proof: SubscriptionPaymentProof,
  reason: string,
  context: AuditContext,
) {
  await auditedAction({
    ...context,
    action: 'payment_proof_approved',
    reason,
    targetOrganizationId: proof.agency_id,
    targetType: 'subscription_payment_proof',
    targetLabel: proof.reference ?? proof.id,
    metadata: { proof_id: proof.id, amount: proof.amount, plan_key: proof.plan_key, method: proof.method },
  }, async () => {
    const now = new Date().toISOString();
    const proofUpdate = await supabase
      .from('subscription_payment_proofs')
      .update({ status: 'approved', reviewed_at: now, reviewed_by: context.actorId ?? null, rejection_reason: null })
      .eq('id', proof.id);
    if (proofUpdate.error) throw proofUpdate.error;

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const existingSub = await supabase
      .from('subscriptions')
      .select('id')
      .eq('agency_id', proof.agency_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingSub.error) throw existingSub.error;

    if (existingSub.data?.id) {
      const subUpdate = await supabase
        .from('subscriptions')
        .update({
          plan_id: proof.plan_key,
          status: 'active',
          current_period_start: now,
          current_period_end: periodEnd.toISOString(),
        })
        .eq('id', existingSub.data.id);
      if (subUpdate.error) throw subUpdate.error;
    } else {
      const subInsert = await supabase.from('subscriptions').insert({
        agency_id: proof.agency_id,
        plan_id: proof.plan_key,
        status: 'active',
        current_period_start: now,
        current_period_end: periodEnd.toISOString(),
      });
      if (subInsert.error) throw subInsert.error;
    }

    const agencyUpdate = await supabase.from('agencies').update({ plan: proof.plan_key, status: 'active' }).eq('id', proof.agency_id);
    if (agencyUpdate.error) throw agencyUpdate.error;
  });
}

export async function rejectPaymentProof(
  proof: SubscriptionPaymentProof,
  reason: string,
  context: AuditContext,
) {
  await auditedAction({
    ...context,
    action: 'payment_proof_rejected',
    reason,
    targetOrganizationId: proof.agency_id,
    targetType: 'subscription_payment_proof',
    targetLabel: proof.reference ?? proof.id,
    metadata: { proof_id: proof.id, amount: proof.amount, plan_key: proof.plan_key, method: proof.method },
  }, async () => {
    const { error } = await supabase
      .from('subscription_payment_proofs')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.actorId ?? null,
        rejection_reason: reason,
      })
      .eq('id', proof.id);
    if (error) throw error;
  });
}

export async function approveAgencyRequest(requestId: string, reason: string, context: AuditContext) {
  await auditedAction({
    ...context,
    action: 'agency_request_approved',
    reason,
    targetType: 'agency_creation_request',
    targetLabel: requestId,
    metadata: { request_id: requestId },
  }, async () => {
    const { error } = await supabase.rpc('approve_agency_request', { p_request_id: requestId });
    if (error) throw error;
  });
}

export async function rejectAgencyRequest(requestId: string, reason: string, context: AuditContext) {
  await auditedAction({
    ...context,
    action: 'agency_request_rejected',
    reason,
    targetType: 'agency_creation_request',
    targetLabel: requestId,
    metadata: { request_id: requestId },
  }, async () => {
    const { error } = await supabase.rpc('reject_agency_request', { p_request_id: requestId, p_reason: reason });
    if (error) throw error;
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
  await auditedAction({
    ...context,
    action: 'user_status_changed',
    reason,
    targetOrganizationId: user.agency_id ?? null,
    targetUserId: user.id,
    targetType: 'user_profile',
    targetLabel: user.email ?? user.id,
    metadata: { previous_active: user.actif !== false, next_active: nextActive, role: user.role },
  }, async () => {
    const { error } = await supabase.from('user_profiles').update({ actif: nextActive }).eq('id', user.id);
    if (error) throw error;
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
  await auditedAction({
    ...context,
    action: 'user_role_changed',
    reason,
    targetOrganizationId: user.agency_id ?? null,
    targetUserId: user.id,
    targetType: 'user_profile',
    targetLabel: user.email ?? user.id,
    metadata: { previous_role: user.role, next_role: nextRole },
  }, async () => {
    const { error } = await supabase.from('user_profiles').update({ role: nextRole }).eq('id', user.id);
    if (error) throw error;
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
  if (!key) throw new Error("Ce feature flag n'a pas de clé exploitable.");

  await auditedAction({
    ...context,
    action: 'feature_flag_toggled',
    reason,
    targetType: 'feature_flag',
    targetLabel: key,
    metadata: { flag_id: flag.id, key, previous_status: flag.status, next_status: nextActive ? 'active' : 'draft' },
  }, async () => {
    const rpc = await supabase.rpc('admin_upsert_feature_flag', {
      p_key: key,
      p_name: flag.name ?? key,
      p_description: flag.description ?? null,
      p_status: nextActive ? 'active' : 'draft',
      p_owner: flag.owner ?? null,
      p_expires_at: flag.expires_at ?? null,
    });
    if (rpc.error) throw rpc.error;
  });
}
