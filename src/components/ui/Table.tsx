import React from 'react';
import { BrandMark } from '../brand/BrandLogo';
import { formatSenegalPhone, getSenegalPhoneHref } from '../../lib/formatters';
import { PremiumMobileCard, PremiumMobileCardRow } from './PremiumMobileCard';

export type TableColumnAlign = "left" | "center" | "right";
export type TableColumnVisibility = "always" | "desktop" | "wide" | "compact";

export interface TableColumn<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  icon?: React.ReactNode;
  align?: TableColumnAlign;
  visibility?: TableColumnVisibility;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
}

export type Column<T> = TableColumn<T>; // Rétrocompatibilité

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

const getAlignmentClass = (align?: TableColumnAlign) => {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
};

const getVisibilityClass = (visibility?: TableColumnVisibility) => {
  if (visibility === 'wide') return 'hidden xl:table-cell';
  if (visibility === 'desktop') return 'hidden lg:table-cell';
  if (visibility === 'compact') return 'hidden md:table-cell';
  return '';
};

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

          if (mobileRender) {
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
                {...(onRowClick ? { role: "button", "aria-label": "Ouvrir les détails", "aria-pressed": isSelected } : {})}
              >
                {mobileRender(item)}
              </article>
            );
          }

          const titleValue = columns.length > 0 ? renderContactValue(columns[0].key, columns[0].render ? columns[0].render(item) : getCellValue(item, columns[0].key)) : null;

          const rows: PremiumMobileCardRow[] = columns.slice(1).map(col => {
            const rawValue = col.render ? col.render(item) : getCellValue(item, col.key);
            const value = renderContactValue(col.key, rawValue);
            return { label: col.label, value, align: col.align };
          }).filter(r => r.value !== null && r.value !== undefined && r.value !== '');

          const actions = (onEdit || onDelete) ? (
            <div className="grid grid-cols-2 gap-2 w-full">
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                  className="sk-action sk-action-secondary flex-1"
                >
                  Modifier
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                  className="sk-action sk-action-danger flex-1"
                >
                  Supprimer
                </button>
              )}
            </div>
          ) : undefined;

          return (
            <PremiumMobileCard
              key={item.id}
              title={titleValue}
              rows={rows}
              actions={actions}
              selected={isSelected}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              density={compact ? 'compact' : 'comfortable'}
            />
          );
        })}
      </div>

      <div className="@container sk-table-shell hidden sm:block">
        <div className="sk-table-scroll">
          <table className={`w-full ${compact ? 'min-w-[500px]' : 'min-w-[860px]'} border-collapse`}>
            <thead className="sticky top-0 z-10 border-b border-emerald-950/10 bg-[linear-gradient(180deg,rgba(248,244,236,0.98),rgba(255,255,255,0.94))] backdrop-blur">
              <tr>
                {columns.map((column) => {
                  const alignClass = getAlignmentClass(column.align);
                  const visibilityClass = getVisibilityClass(column.visibility);
                  const baseClasses = `${compact ? 'px-3 py-2 text-[0.68rem]' : 'px-4 xl:px-5 py-3.5 xl:py-4 text-xs'} font-black uppercase text-slate-500`;
                  const customClasses = `${column.className || ''} ${column.headerClassName || ''}`.trim();

                  return (
                    <th key={column.key} className={`${baseClasses} ${alignClass} ${visibilityClass} ${customClasses ? ` ${customClasses}` : ''}`}>
                      <div className={`flex items-center gap-1.5 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : ''}`}>
                        {column.icon && <span className="opacity-75 flex-shrink-0">{column.icon}</span>}
                        <span className="truncate">{column.label}</span>
                      </div>
                    </th>
                  );
                })}
                {(onEdit || onDelete) && (
                  <th className={`${compact ? 'px-3 py-2 text-[0.68rem]' : 'px-4 xl:px-5 py-3.5 xl:py-4 text-xs'} text-right font-black uppercase text-slate-500`}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100/60">
              {data.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <tr 
                    key={item.id} 
                    className={`transition-colors duration-150 outline-none ${
                      onRowClick 
                        ? 'cursor-pointer hover:bg-emerald-50/40 focus-visible:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300'
                        : 'hover:bg-slate-50/40'
                    } ${
                      isSelected 
                        ? 'bg-emerald-50/60 relative z-0 after:absolute after:inset-y-0 after:left-0 after:w-1 after:bg-brand-600'
                        : ''
                    }`}
                    onClick={() => onRowClick && onRowClick(item)}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onRowClick(item);
                      }
                    }}
                    {...(onRowClick ? { role: "button", "aria-label": "Ouvrir les détails", "aria-selected": isSelected } : {})}
                  >
                  {columns.map((column) => {
                    const alignClass = getAlignmentClass(column.align);
                    const visibilityClass = getVisibilityClass(column.visibility);
                    const baseClasses = `${compact ? 'px-3 py-2 text-[0.78rem]' : 'px-4 xl:px-5 py-3.5 xl:py-4 text-sm'} font-medium text-slate-700`;
                    const customClasses = `${column.className || ''} ${column.cellClassName || ''}`.trim();

                    return (
                      <td key={column.key} className={`${baseClasses} ${alignClass} ${visibilityClass} ${customClasses ? ` ${customClasses}` : ''}`}>
                        {renderContactValue(column.key, column.render ? column.render(item) : getCellValue(item, column.key))}
                      </td>
                    );
                  })}

                  {(onEdit || onDelete) && (
                    <td className={`${compact ? 'px-3 py-2' : 'px-4 xl:px-5 py-3.5 xl:py-4'} text-right`}>
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
