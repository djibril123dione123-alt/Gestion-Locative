import React from 'react';
import { describe, it, expect } from 'vitest';
import { PremiumTableSurface } from '../../components/ui/PremiumTableSurface';

describe('PremiumTableSurface', () => {
  it('ne crash pas avec l API legacy et rend les children', () => {
    const children = React.createElement('div', { 'data-testid': 'child' }, 'Test Child');
    const element = React.createElement(PremiumTableSurface, null, children);
    expect(element.type).toBe(PremiumTableSurface);

    const result = PremiumTableSurface({ children }) as React.ReactElement;
    expect(result.type).toBe('section');
    expect(result.props.className).toContain('overflow-hidden');
    expect(result.props.children).toBe(children);
  });

  it('conserve le className et bodyClassName', () => {
    const children = React.createElement('div', null, 'Test Child');
    const result = PremiumTableSurface({ 
      children, 
      className: 'custom-class', 
      bodyClassName: 'custom-body' 
    }) as React.ReactElement;

    expect(result.props.className).toContain('custom-class');
    
    // Le child rendu avec bodyClassName est une div
    const innerDiv = result.props.children;
    expect(innerDiv.type).toBe('div');
    expect(innerDiv.props.className).toBe('custom-body');
  });

  it('applique ariaLabel', () => {
    const children = React.createElement('div', null, 'Test');
    const result = PremiumTableSurface({ 
      children, 
      ariaLabel: 'Table des données' 
    }) as React.ReactElement;

    expect(result.props['aria-label']).toBe('Table des données');
  });

  it('rend avec density compact et comfortable', () => {
    const children = React.createElement('div', null, 'Test');
    
    const resultComfortable = PremiumTableSurface({ children, density: 'comfortable' }) as React.ReactElement;
    expect(resultComfortable.props['data-density']).toBe('comfortable');

    const resultCompact = PremiumTableSurface({ children, density: 'compact' }) as React.ReactElement;
    expect(resultCompact.props['data-density']).toBe('compact');
  });

  it('ajoute un wrapper scroll si withHorizontalScroll est true', () => {
    const children = React.createElement('div', null, 'Test');
    const result = PremiumTableSurface({ 
      children, 
      withHorizontalScroll: true,
      bodyClassName: 'inner-body'
    }) as React.ReactElement;

    // Le wrapper externe n'a plus overflow-hidden
    expect(result.props.className).not.toContain('overflow-hidden');

    // Le child est un wrapper de scroll
    const scrollWrapper = result.props.children;
    expect(scrollWrapper.type).toBe('div');
    expect(scrollWrapper.props.className).toContain('overflow-x-auto');
    expect(scrollWrapper.props.className).toContain('inner-body');

    // Le child du wrapper de scroll est une div min-w-fit
    const fitWrapper = scrollWrapper.props.children;
    expect(fitWrapper.type).toBe('div');
    expect(fitWrapper.props.className).toBe('min-w-fit');
    expect(fitWrapper.props.children).toBe(children);
  });
});
