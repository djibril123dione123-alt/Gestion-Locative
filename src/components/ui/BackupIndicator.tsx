/**
 * BackupIndicator — badge discret (coin bas-droit) qui affiche :
 *  - "Données sauvegardées il y a Xmin" quand tout va bien
 *  - "Sauvegarde en cours…" lors d'une écriture IndexedDB
 *  - "X action(s) en attente de sync" quand hors-ligne avec une queue
 *
 * Monté dans App.tsx une seule fois.
 */

import { useState, useEffect } from 'react';
import { CheckCircle2, CloudOff, RefreshCw, Download, Upload } from 'lucide-react';
import { getLastBackupTimestamp, downloadBackup, restoreFromFile } from '../../services/localBackup';
import { getPendingCount } from '../../services/offlineQueue';

interface BackupIndicatorProps {
  saving?: boolean;
  syncing?: boolean;
  pendingCount?: number;
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export function BackupIndicator({ saving = false, syncing = false, pendingCount = 0 }: BackupIndicatorProps) {
  const [lastTs, setLastTs] = useState<number | null>(() => getLastBackupTimestamp());
  const [localPending, setLocalPending] = useState(pendingCount);
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ts = getLastBackupTimestamp();
    setLastTs(ts);
  }, [saving, tick]);

  useEffect(() => {
    setLocalPending(pendingCount);
  }, [pendingCount]);

  useEffect(() => {
    getPendingCount().then(setLocalPending);
  }, [syncing]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadBackup();
      setLastTs(Date.now());
    } finally {
      setDownloading(false);
    }
  };

  const handleRestoreClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setRestoring(true);
      try {
        await restoreFromFile(file);
        setLastTs(Date.now());
        window.location.reload();
      } finally {
        setRestoring(false);
      }
    };
    input.click();
  };

  const isProblematic = localPending > 0 && !navigator.onLine;
  const label = saving
    ? 'Sauvegarde…'
    : syncing
    ? 'Synchronisation…'
    : localPending > 0
    ? `${localPending} action${localPending > 1 ? 's' : ''} en attente`
    : lastTs
    ? `Sauvegardé ${relativeTime(lastTs)}`
    : 'Aucune sauvegarde';

  const Icon = saving || syncing
    ? RefreshCw
    : isProblematic
    ? CloudOff
    : CheckCircle2;

  const colorClass = saving || syncing
    ? 'text-blue-500'
    : isProblematic
    ? 'text-orange-500'
    : lastTs
    ? 'text-emerald-500'
    : 'text-slate-400';

  return (
    <div className="fixed bottom-20 lg:bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {expanded && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-64 space-y-3 animate-slideUp">
          <p className="text-sm font-semibold text-slate-800">Gestion des données</p>
          {lastTs && (
            <p className="text-xs text-slate-500">Dernière sauvegarde locale : {relativeTime(lastTs)}</p>
          )}
          {localPending > 0 && (
            <p className="text-xs text-orange-600 font-medium">
              {localPending} action{localPending > 1 ? 's' : ''} en attente de synchronisation
            </p>
          )}
          <div className="space-y-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 transition disabled:opacity-50"
            >
              {downloading
                ? <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
                : <Download className="w-4 h-4 flex-shrink-0" />}
              Télécharger une sauvegarde
            </button>
            <button
              onClick={handleRestoreClick}
              disabled={restoring}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 transition disabled:opacity-50"
            >
              {restoring
                ? <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
                : <Upload className="w-4 h-4 flex-shrink-0" />}
              Restaurer une sauvegarde
            </button>
          </div>
          <p className="text-xs text-slate-400 text-center">Vos données sont sauvegardées automatiquement</p>
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
        title="Gestion des sauvegardes"
      >
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${colorClass} ${(saving || syncing) ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">{label}</span>
      </button>
    </div>
  );
}
