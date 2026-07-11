export type AdminTone = 'emerald' | 'amber' | 'red' | 'blue' | 'slate' | 'orange' | 'dark';

export function getStatusTone(status: string | null | undefined): AdminTone {
  switch ((status ?? '').toLowerCase()) {
    case 'active':
    case 'approved':
    case 'validated':
    case 'paid':
    case 'published':
    case 'resolved':
    case 'closed':
      return 'emerald';
    case 'trial':
    case 'pending':
    case 'processing':
    case 'past_due':
    case 'in_progress':
    case 'scheduled':
      return 'amber';
    case 'suspended':
    case 'cancelled':
    case 'rejected':
    case 'failed':
    case 'critical':
    case 'blocking':
      return 'red';
    case 'draft':
    case 'review':
      return 'blue';
    default:
      return 'slate';
  }
}

export function getStatusLabel(status: string | null | undefined) {
  const key = (status ?? '').toLowerCase();
  const labels: Record<string, string> = {
    active: 'Actif',
    trial: 'Essai',
    suspended: 'Suspendu',
    cancelled: 'Annulé',
    pending: 'En attente',
    approved: 'Approuvé',
    rejected: 'Rejeté',
    validated: 'Validé',
    paid: 'Payé',
    past_due: 'En retard',
    processing: 'En traitement',
    in_progress: 'En cours',
    failed: 'Échec',
    draft: 'Brouillon',
    review: 'En revue',
    scheduled: 'Planifié',
    resolved: 'Résolu',
    closed: 'Clôturé',
  };
  return labels[key] ?? status ?? 'À vérifier';
}
