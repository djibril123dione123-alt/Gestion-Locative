import { HelpCircle } from 'lucide-react';

interface TooltipHintProps {
  label: string;
  children: string;
}

export function TooltipHint({ label, children }: TooltipHintProps) {
  return (
    <span className="group relative inline-flex items-center align-middle">
      <button
        type="button"
        aria-label={label}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-emerald-50 hover:text-brand-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-[80] mb-2 hidden w-64 -translate-x-1/2 rounded-2xl border border-emerald-900/10 bg-white px-3 py-2 text-left text-xs font-semibold leading-5 text-slate-600 shadow-2xl shadow-emerald-950/10 group-hover:block group-focus-within:block">
        {children}
      </span>
    </span>
  );
}
