import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { MoneyText } from './MoneyText';

type Tone = 'emerald' | 'amber' | 'red' | 'blue' | 'slate';

export type PremiumMobileCardDensity = 'comfortable' | 'compact';

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

  const pClass = density === 'compact' ? 'p-2.5' : 'p-3.5';

  return (
    <Comp
      data-premium-mobile-card="true"
      type={isNativeButton ? 'button' : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      {...(isNativeButton && { 'aria-pressed': isEffectivelySelected })}
      {...interactiveProps}
      className={`block w-full rounded-[1.15rem] border bg-[#fffdf8] ${pClass} text-left shadow-[0_12px_30px_rgba(15,23,42,0.055)] ring-1 ring-white/80 transition active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:border-emerald-400 ${
        isEffectivelySelected ? 'border-emerald-300 bg-emerald-50/55' : 'border-emerald-950/10 hover:border-emerald-200 hover:bg-emerald-50/35'
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-white ${emphasis === 'identity' ? 'font-bold' : 'font-black'} text-brand-900 shadow-sm ring-1 ring-emerald-950/10 ${avatarSize === 'md' ? 'h-[38px] w-[38px] text-sm' : 'h-8 w-8 text-xs'}`}>
          {Icon ? <Icon className={avatarSize === 'md' ? 'h-5 w-5' : 'h-4 w-4'} /> : initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              {eyebrow && <p className={`mb-0.5 truncate text-[0.6rem] ${emphasis === 'identity' ? 'font-bold' : 'font-black'} uppercase tracking-[0.12em] text-action-600`}>{eyebrow}</p>}
              <p className={`truncate ${emphasis === 'identity' ? 'text-[0.86rem] font-bold leading-tight text-slate-950' : 'text-[0.8rem] font-black leading-5 text-slate-950'}`}>{title}</p>
              {subtitle && <p className="mt-0.5 line-clamp-2 text-[0.65rem] font-semibold leading-4 text-slate-500">{subtitle}</p>}
            </div>
            {status && (
              <span className={`shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[0.55rem] ${emphasis === 'identity' ? 'font-bold' : 'font-black'} uppercase tracking-[0.06em] ${toneClasses[statusTone]}`}>
                {status}
              </span>
            )}
          </div>

          {(amount !== undefined || meta.length > 0) && (
            <div className={`${emphasis === 'identity' ? 'mt-2' : 'mt-3'} flex items-end justify-between gap-3`}>
              {amount !== undefined ? (
                <div className="min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-1.5">
                    {amountLabel && <span className={`text-[0.6rem] ${emphasis === 'identity' ? 'font-medium' : 'font-bold uppercase tracking-[0.09em]'} text-slate-400`}>{amountLabel}</span>}
                    <MoneyText value={amount} compact={amountCompact} suffix={amountSuffix} className={`${emphasis === 'identity' ? 'text-[0.8rem] font-semibold' : 'text-sm font-black'} ${amountTone ? (amountTone === 'emerald' ? 'text-emerald-700' : amountTone === 'red' ? 'text-red-600' : 'text-slate-800') : 'text-slate-950'}`} />
                  </div>
                  {secondaryAmount !== undefined && (
                    <div className="flex items-baseline gap-1.5">
                      {secondaryAmountLabel && <span className="text-[0.6rem] font-semibold text-slate-500">{secondaryAmountLabel}</span>}
                      <MoneyText value={secondaryAmount} compact={amountCompact} className={`text-xs ${emphasis === 'identity' ? 'font-medium' : 'font-bold'} ${secondaryAmountTone === 'red' ? 'text-red-600' : 'text-slate-500'}`} />
                    </div>
                  )}
                </div>
              ) : <span />}
              {meta.length > 0 && (
                <div className="flex min-w-0 flex-wrap justify-end gap-1.5">
                  {meta.slice(0, 3).map((item) => (
                    <span key={item.label} className={`rounded-lg border px-1.5 py-0.5 text-[0.55rem] font-bold ${toneClasses[item.tone ?? 'slate']}`}>
                      <span className="text-current opacity-65">{item.label}</span> <span>{item.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <div className={`mt-3 flex flex-col ${density === 'compact' ? 'gap-1.5' : 'gap-2'} border-t border-slate-900/5 pt-3`}>
              {rows.map((row, i) => (
                <div key={i} className={`flex items-start justify-between gap-3 text-sm ${row.align === 'right' ? 'text-right flex-row-reverse' : 'text-left'}`}>
                  <span className="text-slate-500 font-medium whitespace-nowrap flex items-center gap-1.5">
                    {row.icon && <span className="opacity-70">{row.icon}</span>}
                    {row.label}
                  </span>
                  <span className={`font-semibold text-slate-900 ${row.align === 'right' ? '' : 'text-right'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {children && (
            <div className="mt-3 border-t border-slate-900/5 pt-3">
              {children}
            </div>
          )}

          {actions && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-900/5 pt-3" onClick={(e) => e.stopPropagation()}>
              {actions}
            </div>
          )}

          {footer && (
            <div className="mt-3 border-t border-slate-900/5 pt-3 text-xs text-slate-500">
              {footer}
            </div>
          )}
        </div>
        {onClick && <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-slate-300" />}
      </div>
    </Comp>
  );
}
