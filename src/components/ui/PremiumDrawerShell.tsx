import type { ReactNode } from 'react';

export function PremiumDrawerShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <aside className={`flex h-full min-h-0 flex-col overflow-hidden border-l border-emerald-950/10 bg-[#fffdf8] shadow-[-18px_0_50px_rgba(15,23,42,0.08)] ${className}`}>
      {children}
    </aside>
  );
}

export function PremiumDrawerActionSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid gap-2 rounded-2xl border border-emerald-950/10 bg-white/82 p-3 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
