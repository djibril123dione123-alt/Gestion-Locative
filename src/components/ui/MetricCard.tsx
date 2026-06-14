import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export type MetricTone = 'emerald' | 'blue' | 'amber' | 'green' | 'red' | 'slate';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone: MetricTone;
  wide?: boolean;
  className?: string;
}

export function MetricCard({ label, value, icon: Icon, tone, wide = false, className = '' }: MetricCardProps) {
  const tones = {
    emerald: { gradient: 'from-white to-emerald-50/70', text: 'text-emerald-900', icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
    blue: { gradient: 'from-white to-slate-50/75', text: 'text-slate-900', icon: 'bg-slate-50 text-slate-700 ring-slate-100' },
    amber: { gradient: 'from-white to-amber-50/70', text: 'text-amber-900', icon: 'bg-amber-50 text-amber-700 ring-amber-100' },
    green: { gradient: 'from-white to-emerald-50/70', text: 'text-emerald-900', icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
    red: { gradient: 'from-white to-rose-50/70', text: 'text-red-700', icon: 'bg-red-50 text-red-700 ring-red-100' },
    slate: { gradient: 'from-white to-stone-50/75', text: 'text-slate-900', icon: 'bg-stone-50 text-slate-700 ring-stone-100' },
  }[tone];

  return (
    <article
      className={`@container group min-w-0 rounded-[1.05rem] border border-emerald-950/10 bg-gradient-to-br ${tones.gradient} p-2.5 shadow-[0_9px_24px_rgba(15,23,42,0.045)] ring-1 ring-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_13px_30px_rgba(15,23,42,0.075)] ${wide ? 'sm:col-span-2' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-600 line-clamp-2 min-h-[2.5em]">{label}</h3>
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ${tones.icon} shadow-sm transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className={`mt-1.5 w-full max-w-full whitespace-nowrap text-base font-black tracking-tight sm:text-lg ${tones.text}`}>
        {value}
      </p>
    </article>
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
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-current opacity-60 line-clamp-2 min-h-[2.5em]">{label}</p>
      <p className="mt-0.5 w-full whitespace-nowrap text-sm font-black tracking-tight text-current">{value}</p>
    </div>
  );
}
