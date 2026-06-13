import { ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

interface MobileFilterSheetProps {
  isOpen: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
  onReset?: () => void;
}

export function MobileFilterSheet({
  isOpen,
  title = 'Filtres',
  children,
  onClose,
  onReset,
}: MobileFilterSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Fermer les filtres"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section className="absolute inset-x-2 bottom-2 overflow-hidden rounded-[1.65rem] border border-white/70 bg-[#fffdf8]/95 shadow-[0_24px_80px_rgba(15,23,42,0.24)] ring-1 ring-emerald-950/5 backdrop-blur-2xl">
        <div className="mx-auto mt-2 h-1 w-11 rounded-full bg-slate-300/70" />
        <header className="flex items-center justify-between gap-3 border-b border-emerald-950/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-brand-800 ring-1 ring-emerald-100">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-950">{title}</h2>
              <p className="text-xs font-medium text-slate-500">Affinez la liste sans quitter la page.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[58dvh] space-y-3 overflow-y-auto px-4 py-4">
          {children}
        </div>
        <footer className="grid grid-cols-2 gap-2 border-t border-emerald-950/10 bg-[#fff4df]/65 px-4 py-3">
          <button
            type="button"
            onClick={onReset}
            disabled={!onReset}
            className="rounded-xl border border-emerald-950/10 bg-[#fffdf8] px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-[#fff8e8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-brand-950 px-3 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-950/15 transition hover:-translate-y-0.5"
          >
            Appliquer
          </button>
        </footer>
      </section>
    </div>
  );
}
