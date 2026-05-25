import { useCallback, useEffect, useRef, useState } from 'react';

type NetworkInformationLike = {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
};

export interface NetworkStatus {
  isOnline: boolean;
  isReconnecting: boolean;
  wasOffline: boolean;
  isSlowConnection: boolean;
  connectionLabel: string;
  lastOnlineAt: number | null;
  lastOfflineAt: number | null;
}

const getConnection = (): NetworkInformationLike | undefined => {
  if (typeof navigator === 'undefined') return undefined;
  const nav = navigator as NavigatorWithConnection;
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
};

const readNetwork = (forcedOnline?: boolean) => {
  const connection = getConnection();
  const effectiveType = connection?.effectiveType?.toLowerCase();
  const isOnline = forcedOnline ?? (typeof navigator === 'undefined' ? true : navigator.onLine);
  const isSlowConnection =
    isOnline &&
    Boolean(
      connection?.saveData ||
        effectiveType === 'slow-2g' ||
        effectiveType === '2g' ||
        (typeof connection?.downlink === 'number' && connection.downlink > 0 && connection.downlink < 0.6) ||
        (typeof connection?.rtt === 'number' && connection.rtt > 900),
    );

  return {
    isOnline,
    isSlowConnection,
    connectionLabel: !isOnline
      ? 'hors ligne'
      : isSlowConnection
        ? 'connexion lente'
        : effectiveType
          ? effectiveType.toUpperCase()
          : 'en ligne',
  };
};

export function useNetworkStatus(): NetworkStatus {
  const initial = readNetwork();
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    ...initial,
    isReconnecting: false,
    wasOffline: !initial.isOnline,
    lastOnlineAt: initial.isOnline ? Date.now() : null,
    lastOfflineAt: initial.isOnline ? null : Date.now(),
  }));
  const statusRef = useRef(status);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const applySnapshot = useCallback(
    (forcedOnline?: boolean) => {
      const previous = statusRef.current;
      const snapshot = readNetwork(forcedOnline);
      const cameBackOnline = !previous.isOnline && snapshot.isOnline;
      const wentOffline = previous.isOnline && !snapshot.isOnline;
      const now = Date.now();

      setStatus({
        ...snapshot,
        isReconnecting: cameBackOnline,
        wasOffline: previous.wasOffline || wentOffline,
        lastOnlineAt: snapshot.isOnline ? (cameBackOnline ? now : previous.lastOnlineAt ?? now) : previous.lastOnlineAt,
        lastOfflineAt: wentOffline ? now : previous.lastOfflineAt,
      });

      if (cameBackOnline) {
        clearReconnectTimer();
        reconnectTimerRef.current = window.setTimeout(() => {
          setStatus((current) => ({ ...current, isReconnecting: false }));
          reconnectTimerRef.current = null;
        }, 4500);
      }
    },
    [clearReconnectTimer],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const connection = getConnection();
    const handleOnline = () => applySnapshot(true);
    const handleOffline = () => applySnapshot(false);
    const handleConnectionChange = () => applySnapshot();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    connection?.addEventListener?.('change', handleConnectionChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      connection?.removeEventListener?.('change', handleConnectionChange);
      clearReconnectTimer();
    };
  }, [applySnapshot, clearReconnectTimer]);

  return status;
}
