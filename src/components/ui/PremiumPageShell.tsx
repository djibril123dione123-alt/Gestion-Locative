import type { ReactNode } from 'react';

export function PremiumPageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-full overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(255,247,230,0.95),transparent_28rem),linear-gradient(180deg,#fffaf1,#f8f4ea_48%,#f7faf8)] py-2.5 sm:py-3 ${className}`}>
      {children}
    </div>
  );
}
