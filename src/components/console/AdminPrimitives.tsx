import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, type LucideIcon } from 'lucide-react';
import { classNames } from '../../lib/admin/adminFormatters';
import { getStatusLabel, getStatusTone, type AdminTone } from '../../lib/admin/adminStatusMapping';

const toneClasses: Record<AdminTone, string> = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-red-200 bg-red-50 text-red-800',
  blue: 'border-sky-200 bg-sky-50 text-sky-800',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-800',
  dark: 'border-emerald-900/20 bg-emerald-950 text-white',
};

export function AdminStatusBadge({ status, children, tone }: { status?: string | null; children?: React.ReactNode; tone?: AdminTone }) {
  const nextTone = tone ?? getStatusTone(status);
  return (
    <span className={classNames('inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.1em]', toneClasses[nextTone])}>
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
}: {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  icon?: LucideIcon;
  tone?: AdminTone;
}) {
  return (
    <div className="rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-slate-500">{label}</p>
          <p className="mt-1 truncate text-base font-black text-slate-950 sm:text-lg">{value}</p>
        </div>
        {Icon && (
          <span className={classNames('rounded-xl border p-2', toneClasses[tone])}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      {helper && <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{helper}</p>}
    </div>
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
    <section className={classNames('rounded-2xl border border-emerald-950/10 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.05)]', className)}>
      <div className="flex flex-col gap-2.5 border-b border-slate-100 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-950">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs font-medium leading-5 text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

export function AdminEmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center">
      <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-700" />
      <p className="mt-2 text-sm font-black text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs font-medium leading-5 text-slate-500">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function AdminPartialDataNotice({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em]">Données partielles</p>
          <p className="mt-1 text-xs font-semibold leading-5">
            {errors.slice(0, 3).join(' · ')}{errors.length > 3 ? ` · ${errors.length - 3} autre(s) source(s)` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdminLoadingState({ label = 'Chargement console...' }: { label?: string }) {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
    </div>
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
  const variants = {
    primary: 'border-emerald-900 bg-emerald-950 text-white hover:bg-emerald-900',
    secondary: 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
    danger: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
    ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classNames('inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50', variants[variant])}
    >
      {children}
    </button>
  );
}

export function ResponsiveTable<T>({
  rows,
  columns,
  getKey,
  renderCard,
  empty,
}: {
  rows: T[];
  columns: Array<{ key: string; label: string; render: (row: T) => React.ReactNode; align?: 'left' | 'right' }>;
  getKey: (row: T) => string;
  renderCard: (row: T) => React.ReactNode;
  empty: React.ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={classNames('px-3 py-2.5 text-xs font-black uppercase tracking-[0.11em] text-slate-500', column.align === 'right' ? 'text-right' : 'text-left')}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getKey(row)} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                {columns.map((column) => (
                  <td key={column.key} className={classNames('px-3 py-2.5 align-middle', column.align === 'right' ? 'text-right' : 'text-left')}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => <React.Fragment key={getKey(row)}>{renderCard(row)}</React.Fragment>)}
      </div>
    </>
  );
}
