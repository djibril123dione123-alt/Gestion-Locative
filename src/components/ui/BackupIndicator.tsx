/**
 * BackupIndicator — badge discret (coin bas-droit) qui affiche :
 *  - "Données sauvegardées il y a Xmin" quand tout va bien
 *  - "Sauvegarde en cours…" lors d'une écriture IndexedDB
 *  - "X action(s) en attente de sync" quand hors-ligne avec une queue
 *
 * v2 : restauration avec preview avant confirmation (merge/overwrite).
 */

import { useState, useEffect } from 'react';
import { CheckCircle2, CloudOff, RefreshCw, Download, Upload, AlertTriangle, X } from 'lucide-react';
import {
  getLastBackupTimestamp,
  downloadBackup,
  parseBackupPreview,
  restoreFromFile,
  type BackupPreview,
} from '../../services/localBackup';
import { getPendingCount } from '../../services/offlineQueue';

interface BackupIndicatorProps {
  saving?: boolean;
  syncing?: boolean;
  pendingCount?: number;
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

type RestoreStep = 'idle' | 'preview' | 'confirming' | 'restoring';

export function BackupIndicator({ saving = false, syncing = false, pendingCount = 0 }: BackupIndicatorProps) {
  const [lastTs, setLastTs] = useState<number | null>(() => getLastBackupTimestamp());
  const [localPending, setLocalPending] = useState(pendingCount);
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [tick, setTick] = useState(0);

  const [restoreStep, setRestoreStep] = useState<RestoreStep>('idle');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreStrategy, setRestoreStrategy] = useState<'merge' | 'overwrite'>('merge');

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
      setRestoreError(null);
      setRestoreStep('preview');
      try {
        const preview = await parseBackupPreview(file);
        setRestoreFile(file);
        setRestorePreview(preview);
      } catch (err) {
        setRestoreError(err instanceof Error ? err.message : 'Fichier invalide');
        setRestoreStep('idle');
      }
    };
    input.click();
  };

  const handleRestoreConfirm = async () => {
    if (!restoreFile) return;
    setRestoreStep('restoring');
    setRestoreError(null);
    try {
      await restoreFromFile(restoreFile, restoreStrategy);
      setLastTs(Date.now());
      setRestoreStep('idle');
      setRestoreFile(null);
      setRestorePreview(null);
      window.location.reload();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Erreur de restauration');
      setRestoreStep('preview');
    }
  };

  const handleRestoreCancel = () => {
    setRestoreStep('idle');
    setRestoreFile(null);
    setRestorePreview(null);
    setRestoreError(null);
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

  const Icon =
    saving || syncing
      ? RefreshCw
      : isProblematic
      ? CloudOff
      : CheckCircle2;

  const colorClass =
    saving || syncing
      ? 'text-blue-500'
      : isProblematic
      ? 'text-orange-500'
      : lastTs
      ? 'text-emerald-500'
      : 'text-slate-400';

  return (
    <div className="fixed bottom-20 lg:bottom-4 right-4 z-40 flex flex-col items-end gap-2">

      {expanded && restoreStep === 'idle' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-72 space-y-3 animate-slideUp">
          <p className="text-sm font-semibold text-slate-800">Gestion des données</p>
          {lastTs && (
            <p className="text-xs text-slate-500">Dernière sauvegarde locale : {relativeTime(lastTs)}</p>
          )}
          {localPending > 0 && (
            <p className="text-xs text-orange-600 font-medium">
              {localPending} action{localPending > 1 ? 's' : ''} en attente de synchronisation
            </p>
          )}
          {restoreError && (
            <p className="text-xs text-red-600 font-medium">{restoreError}</p>
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
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
            >
              <Upload className="w-4 h-4 flex-shrink-0" />
              Restaurer une sauvegarde
            </button>
          </div>
          <p className="text-xs text-slate-400 text-center">Les données sont sauvegardées automatiquement</p>
        </div>
      )}

      {restoreStep === 'preview' && restorePreview && (
        <div className="bg-white border border-amber-200 rounded-2xl shadow-xl p-4 w-80 space-y-3 animate-slideUp">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-slate-800">Aperçu de la sauvegarde</p>
            <button onClick={handleRestoreCancel} className="text-slate-400 hover:text-slate-600 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Exportée le {new Date(restorePreview.exported_at).toLocaleString('fr-FR')}
          </p>

          <div className="bg-slate-50 rounded-lg p-2.5 space-y-1">
            {restorePreview.tables.map((t) => (
              <div key={t} className="flex justify-between text-xs">
                <span className="text-slate-600 capitalize">{t}</span>
                <span className="font-medium text-slate-800">{restorePreview.counts[t]} entrée{restorePreview.counts[t] !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>

          {restorePreview.hasPendingMutations && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Ce fichier contient des mutations hors-ligne non synchronisées.</span>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-slate-700 mb-1.5">Stratégie de restauration</p>
            <div className="space-y-1.5">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="strategy"
                  value="merge"
                  checked={restoreStrategy === 'merge'}
                  onChange={() => setRestoreStrategy('merge')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-xs font-medium text-slate-700">Fusionner (recommandé)</p>
                  <p className="text-xs text-slate-500">Conserve vos données actuelles, ajoute/met à jour ce qui est dans le fichier.</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="strategy"
                  value="overwrite"
                  checked={restoreStrategy === 'overwrite'}
                  onChange={() => setRestoreStrategy('overwrite')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-xs font-medium text-slate-700">Remplacer</p>
                  <p className="text-xs text-red-500">Écrase entièrement les données locales.</p>
                </div>
              </label>
            </div>
          </div>

          {restoreError && (
            <p className="text-xs text-red-600 font-medium">{restoreError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleRestoreCancel}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              Annuler
            </button>
            <button
              onClick={handleRestoreConfirm}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white transition"
            >
              Restaurer
            </button>
          </div>
        </div>
      )}

      {restoreStep === 'restoring' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-72 flex items-center gap-3 animate-slideUp">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-500 flex-shrink-0" />
          <p className="text-sm text-slate-700">Restauration en cours…</p>
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
        title="Gestion des sauvegardes"
      >
        <Icon
          className={`w-3.5 h-3.5 flex-shrink-0 ${colorClass} ${saving || syncing ? 'animate-spin' : ''}`}
        />
        <span className="hidden sm:inline">{label}</span>
      </button>
    </div>
  );
}
