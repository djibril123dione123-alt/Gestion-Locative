import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PremiumToolbar } from '../../components/ui/PremiumToolbar';

function renderToolbar(props: Parameters<typeof PremiumToolbar>[0]) {
  return PremiumToolbar(props) as React.ReactElement;
}

describe('PremiumToolbar', () => {
  it('rend une section accessible vide sans erreur', () => {
    const result = renderToolbar({ ariaLabel: 'Filtres de la liste' });
    expect(result.type).toBe('section');
    expect(result.props['aria-label']).toBe('Filtres de la liste');
  });

  it('donne la priorite au slot search sur children', () => {
    const search = React.createElement('input', { 'aria-label': 'Recherche' });
    const legacy = React.createElement('div', null, 'Ancienne recherche');
    const result = renderToolbar({ search, children: legacy });
    expect(JSON.stringify(result.props.children)).toContain('Recherche');
    expect(JSON.stringify(result.props.children)).not.toContain('Ancienne recherche');
  });

  it('rend filtres, actions, meta et filtres actifs', () => {
    const result = renderToolbar({
      filters: React.createElement('button', null, 'Filtres'),
      primaryAction: React.createElement('button', null, 'Ajouter'),
      meta: React.createElement('span', null, '15 resultats'),
      activeChips: React.createElement('span', null, 'Actifs'),
    });
    const tree = JSON.stringify(result.props.children);
    expect(tree).toContain('Filtres');
    expect(tree).toContain('Ajouter');
    expect(tree).toContain('15 resultats');
    expect(tree).toContain('Actifs');
  });

  it('rend les quick chips et branche leur action', () => {
    const onClick = vi.fn();
    const result = renderToolbar({
      quickChips: [{ id: 'active', label: 'Actifs', count: 3, isActive: true, onClick }],
    });
    const quickBar = React.Children.toArray(result.props.children).find((child) =>
      React.isValidElement(child) && JSON.stringify(child.props.children).includes('Actifs'),
    ) as React.ReactElement;
    const button = React.Children.toArray(quickBar.props.children)[0] as React.ReactElement;
    expect(button.props.children[0]).toBe('Actifs');
    button.props.onClick();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('expose un conteneur adaptatif en mode liste', () => {
    const result = renderToolbar({ layout: 'list', search: React.createElement('input') });
    expect(result.props.className).toContain('@container');
    expect(result.props['data-split-open']).toBe(false);
  });
});
