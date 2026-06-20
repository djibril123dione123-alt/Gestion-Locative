export interface MonthFilterOption {
  value: string;
  label: string;
}

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function getCurrentMonthKey(referenceDate = new Date()): string {
  return `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}`;
}

export function toMonthKey(value?: string | null): string | null {
  if (!value) return null;
  const key = value.slice(0, 7);
  return MONTH_KEY_PATTERN.test(key) ? key : null;
}

export function formatMonthLabel(monthKey: string): string {
  if (!MONTH_KEY_PATTERN.test(monthKey)) return monthKey;
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
}

function getRecentMonthKeys(count: number, referenceDate: Date): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - index, 1);
    return getCurrentMonthKey(date);
  });
}

export function buildMonthFilterOptions(
  values: Array<string | null | undefined>,
  options: { recentMonths?: number; referenceDate?: Date } = {},
): MonthFilterOption[] {
  const referenceDate = options.referenceDate ?? new Date();
  const currentMonth = getCurrentMonthKey(referenceDate);
  const monthKeys = new Set([
    ...getRecentMonthKeys(options.recentMonths ?? 6, referenceDate),
    ...values.map(toMonthKey).filter((value): value is string => Boolean(value)),
  ]);

  const availableMonths = Array.from(monthKeys)
    .filter((month) => month !== currentMonth)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 18)
    .map((month) => ({ value: month, label: formatMonthLabel(month) }));

  return [
    { value: 'all', label: 'Tous les mois' },
    { value: 'current', label: `Mois en cours · ${formatMonthLabel(currentMonth)}` },
    ...availableMonths,
  ];
}

export function resolveMonthFilter(value: string, referenceDate = new Date()): string | null {
  if (!value || value === 'all') return null;
  if (value === 'current') return getCurrentMonthKey(referenceDate);
  return toMonthKey(value);
}
