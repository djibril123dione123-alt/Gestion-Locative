/**
 * Offline mutation queue.
 *
 * Only low-risk tenant contact writes are replayable. Financial, contractual
 * and destructive operations always require an online server command.
 */

import { supabase } from '../lib/supabase';
import { dbDelete, dbGetAll, dbGetByIndex, dbPut } from './db';

export type MutationAction =
  | 'locataire_create'
  | 'locataire_update'
  | 'locataire_delete'
  | 'paiement_create'
  | 'paiement_update'
  | 'paiement_delete'
  | 'contrat_create'
  | 'contrat_update'
  | 'contrat_delete';

type OfflineMutationPolicy = 'replayable' | 'forbidden';

export const OFFLINE_MUTATION_POLICY: Readonly<Record<MutationAction, OfflineMutationPolicy>> = {
  locataire_create: 'replayable',
  locataire_update: 'replayable',
  locataire_delete: 'forbidden',
  paiement_create: 'forbidden',
  paiement_update: 'forbidden',
  paiement_delete: 'forbidden',
  contrat_create: 'forbidden',
  contrat_update: 'forbidden',
  contrat_delete: 'forbidden',
};

export interface PendingMutation {
  id?: number;
  action: MutationAction;
  entity_type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  created_at?: number;
  updated_at?: number;
  client_mutation_id?: string;
  mutation_key?: string;
  last_attempt_at?: number;
  next_retry_at?: number;
  status: 'pending' | 'syncing' | 'done' | 'error';
  retries?: number;
  error?: string;
}

export interface SyncResult {
  synced: number;
  errors: number;
  errorMessages: string[];
}

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 5 * 60_000;

export const OFFLINE_MUTATION_BLOCKED_MESSAGE =
  'Cette action exige une connexion active afin de garantir son contrôle serveur.';

function makeClientMutationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isReplayable(action: MutationAction): boolean {
  return OFFLINE_MUTATION_POLICY[action] === 'replayable';
}

function retryDelayMs(retries: number): number {
  const jitter = Math.floor(Math.random() * 1_500);
  return Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** Math.max(0, retries - 1)) + jitter;
}

function buildMutationKey(mutation: Pick<PendingMutation, 'action' | 'entity_type' | 'payload'>): string {
  const recordId = mutation.payload.id;
  if (typeof recordId === 'string' && recordId.trim()) {
    return `${mutation.action}:${mutation.entity_type}:${recordId}`;
  }
  return `${mutation.action}:${mutation.entity_type}:${makeClientMutationId()}`;
}

async function removeMutation(mutation: PendingMutation): Promise<void> {
  if (mutation.id !== undefined) await dbDelete('pending_mutations', mutation.id);
}

/** Remove critical writes left by clients that used the historical queue. */
export async function purgeOfflineMutationQueue(): Promise<number> {
  try {
    const all = (await dbGetAll('pending_mutations')) as PendingMutation[];
    const forbidden = all.filter((mutation) => !isReplayable(mutation.action));
    await Promise.all(forbidden.map(removeMutation));
    return forbidden.length;
  } catch {
    return 0;
  }
}

/** Recover replayable writes interrupted while the app was closing. */
export async function recoverStaleSyncing(): Promise<number> {
  try {
    const all = (await dbGetAll('pending_mutations')) as PendingMutation[];
    let recovered = 0;
    for (const mutation of all) {
      if (!isReplayable(mutation.action)) {
        await removeMutation(mutation);
        continue;
      }
      if (mutation.status === 'syncing') {
        recovered += 1;
        await dbPut('pending_mutations', {
          ...mutation,
          status: 'pending',
          updated_at: Date.now(),
          next_retry_at: Date.now(),
        });
      }
    }
    return recovered;
  } catch {
    return 0;
  }
}

export async function enqueueMutation(
  mutation: Omit<PendingMutation, 'id' | 'status' | 'retries'>,
): Promise<void> {
  if (!isReplayable(mutation.action)) throw new Error(OFFLINE_MUTATION_BLOCKED_MESSAGE);

  const now = Date.now();
  const payload = { ...mutation.payload };
  if (mutation.action === 'locataire_create' && !payload.id) payload.id = makeClientMutationId();

  const mutationKey = mutation.mutation_key ?? buildMutationKey({ ...mutation, payload });
  const all = (await dbGetAll('pending_mutations')) as PendingMutation[];
  const duplicate = all.some(
    (entry) =>
      entry.mutation_key === mutationKey &&
      (entry.status === 'pending' || entry.status === 'syncing'),
  );
  if (duplicate) return;

  await dbPut('pending_mutations', {
    ...mutation,
    payload,
    client_mutation_id: mutation.client_mutation_id ?? makeClientMutationId(),
    mutation_key: mutationKey,
    created_at: mutation.created_at ?? now,
    updated_at: now,
    next_retry_at: mutation.next_retry_at ?? now,
    status: 'pending',
    retries: 0,
  });
}

export async function getPendingMutations(): Promise<PendingMutation[]> {
  await purgeOfflineMutationQueue();
  try {
    const pending = await dbGetByIndex('pending_mutations', 'status', 'pending');
    const now = Date.now();
    return (pending as PendingMutation[])
      .filter((mutation) => isReplayable(mutation.action) && (mutation.next_retry_at ?? 0) <= now)
      .sort((left, right) => left.timestamp - right.timestamp);
  } catch {
    return [];
  }
}

export async function getPendingCount(): Promise<number> {
  await purgeOfflineMutationQueue();
  try {
    const all = (await dbGetAll('pending_mutations')) as PendingMutation[];
    return all.filter(
      (mutation) =>
        isReplayable(mutation.action) &&
        (mutation.status === 'pending' || mutation.status === 'syncing'),
    ).length;
  } catch {
    return 0;
  }
}

export async function getErrorMutations(): Promise<PendingMutation[]> {
  await purgeOfflineMutationQueue();
  try {
    const all = (await dbGetAll('pending_mutations')) as PendingMutation[];
    return all.filter((mutation) => isReplayable(mutation.action) && mutation.status === 'error');
  } catch {
    return [];
  }
}

async function getReplayContext(action: MutationAction): Promise<{ agencyId: string }> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) throw new Error('Session expirée. Reconnectez-vous avant la synchronisation.');

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('agency_id, actif')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile?.agency_id || profile.actif === false) {
    throw new Error('Ce profil ne peut plus synchroniser de données.');
  }

  const permissionAction = action === 'locataire_create' ? 'create' : 'update';
  const { data: allowed, error: permissionError } = await supabase.rpc('fn_user_can', {
    p_user_id: user.id,
    p_page: 'locataires',
    p_action: permissionAction,
  });
  if (permissionError || allowed !== true) {
    throw new Error('Vos permissions ne permettent plus cette synchronisation.');
  }

  return { agencyId: profile.agency_id };
}

async function replayLocataireMutation(mutation: PendingMutation): Promise<void> {
  const { agencyId } = await getReplayContext(mutation.action);
  const payloadAgencyId = mutation.payload.agency_id;
  if (typeof payloadAgencyId === 'string' && payloadAgencyId !== agencyId) {
    throw new Error('La synchronisation appartient à un autre espace de travail.');
  }

  if (mutation.action === 'locataire_create') {
    const { error } = await supabase.from('locataires').insert({
      ...mutation.payload,
      agency_id: agencyId,
    });
    // A generated client id makes a successful replay idempotent after a lost response.
    if (error && error.code !== '23505') throw error;
    return;
  }

  if (mutation.action === 'locataire_update') {
    const { id, agency_id: ignoredAgencyId, ...changes } = mutation.payload;
    void ignoredAgencyId;
    if (typeof id !== 'string' || !id) throw new Error('Fiche locataire introuvable.');

    const { data, error } = await supabase
      .from('locataires')
      .update(changes)
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Cette fiche n’est plus accessible dans votre organisation.');
    return;
  }

  throw new Error(OFFLINE_MUTATION_BLOCKED_MESSAGE);
}

export async function syncPendingMutations(
  onProgress?: (done: number, total: number) => void,
): Promise<SyncResult> {
  const mutations = await getPendingMutations();
  let synced = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  for (let index = 0; index < mutations.length; index += 1) {
    const mutation = mutations[index];
    try {
      if (mutation.id !== undefined) {
        await dbPut('pending_mutations', {
          ...mutation,
          status: 'syncing',
          last_attempt_at: Date.now(),
          updated_at: Date.now(),
        });
      }

      await replayLocataireMutation(mutation);
      await removeMutation(mutation);
      synced += 1;
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      errorMessages.push(`[${mutation.action}] ${message}`);
      const retries = (mutation.retries ?? 0) + 1;
      const status: PendingMutation['status'] = retries >= MAX_RETRIES ? 'error' : 'pending';
      const now = Date.now();
      if (mutation.id !== undefined) {
        await dbPut('pending_mutations', {
          ...mutation,
          status,
          retries,
          error: message,
          updated_at: now,
          last_attempt_at: now,
          next_retry_at: status === 'pending' ? now + retryDelayMs(retries) : undefined,
        });
      }
    }
    onProgress?.(index + 1, mutations.length);
  }

  return { synced, errors, errorMessages };
}

export async function clearDoneMutations(): Promise<void> {
  const all = (await dbGetAll('pending_mutations')) as PendingMutation[];
  await Promise.all(
    all
      .filter((mutation) => mutation.status === 'done' || mutation.status === 'error')
      .map(removeMutation),
  );
}
