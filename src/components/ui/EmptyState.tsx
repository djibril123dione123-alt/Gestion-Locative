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
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Skip the card chrome (border/shadow/background/watermark) for use inside an existing card container. */
  bare?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, secondaryAction, bare = false }: EmptyStateProps) {
  return (
    <div
      className={
        bare
          ? 'relative flex flex-col items-center justify-center overflow-hidden py-8 text-center sm:py-12'
          : 'sk-empty-state overflow-hidden relative group'
      }
    >
      {!bare && (
        <div className="pointer-events-none absolute -right-8 -top-8 opacity-[0.04]">
          <BrandMark size="xl" tone="light" withTile={false} />
        </div>
      )}

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
      
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
          {action && (
            <div className="relative inline-block w-full sm:w-auto">
              <div className="absolute inset-0 rounded-xl bg-emerald-400 opacity-20 blur-md animate-pulse" />
              <Button onClick={action.onClick} size="lg" className="relative w-full shadow-emerald-900/10 hover:shadow-emerald-900/20">
                {action.label}
              </Button>
            </div>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="sk-action sk-action-secondary w-full justify-center px-4 py-2.5 sm:w-auto text-sm"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
