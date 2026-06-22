import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { Table, type TableColumn } from '../../components/ui/Table';

describe('Table', () => {
  interface TestItem {
    id: string;
    name: string;
    amount: number;
  }

  const columns: TableColumn<TestItem>[] = [
    { key: 'name', label: 'Name' },
    { key: 'amount', label: 'Amount', align: 'right', visibility: 'desktop', icon: React.createElement('svg', { 'data-testid': 'icon' }) }
  ];

  const data: TestItem[] = [
    { id: '1', name: 'Item 1', amount: 100 },
    { id: '2', name: 'Item 2', amount: 200 }
  ];

  // Cast Table pour éviter les soucis d'inférence avec React.createElement
  const TestTable = Table as unknown as React.FC<{
    columns: TableColumn<TestItem>[];
    data: TestItem[];
    selectedId?: string | null;
    onRowClick?: (item: TestItem) => void;
    mobileRender?: (item: TestItem) => React.ReactNode;
  }>;

  it('ne crash pas avec l API legacy', () => {
    const element = React.createElement(TestTable, { columns, data });
    expect(element.type).toBe(TestTable);
  });

  it('rend les headers et cellules avec align et visibility', () => {
    const result = TestTable({ columns, data }) as React.ReactElement;
    expect(result).toBeDefined();

    // Pour inspecter le retour, c'est un Fragment `<>` contenant le rendu mobile et le rendu desktop.
    // On extrait le rendu desktop : index 1 du Fragment children (le premier est le mobile)
    const children = result.props.children;
    expect(children).toHaveLength(2);

    const desktopWrapper = children[1];
    expect(desktopWrapper.props.className).toContain('@container sk-table-shell hidden sm:block');
    
    const tableElement = desktopWrapper.props.children.props.children;
    const thead = tableElement.props.children[0];
    const tbody = tableElement.props.children[1];

    // Vérification headers
    const headerRow = thead.props.children.props.children;
    const firstHeader = headerRow[0][0]; // map retourne un tableau
    const secondHeader = headerRow[0][1];

    expect(firstHeader.props.className).toContain('text-left'); // default align
    expect(secondHeader.props.className).toContain('text-right'); // align right
    expect(secondHeader.props.className).toContain('hidden lg:table-cell'); // visibility desktop

    // Vérification icône (présente dans le deuxième header)
    const iconContainer = secondHeader.props.children.props.children[0];
    expect(iconContainer).toBeTruthy(); // L'icône doit être présente

    // Vérification cellules (premier row)
    const firstRow = tbody.props.children[0];
    const cells = firstRow.props.children;
    
    const firstCell = cells[0][0];
    const secondCell = cells[0][1];

    expect(firstCell.props.className).toContain('text-left');
    expect(secondCell.props.className).toContain('text-right');
    expect(secondCell.props.className).toContain('hidden lg:table-cell');
  });

  it('garde une classe sélectionnée pour selectedId', () => {
    const result = TestTable({ columns, data, selectedId: '2' }) as React.ReactElement;
    const desktopWrapper = result.props.children[1];
    const tbody = desktopWrapper.props.children.props.children.props.children[1];
    
    const firstRow = tbody.props.children[0];
    const secondRow = tbody.props.children[1];

    expect(firstRow.props.className).not.toContain('bg-emerald-50/60 relative z-0');
    expect(secondRow.props.className).toContain('bg-emerald-50/60 relative z-0');
  });

  it('onRowClick fonctionne', () => {
    const handleClick = vi.fn();
    const result = TestTable({ columns, data, onRowClick: handleClick }) as React.ReactElement;
    const desktopWrapper = result.props.children[1];
    const tbody = desktopWrapper.props.children.props.children.props.children[1];
    const firstRow = tbody.props.children[0];
    
    // Simulate click
    firstRow.props.onClick();
    expect(handleClick).toHaveBeenCalledWith(data[0]);
  });

  it('mobileRender reste supporté', () => {
    const mobileRender = (item: TestItem) => React.createElement('div', { className: 'custom-mobile' }, item.name);
    const result = TestTable({ columns, data, mobileRender }) as React.ReactElement;
    
    const mobileWrapper = result.props.children[0];
    expect(mobileWrapper.props.className).toBe('space-y-3 sm:hidden');
    
    const firstMobileCard = mobileWrapper.props.children[0];
    const customContent = firstMobileCard.props.children;
    
    expect(customContent.props.className).toBe('custom-mobile');
    expect(customContent.props.children).toBe('Item 1');
  });
});
