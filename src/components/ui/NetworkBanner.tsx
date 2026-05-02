/**
 * NetworkBanner — barre de statut réseau + sync offline.
 * - Hors ligne : rouge, compte les actions en attente de sync
 * - Connexion rétablie : vert 3 s + "synchronisation en cours" pendant le flush de la queue
 * - En sync : bleu avec spinner
 */

import { useEffect, useState, useCallback } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { getPendingCount, syncPendingMutations } from '../../services/offlineQueue';

interface NetworkBannerProps {
  onSyncComplete?: (synced: number) => void;
}

export function NetworkBanner({ onSyncComplete }: NetworkBannerProps = {}) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncedCount, setSyncedCount] = useState<number | null>(null);

  const refreshPending = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  const doSync = useCallback(async () => {
    const count = await getPendingCount();
    if (count === 0) return;
    setSyncing(true);
    try {
      const result = await syncPendingMutations();
      setSyncedCount(result.synced);
      onSyncComplete?.(result.synced);
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  }, [refreshPending, onSyncComplete]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      setSyncedCount(null);
      doSync().then(() => {
        setTimeout(() => setShowRestored(false), 4000);
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
      setSyncedCount(null);
      refreshPending();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [doSync, refreshPending]);

  if (isOnline && !showRestored && !syncing) return null;

  if (!isOnline) {
    return (
      <div className="bg-red-600 text-white px-4 py-2.5 flex items-center gap-3 text-sm font-medium z-50 flex-shrink-0">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        <span>
          Mode hors ligne
          {pendingCount > 0
            ? ` — ${pendingCount} action${pendingCount > 1 ? 's' : ''} seront synchronisées automatiquement`
            : ' — les données seront synchronisées dès le retour de connexion'}
        </span>
      </div>
    );
  }

  if (syncing) {
    return (
      <div className="bg-blue-600 text-white px-4 py-2.5 flex items-center gap-3 text-sm font-medium z-50 flex-shrink-0">
        <RefreshCw className="w-4 h-4 flex-shrink-0 animate-spin" />
        <span>Synchronisation des données en cours…</span>
      </div>
    );
  }

  return (
    <div className="bg-emerald-600 text-white px-4 py-2.5 flex items-center gap-3 text-sm font-medium z-50 flex-shrink-0">
      <Wifi className="w-4 h-4 flex-shrink-0" />
      <span>
        Connexion rétablie
        {syncedCount !== null && syncedCount > 0
          ? ` — ${syncedCount} action${syncedCount > 1 ? 's' : ''} synchronisée${syncedCount > 1 ? 's' : ''}`
          : ''}
      </span>
    </div>
  );
}
