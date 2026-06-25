/**
 * NetworkBanner - statut reseau + synchronisation offline.
 * Le hook useNetworkStatus centralise la detection offline/reconnexion/lenteur.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Gauge, RefreshCw, Wifi, WifiOff, X } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
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
  const { isOnline, isReconnecting, isSlowConnection, connectionLabel } = useNetworkStatus();
  const [showRestored, setShowRestored] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const bannerKey = !isOnline
    ? 'offline'
    : errorCount > 0 && !syncing
      ? 'errors'
      : syncing
        ? 'syncing'
        : isSlowConnection
          ? 'slow'
          : showRestored
            ? 'restored'
            : 'none';

  useEffect(() => {
    if (bannerKey !== dismissedKey && bannerKey !== 'none') return;
    if (bannerKey === 'none') setDismissedKey(null);
  }, [bannerKey, dismissedKey]);

  const refreshCounts = useCallback(async () => {
    const [count, errMutations] = await Promise.all([
      getPendingCount(),
      getErrorMutations(),
    ]);
    setPendingCount(count);
    setErrorCount(errMutations.length);
  }, []);

  const doSync = useCallback(async () => {
    const count = await getPendingCount();
    if (count === 0) {
      await refreshCounts();
      return;
    }

    setSyncing(true);
    try {
      const result = await syncPendingMutations();
      setLastResult(result);
      onSyncComplete?.(result);
      await refreshCounts();
    } finally {
      setSyncing(false);
    }
  }, [onSyncComplete, refreshCounts]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    if (!isOnline) {
      setShowRestored(false);
      setLastResult(null);
      void refreshCounts();
      return undefined;
    }

    if (!isReconnecting) return undefined;

    setShowRestored(true);
    setLastResult(null);
    void doSync();

    const timer = window.setTimeout(() => setShowRestored(false), 5200);
    return () => window.clearTimeout(timer);
  }, [doSync, isOnline, isReconnecting, refreshCounts]);

  if (isOnline && !showRestored && !syncing && errorCount === 0 && !isSlowConnection) return null;
  if (dismissedKey === bannerKey && bannerKey !== 'syncing' && bannerKey !== 'errors') return null;

  const dismissButton = bannerKey !== 'syncing' ? (
    <button
      type="button"
      onClick={() => setDismissedKey(bannerKey)}
      className="ml-auto inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/12 transition hover:bg-white/20"
      aria-label="Masquer le bandeau reseau"
    >
      <X className="h-3 w-3" />
    </button>
  ) : null;

  if (!isOnline) {
    return (
      <div className="z-50 flex flex-shrink-0 items-center gap-2 bg-red-700 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm">
        <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          Connexion interrompue.
          {pendingCount > 0
            ? ` ${pendingCount} action${pendingCount > 1 ? 's' : ''} en attente seront synchronisees automatiquement.`
            : ' Vous pouvez continuer, les donnees seront synchronisees au retour du reseau.'}
        </span>
        {dismissButton}
      </div>
    );
  }

  if (errorCount > 0 && !syncing) {
    return (
      <div className="z-50 flex flex-shrink-0 items-center gap-2 bg-action-700 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm">
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          {errorCount} action{errorCount > 1 ? 's' : ''} n'ont pas encore pu etre synchronisee{errorCount > 1 ? 's' : ''}.
          La file locale est conservee et une nouvelle tentative sera lancee.
        </span>
        {dismissButton}
      </div>
    );
  }

  if (syncing) {
    return (
      <div className="z-50 flex flex-shrink-0 items-center gap-2 bg-brand-800 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm">
        <RefreshCw className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />
        <span>Connexion retrouvee, synchronisation en cours...</span>
      </div>
    );
  }

  if (isSlowConnection) {
    return (
      <div className="z-50 flex flex-shrink-0 items-center gap-2 bg-amber-700 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm">
        <Gauge className="h-3.5 w-3.5 flex-shrink-0" />
        <span>Connexion lente detectee ({connectionLabel}). L'application privilegie le cache local quand c'est possible.</span>
        {dismissButton}
      </div>
    );
  }

  return (
    <div className="z-50 flex flex-shrink-0 items-center gap-2 bg-brand-700 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm">
      <Wifi className="h-3.5 w-3.5 flex-shrink-0" />
      <span>
        Connexion retablie
        {lastResult && lastResult.synced > 0
          ? ` - ${lastResult.synced} action${lastResult.synced > 1 ? 's' : ''} synchronisee${lastResult.synced > 1 ? 's' : ''}`
          : ''}
        {lastResult && lastResult.errors > 0
          ? ` - ${lastResult.errors} erreur${lastResult.errors > 1 ? 's' : ''}`
          : ''}
      </span>
      {dismissButton}
    </div>
  );
}
