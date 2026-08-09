import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const usersSource = source('../../pages/console/tabs/UsersAccessTab.tsx');
const billingSource = source('../../pages/console/tabs/BillingTab.tsx');
const supportSource = source('../../pages/console/tabs/SupportOpsTab.tsx');
const systemSource = source('../../pages/console/tabs/SystemConfigTab.tsx');
const serviceSource = source('../../services/admin/adminConsoleService.ts');
const shellSource = source('../../pages/console/ConsoleShell.tsx');
const primitivesSource = source('../../components/console/AdminPrimitives.tsx');
const organizationDrawerSource = source('../../components/console/OrganizationDrawer.tsx');
const userDrawerSource = source('../../components/console/UserAccessDrawer.tsx');
const paymentDrawerSource = source('../../components/console/PaymentValidationDrawer.tsx');
const requestDrawerSource = source('../../components/console/AgencyRequestReviewDrawer.tsx');

describe('console admin premium behavior', () => {
  it('keeps active and inactive account KPIs connected to real filters', () => {
    expect(usersSource).toContain("setStatus('active')");
    expect(usersSource).toContain("setStatus('inactive')");
    expect(usersSource).toContain('matchesStatus');
    expect(usersSource).toContain('statusOptions');
  });

  it('uses the plan cards to filter the subscription workspace', () => {
    expect(billingSource).toContain('setPlanFilter');
    expect(billingSource).toContain('visibleSubscriptions');
    expect(billingSource).toContain('aria-pressed={planFilter === plan.id}');
  });

  it('reuses searchable comboboxes for support operations', () => {
    expect(supportSource).toContain("import { SmartCombobox }");
    expect(supportSource.match(/<SmartCombobox/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it('does not claim unverified application or authentication health', () => {
    expect(systemSource).not.toContain("['Application', 'Opérationnelle'");
    expect(systemSource).not.toContain("['Authentification', 'Opérationnelle'");
    expect(systemSource).toContain('Indicateurs factuels issus des sources chargées');
  });

  it('fails visibly when both organization sources are unavailable', () => {
    expect(serviceSource).toContain('failedSources.has(0) && failedSources.has(1) && agencies.length === 0');
    expect(serviceSource).toContain('Les organisations ne peuvent pas être chargées');
    expect(serviceSource).toContain('inferAgenciesFromRelatedSources');
  });

  it('keeps the console usable when the consolidated RPC is temporarily unavailable', () => {
    expect(serviceSource).toContain("supabase.rpc('admin_console_snapshot')");
    expect(serviceSource).toContain('if (!snapshotResponse.error)');
    expect(serviceSource).not.toContain('La source de pilotage super-admin est indisponible');
    expect(serviceSource).toContain('const results = hasConsolidatedSnapshot');
  });

  it('keeps console tables and split drawers aligned with the compact application workspace', () => {
    expect(shellSource).toContain('size="compact"');
    expect(shellSource).not.toContain('size="wide"');
    expect(primitivesSource).toContain("text-[0.58rem] font-semibold uppercase");
    expect(primitivesSource).toContain("text-[0.72rem] font-medium");

    for (const drawerSource of [organizationDrawerSource, userDrawerSource, paymentDrawerSource, requestDrawerSource]) {
      expect(drawerSource).toContain('size="compact"');
      expect(drawerSource).toContain('density="compact"');
      expect(drawerSource).not.toContain('size="wide"');
      expect(drawerSource).not.toContain('size="standard"');
    }
  });
});
