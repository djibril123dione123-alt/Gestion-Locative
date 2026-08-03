import type { UserPagePermission } from '../lib/rbac';
import { supabase } from '../lib/supabase';

type InvitationRole = 'admin' | 'agent' | 'comptable';

export interface TeamInvitationResult {
  id: string;
  email: string;
  role: InvitationRole;
  token: string;
  expires_at: string;
}

export interface SubscriptionPaymentProofCommand {
  subscriptionId?: string | null;
  planKey: string;
  amount: number;
  method: string;
  reference?: string | null;
  paymentDate: string;
  proofFileUrl?: string | null;
  comment?: string | null;
}

function commandKey(command: string, target: string): string {
  const nonce = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${command}:${target}:${nonce}`;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La commande serveur a renvoyé une réponse invalide.');
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('La commande serveur a renvoyé une réponse incomplète.');
  }
  return value;
}

export async function createTeamInvitation(input: {
  email: string;
  role: InvitationRole;
  message?: string | null;
  daysValid?: number;
}): Promise<TeamInvitationResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const { data, error } = await supabase.rpc('tenant_create_invitation', {
    p_email: normalizedEmail,
    p_role: input.role,
    p_message: input.message?.trim() || null,
    p_days_valid: input.daysValid ?? 7,
    p_idempotency_key: commandKey('team-invitation', normalizedEmail),
  });
  if (error) throw error;

  const result = asObject(data);
  const role = requiredString(result, 'role');
  if (role !== 'admin' && role !== 'agent' && role !== 'comptable') {
    throw new Error("Le rôle renvoyé pour l'invitation est invalide.");
  }
  return {
    id: requiredString(result, 'id'),
    email: requiredString(result, 'email'),
    role,
    token: requiredString(result, 'token'),
    expires_at: requiredString(result, 'expires_at'),
  };
}

export async function replaceMemberPermissions(
  targetUserId: string,
  permissions: UserPagePermission[],
): Promise<UserPagePermission[]> {
  const { data, error } = await supabase.rpc('tenant_replace_user_page_permissions', {
    p_target_user_id: targetUserId,
    p_permissions: permissions,
    p_idempotency_key: commandKey('team-permissions', targetUserId),
  });
  if (error) throw error;

  const result = asObject(data);
  const rows = result.permissions;
  if (!Array.isArray(rows)) {
    throw new Error('Les permissions enregistrées sont absentes de la réponse serveur.');
  }
  return rows as UserPagePermission[];
}

export async function deactivateTeamMember(targetUserId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('tenant_deactivate_member', {
    p_target_user_id: targetUserId,
    p_reason: reason.trim(),
    p_idempotency_key: commandKey('team-deactivation', targetUserId),
  });
  if (error) throw error;
}

export async function submitSubscriptionPaymentProof(
  input: SubscriptionPaymentProofCommand,
): Promise<{ id: string; status: string; created_at: string }> {
  const { data, error } = await supabase.rpc('tenant_submit_subscription_payment_proof', {
    p_subscription_id: input.subscriptionId ?? null,
    p_plan_key: input.planKey,
    p_amount: input.amount,
    p_method: input.method,
    p_reference: input.reference?.trim() || null,
    p_payment_date: input.paymentDate,
    p_proof_file_url: input.proofFileUrl?.trim() || null,
    p_comment: input.comment?.trim() || null,
    p_idempotency_key: commandKey('subscription-proof', `${input.planKey}:${input.paymentDate}`),
  });
  if (error) throw error;

  const result = asObject(data);
  return {
    id: requiredString(result, 'id'),
    status: requiredString(result, 'status'),
    created_at: requiredString(result, 'created_at'),
  };
}
