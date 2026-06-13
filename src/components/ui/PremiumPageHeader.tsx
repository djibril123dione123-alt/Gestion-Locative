import type { ReactNode } from 'react';

interface PremiumPageHeaderProps {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PremiumPageHeader({ eyebrow, title, subtitle, actions }: PremiumPageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-action-600">{eyebrow}</p>
        <h1 className="mt-1 font-serif text-3xl font-black tracking-tight text-brand-950 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-col gap-2 sm:flex-row">{actions}</div>}
    </header>
  );
}
