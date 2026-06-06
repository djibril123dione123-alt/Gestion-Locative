-- Secure super-admin agency deletion.
-- This RPC centralizes destructive tenant cleanup in one audited transaction.

create or replace function public.delete_agency_cascade(
  p_agency_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, storage, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_email text;
  v_actor_role text;
  v_agency_name text;
  v_agency_status text;
  v_agency_plan text;
  v_table text;
  v_column text;
  v_has_updated_at boolean := false;
  v_deleted integer := 0;
  v_storage_deleted integer := 0;
  v_requests_detached integer := 0;
  v_deleted_counts jsonb := '{}'::jsonb;
  v_ledger_rule_disabled boolean := false;
begin
  if p_agency_id is null then
    raise exception 'Agency id is required' using errcode = '22023';
  end if;

  if v_actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select email, role::text
    into v_actor_email, v_actor_role
  from public.user_profiles
  where id = v_actor_id
  limit 1;

  if not public.is_super_admin() then
    raise exception 'Super admin access required' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 12 then
    raise exception 'A deletion reason of at least 12 characters is required' using errcode = '22023';
  end if;

  select name, status::text, plan::text
    into v_agency_name, v_agency_status, v_agency_plan
  from public.agencies
  where id = p_agency_id
  for update;

  if v_agency_name is null then
    raise exception 'Agency not found' using errcode = '02000';
  end if;

  if exists (
    select 1
    from public.user_profiles
    where id = v_actor_id
      and agency_id = p_agency_id
  ) then
    raise exception 'A super admin cannot delete the organization attached to their own profile from this console' using errcode = '42501';
  end if;

  if to_regclass('samay_admin.admin_audit_logs') is not null then
    insert into samay_admin.admin_audit_logs (
      actor_user_id,
      actor_role,
      target_organization_id,
      action,
      reason,
      metadata
    )
    values (
      v_actor_id,
      v_actor_role,
      p_agency_id,
      'organization_delete_cascade_requested',
      trim(p_reason),
      jsonb_build_object(
        'agency_id', p_agency_id,
        'agency_name', v_agency_name,
        'previous_status', v_agency_status,
        'previous_plan', v_agency_plan,
        'actor_email', v_actor_email
      )
    );
  end if;

  if to_regclass('public.owner_actions_log') is not null then
    insert into public.owner_actions_log (
      actor_id,
      actor_email,
      action,
      target_type,
      target_id,
      target_label,
      details
    )
    values (
      v_actor_id,
      v_actor_email,
      'organization_deleted',
      'agency',
      p_agency_id,
      v_agency_name,
      jsonb_build_object(
        'reason', trim(p_reason),
        'cascade_rpc', true,
        'previous_status', v_agency_status,
        'previous_plan', v_agency_plan
      )
    );
  end if;

  -- Ledger rows are intentionally immutable for normal users. A tenant deletion
  -- by a super-admin is an exceptional administrative cleanup, so the immutable
  -- delete rule is disabled only inside this audited transaction.
  if exists (
    select 1
    from pg_rules
    where schemaname = 'public'
      and tablename = 'ledger_entries'
      and rulename = 'ledger_no_delete'
  ) then
    execute 'alter table public.ledger_entries disable rule ledger_no_delete';
    v_ledger_rule_disabled := true;
  end if;

  if to_regclass('public.document_verifications') is not null then
    update public.document_verifications
    set
      document_status = 'revoked',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'revoked_reason', 'agency_deleted',
        'revoked_at', now()
      )
    where agency_id = p_agency_id;
    get diagnostics v_deleted = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('document_verifications_revoked', v_deleted);
  end if;

  if to_regclass('public.agency_creation_requests') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'agency_creation_requests'
        and column_name = 'created_agency_id'
    ) then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'agency_creation_requests'
        and column_name = 'updated_at'
    ) into v_has_updated_at;

    if v_has_updated_at then
      update public.agency_creation_requests
      set created_agency_id = null,
          updated_at = now()
      where created_agency_id = p_agency_id;
    else
      update public.agency_creation_requests
      set created_agency_id = null
      where created_agency_id = p_agency_id;
    end if;
    get diagnostics v_requests_detached = row_count;
  end if;

  foreach v_table in array array[
    'notification_queue',
    'payment_transactions',
    'document_verifications',
    'document_registry',
    'documents',
    'inventaires',
    'interventions',
    'evenements',
    'bilans_mensuels',
    'financial_snapshots',
    'kpi_daily',
    'kpi_monthly',
    'agency_cohort',
    'event_outbox',
    'event_log',
    'ledger_entries',
    'revenus',
    'commissions',
    'depenses',
    'paiements',
    'contrats',
    'locataires',
    'unites',
    'immeubles',
    'bailleurs',
    'notifications',
    'invitations',
    'user_page_permissions',
    'subscriptions',
    'agency_settings',
    'user_profiles'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is not null
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = v_table
          and column_name = 'agency_id'
      ) then
      execute format('delete from public.%I where agency_id = $1', v_table) using p_agency_id;
      get diagnostics v_deleted = row_count;
      v_deleted_counts := v_deleted_counts || jsonb_build_object(v_table, v_deleted);
    end if;
  end loop;

  -- Safety net for newer public tables that may have been added after this RPC.
  for v_table in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'agency_id'
      and t.table_type = 'BASE TABLE'
      and c.table_name <> 'agencies'
  loop
    execute format('delete from public.%I where agency_id = $1', v_table) using p_agency_id;
    get diagnostics v_deleted = row_count;
    if v_deleted > 0 then
      v_deleted_counts := v_deleted_counts || jsonb_build_object('public.' || v_table, v_deleted);
    end if;
  end loop;

  for v_table, v_column in
    select *
    from (values
      ('organization_metrics', 'organization_id'),
      ('document_metrics', 'organization_id'),
      ('admin_notifications', 'target_organization_id'),
      ('impersonation_sessions', 'target_organization_id'),
      ('support_tickets', 'organization_id'),
      ('incidents', 'organization_id'),
      ('system_events', 'organization_id'),
      ('admin_notes', 'organization_id')
    ) as admin_tables(table_name, column_name)
  loop
    if to_regclass(format('samay_admin.%I', v_table)) is not null
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'samay_admin'
          and table_name = v_table
          and column_name = v_column
      ) then
      execute format('delete from samay_admin.%I where %I = $1', v_table, v_column) using p_agency_id;
      get diagnostics v_deleted = row_count;
      v_deleted_counts := v_deleted_counts || jsonb_build_object('samay_admin.' || v_table, v_deleted);
    end if;
  end loop;

  if to_regclass('samay_admin.feature_flag_targets') is not null then
    delete from samay_admin.feature_flag_targets
    where target_type = 'organization'
      and target_id = p_agency_id::text;
    get diagnostics v_deleted = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('samay_admin.feature_flag_targets', v_deleted);
  end if;

  if to_regclass('storage.objects') is not null then
    delete from storage.objects
    where bucket_id in ('documents', 'agency-assets', 'logos', 'avatars')
      and (
        name like ('agencies/' || p_agency_id::text || '/%')
        or name like (p_agency_id::text || '/%')
      );
    get diagnostics v_storage_deleted = row_count;
  end if;

  delete from public.agencies
  where id = p_agency_id;
  get diagnostics v_deleted = row_count;

  if v_deleted <> 1 then
    raise exception 'Agency deletion failed' using errcode = 'P0002';
  end if;

  if v_ledger_rule_disabled then
    execute 'alter table public.ledger_entries enable rule ledger_no_delete';
  end if;

  return jsonb_build_object(
    'success', true,
    'agency_id', p_agency_id,
    'agency_name', v_agency_name,
    'auth_users_deleted', false,
    'user_profiles_deleted', coalesce((v_deleted_counts ->> 'user_profiles')::integer, 0),
    'agency_creation_requests_detached', v_requests_detached,
    'storage_objects_deleted', v_storage_deleted,
    'deleted', v_deleted_counts
  );
exception
  when others then
    if v_ledger_rule_disabled then
      begin
        execute 'alter table public.ledger_entries enable rule ledger_no_delete';
      exception when others then
        null;
      end;
    end if;
    raise;
end;
$$;

revoke all on function public.delete_agency_cascade(uuid, text) from public, anon;
grant execute on function public.delete_agency_cascade(uuid, text) to authenticated;

comment on function public.delete_agency_cascade(uuid, text)
is 'Super-admin-only audited tenant deletion. Deletes business data, access profiles, GED registry, verification entries, and best-effort storage objects for one agency.';
