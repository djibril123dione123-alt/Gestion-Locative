import { supabase } from '../../lib/supabase';

export interface AdminAuditPayload {
  action: string;
  reason: string;
  targetOrganizationId?: string | null;
  targetUserId?: string | null;
  targetType?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
  actorEmail?: string | null;
}

export async function writeAdminAudit(payload: AdminAuditPayload) {
  const reason = payload.reason.trim();
  if (reason.length < 8) {
    throw new Error('Une raison exploitable est obligatoire pour cette action.');
  }

  const metadata = {
    ...(payload.metadata ?? {}),
    target_type: payload.targetType ?? null,
    target_label: payload.targetLabel ?? null,
    actor_id: payload.actorId ?? null,
    actor_email: payload.actorEmail ?? null,
  };

  const rpc = await supabase.rpc('admin_audit_action', {
    p_action: payload.action,
    p_reason: reason,
    p_target_organization_id: payload.targetOrganizationId ?? null,
    p_target_user_id: payload.targetUserId ?? null,
    p_metadata: metadata,
  });

  if (rpc.error) {
    throw new Error("Audit impossible. L'action a été bloquée pour préserver la traçabilité.");
  }

  return { id: rpc.data as string | null, source: 'admin_audit_action' as const };
}

export function humanizeAuditAction(action: string) {
  const labels: Record<string, string> = {
    agency_status_changed: 'Statut organisation modifié',
    agency_plan_changed: 'Plan organisation modifié',
    agency_trial_extended: 'Essai prolongé',
    agency_deleted: 'Organisation supprimée',
    payment_proof_approved: 'Preuve paiement validée',
    payment_proof_rejected: 'Preuve paiement rejetée',
    feature_flag_toggled: 'Fonctionnalité pilotée modifiée',
    admin_feature_flag_upserted: 'Fonctionnalité pilotée enregistrée',
    saas_config_updated: 'Configuration SaaS modifiée',
    agency_request_approved: 'Demande agence approuvée',
    agency_request_rejected: 'Demande agence rejetée',
    user_status_changed: 'Statut utilisateur modifié',
    user_role_changed: 'Rôle utilisateur modifié',
    organization_suspended: 'Organisation suspendue',
    'organization suspended': 'Organisation suspendue',
  };
  const normalized = action.trim().toLowerCase();
  return labels[action] ?? labels[normalized] ?? normalized.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
