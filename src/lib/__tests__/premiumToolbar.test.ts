import React from 'react';
import { describe, expect, it } from 'vitest';
import { PremiumToolbar } from '../../components/ui/PremiumToolbar';

// Utilitaire pour extraire les enfants sans JSDOM
function renderToolbarPure(props: Parameters<typeof PremiumToolbar>[0]) {
  const result = PremiumToolbar(props) as React.ReactElement;
  // La racine est une <section>
  const topBar = result.props.children[0] as React.ReactElement; // div contenant search et actions
  const metaBar = result.props.children[1] as React.ReactElement | undefined;
  const chipsBar = result.props.children[2] as React.ReactElement | undefined;
  const filtersBar = result.props.children[3] as React.ReactElement | undefined;

  const searchArea = topBar.props.children[0];
  const actionsArea = topBar.props.children[1] as React.ReactElement | undefined;

  return {
    result,
    topBar,
    searchArea,
    actionsArea,
    metaBar,
    chipsBar,
    filtersBar
  };
}

describe('PremiumToolbar — Logique et Rétrocompatibilité', () => {
  it('rend la toolbar par défaut sans crasher même si tous les slots sont vides', () => {
    const { result, searchArea, actionsArea, chipsBar, filtersBar } = renderToolbarPure({});
    
    expect(result.type).toBe('section');
    expect(result.props['aria-label']).toBe('Outils de liste'); // Valeur par défaut
    
    // Le search (ou children fallback) est null
    expect(searchArea.props.children).toBeUndefined();
    // Les conteneurs conditionnels ne doivent pas exister
    expect(actionsArea).toBeFalsy();
    expect(chipsBar).toBeFalsy();
    expect(filtersBar).toBeFalsy();
  });

  it('respecte le label ARIA personnalisé', () => {
    const { result } = renderToolbarPure({ ariaLabel: 'Mes filtres custom' });
    expect(result.props['aria-label']).toBe('Mes filtres custom');
  });

  it('préserve la rétrocompatibilité du mapping de children vers la zone de recherche', () => {
    const Child = React.createElement('div', { id: 'legacy-child' }, 'Legacy Search');
    const { searchArea } = renderToolbarPure({ children: Child });
    
    expect(searchArea.props.children).toBe(Child);
  });

  it('rend bien le slot search explicitement (et ignore children si fourni)', () => {
    const SearchNode = React.createElement('div', { id: 'search' }, 'Search');
    const ChildNode = React.createElement('div', { id: 'child' }, 'Child');
    
    const { searchArea } = renderToolbarPure({ search: SearchNode, children: ChildNode });
    // Le coalesce ?? donne la priorité à search
    expect(searchArea.props.children).toBe(SearchNode);
  });

  it('combine les nouvelles actions (primary/secondary) et les anciennes (actions)', () => {
    const Primary = React.createElement('button', {}, 'Primary');
    const Secondary = React.createElement('button', {}, 'Secondary');
    const LegacyActions = React.createElement('button', {}, 'Legacy');

    // Test 1: primary + secondary
    const render1 = renderToolbarPure({ primaryAction: Primary, secondaryActions: Secondary });
    expect(render1.actionsArea).toBeTruthy();
    // props.children[0] correspond à {secondaryActions ?? actions}
    expect(render1.actionsArea?.props.children[0]).toBe(Secondary);
    // props.children[1] correspond à primaryAction wrappé
    expect(render1.actionsArea?.props.children[1]?.props.children).toBe(Primary);

    // Test 2: legacy actions
    const render2 = renderToolbarPure({ actions: LegacyActions });
    expect(render2.actionsArea?.props.children[0]).toBe(LegacyActions);

    // Test 3: si secondary et actions sont fournis, secondary a la priorité
    const render3 = renderToolbarPure({ secondaryActions: Secondary, actions: LegacyActions });
    expect(render3.actionsArea?.props.children[0]).toBe(Secondary);
  });

  it('affiche les chips de filtres actifs (activeChips) dans le wrapper dédié', () => {
    const Chips = React.createElement('div', {}, 'Filtre 1, Filtre 2');
    const { chipsBar } = renderToolbarPure({ activeChips: Chips });
    
    expect(chipsBar).toBeTruthy();
    expect(chipsBar?.props.className).toContain('flex-wrap'); // S'assurer que le wrap est propre
    expect(chipsBar?.props.children).toBe(Chips);
  });

  it('affiche les filtres et le slot meta', () => {
    const Filters = React.createElement('div', {}, 'Filtres avancés');
    const Meta = React.createElement('div', {}, 'Total : 15');
    
    const { filtersBar, metaBar } = renderToolbarPure({ filters: Filters, meta: Meta });
    
    expect(filtersBar).toBeTruthy();
    expect(filtersBar?.props.children).toBe(Filters);
    
    expect(metaBar).toBeTruthy();
    expect(metaBar?.props.children).toBe(Meta);
  });

  // UI-00R1B : Tests des classes container-aware
  it('utilise les classes container-aware et abandonne les classes viewport rigides', () => {
    const { result, topBar } = renderToolbarPure({});
    
    // Le parent racine doit avoir @container
    expect(result.props.className).toContain('@container');
    
    // La top bar doit utiliser @3xl:flex-row au lieu de lg:flex-row
    const classes = topBar.props.className as string;
    const classList = classes.split(' ');
    
    expect(classList).toContain('flex-col'); // Mobile first
    expect(classList).toContain('@3xl:flex-row');
    expect(classList).toContain('@3xl:items-center');
    expect(classList).toContain('@3xl:justify-between');
    
    // S'assurer que le viewport est banni
    expect(classList).not.toContain('lg:flex-row');
    expect(classList).not.toContain('md:flex-row');
  });
});
