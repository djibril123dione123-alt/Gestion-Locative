/**
 * useOfflineSync — gère la file d'attente offline et la synchronisation
 * automatique dès que la connexion est rétablie.
 *
 * Usage:
 *   const { isOnline, pendingCount, enqueue, syncNow, syncing } = useOfflineSync();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  enqueueMutation,
  getPendingCount,
  syncPendingMutations,
  type MutationAction,
  type PendingMutation,
} from '../services/offlineQueue';

export interface UseOfflineSyncReturn {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  syncProgress: { done: number; total: number } | null;
  enqueue: (mutation: Omit<PendingMutation, 'id' | 'status'>) => Promise<void>;
  syncNow: () => Promise<{ synced: number; errors: number }>;
  refreshPendingCount: () => Promise<void>;
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  const doSync = useCallback(async (): Promise<{ synced: number; errors: number }> => {
    if (syncingRef.current) return { synced: 0, errors: 0 };
    syncingRef.current = true;
    setSyncing(true);
    setSyncProgress({ done: 0, total: 0 });
    try {
      const result = await syncPendingMutations((done, total) => {
        setSyncProgress({ done, total });
      });
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
    async (mutation: Omit<PendingMutation, 'id' | 'status'>) => {
      await enqueueMutation({ ...mutation, action: mutation.action as MutationAction });
      await refreshPendingCount();
    },
    [refreshPendingCount],
  );

  return {
    isOnline,
    pendingCount,
    syncing,
    syncProgress,
    enqueue,
    syncNow: doSync,
    refreshPendingCount,
  };
}
