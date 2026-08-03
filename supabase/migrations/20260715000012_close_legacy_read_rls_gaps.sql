-- =============================================================================
-- Pre-beta hardening: close tenant read gaps inherited from the original
-- single-agency schema. Core tenant policies from 20260506131514 are untouched.
-- =============================================================================

begin;

-- Audit entries are server-owned and inherit the tenant from the mutated row.
create or replace function public.log_table_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_record_id uuid;
  v_agency_id uuid;
begin
  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_row := coalesce(v_new, v_old);

  v_record_id := nullif(v_row ->> 'id', '')::uuid;
  v_agency_id := coalesce(
    nullif(v_row ->> 'agency_id', '')::uuid,
    public.current_user_agency_id()
  );

  if v_record_id is null or v_agency_id is null then
    raise exception 'AUDIT_TENANT_CONTEXT_REQUIRED' using errcode = '23514';
  end if;

  insert into public.audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    user_id,
    agency_id
  ) values (
    tg_table_name,
    v_record_id,
    tg_op,
    v_old,
    v_new,
    auth.uid(),
    v_agency_id
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.log_table_changes() from public, anon, authenticated;

-- Remove all inherited policies from the legacy tables. Their previous SELECT
-- rules checked the role but not always the organization.
do $$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'revenus',
    'depenses',
    'audit_logs',
    'event_log',
    'event_outbox',
    'job_queue'
  ] loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'Required table public.% is missing', v_table;
    end if;

    for v_policy in
      select policyname
        from pg_policies
       where schemaname = 'public'
         and tablename = v_table
    loop
      execute format('drop policy if exists %I on public.%I', v_policy.policyname, v_table);
    end loop;

    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
  end loop;
end;
$$;

create policy "depenses_tenant_finance_read"
  on public.depenses
  for select
  to authenticated
  using (
    public.is_super_admin()
    or (
      agency_id = public.current_user_agency_id()
      and public.get_user_role() in (
        'admin'::public.user_role,
        'comptable'::public.user_role
      )
    )
  );

-- revenus has no agency_id. Its parent payment is its tenant boundary.
-- Orphan historical rows remain visible only to a super-admin.
create policy "revenus_tenant_finance_read"
  on public.revenus
  for select
  to authenticated
  using (
    public.is_super_admin()
    or (
      public.get_user_role() in (
        'admin'::public.user_role,
        'comptable'::public.user_role
      )
      and exists (
        select 1
          from public.paiements p
         where p.id = revenus.paiement_id
           and p.agency_id = public.current_user_agency_id()
      )
    )
  );

create policy "audit_logs_tenant_admin_read"
  on public.audit_logs
  for select
  to authenticated
  using (
    public.is_super_admin()
    or (
      agency_id = public.current_user_agency_id()
      and public.is_admin()
    )
  );

create policy "event_log_tenant_admin_read"
  on public.event_log
  for select
  to authenticated
  using (
    public.is_super_admin()
    or (
      agency_id = public.current_user_agency_id()
      and public.is_admin()
    )
  );

-- System-wide events without a tenant are intentionally visible only to the
-- platform owner. Agency administrators can inspect their own event stream.
create policy "event_outbox_tenant_admin_read"
  on public.event_outbox
  for select
  to authenticated
  using (
    public.is_super_admin()
    or (
      agency_id = public.current_user_agency_id()
      and public.is_admin()
    )
  );

create policy "job_queue_tenant_admin_read"
  on public.job_queue
  for select
  to authenticated
  using (
    public.is_super_admin()
    or (
      agency_id = public.current_user_agency_id()
      and public.is_admin()
    )
  );

revoke all on table
  public.revenus,
  public.depenses,
  public.audit_logs,
  public.event_log,
  public.event_outbox,
  public.job_queue
from anon;
revoke insert, update, delete, truncate, references, trigger
  on table
    public.revenus,
    public.depenses,
    public.audit_logs,
    public.event_log,
    public.event_outbox,
    public.job_queue
  from authenticated;
grant select on table
  public.revenus,
  public.depenses,
  public.audit_logs,
  public.event_log,
  public.event_outbox,
  public.job_queue
to authenticated;
grant all on table
  public.revenus,
  public.depenses,
  public.audit_logs,
  public.event_log,
  public.event_outbox,
  public.job_queue
to service_role;

commit;
