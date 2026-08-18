const SENSITIVE_KEY = /(?:authorization|cookie|password|secret|token|jwt|email|phone|telephone|address|adresse|cni|passport|piece|ninea|rccm|proof|preuve|document_url|signature|stamp|api_key|service_role|client_secret|pdf|montant|financial|amount|loyer|encaisse|reliquat|contrat|payload)/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER = /bearer\s+[a-z0-9._~+/=-]+/gi;
const LONG_TOKEN = /\b[a-z0-9_-]{32,}\b/gi;

export const TELEMETRY_REDACTED = '[redacted]';

export function redactTelemetryString(value: string): string {
  return value
    .replace(EMAIL, TELEMETRY_REDACTED)
    .replace(BEARER, `Bearer ${TELEMETRY_REDACTED}`)
    .replace(LONG_TOKEN, TELEMETRY_REDACTED);
}

export function sanitizeTelemetryData(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (depth > 5) return '[truncated]';
  if (typeof value === 'string') return redactTelemetryString(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeTelemetryData(item, depth + 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 75)
      .map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key)
          ? TELEMETRY_REDACTED
          : sanitizeTelemetryData(item, depth + 1, seen),
      ]),
  );
}

export function safeTelemetryPath(path: string): string {
  return path.split('?')[0].split('#')[0] || '/';
}
