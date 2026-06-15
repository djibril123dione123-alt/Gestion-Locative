import React from 'react';
import { BrandMark } from '../brand/BrandLogo';
import { formatSenegalPhone, getSenegalPhoneHref } from '../../lib/formatters';

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
  onRowClick?: (item: T) => void;
  selectedId?: string | null;
  mobileRender?: (item: T) => React.ReactNode;
  compact?: boolean;
}

export function Table<T extends { id: string }>({
  columns,
  data,
  onEdit,
  onDelete,
  onRowClick,
  selectedId,
  mobileRender,
  compact,
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
      return (
        <a
          href={`mailto:${text}`}
          aria-label={`Envoyer un email à ${text}`}
          className="font-bold text-brand-700 underline-offset-2 transition hover:text-brand-950 hover:underline"
        >
          {text}
        </a>
      );
    }

    if (normalizedKey.includes('telephone') || normalizedKey.includes('phone') || normalizedKey.includes('tel')) {
      const phoneHref = getSenegalPhoneHref(text);
      if (phoneHref) {
        return (
          <a
            href={phoneHref}
            aria-label={`Appeler ${text}`}
            className="font-bold text-brand-700 underline-offset-2 transition hover:text-brand-950 hover:underline"
          >
            {formatSenegalPhone(text)}
          </a>
        );
      }
    }

    return value;
  };

  if (data.length === 0) {
    return (
      <div className="sk-card flex min-h-44 items-center justify-center px-5 py-10 text-center sm:px-6 sm:py-12">
        <div>
          <BrandMark size="sm" tone="light" animated={false} className="mx-auto mb-4" />
          <p className="text-base font-black text-slate-950">Aucune donnée disponible</p>
          <p className="mt-2 text-sm text-slate-500">Les résultats apparaîtront ici dès qu'ils seront créés.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 sm:hidden">
        {data.map((item) => {
          const isSelected = selectedId === item.id;
          return (
            <article
              key={item.id}
              className={`sk-mobile-card overflow-hidden transition duration-200 active:scale-[0.992] ${onRowClick ? 'cursor-pointer hover:border-emerald-200 hover:shadow-md outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:border-emerald-400' : ''} ${isSelected ? 'border-emerald-300 ring-1 ring-emerald-300 bg-emerald-50/40 shadow-sm' : ''}`}
              onClick={() => onRowClick && onRowClick(item)}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={(e) => {
                if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onRowClick(item);
                }
              }}
              role={onRowClick ? "button" : undefined}
              aria-label={onRowClick ? "Ouvrir les détails" : undefined}
              aria-pressed={isSelected}
            >
              {mobileRender ? (
                mobileRender(item)
              ) : (
                <>
                  <div className="divide-y divide-slate-100">
                    {columns.map((col, index) => {
                      const rawValue = col.render ? col.render(item) : getCellValue(item, col.key);
                      const value = renderContactValue(col.key, rawValue);
                      if (value === null || value === undefined || value === '') return null;
                      const isPrimary = index === 0;
                      return (
                        <div
                          key={col.key}
                          className={`flex items-start justify-between gap-3 px-4 ${isPrimary ? 'bg-brand-surface/75 py-4' : 'py-3'}`}
                        >
                          <span className="w-24 flex-shrink-0 text-xs font-black uppercase tracking-wide text-slate-500">
                            {col.label}
                          </span>
                          <span
                            className={`min-w-0 flex-1 text-right leading-5 text-slate-800 [&_.sk-action-group]:flex [&_.sk-action-group]:flex-wrap [&_.sk-action-group]:justify-end [&_.sk-action-group]:gap-2 [&_.sk-action-group-right]:flex [&_.sk-action-group-right]:flex-wrap [&_.sk-action-group-right]:justify-end [&_.sk-action-group-right]:gap-2 ${
                              isPrimary ? 'text-base font-black' : 'text-sm font-semibold'
                            }`}
                          >
                            {value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {(onEdit || onDelete) && (
                    <div className="grid grid-cols-2 gap-2 border-t border-emerald-950/10 bg-brand-surface/75 px-4 py-3">
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
                </>
              )}
            </article>
        );
        })}
      </div>

      <div className="sk-table-shell hidden sm:block">
        <div className="sk-table-scroll">
          <table className="w-full min-w-[860px] border-collapse">
            <thead className="sticky top-0 z-10 border-b border-emerald-950/10 bg-[linear-gradient(180deg,rgba(248,244,236,0.98),rgba(255,255,255,0.94))] backdrop-blur">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className={`px-4 text-left text-xs font-black uppercase text-slate-500 xl:px-5 ${compact ? 'py-2.5' : 'py-3.5 xl:py-4'}`}>
                    {column.label}
                  </th>
                ))}
                {(onEdit || onDelete) && (
                  <th className={`px-4 text-right text-xs font-black uppercase text-slate-500 xl:px-5 ${compact ? 'py-2.5' : 'py-3.5 xl:py-4'}`}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {data.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <tr 
                    key={item.id} 
                    className={`border-b transition duration-150 outline-none ${
                      onRowClick 
                        ? 'cursor-pointer hover:bg-emerald-50/60 focus-visible:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300' 
                        : ''
                    } ${
                      isSelected 
                        ? 'bg-emerald-50/80 border-emerald-200 relative z-0 after:absolute after:inset-y-0 after:left-0 after:w-1 after:bg-brand-600' 
                        : 'border-slate-100'
                    }`}
                    onClick={() => onRowClick && onRowClick(item)}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onRowClick(item);
                      }
                    }}
                    role={onRowClick ? "button" : undefined}
                    aria-label={onRowClick ? "Ouvrir les détails" : undefined}
                    aria-selected={isSelected}
                  >
                  {columns.map((column) => (
                    <td key={column.key} className={`px-4 text-sm font-medium text-slate-700 xl:px-5 ${compact ? 'py-2.5' : 'py-3.5 xl:py-4'}`}>
                      {renderContactValue(column.key, column.render ? column.render(item) : getCellValue(item, column.key))}
                    </td>
                  ))}

                  {(onEdit || onDelete) && (
                    <td className={`px-4 text-right xl:px-5 ${compact ? 'py-2.5' : 'py-3.5 xl:py-4'}`}>
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
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
