import type { ReactNode } from 'react';

export type SplitViewShellSize = "standard" | "wide";

export type SplitViewShellProps = {
  main: ReactNode;
  detail?: ReactNode;
  isDetailOpen?: boolean;
  size?: SplitViewShellSize;
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
  className = '',
  mainClassName = '',
  detailClassName = '',
  ariaLabel = "Vue principale et panneau de detail",
}: SplitViewShellProps) {
  // Déterminer si le détail doit être rendu :
  // S'il y a un isDetailOpen, on le respecte (et on s'assure d'avoir un detail).
  // Sinon, si detail est fourni, on le rend par défaut.
  const showDetail = isDetailOpen === undefined ? !!detail : isDetailOpen && !!detail;

  // L'approche @container permet au SplitViewShell de passer en mode 2 colonnes 
  // uniquement si l'espace conteneur réel le permet (ici @5xl, soit ~64rem),
  // sans dépendre brutalement du viewport global xl (ce qui casse quand on a une sidebar).
  // 
  // Largeur du détail fluide et bornée avec clamp() pour éviter d'écraser le main
  // sur les écrans moyens tout en gardant une proportion agréable sur les ultra-larges.
  const detailWidthClass = size === 'wide'
    ? '@5xl:w-[clamp(28rem,40cqw,36rem)]'
    : '@5xl:w-[clamp(24rem,35cqw,31.5rem)]';

  return (
    <section 
      className={`@container flex flex-col items-start gap-4 @5xl:flex-row @5xl:gap-5 w-full max-w-full ${className}`}
      aria-label={ariaLabel}
    >
      {/* Zone principale (gauche sur desktop, haut sur mobile) */}
      <div className={`flex-1 min-w-0 w-full ${mainClassName}`}>
        {main}
      </div>

      {/* Zone détail (droite sur desktop, bas/overlay géré par PremiumDrawerShell sur mobile) */}
      {showDetail && (
        <div className={`w-full flex-shrink-0 @5xl:flex-shrink-0 ${detailWidthClass} ${detailClassName}`}>
          {detail}
        </div>
      )}
    </section>
  );
}
