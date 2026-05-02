/**
 * Local backup service — snapshots critical data to IndexedDB.
 * Triggers: on explicit call (after mutations) + periodic (daily).
 * Download: serialise all stores as JSON and trigger browser download.
 */

import { dbPut, dbGet, dbGetAll, dbClear } from './db';

export type SnapshotKey = 'locataires' | 'paiements' | 'contrats';

const SNAPSHOT_KEYS: SnapshotKey[] = ['locataires', 'paiements', 'contrats'];
const BACKUP_TIMESTAMP_KEY = 'samay_last_backup_ts';

export interface BackupMeta {
  timestamp: number;
  counts: Record<string, number>;
}

/** Sauvegarde un snapshot d'une entité dans IndexedDB */
export async function saveSnapshot(key: SnapshotKey, data: unknown[]): Promise<void> {
  try {
    await dbPut('snapshots', { id: key, data, timestamp: Date.now() });
    localStorage.setItem(BACKUP_TIMESTAMP_KEY, String(Date.now()));
  } catch (err) {
    console.warn('[Backup] saveSnapshot failed:', err);
  }
}

/** Lit le dernier snapshot d'une entité */
export async function loadSnapshot(key: SnapshotKey): Promise<{ data: unknown[]; timestamp: number } | null> {
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

/** Génère et déclenche le téléchargement d'un fichier JSON de sauvegarde */
export async function downloadBackup(): Promise<BackupMeta> {
  const snaps = await dbGetAll('snapshots');
  const pending = await dbGetAll('pending_mutations');

  const payload: Record<string, unknown> = {
    _meta: {
      version: 1,
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

/** Restaure les snapshots depuis un fichier JSON téléchargé */
export async function restoreFromFile(file: File): Promise<{ restored: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string) as Record<string, unknown>;
        const restored: string[] = [];

        for (const key of SNAPSHOT_KEYS) {
          if (Array.isArray(raw[key])) {
            await dbPut('snapshots', {
              id: key,
              data: raw[key] as unknown[],
              timestamp: Date.now(),
            });
            restored.push(key);
          }
        }

        localStorage.setItem(BACKUP_TIMESTAMP_KEY, String(Date.now()));
        resolve({ restored });
      } catch (err) {
        reject(err);
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
