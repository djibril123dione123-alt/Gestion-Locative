import type { ReactNode } from 'react';


export interface QuickChip {
  id: string;
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}

export interface PremiumToolbarProps {
  tabs?: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
  activeChips?: ReactNode;
  quickChips?: QuickChip[];
  secondaryActions?: ReactNode;
  primaryAction?: ReactNode;
  children?: ReactNode;
  ariaLabel?: string;
  className?: string;
  density?: 'comfortable' | 'compact' | 'ultraCompact';
  layout?: 'default' | 'list';
  isSplitOpen?: boolean;

  // Props legacy préservées pour la rétrocompatibilité stricte
  actions?: ReactNode;
  meta?: ReactNode;
}

export function PremiumToolbar({
  tabs,
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
  layout = 'default',
  isSplitOpen = false,
  actions,
  meta,
}: PremiumToolbarProps) {
  // Agrégation des actions pour faciliter le layout
  const hasActions = Boolean(actions || secondaryActions || primaryAction);
  const isUltraCompact = density === 'ultraCompact';
  const isCompact = density === 'compact' || isUltraCompact;

  if (layout === 'list') {
    return (
      <section
        aria-label={ariaLabel ?? "Outils de liste"}
        data-split-open={isSplitOpen}
        className={`@container relative z-20 min-w-0 max-w-full ${isCompact ? `bg-[#fffdf8]/90 border border-emerald-950/10 shadow-sm ring-1 ring-white/50 ${isUltraCompact ? 'rounded-[0.7rem] px-1.5 py-1 sm:px-2 sm:py-1.5' : 'rounded-[0.85rem] px-2 py-1.5 sm:px-2.5 sm:py-2'}` : 'sk-premium-panel p-3'} ${className}`}
      >
        <div className={`flex min-w-0 items-center justify-between ${isUltraCompact ? 'gap-1.5' : 'gap-2'} flex-wrap lg:flex-nowrap`}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {tabs && <div className="shrink-0 flex-none">{tabs}</div>}
            {(search ?? children) && <div className="flex-1 shrink min-w-[120px]">{search ?? children}</div>}
          </div>

          {(filters || secondaryActions || actions || primaryAction) && (
            <div className={`flex shrink-0 items-center ${isUltraCompact ? 'gap-1.5' : 'gap-2'} flex-wrap sm:flex-nowrap`}>
              {filters}
              {secondaryActions ?? actions}
              {primaryAction && <div className="shrink-0">{primaryAction}</div>}
            </div>
          )}
        </div>

        {meta && <div className="mt-2 text-xs font-medium text-slate-500">{meta}</div>}

        {activeChips && (
          <div className="mt-2 flex w-full min-w-0 flex-wrap items-center gap-1.5">
            {activeChips}
          </div>
        )}

        {quickChips && quickChips.length > 0 && (
          <div className="scrollbar-hide -mx-1 mt-2 flex max-w-[calc(100%+0.5rem)] gap-1.5 overflow-x-auto px-1 pb-1">
            {quickChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.onClick}
                className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border transition ${
                  isCompact ? `${isUltraCompact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}` : 'px-3 py-1.5 text-xs'
                } font-bold ${
                  chip.isActive
                    ? 'border-emerald-950 bg-emerald-950 text-white shadow-sm'
                    : 'border-emerald-950/10 bg-white text-slate-600 hover:border-emerald-800/25 hover:bg-emerald-50'
                }`}
              >
                {chip.label}
                {typeof chip.count === 'number' && (
                  <span className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} opacity-60`}>
                    {chip.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label={ariaLabel ?? "Outils de liste"}
      data-split-open={isSplitOpen}
      className={`@container relative z-20 min-w-0 max-w-full ${isCompact ? `bg-[#fffdf8]/90 border border-emerald-950/10 shadow-sm ring-1 ring-white/50 ${isUltraCompact ? 'rounded-[0.7rem] px-1.5 py-1 sm:px-2 sm:py-1.5' : 'rounded-[0.85rem] px-2 py-1.5 sm:px-2.5 sm:py-2'}` : 'sk-premium-panel p-3'} ${className}`}
    >
      {/* 1ère ligne : Recherche (gauche) + Filtres & Actions (droite sur la même ligne) */}
      <div className={`flex items-center justify-between flex-wrap xl:flex-nowrap ${isUltraCompact ? 'gap-1.5' : 'gap-2'}`}>
        <div className="min-w-[160px] flex-1">
          {search ?? children}
        </div>

        {(filters || hasActions) && (
          <div className={`flex flex-wrap sm:flex-nowrap items-center shrink-0 ${isUltraCompact ? 'gap-1.5' : 'gap-2'}`}>
            {filters}
            {secondaryActions ?? actions}
            {primaryAction && <div className="flex-shrink-0">{primaryAction}</div>}
          </div>
        )}
      </div>

      {/* Meta */}
      {meta && <div className="mt-2 text-xs font-medium text-slate-500">{meta}</div>}

      {/* Active Chips */}
      {activeChips && (
        <div className="mt-2 flex w-full min-w-0 flex-wrap items-center gap-2">
          {activeChips}
        </div>
      )}

      {/* 2ème ligne unique (optionnelle) : Quick Chips */}
      {quickChips && quickChips.length > 0 && (
        <div className="scrollbar-hide -mx-1 mt-2 flex max-w-[calc(100%+0.5rem)] gap-1.5 overflow-x-auto px-1 pb-1">
          {quickChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onClick}
              className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border transition ${
                isCompact ? `${isUltraCompact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}` : 'px-3 py-1.5 text-xs'
              } font-bold ${
                chip.isActive
                  ? 'border-emerald-950 bg-emerald-950 text-white shadow-sm'
                  : 'border-emerald-950/10 bg-white text-slate-600 hover:border-emerald-800/25 hover:bg-emerald-50'
              }`}
            >
              {chip.label}
              {typeof chip.count === 'number' && (
                <span className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} opacity-60`}>
                  {chip.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
