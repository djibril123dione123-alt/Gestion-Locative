import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

import {
  createTeamInvitation,
  deactivateTeamMember,
  replaceMemberPermissions,
  submitSubscriptionPaymentProof,
} from '../tenantAdministrationCommands';

describe('tenant administration commands', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('normalise une invitation et utilise la commande serveur gardee', async () => {
    rpcMock.mockResolvedValue({
      data: {
        id: 'invitation-1',
        email: 'agent@example.com',
        role: 'agent',
        token: 'secure-token',
        expires_at: '2026-07-23T00:00:00.000Z',
      },
      error: null,
    });

    await expect(createTeamInvitation({
      email: '  Agent@Example.com ',
      role: 'agent',
      message: '  Bienvenue  ',
    })).resolves.toMatchObject({
      id: 'invitation-1',
      email: 'agent@example.com',
      role: 'agent',
    });

    expect(rpcMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith('tenant_create_invitation', expect.objectContaining({
      p_email: 'agent@example.com',
      p_role: 'agent',
      p_message: 'Bienvenue',
      p_days_valid: 7,
      p_idempotency_key: expect.stringMatching(/^team-invitation:agent@example\.com:/),
    }));
  });

  it('remplace atomiquement les permissions via la commande serveur', async () => {
    const permissions = [{
      page: 'bailleurs',
      access_level: 'write' as const,
      can_create: true,
      can_update: true,
      can_delete: false,
      can_export: true,
      can_manage: false,
    }];
    rpcMock.mockResolvedValue({ data: { permissions }, error: null });

    await expect(replaceMemberPermissions('member-1', permissions)).resolves.toEqual(permissions);
    expect(rpcMock).toHaveBeenCalledWith('tenant_replace_user_page_permissions', expect.objectContaining({
      p_target_user_id: 'member-1',
      p_permissions: permissions,
      p_idempotency_key: expect.stringMatching(/^team-permissions:member-1:/),
    }));
  });

  it('propage un refus serveur lors de la desactivation', async () => {
    const serverError = new Error('LAST_ADMIN_CANNOT_BE_DEACTIVATED');
    rpcMock.mockResolvedValue({ data: null, error: serverError });

    await expect(deactivateTeamMember('member-1', 'Depart confirme')).rejects.toBe(serverError);
  });

  it('transmet une preuve manuelle sans identifiant agence manipulable', async () => {
    rpcMock.mockResolvedValue({
      data: { id: 'proof-1', status: 'pending', created_at: '2026-07-16T10:00:00.000Z' },
      error: null,
    });

    await expect(submitSubscriptionPaymentProof({
      subscriptionId: 'subscription-1',
      planKey: 'pro',
      amount: 15000,
      method: 'wave',
      reference: ' WAVE-1289 ',
      paymentDate: '2026-07-16',
      proofFileUrl: ' https://example.com/proof.png ',
      comment: ' Paiement agence ',
    })).resolves.toEqual({
      id: 'proof-1',
      status: 'pending',
      created_at: '2026-07-16T10:00:00.000Z',
    });

    const [, args] = rpcMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(args).toEqual(expect.objectContaining({
      p_subscription_id: 'subscription-1',
      p_plan_key: 'pro',
      p_amount: 15000,
      p_method: 'wave',
      p_reference: 'WAVE-1289',
      p_proof_file_url: 'https://example.com/proof.png',
      p_comment: 'Paiement agence',
    }));
    expect(args).not.toHaveProperty('agency_id');
    expect(args).not.toHaveProperty('p_agency_id');
  });

  it('refuse une reponse serveur incomplete', async () => {
    rpcMock.mockResolvedValue({ data: { status: 'pending' }, error: null });

    await expect(submitSubscriptionPaymentProof({
      planKey: 'pro',
      amount: 15000,
      method: 'wave',
      paymentDate: '2026-07-16',
    })).rejects.toThrow(/r.ponse incompl.te/i);
  });
});
