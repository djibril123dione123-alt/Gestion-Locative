import { AlertTriangle, Info, X } from 'lucide-react';
import { Button } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  confirmLabel,
  cancelLabel,
  variant,
  isDestructive,
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const resolvedConfirm = confirmLabel ?? confirmText ?? 'Confirmer';
  const resolvedCancel = cancelLabel ?? cancelText ?? 'Annuler';
  const resolvedVariant: 'danger' | 'warning' | 'info' =
    variant ?? (isDestructive ? 'danger' : 'info');

  const variantStyles = {
    danger: {
      iconWrap: 'border-red-200 bg-red-50 text-red-600',
      confirmVariant: 'danger' as const,
      eyebrow: 'Action sensible',
      Icon: AlertTriangle,
    },
    warning: {
      iconWrap: 'border-action-200 bg-action-50 text-action-700',
      confirmVariant: 'financial' as const,
      eyebrow: 'Confirmation requise',
      Icon: AlertTriangle,
    },
    info: {
      iconWrap: 'border-brand-100 bg-brand-50 text-brand-700',
      confirmVariant: 'success' as const,
      eyebrow: 'Validation',
      Icon: Info,
    },
  };

  const styles = variantStyles[resolvedVariant];
  const Icon = styles.Icon;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-4">
      <div
        className="fixed inset-0 bg-brand-950/65 backdrop-blur-md transition-opacity"
        onClick={isLoading ? undefined : onClose}
        aria-hidden="true"
      />

      <section
        className="relative w-full overflow-hidden rounded-t-3xl border border-emerald-900/10 bg-white shadow-2xl shadow-emerald-950/20 animate-scaleIn sm:max-w-md sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex flex-shrink-0 justify-center pb-1 pt-3 sm:hidden">
          <div className="h-1 w-11 rounded-full bg-slate-300" />
        </div>

        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-emerald-50 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Fermer"
          disabled={isLoading}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 sm:p-7">
          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border ${styles.iconWrap}`}>
            <Icon className="h-5 w-5" />
          </div>

          <p className="text-xs font-black uppercase tracking-[0.2em] text-action-600">
            {styles.eyebrow}
          </p>
          <h3 className="mt-2 text-xl font-black leading-tight text-slate-950">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              variant="secondary"
              size="md"
              fullWidth
            >
              {resolvedCancel}
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              loading={isLoading}
              variant={styles.confirmVariant}
              size="md"
              fullWidth
            >
              {isLoading ? 'En cours...' : resolvedConfirm}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
