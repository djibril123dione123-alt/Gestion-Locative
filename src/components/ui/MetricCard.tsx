import React, { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type MetricTone =
  | 'emerald' | 'blue' | 'amber' | 'green' | 'red' | 'slate' // Legacy
  | 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'financial' | 'proof'; // Officiel

interface MetricCardProps {
  /** @deprecated Utilisez `title` */
  label?: string;
  title?: string;
  mobileTitle?: string;
  value: ReactNode;
  valueA11yLabel?: string;
  icon: LucideIcon | React.ElementType;
  tone?: MetricTone;
  density?: 'comfortable' | 'compact';
  wide?: boolean;
  className?: string;

  // Interaction
  onClick?: () => void;
  ariaLabel?: string;

  // États (priorité: isActive > active > selected)
  isActive?: boolean;
  active?: boolean;
  selected?: boolean;

  // Clones compatibility (ex: KpiTile de Bailleurs)
  helper?: string;
  variant?: string;
  color?: string;
  iconTone?: string;
  accent?: string;
}

export function MetricCard({
  label,
  title,
  mobileTitle,
  value,
  valueA11yLabel,
  icon: Icon,
  tone = 'neutral',
  density = 'comfortable',
  wide = false,
  className = '',
  onClick,
  ariaLabel,
  isActive,
  active,
  selected,
  helper,
}: MetricCardProps) {
  const resolvedTitle = title ?? label ?? '';
  const activeState = isActive ?? active ?? selected;
  const hasToggleState = activeState !== undefined;
  const finalActive = Boolean(activeState);

  // Mapping des tons vers les styles (officiels + legacy)
  const toneMap: Record<string, { gradient: string; text: string; icon: string; activeRing: string }> = {
    // Nouveaux tones officiels
    neutral: { gradient: 'from-white to-slate-50/75', text: 'text-slate-900', icon: 'bg-slate-50 text-slate-700 ring-slate-100', activeRing: 'ring-slate-700/25 border-slate-700/30' },
    success: { gradient: 'from-white to-emerald-50/70', text: 'text-emerald-900', icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100', activeRing: 'ring-emerald-700/25 border-emerald-700/30' },
    warning: { gradient: 'from-white to-amber-50/70', text: 'text-amber-900', icon: 'bg-amber-50 text-amber-700 ring-amber-100', activeRing: 'ring-amber-700/25 border-amber-700/30' },
    danger: { gradient: 'from-white to-rose-50/70', text: 'text-red-700', icon: 'bg-red-50 text-red-700 ring-red-100', activeRing: 'ring-red-700/25 border-red-700/30' },
    info: { gradient: 'from-white to-sky-50/75', text: 'text-sky-900', icon: 'bg-sky-50 text-sky-700 ring-sky-100', activeRing: 'ring-sky-700/25 border-sky-700/30' },
    financial: { gradient: 'from-white to-emerald-50/70', text: 'text-brand-900', icon: 'bg-brand-50 text-brand-700 ring-brand-100', activeRing: 'ring-brand-700/25 border-brand-700/30' },
    proof: { gradient: 'from-white to-stone-50/70', text: 'text-slate-900', icon: 'bg-stone-50 text-slate-700 ring-stone-100', activeRing: 'ring-slate-700/25 border-slate-700/30' },

    // Legacy tones
    emerald: { gradient: 'from-white to-emerald-50/70', text: 'text-emerald-900', icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100', activeRing: 'ring-emerald-700/25 border-emerald-700/30' },
    blue: { gradient: 'from-white to-slate-50/75', text: 'text-slate-900', icon: 'bg-slate-50 text-slate-700 ring-slate-100', activeRing: 'ring-slate-700/25 border-slate-700/30' },
    amber: { gradient: 'from-white to-amber-50/70', text: 'text-amber-900', icon: 'bg-amber-50 text-amber-700 ring-amber-100', activeRing: 'ring-amber-700/25 border-amber-700/30' },
    green: { gradient: 'from-white to-emerald-50/70', text: 'text-emerald-900', icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100', activeRing: 'ring-emerald-700/25 border-emerald-700/30' },
    red: { gradient: 'from-white to-rose-50/70', text: 'text-red-700', icon: 'bg-red-50 text-red-700 ring-red-100', activeRing: 'ring-red-700/25 border-red-700/30' },
    slate: { gradient: 'from-white to-stone-50/75', text: 'text-slate-900', icon: 'bg-stone-50 text-slate-700 ring-stone-100', activeRing: 'ring-slate-700/25 border-slate-700/30' },
  };

  const tones = toneMap[tone] || toneMap.neutral;

  const isClickable = !!onClick;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isClickable) return;
    if (e.key === 'Enter') {
      onClick();
    } else if (e.key === 'Space' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const computedAriaLabel = ariaLabel ?? (valueA11yLabel ? `${resolvedTitle} : ${valueA11yLabel}` : resolvedTitle);

  const isCompact = density === 'compact';

  const containerClasses = [
    '@container group min-w-0 rounded-[1.05rem] border bg-gradient-to-br',
    tones.gradient,
    isCompact ? 'p-3 sm:p-2.5' : 'p-2.5 sm:p-3',
    isCompact ? 'shadow-[0_9px_24px_rgba(15,23,42,0.045)]' : 'shadow-[0_8px_22px_rgba(15,23,42,0.05)]',
    'transition-all duration-200 ease-out',
    // Animation hover subtile même si pas cliquable (sauf si actif)
    !finalActive ? `hover:-translate-y-0.5 ${isCompact ? 'hover:shadow-[0_13px_30px_rgba(15,23,42,0.075)]' : 'hover:shadow-[0_14px_32px_rgba(15,23,42,0.075)]'}` : '',
    wide ? 'sm:col-span-2' : '',
    isClickable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100' : '',
    finalActive
      ? `shadow-inner ${tones.activeRing}`
      : `ring-1 border-emerald-950/10 ${isCompact ? 'ring-white/70 hover:border-emerald-200' : `ring-black/[0.04] ${isClickable ? 'hover:border-emerald-200' : 'hover:border-emerald-950/15'}`}`,
    className
  ].filter(Boolean).join(' ');

  const a11yProps: React.HTMLAttributes<HTMLDivElement> = {};
  if (isClickable) {
    a11yProps.role = "button";
    a11yProps.tabIndex = 0;
    a11yProps.onClick = onClick;
    a11yProps.onKeyDown = handleKeyDown;
    if (hasToggleState) {
      a11yProps['aria-pressed'] = finalActive;
    }
  }
  if (isClickable || valueA11yLabel) {
    a11yProps['aria-label'] = computedAriaLabel;
  }

  return (
    <div
      className={containerClasses}
      {...a11yProps}
    >
      <div className={`flex items-start justify-between ${isCompact ? 'gap-2 sm:gap-1.5' : 'gap-3'}`}>
        <div className="min-w-0 flex-1">
          <h3 className={`font-black uppercase tracking-[0.12em] text-slate-600 ${isCompact ? 'text-[0.6rem] sm:text-[0.55rem] leading-none line-clamp-1' : 'text-[0.68rem] min-h-[2.5em] line-clamp-2'} ${mobileTitle ? 'hidden sm:block' : 'block'}`}>
            {resolvedTitle}
          </h3>
          {mobileTitle && (
            <h3 className={`font-black uppercase tracking-[0.12em] text-slate-600 sm:hidden ${isCompact ? 'text-[0.6rem] sm:text-[0.55rem] leading-none line-clamp-1' : 'text-[0.68rem] min-h-[2.5em] line-clamp-2'}`}>
              {mobileTitle}
            </h3>
          )}

          <div className={isCompact ? 'mt-1 sm:mt-0.5' : 'mt-1.5'} {...(valueA11yLabel ? { 'aria-hidden': true } : {})}>
            <div className={`w-full max-w-full whitespace-nowrap font-black tracking-tight ${isCompact ? 'text-[0.85rem] sm:text-[0.75rem]' : 'text-sm sm:text-base'} ${tones.text}`}>
              {value}
            </div>
          </div>

          {helper && (
            <p className={`${isCompact ? 'mt-1 text-[0.65rem] sm:mt-0.5 sm:text-[0.6rem] leading-tight line-clamp-1' : 'mt-0.5 text-xs'} hidden text-slate-500 sm:block`}>{helper}</p>
          )}
        </div>

        <div className={`flex shrink-0 items-center justify-center rounded-lg border border-current/10 ${tones.icon} shadow-sm transition-transform duration-300 group-hover:scale-110 ${isCompact ? 'h-6 w-6 mt-0.5' : 'h-8 w-8'}`}>
          <Icon className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </div>
      </div>
    </div>
  );
}

interface MiniMetricProps {
  label: string;
  value: ReactNode;
  tone?: 'emerald' | 'amber' | 'red' | 'blue' | 'slate';
  className?: string;
}

export function MiniMetric({ label, value, tone = 'slate', className = '' }: MiniMetricProps) {
  const toneClass = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    blue: 'border-stone-200 bg-stone-50 text-slate-900',
    slate: 'border-emerald-950/10 bg-[#fffdf8] text-slate-900',
  }[tone];

  return (
    <div className={`@container flex w-full flex-col rounded-xl border px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ${toneClass} ${className}`}>
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-current opacity-60 line-clamp-2 min-h-[2.5em]">{label}</p>
      <p className="mt-0.5 w-full whitespace-nowrap text-xs font-black tracking-tight text-current">{value}</p>
    </div>
  );
}
