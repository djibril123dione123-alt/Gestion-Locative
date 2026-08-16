import { getAdminPlan, getAdminPlanPrice, normalizeAdminPlanId } from './adminPricingCatalog';
import { numberValue } from './adminFormatters';
import type { AdminAgency, AdminConsoleData, AdminDocumentRegistryEntry, SubscriptionPaymentProof } from '../../services/admin/adminConsoleService';
import { getDocumentTypeLabel as getCanonicalDocumentTypeLabel } from '../documents/documentTypes';

/** Anciennes valeurs vues dans des données admin plus anciennes, alias vers le type canonique. */
const ADMIN_DOCUMENT_TYPE_ALIASES: Record<string, string> = {
  contrat_location: 'contrat',
  mandat_gerance: 'mandat',
};

export type AdminInsightTone = 'red' | 'amber' | 'blue' | 'emerald' | 'slate' | 'orange';

export interface RequiredAction {
  id: string;
  title: string;
  description: string;
  tone: AdminInsightTone;
  domain: 'billing' | 'support' | 'organization' | 'system' | 'documents' | 'security';
  priority: number;
  organizationId?: string | null;
  targetId?: string | null;
}

export function isIndividualOrganization(agency: AdminAgency) {
  return Boolean(agency.is_bailleur_account || agency.organization_type === 'individual_landlord');
}

export function organizationTypeLabel(agency: AdminAgency) {
  if (isIndividualOrganization(agency)) return 'Bailleur individuel';
  if (agency.organization_type === 'property_manager') return 'Gestionnaire';
  if (agency.organization_type === 'cabinet') return 'Cabinet';
  return 'Agence immobilière';
}

export function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.ceil((timestamp - Date.now()) / 86_400_000);
}

export function paymentExpectedAmount(proof: SubscriptionPaymentProof) {
  return getAdminPlanPrice(normalizeAdminPlanId(proof.plan_key));
}

export function paymentHasAmountAnomaly(proof: SubscriptionPaymentProof) {
  const expected = paymentExpectedAmount(proof);
  const paid = numberValue(proof.amount);
  return expected > 0 && paid > 0 && Math.abs(expected - paid) > 100;
}

export function summarizeSaasRevenue(data: AdminConsoleData) {
  const payingAgencies = data.agencies.filter((agency) => ['active', 'trial', null, undefined].includes(agency.status));
  const mrr = payingAgencies.reduce((sum, agency) => sum + getAdminPlanPrice(normalizeAdminPlanId(agency.plan)), 0);
  const byPlan = ['starter', 'pro', 'business', 'enterprise'].map((planId) => {
    const plan = getAdminPlan(planId);
    const agencies = data.agencies.filter((agency) => normalizeAdminPlanId(agency.plan) === plan.id);
    return {
      plan,
      count: agencies.length,
      revenue: agencies.length * plan.price_xof,
    };
  });
  return {
    mrr,
    arr: mrr * 12,
    payingClients: payingAgencies.filter((agency) => agency.status === 'active').length,
    pendingAmount: data.proofs.filter((proof) => proof.status === 'pending').reduce((sum, proof) => sum + numberValue(proof.amount), 0),
    rejectedAmount: data.proofs.filter((proof) => proof.status === 'rejected').reduce((sum, proof) => sum + numberValue(proof.amount), 0),
    byPlan,
  };
}

export function documentTypeLabel(type: string | null | undefined) {
  const normalized = (type ?? '').toLowerCase();
  const resolved = ADMIN_DOCUMENT_TYPE_ALIASES[normalized] ?? normalized;
  return getCanonicalDocumentTypeLabel(resolved, { fallback: 'raw' });
}

export function documentHasRegistryIssue(entry: AdminDocumentRegistryEntry) {
  return !entry.storage_path || entry.status === 'failed' || entry.status === 'error' || entry.status === 'draft';
}

export function buildRequiredActions(data: AdminConsoleData): RequiredAction[] {
  const actions: RequiredAction[] = [];

  for (const proof of data.proofs) {
    if (proof.status !== 'pending') continue;
    actions.push({
      id: `proof-${proof.id}`,
      title: paymentHasAmountAnomaly(proof) ? 'Montant de paiement à vérifier' : 'Preuve de paiement à valider',
      description: `${proof.agencies?.name ?? 'Organisation'} · ${numberValue(proof.amount).toLocaleString('fr-FR')} FCFA · ${proof.method}`,
      tone: paymentHasAmountAnomaly(proof) ? 'red' : 'amber',
      domain: 'billing',
      priority: paymentHasAmountAnomaly(proof) ? 95 : 88,
      organizationId: proof.agency_id,
      targetId: proof.id,
    });
    if (!proof.proof_file_url && !proof.reference) {
      actions.push({
        id: `proof-missing-${proof.id}`,
        title: 'Paiement sans preuve exploitable',
        description: `${proof.agencies?.name ?? 'Organisation'} doit fournir une référence ou un justificatif.`,
        tone: 'red',
        domain: 'billing',
        priority: 96,
        organizationId: proof.agency_id,
        targetId: proof.id,
      });
    }
  }

  for (const request of data.requests) {
    if (request.status !== 'pending') continue;
    actions.push({
      id: `request-${request.id}`,
      title: 'Demande de création à examiner',
      description: `${request.organization_name ?? request.agency_name ?? request.requester_email ?? 'Nouvelle demande'} · ${request.requested_plan ?? request.plan ?? 'plan à confirmer'}`,
      tone: 'blue',
      domain: 'support',
      priority: 78,
      targetId: request.id,
    });
  }

  for (const agency of data.agencies) {
    const trialDays = daysUntil(agency.trial_ends_at);
    if (agency.status === 'trial' && trialDays != null && trialDays <= 7) {
      actions.push({
        id: `trial-${agency.id}`,
        title: 'Essai proche expiration',
        description: `${agency.name} · échéance dans ${Math.max(trialDays, 0)} jour(s)`,
        tone: trialDays <= 2 ? 'red' : 'amber',
        domain: 'organization',
        priority: trialDays <= 2 ? 86 : 72,
        organizationId: agency.id,
      });
    }
    if (agency.status === 'suspended') {
      actions.push({
        id: `suspended-${agency.id}`,
        title: 'Organisation suspendue',
        description: `${agency.name} · vérifier paiement, support ou décision owner.`,
        tone: 'red',
        domain: 'organization',
        priority: 82,
        organizationId: agency.id,
      });
    }
    if (agency.is_bailleur_account && agency.organization_type && agency.organization_type !== 'individual_landlord') {
      actions.push({
        id: `type-mismatch-${agency.id}`,
        title: 'Type de compte incohérent',
        description: `${agency.name} combine bailleur individuel et type ${agency.organization_type}.`,
        tone: 'amber',
        domain: 'organization',
        priority: 70,
        organizationId: agency.id,
      });
    }
  }

  for (const ticket of data.tickets) {
    if (['resolved', 'closed'].includes(ticket.status ?? '')) continue;
    actions.push({
      id: `ticket-${ticket.id}`,
      title: ticket.priority === 'urgent' ? 'Ticket support urgent' : 'Ticket support ouvert',
      description: `${ticket.subject} · ${ticket.category ?? 'support'}`,
      tone: ticket.priority === 'urgent' ? 'red' : 'amber',
      domain: 'support',
      priority: ticket.priority === 'urgent' ? 92 : 60,
      organizationId: ticket.organization_id,
      targetId: ticket.id,
    });
  }

  for (const incident of data.incidents) {
    if (['resolved', 'ignored'].includes(incident.status ?? '')) continue;
    actions.push({
      id: `incident-${incident.id}`,
      title: incident.severity === 'blocking' || incident.severity === 'critical' ? 'Incident critique ouvert' : 'Incident à suivre',
      description: `${incident.type} · ${incident.message ?? 'Incident système'}`,
      tone: incident.severity === 'blocking' || incident.severity === 'critical' ? 'red' : 'amber',
      domain: 'system',
      priority: incident.severity === 'blocking' ? 99 : incident.severity === 'critical' ? 94 : 68,
      organizationId: incident.organization_id,
      targetId: incident.id,
    });
  }

  for (const entry of data.documentRegistry) {
    if (!documentHasRegistryIssue(entry)) continue;
    actions.push({
      id: `document-${entry.id}`,
      title: 'Document à vérifier',
      description: `${documentTypeLabel(entry.document_type)} · ${entry.agencies?.name ?? entry.agency_id ?? 'Organisation'}`,
      tone: 'amber',
      domain: 'documents',
      priority: 58,
      organizationId: entry.agency_id,
      targetId: entry.id,
    });
  }

  return actions.sort((a, b) => b.priority - a.priority);
}
