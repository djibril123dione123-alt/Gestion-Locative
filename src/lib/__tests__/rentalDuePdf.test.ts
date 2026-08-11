import { describe, expect, it } from 'vitest';
import type { RentalDueDetail } from '../../services/api/rentalDueApi';
import {
  buildRentalDueFinancialSummary,
  rentalDueDocumentLabel,
} from '../rentalDuePdf';

function detailFixture(): RentalDueDetail {
  return {
    due: {
      id: 'due-1',
      agency_id: 'agency-1',
      contract_id: 'contract-1',
      tenant_id: 'tenant-1',
      unit_id: 'unit-1',
      landlord_id: 'landlord-1',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      due_date: '2026-08-05',
      status: 'PARTIALLY_PAID',
      currency: 'XOF',
      amount_ht: 100_000,
      tax_amount: 18_000,
      amount_ttc: 118_000,
      allocated_amount: 0,
      outstanding_amount: 78_000,
      prior_balance: 10_000,
      credit_applied: 5_000,
      reference: 'ECH-2026-0001',
      version: 2,
      source: 'generated',
      issuer_snapshot: {},
      parties_snapshot: {},
      legal_snapshot: {},
      fiscal_snapshot: {},
      contract_snapshot: {},
      issued_at: null,
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z',
    },
    lines: [],
    allocations: [
      {
        id: 'allocation-1',
        payment_id: 'payment-1',
        due_id: 'due-1',
        allocation_type: 'allocation',
        amount: 50_000,
        strategy: 'oldest_first',
        allocated_at: '2026-08-03T00:00:00.000Z',
      },
      {
        id: 'reversal-1',
        payment_id: 'payment-1',
        due_id: 'due-1',
        allocation_type: 'reversal',
        amount: 10_000,
        strategy: 'manual',
        allocated_at: '2026-08-04T00:00:00.000Z',
      },
    ],
    documents: [],
    deliveries: [],
    reminders: [],
    events: [],
  };
}

describe('rental due PDF helpers', () => {
  it.each([
    ['due_notice', "Avis d'échéance de loyer"],
    ['rent_invoice', 'Facture de loyer'],
    ['partial_payment_receipt', 'Reçu de paiement partiel'],
    ['rent_receipt', 'Quittance de loyer'],
    ['credit_note', 'Avoir locatif'],
  ] as const)('expose un libellé métier pour %s', (type, expected) => {
    expect(rentalDueDocumentLabel(type)).toBe(expected);
  });

  it('calcule le règlement net en tenant compte des contre-passations', () => {
    expect(buildRentalDueFinancialSummary(detailFixture())).toEqual({
      amountHt: 100_000,
      taxAmount: 18_000,
      amountTtc: 118_000,
      allocatedAmount: 40_000,
      outstandingAmount: 78_000,
      priorBalance: 10_000,
      creditApplied: 5_000,
    });
  });

  it('préfère le montant alloué canonique lorsqu’il est persisté', () => {
    const detail = detailFixture();
    detail.due.allocated_amount = 41_500;
    expect(buildRentalDueFinancialSummary(detail).allocatedAmount).toBe(41_500);
  });
});
