import React from 'react';
import { describe, expect, it } from 'vitest';
import { PremiumPageHeader } from '../../components/ui/PremiumPageHeader';

function findElement(node: React.ReactNode, type: string): React.ReactElement | undefined {
  if (!React.isValidElement(node)) return undefined;
  if (node.type === type) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const match = findElement(child, type);
    if (match) return match;
  }
  return undefined;
}

describe('PremiumPageHeader', () => {
  it('rend un header semantique et un titre unique', () => {
    const result = PremiumPageHeader({ title: 'Parametres' }) as React.ReactElement;
    expect(result.type).toBe('header');
    expect(findElement(result, 'h1')?.props.children).toBe('Parametres');
  });

  it('utilise description avant le fallback subtitle', () => {
    const result = PremiumPageHeader({
      title: 'Organisation',
      description: 'Description actuelle',
      subtitle: 'Ancienne description',
    }) as React.ReactElement;
    expect(JSON.stringify(result.props.children)).toContain('Description actuelle');
    expect(JSON.stringify(result.props.children)).not.toContain('Ancienne description');
  });

  it('rend la description mobile lorsqu elle est fournie', () => {
    const result = PremiumPageHeader({
      title: 'Utilisateurs',
      description: 'Description desktop',
      mobileDescription: 'Description compacte',
      isSplitOpen: true,
    }) as React.ReactElement;
    expect(JSON.stringify(result.props.children)).toContain('Description compacte');
  });

  it('rend les actions nouvelles et legacy', () => {
    const result = PremiumPageHeader({
      title: 'Facturation',
      primaryAction: React.createElement('button', null, 'Renouveler'),
      actions: React.createElement('button', null, 'Historique'),
    }) as React.ReactElement;
    const tree = JSON.stringify(result.props.children);
    expect(tree).toContain('Renouveler');
    expect(tree).toContain('Historique');
  });

  it.each(['standard', 'darkVault', 'registry'] as const)('rend le variant %s', (variant) => {
    const result = PremiumPageHeader({ title: 'Titre', variant }) as React.ReactElement;
    expect(result.type).toBe('header');
    expect(result.props.className).toBeTruthy();
  });
});
