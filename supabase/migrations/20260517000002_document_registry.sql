-- Intelligent document registry for Samay Keur.
-- Stores generated documents once, reuses identical versions, and keeps a
-- traceable archive when source data changes.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create or replace function public.document_storage_agency_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, storage
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

  if array_length(parts, 1) >= 1 and parts[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return parts[1]::uuid;
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

create table if not exists public.document_registry (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  document_type text not null check (
    document_type in (
      'contrat',
      'mandat',
      'quittance',
      'facture',
      'rapport_bailleur',
      'export',
      'pdf',
      'document'
    )
  ),
  entity_id text not null,
  period text,
  reference text not null,
  version integer not null default 1 check (version > 0),
  storage_path text not null,
  file_hash text not null,
  data_hash text not null,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.user_profiles(id) on delete set null,
  status text not null default 'active' check (
    status in ('active', 'archived', 'orphaned', 'corrupt', 'deleted')
  ),
  file_size bigint not null default 0 check (file_size >= 0),
  mime_type text not null default 'application/pdf',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_registry_unique_version
    unique (agency_id, document_type, entity_id, period, version),
  constraint document_registry_unique_storage_path unique (storage_path)
);

create index if not exists idx_document_registry_lookup
  on public.document_registry (agency_id, document_type, entity_id, period, status, version desc);

create index if not exists idx_document_registry_data_hash
  on public.document_registry (agency_id, document_type, entity_id, period, data_hash);

create index if not exists idx_document_registry_generated_at
  on public.document_registry (agency_id, generated_at desc);

alter table public.document_registry enable row level security;

drop policy if exists document_registry_select_own_agency on public.document_registry;
create policy document_registry_select_own_agency
  on public.document_registry for select
  to authenticated
  using (agency_id = public.current_user_agency_id() or public.is_super_admin());

drop policy if exists document_registry_insert_own_agency on public.document_registry;
create policy document_registry_insert_own_agency
  on public.document_registry for insert
  to authenticated
  with check (agency_id = public.current_user_agency_id() and public.is_agent_or_admin());

drop policy if exists document_registry_update_own_agency on public.document_registry;
create policy document_registry_update_own_agency
  on public.document_registry for update
  to authenticated
  using (agency_id = public.current_user_agency_id() and public.is_agent_or_admin())
  with check (agency_id = public.current_user_agency_id() and public.is_agent_or_admin());

drop policy if exists document_registry_delete_admin on public.document_registry;
create policy document_registry_delete_admin
  on public.document_registry for delete
  to authenticated
  using (agency_id = public.current_user_agency_id() and public.is_admin());

create or replace function public.touch_document_registry_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_document_registry_updated_at on public.document_registry;
create trigger trg_document_registry_updated_at
before update on public.document_registry
for each row execute function public.touch_document_registry_updated_at();

create or replace function public.archive_document_registry_duplicates(p_agency_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  archived_count integer;
begin
  if not (public.is_super_admin() or p_agency_id = public.current_user_agency_id()) then
    raise exception 'Not allowed';
  end if;

  with ranked as (
    select
      id,
      row_number() over (
        partition by agency_id, document_type, entity_id, period, data_hash
        order by version desc, generated_at desc
      ) as rn
    from public.document_registry
    where agency_id = p_agency_id
      and status = 'active'
  )
  update public.document_registry d
  set status = 'archived',
      metadata = d.metadata || jsonb_build_object('archived_reason', 'duplicate_data_hash')
  from ranked r
  where d.id = r.id
    and r.rn > 1;

  get diagnostics archived_count = row_count;
  return archived_count;
end;
$$;

grant execute on function public.archive_document_registry_duplicates(uuid) to authenticated;
