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
      className={`flex items-center gap-1 border-b border-slate-200 overflow-x-auto scrollbar-hide ${className}`}
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
              relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
              transition-colors duration-200 focus:outline-none focus-visible:bg-orange-50 rounded-t
              ${active ? 'text-orange-600' : 'text-slate-500 hover:text-slate-800'}
            `}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-semibold rounded-full ${
                  active ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.badge}
              </span>
            )}
            {active && (
              <span
                aria-hidden="true"
                className="absolute -bottom-px left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-600 rounded-t"
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
