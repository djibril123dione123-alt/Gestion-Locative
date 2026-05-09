import React from 'react';
import { BrandMark } from '../brand/BrandLogo';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
}

export function Table<T extends { id: string }>({
  columns,
  data,
  onEdit,
  onDelete,
}: TableProps<T>) {
  const getCellValue = (item: T, key: string): React.ReactNode => {
    const value = (item as Record<string, unknown>)[key];
    if (value === null || value === undefined || value === '') return null;
    if (React.isValidElement(value)) return value;
    if (['string', 'number', 'boolean'].includes(typeof value)) return String(value);
    return JSON.stringify(value);
  };

  const renderContactValue = (key: string, value: React.ReactNode) => {
    if (value === null || value === undefined || value === '' || React.isValidElement(value)) return value;
    const text = String(value).trim();
    const normalizedKey = key.toLowerCase();

    if ((normalizedKey.includes('email') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) && text.includes('@')) {
      const to = encodeURIComponent(text);
      return (
        <a
          href={`https://mail.google.com/mail/?view=cm&fs=1&to=${to}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-brand-700 underline-offset-2 transition hover:text-brand-950 hover:underline"
        >
          {text}
        </a>
      );
    }

    if (normalizedKey.includes('telephone') || normalizedKey.includes('phone') || normalizedKey.includes('tel')) {
      const phone = text.replace(/[^\d+]/g, '');
      if (phone.length >= 6) {
        return (
          <a
            href={`tel:${phone}`}
            className="font-bold text-brand-700 underline-offset-2 transition hover:text-brand-950 hover:underline"
          >
            {text}
          </a>
        );
      }
    }

    return value;
  };

  if (data.length === 0) {
    return (
      <div className="sk-card flex min-h-44 items-center justify-center px-6 py-12 text-center">
        <div>
          <BrandMark size="sm" tone="light" animated={false} className="mx-auto mb-4" />
          <p className="text-base font-black text-slate-950">Aucune donnée disponible</p>
          <p className="mt-2 text-sm text-slate-500">Les résultats apparaîtront ici dès qu’ils seront créés.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 sm:hidden">
        {data.map((item) => (
          <div key={item.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {columns.map((col) => {
                const rawValue = col.render ? col.render(item) : getCellValue(item, col.key);
                const value = renderContactValue(col.key, rawValue);
                if (value === null || value === undefined || value === '') return null;
                return (
                  <div key={col.key} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="w-24 flex-shrink-0 text-xs font-black uppercase text-slate-500">
                      {col.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-slate-800 [&_.sk-action-group]:justify-end">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
            {(onEdit || onDelete) && (
              <div className="sk-action-group border-t border-slate-100 bg-brand-surface px-4 py-3">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="sk-action sk-action-secondary flex-1"
                  >
                    Modifier
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    className="sk-action sk-action-danger flex-1"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm sm:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-brand-surface/95 backdrop-blur">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="px-5 py-4 text-left text-xs font-black uppercase text-slate-500">
                    {column.label}
                  </th>
                ))}
                {(onEdit || onDelete) && (
                  <th className="px-5 py-4 text-right text-xs font-black uppercase text-slate-500">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {data.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 transition hover:bg-emerald-50/55">
                  {columns.map((column) => (
                    <td key={column.key} className="px-5 py-4 text-sm font-medium text-slate-700">
                      {renderContactValue(column.key, column.render ? column.render(item) : getCellValue(item, column.key))}
                    </td>
                  ))}

                  {(onEdit || onDelete) && (
                    <td className="px-5 py-4 text-right">
                      <div className="sk-action-group-right">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            className="sk-action sk-action-secondary"
                          >
                            Modifier
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(item)}
                            className="sk-action sk-action-danger"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
