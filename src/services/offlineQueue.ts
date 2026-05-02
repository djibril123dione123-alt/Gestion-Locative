/**
 * Offline mutation queue — stores pending actions in IndexedDB
 * and replays them against the real backend when connectivity is restored.
 * Conflict strategy: last-write-wins (timestamp-based).
 */

import { dbPut, dbGetAll, dbDelete, dbGetByIndex } from './db';
import { supabase } from '../lib/supabase';

export type MutationAction =
  | 'locataire_create'
  | 'locataire_update'
  | 'paiement_create'
  | 'paiement_update'
  | 'contrat_create'
  | 'contrat_update';

export interface PendingMutation {
  id?: number;
  action: MutationAction;
  entity_type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  status: 'pending' | 'syncing' | 'done' | 'error';
  error?: string;
}

/** Table mapping per action */
const ACTION_TABLE: Record<MutationAction, string> = {
  locataire_create: 'locataires',
  locataire_update: 'locataires',
  paiement_create: 'paiements',
  paiement_update: 'paiements',
  contrat_create: 'contrats',
  contrat_update: 'contrats',
};

/** Enqueue a mutation for later sync */
export async function enqueueMutation(mutation: Omit<PendingMutation, 'id' | 'status'>): Promise<void> {
  try {
    await dbPut('pending_mutations', {
      ...mutation,
      status: 'pending',
    } as PendingMutation);
  } catch (err) {
    console.warn('[OfflineQueue] Failed to enqueue mutation:', err);
  }
}

/** Returns all pending mutations */
export async function getPendingMutations(): Promise<PendingMutation[]> {
  try {
    const all = await dbGetByIndex('pending_mutations', 'status', 'pending');
    return (all as PendingMutation[]).sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}

/** Returns count of all pending mutations */
export async function getPendingCount(): Promise<number> {
  const pending = await getPendingMutations();
  return pending.length;
}

/** Replay all pending mutations against Supabase */
export async function syncPendingMutations(
  onProgress?: (done: number, total: number) => void,
): Promise<{ synced: number; errors: number }> {
  const mutations = await getPendingMutations();
  let synced = 0;
  let errors = 0;

  for (let i = 0; i < mutations.length; i++) {
    const m = mutations[i];
    const table = ACTION_TABLE[m.action];
    if (!table) continue;

    try {
      const isCreate = m.action.endsWith('_create');
      let err: unknown;

      if (isCreate) {
        const { error } = await supabase.from(table).insert([m.payload]);
        err = error;
      } else {
        const { id, ...rest } = m.payload;
        if (!id) { errors++; continue; }
        const { error } = await supabase.from(table).update(rest).eq('id', id);
        err = error;
      }

      if (err) throw err;

      if (m.id !== undefined) await dbDelete('pending_mutations', m.id as number);
      synced++;
    } catch (err: unknown) {
      errors++;
      if (m.id !== undefined) {
        await dbPut('pending_mutations', {
          ...m,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    onProgress?.(i + 1, mutations.length);
  }

  return { synced, errors };
}

/** Clear all mutations (done + errors) */
export async function clearDoneMutations(): Promise<void> {
  const all = await dbGetAll('pending_mutations') as PendingMutation[];
  for (const m of all) {
    if (m.status === 'done' || m.status === 'error') {
      if (m.id !== undefined) await dbDelete('pending_mutations', m.id as number);
    }
  }
}
