import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  variant = 'danger',
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      bg: 'bg-red-50',
      icon: 'text-red-600',
      button: 'bg-red-600 hover:bg-red-700',
      border: 'border-red-200',
    },
    warning: {
      bg: 'bg-orange-50',
      icon: 'text-orange-600',
      button: 'bg-orange-600 hover:bg-orange-700',
      border: 'border-orange-200',
    },
    info: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700',
      border: 'border-blue-200',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6">
            <div className={`w-12 h-12 rounded-full ${styles.bg} flex items-center justify-center mb-4`}>
              <AlertTriangle className={`w-6 h-6 ${styles.icon}`} />
            </div>

            <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
            <p className="text-slate-600 mb-6">{message}</p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg
                         hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-all shadow-md hover:shadow-lg
                          disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${styles.button}`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    En cours...
                  </>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
