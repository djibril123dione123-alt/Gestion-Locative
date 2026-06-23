import type { ReactNode } from 'react';

export type PageShellSpacing = 'compact' | 'standard' | 'relaxed';
export type PageShellVariant = 'standard' | 'dataDense';
export type PageShellTone = 'default' | 'paper';

export interface PageShellProps {
  children: ReactNode;
  className?: string;
  spacing?: PageShellSpacing;
  variant?: PageShellVariant;
  tone?: PageShellTone;
  ariaLabel?: string;
}

const SPACING_MAP: Record<PageShellSpacing, string> = {
  compact: 'space-y-4',
  standard: 'space-y-5 sm:space-y-6',
  relaxed: 'space-y-6 lg:space-y-8',
};

const TONE_MAP: Record<PageShellTone, string> = {
  default: '',
  paper: 'bg-brand-paper/70',
};

/**
 * Primitive officielle d'espacement de page.
 * Gère uniquement la structure verticale et potentiellement un fond (tone).
 * Ne rajoute AUCUN padding horizontal (délégué à AppShell).
 * Ne rajoute AUCUN max-width local (délégué à AppShell).
 */
export function PageShell({
  children,
  className = '',
  spacing = 'standard',
  variant = 'standard',
  tone = 'default',
  ariaLabel,
}: PageShellProps) {
  const baseClasses = 'flex flex-col w-full min-w-0 max-w-full';
  const spacingClass = SPACING_MAP[spacing];
  const toneClass = TONE_MAP[tone];

  // Le variant "dataDense" pourrait servir à annuler certains espacements par défaut
  // ou à préparer le terrain pour des mises en page sans marges internes.
  // Pour l'instant, les deux partagent la même structure de base fluide.
  const variantClass = variant === 'dataDense' ? '' : '';

  const classes = [baseClasses, spacingClass, variantClass, toneClass, className]
    .filter(Boolean)
    .join(' ');

  if (ariaLabel) {
    return (
      <section aria-label={ariaLabel} className={classes}>
        {children}
      </section>
    );
  }

  return <div className={classes}>{children}</div>;
}
