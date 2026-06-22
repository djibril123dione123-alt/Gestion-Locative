import React from 'react';

export type PremiumKpiGridVariant = "standard" | "dashboard";

export interface PremiumKpiGridProps {
  children: React.ReactNode;
  variant?: PremiumKpiGridVariant;
  maxItems?: number;
  isLoading?: boolean;
  skeletonCount?: number;
  ariaLabel?: string;
  className?: string;
}

export function PremiumKpiGrid({
  children,
  variant = "standard",
  maxItems,
  isLoading = false,
  skeletonCount,
  ariaLabel,
  className = ""
}: PremiumKpiGridProps) {
  // Détermination du nombre maximum d'éléments
  const defaultMaxItems = variant === "dashboard" ? 6 : 4;
  const resolvedMaxItems = maxItems ?? defaultMaxItems;
  
  const childrenArray = React.Children.toArray(children);
  
  // Avertissement en mode développement si trop de KPIs sont fournis
  if (!isLoading && childrenArray.length > resolvedMaxItems) {
    // On utilise typeof process pour éviter les crashs si import.meta.env.DEV n'est pas dispo dans un runner de test type Jest/Vitest
    const isDev = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) || 
                  (typeof process !== 'undefined' && process.env.NODE_ENV === 'development');
    if (isDev) {
      console.warn(`[PremiumKpiGrid] Avertissement: ${childrenArray.length} KPIs fournis, mais le maximum autorisé est ${resolvedMaxItems}. Les surnuméraires sont ignorés pour protéger l'UI.`);
    }
  }

  // Éléments finaux à rendre (Skeletons ou KPIs réels tronqués)
  const skeletons = Array.from({ length: skeletonCount ?? resolvedMaxItems });
  const realItems = childrenArray.slice(0, resolvedMaxItems);

  // MIGRATION CONTAINER-AWARE (UI-00R1A)
  // Remplacement des classes viewport classiques (lg:, xl:, 2xl:) par des container queries (@2xl:, @4xl:, @6xl:)
  // Cela garantit que la grille s'adapte à la largeur RÉELLE de son parent (par ex, si un drawer est ouvert)
  // et non à la largeur totale de l'écran.
  const gridClasses = variant === "dashboard" 
    ? "grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4 @6xl:grid-cols-6"
    : "grid-cols-2 @4xl:grid-cols-4";

  return (
    <section 
      className={`@container w-full max-w-full min-w-0 ${className}`}
      aria-label={ariaLabel ?? "Indicateurs clés"}
      {...(isLoading ? { 'aria-busy': true } : {})}
    >
      <div className={`grid gap-3 ${gridClasses}`}>
        {isLoading ? (
          skeletons.map((_, i) => (
            <div 
              key={`kpi-skeleton-${i}`} 
              aria-hidden="true" 
              className="min-h-[88px] w-full animate-pulse rounded-[1.05rem] border border-emerald-950/5 bg-slate-50/50 ring-1 ring-emerald-950/5"
            />
          ))
        ) : (
          realItems
        )}
      </div>
    </section>
  );
}
