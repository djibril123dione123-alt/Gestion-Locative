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
});
