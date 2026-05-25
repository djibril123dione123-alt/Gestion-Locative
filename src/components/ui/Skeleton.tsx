interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  tone?: 'light' | 'dark';
}

const ROUND: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  sm: 'rounded',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  full: 'rounded-full',
};

export function Skeleton({ className = '', rounded = 'md', tone = 'light' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`sk-skeleton ${tone === 'dark' ? 'sk-skeleton-dark' : ''} ${ROUND[rounded]} ${className}`}
    />
  );
}

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  tone?: 'light' | 'dark';
}

export function SkeletonTable({ rows = 5, cols = 4, tone = 'light' }: SkeletonTableProps) {
  return (
    <div className={`space-y-3 ${tone === 'dark' ? 'text-white' : ''}`}>
      <div className={`flex gap-4 border-b pb-3 ${tone === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} tone={tone} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={`flex gap-4 rounded-lg px-1 py-2 ${tone === 'dark' ? 'bg-white/[0.02]' : 'bg-white/50'}`}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} tone={tone} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface SkeletonCardsProps {
  count?: number;
  tone?: 'light' | 'dark';
}

export function SkeletonCards({ count = 4, tone = 'light' }: SkeletonCardsProps) {
  const dark = tone === 'dark';
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`space-y-3 rounded-xl border p-5 shadow-sm backdrop-blur ${
            dark ? 'border-white/10 bg-white/[0.045]' : 'border-emerald-950/10 bg-white/90'
          }`}
        >
          <div className="flex items-center justify-between">
            <Skeleton tone={tone} className="h-4 w-24" />
            <Skeleton tone={tone} className="h-10 w-10" rounded="full" />
          </div>
          <Skeleton tone={tone} className="h-8 w-32" />
          <Skeleton tone={tone} className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

interface PageSkeletonProps {
  title?: string;
  variant?: 'dashboard' | 'table' | 'form' | 'analytics';
  tone?: 'light' | 'dark';
  className?: string;
}

export function PageSkeleton({
  title = 'Chargement',
  variant = 'table',
  tone = 'light',
  className = '',
}: PageSkeletonProps) {
  const dark = tone === 'dark';

  return (
    <div
      className={`sk-page-transition min-h-full p-4 sm:p-6 lg:p-8 ${dark ? 'bg-brand-950 text-white' : 'bg-brand-paper/70'} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 ${
        dark
          ? 'border-white/10 bg-white/[0.045] shadow-premium-lg'
          : 'border-emerald-950/10 bg-white/78 shadow-premium'
      }`}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-action-500/10 blur-3xl" />
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <Skeleton tone={tone} className="h-4 w-28" />
            <Skeleton tone={tone} className="h-8 w-56 max-w-full" />
            <p className={`sk-type-caption ${dark ? 'text-emerald-100/60' : 'text-slate-500'}`}>
              {title}
            </p>
          </div>
          <Skeleton tone={tone} className="h-11 w-44" rounded="lg" />
        </div>

        {(variant === 'dashboard' || variant === 'analytics') && <SkeletonCards tone={tone} count={4} />}

        {variant === 'form' && (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`rounded-xl border p-4 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white/80'}`}>
                <Skeleton tone={tone} className="mb-3 h-3 w-24" />
                <Skeleton tone={tone} className="h-11 w-full" rounded="lg" />
              </div>
            ))}
          </div>
        )}

        <div className={`${variant === 'dashboard' || variant === 'analytics' ? 'mt-6' : ''} rounded-xl border p-4 ${
          dark ? 'border-white/10 bg-white/[0.035]' : 'border-slate-200 bg-white/[0.82]'
        }`}>
          <SkeletonTable tone={tone} rows={variant === 'dashboard' ? 4 : 7} cols={variant === 'analytics' ? 5 : 6} />
        </div>
      </div>
    </div>
  );
}
