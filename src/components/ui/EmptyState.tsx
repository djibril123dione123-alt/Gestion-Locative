import { LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { BrandMark } from '../brand/BrandLogo';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="sk-empty-state overflow-hidden relative group">
      <div className="pointer-events-none absolute -right-8 -top-8 opacity-[0.04]">
        <BrandMark size="xl" tone="light" withTile={false} />
      </div>
      
      {/* Halos décoratifs premium */}
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-emerald-50 opacity-50 scale-150 transition-transform duration-700 group-hover:scale-175" />
        <div className="absolute inset-2 rounded-full bg-emerald-100 opacity-60 scale-125 transition-transform duration-500 delay-75 group-hover:scale-150" />
        <div className="absolute inset-4 rounded-full bg-emerald-200/40 scale-110 shadow-inner" />
        <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_12px_24px_rgba(15,23,42,0.06)] border border-emerald-950/5">
          <Icon className="h-7 w-7 text-emerald-600" />
        </div>
      </div>
      
      <h3 className="mb-2 text-xl font-black leading-snug text-slate-950 sm:text-2xl">{title}</h3>
      <p className="mb-6 max-w-md text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
      
      {action && (
        <div className="relative inline-block">
          {/* Subtle pulse behind button */}
          <div className="absolute inset-0 rounded-xl bg-emerald-400 opacity-20 blur-md animate-pulse" />
          <Button onClick={action.onClick} size="lg" className="relative w-full sm:w-auto shadow-emerald-900/10 hover:shadow-emerald-900/20">
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
