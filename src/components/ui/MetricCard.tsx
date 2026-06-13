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
    emerald: { gradient: 'from-white to-emerald-50/65', text: 'text-emerald-800', icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
    blue: { gradient: 'from-white to-blue-50/65', text: 'text-blue-800', icon: 'bg-blue-50 text-blue-700 ring-blue-100' },
    amber: { gradient: 'from-white to-amber-50/65', text: 'text-amber-800', icon: 'bg-amber-50 text-amber-700 ring-amber-100' },
    green: { gradient: 'from-white to-emerald-50/65', text: 'text-emerald-800', icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
    red: { gradient: 'from-white to-red-50/65', text: 'text-red-700', icon: 'bg-red-50 text-red-700 ring-red-100' },
    slate: { gradient: 'from-white to-slate-50/65', text: 'text-slate-800', icon: 'bg-slate-50 text-slate-700 ring-slate-100' },
  }[tone];

  return (
    <article
      className={`group min-w-0 rounded-2xl border border-emerald-950/10 bg-gradient-to-br ${tones.gradient} p-3 shadow-[0_10px_28px_rgba(15,23,42,0.045)] ring-1 ring-white/70 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)] transition-all duration-200 flex flex-col justify-between ${wide ? 'sm:col-span-2' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-600 line-clamp-1">{label}</h3>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ${tones.icon} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={`mt-2 text-xl font-black tracking-tight ${tones.text} line-clamp-1 break-all`}>
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
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
  }[tone];

  return (
    <div className={`rounded-xl border px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ${toneClass} ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-current opacity-60 line-clamp-1">{label}</p>
      <p className="mt-0.5 text-sm font-black tracking-tight text-current line-clamp-1">{value}</p>
    </div>
  );
}
