/**
 * Offline mutation queue — stores pending actions in IndexedDB
 * and replays them against the real backend when connectivity is restored.
 *
 * Conflict strategy: last-write-wins (timestamp-based).
 * Stale 'syncing' entries (left over after a crash) are recovered to 'pending'
 * on startup via recoverStaleSyncing().
 *
 * IMPORTANT: paiement mutations are routed through Edge Functions to ensure
 * server-side commission calculation, ledger writes, and event_outbox entries.
 * Direct table inserts for paiements would bypass all financial integrity logic.
 */

import { dbPut, dbGetAll, dbDelete, dbGetByIndex } from './db';
import {
  createPaiementViaEdge,
  updatePaiementViaEdge,
  cancelPaiementViaEdge,
} from './api/paiementApi';
import { supabase } from '../lib/supabase';

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

const ACTION_TABLE: Record<MutationAction, string> = {
  locataire_create: 'locataires',
  locataire_update: 'locataires',
  locataire_delete: 'locataires',
  paiement_create: 'paiements',
  paiement_update: 'paiements',
  paiement_delete: 'paiements',
  contrat_create: 'contrats',
  contrat_update: 'contrats',
  contrat_delete: 'contrats',
};

function makeClientMutationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildMutationKey(mutation: Pick<PendingMutation, 'action' | 'entity_type' | 'payload'>): string {
  const idempotencyKey = mutation.payload.idempotency_key;
  if (typeof idempotencyKey === 'string' && idempotencyKey.trim()) {
    return `${mutation.action}:idempotency:${idempotencyKey}`;
  }
  const id = mutation.payload.id;
  if (typeof id === 'string' && id.trim()) {
    return `${mutation.action}:${mutation.entity_type}:${id}`;
  }
  return `${mutation.action}:${mutation.entity_type}:${makeClientMutationId()}`;
}

function retryDelayMs(retries: number): number {
  const jitter = Math.floor(Math.random() * 1_500);
  return Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** Math.max(0, retries - 1)) + jitter;
}

/** Resets any stale 'syncing' entries back to 'pending'.
 *  Call once at app startup — guards against crash during a previous sync. */
export async function recoverStaleSyncing(): Promise<number> {
  try {
    const all = (await dbGetAll('pending_mutations')) as PendingMutation[];
    const stale = all.filter((m) => m.status === 'syncing');
    for (const m of stale) {
      await dbPut('pending_mutations', {
        ...m,
        status: 'pending',
        updated_at: Date.now(),
        next_retry_at: Date.now(),
      });
    }
    return stale.length;
  } catch {
    return 0;
  }
}

/** Enqueue a mutation for later sync */
export async function enqueueMutation(
  mutation: Omit<PendingMutation, 'id' | 'status' | 'retries'>,
): Promise<void> {
  try {
    const now = Date.now();
    const mutationKey = mutation.mutation_key ?? buildMutationKey(mutation);
    const all = (await dbGetAll('pending_mutations')) as PendingMutation[];
    const duplicate = all.find(
      (m) =>
        m.mutation_key === mutationKey &&
        (m.status === 'pending' || m.status === 'syncing'),
    );
    if (duplicate) return;

    await dbPut('pending_mutations', {
      ...mutation,
      client_mutation_id: mutation.client_mutation_id ?? makeClientMutationId(),
      mutation_key: mutationKey,
      created_at: mutation.created_at ?? now,
      updated_at: now,
      next_retry_at: mutation.next_retry_at ?? now,
      status: 'pending',
      retries: 0,
    } as PendingMutation);
  } catch (err) {
    console.warn('[OfflineQueue] Failed to enqueue mutation:', err);
  }
}

/** Returns all pending mutations (sorted oldest-first) */
export async function getPendingMutations(): Promise<PendingMutation[]> {
  try {
    const all = await dbGetByIndex('pending_mutations', 'status', 'pending');
    const now = Date.now();
    return (all as PendingMutation[])
      .filter((m) => (m.next_retry_at ?? 0) <= now)
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}

/** Returns total count of pending mutations */
export async function getPendingCount(): Promise<number> {
  try {
    const [pending, syncing] = await Promise.all([
      dbGetByIndex('pending_mutations', 'status', 'pending'),
      dbGetByIndex('pending_mutations', 'status', 'syncing'),
    ]);
    return pending.length + syncing.length;
  } catch {
    return 0;
  }
}

/** Returns all mutations that have permanently errored (>= MAX_RETRIES) */
export async function getErrorMutations(): Promise<PendingMutation[]> {
  try {
    const all = (await dbGetAll('pending_mutations')) as PendingMutation[];
    return all.filter((m) => m.status === 'error');
  } catch {
    return [];
  }
}

/**
 * Replay all pending mutations against Supabase.
 *
 * Paiement mutations (create/update/delete) are routed through Edge Functions
 * to guarantee server-side commission calculation, ledger entries, and
 * event_outbox population. All other mutations use direct table operations.
 */
export async function syncPendingMutations(
  onProgress?: (done: number, total: number) => void,
): Promise<SyncResult> {
  const mutations = await getPendingMutations();
  let synced = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  for (let i = 0; i < mutations.length; i++) {
    const m = mutations[i];
    const table = ACTION_TABLE[m.action];
    if (!table) continue;

    try {
      if (m.id !== undefined) {
        await dbPut('pending_mutations', {
          ...m,
          status: 'syncing',
          last_attempt_at: Date.now(),
          updated_at: Date.now(),
        });
      }

      // ── Paiement mutations → Edge Functions (financial integrity) ──────────
      if (m.action === 'paiement_create') {
        await createPaiementViaEdge({
          contrat_id: m.payload.contrat_id as string,
          montant_total: m.payload.montant_total as number,
          mois_concerne: m.payload.mois_concerne as string,
          date_paiement: m.payload.date_paiement as string,
          mode_paiement: m.payload.mode_paiement as
            | 'especes'
            | 'virement'
            | 'cheque'
            | 'mobile_money'
            | 'autre',
          statut: m.payload.statut as 'paye' | 'partiel' | 'en_attente',
          idempotency_key: (m.payload.idempotency_key as string | null | undefined) ?? null,
          reference: (m.payload.reference as string | null) ?? null,
        });
      } else if (m.action === 'paiement_update') {
        await updatePaiementViaEdge({
          id: m.payload.id as string,
          ...(m.payload.montant_total != null && {
            montant_total: m.payload.montant_total as number,
          }),
          ...(m.payload.mode_paiement != null && {
            mode_paiement: m.payload.mode_paiement as
              | 'especes'
              | 'virement'
              | 'cheque'
              | 'mobile_money'
              | 'autre',
          }),
          ...(m.payload.statut != null && {
            statut: m.payload.statut as 'paye' | 'partiel' | 'en_attente',
          }),
          ...(m.payload.date_paiement != null && {
            date_paiement: m.payload.date_paiement as string,
          }),
          ...(m.payload.reference !== undefined && {
            reference: m.payload.reference as string | null,
          }),
        });
      } else if (m.action === 'paiement_delete') {
        await cancelPaiementViaEdge({ id: m.payload.id as string });

      // ── Autres mutations → opérations Supabase directes ───────────────────
      } else {
        const isCreate = m.action.endsWith('_create');
        const isDelete = m.action.endsWith('_delete');
        let supabaseError: unknown;

        if (isDelete) {
          const { id } = m.payload;
          if (!id) { errors++; continue; }
          const { error } = await supabase.from(table).delete().eq('id', id);
          supabaseError = error;
        } else if (isCreate) {
          const { error } = await supabase.from(table).insert([m.payload]);
          supabaseError = error;
        } else {
          const { id, ...rest } = m.payload;
          if (!id) { errors++; continue; }
          const { error } = await supabase.from(table).update(rest).eq('id', id);
          supabaseError = error;
        }

        if (supabaseError) throw supabaseError;
      }

      if (m.id !== undefined) await dbDelete('pending_mutations', m.id as number);
      synced++;
    } catch (err: unknown) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      errorMessages.push(`[${m.action}] ${msg}`);

      const retries = (m.retries ?? 0) + 1;
      if (m.id !== undefined) {
        const newStatus: PendingMutation['status'] = retries >= MAX_RETRIES ? 'error' : 'pending';
        const now = Date.now();
        await dbPut('pending_mutations', {
          ...m,
          status: newStatus,
          retries,
          error: msg,
          updated_at: now,
          last_attempt_at: now,
          next_retry_at: newStatus === 'pending' ? now + retryDelayMs(retries) : undefined,
        });
      }
    }

    onProgress?.(i + 1, mutations.length);
  }

  return { synced, errors, errorMessages };
}

/** Clear all done + permanently-errored mutations */
export async function clearDoneMutations(): Promise<void> {
  const all = (await dbGetAll('pending_mutations')) as PendingMutation[];
  for (const m of all) {
    if (m.status === 'done' || m.status === 'error') {
      if (m.id !== undefined) await dbDelete('pending_mutations', m.id as number);
    }
  }
}
