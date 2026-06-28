import type { ReactNode } from 'react';
import { premiumTokens } from './premiumTokens';

export type PremiumTableSurfaceDensity = "comfortable" | "compact" | "dense";

export type PremiumTableSurfaceProps = {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  density?: PremiumTableSurfaceDensity;
  ariaLabel?: string;
  withHorizontalScroll?: boolean;
};

export function PremiumTableSurface({
  children,
  className = '',
  bodyClassName = '',
  density = 'comfortable',
  ariaLabel,
  withHorizontalScroll = false,
}: PremiumTableSurfaceProps) {
  // Préserve l'overflow-hidden à la racine UNIQUEMENT si on ne gère pas le scroll horizontal
  // pour éviter de couper les focus rings / dropdowns dans le cas d'un tableau large scrollable
  const overflowRoot = withHorizontalScroll ? '' : 'overflow-hidden';

  const densitySurface =
    density === 'dense'
      ? 'rounded-xl border border-emerald-950/15 bg-[#fffdf8]/98 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ring-1 ring-white/80'
      : density === 'compact'
        ? 'rounded-2xl border border-emerald-950/10 bg-[#fffdf7]/95 shadow-[0_16px_42px_rgba(15,23,42,0.05)] ring-1 ring-white/80'
        : premiumTokens.surface;

  const surfaceClass = `${densitySurface} @container relative min-w-0 w-full max-w-full ${overflowRoot} ${className}`.trim();

  return (
    <section
      className={surfaceClass}
      aria-label={ariaLabel}
      data-density={density}
    >
      {withHorizontalScroll ? (
        <div className={`w-full overflow-x-auto scrollbar-thin ${bodyClassName}`.trim()}>
          <div className="min-w-fit">
            {children}
          </div>
        </div>
      ) : (
        bodyClassName ? (
          <div className={bodyClassName}>
            {children}
          </div>
        ) : (
          children
        )
      )}
    </section>
  );
}
