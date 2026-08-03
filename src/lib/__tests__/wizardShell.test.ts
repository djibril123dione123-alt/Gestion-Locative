import { beforeAll, describe, it, expect, vi } from 'vitest';
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

vi.mock('react-dom', () => ({
  createPortal: (node: React.ReactNode) => node,
}));

beforeAll(() => {
  vi.stubGlobal('document', { body: {} });
});

function findElement(
  node: React.ReactNode,
  predicate: (element: React.ReactElement) => boolean,
): React.ReactElement | undefined {
  if (!React.isValidElement(node)) return undefined;
  if (predicate(node)) return node;

  for (const child of React.Children.toArray(node.props.children)) {
    const match = findElement(child, predicate);
    if (match) return match;
  }

  return undefined;
}

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
    const resultSimple = WizardShell({ open: true, title: "T", size: "simple", children }) as React.ReactElement;
    const panelSimple = resultSimple.props.children[1];
    expect(panelSimple.props.className).toContain('sm:max-w-[720px]');

    const resultRich = WizardShell({ open: true, title: "T", size: "rich", children }) as React.ReactElement;
    const panelRich = resultRich.props.children[1];
    expect(panelRich.props.className).toContain('sm:max-w-[1040px]');
    
    const resultBusiness = WizardShell({ open: true, title: "T", size: "business", children }) as React.ReactElement;
    const panelBusiness = resultBusiness.props.children[1];
    expect(panelBusiness.props.className).toContain('sm:max-w-[1120px]');
  });

  it('rend le footer si fourni', () => {
    const footer = React.createElement('div', { id: 'footer-custom' }, 'Mon Footer');
    const result = WizardShell({ open: true, title: "T", children: React.createElement('div'), footer }) as React.ReactElement;
    
    const renderedFooter = findElement(result, (element) => element.props.id === 'footer-custom');
    expect(renderedFooter).toBeDefined();
    expect(renderedFooter?.props.children).toBe('Mon Footer');
  });

  it('rend primary et secondary actions dans le footer généré', () => {
    const primaryAction = React.createElement('button', null, 'Primary');
    const secondaryAction = React.createElement('button', null, 'Secondary');
    const result = WizardShell({ open: true, title: "T", children: React.createElement('div'), primaryAction, secondaryAction }) as React.ReactElement;
    
    const renderedPrimary = findElement(result, (element) => element.type === 'button' && element.props.children === 'Primary');
    const renderedSecondary = findElement(result, (element) => element.type === 'button' && element.props.children === 'Secondary');
    expect(renderedPrimary).toBeDefined();
    expect(renderedSecondary).toBeDefined();
  });

  it('rend le bouton close et appelle onClose', () => {
    const onClose = vi.fn();
    const result = WizardShell({ open: true, title: "T", children: React.createElement('div'), onClose }) as React.ReactElement;
    
    const closeButton = findElement(result, (element) => element.type === 'button' && element.props['aria-label'] === 'Fermer');
    expect(closeButton).toBeDefined();
    closeButton?.props.onClick();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
