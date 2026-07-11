import React from 'react';

// ─── Variants officiels ───────────────────────────────────────────────────────
// standard   : Header clair premium — norme pour toutes les pages.
// darkVault  : Header sombre — exclusif à la page Documents (coffre documentaire).
// registry   : Header clair avec accent vert/or — exclusif au Scanner et à Vérification.
// ─────────────────────────────────────────────────────────────────────────────
export type PremiumPageHeaderVariant = 'standard' | 'darkVault' | 'registry';

export interface PremiumPageHeaderProps {
  /** Capsule eyebrow uppercase au-dessus du titre. */
  eyebrow?: string;
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
  /** Contenu latéral discret (ex : jauge de stockage, bloc sécurité).
   * Repositionné dessous le texte sur mobile.
   */
  sideContent?: React.ReactNode;
  /** Variant visuel officiel. @default "standard" */
  variant?: PremiumPageHeaderVariant;
  /** Densité de l'en-tête, impacte la taille de la typo et du padding. @default "comfortable" */
  density?: 'comfortable' | 'compact' | 'ultraCompact';
  /** Mode drawer ouvert, pour cacher/réduire la description et compacter l'en-tête */
  isSplitOpen?: boolean;
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
    // Fond clair premium avec padding dense et relief renforcé
    shell: 'relative overflow-hidden rounded-[1.35rem] border border-slate-900/10 bg-gradient-to-br from-white via-[#fffdf8] to-white shadow-[0_16px_38px_rgba(15,23,42,0.08)] ring-1 ring-black/5',
    eyebrow: 'text-orange-600',
    title: 'text-brand-950',
    description: 'text-slate-600',
    decorBlob:
      'absolute -right-20 -top-20 hidden h-48 w-48 rounded-full bg-orange-300/10 blur-3xl sm:block pointer-events-none',
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
      'relative overflow-hidden rounded-[1.35rem] border border-emerald-950/10 bg-[linear-gradient(135deg,rgba(255,252,245,0.97),rgba(255,255,255,0.94)_54%,rgba(236,253,245,0.62))] p-[clamp(1rem,1.35vw,1.2rem)] shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-white/70 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-gradient-to-r before:from-emerald-800 before:via-amber-400 before:to-emerald-700',
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
  density = 'comfortable',
}: {
  text: string;
  variant: PremiumPageHeaderVariant;
  density?: PremiumPageHeaderProps['density'];
}) {
  const compactBadge =
    density === 'ultraCompact'
      ? 'px-2 py-0.5 text-[0.5rem] tracking-[0.12em]'
      : density === 'compact'
        ? 'px-2.5 py-0.5 text-[0.55rem] tracking-[0.13em]'
        : 'px-3 py-1 text-[10px] tracking-[0.14em]';

  if (variant === 'darkVault') {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] font-semibold uppercase text-emerald-100 ${compactBadge}`}>
        {text}
      </div>
    );
  }
  if (variant === 'registry') {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-700/15 bg-emerald-50/80 font-semibold uppercase text-emerald-700 ${compactBadge}`}>
        {text}
      </div>
    );
  }
  // standard
  return (
    <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-orange-600">
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
  density = 'comfortable',
  isSplitOpen = false,
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

  const isUltraCompact = density === 'ultraCompact';
  const isCompact = density === 'compact' || isUltraCompact;

  // La couleur du titre change selon le variant (blanc sur darkVault)
  const titleColorClass =
    variant === 'darkVault' ? 'text-brand-950' : styles.title;
  // Sur darkVault, le titre doit être blanc
  const compactTitleClass =
    isUltraCompact
      ? 'mt-0.5 text-[1.24rem] leading-[1.12]'
      : isCompact
        ? 'mt-0.5 text-[1.42rem] leading-[1.12]'
        : 'mt-1 text-3xl leading-tight sm:text-4xl';

  const titleClass =
    variant === 'darkVault'
      ? `min-w-0 font-serif font-black tracking-tight text-white ${isCompact ? compactTitleClass : 'mt-1 text-[clamp(1.25rem,1.8vw,1.6rem)] leading-[1.15]'}`
      : `min-w-0 font-serif font-black tracking-tight ${titleColorClass} ${compactTitleClass}`;

  const hasActions =
    resolvedPrimaryAction || resolvedSecondaryAction || legacyActions;
  const hasSideContent = !!sideContent;

  if (variant === 'standard') {
    return (
      <header className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${isCompact ? `${isUltraCompact ? 'gap-1.5' : 'gap-2'}` : 'gap-3'} rounded-[1.35rem] border border-emerald-950/10 bg-[linear-gradient(135deg,rgba(255,252,245,0.96),rgba(255,255,255,0.91))] shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-white/70 ${isCompact ? `${isUltraCompact ? 'px-3 py-1.5 sm:px-3.5 sm:py-1.5' : 'px-3 py-1.5 sm:px-4 sm:py-2'}` : 'px-4 py-3 sm:px-5 sm:py-3.5'} ${className}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0">
              {eyebrow && <p className={`${isCompact ? `${isUltraCompact ? 'text-[0.48rem]' : 'text-[0.55rem]'}` : 'text-[0.68rem]'} font-black uppercase tracking-[0.2em] text-orange-600`}>{eyebrow}</p>}
              <h1 className={`${isUltraCompact ? 'mt-0' : 'mt-0.5'} font-serif font-black tracking-tight text-slate-950 ${isCompact ? `${isUltraCompact ? 'text-[1.18rem] sm:text-[1.32rem]' : 'text-[1.42rem]'}` : 'text-3xl sm:text-4xl'}`}>{title}</h1>
            </div>

            {sideContent && (
              <div className="flex items-center gap-1.5 shrink-0 sm:hidden">
                {sideContent}
              </div>
            )}
          </div>

          {resolvedDescription && (
            mobileDescription ? (
              <>
                <p className={`${isUltraCompact ? 'mt-0 text-[0.64rem] leading-snug' : 'mt-1 text-[0.7rem] leading-relaxed'} max-w-2xl font-medium text-slate-600 sm:hidden`}>{mobileDescription}</p>
                <p className={`${isUltraCompact ? 'mt-0 text-[0.64rem] leading-snug' : 'mt-1 text-[0.7rem] leading-relaxed'} hidden max-w-2xl font-medium text-slate-600 sm:block ${isSplitOpen ? 'opacity-90' : ''}`}>{isSplitOpen ? mobileDescription : resolvedDescription}</p>
              </>
            ) : (
              <p className={`${isUltraCompact ? 'mt-0' : 'mt-1'} max-w-2xl font-medium ${isCompact ? `${isUltraCompact ? 'text-[0.55rem]' : 'text-[0.58rem]'} leading-snug text-slate-500` : 'text-[0.7rem] leading-relaxed text-slate-600'}`}>{resolvedDescription}</p>
            )
          )}

          {meta && <div className="mt-1.5">{meta}</div>}
          {children && <div className="mt-2">{children}</div>}
        </div>

        {(hasActions || hasSideContent) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end mt-1 sm:mt-0">
            {sideContent && (
              <div className="hidden sm:flex items-center gap-1.5">
                {sideContent}
              </div>
            )}
            {resolvedSecondaryAction}
            {resolvedPrimaryAction}
            {legacyActions}
          </div>
        )}
      </header>
    );
  }

  return (
    <header
      className={`@container ${styles.shell} flex flex-col ${isUltraCompact ? 'gap-1.5 !px-3 !py-2' : isCompact ? 'gap-2.5 !px-4 !py-3' : 'gap-4'} sm:flex-row sm:items-center sm:justify-between ${className}`}
      role="banner"
    >
      {/* Bulle décorative */}
      <div className={styles.decorBlob} aria-hidden="true" />

      {/* Colonne gauche : eyebrow + title + description + meta/children legacy */}
      <div className="min-w-0 flex-1 relative z-10">
          {eyebrow && <EyebrowBadge text={eyebrow} variant={variant} density={density} />}

          <h1 className={titleClass}>{title}</h1>

          {/* Description responsive */}
          {resolvedDescription && (
            <>
              {mobileDescription ? (
                <>
                  <p
                    className={`${isCompact ? 'mt-0.5 text-[0.62rem] leading-snug' : 'mt-1 text-[0.7rem] leading-relaxed'} max-w-2xl font-medium @md:hidden ${styles.description}`}
                  >
                    {mobileDescription}
                  </p>
                  <p
                    className={`${isCompact ? 'mt-0.5 text-[0.62rem] leading-snug' : 'mt-1 text-[0.7rem] leading-relaxed'} hidden max-w-2xl font-medium @md:block ${styles.description} ${isSplitOpen ? 'opacity-90' : ''}`}
                  >
                    {isSplitOpen ? mobileDescription : resolvedDescription}
                  </p>
                </>
              ) : (
                <p
                  className={`${isCompact ? 'mt-0.5 text-[0.62rem] leading-snug' : 'mt-1 text-[0.7rem] leading-relaxed'} max-w-2xl font-medium line-clamp-2 ${styles.description}`}
                >
                  {resolvedDescription}
                </p>
              )}
            </>
          )}

          {/* meta slot (rétrocompatibilité) */}
          {meta && <div className="mt-2">{meta}</div>}

          {/* children slot (rétrocompatibilité) */}
          {children && <div className="mt-3">{children}</div>}
        </div>

        {/* Colonne droite : Actions et sideContent */}
        {(hasActions || hasSideContent) && (
          <div className="relative z-10 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
            {sideContent}
            {resolvedSecondaryAction}
            {resolvedPrimaryAction}
            {legacyActions}
          </div>
        )}
    </header>
  );
}
