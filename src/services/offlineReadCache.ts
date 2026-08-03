import { dbPut, dbGet, dbGetAll, dbDelete, dbClear } from './db';

export interface CacheScope {
  agencyId: string | null;
  userId: string | null;
}

export interface CachedValue<T> {
  data: T;
  timestamp: number;
}

export const DEFAULT_READ_TIMEOUT_MS = 8_000;
export const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

const CACHE_TTL_BY_DOMAIN: ReadonlyArray<[RegExp, number]> = [
  [/^(paiements|loyers-impayes|financial-dashboard|dashboard)/, 15 * 60 * 1000],
  [/^(contrats|documents)/, 30 * 60 * 1000],
  [/^(bailleurs|patrimoine|immeubles|unites|locataires|depenses)/, 60 * 60 * 1000],
];

export function getCacheTtlMs(key: string): number {
  return CACHE_TTL_BY_DOMAIN.find(([pattern]) => pattern.test(key))?.[1] ?? DEFAULT_CACHE_TTL_MS;
}

export class NetworkReadTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Network read timed out after ${timeoutMs}ms`);
    this.name = 'NetworkReadTimeoutError';
  }
}

export function isOfflineError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase();
  const isApplicationError = [
    'permission denied',
    'not authorized',
    'unauthorized',
    'forbidden',
    'row-level security',
    'violates row-level security',
    'invalid input',
    'validation failed',
  ].some((pattern) => message.includes(pattern));

  if (isApplicationError) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('internet') ||
    message.includes('load failed') ||
    message.includes('network read timed out')
  );
}

export function formatCacheTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function cacheId(scope: CacheScope, key: string): string {
  const agency = scope.agencyId || 'no-agency';
  const user = scope.userId || 'no-user';
  return `read:${agency}:${user}:${key}`;
}

export async function saveCachedValue<T>(scope: CacheScope, key: string, data: T): Promise<void> {
  if (!scope.agencyId || !scope.userId) return;
  await dbPut('snapshots', {
    id: cacheId(scope, key),
    data: [data],
    timestamp: Date.now(),
  });
}

export async function loadCachedValue<T>(
  scope: CacheScope,
  key: string,
  maxAgeMs: number = getCacheTtlMs(key),
): Promise<CachedValue<T> | null> {
  if (!scope.agencyId || !scope.userId) return null;
  const id = cacheId(scope, key);
  const snap = await dbGet('snapshots', id);
  if (!snap) return null;
  if (!Number.isFinite(snap.timestamp) || Date.now() - snap.timestamp > maxAgeMs) {
    await dbDelete('snapshots', id);
    return null;
  }
  return { data: snap.data[0] as T, timestamp: snap.timestamp };
}

export async function getCachedValueAge(scope: CacheScope, key: string): Promise<number | null> {
  const cached = await loadCachedValue(scope, key);
  return cached ? Date.now() - cached.timestamp : null;
}

export async function invalidateCachedValue(scope: CacheScope, key: string): Promise<void> {
  if (!scope.agencyId || !scope.userId) return;
  await dbDelete('snapshots', cacheId(scope, key));
}

export async function invalidateCachedValuesByPrefix(scope: CacheScope, keyPrefix: string): Promise<void> {
  if (!scope.agencyId || !scope.userId) return;
  const idPrefix = cacheId(scope, keyPrefix);
  const all = await dbGetAll('snapshots');
  await Promise.all(
    all
      .filter((snap) => snap.id.startsWith(idPrefix))
      .map((snap) => dbDelete('snapshots', snap.id)),
  );
}

export async function invalidateOperationalCaches(
  scope: CacheScope,
  domains: Array<'dashboard' | 'paiements' | 'impayes' | 'contrats' | 'bailleurs' | 'patrimoine' | 'documents' | 'finances' | 'depenses' | 'locataires'> = [
    'dashboard',
    'paiements',
    'impayes',
    'contrats',
    'bailleurs',
    'patrimoine',
    'documents',
    'finances',
    'depenses',
    'locataires',
  ],
): Promise<void> {
  const tasks: Array<Promise<void>> = [];
  const add = (key: string) => tasks.push(invalidateCachedValue(scope, key));
  const addPrefix = (key: string) => tasks.push(invalidateCachedValuesByPrefix(scope, key));

  if (domains.includes('dashboard')) {
    add('dashboard');
    addPrefix('dashboard:');
  }
  if (domains.includes('paiements')) add('paiements-page');
  if (domains.includes('impayes')) add('loyers-impayes-page');
  if (domains.includes('contrats')) add('contrats-page');
  if (domains.includes('bailleurs')) add('bailleurs-page');
  if (domains.includes('patrimoine')) {
    add('patrimoine-stats');
    add('immeubles-page');
    add('unites-page');
  }
  if (domains.includes('documents')) add('documents-page');
  if (domains.includes('finances')) addPrefix('financial-dashboard:');
  if (domains.includes('depenses')) add('depenses-page');
  if (domains.includes('locataires')) add('locataires-page');

  await Promise.all(tasks);
}

export function notifyDataChanged(domains: string[] = []) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('samaykeur:data-changed', { detail: { domains } }));
}

export async function withReadTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number = DEFAULT_READ_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = globalThis.setTimeout(() => reject(new NetworkReadTimeoutError(timeoutMs)), timeoutMs) as unknown as number;
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
  }
}

export async function readWithCache<T>(
  scope: CacheScope,
  key: string,
  fetcher: () => Promise<T>,
  options: {
    timeoutMs?: number;
    preferCacheWhenOffline?: boolean;
    validate?: (data: T) => boolean;
    maxCacheAgeMs?: number;
  } = {},
): Promise<CachedValue<T> & { source: 'network' | 'cache' }> {
  const preferCacheWhenOffline = options.preferCacheWhenOffline ?? true;
  const cached = await loadCachedValue<T>(scope, key, options.maxCacheAgeMs ?? getCacheTtlMs(key));

  const validCached = cached && (!options.validate || options.validate(cached.data)) ? cached : null;
  if (cached && !validCached) await invalidateCachedValue(scope, key);

  if (preferCacheWhenOffline && typeof navigator !== 'undefined' && !navigator.onLine && validCached) {
    return { ...validCached, source: 'cache' };
  }

  try {
    const requestedTimeout = options.timeoutMs ?? DEFAULT_READ_TIMEOUT_MS;
    const effectiveTimeout =
      typeof navigator !== 'undefined' && navigator.onLine
        ? Math.max(requestedTimeout, 12_000)
        : requestedTimeout;
    const data = await withReadTimeout(fetcher(), effectiveTimeout);
    if (options.validate && !options.validate(data)) {
      throw new Error('Cached read validation failed');
    }
    await saveCachedValue(scope, key, data);
    return { data, timestamp: Date.now(), source: 'network' };
  } catch (error) {
    if (isOfflineError(error) && validCached) {
      return { ...validCached, source: 'cache' };
    }
    throw error;
  }
}

export async function clearCachedValuesForUser(userId: string): Promise<void> {
  const all = await dbGetAll('snapshots');
  await Promise.all(
    all
      .filter((snap) => snap.id.startsWith('read:') && snap.id.includes(`:${userId}:`))
      .map((snap) => dbDelete('snapshots', snap.id)),
  );
}

/** Purges all tenant-scoped browser data when authentication context changes. */
export async function clearOfflineClientData(): Promise<void> {
  await Promise.all([dbClear('snapshots'), dbClear('pending_mutations')]);
  localStorage.removeItem('samay_last_backup_ts');

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    registration?.active?.postMessage({ type: 'PURGE_PRIVATE_DATA' });
  }
}
