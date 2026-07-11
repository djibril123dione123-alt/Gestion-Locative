export type AdminTone = 'emerald' | 'amber' | 'red' | 'blue' | 'slate' | 'orange' | 'dark';

export function getStatusTone(status: string | null | undefined): AdminTone {
  switch ((status ?? '').toLowerCase()) {
    case 'active':
    case 'approved':
    case 'validated':
    case 'paid':
    case 'published':
      return 'emerald';
    case 'trial':
    case 'pending':
    case 'processing':
    case 'past_due':
      return 'amber';
    case 'suspended':
    case 'cancelled':
    case 'rejected':
    case 'failed':
    case 'critical':
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
    failed: 'Échec',
    draft: 'Brouillon',
  };
  return labels[key] ?? status ?? 'À vérifier';
}
