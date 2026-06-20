import { describe, expect, it } from 'vitest';
import {
  buildMonthFilterOptions,
  getCurrentMonthKey,
  resolveMonthFilter,
  toMonthKey,
} from '../monthFilters';

describe('monthFilters', () => {
  const june2026 = new Date(2026, 5, 15);

  it('normalise les dates en clés mensuelles', () => {
    expect(toMonthKey('2026-06-18')).toBe('2026-06');
    expect(toMonthKey('date-invalide')).toBeNull();
  });

  it('propose tous les mois, le mois courant et une plage récente', () => {
    const options = buildMonthFilterOptions(['2026-02-12', '2025-12-01'], {
      referenceDate: june2026,
      recentMonths: 4,
    });

    expect(options[0]).toEqual({ value: 'all', label: 'Tous les mois' });
    expect(options[1].value).toBe('current');
    expect(options.map((option) => option.value)).toEqual(
      expect.arrayContaining(['2026-05', '2026-04', '2026-03', '2026-02', '2025-12']),
    );
  });

  it('résout le filtre courant sans ambiguïté', () => {
    expect(getCurrentMonthKey(june2026)).toBe('2026-06');
    expect(resolveMonthFilter('current', june2026)).toBe('2026-06');
    expect(resolveMonthFilter('all', june2026)).toBeNull();
    expect(resolveMonthFilter('2026-04', june2026)).toBe('2026-04');
  });
});
