/**
 * useBackup — gère la sauvegarde automatique locale et le téléchargement manuel.
 *
 * v2 : API étendue pour supporter parseBackupPreview + stratégie merge/overwrite.
 *
 * Usage:
 *   const { lastBackupTime, saving, save, download, preview, restore } = useBackup();
 */

import { useState, useCallback } from 'react';
import {
  saveSnapshot,
  loadSnapshot,
  downloadBackup,
  parseBackupPreview,
  restoreFromFile,
  getLastBackupTimestamp,
  type SnapshotKey,
  type BackupPreview,
} from '../services/localBackup';

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface UseBackupReturn {
  lastBackupTime: number | null;
  saving: boolean;
  downloading: boolean;
  save: (key: SnapshotKey, data: unknown[]) => Promise<void>;
  download: () => Promise<void>;
  preview: (file: File) => Promise<BackupPreview>;
  restore: (
    file: File,
    strategy?: 'merge' | 'overwrite',
    keys?: SnapshotKey[],
  ) => Promise<{ restored: string[]; skipped: string[] }>;
  getSnapshot: (key: SnapshotKey) => Promise<{ data: unknown[]; timestamp: number } | null>;
  isDailyBackupDue: () => boolean;
}

export function useBackup(): UseBackupReturn {
  const [lastBackupTime, setLastBackupTime] = useState<number | null>(() =>
    getLastBackupTimestamp(),
  );
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isDailyBackupDue = useCallback((): boolean => {
    const last = getLastBackupTimestamp();
    return !last || Date.now() - last > DAILY_INTERVAL_MS;
  }, []);

  const save = useCallback(async (key: SnapshotKey, data: unknown[]) => {
    setSaving(true);
    try {
      await saveSnapshot(key, data);
      setLastBackupTime(Date.now());
    } catch (err) {
      console.warn('[useBackup] save error:', err);
    } finally {
      setSaving(false);
    }
  }, []);

  const download = useCallback(async () => {
    setDownloading(true);
    try {
      const meta = await downloadBackup();
      setLastBackupTime(meta.timestamp);
    } catch (err) {
      console.warn('[useBackup] download error:', err);
    } finally {
      setDownloading(false);
    }
  }, []);

  const preview = useCallback(async (file: File): Promise<BackupPreview> => {
    return parseBackupPreview(file);
  }, []);

  const restore = useCallback(
    async (
      file: File,
      strategy: 'merge' | 'overwrite' = 'merge',
      keys?: SnapshotKey[],
    ) => {
      const result = await restoreFromFile(file, strategy, keys);
      setLastBackupTime(Date.now());
      return result;
    },
    [],
  );

  const getSnapshot = useCallback(
    (key: SnapshotKey) => loadSnapshot(key),
    [],
  );

  return {
    lastBackupTime,
    saving,
    downloading,
    save,
    download,
    preview,
    restore,
    getSnapshot,
    isDailyBackupDue,
  };
}
