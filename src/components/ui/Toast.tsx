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
      bg: 'bg-brand-50',
      border: 'border-brand-200',
      text: 'text-brand-900',
      icon: <CheckCircle className="w-5 h-5 text-brand-700" />,
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: <XCircle className="w-5 h-5 text-red-600" />,
    },
    warning: {
      bg: 'bg-action-50',
      border: 'border-action-200',
      text: 'text-action-700',
      icon: <AlertCircle className="w-5 h-5 text-action-700" />,
    },
  };

  const style = styles[type];

  return (
    <div
      className={`${style.bg} ${style.border} ${style.text} border p-4 rounded-lg shadow-premium
                  flex items-start gap-3 min-w-[min(320px,calc(100vw-2rem))] max-w-md animate-slide-in backdrop-blur`}
      role="status"
    >
      {style.icon}
      <div className="flex-1">
        <p className="text-sm font-semibold leading-5">{message}</p>
      </div>
      <button
        onClick={onClose}
        className={`${style.text} rounded-md p-1 hover:bg-black/5 transition`}
        aria-label="Fermer la notification"
      >
        <X className="w-4 h-4" />
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
