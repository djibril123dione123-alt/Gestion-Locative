import type { ReactNode } from 'react';
import { premiumTokens } from './premiumTokens';

export interface PremiumToolbarProps {
  search?: ReactNode;
  filters?: ReactNode;
  activeChips?: ReactNode;
  secondaryActions?: ReactNode;
  primaryAction?: ReactNode;
  children?: ReactNode;
  ariaLabel?: string;
  className?: string;

  // Props legacy préservées pour la rétrocompatibilité stricte
  actions?: ReactNode;
  meta?: ReactNode;
}

export function PremiumToolbar({
  search,
  filters,
  activeChips,
  secondaryActions,
  primaryAction,
  children,
  ariaLabel,
  className = '',
  actions,
  meta,
}: PremiumToolbarProps) {
  // Agrégation des actions pour faciliter le layout
  const hasActions = Boolean(actions || secondaryActions || primaryAction);

  return (
    <section
      aria-label={ariaLabel ?? "Outils de liste"}
      className={`@container relative z-20 overflow-visible ${premiumTokens.toolbar} ${className}`}
    >
      {/* Top Bar : Search (gauche) & Actions (droite) */}
      <div className="flex flex-col gap-3 @3xl:flex-row @3xl:items-center @3xl:justify-between">
        <div className="min-w-0 flex-1">
          {/* Rétrocompatibilité : mapping children vers search préservé */}
          {search ?? children}
        </div>

        {hasActions && (
          <div className="flex flex-wrap items-center gap-2">
            {secondaryActions ?? actions}
            {primaryAction && <div className="flex-shrink-0">{primaryAction}</div>}
          </div>
        )}
      </div>

      {/* Meta : Informations textuelles legacy */}
      {meta && <div className="mt-2.5 text-xs font-medium text-slate-500">{meta}</div>}

      {/* Active Chips : Pilules de filtres avec wrap propre sans scroll horizontal massif */}
      {activeChips && (
        <div className="mt-3 flex w-full min-w-0 flex-wrap items-center gap-2">
          {activeChips}
        </div>
      )}

      {/* Filtres : Zone des formulaires/dropdowns */}
      {filters && <div className="mt-3 min-w-0">{filters}</div>}
    </section>
  );
}
