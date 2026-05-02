/**
 * useOfflineSync — gère la file d'attente offline et la synchronisation
 * automatique dès que la connexion est rétablie.
 *
 * Nouveautés v2 :
 *   - Récupération des entrées 'syncing' bloquées au montage
 *   - lastSyncResult exposé pour afficher un feedback post-sync à l'UI
 *   - Compteur d'erreurs de sync exposé
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  enqueueMutation,
  getPendingCount,
  syncPendingMutations,
  recoverStaleSyncing,
  getErrorMutations,
  type MutationAction,
  type PendingMutation,
  type SyncResult,
} from '../services/offlineQueue';

export interface UseOfflineSyncReturn {
  isOnline: boolean;
  pendingCount: number;
  errorCount: number;
  syncing: boolean;
  syncProgress: { done: number; total: number } | null;
  lastSyncResult: SyncResult | null;
  enqueue: (mutation: Omit<PendingMutation, 'id' | 'status' | 'retries'>) => Promise<void>;
  syncNow: () => Promise<SyncResult>;
  refreshPendingCount: () => Promise<void>;
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const [count, errMutations] = await Promise.all([
      getPendingCount(),
      getErrorMutations(),
    ]);
    setPendingCount(count);
    setErrorCount(errMutations.length);
  }, []);

  useEffect(() => {
    recoverStaleSyncing().then((recovered) => {
      if (recovered > 0) refreshPendingCount();
    });
    refreshPendingCount();
  }, [refreshPendingCount]);

  const doSync = useCallback(async (): Promise<SyncResult> => {
    if (syncingRef.current) return { synced: 0, errors: 0, errorMessages: [] };
    syncingRef.current = true;
    setSyncing(true);
    setSyncProgress({ done: 0, total: 0 });
    try {
      const result = await syncPendingMutations((done, total) => {
        setSyncProgress({ done, total });
      });
      setLastSyncResult(result);
      await refreshPendingCount();
      return result;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      setSyncProgress(null);
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      doSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [doSync]);

  const enqueue = useCallback(
    async (mutation: Omit<PendingMutation, 'id' | 'status' | 'retries'>) => {
      await enqueueMutation({ ...mutation, action: mutation.action as MutationAction });
      await refreshPendingCount();
    },
    [refreshPendingCount],
  );

  return {
    isOnline,
    pendingCount,
    errorCount,
    syncing,
    syncProgress,
    lastSyncResult,
    enqueue,
    syncNow: doSync,
    refreshPendingCount,
  };
}
