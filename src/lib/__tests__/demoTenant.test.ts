import { describe, expect, it } from 'vitest';

import { OFFICIAL_DEMO_TENANT_ID, isOfficialDemoTenant } from '../demoTenant';

describe('official demo tenant', () => {
  it('recognizes only the canonical tenant identity', () => {
    expect(isOfficialDemoTenant(OFFICIAL_DEMO_TENANT_ID)).toBe(true);
    expect(isOfficialDemoTenant(`  ${OFFICIAL_DEMO_TENANT_ID.toUpperCase()}  `)).toBe(true);
    expect(isOfficialDemoTenant('d3e00000-0000-4000-8000-000000000002')).toBe(false);
  });

  it('does not infer the tenant from an agency name or missing identity', () => {
    expect(isOfficialDemoTenant('Teranga Gestion Immobiliere')).toBe(false);
    expect(isOfficialDemoTenant(null)).toBe(false);
    expect(isOfficialDemoTenant(undefined)).toBe(false);
  });
});
