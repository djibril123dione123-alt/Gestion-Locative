import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { BrandMark } from '../brand/BrandLogo';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, description, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-4">
      <div
        className="fixed inset-0 bg-brand-950/68 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      <section className="sk-modal-shell" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex flex-shrink-0 justify-center pb-1 pt-3 sm:hidden">
          <div className="h-1 w-11 rounded-full bg-slate-300" />
        </div>

        <div className="sk-modal-header">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark size="xs" tone="light" withTile={false} />
            <div className="min-w-0">
              <p className="sk-type-caption text-action-600">
                Samay Këur
              </p>
              <h2 className="mt-1 truncate pr-4 text-base font-black text-slate-950 sm:text-xl">{title}</h2>
              {description && (
                <p className="mt-1 text-xs text-slate-500 max-w-sm leading-tight">{description}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sk-pressable -mr-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-emerald-50 hover:text-brand-800"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="sk-modal-body">
          {children}
        </div>
      </section>
    </div>
  );
}
