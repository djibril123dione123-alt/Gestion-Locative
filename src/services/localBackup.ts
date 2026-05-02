/**
 * Local backup service — snapshots ALL critical tables to IndexedDB.
 * Covers: agences, bailleurs, immeubles, unites, locataires, contrats, paiements.
 *
 * Restore strategy: merge (default) — keeps records not in the backup file,
 * adds/updates only what the file contains. Never overwrites blindly.
 */

import { dbPut, dbGet, dbGetAll, dbClear } from './db';
import { supabase } from '../lib/supabase';

export type SnapshotKey =
  | 'agences'
  | 'bailleurs'
  | 'immeubles'
  | 'unites'
  | 'locataires'
  | 'contrats'
  | 'paiements';

export const ALL_SNAPSHOT_KEYS: SnapshotKey[] = [
  'agences',
  'bailleurs',
  'immeubles',
  'unites',
  'locataires',
  'contrats',
  'paiements',
];

const BACKUP_TIMESTAMP_KEY = 'samay_last_backup_ts';
const BACKUP_VERSION = 2;

export interface BackupMeta {
  timestamp: number;
  counts: Record<string, number>;
}

export interface BackupPreview {
  version: number;
  exported_at: string;
  counts: Record<string, number>;
  tables: SnapshotKey[];
  hasPendingMutations: boolean;
}

/** Sauvegarde un snapshot d'une entité dans IndexedDB */
export async function saveSnapshot(key: SnapshotKey, data: unknown[]): Promise<void> {
  try {
    await dbPut('snapshots', { id: key, data, timestamp: Date.now() });
    localStorage.setItem(BACKUP_TIMESTAMP_KEY, String(Date.now()));
  } catch (err) {
    console.warn('[Backup] saveSnapshot failed:', key, err);
  }
}

/** Lit le dernier snapshot d'une entité */
export async function loadSnapshot(
  key: SnapshotKey,
): Promise<{ data: unknown[]; timestamp: number } | null> {
  try {
    const snap = await dbGet('snapshots', key);
    if (!snap) return null;
    return { data: snap.data as unknown[], timestamp: snap.timestamp };
  } catch {
    return null;
  }
}

/** Retourne le timestamp de la dernière sauvegarde (ms) ou null */
export function getLastBackupTimestamp(): number | null {
  const v = localStorage.getItem(BACKUP_TIMESTAMP_KEY);
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

/**
 * Sauvegarde complète depuis Supabase → IndexedDB pour toutes les tables.
 * Appelé manuellement ou automatiquement (daily).
 */
export async function runFullBackup(agencyId: string): Promise<BackupMeta> {
  const counts: Record<string, number> = {};
  const tables: { key: SnapshotKey; table: string }[] = [
    { key: 'bailleurs', table: 'bailleurs' },
    { key: 'immeubles', table: 'immeubles' },
    { key: 'unites', table: 'unites' },
    { key: 'locataires', table: 'locataires' },
    { key: 'contrats', table: 'contrats' },
    { key: 'paiements', table: 'paiements' },
  ];

  await Promise.all(
    tables.map(async ({ key, table }) => {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('agency_id', agencyId);
        if (error) throw error;
        const rows = data ?? [];
        await saveSnapshot(key, rows);
        counts[key] = rows.length;
      } catch (err) {
        console.warn(`[Backup] Failed to backup table ${table}:`, err);
        counts[key] = -1;
      }
    }),
  );

  localStorage.setItem(BACKUP_TIMESTAMP_KEY, String(Date.now()));
  return { timestamp: Date.now(), counts };
}

/**
 * Génère et déclenche le téléchargement d'un fichier JSON de sauvegarde.
 * Inclut toutes les tables snapshotées + les mutations en attente.
 */
export async function downloadBackup(): Promise<BackupMeta> {
  const snaps = await dbGetAll('snapshots');
  const pending = await dbGetAll('pending_mutations');

  const payload: Record<string, unknown> = {
    _meta: {
      version: BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      app: 'Samay Këur',
    },
    pending_mutations: pending,
  };

  const counts: Record<string, number> = {};
  for (const snap of snaps) {
    const arr = snap.data as unknown[];
    payload[snap.id] = arr;
    counts[snap.id] = arr.length;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `samay-keur-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  return { timestamp: Date.now(), counts };
}

/**
 * Lit un fichier de sauvegarde et retourne un aperçu SANS rien écrire.
 * Permet d'afficher un résumé à l'utilisateur avant confirmation.
 */
export async function parseBackupPreview(file: File): Promise<BackupPreview> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string) as Record<string, unknown>;
        const meta = raw._meta as Record<string, unknown> | undefined;

        const counts: Record<string, number> = {};
        const tables: SnapshotKey[] = [];

        for (const key of ALL_SNAPSHOT_KEYS) {
          if (Array.isArray(raw[key])) {
            counts[key] = (raw[key] as unknown[]).length;
            tables.push(key);
          }
        }

        const pendingArr = raw.pending_mutations;
        const hasPendingMutations =
          Array.isArray(pendingArr) && (pendingArr as unknown[]).length > 0;

        resolve({
          version: Number(meta?.version ?? 1),
          exported_at: String(meta?.exported_at ?? ''),
          counts,
          tables,
          hasPendingMutations,
        });
      } catch (err) {
        reject(new Error('Fichier de sauvegarde invalide ou corrompu.'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Restaure les snapshots depuis un fichier JSON.
 *
 * strategy:
 *   'merge'     — garde les enregistrements locaux non présents dans le fichier,
 *                  met à jour ceux qui y figurent (par id). Recommandé.
 *   'overwrite' — remplace entièrement chaque store local par le contenu du fichier.
 *
 * keys: liste des tables à restaurer (toutes par défaut).
 */
export async function restoreFromFile(
  file: File,
  strategy: 'merge' | 'overwrite' = 'merge',
  keys: SnapshotKey[] = ALL_SNAPSHOT_KEYS,
): Promise<{ restored: string[]; skipped: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string) as Record<string, unknown>;
        const restored: string[] = [];
        const skipped: string[] = [];

        for (const key of keys) {
          if (!Array.isArray(raw[key])) {
            skipped.push(key);
            continue;
          }

          const incomingRows = raw[key] as Array<Record<string, unknown>>;

          if (strategy === 'overwrite') {
            await dbPut('snapshots', {
              id: key,
              data: incomingRows,
              timestamp: Date.now(),
            });
          } else {
            const existing = await loadSnapshot(key);
            const existingMap = new Map<string, Record<string, unknown>>();
            if (existing) {
              for (const row of existing.data as Array<Record<string, unknown>>) {
                if (row.id) existingMap.set(String(row.id), row);
              }
            }

            for (const row of incomingRows) {
              if (row.id) existingMap.set(String(row.id), row);
            }

            await dbPut('snapshots', {
              id: key,
              data: Array.from(existingMap.values()),
              timestamp: Date.now(),
            });
          }

          restored.push(key);
        }

        localStorage.setItem(BACKUP_TIMESTAMP_KEY, String(Date.now()));
        resolve({ restored, skipped });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Vide tous les snapshots locaux */
export async function clearAllSnapshots(): Promise<void> {
  await dbClear('snapshots');
  localStorage.removeItem(BACKUP_TIMESTAMP_KEY);
}
