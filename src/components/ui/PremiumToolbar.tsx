import type { ReactNode } from 'react';
import { premiumTokens } from './premiumTokens';

interface PremiumToolbarProps {
  search?: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PremiumToolbar({ search, actions, filters, meta, children, className = '' }: PremiumToolbarProps) {
  return (
    <div className={`relative z-20 overflow-visible ${premiumTokens.toolbar} ${className}`}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">{search ?? children}</div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {meta && <div className="mt-2.5 text-xs font-medium text-slate-500">{meta}</div>}
      {filters && <div className="mt-3">{filters}</div>}
    </div>
  );
}
