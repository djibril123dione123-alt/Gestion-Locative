import React from 'react';

// ─── Variants officiels ───────────────────────────────────────────────────────
// standard   : Header clair premium — norme pour toutes les pages.
// darkVault  : Header sombre — exclusif à la page Documents (coffre documentaire).
// registry   : Header clair avec accent vert/or — exclusif au Scanner et à Vérification.
// ─────────────────────────────────────────────────────────────────────────────
export type PremiumPageHeaderVariant = 'standard' | 'darkVault' | 'registry';

export interface PremiumPageHeaderProps {
  /** Capsule eyebrow uppercase au-dessus du titre. */
  eyebrow: string;
  /** Titre principal — affiché en police Serif. */
  title: React.ReactNode;
  /**
   * Description desktop, 1-2 lignes max.
   * Rétrocompatibilité : ancienne prop `subtitle` mappée vers `description` si
   * `description` n'est pas fournie.
   */
  description?: React.ReactNode;
  /** Description courte spécifique mobile (1 ligne idéale). Surcharge `description` sur mobile. */
  mobileDescription?: string;
  /** CTA principal (bouton crée/ajoute). Rendu pleine largeur sur mobile. */
  primaryAction?: React.ReactNode;
  /** CTA secondaire (scanner, exporter…). */
  secondaryAction?: React.ReactNode;
  /**
   * Contenu latéral discret (ex : jauge de stockage, bloc sécurité).
   * Repositionné dessous le texte sur mobile.
   */
  sideContent?: React.ReactNode;
  /** Variant visuel officiel. @default "standard" */
  variant?: PremiumPageHeaderVariant;
  /** Classe CSS supplémentaire sur le conteneur racine. */
  className?: string;

  // ── Anciennes props conservées pour rétrocompatibilité ──────────────────────
  /** @deprecated Utilisez `description`. */
  subtitle?: React.ReactNode;
  /** @deprecated Utilisez `primaryAction` / `secondaryAction`. */
  actions?: React.ReactNode;
  /** @deprecated Slot libre — contenu injecté sous la description. */
  meta?: React.ReactNode;
  /** @deprecated Slot libre — rendu directement dans le body du header. */
  children?: React.ReactNode;
}

// ─── Styles par variant ───────────────────────────────────────────────────────
const VARIANT_STYLES: Record<
  PremiumPageHeaderVariant,
  {
    shell: string;
    eyebrow: string;
    title: string;
    description: string;
    decorBlob: string;
  }
> = {
  standard: {
    // Fond clair premium, identique à .sk-page-hero
    shell: 'sk-page-hero',
    eyebrow: 'text-action-600',
    title: 'text-brand-950',
    description: 'text-slate-600',
    decorBlob:
      'absolute -right-20 -top-20 hidden h-56 w-56 rounded-full bg-orange-300/10 blur-3xl sm:block pointer-events-none',
  },
  darkVault: {
    // Fond vert profond — coffre documentaire uniquement
    shell:
      'sk-mobile-hero max-w-full bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-[clamp(1.15rem,1.5vw,1.35rem)] text-white shadow-2xl shadow-emerald-950/15',
    eyebrow: 'text-emerald-100',
    title: 'text-brand-950',   // classe CSS remplacée par le texte blanc natif du container
    description: 'text-emerald-50/70',
    decorBlob:
      'absolute -right-20 -top-20 hidden h-56 w-56 rounded-full bg-orange-300/15 blur-3xl sm:block pointer-events-none',
  },
  registry: {
    // Fond clair avec liseré vert/or — scanner et vérification uniquement
    shell:
      'relative overflow-hidden rounded-[1.4rem] border border-emerald-700/30 bg-gradient-to-br from-white via-emerald-50/40 to-amber-50/30 p-[clamp(1.15rem,1.5vw,1.35rem)] shadow-[0_22px_64px_rgba(6,17,13,0.10)]',
    eyebrow: 'text-emerald-700',
    title: 'text-brand-950',
    description: 'text-slate-600',
    decorBlob:
      'absolute -right-20 -top-20 hidden h-48 w-48 rounded-full bg-amber-300/15 blur-3xl sm:block pointer-events-none',
  },
};

// ─── Eyebrow badge par variant ────────────────────────────────────────────────
function EyebrowBadge({
  text,
  variant,
}: {
  text: string;
  variant: PremiumPageHeaderVariant;
}) {
  if (variant === 'darkVault') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
        {text}
      </div>
    );
  }
  if (variant === 'registry') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/20 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
        {text}
      </div>
    );
  }
  // standard
  return (
    <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-action-600">
      {text}
    </p>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export function PremiumPageHeader({
  eyebrow,
  title,
  description,
  mobileDescription,
  primaryAction,
  secondaryAction,
  sideContent,
  variant = 'standard',
  className = '',
  // ── Anciennes props (rétrocompatibilité) ──
  subtitle,
  actions,
  meta,
  children,
}: PremiumPageHeaderProps) {
  const styles = VARIANT_STYLES[variant];

  // Résolution rétrocompatible de la description
  const resolvedDescription = description ?? subtitle;

  // Résolution rétrocompatible des actions
  const resolvedPrimaryAction = primaryAction;
  const resolvedSecondaryAction = secondaryAction;
  const legacyActions = actions; // actions non-migrées affichées après les nouvelles

  // La couleur du titre change selon le variant (blanc sur darkVault)
  const titleColorClass =
    variant === 'darkVault' ? 'text-brand-950' : styles.title;
  // Sur darkVault, le titre doit être blanc
  const titleClass =
    variant === 'darkVault'
      ? 'mt-1 min-w-0 font-serif text-[clamp(1.5rem,2.3vw,2.25rem)] leading-[1.15] font-black tracking-tight text-white'
      : `mt-1 min-w-0 font-serif text-[clamp(1.5rem,2.3vw,2.25rem)] leading-[1.15] font-black tracking-tight ${titleColorClass}`;

  const hasActions =
    resolvedPrimaryAction || resolvedSecondaryAction || legacyActions;
  const hasSideContent = !!sideContent;

  return (
    <header
      className={`@container ${styles.shell} ${className}`}
      role="banner"
    >
      {/* Bulle décorative */}
      <div className={styles.decorBlob} aria-hidden="true" />

      {/* Grille principale : texte + side */}
      <div className="relative flex min-w-0 flex-col gap-3 @2xl:flex-row @2xl:items-end @2xl:justify-between @2xl:gap-5">

        {/* Colonne gauche : eyebrow + title + description + actions */}
        <div className="min-w-0 flex-1">
          <EyebrowBadge text={eyebrow} variant={variant} />

          <h1 className={titleClass}>{title}</h1>

          {/* Description responsive */}
          {resolvedDescription && (
            <>
              {mobileDescription ? (
                <>
                  <p
                    className={`mt-1 max-w-lg text-sm font-medium leading-5 @md:hidden ${styles.description}`}
                  >
                    {mobileDescription}
                  </p>
                  <p
                    className={`mt-1 hidden max-w-lg text-sm font-medium leading-5 @md:block ${styles.description}`}
                  >
                    {resolvedDescription}
                  </p>
                </>
              ) : (
                <p
                  className={`mt-1 max-w-lg text-sm font-medium leading-5 line-clamp-2 ${styles.description}`}
                >
                  {resolvedDescription}
                </p>
              )}
            </>
          )}

          {/* meta slot (rétrocompatibilité) */}
          {meta && <div className="mt-2">{meta}</div>}

          {/* Actions */}
          {hasActions && (
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              {resolvedPrimaryAction}
              {resolvedSecondaryAction}
              {legacyActions}
            </div>
          )}

          {/* children slot (rétrocompatibilité) */}
          {children && <div className="mt-3">{children}</div>}
        </div>

        {/* Colonne droite : sideContent */}
        {hasSideContent && (
          <div className="min-w-0 w-full shrink-0 @2xl:w-auto @2xl:min-w-[200px] @2xl:max-w-[240px]">
            {sideContent}
          </div>
        )}
      </div>
    </header>
  );
}
