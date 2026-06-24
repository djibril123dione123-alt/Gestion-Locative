import type { ReactNode } from 'react';

export type SplitViewShellSize = "standard" | "wide" | "compact";

export type SplitViewShellProps = {
  main: ReactNode;
  detail?: ReactNode;
  isDetailOpen?: boolean;
  size?: SplitViewShellSize;
  desktopAt?: "lg" | "xl";
  className?: string;
  mainClassName?: string;
  detailClassName?: string;
  ariaLabel?: string;
};

export function SplitViewShell({
  main,
  detail,
  isDetailOpen,
  size = "standard",
  desktopAt = "xl",
  className = '',
  mainClassName = '',
  detailClassName = '',
  ariaLabel = "Vue principale et panneau de detail",
}: SplitViewShellProps) {
  // Déterminer si le détail doit être rendu :
  // S'il y a un isDetailOpen, on le respecte (et on s'assure d'avoir un detail).
  // Sinon, si detail est fourni, on le rend par défaut.
  const showDetail = isDetailOpen === undefined ? !!detail : isDetailOpen && !!detail;

  // Alignement strict avec les breakpoints viewport (lg, xl) utilisés par PremiumDrawerShell
  // pour éviter toute "zone morte" où le shell passerait en desktop mais le conteneur resterait en mobile.
  const layoutClasses = desktopAt === 'lg'
    ? 'lg:flex-row lg:gap-4'
    : 'xl:flex-row xl:gap-4';

  let detailWidthClassLg = 'lg:w-[clamp(24rem,35vw,31.5rem)]';
  if (size === 'wide') detailWidthClassLg = 'lg:w-[clamp(28rem,40vw,36rem)]';
  if (size === 'compact') detailWidthClassLg = 'lg:w-[clamp(23rem,28vw,26rem)]';

  let detailWidthClassXl = 'xl:w-[clamp(24rem,35vw,31.5rem)]';
  if (size === 'wide') detailWidthClassXl = 'xl:w-[clamp(28rem,40vw,36rem)]';
  if (size === 'compact') detailWidthClassXl = 'xl:w-[clamp(23rem,28vw,26rem)]';

  const detailWidthClass = desktopAt === 'lg' ? detailWidthClassLg : detailWidthClassXl;
  const detailFlex = desktopAt === 'lg' ? 'lg:flex-shrink-0' : 'xl:flex-shrink-0';

  return (
    <section 
      className={`flex flex-col items-start gap-4 ${layoutClasses} w-full max-w-full ${className}`}
      aria-label={ariaLabel}
    >
      {/* Zone principale (gauche sur desktop, haut sur mobile) */}
      <div className={`flex-1 min-w-0 w-full ${mainClassName}`}>
        {main}
      </div>

      {/* Zone détail (droite sur desktop, bas/overlay géré par PremiumDrawerShell sur mobile) */}
      {showDetail && (
        <div className={`w-full flex-shrink-0 ${detailFlex} ${detailWidthClass} ${detailClassName}`}>
          {detail}
        </div>
      )}
    </section>
  );
}
