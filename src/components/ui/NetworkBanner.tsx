/**
 * NetworkBanner — barre de statut réseau + sync offline.
 * - Hors ligne : rouge, compte les actions en attente de sync
 * - Connexion rétablie : vert 3 s + résultat du sync
 * - En sync : bleu avec spinner
 * - Erreurs de sync : orange avec détail
 */

import { useEffect, useState, useCallback } from 'react';
import { WifiOff, Wifi, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  getPendingCount,
  getErrorMutations,
  syncPendingMutations,
  type SyncResult,
} from '../../services/offlineQueue';

interface NetworkBannerProps {
  onSyncComplete?: (result: SyncResult) => void;
}

export function NetworkBanner({ onSyncComplete }: NetworkBannerProps = {}) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const refreshCounts = useCallback(async () => {
    const [count, errMutations] = await Promise.all([
      getPendingCount(),
      getErrorMutations(),
    ]);
    setPendingCount(count);
    setErrorCount(errMutations.length);
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  const doSync = useCallback(async () => {
    const count = await getPendingCount();
    if (count === 0) return;
    setSyncing(true);
    try {
      const result = await syncPendingMutations();
      setLastResult(result);
      onSyncComplete?.(result);
      await refreshCounts();
    } finally {
      setSyncing(false);
    }
  }, [refreshCounts, onSyncComplete]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      setLastResult(null);
      doSync().then(() => {
        setTimeout(() => setShowRestored(false), 5000);
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
      setLastResult(null);
      refreshCounts();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [doSync, refreshCounts]);

  if (isOnline && !showRestored && !syncing && errorCount === 0) return null;

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

  if (errorCount > 0 && !syncing) {
    return (
      <div className="bg-amber-600 text-white px-4 py-2.5 flex items-center gap-3 text-sm font-medium z-50 flex-shrink-0">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>
          {errorCount} action{errorCount > 1 ? 's' : ''} n'ont pas pu être synchronisée{errorCount > 1 ? 's' : ''} — ouvrez le panneau de sauvegarde pour voir le détail.
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
        {lastResult && lastResult.synced > 0
          ? ` — ${lastResult.synced} action${lastResult.synced > 1 ? 's' : ''} synchronisée${lastResult.synced > 1 ? 's' : ''}`
          : ''}
        {lastResult && lastResult.errors > 0
          ? ` — ${lastResult.errors} erreur${lastResult.errors > 1 ? 's' : ''}`
          : ''}
      </span>
    </div>
  );
}
