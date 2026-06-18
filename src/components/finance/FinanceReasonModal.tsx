import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { PremiumButton } from '../ui/PremiumButton';

interface FinanceReasonModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  warning: string;
  confirmLabel: string;
  reasonLabel?: string;
  isLoading?: boolean;
  children?: React.ReactNode;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export function FinanceReasonModal({
  isOpen,
  title,
  description,
  warning,
  confirmLabel,
  reasonLabel = 'Motif de l’annulation',
  isLoading = false,
  children,
  onClose,
  onConfirm,
}: FinanceReasonModalProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  const normalizedReason = reason.trim();
  const closeIfIdle = () => {
    if (!isLoading) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={closeIfIdle} title={title} description={description}>
      <div className="space-y-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {children && (
          <section className="rounded-2xl border border-emerald-950/10 bg-white p-4 shadow-sm">
            {children}
          </section>
        )}

        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <p className="text-sm font-semibold leading-6">{warning}</p>
        </div>

        <div>
          <label htmlFor="finance-cancellation-reason" className="mb-2 block text-sm font-black text-slate-800">
            {reasonLabel} <span className="text-red-600">*</span>
          </label>
          <textarea
            id="finance-cancellation-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Expliquez brièvement la raison afin de préserver une trace claire."
            rows={4}
            maxLength={280}
            autoFocus
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10"
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
            <p className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              Cette raison accompagne l’annulation contrôlée.
            </p>
            <span className="tabular-nums">{reason.length}/280</span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-emerald-950/10 pt-4 sm:flex-row sm:justify-end">
          <PremiumButton variant="secondary" onClick={closeIfIdle} disabled={isLoading}>
            Retour
          </PremiumButton>
          <PremiumButton
            variant="danger"
            onClick={() => onConfirm(normalizedReason)}
            disabled={normalizedReason.length < 5 || isLoading}
          >
            {isLoading ? 'Validation…' : confirmLabel}
          </PremiumButton>
        </div>
      </div>
    </Modal>
  );
}
