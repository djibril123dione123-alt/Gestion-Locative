import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, WifiOff, X } from 'lucide-react';
import { formatCacheTimestamp } from '../../services/offlineReadCache';

interface OfflineDataNoticeProps {
  cachedAt?: number | null;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  variant?: 'cache' | 'empty' | 'error';
}

export function OfflineDataNotice({
  cachedAt,
  message,
  onRetry,
  retrying = false,
  variant = 'cache',
}: OfflineDataNoticeProps) {
  const isEmpty = variant === 'empty';
  const [dismissed, setDismissed] = useState(false);
  const visibilityKey = `${variant}:${cachedAt ?? 'no-cache'}:${message ?? ''}`;

  useEffect(() => {
    setDismissed(false);
  }, [visibilityKey]);

  if (variant === 'cache' && !cachedAt) return null;
  if (dismissed) return null;

  const Icon = isEmpty ? AlertTriangle : WifiOff;
  const tone = isEmpty
    ? 'border-amber-200 bg-amber-50 text-amber-950'
    : 'border-emerald-200 bg-emerald-50 text-emerald-950';

  return (
    <div className={`relative flex flex-col gap-3 rounded-2xl border px-4 py-3 pr-12 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div>
          <p className="font-black">
            {isEmpty ? 'Données indisponibles hors connexion' : 'Dernières données disponibles'}
          </p>
          <p className="mt-0.5 leading-6 opacity-85">
            {message ??
              (cachedAt
                ? `Dernière mise à jour locale : ${formatCacheTimestamp(cachedAt)}.`
                : 'Le cache local est utilisé en attendant le retour du réseau.')}
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-800 shadow-sm ring-1 ring-black/5 transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />
          Réessayer
        </button>
      )}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-2.5 top-2.5 sm:top-1/2 sm:-translate-y-1/2 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/60 text-slate-700 shadow-sm ring-1 ring-black/5 transition hover:bg-white"
        aria-label="Masquer le bandeau"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
