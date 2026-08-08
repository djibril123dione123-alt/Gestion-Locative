import { describe, expect, it } from 'vitest';

import { isPresentationMode } from '../presentationMode';

describe('presentationMode', () => {
  it('active le mode depuis la recherche de la route ou de la page', () => {
    expect(isPresentationMode('?presentation=1')).toBe(true);
    expect(isPresentationMode('?section=documents', '?presentation=true')).toBe(true);
    expect(isPresentationMode('?presentation=on&section=overview')).toBe(true);
  });

  it('reste inactif sans activation explicite', () => {
    expect(isPresentationMode()).toBe(false);
    expect(isPresentationMode('?presentation=0')).toBe(false);
    expect(isPresentationMode('?presentation=false')).toBe(false);
    expect(isPresentationMode('?section=overview')).toBe(false);
  });
});
