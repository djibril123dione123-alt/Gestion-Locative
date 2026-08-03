import { describe, expect, it } from 'vitest';
import {
  cancelPaiementViaEdge,
  PaiementApiError,
} from '../paiementApi';

describe('payment cancellation API contract', () => {
  it('rejects an invalid reason before invoking the network', async () => {
    await expect(
      cancelPaiementViaEdge({
        id: 'payment-id',
        raison: ' non ',
      }),
    ).rejects.toMatchObject({
      name: 'PaiementApiError',
      code: 'INVALID_CANCELLATION_REASON',
    } satisfies Partial<PaiementApiError>);
  });
});
