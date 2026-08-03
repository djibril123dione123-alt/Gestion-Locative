import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationSource = readFileSync(
  new URL('../../../supabase/migrations/20260715000012_close_legacy_read_rls_gaps.sql', import.meta.url),
  'utf8',
);
const trackingSource = readFileSync(new URL('../../hooks/useTracking.ts', import.meta.url), 'utf8');

describe('legacy tenant isolation hardening', () => {
  it('forces RLS and scopes every inherited read policy to the tenant', () => {
    for (const table of [
      'revenus',
      'depenses',
      'audit_logs',
      'event_log',
      'event_outbox',
      'job_queue',
    ]) {
      expect(migrationSource).toContain(`'${table}'`);
    }
    expect(migrationSource).toContain("alter table public.%I force row level security");
    expect(migrationSource).toContain('depenses_tenant_finance_read');
    expect(migrationSource).toContain('revenus_tenant_finance_read');
    expect(migrationSource).toContain('audit_logs_tenant_admin_read');
    expect(migrationSource).toContain('event_log_tenant_admin_read');
    expect(migrationSource).toContain('event_outbox_tenant_admin_read');
    expect(migrationSource).toContain('job_queue_tenant_admin_read');
    expect(migrationSource).toContain('public.current_user_agency_id()');
  });

  it('requires a tenant before a business audit entry can be written', () => {
    expect(migrationSource).toContain('AUDIT_TENANT_CONTEXT_REQUIRED');
    expect(migrationSource).toContain("nullif(v_row ->> 'agency_id', '')::uuid");
    expect(migrationSource).toContain('revoke all on function public.log_table_changes() from public, anon, authenticated');
  });

  it('does not let browser analytics write directly into the business audit ledger', () => {
    expect(trackingSource).not.toContain("from('audit_logs')");
    expect(trackingSource).toContain('trackEvent');
  });

  it('fails closed when the canonical admin audit RPC is unavailable', () => {
    const adminAuditSource = readFileSync(
      new URL('../../services/admin/adminAuditService.ts', import.meta.url),
      'utf8',
    );

    expect(adminAuditSource).toContain("supabase.rpc('admin_audit_action'");
    expect(adminAuditSource).not.toContain("from('owner_actions_log').insert");
    expect(adminAuditSource).toContain("L'action a été bloquée");
  });
});
