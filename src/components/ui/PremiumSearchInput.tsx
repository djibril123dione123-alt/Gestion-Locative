import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { premiumTokens } from './premiumTokens';

interface PremiumSearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

export function PremiumSearchInput({ value, onChange, className = '', placeholder = 'Rechercher...', ...props }: PremiumSearchInputProps) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-800/70" />
      <input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${premiumTokens.field} pl-9 pr-3`}
      />
    </div>
  );
}
