import type { ReactNode } from 'react';


export interface QuickChip {
  id: string;
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}

export interface PremiumToolbarProps {
  search?: ReactNode;
  filters?: ReactNode;
  activeChips?: ReactNode;
  quickChips?: QuickChip[];
  secondaryActions?: ReactNode;
  primaryAction?: ReactNode;
  children?: ReactNode;
  ariaLabel?: string;
  className?: string;
  density?: 'comfortable' | 'compact';

  // Props legacy préservées pour la rétrocompatibilité stricte
  actions?: ReactNode;
  meta?: ReactNode;
}

export function PremiumToolbar({
  search,
  filters,
  activeChips,
  quickChips,
  secondaryActions,
  primaryAction,
  children,
  ariaLabel,
  className = '',
  density = 'comfortable',
  actions,
  meta,
}: PremiumToolbarProps) {
  // Agrégation des actions pour faciliter le layout
  const hasActions = Boolean(actions || secondaryActions || primaryAction);

  return (
    <section
      aria-label={ariaLabel ?? "Outils de liste"}
      className={`@container relative z-20 min-w-0 max-w-full ${density === 'compact' ? 'bg-[#fffdf8]/90 border border-emerald-950/10 shadow-sm ring-1 ring-white/50 rounded-[0.85rem] px-2 py-1.5 sm:px-2.5 sm:py-2' : 'sk-premium-panel p-3'} ${className}`}
    >
      {/* Top Bar : Search (gauche) & Actions (droite) */}
      <div className={`flex ${density === 'compact' ? 'gap-2 items-center' : 'flex-col gap-3 @3xl:flex-row @3xl:items-center @3xl:justify-between'}`}>
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

      {/* Active Chips : Pilules de filtres legacy avec wrap propre */}
      {activeChips && (
        <div className="mt-3 flex w-full min-w-0 flex-wrap items-center gap-2">
          {activeChips}
        </div>
      )}

      {/* Quick Chips : Pilules métier rapides (charte Samay Keur) */}
      {quickChips && quickChips.length > 0 && (
        <div className="scrollbar-hide -mx-1 mt-2.5 flex max-w-[calc(100%+0.5rem)] gap-1.5 overflow-x-auto px-1 pb-1">
          {quickChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onClick}
              className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border transition ${
                density === 'compact' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
              } font-bold ${
                chip.isActive
                  ? 'border-emerald-950 bg-emerald-950 text-white shadow-sm'
                  : 'border-emerald-950/10 bg-white text-slate-600 hover:border-emerald-800/25 hover:bg-emerald-50'
              }`}
            >
              {chip.label}
              {typeof chip.count === 'number' && (
                <span className={`${density === 'compact' ? 'text-[9px]' : 'text-[10px]'} opacity-60`}>
                  {chip.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Filtres : Zone des formulaires/dropdowns */}
      {filters && <div className="mt-3 min-w-0">{filters}</div>}
    </section>
  );
}
