import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PremiumKpiGrid } from '../../components/ui/PremiumKpiGrid';

function renderGrid(props: Parameters<typeof PremiumKpiGrid>[0]) {
  const result = PremiumKpiGrid(props) as React.ReactElement;
  const grid = result.props.children as React.ReactElement;
  const items = React.Children.toArray(grid.props.children);
  return { result, grid, items };
}

describe('PremiumKpiGrid', () => {
  it('limite le variant standard a quatre indicateurs', () => {
    const children = Array.from({ length: 6 }, (_, index) =>
      React.createElement('div', { key: index }, `KPI ${index}`),
    );
    expect(renderGrid({ children }).items).toHaveLength(4);
  });

  it('limite le dashboard a six indicateurs', () => {
    const children = Array.from({ length: 8 }, (_, index) =>
      React.createElement('div', { key: index }, `KPI ${index}`),
    );
    expect(renderGrid({ children, variant: 'dashboard' }).items).toHaveLength(6);
  });

  it('respecte maxItems', () => {
    const children = Array.from({ length: 5 }, (_, index) =>
      React.createElement('div', { key: index }, `KPI ${index}`),
    );
    expect(renderGrid({ children, maxItems: 2 }).items).toHaveLength(2);
  });

  it('rend des skeletons accessibles pendant le chargement', () => {
    const { result, items } = renderGrid({
      children: React.createElement('div', null, 'Valeur'),
      isLoading: true,
      skeletonCount: 3,
    });
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ props: { 'aria-hidden': 'true' } });
    expect(result.props['aria-busy']).toBe(true);
  });

  it('respecte le libelle accessible personnalise', () => {
    const { result } = renderGrid({
      children: React.createElement('div', null, 'Valeur'),
      ariaLabel: 'Indicateurs financiers',
    });
    expect(result.props['aria-label']).toBe('Indicateurs financiers');
  });

  it('avertit en developpement quand des indicateurs sont ignores', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const children = Array.from({ length: 5 }, (_, index) =>
      React.createElement('div', { key: index }, `KPI ${index}`),
    );
    renderGrid({ children, maxItems: 2 });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('expose une grille dans un conteneur adaptatif', () => {
    const children = Array.from({ length: 4 }, (_, index) =>
      React.createElement('div', { key: index }, `KPI ${index}`),
    );
    const { result, grid } = renderGrid({ children });
    expect(result.props.className).toContain('@container');
    expect(grid.props.className).toContain('grid-cols-2');
  });
});
