-- Account closure is a controlled access revocation, never a destructive purge.
-- Financial, contractual, documentary and audit records remain available to
-- service-role operators for legal retention, reconciliation and restoration.

alter table public.agencies
  add column if not exists closed_at timestamptz,
  add column if not exists closure_reason text,
  add column if not exists closure_report_id uuid;

create schema if not exists samay_admin;

create table if not exists samay_admin.account_closure_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  organization_name text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  previous_status text,
  previous_plan text,
  reason text not null check (char_length(trim(reason)) >= 12),
  status text not null default 'auth_cleanup_pending'
    check (status in ('auth_cleanup_pending', 'completed', 'partial')),
  revoked_user_ids uuid[] not null default '{}'::uuid[],
  data_counts jsonb not null default '{}'::jsonb,
  retained_data jsonb not null default '{}'::jsonb,
  removed_data jsonb not null default '{}'::jsonb,
  auth_cleanup jsonb not null default '{}'::jsonb,
  storage_cleanup jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_account_closure_reports_org_created
  on samay_admin.account_closure_reports (organization_id, created_at desc);

alter table samay_admin.account_closure_reports enable row level security;
alter table samay_admin.account_closure_reports force row level security;
revoke all on table samay_admin.account_closure_reports from public, anon, authenticated;
grant all on table samay_admin.account_closure_reports to service_role;
grant select on table samay_admin.account_closure_reports to authenticated;

drop policy if exists "account_closure_reports_super_admin_read"
  on samay_admin.account_closure_reports;
create policy "account_closure_reports_super_admin_read"
  on samay_admin.account_closure_reports
  for select
  to authenticated
  using (public.is_super_admin());

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'agencies_closure_report_id_fkey'
       and conrelid = 'public.agencies'::regclass
  ) then
    alter table public.agencies
      add constraint agencies_closure_report_id_fkey
      foreign key (closure_report_id)
      references samay_admin.account_closure_reports(id)
      on delete set null;
  end if;
end;
$$;

create or replace function samay_admin.count_agency_rows(
  p_table regclass,
  p_agency_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count bigint := 0;
  v_schema text;
  v_table text;
begin
  select n.nspname, c.relname
    into v_schema, v_table
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where c.oid = p_table;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = v_schema
       and table_name = v_table
       and column_name = 'agency_id'
  ) then
    return 0;
  end if;

  execute format('select count(*) from %s where agency_id = $1', p_table)
    into v_count
    using p_agency_id;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function samay_admin.count_agency_rows(regclass, uuid)
  from public, anon, authenticated;

-- The legacy purge deliberately bypassed ledger immutability. It must no
-- longer be callable by browser sessions or ordinary service integrations.
revoke all on function public.delete_agency_cascade(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.admin_delete_agency(
  p_agency_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  v_request jsonb;
  v_replay jsonb;
  v_result jsonb;
  v_agency public.agencies%rowtype;
  v_actor_email text;
  v_actor_agency_id uuid;
  v_revoked_user_ids uuid[] := '{}'::uuid[];
  v_counts jsonb := '{}'::jsonb;
  v_report_id uuid;
  v_table text;
  v_count bigint;
begin
  if p_agency_id is null then
    raise exception 'ADMIN_AGENCY_ID_REQUIRED' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 12 then
    raise exception 'ADMIN_REASON_TOO_SHORT' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'agency_id', p_agency_id,
    'reason', trim(p_reason),
    'operation', 'account_closure'
  );
  v_replay := samay_admin.command_replay(
    'admin_delete_agency', p_idempotency_key, v_request
  );
  if v_replay is not null then return v_replay; end if;

  select * into v_agency
    from public.agencies
   where id = p_agency_id
   for update;
  if not found then
    raise exception 'ADMIN_AGENCY_NOT_FOUND' using errcode = 'P0002';
  end if;

  select email, agency_id
    into v_actor_email, v_actor_agency_id
    from public.user_profiles
   where id = auth.uid()
     and role = 'super_admin'
     and coalesce(actif, true) = true;
  if not found or v_actor_agency_id = p_agency_id then
    raise exception 'ADMIN_CANNOT_CLOSE_OWN_TENANT' using errcode = '42501';
  end if;

  select coalesce(array_agg(id order by id), '{}'::uuid[])
    into v_revoked_user_ids
    from public.user_profiles
   where agency_id = p_agency_id
     and role <> 'super_admin';

  foreach v_table in array array[
    'user_profiles', 'bailleurs', 'immeubles', 'unites', 'locataires',
    'contrats', 'paiements', 'revenus', 'depenses', 'financial_ledger',
    'documents', 'document_registry', 'financial_document_snapshots'
  ]
  loop
    if to_regclass('public.' || v_table) is not null then
      v_count := samay_admin.count_agency_rows(
        to_regclass('public.' || v_table), p_agency_id
      );
      v_counts := v_counts || jsonb_build_object(v_table, v_count);
    end if;
  end loop;

  insert into samay_admin.account_closure_reports (
    organization_id,
    organization_name,
    actor_user_id,
    actor_email,
    previous_status,
    previous_plan,
    reason,
    revoked_user_ids,
    data_counts,
    retained_data,
    removed_data
  ) values (
    p_agency_id,
    v_agency.name,
    auth.uid(),
    v_actor_email,
    v_agency.status,
    v_agency.plan,
    trim(p_reason),
    v_revoked_user_ids,
    v_counts,
    jsonb_build_object(
      'financial_ledger', true,
      'payments', true,
      'contracts', true,
      'expenses', true,
      'documents', true,
      'document_registry', true,
      'financial_snapshots', true,
      'audit_logs', true
    ),
    jsonb_build_object(
      'page_permissions', true,
      'notifications', true,
      'identity_assets_pending', true,
      'financial_or_legal_records', false
    )
  )
  returning id into v_report_id;

  perform set_config('samay.admin_command', 'on', true);

  update public.agencies
     set status = 'cancelled',
         trial_ends_at = null,
         closed_at = now(),
         closure_reason = trim(p_reason),
         closure_report_id = v_report_id,
         updated_at = now()
   where id = p_agency_id;

  update public.invitations
     set status = 'expired', expires_at = least(coalesce(expires_at, now()), now())
   where agency_id = p_agency_id
     and status = 'pending';

  delete from public.user_page_permissions
   where agency_id = p_agency_id;

  delete from public.notifications
   where agency_id = p_agency_id;

  update public.user_profiles
     set actif = false,
         agency_id = null
   where agency_id = p_agency_id
     and role <> 'super_admin';

  update public.subscriptions
     set status = 'cancelled',
         cancel_at_period_end = true,
         current_period_end = least(coalesce(current_period_end, now()), now()),
         updated_at = now()
   where agency_id = p_agency_id;

  update public.document_verifications
     set document_status = 'revoked',
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'revoked_by_account_closure', true,
           'closure_report_id', v_report_id,
           'revoked_at', now()
         )
   where agency_id = p_agency_id
     and document_status = 'authentic';

  perform public.admin_audit_action(
    'organization_closed',
    trim(p_reason),
    p_agency_id,
    null,
    jsonb_build_object(
      'closure_report_id', v_report_id,
      'revoked_user_ids', v_revoked_user_ids,
      'data_counts', v_counts,
      'retention_mode', 'financial_and_legal_records_preserved',
      'idempotency_key', p_idempotency_key
    )
  );

  if to_regclass('public.owner_actions_log') is not null then
    insert into public.owner_actions_log (
      actor_id, actor_email, action, target_type, target_id, target_label, details
    ) values (
      auth.uid(), v_actor_email, 'organization_closed', 'agency',
      p_agency_id, v_agency.name,
      jsonb_build_object(
        'reason', trim(p_reason),
        'closure_report_id', v_report_id,
        'data_counts', v_counts
      )
    );
  end if;

  v_result := jsonb_build_object(
    'agency_id', p_agency_id,
    'organization_name', v_agency.name,
    'closure_report_id', v_report_id,
    'status', 'auth_cleanup_pending',
    'revoked_user_ids', v_revoked_user_ids,
    'data_counts', v_counts,
    'retained', jsonb_build_array(
      'financial_ledger', 'payments', 'contracts', 'expenses',
      'documents', 'document_registry', 'financial_snapshots', 'audit_logs'
    ),
    'idempotency_key', p_idempotency_key
  );
  return samay_admin.command_complete(p_idempotency_key, v_result);
end;
$$;

revoke all on function public.admin_delete_agency(uuid, text, text)
  from public, anon;
grant execute on function public.admin_delete_agency(uuid, text, text)
  to authenticated;

create or replace function public.admin_finalize_agency_closure(
  p_report_id uuid,
  p_auth_cleanup jsonb,
  p_storage_cleanup jsonb,
  p_completed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  v_report samay_admin.account_closure_reports%rowtype;
begin
  select * into v_report
    from samay_admin.account_closure_reports
   where id = p_report_id
   for update;
  if not found then
    raise exception 'ACCOUNT_CLOSURE_REPORT_NOT_FOUND' using errcode = 'P0002';
  end if;

  update samay_admin.account_closure_reports
     set auth_cleanup = coalesce(p_auth_cleanup, '{}'::jsonb),
         storage_cleanup = coalesce(p_storage_cleanup, '{}'::jsonb),
         status = case when p_completed then 'completed' else 'partial' end,
         completed_at = now()
   where id = p_report_id;

  return jsonb_build_object(
    'closure_report_id', p_report_id,
    'agency_id', v_report.organization_id,
    'status', case when p_completed then 'completed' else 'partial' end
  );
end;
$$;

revoke all on function public.admin_finalize_agency_closure(uuid, jsonb, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_finalize_agency_closure(uuid, jsonb, jsonb, boolean)
  to service_role;

comment on table samay_admin.account_closure_reports is
  'Auditable account-closure evidence. Financial and legal records are retained; access and identity assets are revoked.';
comment on function public.admin_delete_agency(uuid, text, text) is
  'Compatibility command whose semantics are safe account closure, not tenant data deletion.';
