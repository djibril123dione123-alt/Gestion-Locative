import { SlidersHorizontal } from 'lucide-react';
import { PremiumButton } from './PremiumButton';

interface PremiumFilterButtonProps {
  activeCount?: number;
  open?: boolean;
  label?: string;
  onClick: () => void;
  className?: string;
}

export function PremiumFilterButton({
  activeCount = 0,
  open = false,
  label = 'Filtres',
  onClick,
  className = '',
}: PremiumFilterButtonProps) {
  return (
    <PremiumButton
      variant="secondary"
      onClick={onClick}
      className={`${open || activeCount > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : ''} ${className}`}
      icon={<SlidersHorizontal className="h-4 w-4" />}
    >
      {label}
      {activeCount > 0 && (
        <span className="rounded-full bg-emerald-800 px-1.5 py-0.5 text-[10px] font-black text-white">
          {activeCount}
        </span>
      )}
    </PremiumButton>
  );
}
