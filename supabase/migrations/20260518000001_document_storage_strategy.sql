-- Document storage strategy: GED metadata, quotas, usage analytics and lifecycle.
-- SQL only. Edge Functions must be deployed separately.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,
  array[
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.document_storage_agency_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, storage, pg_temp
as $$
declare
  parts text[];
begin
  parts := storage.foldername(object_name);

  if array_length(parts, 1) >= 2 and parts[1] = 'agencies' then
    if parts[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return parts[2]::uuid;
    end if;
    return null;
  end if;

  return null;
end;
$$;

grant execute on function public.document_storage_agency_id(text) to authenticated;

drop policy if exists "documents_select_own_agency" on storage.objects;
drop policy if exists "documents_insert_own_agency" on storage.objects;
drop policy if exists "documents_update_own_agency" on storage.objects;
drop policy if exists "documents_delete_own_agency" on storage.objects;

create policy "documents_select_own_agency"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or public.document_storage_agency_id(name) = public.current_user_agency_id()
    )
  );

create policy "documents_insert_own_agency"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and public.document_storage_agency_id(name) = public.current_user_agency_id()
  );

create policy "documents_update_own_agency"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and public.document_storage_agency_id(name) = public.current_user_agency_id()
  )
  with check (
    bucket_id = 'documents'
    and public.document_storage_agency_id(name) = public.current_user_agency_id()
  );

create policy "documents_delete_own_agency"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or public.document_storage_agency_id(name) = public.current_user_agency_id()
    )
  );

alter table public.documents
  add column if not exists document_scope text not null default 'user_uploaded',
  add column if not exists document_category text not null default 'administratif',
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists storage_path text,
  add column if not exists file_hash text,
  add column if not exists version integer not null default 1,
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists retention_policy text not null default 'standard',
  add column if not exists description text,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists last_accessed_at timestamptz,
  add column if not exists updated_at timestamptz default now();

update public.documents
set
  storage_path = coalesce(storage_path, file_url),
  document_scope = coalesce(nullif(document_scope, ''), 'user_uploaded'),
  document_category = coalesce(nullif(document_category, ''), coalesce(nullif(folder, ''), 'administratif')),
  lifecycle_status = coalesce(nullif(lifecycle_status, ''), 'active'),
  retention_policy = coalesce(nullif(retention_policy, ''), 'standard')
where storage_path is null
   or document_scope is null
   or document_category is null
   or lifecycle_status is null
   or retention_policy is null;

alter table public.documents drop constraint if exists documents_scope_check;
alter table public.documents
  add constraint documents_scope_check
  check (document_scope in ('user_uploaded', 'generated', 'imported'));

alter table public.documents drop constraint if exists documents_category_check;
alter table public.documents
  add constraint documents_category_check
  check (document_category in (
    'bailleurs',
    'locataires',
    'immeubles',
    'unites',
    'contrats',
    'juridique',
    'administratif',
    'assurances',
    'personnel',
    'exports',
    'archives',
    'autre'
  ));

alter table public.documents drop constraint if exists documents_entity_type_check;
alter table public.documents
  add constraint documents_entity_type_check
  check (
    entity_type is null
    or entity_type in ('agency', 'bailleur', 'locataire', 'immeuble', 'unite', 'contrat', 'operation')
  );

alter table public.documents drop constraint if exists documents_lifecycle_status_check;
alter table public.documents
  add constraint documents_lifecycle_status_check
  check (lifecycle_status in ('active', 'archived', 'deleted', 'temporary', 'orphaned'));

alter table public.documents drop constraint if exists documents_retention_policy_check;
alter table public.documents
  add constraint documents_retention_policy_check
  check (retention_policy in ('critical', 'standard', 'temporary'));

create index if not exists idx_documents_agency_category_status
  on public.documents (agency_id, document_category, lifecycle_status, created_at desc)
  where deleted_at is null;

create index if not exists idx_documents_agency_entity
  on public.documents (agency_id, entity_type, entity_id)
  where deleted_at is null;

create index if not exists idx_documents_storage_path
  on public.documents (storage_path)
  where storage_path is not null;

create index if not exists idx_documents_file_hash
  on public.documents (agency_id, file_hash)
  where file_hash is not null and deleted_at is null;

alter table public.document_registry
  add column if not exists retention_policy text not null default 'critical',
  add column if not exists expires_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists last_accessed_at timestamptz;

alter table public.document_registry drop constraint if exists document_registry_retention_policy_check;
alter table public.document_registry
  add constraint document_registry_retention_policy_check
  check (retention_policy in ('critical', 'standard', 'temporary'));

create index if not exists idx_document_registry_agency_status_retention
  on public.document_registry (agency_id, status, retention_policy, generated_at desc)
  where deleted_at is null;

alter table public.subscription_plans
  add column if not exists storage_gb integer not null default 20;

insert into public.subscription_plans
  (id, name, price_xof, price_eur, price_usd, max_users, max_immeubles, max_unites, storage_gb, features)
values
  ('starter', 'Starter', 5000, 8, 9, 1, 3, 10, 1, '{"support":"email","storage_gb":1}'::jsonb),
  ('pro', 'Pro', 15000, 23, 25, 5, 20, 100, 20, '{"support":"prioritaire","storage_gb":20}'::jsonb),
  ('business', 'Business', 35000, 54, 58, 15, 100, 500, 100, '{"support":"prioritaire","storage_gb":100}'::jsonb),
  ('enterprise', 'Enterprise', 0, 0, 0, -1, -1, -1, 100, '{"support":"dedicated","storage_gb":100,"custom_storage":true}'::jsonb)
on conflict (id) do update
set
  storage_gb = excluded.storage_gb,
  max_users = excluded.max_users,
  max_immeubles = excluded.max_immeubles,
  max_unites = excluded.max_unites,
  features = public.subscription_plans.features || excluded.features;

update public.subscription_plans
set storage_gb = case
  when id in ('basic', 'trial') then 1
  when id = 'pro' then 20
  when id = 'business' then 100
  when id = 'enterprise' then greatest(storage_gb, 100)
  else storage_gb
end
where id in ('basic', 'trial', 'pro', 'business', 'enterprise');

create or replace function public.get_agency_storage_limit_bytes(p_agency_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  plan_storage_gb integer;
begin
  if not (public.is_super_admin() or p_agency_id = public.current_user_agency_id()) then
    raise exception 'Not allowed';
  end if;

  select sp.storage_gb into plan_storage_gb
  from public.subscriptions s
  join public.subscription_plans sp on sp.id = s.plan_id
  where s.agency_id = p_agency_id
  order by s.created_at desc
  limit 1;

  if plan_storage_gb is null then
    select sp.storage_gb into plan_storage_gb
    from public.agencies a
    join public.subscription_plans sp on sp.id = a.plan
    where a.id = p_agency_id
    limit 1;
  end if;

  if plan_storage_gb is null then
    select storage_gb into plan_storage_gb
    from public.subscription_plans
    where id = 'pro'
    limit 1;
  end if;

  return greatest(coalesce(plan_storage_gb, 20), 1)::bigint * 1024 * 1024 * 1024;
end;
$$;

grant execute on function public.get_agency_storage_limit_bytes(uuid) to authenticated;

create or replace function public.get_agency_storage_usage(p_agency_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uploaded_bytes bigint;
  generated_bytes bigint;
  total_bytes bigint;
  limit_bytes bigint;
  critical_bytes bigint;
  temporary_bytes bigint;
  archived_bytes bigint;
begin
  if not (public.is_super_admin() or p_agency_id = public.current_user_agency_id()) then
    raise exception 'Not allowed';
  end if;

  select coalesce(sum(coalesce(file_size, 0)), 0) into uploaded_bytes
  from public.documents
  where agency_id = p_agency_id
    and coalesce(lifecycle_status, 'active') <> 'deleted'
    and deleted_at is null;

  select coalesce(sum(coalesce(file_size, 0)), 0) into generated_bytes
  from public.document_registry
  where agency_id = p_agency_id
    and status <> 'deleted'
    and deleted_at is null;

  select coalesce(sum(coalesce(file_size, 0)), 0) into critical_bytes
  from public.document_registry
  where agency_id = p_agency_id
    and status <> 'deleted'
    and retention_policy = 'critical'
    and deleted_at is null;

  select
    coalesce((
      select sum(coalesce(file_size, 0))
      from public.documents
      where agency_id = p_agency_id
        and retention_policy = 'temporary'
        and coalesce(lifecycle_status, 'active') <> 'deleted'
        and deleted_at is null
    ), 0)
    +
    coalesce((
      select sum(coalesce(file_size, 0))
      from public.document_registry
      where agency_id = p_agency_id
        and retention_policy = 'temporary'
        and status <> 'deleted'
        and deleted_at is null
    ), 0)
  into temporary_bytes;

  select
    coalesce((
      select sum(coalesce(file_size, 0))
      from public.documents
      where agency_id = p_agency_id
        and lifecycle_status = 'archived'
        and deleted_at is null
    ), 0)
    +
    coalesce((
      select sum(coalesce(file_size, 0))
      from public.document_registry
      where agency_id = p_agency_id
        and status = 'archived'
        and deleted_at is null
    ), 0)
  into archived_bytes;

  total_bytes := uploaded_bytes + generated_bytes;
  limit_bytes := public.get_agency_storage_limit_bytes(p_agency_id);

  return jsonb_build_object(
    'used_bytes', total_bytes,
    'limit_bytes', limit_bytes,
    'available_bytes', greatest(limit_bytes - total_bytes, 0),
    'usage_percent', round((total_bytes::numeric / greatest(limit_bytes, 1)::numeric) * 100, 2),
    'generated_bytes', generated_bytes,
    'uploaded_bytes', uploaded_bytes,
    'critical_bytes', critical_bytes,
    'temporary_bytes', temporary_bytes,
    'archived_bytes', archived_bytes
  );
end;
$$;

grant execute on function public.get_agency_storage_usage(uuid) to authenticated;

create or replace function public.get_agency_storage_breakdown(p_agency_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not (public.is_super_admin() or p_agency_id = public.current_user_agency_id()) then
    raise exception 'Not allowed';
  end if;

  with combined as (
    select
      'uploaded'::text as source,
      coalesce(document_category, 'administratif') as category,
      coalesce(retention_policy, 'standard') as retention_policy,
      coalesce(lifecycle_status, 'active') as lifecycle_status,
      coalesce(file_size, 0)::bigint as file_size,
      name as title,
      storage_path,
      created_at
    from public.documents
    where agency_id = p_agency_id
      and deleted_at is null
      and coalesce(lifecycle_status, 'active') <> 'deleted'
    union all
    select
      'generated'::text as source,
      case
        when document_type = 'rapport_bailleur' then 'exports'
        when document_type in ('contrat', 'mandat') then 'contrats'
        when document_type in ('quittance', 'facture') then 'administratif'
        else 'exports'
      end as category,
      coalesce(retention_policy, 'critical') as retention_policy,
      coalesce(status, 'active') as lifecycle_status,
      coalesce(file_size, 0)::bigint as file_size,
      coalesce(metadata->>'file_name', reference) as title,
      storage_path,
      generated_at as created_at
    from public.document_registry
    where agency_id = p_agency_id
      and deleted_at is null
      and status <> 'deleted'
  )
  select jsonb_build_object(
    'by_source',
      coalesce((
        select jsonb_object_agg(source, jsonb_build_object('bytes', bytes, 'count', count_items))
        from (
          select source, sum(file_size) as bytes, count(*) as count_items
          from combined
          group by source
        ) s
      ), '{}'::jsonb),
    'by_category',
      coalesce((
        select jsonb_object_agg(category, jsonb_build_object('bytes', bytes, 'count', count_items))
        from (
          select category, sum(file_size) as bytes, count(*) as count_items
          from combined
          group by category
        ) c
      ), '{}'::jsonb),
    'by_retention',
      coalesce((
        select jsonb_object_agg(retention_policy, jsonb_build_object('bytes', bytes, 'count', count_items))
        from (
          select retention_policy, sum(file_size) as bytes, count(*) as count_items
          from combined
          group by retention_policy
        ) r
      ), '{}'::jsonb),
    'by_lifecycle',
      coalesce((
        select jsonb_object_agg(lifecycle_status, jsonb_build_object('bytes', bytes, 'count', count_items))
        from (
          select lifecycle_status, sum(file_size) as bytes, count(*) as count_items
          from combined
          group by lifecycle_status
        ) l
      ), '{}'::jsonb),
    'large_files',
      coalesce((
        select jsonb_agg(to_jsonb(lf))
        from (
          select source, category, retention_policy, lifecycle_status, file_size, title, storage_path, created_at
          from combined
          where file_size > 0
          order by file_size desc
          limit 8
        ) lf
      ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

grant execute on function public.get_agency_storage_breakdown(uuid) to authenticated;

create or replace function public.can_upload_document(p_agency_id uuid, p_file_size bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  usage jsonb;
  used_bytes bigint;
  limit_bytes bigint;
begin
  usage := public.get_agency_storage_usage(p_agency_id);
  used_bytes := (usage->>'used_bytes')::bigint;
  limit_bytes := (usage->>'limit_bytes')::bigint;

  return jsonb_build_object(
    'allowed', used_bytes + greatest(coalesce(p_file_size, 0), 0) <= limit_bytes,
    'used_bytes', used_bytes,
    'limit_bytes', limit_bytes,
    'next_used_bytes', used_bytes + greatest(coalesce(p_file_size, 0), 0),
    'usage_percent_after', round(((used_bytes + greatest(coalesce(p_file_size, 0), 0))::numeric / greatest(limit_bytes, 1)::numeric) * 100, 2)
  );
end;
$$;

grant execute on function public.can_upload_document(uuid, bigint) to authenticated;

create or replace function public.archive_document_soft(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.documents
  set lifecycle_status = 'archived',
      archived_at = now(),
      updated_at = now()
  where id = p_document_id
    and agency_id = public.current_user_agency_id()
    and retention_policy <> 'critical'
    and deleted_at is null;
end;
$$;

grant execute on function public.archive_document_soft(uuid) to authenticated;

create or replace function public.mark_expired_temporary_documents(p_agency_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  marked_count integer;
begin
  if not (public.is_super_admin() or p_agency_id = public.current_user_agency_id()) then
    raise exception 'Not allowed';
  end if;

  update public.documents
  set lifecycle_status = 'orphaned',
      updated_at = now()
  where agency_id = p_agency_id
    and retention_policy = 'temporary'
    and expires_at is not null
    and expires_at < now()
    and lifecycle_status = 'active'
    and deleted_at is null;

  get diagnostics marked_count = row_count;
  return marked_count;
end;
$$;

grant execute on function public.mark_expired_temporary_documents(uuid) to authenticated;

create or replace function public.mark_orphan_document_records(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uploaded_count integer;
  generated_count integer;
begin
  if not (public.is_super_admin() or p_agency_id = public.current_user_agency_id()) then
    raise exception 'Not allowed';
  end if;

  update public.documents
  set lifecycle_status = 'orphaned',
      updated_at = now()
  where agency_id = p_agency_id
    and deleted_at is null
    and coalesce(lifecycle_status, 'active') = 'active'
    and (storage_path is null or btrim(storage_path) = '');

  get diagnostics uploaded_count = row_count;

  update public.document_registry
  set status = 'orphaned',
      updated_at = now(),
      metadata = metadata || jsonb_build_object('orphan_reason', 'missing_storage_path', 'marked_at', now())
  where agency_id = p_agency_id
    and deleted_at is null
    and status = 'active'
    and (storage_path is null or btrim(storage_path) = '');

  get diagnostics generated_count = row_count;

  return jsonb_build_object(
    'uploaded_marked', uploaded_count,
    'generated_marked', generated_count
  );
end;
$$;

grant execute on function public.mark_orphan_document_records(uuid) to authenticated;

create or replace function public.cleanup_temporary_documents(p_agency_id uuid, p_older_than_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uploaded_count integer;
  generated_count integer;
  cutoff timestamptz;
begin
  if not (public.is_super_admin() or p_agency_id = public.current_user_agency_id()) then
    raise exception 'Not allowed';
  end if;

  cutoff := now() - make_interval(days => greatest(coalesce(p_older_than_days, 30), 1));

  update public.documents
  set lifecycle_status = 'deleted',
      deleted_at = now(),
      updated_at = now()
  where agency_id = p_agency_id
    and retention_policy = 'temporary'
    and deleted_at is null
    and coalesce(lifecycle_status, 'active') in ('active', 'temporary', 'orphaned')
    and coalesce(expires_at, created_at) < cutoff;

  get diagnostics uploaded_count = row_count;

  update public.document_registry
  set status = 'deleted',
      deleted_at = now(),
      updated_at = now(),
      metadata = metadata || jsonb_build_object('cleanup_reason', 'temporary_retention_expired', 'cleanup_at', now())
  where agency_id = p_agency_id
    and retention_policy = 'temporary'
    and deleted_at is null
    and status in ('active', 'orphaned', 'corrupt')
    and coalesce(expires_at, generated_at) < cutoff;

  get diagnostics generated_count = row_count;

  return jsonb_build_object(
    'uploaded_cleaned', uploaded_count,
    'generated_cleaned', generated_count,
    'cutoff', cutoff
  );
end;
$$;

grant execute on function public.cleanup_temporary_documents(uuid, integer) to authenticated;

create or replace function public.optimize_document_storage(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  generated_duplicates integer;
  uploaded_duplicates integer;
  expired_temporaries integer;
  orphaned jsonb;
begin
  if not (public.is_super_admin() or p_agency_id = public.current_user_agency_id()) then
    raise exception 'Not allowed';
  end if;

  generated_duplicates := public.archive_document_registry_duplicates(p_agency_id);
  expired_temporaries := public.mark_expired_temporary_documents(p_agency_id);
  orphaned := public.mark_orphan_document_records(p_agency_id);

  with ranked as (
    select
      id,
      row_number() over (
        partition by agency_id, file_hash
        order by created_at desc
      ) as rn
    from public.documents
    where agency_id = p_agency_id
      and file_hash is not null
      and retention_policy <> 'critical'
      and lifecycle_status = 'active'
      and deleted_at is null
  )
  update public.documents d
  set lifecycle_status = 'archived',
      archived_at = now(),
      updated_at = now()
  from ranked r
  where d.id = r.id
    and r.rn > 1;

  get diagnostics uploaded_duplicates = row_count;

  return jsonb_build_object(
    'generated_duplicates_archived', generated_duplicates,
    'uploaded_duplicates_archived', uploaded_duplicates,
    'expired_temporaries_marked', expired_temporaries,
    'orphaned', orphaned
  );
end;
$$;

grant execute on function public.optimize_document_storage(uuid) to authenticated;
