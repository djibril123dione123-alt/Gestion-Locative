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
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white/80 p-12 text-center shadow-sm">
      <div className="pointer-events-none absolute -right-8 -top-8 opacity-[0.035]">
        <BrandMark size="xl" tone="light" withTile={false} />
      </div>
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-lg bg-emerald-50 shadow-inner">
        <Icon className="h-10 w-10 text-brand-700" />
      </div>
      <h3 className="mb-2 text-xl font-black text-slate-950">{title}</h3>
      <p className="mb-6 max-w-md leading-7 text-slate-600">{description}</p>
      {action && (
        <Button onClick={action.onClick} size="lg">
          {action.label}
        </Button>
      )}
    </div>
  );
}
