import type { ReactNode } from 'react';

export function MiniMetricGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 ${className}`}>
      {children}
    </div>
  );
}
