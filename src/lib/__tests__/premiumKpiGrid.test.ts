import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PremiumKpiGrid } from '../../components/ui/PremiumKpiGrid';

// Aide pour extraire les enfants du JSX retourné par l'appel direct de la fonction
function renderGridPure(props: Parameters<typeof PremiumKpiGrid>[0]) {
  const result = PremiumKpiGrid(props) as React.ReactElement;
  const gridContainer = result.props.children as React.ReactElement; // La div interne avec la grille
  const items = gridContainer.props.children;
  return {
    result,
    gridContainer,
    items: Array.isArray(items) ? items : [items]
  };
}

describe('PremiumKpiGrid — Logique structurelle (Sans DOM)', () => {
  it('limite le rendu à 4 enfants par défaut pour le variant standard', () => {
    const children = Array.from({ length: 6 }).map((_, i) => React.createElement('div', { key: i }, `KPI ${i}`));
    const { items } = renderGridPure({ children, variant: 'standard' });

    // Seulement 4 doivent être rendus
    expect(items.length).toBe(4);
  });

  it('limite le rendu à 6 enfants par défaut pour le variant dashboard', () => {
    const children = Array.from({ length: 8 }).map((_, i) => React.createElement('div', { key: i }, `KPI ${i}`));
    const { items } = renderGridPure({ children, variant: 'dashboard' });

    // Seulement 6 doivent être rendus
    expect(items.length).toBe(6);
  });

  it('respecte la surcharge maxItems (custom)', () => {
    const children = Array.from({ length: 5 }).map((_, i) => React.createElement('div', { key: i }, `KPI ${i}`));
    const { items } = renderGridPure({ children, maxItems: 2 });

    // Surchargé à 2
    expect(items.length).toBe(2);
  });

  it('affiche des skeletons et ignore les enfants pendant isLoading', () => {
    const children = [React.createElement('div', { key: 'real' }, 'Real KPI')];
    const { items, result } = renderGridPure({ children, isLoading: true, variant: 'standard' });

    // 4 Skeletons par défaut car variant=standard
    expect(items.length).toBe(4);
    // On vérifie que ce sont des skeletons (aria-hidden="true")
    expect(items[0].props['aria-hidden']).toBe('true');
    // Le conteneur doit avoir aria-busy=true
    expect(result.props['aria-busy']).toBe(true);
  });

  it('respecte skeletonCount custom pendant isLoading', () => {
    const children = [React.createElement('div', { key: 'real' }, 'Real KPI')];
    const { items } = renderGridPure({ children, isLoading: true, skeletonCount: 3 });

    expect(items.length).toBe(3);
  });

  it('définit le aria-label correct (défaut et custom)', () => {
    const children = [React.createElement('div', { key: '1' }, 'KPI')];

    // Défaut
    const { result: r1 } = renderGridPure({ children });
    expect(r1.props['aria-label']).toBe('Indicateurs clés');

    // Custom
    const { result: r2 } = renderGridPure({ children, ariaLabel: 'Mes stats' });
    expect(r2.props['aria-label']).toBe('Mes stats');
  });

  it('émet un warning console en dev si des enfants sont ignorés', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const children = Array.from({ length: 5 }).map((_, i) => React.createElement('div', { key: i }, `KPI ${i}`));
    renderGridPure({ children, maxItems: 2 });

    expect(warnSpy).toHaveBeenCalled();
    const warningMsg = warnSpy.mock.calls[0][0];
    expect(warningMsg).toContain('Avertissement: 5 KPIs fournis, mais le maximum autorisé est 2');

    warnSpy.mockRestore();
  });

  // UI-00R1A : Tests des classes container-aware
  it('utilise les classes container-aware pour le variant standard', () => {
    const children = [React.createElement('div', { key: '1' }, 'KPI')];
    const { result, gridContainer } = renderGridPure({ children, variant: 'standard' });

    // Le parent racine doit avoir @container
    expect(result.props.className).toContain('@container');

    // L'enfant grille doit utiliser @4xl: au lieu de xl:
    const classes = gridContainer.props.className as string;
    const classList = classes.split(' ');

    expect(classList).toContain('grid-cols-2');
    expect(classList).toContain('@4xl:grid-cols-4');
    expect(classList).not.toContain('xl:grid-cols-4'); // S'assurer que le viewport est banni
  });

  it('utilise les classes container-aware progressives pour le variant dashboard', () => {
    const children = [React.createElement('div', { key: '1' }, 'KPI')];
    const { gridContainer } = renderGridPure({ children, variant: 'dashboard' });

    const classes = gridContainer.props.className as string;
    const classList = classes.split(' ');

    expect(classList).toContain('grid-cols-2');
    expect(classList).toContain('@2xl:grid-cols-3');
    expect(classList).toContain('@4xl:grid-cols-4');
    expect(classList).toContain('@6xl:grid-cols-6');
    expect(classList).not.toContain('2xl:grid-cols-6');
  });
});
