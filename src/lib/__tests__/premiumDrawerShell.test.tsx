import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PremiumDrawerShell, PremiumDrawerActionSection } from '../../components/ui/PremiumDrawerShell';

function renderShellPure(props: Parameters<typeof PremiumDrawerShell>[0]) {
  const result = PremiumDrawerShell(props) as React.ReactElement | null;
  if (!result) return { result };

  const aside = result;
  
  // Find backdrop
  const backdrop = aside.props.children[0] as React.ReactElement | undefined;
  // Find inner container
  const container = aside.props.children[1] as React.ReactElement;
  
  const header = container.props.children[0] as React.ReactElement | null;
  const body = container.props.children[1] as React.ReactElement;
  const footerContainer = container.props.children[2] as React.ReactElement | null;
  
  return {
    result: aside,
    backdrop,
    container,
    header,
    body,
    footerContainer
  };
}

describe('PremiumDrawerShell — Logique et Rétrocompatibilité', () => {
  it('ne rend rien si open est false', () => {
    const { result } = renderShellPure({ open: false, children: 'Contenu' });
    expect(result).toBeNull();
  });

  it('rend un shell legacy minimal par défaut (open undefined)', () => {
    const { result, backdrop, header, footerContainer, body } = renderShellPure({ children: <div id="child">Contenu</div> });
    
    expect(result).toBeTruthy();
    expect(result?.type).toBe('aside');
    expect(result?.props.className).not.toContain('fixed inset-0'); // Pas d'overlay forcé en legacy
    expect(backdrop).toBeFalsy(); // Pas de backdrop cliquable en legacy
    expect(header).toBeNull();
    expect(footerContainer).toBeNull();
    expect(body!).toBeDefined();
    expect(body!.props.children.props.id).toBe('child');
  });

  it('rend en mode overlay contrôlé si open est true', () => {
    const onClose = vi.fn();
    const { result, backdrop } = renderShellPure({ open: true, onClose, children: 'Contenu' });
    
    expect(result?.props.className).toContain('fixed inset-0');
    expect(result?.props.role).toBe('dialog');
    
    // Le backdrop existe et appelle onClose
    expect(backdrop).toBeTruthy();
    backdrop?.props.onClick();
    expect(onClose).toHaveBeenCalled();
  });

  it('génère un header par défaut avec title, eyebrow, description et onClose', () => {
    const { header } = renderShellPure({ 
      title: 'Titre Drawer', 
      eyebrow: 'Méta', 
      description: 'Une description',
      onClose: () => {},
      closeLabel: 'Fermer custom',
      children: 'Contenu'
    });

    expect(header).toBeTruthy();
    // Le titre et eyebrow sont rendus
    const innerHeader = header?.props.children.props.children[0];
    const texts = innerHeader.props.children[0].props.children;
    expect(texts[0].props.children).toBe('Méta'); // eyebrow
    expect(texts[1].props.children).toBe('Titre Drawer'); // title

    // Le bouton fermer est rendu avec aria-label
    const closeBtn = innerHeader.props.children[1];
    expect(closeBtn.type).toBe('button');
    expect(closeBtn.props['aria-label']).toBe('Fermer custom');
    
    // La description est présente
    const desc = header?.props.children.props.children[1];
    expect(desc.props.children).toBe('Une description');
  });

  it('permet de surcharger complètement le header', () => {
    const CustomHeader = <header id="custom-header">Mon Header</header>;
    const { header } = renderShellPure({ header: CustomHeader, title: 'Ignoré', children: 'Contenu' });
    
    expect(header?.props.id).toBe('custom-header');
  });

  it('affiche les actions dans le header standard', () => {
    const Actions = <button>Action</button>;
    const { header } = renderShellPure({ actions: Actions, children: 'Contenu' });
    
    const actionsWrapper = header?.props.children.props.children[2];
    expect(actionsWrapper.props.children).toBe(Actions);
  });

  it('affiche le footer collé en bas avec la safe area', () => {
    const Footer = <footer>Mon Footer</footer>;
    const { footerContainer } = renderShellPure({ footer: Footer, children: 'Contenu' });
    
    expect(footerContainer).toBeTruthy();
    expect(footerContainer?.props.className).toContain('pb-[max(1rem,env(safe-area-inset-bottom))]');
    expect(footerContainer?.props.children).toBe(Footer);
  });

  it('définit un aria-label par défaut basé sur le titre (string)', () => {
    const { result } = renderShellPure({ title: 'Titre String', children: 'Contenu' });
    expect(result?.props['aria-label']).toBe('Titre String');
  });

  it('permet de surcharger ariaLabel et ariaDescribedBy', () => {
    const { result } = renderShellPure({ ariaLabel: 'Custom', ariaDescribedBy: 'desc-id', title: 'Ignoré', children: 'Contenu' });
    expect(result?.props['aria-label']).toBe('Custom');
    expect(result?.props['aria-describedby']).toBe('desc-id');
  });

  it('applique les classes de largeur en fonction de la prop size', () => {
    const { result: std } = renderShellPure({ size: 'standard', children: 'Contenu' });
    expect(std?.props.className).toContain('xl:w-[31.5rem]');

    const { result: wide } = renderShellPure({ size: 'wide', children: 'Contenu' });
    expect(wide?.props.className).toContain('xl:w-[36rem]');
  });
});

describe('PremiumDrawerActionSection', () => {
  it('rend correctement', () => {
    const result = PremiumDrawerActionSection({ children: 'Action', className: 'custom-class' }) as React.ReactElement;
    expect(result.type).toBe('div');
    expect(result.props.className).toContain('custom-class');
    expect(result.props.children).toBe('Action');
  });
});
