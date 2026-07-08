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
