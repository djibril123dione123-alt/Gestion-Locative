import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

import {
  acceptTenantLegalTerms,
  completeTenantOnboarding,
  markTenantDemoDataLoaded,
  markTenantOnboardingComplete,
  updateTenantOwnerProfile,
} from '../tenantProfileCommands';

describe('tenant profile commands', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('normalise onboarding data and derives tenant scope server-side', async () => {
    rpcMock.mockResolvedValue({
      data: { completed_at: '2026-07-16T10:00:00.000Z' },
      error: null,
    });

    await expect(completeTenantOnboarding({
      agencyName: '  Agence Horizon  ',
      phone: '  +221 77 000 00 00 ',
      address: '  Dakar  ',
      representativeName: '  Awa Ndiaye  ',
      currency: ' xof ',
      city: '  Dakar ',
      completedAt: '2026-07-16T10:00:00.000Z',
    })).resolves.toBe('2026-07-16T10:00:00.000Z');

    expect(rpcMock).toHaveBeenCalledWith('tenant_complete_onboarding', expect.objectContaining({
      p_agency_name: 'Agence Horizon',
      p_phone: '+221 77 000 00 00',
      p_address: 'Dakar',
      p_representative_name: 'Awa Ndiaye',
      p_currency: 'XOF',
      p_city: 'Dakar',
      p_idempotency_key: expect.stringMatching(/^onboarding-complete:/),
    }));
    const [, args] = rpcMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(args).not.toHaveProperty('agency_id');
    expect(args).not.toHaveProperty('p_agency_id');
  });

  it('uses the guarded deferred onboarding command', async () => {
    rpcMock.mockResolvedValue({ data: { completed_at: '2026-07-16T11:00:00.000Z' }, error: null });

    await expect(markTenantOnboardingComplete('2026-07-16T11:00:00.000Z'))
      .resolves.toBe('2026-07-16T11:00:00.000Z');
    expect(rpcMock).toHaveBeenCalledWith('tenant_mark_onboarding_complete', expect.objectContaining({
      p_completed_at: '2026-07-16T11:00:00.000Z',
      p_idempotency_key: expect.stringMatching(/^onboarding-deferred:/),
    }));
  });

  it('normalise owner identity and never sends a manipulable tenant id', async () => {
    rpcMock.mockResolvedValue({
      data: {
        first_name: 'Awa',
        last_name: 'Ndiaye',
        full_name: 'Awa Ndiaye',
        phone: '+221770000000',
        email: 'awa@example.com',
        address: 'Dakar',
        logo_url: null,
        owner_bailleur_id: 'owner-1',
      },
      error: null,
    });

    await expect(updateTenantOwnerProfile({
      firstName: ' Awa ',
      lastName: ' Ndiaye ',
      phone: ' +221770000000 ',
      email: ' AWA@EXAMPLE.COM ',
      address: ' Dakar ',
      ownerBailleurId: 'owner-1',
    })).resolves.toMatchObject({
      fullName: 'Awa Ndiaye',
      email: 'awa@example.com',
      ownerBailleurId: 'owner-1',
    });

    const [, args] = rpcMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(args).toEqual(expect.objectContaining({
      p_first_name: 'Awa',
      p_last_name: 'Ndiaye',
      p_email: 'awa@example.com',
      p_owner_bailleur_id: 'owner-1',
    }));
    expect(args).not.toHaveProperty('agency_id');
    expect(args).not.toHaveProperty('p_agency_id');
  });

  it('rejects an incomplete owner profile response', async () => {
    rpcMock.mockResolvedValue({ data: { first_name: 'Awa' }, error: null });

    await expect(updateTenantOwnerProfile({ firstName: 'Awa', lastName: 'Ndiaye' }))
      .rejects.toThrow(/profil enregistr/i);
  });

  it('records legal acceptance using the authenticated actor only', async () => {
    rpcMock.mockResolvedValue({
      data: {
        accepted_terms_at: '2026-07-16T12:00:00.000Z',
        accepted_privacy_at: '2026-07-16T12:00:00.000Z',
        terms_version: '2026-07',
        privacy_version: '2026-07',
      },
      error: null,
    });

    await acceptTenantLegalTerms({
      acceptedTermsAt: '2026-07-16T12:00:00.000Z',
      acceptedPrivacyAt: '2026-07-16T12:00:00.000Z',
      termsVersion: '2026-07',
      privacyVersion: '2026-07',
    });

    expect(rpcMock).toHaveBeenCalledWith('tenant_accept_legal_terms', {
      p_accepted_terms_at: '2026-07-16T12:00:00.000Z',
      p_accepted_privacy_at: '2026-07-16T12:00:00.000Z',
      p_terms_version: '2026-07',
      p_privacy_version: '2026-07',
    });
  });

  it('marks demo data through the guarded command without exposing tenant scope', async () => {
    rpcMock.mockResolvedValue({ data: { demo_data_loaded: true }, error: null });

    await expect(markTenantDemoDataLoaded()).resolves.toBeUndefined();
    const [, args] = rpcMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(args).toEqual(expect.objectContaining({
      p_idempotency_key: expect.stringMatching(/^demo-data-loaded:/),
    }));
    expect(args).not.toHaveProperty('agency_id');
    expect(args).not.toHaveProperty('p_agency_id');
  });
});
