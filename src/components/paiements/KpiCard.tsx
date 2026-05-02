import type { LucideIcon } from 'lucide-react';

type Accent = 'orange' | 'emerald' | 'amber' | 'slate';

const ACCENT_STYLES: Record<
  Accent,
  { iconBg: string; iconText: string; valueText: string; progressBg: string }
> = {
  orange: {
    iconBg: 'bg-orange-50',
    iconText: 'text-orange-600',
    valueText: 'text-slate-900',
    progressBg: 'bg-gradient-to-r from-orange-500 to-red-600',
  },
  emerald: {
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-600',
    valueText: 'text-emerald-700',
    progressBg: 'bg-emerald-500',
  },
  amber: {
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
    valueText: 'text-amber-700',
    progressBg: 'bg-amber-500',
  },
  slate: {
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-600',
    valueText: 'text-slate-800',
    progressBg: 'bg-slate-400',
  },
};

export interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subtitle?: string;
  accent?: Accent;
  progress?: number;
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  accent = 'orange',
  progress,
}: KpiCardProps) {
  const styles = ACCENT_STYLES[accent];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">
            {label}
          </p>
          <p className={`text-xl sm:text-2xl font-bold mt-1 truncate tabular-nums ${styles.valueText}`}>
            {value}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${styles.iconBg}`}>
          <Icon className={`w-5 h-5 ${styles.iconText}`} />
        </div>
      </div>
      {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${styles.progressBg}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
