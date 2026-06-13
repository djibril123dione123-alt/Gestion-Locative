import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { premiumButtonClasses } from './premiumTokens';

type PremiumButtonVariant = keyof typeof premiumButtonClasses & ('create' | 'primary' | 'secondary' | 'danger' | 'ghost');
type PremiumButtonSize = 'sm' | 'md' | 'lg';

interface PremiumButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PremiumButtonVariant;
  size?: PremiumButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const sizeClasses: Record<PremiumButtonSize, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-xs',
  md: 'min-h-10 px-4 py-2 text-sm',
  lg: 'min-h-11 px-5 py-2.5 text-sm',
};

export const PremiumButton = forwardRef<HTMLButtonElement, PremiumButtonProps>(
  ({ variant = 'secondary', size = 'md', icon, fullWidth = false, className = '', children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={[
        premiumButtonClasses.base,
        premiumButtonClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {icon}
      {children}
    </button>
  ),
);

PremiumButton.displayName = 'PremiumButton';
