import { useState, useCallback } from 'react';
import { ToastType } from '../components/ui/Toast';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback((message: string) => {
    return addToast(message, 'success');
  }, [addToast]);

  const error = useCallback((message: string) => {
    return addToast(message, 'error');
  }, [addToast]);

  const warning = useCallback((message: string) => {
    return addToast(message, 'warning');
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
  };
}
