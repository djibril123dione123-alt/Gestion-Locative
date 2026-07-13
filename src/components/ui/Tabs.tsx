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
  size?: 'standard' | 'compact';
  fullWidthMobile?: boolean;
}

export function Tabs({ tabs, activeId, onChange, className = '', size = 'standard', fullWidthMobile = false }: TabsProps) {
  const isCompact = size === 'compact';
  const widthClasses = fullWidthMobile ? 'w-full sm:w-auto' : '';
  const buttonWidthClasses = fullWidthMobile ? 'flex-1 justify-center sm:flex-initial' : '';

  const containerClass = isCompact
    ? `flex items-center gap-1 overflow-x-auto rounded-lg border border-slate-200/60 bg-slate-100/80 p-0.5 shadow-none scrollbar-hide ${widthClasses} ${className}`
    : `flex items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white/80 p-1 shadow-sm scrollbar-hide ${widthClasses} ${className}`;

  return (
    <div
      role="tablist"
      className={containerClass}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon as ComponentType<{ className?: string }> | undefined;
        const active = tab.id === activeId;
        const buttonClass = isCompact
          ? `relative inline-flex items-center ${buttonWidthClasses} gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-[0.72rem] font-bold transition duration-150 focus:outline-none ${
              active ? 'bg-brand-950 text-white shadow-sm font-black' : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-800'
            }`
          : `relative inline-flex items-center ${buttonWidthClasses} gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-black sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm transition duration-200 focus:outline-none focus-visible:bg-emerald-50 ${
              active ? 'bg-brand-950 text-white shadow-sm' : 'text-slate-500 hover:bg-emerald-50 hover:text-brand-900'
            }`;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active ? "true" : "false"}
            onClick={() => onChange(tab.id)}
            className={buttonClass}
          >
            {Icon && <Icon className={isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} />}
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
