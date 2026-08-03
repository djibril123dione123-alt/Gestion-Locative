import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');

describe('legacy admin route isolation', () => {
  it('does not render the legacy Agences page from the tenant application shell', () => {
    expect(appSource).not.toContain("import('./pages/Agences')");
    expect(appSource).not.toContain("case 'agences'");
  });

  it('routes super administrators into the dedicated console before tenant rendering', () => {
    expect(appSource).toContain("if (profile?.role === 'super_admin')");
    expect(appSource).toContain('<Console />');
  });
});
