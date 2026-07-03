import { type ReactNode, type ElementType, isValidElement } from 'react';

interface CompactSectionProps {
  title: string;
  icon?: ReactNode | ElementType;
  children: ReactNode;
  className?: string;
}

export function CompactSection({ title, icon, children, className = '' }: CompactSectionProps) {
  const renderIcon = () => {
    if (!icon) return null;
    if (isValidElement(icon)) return icon;
    if (typeof icon === 'function' || (typeof icon === 'object' && 'render' in icon)) {
      const IconComp = icon as ElementType;
      return <IconComp className="h-3.5 w-3.5 text-emerald-800" aria-hidden="true" />;
    }
    return null;
  };

  return (
    <section className={`rounded-xl border border-emerald-950/10 bg-white/80 p-2.5 shadow-sm ${className}`}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[0.62rem] font-black uppercase tracking-wider text-slate-500">
        {renderIcon()}
        <span>{title}</span>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}

interface CompactLabelValueProps {
  label: string;
  value: ReactNode;
  strong?: boolean;
}

export function CompactLabelValue({ label, value, strong = false }: CompactLabelValueProps) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 py-1 sm:py-0.5">
      <span className="shrink-0 text-[0.68rem] font-semibold text-slate-500">{label}</span>
      <span className={`min-w-0 text-right text-[0.72rem] ${strong ? 'font-black text-slate-950' : 'font-semibold text-slate-700'}`}>{value}</span>
    </div>
  );
}
