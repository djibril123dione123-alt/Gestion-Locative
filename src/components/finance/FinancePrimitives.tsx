import React, { type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import { type MetricTone } from '../ui/MetricCard';
import { PremiumButton } from '../ui/PremiumButton';

interface FinancePageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryIcon?: ReactNode;
  secondaryIcon?: ReactNode;
  onPrimary?: () => void;
  onSecondary?: () => void;
  primaryDisabled?: boolean;
  secondaryDisabled?: boolean;
}

export function FinancePageHeader({
  eyebrow,
  title,
  description,
  primaryLabel,
  secondaryLabel,
  primaryIcon,
  secondaryIcon,
  onPrimary,
  onSecondary,
  primaryDisabled,
  secondaryDisabled,
}: FinancePageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 rounded-[1.35rem] border border-emerald-950/10 bg-[linear-gradient(135deg,rgba(255,252,245,0.96),rgba(255,255,255,0.91))] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-white/70 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-orange-600">{eyebrow}</p>
        <h1 className="mt-1 font-serif text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-600">{description}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
        {secondaryLabel && (
          <PremiumButton
            variant="secondary"
            icon={secondaryIcon}
            onClick={onSecondary}
            disabled={secondaryDisabled}
            fullWidth
            className="sm:w-auto"
          >
            {secondaryLabel}
          </PremiumButton>
        )}
        {primaryLabel && (
          <PremiumButton
            variant="create"
            icon={primaryIcon}
            onClick={onPrimary}
            disabled={primaryDisabled}
            fullWidth
            className="sm:w-auto"
          >
            {primaryLabel}
          </PremiumButton>
        )}
      </div>
    </header>
  );
}

interface FinanceMetric {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone: MetricTone;
  helper?: ReactNode;
}

export function FinanceKpiGrid({ metrics }: { metrics: FinanceMetric[] }) {
  const getTones = (tone: MetricTone) => {
    const toneMap: Record<MetricTone, { gradient: string; text: string; icon: string }> = {
      neutral: { gradient: 'from-white to-slate-50/75', text: 'text-slate-800', icon: 'bg-slate-50 text-slate-700 ring-slate-100' },
      success: { gradient: 'from-white to-emerald-50/70', text: 'text-brand-800', icon: 'bg-emerald-50 text-brand-800 ring-emerald-100' },
      warning: { gradient: 'from-white to-amber-50/70', text: 'text-amber-800', icon: 'bg-amber-50 text-amber-800 ring-amber-100' },
      danger: { gradient: 'from-white to-rose-50/70', text: 'text-red-700', icon: 'bg-red-50 text-red-700 ring-red-100' },
      info: { gradient: 'from-white to-slate-50/75', text: 'text-slate-800', icon: 'bg-slate-50 text-slate-700 ring-slate-100' },
      financial: { gradient: 'from-white to-emerald-50/70', text: 'text-brand-800', icon: 'bg-emerald-50 text-brand-800 ring-emerald-100' },
      proof: { gradient: 'from-white to-slate-50/75', text: 'text-slate-800', icon: 'bg-slate-50 text-slate-700 ring-slate-100' },
      emerald: { gradient: 'from-white to-emerald-50/70', text: 'text-brand-800', icon: 'bg-emerald-50 text-brand-800 ring-emerald-100' },
      blue: { gradient: 'from-white to-stone-50/75', text: 'text-slate-800', icon: 'bg-stone-50 text-slate-700 ring-stone-100' },
      amber: { gradient: 'from-white to-amber-50/70', text: 'text-amber-800', icon: 'bg-amber-50 text-amber-800 ring-amber-100' },
      red: { gradient: 'from-white to-rose-50/70', text: 'text-red-700', icon: 'bg-red-50 text-red-700 ring-red-100' },
      green: { gradient: 'from-white to-emerald-50/70', text: 'text-brand-800', icon: 'bg-emerald-50 text-brand-800 ring-emerald-100' },
      slate: { gradient: 'from-white to-stone-50/75', text: 'text-slate-800', icon: 'bg-stone-50 text-slate-700 ring-stone-100' },
    };
    return toneMap[tone] || toneMap.neutral;
  };

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
      {metrics.map((metric) => {
        const tones = getTones(metric.tone);
        const Icon = metric.icon;
        return (
          <article key={metric.label} className={`@container group min-w-0 rounded-[1.05rem] border border-emerald-950/10 bg-gradient-to-br ${tones.gradient} p-2.5 shadow-[0_9px_24px_rgba(15,23,42,0.045)] ring-1 ring-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_13px_30px_rgba(15,23,42,0.075)]`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`line-clamp-2 min-h-[2.5em] text-[0.68rem] font-bold uppercase tracking-[0.12em] ${tones.text}`}>{metric.label}</p>
                <p className="mt-1.5 whitespace-nowrap text-[1.02rem] font-extrabold tracking-tight text-slate-950 sm:text-[1.1rem]">{metric.value}</p>
                {metric.helper && <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">{metric.helper}</p>}
              </div>
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ring-1 transition-colors ${tones.icon} group-hover:scale-105`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function FinanceStatusTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; count?: number }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto rounded-xl bg-[#f7f1e7]/75 p-1">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 h-9 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition ${
              isActive
                ? 'bg-brand-950 text-white shadow-sm'
                : 'text-slate-600 hover:bg-emerald-50 hover:text-brand-900'
            }`}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function FinanceDrawer({
  title,
  subtitle,
  amount,
  details,
  badge,
  onClose,
  children,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  amount?: ReactNode;
  details?: ReactNode[];
  badge?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <aside className="fixed inset-y-0 right-0 z-[60] flex w-full flex-col overflow-hidden bg-[#fffdf8] shadow-[0_24px_70px_rgba(15,23,42,0.16)] xl:w-[31.5rem] xl:border-l xl:border-emerald-950/10">
      <div className="absolute inset-0 -z-10 bg-slate-900/30 xl:hidden" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex h-full flex-col bg-[#fffdf8]">
        <div className="sticky top-0 z-10 shrink-0 border-b border-emerald-950/10 bg-[#fffdf8]/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-800/70">{title}</p>
                {badge}
              </div>
              {amount && <div className="mt-1 text-3xl font-black tracking-tight text-slate-950">{amount}</div>}
              {details && details.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-600">
                  {details.map((detail, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <span className="text-slate-300">·</span>}
                      <span>{detail}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}
              {subtitle && <div className="mt-1.5 text-xs font-semibold leading-5 text-slate-500">{subtitle}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-950/10 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Fermer le détail"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </aside>
  );
}

export function FinanceInfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-emerald-950/10 bg-white/88 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{title}</h3>
      <div className="mt-3 space-y-2 text-sm">{children}</div>
    </section>
  );
}

export function FinanceLine({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      <span className={`text-right text-sm ${strong ? 'font-black text-slate-950' : 'font-semibold text-slate-700'}`}>{value}</span>
    </div>
  );
}
