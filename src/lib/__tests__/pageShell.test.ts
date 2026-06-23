import React from 'react';
import { describe, it, expect } from 'vitest';
import { PageShell } from '../../components/ui/PageShell';

describe('PageShell', () => {
  it('renders children correctly', () => {
    const children = React.createElement('div', { 'data-testid': 'child' }, 'Test Child');
    const result = PageShell({ children }) as React.ReactElement;
    
    expect(result.props.children).toBe(children);
  });

  it('preserves custom className', () => {
    const children = React.createElement('div', null, 'Content');
    const result = PageShell({ children, className: 'custom-test-class' }) as React.ReactElement;
    
    expect(result.props.className).toContain('custom-test-class');
    expect(result.props.className).toContain('flex flex-col w-full');
  });

  it('applies standard spacing by default', () => {
    const children = React.createElement('div', null, 'Content');
    const result = PageShell({ children }) as React.ReactElement;
    
    expect(result.props.className).toContain('space-y-5 sm:space-y-6');
  });

  it('applies compact spacing', () => {
    const children = React.createElement('div', null, 'Content');
    const result = PageShell({ children, spacing: 'compact' }) as React.ReactElement;
    
    expect(result.props.className).toContain('space-y-4');
  });

  it('applies relaxed spacing', () => {
    const children = React.createElement('div', null, 'Content');
    const result = PageShell({ children, spacing: 'relaxed' }) as React.ReactElement;
    
    expect(result.props.className).toContain('space-y-6 lg:space-y-8');
  });

  it('renders as section with aria-label when provided', () => {
    const children = React.createElement('div', null, 'Content');
    const result = PageShell({ children, ariaLabel: 'Test Label' }) as React.ReactElement;
    
    expect(result.type).toBe('section');
    expect(result.props['aria-label']).toBe('Test Label');
  });

  it('renders as div when aria-label is not provided', () => {
    const children = React.createElement('div', null, 'Content');
    const result = PageShell({ children }) as React.ReactElement;
    
    expect(result.type).toBe('div');
  });

  it('should not contain forbidden padding classes by default', () => {
    const children = React.createElement('div', null, 'Content');
    const result = PageShell({ children }) as React.ReactElement;
    
    expect(result.props.className).not.toMatch(/\bpx-6\b/);
    expect(result.props.className).not.toMatch(/\bmax-w-\[110rem\]\b/);
    expect(result.props.className).not.toMatch(/\bmx-auto\b/);
  });
});
