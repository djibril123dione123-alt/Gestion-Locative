import type { AdminAgency, AdminSubscription, SubscriptionPaymentProof } from '../../services/admin/adminConsoleService';

export type OrganizationHealthLevel = 'healthy' | 'watch' | 'risk' | 'critical';

export interface OrganizationHealth {
  level: OrganizationHealthLevel;
  label: string;
  score: number;
  reasons: string[];
}

export function computeOrganizationHealth(
  agency: AdminAgency,
  subscription?: AdminSubscription,
  proofs: SubscriptionPaymentProof[] = [],
): OrganizationHealth {
  const reasons: string[] = [];
  let score = 100;

  if (agency.status === 'suspended' || subscription?.status === 'cancelled') {
    score -= 45;
    reasons.push('Compte suspendu ou abonnement arrêté');
  }
  if (agency.status === 'trial' && agency.trial_ends_at) {
    const daysLeft = Math.ceil((new Date(agency.trial_ends_at).getTime() - Date.now()) / 86_400_000);
    if (daysLeft <= 5) {
      score -= 20;
      reasons.push('Essai proche expiration');
    }
  }
  if ((agency.nb_users ?? 0) === 0) {
    score -= 15;
    reasons.push('Aucun utilisateur rattaché');
  }
  if ((agency.nb_unites ?? 0) === 0) {
    score -= 10;
    reasons.push('Patrimoine non configuré');
  }
  if (proofs.some((proof) => proof.status === 'pending')) {
    score -= 18;
    reasons.push('Paiement manuel à valider');
  }
  if (!agency.derniere_activite) {
    score -= 8;
    reasons.push('Activité récente non détectée');
  }

  const normalized = Math.max(0, Math.min(100, score));
  if (normalized < 35) return { level: 'critical', label: 'Critique', score: normalized, reasons };
  if (normalized < 60) return { level: 'risk', label: 'À risque', score: normalized, reasons };
  if (normalized < 82) return { level: 'watch', label: 'À surveiller', score: normalized, reasons };
  return { level: 'healthy', label: 'Sain', score: normalized, reasons: reasons.length ? reasons : ['Aucun signal critique'] };
}

