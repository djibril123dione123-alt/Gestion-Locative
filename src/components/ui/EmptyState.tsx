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
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-lg border border-emerald-950/10 bg-white/85 p-6 text-center shadow-sm backdrop-blur sm:p-12">
      <div className="pointer-events-none absolute -right-8 -top-8 opacity-[0.035]">
        <BrandMark size="xl" tone="light" withTile={false} />
      </div>
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg border border-emerald-900/10 bg-emerald-50 shadow-inner sm:h-20 sm:w-20">
        <Icon className="h-8 w-8 text-brand-700 sm:h-10 sm:w-10" />
      </div>
      <h3 className="mb-2 text-xl font-black text-slate-950">{title}</h3>
      <p className="mb-6 max-w-md leading-7 text-slate-600">{description}</p>
      {action && (
        <Button onClick={action.onClick} size="lg" className="w-full sm:w-auto">
          {action.label}
        </Button>
      )}
    </div>
  );
}
