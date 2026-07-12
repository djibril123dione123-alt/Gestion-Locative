import React from 'react';
import { CheckCircle2, Loader2, type LucideIcon } from 'lucide-react';
import { classNames } from '../../lib/admin/adminFormatters';
import { getStatusLabel, getStatusTone, type AdminTone } from '../../lib/admin/adminStatusMapping';
import { MetricCard, type MetricTone } from '../ui/MetricCard';
import { PremiumButton } from '../ui/PremiumButton';
import { PremiumKpiGrid } from '../ui/PremiumKpiGrid';
import { PremiumTableSurface } from '../ui/PremiumTableSurface';

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
    <span className={`inline-flex max-w-full items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.09em] ${toneClasses[nextTone]}`}>
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
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <PremiumTableSurface density="compact" className={classNames('bg-white/95', className)}>
      <div className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[0.92rem] font-black leading-tight text-slate-950">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[0.72rem] font-medium leading-4 text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-2.5 sm:p-3">{children}</div>
    </PremiumTableSurface>
  );
}

export function AdminEmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[1.05rem] border border-dashed border-slate-200 bg-slate-50/70 p-3 text-center">
      <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-700" />
      <p className="mt-1.5 text-[0.82rem] font-black text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[0.72rem] font-medium leading-4 text-slate-500">{text}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function AdminPartialDataNotice({ errors }: { errors: string[] }) {
  void errors;
  return null;
}

export function AdminLoadingState({ label = 'Chargement console...' }: { label?: string }) {
  return (
    <PremiumTableSurface density="compact" className="bg-white">
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
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
  columns: Array<{ key: string; label: string; render: (row: T) => React.ReactNode; align?: 'left' | 'right' }>;
  getKey: (row: T) => string;
  renderCard: (row: T) => React.ReactNode;
  empty: React.ReactNode;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  rowAriaLabel?: (row: T) => string;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <>
      <PremiumTableSurface density="dense" withHorizontalScroll className="hidden bg-white md:block" ariaLabel="Table console">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={classNames('px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.11em] text-slate-500', column.align === 'right' ? 'text-right' : 'text-left')}>
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
                  {columns.map((column) => (
                    <td key={column.key} className={classNames('px-3 py-1.5 align-middle text-[0.78rem]', column.align === 'right' ? 'text-right' : 'text-left')}>
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
