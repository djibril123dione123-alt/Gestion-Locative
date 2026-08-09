import React from 'react';
import { CheckCircle2, Loader2, RotateCcw, type LucideIcon } from 'lucide-react';
import { classNames } from '../../lib/admin/adminFormatters';
import { getStatusLabel, getStatusTone, type AdminTone } from '../../lib/admin/adminStatusMapping';
import { MetricCard, type MetricTone } from '../ui/MetricCard';
import { PremiumButton } from '../ui/PremiumButton';
import { PremiumFilterSelect, type PremiumFilterSelectOption } from '../ui/PremiumFilterSelect';
import { PremiumKpiGrid } from '../ui/PremiumKpiGrid';
import { PremiumSearchInput } from '../ui/PremiumSearchInput';
import { PremiumTableSurface } from '../ui/PremiumTableSurface';
import { PremiumToolbar, type QuickChip } from '../ui/PremiumToolbar';

const toneClasses: Record<AdminTone, string> = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-red-200 bg-red-50 text-red-800',
  blue: 'border-sky-200 bg-sky-50 text-sky-800',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-800',
  dark: 'border-emerald-900/20 bg-emerald-950 text-white',
};

const metricToneByAdminTone: Record<AdminTone, MetricTone> = {
  emerald: 'success',
  amber: 'warning',
  red: 'danger',
  blue: 'info',
  slate: 'neutral',
  orange: 'warning',
  dark: 'financial',
};

export function AdminStatusBadge({ status, children, tone }: { status?: string | null; children?: React.ReactNode; tone?: AdminTone }) {
  const nextTone = tone ?? getStatusTone(status);
  return (
    <span className={`inline-flex max-w-full items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.56rem] font-bold uppercase tracking-[0.08em] ${toneClasses[nextTone]}`}>
      {children ?? getStatusLabel(status)}
    </span>
  );
}

export function AdminMetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'slate',
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  icon?: LucideIcon;
  tone?: AdminTone;
  onClick?: () => void;
}) {
  return (
    <MetricCard
      density="ultraCompact"
      title={label}
      value={value}
      helper={typeof helper === 'string' ? helper : 'Suivi console'}
      icon={Icon ?? CheckCircle2}
      tone={metricToneByAdminTone[tone] ?? 'neutral'}
      onClick={onClick}
    />
  );
}

export function AdminKpiGrid({ children, maxItems }: { children: React.ReactNode; maxItems?: number }) {
  return (
    <PremiumKpiGrid density="ultraCompact" variant="dashboard" maxItems={maxItems ?? 6}>
      {children}
    </PremiumKpiGrid>
  );
}

export function AdminPanel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <PremiumTableSurface density="compact" className={classNames('bg-white/95', className)}>
      <div className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[0.82rem] font-semibold leading-tight text-slate-950">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[0.68rem] font-medium leading-4 text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={classNames('p-2.5 sm:p-3', bodyClassName)}>{children}</div>
    </PremiumTableSurface>
  );
}

export type AdminToolbarFilter = {
  value: string;
  placeholder: string;
  options: PremiumFilterSelectOption[];
  onChange: (value: string) => void;
  defaultValue?: string;
  className?: string;
};

export function AdminListToolbar({
  query,
  onQueryChange,
  placeholder,
  filters = [],
  resultCount,
  onReset,
  isSplitOpen = false,
  primaryAction,
  quickChips,
  className,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  filters?: AdminToolbarFilter[];
  resultCount?: number;
  onReset?: () => void;
  isSplitOpen?: boolean;
  primaryAction?: React.ReactNode;
  quickChips?: QuickChip[];
  className?: string;
}) {
  const hasActiveFilters = Boolean(query.trim()) || filters.some((filter) => filter.value !== (filter.defaultValue ?? 'all'));

  return (
    <PremiumToolbar
      layout="list"
      density="ultraCompact"
      isSplitOpen={isSplitOpen}
      className={classNames('mb-2 border-slate-200/80 bg-slate-50/65 shadow-none', className)}
      search={(
        <PremiumSearchInput
          value={query}
          onChange={onQueryChange}
          placeholder={placeholder}
          className="min-w-[12rem]"
          aria-label={placeholder}
        />
      )}
      filters={filters.length > 0 ? (
        <div className="flex min-w-0 items-center gap-1.5">
          {filters.map((filter) => (
            <PremiumFilterSelect
              key={filter.placeholder}
              value={filter.value}
              placeholder={filter.placeholder}
              options={filter.options}
              onChange={(value) => filter.onChange(value || filter.defaultValue || 'all')}
              className={classNames('w-[8.5rem]', filter.className)}
            />
          ))}
        </div>
      ) : undefined}
      secondaryActions={(
        <div className="flex shrink-0 items-center gap-1.5">
          {typeof resultCount === 'number' && (
            <span className="hidden whitespace-nowrap text-[0.64rem] font-semibold text-slate-500 xl:inline">
              {resultCount} résultat{resultCount > 1 ? 's' : ''}
            </span>
          )}
          {onReset && hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              title="Réinitialiser les filtres"
              aria-label="Réinitialiser les filtres"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[0.6rem] border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      primaryAction={primaryAction}
      quickChips={quickChips}
    />
  );
}

export function AdminSectionTabs({
  value,
  onChange,
  items,
  ariaLabel = 'Vues de la section',
}: {
  value: string;
  onChange: (value: string) => void;
  items: Array<{ value: string; label: string; count?: number }>;
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="scrollbar-hide flex max-w-full items-center gap-1 overflow-x-auto rounded-[0.75rem] border border-emerald-950/10 bg-white/80 p-1">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={classNames(
              'inline-flex h-7 flex-none items-center gap-1.5 whitespace-nowrap rounded-[0.55rem] px-2.5 text-[0.66rem] font-semibold transition',
              active ? 'bg-emerald-950 text-white shadow-sm' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-900',
            )}
          >
            {item.label}
            {typeof item.count === 'number' && (
              <span className={classNames('text-[0.58rem]', active ? 'text-emerald-100' : 'text-slate-400')}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function AdminEmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[1.05rem] border border-dashed border-slate-200 bg-slate-50/70 p-3 text-center">
      <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-700" />
      <p className="mt-1.5 text-[0.78rem] font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[0.72rem] font-medium leading-4 text-slate-500">{text}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function AdminLoadingState({ label = 'Chargement console...' }: { label?: string }) {
  return (
    <PremiumTableSurface density="compact" className="bg-white">
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {label}
        </div>
      </div>
    </PremiumTableSurface>
  );
}

export function AdminButton({
  children,
  onClick,
  type = 'button',
  disabled,
  variant = 'secondary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}) {
  return (
    <PremiumButton
      type={type}
      onClick={onClick}
      disabled={disabled}
      variant={variant}
      size="sm"
    >
      {children}
    </PremiumButton>
  );
}

export function ResponsiveTable<T>({
  rows,
  columns,
  getKey,
  renderCard,
  empty,
  onRowClick,
  selectedKey,
  rowAriaLabel,
}: {
  rows: T[];
  columns: Array<{
    key: string;
    label: string;
    render: (row: T) => React.ReactNode;
    align?: 'left' | 'right';
    hideWhenDetail?: boolean;
    className?: string;
  }>;
  getKey: (row: T) => string;
  renderCard: (row: T) => React.ReactNode;
  empty: React.ReactNode;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  rowAriaLabel?: (row: T) => string;
}) {
  if (rows.length === 0) return <>{empty}</>;
  const visibleColumns = selectedKey ? columns.filter((column) => !column.hideWhenDetail) : columns;
  return (
    <>
      <PremiumTableSurface density="dense" withHorizontalScroll className="hidden bg-white md:block" ariaLabel="Table console">
        <table className={classNames('w-full text-[0.76rem]', selectedKey ? 'min-w-[480px]' : 'min-w-[640px]')}>
          <thead className="bg-slate-50">
            <tr>
              {visibleColumns.map((column) => (
                <th key={column.key} className={classNames('px-2 py-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.09em] text-slate-500', column.align === 'right' ? 'text-right' : 'text-left', column.className)}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = getKey(row);
              const isSelected = selectedKey === key;
              return (
                <tr
                  key={key}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={rowAriaLabel?.(row)}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(event) => {
                    if (!onRowClick) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }}
                  className={classNames(
                    'border-t border-slate-100 transition',
                    onRowClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
                    isSelected ? 'bg-emerald-50/70 shadow-[inset_3px_0_0_#047857]' : 'hover:bg-slate-50/70',
                  )}
                >
                  {visibleColumns.map((column) => (
                    <td key={column.key} className={classNames('px-2 py-1.5 align-middle text-[0.72rem] font-medium', column.align === 'right' ? 'text-right' : 'text-left', column.className)}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </PremiumTableSurface>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => <React.Fragment key={getKey(row)}>{renderCard(row)}</React.Fragment>)}
      </div>
    </>
  );
}
