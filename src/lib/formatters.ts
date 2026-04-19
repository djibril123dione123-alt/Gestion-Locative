/**
 * Centralized formatting utilities for the Gestion Locative app.
 * Import from here — do NOT define formatCurrency/formatDate locally in pages.
 */

/**
 * Format a monetary amount according to the given currency code.
 * Defaults to XOF (CFA franc).
 */
export function formatCurrency(amount: number | string, devise: string = 'XOF'): string {
  if (!amount && amount !== 0) {
    if (devise === 'EUR') return '0 €';
    if (devise === 'USD') return '0 $';
    return '0 F CFA';
  }

  const cleaned = String(amount).replace(/[/\s]/g, '');
  const num = Number(cleaned);
  if (isNaN(num)) {
    if (devise === 'EUR') return '0 €';
    if (devise === 'USD') return '0 $';
    return '0 F CFA';
  }

  const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 })
    .format(num)
    .replace(/\u00A0/g, ' ');

  if (devise === 'EUR') return `${formatted} €`;
  if (devise === 'USD') return `${formatted} $`;
  return `${formatted} F CFA`;
}

/**
 * Format a date string (ISO) as a localized French date string.
 * Returns '—' for null/undefined/empty.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('fr-FR');
  } catch {
    return '—';
  }
}

/**
 * Format a date string as a month+year label (e.g. "janvier 2025").
 * Returns '—' for null/undefined/empty.
 */
export function formatMonth(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
    });
  } catch {
    return '—';
  }
}
