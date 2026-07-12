import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { MoneyText } from './MoneyText';

type Tone = 'emerald' | 'amber' | 'red' | 'blue' | 'slate';

export type PremiumMobileCardDensity = 'comfortable' | 'compact' | 'dense';

export type PremiumMobileCardRow = {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  align?: 'left' | 'center' | 'right';
  tone?: Tone | 'neutral' | 'success' | 'warning' | 'danger' | 'info';
};

interface PremiumMobileCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  icon?: LucideIcon;
  initials?: string;
  status?: ReactNode;
  statusTone?: Tone;
  avatarSize?: 'sm' | 'md';
  amountTone?: Tone;
  secondaryAmount?: number | string | null;
  secondaryAmountLabel?: string;
  secondaryAmountTone?: Tone;
  amount?: number | string | null;
  amountLabel?: string;
  amountCompact?: boolean;
  amountSuffix?: string;
  meta?: Array<{ label: string; value: ReactNode; tone?: Tone }>;
  topMeta?: Array<{ label: string; value: ReactNode; tone?: Tone }>;
  rows?: PremiumMobileCardRow[];
  actions?: ReactNode;
  footer?: ReactNode;
  active?: boolean;
  selected?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  density?: PremiumMobileCardDensity;
  emphasis?: 'default' | 'identity';
  className?: string;
  children?: ReactNode;
}

const toneClasses: Record<Tone, string> = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-red-200 bg-red-50 text-red-700',
  blue: 'border-slate-200 bg-slate-50 text-slate-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
};

const amountToneClass = (tone?: Tone, fallback = 'text-slate-800') => {
  if (tone === 'emerald') return 'text-emerald-700';
  if (tone === 'red') return 'text-red-600';
  if (tone === 'amber') return 'text-amber-700';
  return fallback;
};

export function PremiumMobileCard({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  initials,
  status,
  statusTone = 'emerald',
  avatarSize = 'sm',
  amountTone,
  secondaryAmount,
  secondaryAmountLabel,
  secondaryAmountTone = 'slate',
  amount,
  amountLabel,
  amountCompact = false,
  amountSuffix,
  meta = [],
  topMeta = [],
  rows = [],
  actions,
  footer,
  active = false,
  selected = false,
  onClick,
  ariaLabel,
  density = 'comfortable',
  emphasis = 'default',
  className = '',
  children,
}: PremiumMobileCardProps) {
  const isEffectivelySelected = selected || active;
  const hasInteractiveChildren = !!(actions || footer || children);
  const isNativeButton = !!(onClick && !hasInteractiveChildren);
  const Comp = isNativeButton ? 'button' : 'article';

  const interactiveProps = onClick && !isNativeButton ? {
    role: "button",
    tabIndex: 0,
    "aria-pressed": isEffectivelySelected,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    }
  } : {};

  const isDense = density === 'dense';
  const isCompact = density === 'compact' || isDense;
  const pClass = isDense ? 'p-2' : density === 'compact' ? 'p-2.5' : 'p-3.5';
  const gapClass = isDense ? 'gap-2' : 'gap-3';
  const avatarClass = avatarSize === 'md'
    ? 'h-[38px] w-[38px] text-sm'
    : isDense
      ? 'h-7 w-7 text-[0.68rem]'
      : 'h-8 w-8 text-xs';
  const avatarIconClass = avatarSize === 'md' ? 'h-5 w-5' : isDense ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const eyebrowClass = isDense ? 'text-[0.52rem] tracking-[0.1em]' : 'text-[0.6rem] tracking-[0.12em]';
  const titleClass = isDense
    ? 'text-[0.78rem] font-bold leading-tight text-slate-950'
    : emphasis === 'identity'
      ? 'text-[0.86rem] font-bold leading-tight text-slate-950'
      : 'text-[0.8rem] font-black leading-5 text-slate-950';
  const subtitleClass = isDense
    ? 'mt-0.5 line-clamp-1 text-[0.6rem] font-medium leading-[0.875rem] text-slate-500'
    : 'mt-0.5 line-clamp-2 text-[0.65rem] font-semibold leading-4 text-slate-500';
  const statusClass = isDense ? 'px-1.5 py-0.5 text-[0.5rem]' : 'px-1.5 py-0.5 text-[0.55rem]';

  return (
    <Comp
      data-premium-mobile-card="true"
      type={isNativeButton ? 'button' : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      {...(isNativeButton && { 'aria-pressed': isEffectivelySelected })}
      {...interactiveProps}
      className={`block w-full max-w-full min-w-0 rounded-[1.15rem] border bg-[#fffdf8] ${pClass} text-left shadow-[0_12px_30px_rgba(15,23,42,0.055)] ring-1 ring-white/80 transition active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:border-emerald-400 ${
        isEffectivelySelected ? 'border-emerald-300 bg-emerald-50/50' : 'border-emerald-950/10 hover:border-emerald-200 hover:bg-emerald-50/30'
      } ${className}`}
    >
      <div className={`flex items-start ${gapClass}`}>
        <div className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-white ${emphasis === 'identity' ? 'font-bold' : 'font-black'} text-brand-900 shadow-sm ring-1 ring-emerald-950/10 ${avatarClass}`}>
          {Icon ? <Icon className={avatarIconClass} /> : initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              {eyebrow && <p className={`mb-0.5 truncate ${eyebrowClass} ${emphasis === 'identity' ? 'font-bold' : 'font-black'} uppercase text-action-600`}>{eyebrow}</p>}
              <p className={`truncate ${titleClass}`}>{title}</p>
              {subtitle && <p className={subtitleClass}>{subtitle}</p>}
            </div>
            <div className={`flex shrink-0 flex-col items-end ${isDense ? 'gap-1' : 'gap-1.5'}`}>
              {status && (
                <span className={`shrink-0 whitespace-nowrap rounded-full border ${statusClass} ${emphasis === 'identity' ? 'font-bold' : 'font-black'} uppercase tracking-[0.06em] ${toneClasses[statusTone]}`}>
                  {status}
                </span>
              )}
              {topMeta.length > 0 && (
                <div className="flex justify-end gap-1.5">
                  {topMeta.map((item) => (
                    <span key={item.label} className={`whitespace-nowrap rounded-lg border px-1.5 py-0.5 text-[0.55rem] font-bold ${toneClasses[item.tone ?? 'slate']}`}>
                      <span className="text-current opacity-65">{item.label}</span> <span>{item.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(amount !== undefined || meta.length > 0) && (
            <div className={`${emphasis === 'identity' ? 'mt-2' : 'mt-2.5'} flex items-center justify-between gap-2`}>
              {amount !== undefined ? (
                <div className="shrink-0 flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-1.5">
                    {amountLabel && <span className={`whitespace-nowrap text-[0.55rem] ${emphasis === 'identity' ? 'font-medium' : 'font-bold uppercase tracking-[0.09em]'} text-slate-400`}>{amountLabel}</span>}
                    <MoneyText value={amount} compact={amountCompact} suffix={amountSuffix} className={`${emphasis === 'identity' ? 'text-[0.75rem] font-semibold' : 'text-[0.8rem] font-black'} ${amountTone ? amountToneClass(amountTone) : 'text-slate-950'}`} />
                  </div>
                  {secondaryAmount !== undefined && (
                    <div className="flex items-baseline gap-1.5">
                      {secondaryAmountLabel && <span className="whitespace-nowrap text-[0.55rem] font-semibold text-slate-500">{secondaryAmountLabel}</span>}
                      <MoneyText value={secondaryAmount} compact={amountCompact} className={`text-[0.68rem] ${emphasis === 'identity' ? 'font-medium' : 'font-bold'} ${amountToneClass(secondaryAmountTone, 'text-slate-500')}`} />
                    </div>
                  )}
                </div>
              ) : <span />}
              {meta.length > 0 && (
                <div className={`flex shrink-0 ${meta.length > 1 ? 'flex-col items-end justify-center gap-1' : 'items-center justify-end'}`}>
                  {meta.slice(0, 3).map((item) => (
                    <span key={item.label} className={`whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[0.52rem] font-bold leading-tight ${toneClasses[item.tone ?? 'slate']}`}>
                      <span className="text-current opacity-65">{item.label}</span> <span>{item.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <div className={`${isCompact ? 'mt-2 gap-1.5 pt-2' : 'mt-3 gap-2 pt-3'} flex flex-col border-t border-slate-900/5`}>
              {rows.map((row, i) => (
                <div key={i} className={`flex min-w-0 items-start justify-between gap-3 ${density === 'compact' ? 'text-[0.72rem]' : 'text-sm'} ${row.align === 'right' ? 'text-right flex-row-reverse' : 'text-left'}`}>
                  <span className="shrink-0 text-slate-500 font-medium whitespace-nowrap flex items-center gap-1.5">
                    {row.icon && <span className="opacity-70">{row.icon}</span>}
                    {row.label}
                  </span>
                  <span className={`min-w-0 break-words font-semibold text-slate-900 ${row.align === 'right' ? '' : 'text-right'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {children && (
            <div className={`${isCompact ? 'mt-2 pt-2' : 'mt-3 pt-3'} border-t border-slate-900/5`}>
              {children}
            </div>
          )}

          {actions && (
            <div className={`${isCompact ? 'mt-2 pt-2' : 'mt-3 pt-3'} flex flex-wrap gap-2 border-t border-slate-900/5`} onClick={(e) => e.stopPropagation()}>
              {actions}
            </div>
          )}

          {footer && (
            <div className={`${isCompact ? 'mt-2 pt-2' : 'mt-3 pt-3'} border-t border-slate-900/5 text-xs text-slate-500`}>
              {footer}
            </div>
          )}
        </div>
        {onClick && <ChevronRight className={`${isDense ? 'mt-2 h-3.5 w-3.5' : 'mt-3 h-4 w-4'} shrink-0 text-slate-300`} />}
      </div>
    </Comp>
  );
}
