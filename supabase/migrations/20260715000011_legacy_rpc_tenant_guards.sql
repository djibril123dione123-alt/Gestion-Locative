-- Close legacy RPC authorization gaps without changing their business output.
-- Browser clients retain tenant-scoped plan reads and receive admin-only,
-- audited wrappers for document maintenance.

begin;

create or replace function public.check_plan_limits(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  plan_record record;
  current_usage jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if p_agency_id is null
     or not (
       public.is_super_admin()
       or p_agency_id = public.current_user_agency_id()
     ) then
    raise exception 'TENANT_SCOPE_MISMATCH' using errcode = '42501';
  end if;

  select sp.*
    into plan_record
    from public.subscriptions s
    join public.subscription_plans sp on s.plan_id = sp.id
   where s.agency_id = p_agency_id
   order by
     case when s.status = 'active' then 0 when s.status = 'trial' then 1 else 2 end,
     s.created_at desc
   limit 1;

  if plan_record is null then
    select *
      into plan_record
      from public.subscription_plans
     where id = 'pro'
     limit 1;
  end if;

  select jsonb_build_object(
    'users', (select count(*) from public.user_profiles where agency_id = p_agency_id),
    'immeubles', (select count(*) from public.immeubles where agency_id = p_agency_id),
    'unites', (select count(*) from public.unites where agency_id = p_agency_id)
  ) into current_usage;

  if plan_record is null then
    return jsonb_build_object(
      'limits', jsonb_build_object(
        'max_users', 10,
        'max_immeubles', 50,
        'max_unites', 200
      ),
      'usage', current_usage,
      'can_add_user', true,
      'can_add_immeuble', true,
      'can_add_unite', true
    );
  end if;

  return jsonb_build_object(
    'limits', jsonb_build_object(
      'max_users', plan_record.max_users,
      'max_immeubles', plan_record.max_immeubles,
      'max_unites', plan_record.max_unites
    ),
    'usage', current_usage,
    'can_add_user', (current_usage->>'users')::integer < plan_record.max_users,
    'can_add_immeuble', (current_usage->>'immeubles')::integer < plan_record.max_immeubles,
    'can_add_unite', (current_usage->>'unites')::integer < plan_record.max_unites
  );
end;
$$;

revoke all on function public.check_plan_limits(uuid) from public, anon;
grant execute on function public.check_plan_limits(uuid) to authenticated;

create or replace function samay_tenant.assert_document_maintenance_admin(p_agency_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if p_agency_id is null then
    raise exception 'AGENCY_REQUIRED' using errcode = '22023';
  end if;

  if public.is_super_admin() then
    if not exists (select 1 from public.agencies where id = p_agency_id) then
      raise exception 'AGENCY_NOT_FOUND' using errcode = 'P0002';
    end if;
    return p_agency_id;
  end if;

  select up.agency_id
    into v_agency_id
    from public.user_profiles up
    join public.agencies a on a.id = up.agency_id
   where up.id = auth.uid()
     and up.agency_id = p_agency_id
     and up.role::text = 'admin'
     and coalesce(up.actif, true) = true
     and coalesce(a.status, 'active') in ('active', 'trial');

  if v_agency_id is null then
    raise exception 'DOCUMENT_MAINTENANCE_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  return v_agency_id;
end;
$$;

create or replace function public.tenant_mark_orphan_document_records(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_tenant, pg_temp
as $$
declare
  v_agency_id uuid := samay_tenant.assert_document_maintenance_admin(p_agency_id);
  v_result jsonb;
begin
  v_result := public.mark_orphan_document_records(v_agency_id);

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    v_agency_id, 'documents.maintenance.orphans_marked', 'agencies', v_agency_id,
    coalesce(v_result, '{}'::jsonb), auth.uid()
  );

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create or replace function public.tenant_cleanup_temporary_documents(
  p_agency_id uuid,
  p_older_than_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_tenant, pg_temp
as $$
declare
  v_agency_id uuid := samay_tenant.assert_document_maintenance_admin(p_agency_id);
  v_days integer := coalesce(p_older_than_days, 30);
  v_result jsonb;
begin
  if v_days not between 1 and 365 then
    raise exception 'DOCUMENT_RETENTION_WINDOW_INVALID' using errcode = '22023';
  end if;

  v_result := public.cleanup_temporary_documents(v_agency_id, v_days);

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    v_agency_id, 'documents.maintenance.temporary_cleaned', 'agencies', v_agency_id,
    coalesce(v_result, '{}'::jsonb) || jsonb_build_object('older_than_days', v_days),
    auth.uid()
  );

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create or replace function public.tenant_optimize_document_storage(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_tenant, pg_temp
as $$
declare
  v_agency_id uuid := samay_tenant.assert_document_maintenance_admin(p_agency_id);
  v_result jsonb;
begin
  v_result := public.optimize_document_storage(v_agency_id);

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    v_agency_id, 'documents.maintenance.optimized', 'agencies', v_agency_id,
    coalesce(v_result, '{}'::jsonb), auth.uid()
  );

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

-- The legacy functions remain callable by trusted server code and the guarded
-- wrappers above, but disappear from the authenticated REST/RPC surface.
revoke all on function public.archive_document_registry_duplicates(uuid) from public, anon, authenticated;
revoke all on function public.mark_expired_temporary_documents(uuid) from public, anon, authenticated;
revoke all on function public.mark_orphan_document_records(uuid) from public, anon, authenticated;
revoke all on function public.cleanup_temporary_documents(uuid, integer) from public, anon, authenticated;
revoke all on function public.optimize_document_storage(uuid) from public, anon, authenticated;

revoke all on function samay_tenant.assert_document_maintenance_admin(uuid) from public, anon, authenticated;
revoke all on function public.tenant_mark_orphan_document_records(uuid) from public, anon;
revoke all on function public.tenant_cleanup_temporary_documents(uuid, integer) from public, anon;
revoke all on function public.tenant_optimize_document_storage(uuid) from public, anon;

grant execute on function public.tenant_mark_orphan_document_records(uuid) to authenticated;
grant execute on function public.tenant_cleanup_temporary_documents(uuid, integer) to authenticated;
grant execute on function public.tenant_optimize_document_storage(uuid) to authenticated;

commit;
