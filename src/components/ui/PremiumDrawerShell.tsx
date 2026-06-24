import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export type PremiumDrawerShellSize = "standard" | "wide" | "compact";
export type PremiumDrawerShellDesktopMode = "edge" | "floating";
export type PremiumDrawerShellDesktopAt = "lg" | "xl";
export type PremiumDrawerShellDensity = "comfortable" | "compact";

export interface PremiumDrawerShellProps {
  open?: boolean;
  title?: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  avatar?: ReactNode;
  header?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  size?: PremiumDrawerShellSize;
  desktopMode?: PremiumDrawerShellDesktopMode;
  desktopAt?: PremiumDrawerShellDesktopAt;
  density?: PremiumDrawerShellDensity;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

export function PremiumDrawerShell({
  open,
  title,
  eyebrow,
  description,
  avatar,
  header,
  actions,
  footer,
  children,
  onClose,
  closeLabel = "Fermer le panneau",
  size = "standard",
  desktopMode = "edge",
  desktopAt = "xl",
  density = "comfortable",
  ariaLabel,
  ariaDescribedBy,
  className = '',
  bodyClassName = '',
  footerClassName = ''
}: PremiumDrawerShellProps) {
  // Respect du mode contrôlé : si explicitement fermé, ne rien rendre
  if (open === false) return null;

  const isControlled = typeof open !== 'undefined';
  const isLg = desktopAt === 'lg';
  const isFloating = desktopMode === 'floating';
  const isCompact = density === 'compact';

  let baseClasses = "flex flex-col overflow-hidden bg-[#fffdf8] shadow-[0_24px_70px_rgba(15,23,42,0.16)]";
  if (isLg) {
     if (isFloating) {
        baseClasses += " lg:rounded-3xl lg:border lg:border-emerald-950/10 lg:shadow-lg";
     } else {
        baseClasses += " lg:border-l lg:border-emerald-950/10 lg:shadow-[-18px_0_50px_rgba(15,23,42,0.08)] lg:rounded-l-3xl";
     }
  } else {
     if (isFloating) {
        baseClasses += " xl:rounded-3xl xl:border xl:border-emerald-950/10 xl:shadow-lg";
     } else {
        baseClasses += " xl:border-l xl:border-emerald-950/10 xl:shadow-[-18px_0_50px_rgba(15,23,42,0.08)] xl:rounded-l-3xl";
     }
  }

  let widthClassLg = "lg:w-[31.5rem]";
  if (size === 'wide') widthClassLg = "lg:w-[36rem]";
  if (size === 'compact') widthClassLg = "lg:w-[clamp(23rem,28vw,26rem)]";

  let widthClassXl = "xl:w-[31.5rem]";
  if (size === 'wide') widthClassXl = "xl:w-[36rem]";
  if (size === 'compact') widthClassXl = "xl:w-[clamp(23rem,28vw,26rem)]";

  const mobileClassesLg = isControlled ? "fixed inset-0 z-50 lg:static lg:inset-auto lg:z-auto" : "h-full min-h-0";
  const mobileClassesXl = isControlled ? "fixed inset-0 z-50 xl:static xl:inset-auto xl:z-auto" : "h-full min-h-0";

  const desktopClassesLg = `lg:h-full lg:min-h-0 lg:flex-shrink-0 ${widthClassLg}`;
  const desktopClassesXl = `xl:h-full xl:min-h-0 xl:flex-shrink-0 ${widthClassXl}`;

  const mobileClasses = isLg ? mobileClassesLg : mobileClassesXl;
  const desktopClasses = isLg ? desktopClassesLg : desktopClassesXl;

  // Sémantique : si contrôlé (donc modal sur mobile potentiel), on ajoute dialog, sinon rien (naturel aside)
  // On ne force pas aria-modal pour éviter de casser l'accessibilité desktop sans trap complexe.
  const roleProps = isControlled ? { role: 'dialog' } : {};
  const label = ariaLabel ?? (typeof title === 'string' ? title : undefined);

  // Construction du Header par défaut si non substitué
  const defaultHeader = (
    <div className={`shrink-0 border-b border-emerald-950/10 bg-gradient-to-br from-[#fffaf1] via-white to-emerald-50/40 ${isCompact ? 'p-3' : 'p-4'}`}>
      <div className={`flex flex-col ${isCompact ? 'gap-2' : 'gap-3'}`}>
        <div className={`flex items-start justify-between ${isCompact ? 'gap-2' : 'gap-3'}`}>
          <div className="min-w-0 flex-1 flex items-center gap-2.5">
            {avatar && (
              <div className="shrink-0 flex items-center justify-center">
                {avatar}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className={`mb-0.5 font-black uppercase tracking-[0.14em] text-[#9a5b17] ${isCompact ? 'text-[0.6rem]' : 'text-[11px]'}`}>
                  {eyebrow}
                </p>
              )}
              {title && (
                <h2 className={`truncate font-black text-brand-950 ${isCompact ? 'text-[1.05rem]' : 'text-lg sm:text-xl'}`}>
                  {title}
                </h2>
              )}
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`shrink-0 rounded-xl text-slate-400 transition hover:bg-white hover:text-slate-900 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${isCompact ? 'p-1.5' : 'p-2'}`}
              aria-label={closeLabel}
            >
              <X className={isCompact ? 'h-4 w-4' : 'h-5 w-5'} />
            </button>
          )}
        </div>
        {description && (
          <p className={`font-medium text-slate-600 line-clamp-2 ${isCompact ? 'text-[0.72rem] leading-snug sm:text-xs' : 'text-sm'}`}>
            {description}
          </p>
        )}
        {actions && (
          <div className={`flex flex-wrap items-center gap-2 ${isCompact ? 'mt-1' : 'mt-2'}`}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <aside
      className={`${baseClasses} ${mobileClasses} ${desktopClasses} ${className}`}
      aria-label={label}
      aria-describedby={ariaDescribedBy}
      {...roleProps}
    >
      {/* Overlay Backdrop pour mobile si mode contrôlé */}
      {isControlled && (
        <div
          className={`absolute inset-0 -z-10 bg-slate-900/30 ${isLg ? 'lg:hidden' : 'xl:hidden'}`}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Conteneur principal du Drawer */}
      <div className="relative z-10 flex h-full flex-col bg-[#fffdf8] overflow-hidden">
        {header ? header : (title || eyebrow || description || avatar || onClose || actions) ? defaultHeader : null}

        <div className={`flex-1 overflow-y-auto ${isCompact ? 'p-3' : 'p-4'} ${bodyClassName}`}>
          {children}
        </div>

        {footer && (
          <div className={`shrink-0 border-t border-emerald-950/10 bg-[#fffdf8]/90 p-4 backdrop-blur-sm pb-[max(1rem,env(safe-area-inset-bottom))] ${footerClassName}`}>
            {footer}
          </div>
        )}
      </div>
    </aside>
  );
}

export function PremiumDrawerActionSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid gap-2 rounded-2xl border border-emerald-950/10 bg-white/82 p-3 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
