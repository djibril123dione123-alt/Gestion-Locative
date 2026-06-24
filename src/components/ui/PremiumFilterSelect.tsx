import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ListFilter } from 'lucide-react';

export type PremiumFilterSelectOption = {
  value: string;
  label: string;
};

export type PremiumFilterSelectProps = {
  value: string;
  placeholder: string;
  options: PremiumFilterSelectOption[];
  onChange: (value: string) => void;
  className?: string;
};

export function PremiumFilterSelect({
  value,
  placeholder,
  options,
  onChange,
  className = '',
}: PremiumFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={ref} className={`relative min-w-0 shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-[0.6rem] border border-emerald-950/10 bg-white/95 pl-2.5 pr-2 text-left text-xs font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition hover:border-emerald-100 hover:bg-emerald-50/60 focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-1.5 truncate">
          <ListFilter className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-[12rem] overflow-hidden rounded-xl border border-emerald-950/10 bg-white p-1 shadow-lg ring-1 ring-black/5">
          <div role="listbox" className="max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              role="option"
              aria-selected={!selectedOption}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-200 text-transparent">
                <Check className="h-2.5 w-2.5" />
              </span>
              <span className="min-w-0 flex-1 truncate">Aucun filtre secondaire</span>
            </button>
            <div className="my-1 h-px bg-slate-100" />
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition ${isSelected ? 'bg-emerald-50 text-emerald-900' : 'text-slate-600 hover:bg-slate-50'}`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${isSelected ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 text-transparent'}`}>
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
