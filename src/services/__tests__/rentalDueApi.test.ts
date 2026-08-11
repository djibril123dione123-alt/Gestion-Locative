import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock, rpcMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: invokeMock },
    rpc: rpcMock,
  },
}));

import {
  RentalDueApiError,
  cancelRentalDue,
  generateRentalDue,
  getContractRentalDueSummary,
  getOwnerRentalDueSummary,
  getRentalDueDashboardSummary,
  getRentalDueDetail,
  isCanonicalRentalDueId,
  prepareRentalDueDocument,
  previewRentalDueGeneration,
  recordRentalDueDelivery,
  scheduleRentalDueReminders,
} from '../api/rentalDueApi';

const dueId = '8e931b35-47f0-4bdd-8467-9e00e20cbac7';

describe('rental due API', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    rpcMock.mockReset();
  });

  it('recognises canonical ids and rejects legacy receivables before any query', async () => {
    expect(isCanonicalRentalDueId(dueId)).toBe(true);
    expect(isCanonicalRentalDueId('legacy-2026-07')).toBe(false);

    await expect(getRentalDueDetail('legacy-2026-07')).rejects.toMatchObject({
      code: 'LEGACY_RECEIVABLE',
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('loads detail through the tenant-scoped RPC without sending an agency id', async () => {
    rpcMock.mockResolvedValue({
      data: { due: { id: dueId }, lines: [], allocations: [], documents: [], events: [] },
      error: null,
    });

    await expect(getRentalDueDetail(dueId)).resolves.toMatchObject({
      due: { id: dueId },
      deliveries: [],
      reminders: [],
    });
    expect(rpcMock).toHaveBeenCalledWith('fn_rental_due_detail', { p_due_id: dueId });
  });

  it('reuses the in-flight promise for an identical command', async () => {
    let resolveRequest!: (value: unknown) => void;
    invokeMock.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const first = generateRentalDue('contract-1', '2026-08-01');
    const second = generateRentalDue('contract-1', '2026-08-01');

    expect(invokeMock).toHaveBeenCalledTimes(1);
    resolveRequest({ data: { data: { due: { id: dueId } } }, error: null });

    await expect(first).resolves.toMatchObject({ due: { id: dueId } });
    await expect(second).resolves.toMatchObject({ due: { id: dueId } });
  });

  it('keeps document preparation explicit and returns the persisted document', async () => {
    invokeMock.mockResolvedValue({
      data: {
        data: {
          reused: false,
          document: { id: 'document-1', due_id: dueId, document_type: 'rent_invoice' },
        },
      },
      error: null,
    });

    await expect(prepareRentalDueDocument(dueId, 'rent_invoice')).resolves.toMatchObject({
      reused: false,
      document: { due_id: dueId, document_type: 'rent_invoice' },
    });
    expect(invokeMock).toHaveBeenCalledWith('rental-due-command', {
      body: { command: 'prepare-document', due_id: dueId, document_type: 'rent_invoice' },
    });
  });

  it('preserves the numeric reminder count returned by the server', async () => {
    invokeMock.mockResolvedValue({ data: { data: 3 }, error: null });
    await expect(scheduleRentalDueReminders(dueId)).resolves.toBe(3);
  });

  it('previews a monthly batch without mutating it', async () => {
    invokeMock.mockResolvedValue({
      data: {
        data: {
          period_start: '2026-08-01',
          ready_count: 2,
          warning_count: 0,
          blocked_count: 0,
          existing_count: 1,
          items: [],
        },
      },
      error: null,
    });

    await previewRentalDueGeneration('2026-08-01');
    expect(invokeMock).toHaveBeenCalledWith('rental-due-command', {
      body: { command: 'preview-bulk', period_start: '2026-08-01' },
    });
  });

  it('sends cancellation and delivery audit commands with explicit identifiers', async () => {
    invokeMock
      .mockResolvedValueOnce({ data: { data: { due: { id: dueId, status: 'CANCELLED' } } }, error: null })
      .mockResolvedValueOnce({ data: { data: { id: 'delivery-1', due_id: dueId, document_id: 'document-1' } }, error: null });

    await cancelRentalDue(dueId, 'Bail résilié avant la période');
    await recordRentalDueDelivery(dueId, 'document-1', 'download');

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'rental-due-command', {
      body: { command: 'cancel', due_id: dueId, reason: 'Bail résilié avant la période' },
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'rental-due-command', {
      body: { command: 'record-delivery', due_id: dueId, document_id: 'document-1', channel: 'download' },
    });
  });

  it('loads the tenant-scoped contract chronology', async () => {
    rpcMock.mockResolvedValue({ data: [{ id: dueId, status: 'PENDING' }], error: null });

    await expect(getContractRentalDueSummary('contract-1')).resolves.toHaveLength(1);
    expect(rpcMock).toHaveBeenCalledWith('fn_contract_rental_due_summary', { p_contract_id: 'contract-1' });
  });

  it('loads the canonical dashboard summary with an explicit as-of date', async () => {
    rpcMock.mockResolvedValue({
      data: {
        as_of: '2026-08-10',
        currency: 'XOF',
        due_count: 4,
        total_billed: 600000,
        total_collected: 450000,
        total_outstanding: 150000,
        overdue_count: 1,
        overdue_amount: 150000,
        paid_count: 3,
        partial_count: 0,
      },
      error: null,
    });

    await expect(getRentalDueDashboardSummary('agency-1', '2026-08-10')).resolves.toMatchObject({
      due_count: 4,
      total_outstanding: 150000,
    });
    expect(rpcMock).toHaveBeenCalledWith('fn_rental_due_dashboard_summary', {
      p_agency_id: 'agency-1',
      p_as_of: '2026-08-10',
    });
  });

  it('loads a tenant-guarded owner summary and normalizes missing lines', async () => {
    rpcMock.mockResolvedValue({
      data: {
        agency_id: 'agency-1',
        landlord_id: 'landlord-1',
        period: { from: '2026-08-01', to: '2026-08-31' },
        currency: 'XOF',
        total_billed: 150000,
        total_collected: 0,
        total_outstanding: 150000,
        due_count: 1,
      },
      error: null,
    });

    await expect(getOwnerRentalDueSummary(
      'agency-1',
      'landlord-1',
      '2026-08-01',
      '2026-08-31',
    )).resolves.toMatchObject({ lines: [], total_outstanding: 150000 });
    expect(rpcMock).toHaveBeenCalledWith('fn_owner_rental_due_summary', {
      p_agency_id: 'agency-1',
      p_landlord_id: 'landlord-1',
      p_from: '2026-08-01',
      p_to: '2026-08-31',
    });
  });

  it('turns incomplete edge responses into a stable domain error', async () => {
    invokeMock.mockResolvedValue({ data: null, error: null });

    await expect(generateRentalDue('contract-2', '2026-08-01')).rejects.toBeInstanceOf(RentalDueApiError);
    await expect(generateRentalDue('contract-2', '2026-08-01')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
});
