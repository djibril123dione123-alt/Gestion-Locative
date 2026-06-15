import { describe, expect, it } from 'vitest';
import { buildPaymentMonthOptions, getPaymentMonthState } from '../paymentSchedule';
import type { ContratRow, PaiementRow } from '../../../components/paiements/paiementTypes';

const contrat: ContratRow = {
  id: 'contrat-001',
  loyer_mensuel: 100_000,
  date_debut: '2026-01-01',
  date_fin: '2026-03-31',
  locataires: { nom: 'Diop', prenom: 'Matar' },
  unites: { nom: 'A1' },
  commission: 8,
};

function payment(month: string, amount: number, id = `${month}-${amount}`): PaiementRow {
  return {
    id,
    contrat_id: contrat.id,
    montant_total: amount,
    mois_concerne: `${month}-01`,
    date_paiement: `${month}-05`,
    mode_paiement: 'especes',
    statut: amount >= 100_000 ? 'paye' : 'partiel',
    reference: null,
    deleted_at: null,
  };
}

describe('paymentSchedule', () => {
  it('masque les mois totalement soldes', () => {
    const options = buildPaymentMonthOptions(contrat, [payment('2026-01', 100_000)], {
      monthsAhead: 12,
    });

    expect(options.some((option) => option.value === '2026-01')).toBe(false);
    expect(options.some((option) => option.value === '2026-02')).toBe(true);
  });

  it('conserve les mois partiellement payes avec le reliquat', () => {
    const state = getPaymentMonthState(contrat, [payment('2026-02', 40_000)], '2026-02');

    expect(state?.isPartial).toBe(true);
    expect(state?.isSold).toBe(false);
    expect(state?.remainingAmount).toBe(60_000);
  });

  it('considere le deuxieme paiement comme soldant le reliquat', () => {
    const state = getPaymentMonthState(
      contrat,
      [payment('2026-02', 40_000), payment('2026-02', 60_000, 'soldant')],
      '2026-02',
    );

    expect(state?.isSold).toBe(true);
    expect(state?.remainingAmount).toBe(0);
  });

  it('applique la tolerance CFA partagee sur les petits reliquats', () => {
    const state = getPaymentMonthState(contrat, [payment('2026-02', 99_998)], '2026-02');

    expect(state?.isSold).toBe(true);
    expect(state?.remainingAmount).toBe(0);
  });

  it('n expose pas les mois hors periode de bail', () => {
    const options = buildPaymentMonthOptions(contrat, [], { monthsAhead: 12 });
    const values = options.map((option) => option.value);

    expect(values).toContain('2026-01');
    expect(values).toContain('2026-03');
    expect(values).not.toContain('2026-04');
  });
});
