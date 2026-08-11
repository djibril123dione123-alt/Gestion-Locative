import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
    from: vi.fn(),
  },
}));

import type { OrganizationComplianceProfile } from '../api/fiscalProfileApi';
import { FiscalProfileApiError, saveOrganizationComplianceProfile } from '../api/fiscalProfileApi';

const profile: OrganizationComplianceProfile = {
  legal: {
    agency_id: 'agency-1',
    legal_form: 'sarl',
    business_activities: ['gestion_locative', 'gestion_locative', 'transaction'],
    trade_name: '  Teranga Gestion ',
    legal_name: ' Teranga Gestion SARL ',
    ninea: ' 0012345 2g3 ',
    rccm: ' sn-dkr-2026-b-12345 ',
    registered_office: ' Dakar ',
    representative_name: ' Awa Ndiaye ',
    representative_capacity: ' Gérante ',
    document_role: 'principal',
    mandate_reference: null,
    professional_validation_status: 'to_validate',
    notes: ' ',
  },
  fiscal: {
    agency_id: 'agency-1',
    tax_status: 'subject',
    vat_registration_status: 'registered',
    vat_number: ' vat-001 ',
    rent_tax_treatment: 'outside_scope',
    commission_tax_treatment: 'taxable',
    price_input_mode: 'ttc',
    professional_validation_status: 'to_validate',
    effective_from: '2026-08-01',
    notes: null,
  },
};

describe('fiscal profile API', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('saves legal and fiscal identity atomically through the guarded RPC', async () => {
    rpcMock.mockImplementation(async (_name, args) => ({
      data: { legal: args.p_legal, fiscal: args.p_fiscal },
      error: null,
    }));

    const result = await saveOrganizationComplianceProfile(profile);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('fn_upsert_organization_compliance_profile', {
      p_legal: expect.objectContaining({
        business_activities: ['gestion_locative', 'transaction'],
        trade_name: 'Teranga Gestion',
        ninea: '0012345 2G3',
        rccm: 'SN-DKR-2026-B-12345',
        notes: null,
      }),
      p_fiscal: expect.objectContaining({ vat_number: 'VAT-001' }),
    });
    expect(result.legal.trade_name).toBe('Teranga Gestion');
  });

  it('rejects an incomplete atomic response', async () => {
    rpcMock.mockResolvedValue({ data: { legal: profile.legal }, error: null });
    await expect(saveOrganizationComplianceProfile(profile)).rejects.toBeInstanceOf(FiscalProfileApiError);
  });

  it('maps an unavailable migration to an actionable message', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation missing' } });
    await expect(saveOrganizationComplianceProfile(profile)).rejects.toThrow(/mise à jour administrateur/i);
  });
});
