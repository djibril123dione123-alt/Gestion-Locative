import type { ReactNode } from 'react';
import { premiumTokens } from './premiumTokens';

export type PremiumTableSurfaceDensity = "comfortable" | "compact";

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

  const surfaceClass = `${premiumTokens.surface} @container relative min-w-0 w-full max-w-full ${overflowRoot} ${className}`.trim();

  return (
    <section
      className={surfaceClass}
      aria-label={ariaLabel}
      data-density={density}
    >
      {withHorizontalScroll ? (
        <div className={`w-full overflow-x-auto ${bodyClassName}`.trim()}>
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
