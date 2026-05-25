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
    <div className="sk-empty-state">
      <div className="pointer-events-none absolute -right-8 -top-8 opacity-[0.04]">
        <BrandMark size="xl" tone="light" withTile={false} />
      </div>
      <div className="sk-empty-state-icon">
        <Icon className="h-8 w-8 text-brand-700 sm:h-10 sm:w-10" />
      </div>
      <h3 className="mb-2 text-xl font-black leading-snug text-slate-950 sm:text-2xl">{title}</h3>
      <p className="mb-6 max-w-md text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
      {action && (
        <Button onClick={action.onClick} size="lg" className="w-full sm:w-auto">
          {action.label}
        </Button>
      )}
    </div>
  );
}
