import { describe, it, expect } from 'vitest';
import React from 'react';
import { PremiumMobileCard } from '../../components/ui/PremiumMobileCard';

describe('PremiumMobileCard', () => {
  it('rend le titre et préserve l\'ancienne API', () => {
    const result = PremiumMobileCard({ title: "Mon Titre", subtitle: "Sous titre", amount: 5000 }) as React.ReactElement;
    expect(result).toBeDefined();
    // On vérifie au moins qu'il s'agit d'un article
    expect(result.type).toBe('article');
  });

  it('n\'utilise pas le tag button si on ne fournit pas onClick', () => {
    const result = PremiumMobileCard({ title: "Test" }) as React.ReactElement;
    expect(result.type).toBe('article');
  });

  it('utilise un tag article et role=button si onClick + actions sont présents', () => {
    const result = PremiumMobileCard({
      title: "Test",
      onClick: () => {},
      actions: React.createElement('button', null, 'Action')
    }) as React.ReactElement;
    expect(result.type).toBe('article');
    expect(result.props.role).toBe('button');
    expect(result.props.tabIndex).toBe(0);
  });

  it('utilise un tag button si onClick est présent mais pas d\'enfants interactifs', () => {
    const result = PremiumMobileCard({ title: "Test", onClick: () => {} }) as React.ReactElement;
    expect(result.type).toBe('button');
    expect(result.props['data-premium-mobile-card']).toBe('true');
  });

  it('applique les classes de densité compact', () => {
    const result = PremiumMobileCard({ title: "Test", density: "compact" }) as React.ReactElement;
    expect(result.props.className).toContain('p-2.5');
  });

  it('applique selected/active', () => {
    const result = PremiumMobileCard({ title: "Test", selected: true }) as React.ReactElement;
    expect(result.props.className).toContain('border-emerald-300');
    expect(result.props.className).toContain('bg-emerald-50/50');
  });
});
