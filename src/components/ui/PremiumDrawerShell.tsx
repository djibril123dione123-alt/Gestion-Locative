import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export type PremiumDrawerShellSize = "standard" | "wide";

export interface PremiumDrawerShellProps {
  open?: boolean;
  title?: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  header?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  size?: PremiumDrawerShellSize;
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
  header,
  actions,
  footer,
  children,
  onClose,
  closeLabel = "Fermer le panneau",
  size = "standard",
  ariaLabel,
  ariaDescribedBy,
  className = '',
  bodyClassName = '',
  footerClassName = ''
}: PremiumDrawerShellProps) {
  // Respect du mode contrôlé : si explicitement fermé, ne rien rendre
  if (open === false) return null;

  const isControlled = typeof open !== 'undefined';
  const widthClass = size === 'wide' ? 'xl:w-[36rem]' : 'xl:w-[31.5rem]';

  // Classes de base pour la structure et la charte
  // Desktop: colonne inline avec bordure gauche
  // Mobile: overlay (si contrôlé) avec fond
  const baseClasses = "flex flex-col overflow-hidden bg-[#fffdf8] shadow-[0_24px_70px_rgba(15,23,42,0.16)] xl:border-l xl:border-emerald-950/10 xl:shadow-[-18px_0_50px_rgba(15,23,42,0.08)] xl:rounded-l-3xl";
  const mobileClasses = isControlled ? "fixed inset-0 z-50 xl:static xl:inset-auto xl:z-auto" : "h-full min-h-0";
  const desktopClasses = `xl:h-full xl:min-h-0 xl:flex-shrink-0 ${widthClass}`;

  // Sémantique : si contrôlé (donc modal sur mobile potentiel), on ajoute dialog, sinon rien (naturel aside)
  // On ne force pas aria-modal pour éviter de casser l'accessibilité desktop sans trap complexe.
  const roleProps = isControlled ? { role: 'dialog' } : {};
  const label = ariaLabel ?? (typeof title === 'string' ? title : undefined);

  // Construction du Header par défaut si non substitué
  const defaultHeader = (
    <div className="shrink-0 border-b border-emerald-950/10 bg-gradient-to-br from-[#fffaf1] via-white to-emerald-50/40 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="mb-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#9a5b17]">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="truncate text-lg font-black text-brand-950 sm:text-xl">
                {title}
              </h2>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-900 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label={closeLabel}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {description && (
          <p className="text-sm font-medium text-slate-600 line-clamp-2">
            {description}
          </p>
        )}
        {actions && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
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
          className="absolute inset-0 -z-10 bg-slate-900/30 xl:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Conteneur principal du Drawer */}
      <div className="relative z-10 flex h-full flex-col bg-[#fffdf8] overflow-hidden">
        {header ? header : (title || eyebrow || description || onClose || actions) ? defaultHeader : null}

        <div className={`flex-1 overflow-y-auto p-4 ${bodyClassName}`}>
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
