import React from 'react';
import { describe, expect, it } from 'vitest';
import { SplitViewShell } from '../../components/ui/SplitViewShell';

function renderSplitViewPure(props: Parameters<typeof SplitViewShell>[0]) {
  const result = SplitViewShell(props) as React.ReactElement;
  
  // result est une <section>
  const children = React.Children.toArray(result.props.children);
  const mainWrapper = children[0] as React.ReactElement;
  const detailWrapper = children.length > 1 ? (children[1] as React.ReactElement) : undefined;

  return {
    result,
    mainWrapper,
    detailWrapper
  };
}

describe('SplitViewShell', () => {
  it('rend uniquement le main quand isDetailOpen est false', () => {
    const mainNode = React.createElement('div', { id: 'main' });
    const detailNode = React.createElement('div', { id: 'detail' });
    
    const { detailWrapper } = renderSplitViewPure({
      isDetailOpen: false,
      main: mainNode,
      detail: detailNode
    });
    
    // Le wrapper conditionnel du detail ne doit pas être rendu
    expect(detailWrapper).toBeUndefined();
  });

  it('rend main et detail quand isDetailOpen est true', () => {
    const mainNode = React.createElement('div', { id: 'main' });
    const detailNode = React.createElement('div', { id: 'detail' });
    
    const { detailWrapper } = renderSplitViewPure({
      isDetailOpen: true,
      main: mainNode,
      detail: detailNode
    });
    
    expect(detailWrapper).toBeDefined();
    expect(detailWrapper?.props.children).toBe(detailNode);
  });

  it('rend main et detail par defaut si isDetailOpen n\'est pas specifie mais detail est present', () => {
    const mainNode = React.createElement('div', { id: 'main' });
    const detailNode = React.createElement('div', { id: 'detail' });
    
    const { detailWrapper } = renderSplitViewPure({
      main: mainNode,
      detail: detailNode
    });
    
    expect(detailWrapper).toBeDefined();
    expect(detailWrapper?.props.children).toBe(detailNode);
  });

  it('possede les classes min-w-0 sur le conteneur principal', () => {
    const { mainWrapper } = renderSplitViewPure({
      main: React.createElement('div')
    });
    
    expect(mainWrapper.props.className).toContain('min-w-0');
    expect(mainWrapper.props.className).toContain('flex-1');
  });

  it('applique l\'aria-label correctement', () => {
    const { result } = renderSplitViewPure({
      main: React.createElement('div'),
      ariaLabel: 'Mon SplitView personnalisé'
    });
    
    expect(result.props['aria-label']).toBe('Mon SplitView personnalisé');
  });

  it('verifie l\'absence de fixed inset-0 (ne cree pas d\'overlay)', () => {
    const { result } = renderSplitViewPure({
      main: React.createElement('div'),
      detail: React.createElement('div')
    });
    
    expect(result.props.className).not.toContain('fixed inset-0');
    expect(result.props.className).not.toContain('xl:grid-cols-[minmax(0,1fr)_31.5rem]');
  });

  it('verifie les classes width selon la prop size (standard/wide)', () => {
    // Standard
    const render1 = renderSplitViewPure({
      main: React.createElement('div'),
      detail: React.createElement('div'),
      size: 'standard'
    });
    expect(render1.detailWrapper?.props.className).toContain('xl:w-[clamp(24rem,35vw,31.5rem)]');

    // Wide
    const render2 = renderSplitViewPure({
      main: React.createElement('div'),
      detail: React.createElement('div'),
      size: 'wide'
    });
    expect(render2.detailWrapper?.props.className).toContain('xl:w-[clamp(28rem,40vw,36rem)]');
  });
});
