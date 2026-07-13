export const SENEGAL_CNI_PATTERN = /^[12](?:0[1-9]|1[0-4])\d{8}\d{5}\d$/;

export const SENEGAL_CNI_MESSAGES = {
  length: 'La CNI sénégalaise doit comporter exactement 17 chiffres.',
  gender: 'Le premier chiffre doit être 1 ou 2.',
  region: 'Le code région doit être compris entre 01 et 14.',
  birthDate: 'La date de naissance indiquée dans la CNI est invalide.',
} as const;

export function formatSenegalCniInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 17);
  return [
    digits.slice(0, 1),
    digits.slice(1, 3),
    digits.slice(3, 11),
    digits.slice(11, 16),
    digits.slice(16, 17),
  ].filter(Boolean).join(' ');
}

function isValidPastDate(value: string) {
  if (!/^\d{8}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    && parsed.getTime() < todayUtc;
}

export function validateSenegalCni(value?: string | null, allowIncomplete = true) {
  const digits = value?.replace(/\D/g, '') ?? '';
  if (!digits) return null;
  if (digits[0] !== '1' && digits[0] !== '2') return SENEGAL_CNI_MESSAGES.gender;
  if (digits.length < 17) return allowIncomplete ? null : SENEGAL_CNI_MESSAGES.length;
  if (digits.length !== 17) return SENEGAL_CNI_MESSAGES.length;

  const region = Number(digits.slice(1, 3));
  if (region < 1 || region > 14 || !SENEGAL_CNI_PATTERN.test(digits)) {
    return SENEGAL_CNI_MESSAGES.region;
  }
  if (!isValidPastDate(digits.slice(3, 11))) return SENEGAL_CNI_MESSAGES.birthDate;
  return null;
}

export const IDENTITY_PIECE_OPTIONS = [
  { value: 'CNI', label: 'CNI' },
  { value: 'Passeport', label: 'Passeport' },
  { value: 'Carte consulaire', label: 'Carte consulaire' },
];

const PASSPORT_PATTERN = /^(?:[A-Z]{2}\d{7}|[A-Z]\d{8})$/;

export function formatIdentityNumberInput(value: string, type?: string | null): string {
  const normalizedType = (type ?? '').toLowerCase();
  if (normalizedType.includes('passeport')) {
    const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let result = '';
    for (const char of raw) {
      const index = result.length;
      if (index === 0 && /[A-Z]/.test(char)) {
        result += char;
      } else if (index === 1 && /[A-Z0-9]/.test(char)) {
        result += char;
      } else if (index >= 2 && /\d/.test(char)) {
        result += char;
      }
      if (result.length >= 9) break;
    }
    return result;
  }
  if (normalizedType.includes('cni')) {
    return formatSenegalCniInput(value);
  }
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
}

export function validateIdentityNumber(value?: string | null, type?: string | null, allowIncomplete = true): string | null {
  const cleaned = value?.replace(/\s+/g, ' ').trim() || null;
  if (!cleaned) return null;
  const normalizedType = (type ?? '').toLowerCase();
  if (normalizedType.includes('cni')) {
    return validateSenegalCni(cleaned, allowIncomplete);
  }
  if (normalizedType.includes('passeport')) {
    return PASSPORT_PATTERN.test(cleaned) ? null : 'Le format du passeport est incorrect. Exemple : A01234567.';
  }
  return null;
}

export function preventNonDigitKey(event: React.KeyboardEvent<HTMLInputElement>): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key.length === 1 && !/^\d$/.test(event.key)) {
    event.preventDefault();
  }
}

export function getIdentityPlaceholder(type?: string | null): string {
  const normalizedType = (type ?? '').toLowerCase();
  if (normalizedType.includes('passeport')) return 'A01234567';
  if (normalizedType.includes('cni')) return '1 01 19950825 00123 4';
  return 'Référence officielle';
}

export function getIdentityMaxLength(type?: string | null): number {
  const normalizedType = (type ?? '').toLowerCase();
  if (normalizedType.includes('passeport')) return 9;
  if (normalizedType.includes('cni')) return 21;
  return 24;
}

export function getIdentityHint(type?: string | null): string {
  const normalizedType = (type ?? '').toLowerCase();
  if (normalizedType.includes('passeport')) return 'Exemple : A01234567';
  if (normalizedType.includes('cni')) return '17 chiffres (format biométrique CEDEAO)';
  return 'Référence officielle';
}
