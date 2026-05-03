import React, { useRef, useEffect, useState } from 'react';
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition"
        title="Afficher/masquer les colonnes"
      >
        <Columns className="w-4 h-4" />
        <span className="hidden sm:inline">Colonnes</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3 space-y-1">
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Colonnes visibles
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onSetAll(true)}
                disabled={allVisible}
                className="text-xs text-orange-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Tout
              </button>
              <button
                type="button"
                onClick={() => onSetAll(false)}
                disabled={allHidden}
                className="text-xs text-slate-500 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Aucun
              </button>
            </div>
          </div>

          {columns.map((col) => (
            <label
              key={col.key}
              className={`flex items-center gap-2.5 px-1 py-1 rounded-md cursor-pointer select-none text-sm ${
                col.required ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={visibility[col.key] !== false}
                disabled={col.required}
                onChange={() => !col.required && onToggle(col.key)}
                className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
              />
              <span className="text-slate-700">{col.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
