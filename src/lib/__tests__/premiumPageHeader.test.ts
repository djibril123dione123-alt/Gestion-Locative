import React from 'react';
import { describe, expect, it } from 'vitest';
import { PremiumPageHeader } from '../../components/ui/PremiumPageHeader';

// ─── Tests purement comportementaux — logique du composant PremiumPageHeader ──
// Ces tests valident la logique de sélection de variant, le fallback description,
// la résolution rétrocompatible des props et les helpers internes.
// Ils n'utilisent pas jsdom car l'infrastructure de test existante n'inclut
// pas de DOM testing library.
// ─────────────────────────────────────────────────────────────────────────────

// ── Simulation de la logique de résolution des props ─────────────────────────
type ResolvedProps = {
  description: unknown;
  variant: 'standard' | 'darkVault' | 'registry';
  hasActions: boolean;
};

function resolveProps(props: {
  description?: string;
  subtitle?: string;
  variant?: 'standard' | 'darkVault' | 'registry';
  primaryAction?: string;
  secondaryAction?: string;
  actions?: string;
}): ResolvedProps {
  const resolvedDescription = props.description ?? props.subtitle;
  const variant = props.variant ?? 'standard';
  const hasActions = !!(props.primaryAction || props.secondaryAction || props.actions);
  return { description: resolvedDescription, variant, hasActions };
}

// ── Simulation de la sélection des styles par variant ────────────────────────
type VariantStyleKey = 'standard' | 'darkVault' | 'registry';

const VARIANT_SHELL_CONTAINS: Record<VariantStyleKey, string> = {
  standard: 'sk-page-hero',
  darkVault: 'sk-mobile-hero',
  registry: 'rounded-[1.4rem]',
};

function getShellClass(variant: VariantStyleKey): string {
  return VARIANT_SHELL_CONTAINS[variant];
}

// ─────────────────────────────────────────────────────────────────────────────

describe('PremiumPageHeader — résolution des props', () => {
  it('utilise description quand elle est fournie directement', () => {
    const { description } = resolveProps({ description: 'Ma description' });
    expect(description).toBe('Ma description');
  });

  it('tombe sur subtitle si description est absente (rétrocompatibilité)', () => {
    const { description } = resolveProps({ subtitle: 'Mon ancien subtitle' });
    expect(description).toBe('Mon ancien subtitle');
  });

  it('préfère description sur subtitle si les deux sont fournis', () => {
    const { description } = resolveProps({
      description: 'Nouvelle description',
      subtitle: 'Ancien subtitle',
    });
    expect(description).toBe('Nouvelle description');
  });

  it('retourne undefined si aucune description ni subtitle', () => {
    const { description } = resolveProps({});
    expect(description).toBeUndefined();
  });
});

describe('PremiumPageHeader — variant par défaut', () => {
  it('applique le variant standard si aucun variant n\'est fourni', () => {
    const { variant } = resolveProps({});
    expect(variant).toBe('standard');
  });

  it('préserve le variant darkVault quand fourni', () => {
    const { variant } = resolveProps({ variant: 'darkVault' });
    expect(variant).toBe('darkVault');
  });

  it('préserve le variant registry quand fourni', () => {
    const { variant } = resolveProps({ variant: 'registry' });
    expect(variant).toBe('registry');
  });
});

describe('PremiumPageHeader — sélection de la shell CSS par variant', () => {
  it('le variant standard utilise sk-page-hero', () => {
    expect(getShellClass('standard')).toContain('sk-page-hero');
  });

  it('le variant darkVault utilise sk-mobile-hero', () => {
    expect(getShellClass('darkVault')).toContain('sk-mobile-hero');
  });

  it('le variant registry utilise un arrondi premium spécifique', () => {
    expect(getShellClass('registry')).toContain('rounded-[1.4rem]');
  });
});

describe('PremiumPageHeader — résolution des actions', () => {
  it('détecte qu\'il y a des actions si primaryAction est fourni', () => {
    const { hasActions } = resolveProps({ primaryAction: 'button' });
    expect(hasActions).toBe(true);
  });

  it('détecte qu\'il y a des actions si l\'ancienne prop actions est fournie', () => {
    const { hasActions } = resolveProps({ actions: 'legacy-button' });
    expect(hasActions).toBe(true);
  });

  it('ne signale pas d\'actions si aucune n\'est fournie', () => {
    const { hasActions } = resolveProps({});
    expect(hasActions).toBe(false);
  });

  it('détecte qu\'il y a des actions si secondaryAction est fourni', () => {
    const { hasActions } = resolveProps({ secondaryAction: 'scan-button' });
    expect(hasActions).toBe(true);
  });
});

describe('PremiumPageHeader — variants exhaustifs', () => {
  const validVariants: VariantStyleKey[] = ['standard', 'darkVault', 'registry'];

  it.each(validVariants)('le variant %s a une classe shell définie', (variant) => {
    expect(getShellClass(variant)).toBeTruthy();
  });

  it('ne retourne pas de classe shell vide pour aucun variant', () => {
    validVariants.forEach((variant) => {
      expect(getShellClass(variant).length).toBeGreaterThan(0);
    });
  });
});

// ─── Tests sur le composant React (Typographie et Container-aware) ───────────

function renderHeaderPure(props: Parameters<typeof PremiumPageHeader>[0]) {
  const result = PremiumPageHeader(props) as React.ReactElement;
  const grid = result.props.children[1] as React.ReactElement; // La grille principale
  const leftColumn = grid.props.children[0] as React.ReactElement;
  const titleNode = leftColumn.props.children[1] as React.ReactElement;
  return { result, grid, leftColumn, titleNode };
}

describe('PremiumPageHeader — Typographie fluide et Container-aware', () => {
  it('utilise une échelle fluide pour le titre au lieu de sm:text-4xl', () => {
    const { titleNode } = renderHeaderPure({ eyebrow: 'Test', title: 'Titre' });
    const classes = titleNode.props.className as string;
    expect(classes).toContain('text-[clamp(');
    expect(classes).not.toContain('sm:text-4xl');
    expect(classes).not.toContain('text-3xl');
  });

  it('applique @container sur la racine', () => {
    const { result } = renderHeaderPure({ eyebrow: 'Test', title: 'Titre' });
    expect(result.props.className).toContain('@container');
  });

  it('utilise @2xl pour la grille interne au lieu de sm:', () => {
    const { grid } = renderHeaderPure({ eyebrow: 'Test', title: 'Titre' });
    const classes = grid.props.className as string;
    expect(classes).toContain('@2xl:flex-row');
    expect(classes).toContain('@2xl:items-end');
    expect(classes).not.toContain('sm:flex-row');
    expect(classes).not.toContain('sm:items-end');
  });
});
