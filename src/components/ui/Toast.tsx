import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const styles = {
    success: {
      bg: 'bg-emerald-50/95',
      border: 'border-emerald-200/60',
      text: 'text-emerald-900',
      icon: <CheckCircle className="w-4 h-4 text-emerald-600" />,
    },
    error: {
      bg: 'bg-red-50/95',
      border: 'border-red-200/60',
      text: 'text-red-800',
      icon: <XCircle className="w-4 h-4 text-red-600" />,
    },
    warning: {
      bg: 'bg-amber-50/95',
      border: 'border-amber-200/60',
      text: 'text-amber-800',
      icon: <AlertCircle className="w-4 h-4 text-amber-600" />,
    },
  };

  const style = styles[type];

  return (
    <div
      className={`${style.bg} ${style.border} ${style.text} border px-3 py-2.5 rounded-lg shadow-sm
                  flex items-center gap-2.5 w-auto max-w-sm animate-slide-in backdrop-blur-md`}
      role="status"
    >
      {style.icon}
      <div className="flex-1">
        <p className="text-[11px] font-semibold leading-tight tracking-wide">{message}</p>
      </div>
      <button
        onClick={onClose}
        className={`${style.text} rounded-md p-1 hover:bg-black/5 transition`}
        aria-label="Fermer la notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type: ToastType }>;
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed left-4 right-4 top-4 z-50 flex flex-col items-end gap-2 sm:left-auto">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}
