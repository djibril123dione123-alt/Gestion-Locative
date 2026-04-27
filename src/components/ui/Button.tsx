import { ButtonHTMLAttributes, forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 sm:px-5 sm:py-2.5 text-sm sm:text-base gap-2',
  lg: 'px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base gap-2',
};

const ICON_SIZE: Record<Size, string> = {
  sm: 'w-4 h-4',
  md: 'w-4 h-4 sm:w-5 sm:h-5',
  lg: 'w-5 h-5',
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] ' +
    'bg-gradient-to-br from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 ' +
    'focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2',
  secondary:
    'border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 ' +
    'shadow-sm hover:shadow ' +
    'focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2',
  ghost:
    'text-slate-600 hover:text-slate-900 hover:bg-slate-100 ' +
    'focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2',
  danger:
    'text-white bg-red-600 hover:bg-red-700 shadow-md hover:shadow-lg ' +
    'focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2',
  success:
    'text-white bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg ' +
    'focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2',
};

const BASE_CLASSES =
  'inline-flex items-center justify-center font-semibold rounded-lg ' +
  'transition-all duration-200 outline-none ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconPosition = 'left',
    loading = false,
    fullWidth = false,
    disabled,
    className = '',
    children,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  const widthClass = fullWidth ? 'w-full' : '';
  const composedClassName = [
    BASE_CLASSES,
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    widthClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} disabled={isDisabled} className={composedClassName} {...rest}>
      {loading && (
        <span
          aria-hidden="true"
          className={`${ICON_SIZE[size]} inline-block rounded-full border-2 border-current border-t-transparent animate-spin`}
        />
      )}
      {!loading && Icon && iconPosition === 'left' && <Icon className={ICON_SIZE[size]} />}
      {children && <span className="whitespace-nowrap">{children}</span>}
      {!loading && Icon && iconPosition === 'right' && <Icon className={ICON_SIZE[size]} />}
    </button>
  );
});
