/**
 * Centralized formatting utilities for UI, exports and PDF rendering.
 */

function formatNum(num: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 })
    .format(num)
    .replace(/[\u00A0\u202F\u2009\u2007]/g, '\u0020');
}

export function formatCurrency(amount: number | string, devise: string = 'XOF'): string {
  if (!amount && amount !== 0) {
    if (devise === 'EUR') return `0 \u20ac`;
    if (devise === 'USD') return '0 $';
    return '0 F CFA';
  }

  const cleaned = String(amount).replace(/[/\s]/g, '');
  let num = Number(cleaned);
  if (Number.isNaN(num)) {
    if (devise === 'EUR') return `0 \u20ac`;
    if (devise === 'USD') return '0 $';
    return '0 F CFA';
  }

  if (num >= -3 && num <= 3) {
    num = 0;
  }

  const formatted = formatNum(num);

  if (devise === 'EUR') return `${formatted} \u20ac`;
  if (devise === 'USD') return `${formatted} $`;
  return `${formatted} F CFA`;
}

export function formatNumber(amount: number | string): string {
  const num = Number(String(amount).replace(/[/\s]/g, ''));
  if (Number.isNaN(num)) return '0';
  return formatNum(num);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('fr-FR');
  } catch {
    return '-';
  }
}

export function formatMonth(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
    });
  } catch {
    return '-';
  }
}

const SENEGAL_LOCAL_PREFIXES = new Set(['30', '33', '70', '75', '76', '77', '78']);

export function getSenegalLocalPhone(value: string | number | null | undefined): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00221')) digits = `221${digits.slice(5)}`;
  if (digits.startsWith('221')) digits = digits.slice(3);

  if (digits.length !== 9) return null;
  if (!SENEGAL_LOCAL_PREFIXES.has(digits.slice(0, 2))) return null;
  return digits;
}

export function normalizeSenegalPhone(value: string | number | null | undefined): string | null {
  const local = getSenegalLocalPhone(value);
  return local ? `221${local}` : null;
}

export function isValidSenegalPhone(value: string | number | null | undefined): boolean {
  return normalizeSenegalPhone(value) !== null;
}

export function formatSenegalPhone(value: string | number | null | undefined, fallback = '-'): string {
  const local = getSenegalLocalPhone(value);
  if (!local) {
    const text = String(value ?? '').trim();
    return text || fallback;
  }
  return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}

export function formatSenegalPhoneInput(value: string | number | null | undefined): string {
  const raw = String(value ?? '');
  const digits = raw.replace(/\D/g, '');
  let local = digits;

  if (local.startsWith('00221')) local = local.slice(5);
  if (local.startsWith('221')) local = local.slice(3);
  local = local.slice(0, 9);

  if (local.length <= 2) return local;
  if (local.length <= 5) return `${local.slice(0, 2)} ${local.slice(2)}`;
  if (local.length <= 7) return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
  return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}

export function getSenegalPhoneHref(value: string | number | null | undefined): string | null {
  const normalized = normalizeSenegalPhone(value);
  return normalized ? `tel:+${normalized}` : null;
}
