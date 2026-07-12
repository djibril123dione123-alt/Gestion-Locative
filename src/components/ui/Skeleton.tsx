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

export function SkeletonTable({ rows = 6, cols = 5, tone = 'light' }: SkeletonTableProps) {
  const dark = tone === 'dark';
  return (
    <div
      className={`rounded-2xl border overflow-hidden shadow-xs ${
        dark ? 'border-white/10 bg-white/[0.035]' : 'border-emerald-950/10 bg-white/95'
      }`}
    >
      {/* Table Header */}
      <div
        className={`flex items-center gap-3 border-b px-4 py-2.5 ${
          dark ? 'border-white/10 bg-white/[0.04]' : 'border-emerald-950/10 bg-emerald-950/[0.03]'
        }`}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} tone={tone} className="h-3 flex-1 max-w-[120px]" />
        ))}
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-emerald-950/5">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className={`flex items-center gap-3 px-4 py-3 ${
              dark ? 'hover:bg-white/[0.02]' : 'hover:bg-emerald-950/[0.015]'
            }`}
          >
            <Skeleton tone={tone} className="h-6 w-6 shrink-0" rounded="full" />
            <div className="flex-1 space-y-1 min-w-0">
              <Skeleton tone={tone} className="h-3.5 w-32 max-w-[85%]" />
              <Skeleton tone={tone} className="h-2.5 w-20 max-w-[60%]" />
            </div>
            {Array.from({ length: Math.max(0, cols - 2) }).map((_, c) => (
              <Skeleton key={c} tone={tone} className="h-3.5 flex-1 max-w-[110px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface SkeletonCardsProps {
  count?: number;
  tone?: 'light' | 'dark';
}

/**
 * SkeletonCards : Rend toujours exactement 1 ligne horizontale de KPI compactes (comme PremiumKpiGrid).
 * Même si count=6 est demandé, l'affichage est capé à 4 sur 1 seule ligne exécutive.
 */
export function SkeletonCards({ count = 4, tone = 'light' }: SkeletonCardsProps) {
  const dark = tone === 'dark';
  const displayCount = Math.min(count, 4);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
      {Array.from({ length: displayCount }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center justify-between rounded-xl border px-3 py-2.5 shadow-2xs backdrop-blur transition ${
            dark ? 'border-white/10 bg-white/[0.04]' : 'border-emerald-950/10 bg-white/90'
          }`}
        >
          <div className="space-y-1.5 min-w-0 flex-1 pr-2">
            <Skeleton tone={tone} className="h-2 w-16" />
            <Skeleton tone={tone} className="h-4.5 w-24 max-w-[85%]" />
          </div>
          <Skeleton tone={tone} className="h-6 w-6 shrink-0" rounded="lg" />
        </div>
      ))}
    </div>
  );
}

interface SkeletonToolbarProps {
  tone?: 'light' | 'dark';
}

export function SkeletonToolbar({ tone = 'light' }: SkeletonToolbarProps) {
  const dark = tone === 'dark';
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 shadow-2xs ${
        dark ? 'border-white/10 bg-white/[0.04]' : 'border-emerald-950/10 bg-white/90'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Skeleton tone={tone} className="h-8 w-48 sm:w-60" rounded="lg" />
        <div className="hidden md:flex items-center gap-1.5">
          <Skeleton tone={tone} className="h-6 w-14" rounded="full" />
          <Skeleton tone={tone} className="h-6 w-16" rounded="full" />
          <Skeleton tone={tone} className="h-6 w-18" rounded="full" />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Skeleton tone={tone} className="h-8 w-24" rounded="lg" />
      </div>
    </div>
  );
}

interface PageSkeletonProps {
  title?: string;
  variant?: 'dashboard' | 'table' | 'form' | 'analytics';
  tone?: 'light' | 'dark';
  className?: string;
}

/**
 * DashboardSkeleton : Structure fidèle à la page Tableau de bord (Header + 6 KPI Executive Cards + Graphique performance + Grille priorités/impayés)
 */
export function DashboardSkeleton({
  title = 'Tableau de bord',
  tone = 'light',
  className = '',
}: {
  title?: string;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const dark = tone === 'dark';

  return (
    <div
      className={`sk-page-transition w-full flex-1 min-w-0 space-y-5 pt-1 sm:pt-2 ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* 1. Header du Dashboard */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton tone={tone} className="h-2.5 w-28" />
          <div className="flex items-center gap-2">
            <Skeleton tone={tone} className="h-6 w-48" />
            <span className="sr-only">{title}</span>
          </div>
          <Skeleton tone={tone} className="h-3 w-72 max-w-full" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton tone={tone} className="h-9 w-32 shrink-0" rounded="lg" />
          <Skeleton tone={tone} className="h-9 w-44 shrink-0" rounded="lg" />
        </div>
      </div>

      {/* 2. Banner Alerte compact */}
      <div
        className={`h-11 w-full rounded-xl border flex items-center px-4 gap-3 ${
          dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200/80 bg-white/70'
        }`}
      >
        <Skeleton tone={tone} className="h-4 w-4 shrink-0" rounded="full" />
        <Skeleton tone={tone} className="h-3 w-64 max-w-full" />
        <div className="ml-auto">
          <Skeleton tone={tone} className="h-6 w-24" rounded="md" />
        </div>
      </div>

      {/* 3. 6 Executive KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`rounded-2xl border p-4 shadow-2xs flex flex-col justify-between h-28 ${
              dark ? 'border-white/10 bg-white/[0.035]' : 'border-slate-200/80 bg-white/90'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <Skeleton tone={tone} className="h-2.5 w-20" />
              <Skeleton tone={tone} className="h-5 w-5" rounded="md" />
            </div>
            <Skeleton tone={tone} className="h-5 w-28 my-1" />
            <Skeleton tone={tone} className="h-2 w-16" />
          </div>
        ))}
      </div>

      {/* 4. Section Chart "Performance agence" */}
      <div
        className={`rounded-2xl border p-5 shadow-2xs space-y-5 ${
          dark ? 'border-white/10 bg-white/[0.035]' : 'border-slate-200/80 bg-white/95'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <Skeleton tone={tone} className="h-4 w-52" />
            <Skeleton tone={tone} className="h-2.5 w-72 max-w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} tone={tone} className="h-10 w-28" rounded="lg" />
            ))}
          </div>
        </div>
        {/* Bar chart simulation */}
        <div className="flex items-end justify-between gap-2.5 pt-6 pb-2 h-52 px-2 border-b border-slate-100">
          {[45, 60, 38, 72, 85, 55, 90, 40, 65, 78, 50, 82].map((height, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div
                className={`w-full max-w-[28px] rounded-t-md animate-pulse ${
                  dark ? 'bg-white/10' : 'bg-slate-200/80'
                }`}
                style={{ height: `${height}%` }}
              />
              <Skeleton tone={tone} className="h-2.5 w-6" />
            </div>
          ))}
        </div>
      </div>

      {/* 5. Grille du bas (Priorités + Top Impayés) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div
          className={`lg:col-span-2 rounded-2xl border p-5 shadow-2xs space-y-4 ${
            dark ? 'border-white/10 bg-white/[0.035]' : 'border-slate-200/80 bg-white/95'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton tone={tone} className="h-4 w-36" />
              <Skeleton tone={tone} className="h-2.5 w-52" />
            </div>
            <Skeleton tone={tone} className="h-7 w-20" rounded="md" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-xl border p-3.5 flex items-center gap-3 ${
                  dark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-100 bg-slate-50/60'
                }`}
              >
                <Skeleton tone={tone} className="h-9 w-9 shrink-0" rounded="lg" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Skeleton tone={tone} className="h-3 w-28" />
                  <Skeleton tone={tone} className="h-2.5 w-40 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className={`lg:col-span-1 rounded-2xl border p-5 shadow-2xs space-y-4 flex flex-col justify-between ${
            dark ? 'border-white/10 bg-white/[0.035]' : 'border-slate-200/80 bg-white/95'
          }`}
        >
          <div className="space-y-1">
            <Skeleton tone={tone} className="h-4 w-40" />
            <Skeleton tone={tone} className="h-2.5 w-48" />
          </div>
          <div className="space-y-3 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton tone={tone} className="h-6 w-6" rounded="full" />
                  <div className="space-y-1">
                    <Skeleton tone={tone} className="h-3 w-28" />
                    <Skeleton tone={tone} className="h-2 w-20" />
                  </div>
                </div>
                <Skeleton tone={tone} className="h-3.5 w-20" />
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <Skeleton tone={tone} className="h-3 w-24" />
            <Skeleton tone={tone} className="h-3 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * PageSkeleton : Structure complète et fidèle des pages exécutives de Samay Këur (Header + KPI 1 ligne + Toolbar + Table)
 */
export function PageSkeleton({
  title = 'Chargement',
  variant = 'table',
  tone = 'light',
  className = '',
}: PageSkeletonProps) {
  if (variant === 'dashboard') {
    return <DashboardSkeleton title={title} tone={tone} className={className} />;
  }

  const dark = tone === 'dark';

  return (
    <div
      className={`sk-page-transition w-full flex-1 min-w-0 space-y-3.5 sm:space-y-4 pt-1 sm:pt-2 ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* 1. Page Header Compact */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton tone={tone} className="h-2.5 w-24" />
          <div className="flex items-center gap-2">
            <Skeleton tone={tone} className="h-6 w-44" />
            <span className="sr-only">{title}</span>
          </div>
          <Skeleton tone={tone} className="h-3 w-64 max-w-full" />
        </div>
        <Skeleton tone={tone} className="h-8 w-36 shrink-0" rounded="lg" />
      </div>

      {/* 2. KPI Grid sur 1 seule ligne compacte (4 cartes) */}
      {(variant === 'table' || variant === 'analytics') && (
        <SkeletonCards tone={tone} count={4} />
      )}

      {/* 3. Toolbar Executive */}
      {(variant === 'table' || variant === 'analytics') && (
        <SkeletonToolbar tone={tone} />
      )}

      {/* 4. Contenu / Tableau */}
      {variant === 'form' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-xl border p-4 ${
                dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white/80'
              }`}
            >
              <Skeleton tone={tone} className="mb-3 h-3 w-24" />
              <Skeleton tone={tone} className="h-10 w-full" rounded="lg" />
            </div>
          ))}
        </div>
      ) : (
        <SkeletonTable tone={tone} rows={7} cols={variant === 'analytics' ? 5 : 6} />
      )}
    </div>
  );
}
