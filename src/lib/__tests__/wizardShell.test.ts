import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { WizardShell } from '../../components/ui/WizardShell';

// Mock React hooks to avoid "Invalid hook call" when calling components as pure functions in tests
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useId: () => 'test-id',
    useEffect: vi.fn((cb) => { cb(); }),
    useRef: () => ({ current: null }),
  };
});

describe('WizardShell', () => {
  it('ne rend rien si open est false', () => {
    const result = WizardShell({ open: false, title: "Test", children: React.createElement('div') });
    expect(result).toBeNull();
  });

  it('rend le title, la description et les children', () => {
    const children = React.createElement('div', { id: 'child' }, 'Contenu enfant');
    const result = WizardShell({
      open: true,
      title: "Mon Wizard",
      description: "Description test",
      children,
    }) as React.ReactElement;
    
    expect(result).toBeDefined();
    expect(result.props.role).toBe('dialog');
    
    // Le backdrop est le premier enfant, le panel est le second
    const panel = result.props.children[1];
    expect(panel.props.className).toContain('sm:max-w-[860px]'); // standard size by default
  });

  it('applique les classes de size', () => {
    const children = React.createElement('div');
    const resultSimple = WizardShell({ title: "T", size: "simple", children }) as React.ReactElement;
    const panelSimple = resultSimple.props.children[1];
    expect(panelSimple.props.className).toContain('sm:max-w-[720px]');

    const resultRich = WizardShell({ title: "T", size: "rich", children }) as React.ReactElement;
    const panelRich = resultRich.props.children[1];
    expect(panelRich.props.className).toContain('sm:max-w-[1040px]');
    
    const resultBusiness = WizardShell({ title: "T", size: "business", children }) as React.ReactElement;
    const panelBusiness = resultBusiness.props.children[1];
    expect(panelBusiness.props.className).toContain('sm:max-w-[1120px]');
  });

  it('rend le footer si fourni', () => {
    const footer = React.createElement('div', { id: 'footer-custom' }, 'Mon Footer');
    const result = WizardShell({ title: "T", children: React.createElement('div'), footer }) as React.ReactElement;
    
    const panel = result.props.children[1];
    // panel.children = [Handle, Header, Body, Footer]
    const renderedFooter = panel.props.children[3];
    expect(renderedFooter).toBeDefined();
    expect(renderedFooter.props.className).toContain('bottom-0');
  });

  it('rend primary et secondary actions dans le footer généré', () => {
    const primaryAction = React.createElement('button', null, 'Primary');
    const secondaryAction = React.createElement('button', null, 'Secondary');
    const result = WizardShell({ title: "T", children: React.createElement('div'), primaryAction, secondaryAction }) as React.ReactElement;
    
    const panel = result.props.children[1];
    const renderedFooter = panel.props.children[3];
    expect(renderedFooter).toBeDefined();
    // Le children du footer est une div flex contenant les actions
    const flexDiv = renderedFooter.props.children;
    expect(flexDiv.props.className).toContain('flex-col-reverse');
  });

  it('rend le bouton close et appelle onClose', () => {
    const onClose = vi.fn();
    const result = WizardShell({ title: "T", children: React.createElement('div'), onClose }) as React.ReactElement;
    
    const panel = result.props.children[1];
    const header = panel.props.children[1];
    // header.children = [TitleDiv, CloseButton]
    const headerTop = header.props.children[0]; // flex items-start justify-between
    const closeButton = headerTop.props.children[1];
    
    expect(closeButton).toBeDefined();
    expect(closeButton.type).toBe('button');
    closeButton.props.onClick();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
