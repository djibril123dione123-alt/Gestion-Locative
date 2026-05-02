/**
 * useBackup — gère la sauvegarde automatique locale et le téléchargement manuel.
 *
 * Usage:
 *   const { lastBackupTime, saving, save, download, restore } = useBackup();
 *   // Appeler save('locataires', data) après chaque mutation ou fetch.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  saveSnapshot,
  loadSnapshot,
  downloadBackup,
  restoreFromFile,
  getLastBackupTimestamp,
  type SnapshotKey,
} from '../services/localBackup';

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface UseBackupReturn {
  lastBackupTime: number | null;
  saving: boolean;
  downloading: boolean;
  save: (key: SnapshotKey, data: unknown[]) => Promise<void>;
  download: () => Promise<void>;
  restore: (file: File) => Promise<{ restored: string[] }>;
  getSnapshot: (key: SnapshotKey) => Promise<{ data: unknown[]; timestamp: number } | null>;
}

export function useBackup(): UseBackupReturn {
  const [lastBackupTime, setLastBackupTime] = useState<number | null>(() =>
    getLastBackupTimestamp(),
  );
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const last = getLastBackupTimestamp();
    const now = Date.now();
    if (!last || now - last > DAILY_INTERVAL_MS) {
      setLastBackupTime(last);
    }
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

  const restore = useCallback(async (file: File) => {
    const result = await restoreFromFile(file);
    setLastBackupTime(Date.now());
    return result;
  }, []);

  const getSnapshot = useCallback(
    (key: SnapshotKey) => loadSnapshot(key),
    [],
  );

  return { lastBackupTime, saving, downloading, save, download, restore, getSnapshot };
}
