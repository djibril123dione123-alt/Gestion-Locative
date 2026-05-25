import { ComponentType, ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export interface TabDef {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
}

interface TabsProps {
  tabs: TabDef[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeId, onChange, className = '' }: TabsProps) {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white/80 p-1 shadow-sm scrollbar-hide ${className}`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon as ComponentType<{ className?: string }> | undefined;
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`
              relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-black sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm
              transition duration-200 focus:outline-none focus-visible:bg-emerald-50
              ${active ? 'bg-brand-950 text-white shadow-sm' : 'text-slate-500 hover:bg-emerald-50 hover:text-brand-900'}
            `}
          >
            {Icon && <Icon className="h-4 w-4" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                  active ? 'bg-emerald-300 text-emerald-950' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.badge}
              </span>
            )}
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-3 bottom-0 h-0.5 rounded-t bg-emerald-300"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  children: ReactNode;
  className?: string;
}

export function TabPanel({ children, className = '' }: TabPanelProps) {
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}
