import type { ReactNode } from 'react';
import { premiumTokens } from './premiumTokens';

export function PremiumTableSurface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`${premiumTokens.surface} overflow-hidden ${className}`}>
      {children}
    </section>
  );
}
