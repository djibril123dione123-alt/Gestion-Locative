import { ButtonHTMLAttributes, forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'financial';
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
  sm: 'px-3 py-1.5 text-sm gap-1.5 min-h-9',
  md: 'px-4 py-2 sm:px-5 sm:py-2.5 text-sm sm:text-base gap-2 min-h-10',
  lg: 'px-4 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base gap-2 min-h-12',
};

const ICON_SIZE: Record<Size, string> = {
  sm: 'w-4 h-4',
  md: 'w-4 h-4 sm:w-5 sm:h-5',
  lg: 'w-5 h-5',
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'text-white shadow-[0_18px_42px_rgba(249,115,22,0.24)] hover:shadow-[0_24px_62px_rgba(249,115,22,0.32)] transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] ' +
    'border border-action-500/80 bg-gradient-to-br from-action-500 via-action-500 to-action-600 hover:from-action-500 hover:to-action-700 ' +
    'focus-visible:ring-2 focus-visible:ring-action-500 focus-visible:ring-offset-2',
  secondary:
    'border border-slate-200 text-slate-800 bg-white hover:bg-emerald-50/70 hover:border-emerald-200 ' +
    'shadow-sm hover:shadow-md ' +
    'focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2',
  ghost:
    'text-slate-600 hover:text-brand-900 hover:bg-emerald-50 ' +
    'focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2',
  danger:
    'text-white bg-red-600 hover:bg-red-700 shadow-md hover:shadow-lg ' +
    'focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2',
  financial:
    'text-action-700 border border-action-200 bg-action-50 hover:bg-action-100 hover:border-action-300 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 active:translate-y-0 ' +
    'focus-visible:ring-2 focus-visible:ring-action-500 focus-visible:ring-offset-2',
  success:
    'text-white bg-brand-700 hover:bg-brand-800 shadow-md hover:shadow-lg ' +
    'focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2',
};

const BASE_CLASSES =
  'inline-flex items-center justify-center font-black rounded-lg ' +
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
    <button ref={ref} disabled={isDisabled} aria-busy={loading || undefined} className={composedClassName} {...rest}>
      {loading && (
        <span
          aria-hidden="true"
          className={`${ICON_SIZE[size]} inline-flex items-center justify-center rounded-full bg-current/10`}
        >
          <img src="/brand/mark-transparent.png" alt="" className="h-full w-full object-contain sk-button-brand-loader" />
        </span>
      )}
      {!loading && Icon && iconPosition === 'left' && <Icon className={ICON_SIZE[size]} />}
      {children && <span className="whitespace-nowrap">{children}</span>}
      {!loading && Icon && iconPosition === 'right' && <Icon className={ICON_SIZE[size]} />}
    </button>
  );
});
