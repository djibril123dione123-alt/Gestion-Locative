export const OFFICIAL_DEMO_TENANT_ID = 'd3e00000-0000-4000-8000-000000000001';

export function isOfficialDemoTenant(tenantId: string | null | undefined): boolean {
  return tenantId?.trim().toLowerCase() === OFFICIAL_DEMO_TENANT_ID;
}
