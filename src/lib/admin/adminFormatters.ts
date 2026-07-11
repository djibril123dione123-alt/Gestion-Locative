export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function formatAdminDate(value: string | null | undefined) {
  if (!value) return 'Non renseigné';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date invalide';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatAdminDateTime(value: string | null | undefined) {
  if (!value) return 'Non renseigné';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date invalide';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatAdminCurrency(value: number | string | null | undefined) {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(amount ?? NaN)) return '0 F CFA';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

export function numberValue(value: unknown) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

export function textValue(value: unknown, fallback = 'Non renseigné') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
