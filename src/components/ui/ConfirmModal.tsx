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
        className="relative w-full overflow-hidden rounded-t-[1.5rem] border border-emerald-900/10 bg-white shadow-2xl shadow-emerald-950/20 animate-scaleIn sm:max-w-[380px] sm:rounded-[1.25rem]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex flex-shrink-0 justify-center pb-1 pt-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-emerald-50 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Fermer"
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-5 sm:p-5">
          <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl border ${styles.iconWrap}`}>
            <Icon className="h-4 w-4" />
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-wider text-action-600">
            {styles.eyebrow}
          </p>
          <h3 className="mt-1.5 text-base font-bold leading-tight text-slate-900">{title}</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{message}</p>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <div className="w-full sm:w-auto">
              <Button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                variant="secondary"
                size="sm"
                fullWidth
              >
                {resolvedCancel}
              </Button>
            </div>
            <div className="w-full sm:w-auto">
              <Button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                loading={isLoading}
                variant={styles.confirmVariant}
                size="sm"
                fullWidth
              >
                {isLoading ? 'En cours...' : resolvedConfirm}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
