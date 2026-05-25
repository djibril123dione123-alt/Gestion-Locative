export interface PersonNameParts {
  prenom?: string | null;
  nom?: string | null;
}

export function formatPersonName(person?: PersonNameParts | null, fallback = '-'): string {
  const value = [person?.prenom, person?.nom]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');

  return value || fallback;
}
