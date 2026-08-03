import { describe, expect, it } from 'vitest';
import {
  TELEMETRY_REDACTED,
  redactTelemetryString,
  safeTelemetryPath,
  sanitizeTelemetryData,
} from '../telemetryPrivacy';

describe('telemetry privacy', () => {
  it('redacts emails, bearer tokens and long opaque values', () => {
    const result = redactTelemetryString(
      'user@example.com Bearer abc.def.ghi abcdefghijklmnopqrstuvwxyz1234567890',
    );
    expect(result).not.toContain('user@example.com');
    expect(result).not.toContain('abc.def.ghi');
    expect(result).toContain(TELEMETRY_REDACTED);
  });

  it('redacts sensitive keys recursively without mutating safe values', () => {
    expect(sanitizeTelemetryData({
      role: 'admin',
      email: 'user@example.com',
      nested: { authorization: 'Bearer secret', count: 2 },
    })).toEqual({
      role: 'admin',
      email: TELEMETRY_REDACTED,
      nested: { authorization: TELEMETRY_REDACTED, count: 2 },
    });
  });

  it('removes query strings and hashes from tracked paths', () => {
    expect(safeTelemetryPath('/accept-invitation?token=secret#step')).toBe('/accept-invitation');
  });
});
