import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { AdminButton } from './AdminPrimitives';

export interface AdminActionRequest {
  title: string;
  message: string;
  confirmLabel: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  destructive?: boolean;
  requireText?: string;
  minReasonLength?: number;
  onConfirm: (reason: string) => Promise<void>;
}

export function AdminActionDialog({
  action,
  busy,
  onClose,
  onConfirm,
}: {
  action: AdminActionRequest | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    if (!action) {
      setReason('');
      setConfirmation('');
    }
  }, [action]);

  if (!action) return null;
  const min = action.minReasonLength ?? 8;
  const canConfirm = reason.trim().length >= min && (!action.requireText || confirmation === action.requireText) && !busy;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3">
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <section className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_28px_90px_rgba(15,23,42,0.32)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] ${action.destructive ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              Action auditée
            </span>
            <h2 className="mt-3 text-lg font-black text-slate-950">{action.title}</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-600">{action.message}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        {action.requireText && (
          <label className="mt-4 block">
            <span className="text-[0.65rem] font-black uppercase tracking-[0.11em] text-slate-500">Confirmation exacte</span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={action.requireText}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-red-300"
            />
          </label>
        )}

        <label className="mt-4 block">
          <span className="text-[0.65rem] font-black uppercase tracking-[0.11em] text-slate-500">{action.reasonLabel ?? 'Raison obligatoire'}</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder={action.reasonPlaceholder ?? 'Expliquez le contexte métier ou support de cette action.'}
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-orange-300"
          />
          <span className={`mt-1.5 flex items-center gap-1 text-xs font-bold ${reason.trim().length >= min ? 'text-emerald-700' : 'text-slate-400'}`}>
            <AlertTriangle className="h-3 w-3" />
            {reason.trim().length}/{min} caractères minimum. L'audit est requis avant mutation.
          </span>
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AdminButton onClick={onClose} disabled={busy}>Annuler</AdminButton>
          <AdminButton variant={action.destructive ? 'danger' : 'primary'} disabled={!canConfirm} onClick={() => void onConfirm(reason.trim())}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {action.confirmLabel}
          </AdminButton>
        </div>
      </section>
    </div>
  );
}
