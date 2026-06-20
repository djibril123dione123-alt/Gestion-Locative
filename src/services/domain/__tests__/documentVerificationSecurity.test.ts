import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractVerificationInput,
  isValidPublicVerificationToken,
  verifyDocumentToken,
} from '../../documentVerification';

const token = 'a'.repeat(64);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('public document verification security', () => {
  it('accepts only a 256-bit hexadecimal token', () => {
    expect(isValidPublicVerificationToken(token)).toBe(true);
    expect(isValidPublicVerificationToken('A'.repeat(64))).toBe(true);
    expect(isValidPublicVerificationToken('a'.repeat(63))).toBe(false);
    expect(isValidPublicVerificationToken('z'.repeat(64))).toBe(false);
    expect(isValidPublicVerificationToken('QIT-202606-ABC123')).toBe(false);
  });

  it('extracts the token and optional assertions from a secure verification URL', () => {
    expect(
      extractVerificationInput(
        'https://samaykeur.com/verify?token=' + token + '&ref=QIT-202606-ABC123&type=quittance',
      ),
    ).toEqual({
      token,
      reference: 'QIT-202606-ABC123',
    });
  });

  it('keeps a plain reference available for the authenticated agency scanner', () => {
    expect(extractVerificationInput('QIT-202606-ABC123')).toEqual({
      token: null,
      reference: 'QIT-202606-ABC123',
    });
  });

  it('never calls the public endpoint with a reference alone', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await verifyDocumentToken('', {
      reference: 'QIT-202606-ABC123',
      type: 'quittance',
    });

    expect(result.state).toBe('invalid');
    expect(result.message).toContain('jeton de sécurité');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a malformed token even when a reference is present', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await verifyDocumentToken('bad-token', {
      reference: 'QIT-202606-ABC123',
    });

    expect(result.state).toBe('invalid');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('drops private fields even if an older endpoint returns them', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        status: 'authentic',
        document: {
          reference: 'QIT-202606-ABC123',
          type: 'quittance',
          agency: 'Agence test',
          issued_at: '2026-06-20T10:00:00.000Z',
          amount_xof: 500000,
          payment_status: 'paye',
          period: '2026-06',
          registered_at: '2026-06-20T10:00:01.000Z',
        },
      }),
    }));

    const result = await verifyDocumentToken(token);

    expect(result.state).toBe('authentic');
    expect(result.details).toMatchObject({
      amountXof: null,
      paymentStatus: null,
      period: null,
      registeredAt: null,
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('token=' + token),
      expect.objectContaining({ cache: 'no-store', referrerPolicy: 'no-referrer' }),
    );
  });

  it('treats throttling as a temporary registry error', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ valid: false, error: 'Trop de tentatives.' }),
    }));

    const result = await verifyDocumentToken(token);

    expect(result).toMatchObject({
      state: 'network_error',
      message: 'Trop de tentatives.',
    });
  });
});