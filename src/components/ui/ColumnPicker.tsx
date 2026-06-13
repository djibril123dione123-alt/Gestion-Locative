import { useRef, useEffect, useState } from 'react';
import { Columns } from 'lucide-react';
import type { ColumnVisibilityMap } from '../../hooks/useColumnVisibility';

interface ColumnDef {
  key: string;
  label: string;
  /** If true the column cannot be hidden (e.g. actions) */
  required?: boolean;
}

interface ColumnPickerProps {
  columns: ColumnDef[];
  visibility: ColumnVisibilityMap;
  onToggle: (key: string) => void;
  onSetAll: (visible: boolean) => void;
}

export function ColumnPicker({ columns, visibility, onToggle, onSetAll }: ColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleable = columns.filter((c) => !c.required);
  const allVisible = toggleable.every((c) => visibility[c.key] !== false);
  const allHidden = toggleable.every((c) => visibility[c.key] === false);

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-900 text-sm font-bold transition shadow-sm focus:outline-none focus:ring-4 focus:ring-brand-400/15"
        title="Afficher/masquer les colonnes"
      >
        <Columns className="w-4 h-4" />
        <span className="hidden sm:inline">Colonnes</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-emerald-950/10 rounded-lg shadow-premium z-50 p-3 space-y-1">
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100">
            <span className="text-xs font-black text-slate-600 uppercase tracking-wide">
              Colonnes visibles
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onSetAll(true)}
                disabled={allVisible}
                className="text-xs font-bold text-brand-700 hover:text-brand-900 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Tout
              </button>
              <button
                type="button"
                onClick={() => onSetAll(false)}
                disabled={allHidden}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Aucun
              </button>
            </div>
          </div>

          {columns.map((col) => (
            <label
              key={col.key}
              className={`flex items-center gap-2.5 px-1 py-1 rounded-md cursor-pointer select-none text-sm ${
                col.required ? 'opacity-50 cursor-not-allowed' : 'hover:bg-brand-50'
              }`}
            >
              <input
                type="checkbox"
                checked={visibility[col.key] !== false}
                disabled={col.required}
                onChange={() => !col.required && onToggle(col.key)}
                className="w-4 h-4 rounded accent-brand-700 cursor-pointer"
              />
              <span className="font-medium text-slate-800">{col.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
