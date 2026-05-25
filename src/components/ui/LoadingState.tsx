import { BrandMark } from '../brand/BrandLogo';

interface LoadingStateProps {
  label?: string;
  description?: string;
  tone?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
}

export function LoadingState({
  label = 'Chargement...',
  description,
  tone = 'light',
  compact = false,
  className = '',
}: LoadingStateProps) {
  const dark = tone === 'dark';

  return (
    <div
      className={`flex items-center justify-center ${compact ? 'p-6' : 'min-h-44 p-10'} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center">
          <div className={`absolute inset-0 rounded-lg blur-xl sk-logo-breathe ${dark ? 'bg-action-500/20' : 'bg-action-500/16'}`} />
          <BrandMark size="lg" tone={dark ? 'dark' : 'light'} animated />
        </div>
        <p className={`sk-type-caption ${dark ? 'text-brand-paper' : 'text-brand-950'}`}>
          {label}
        </p>
        {description && (
          <p className={`mt-2 text-sm ${dark ? 'text-brand-paper/60' : 'text-slate-500'}`}>
            {description}
          </p>
        )}
        {!compact && (
          <div className="mx-auto mt-5 w-52 max-w-full space-y-2">
            <div className={`sk-skeleton h-2 rounded-full ${dark ? 'sk-skeleton-dark' : ''}`} />
            <div className={`sk-skeleton mx-auto h-2 w-32 rounded-full ${dark ? 'sk-skeleton-dark' : ''}`} />
          </div>
        )}
      </div>
    </div>
  );
}
