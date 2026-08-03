-- Server-owned lifecycle for generated documents.
-- A client may upload a private object, but only these commands can create or
-- mutate the corresponding official registry entry.

alter table public.document_registry
  drop constraint if exists document_registry_status_check;

alter table public.document_registry
  add constraint document_registry_status_check
  check (status in ('pending', 'active', 'archived', 'orphaned', 'corrupt', 'deleted'));

alter table public.document_registry enable row level security;
alter table public.document_registry force row level security;

drop policy if exists document_registry_insert_own_agency on public.document_registry;
drop policy if exists document_registry_update_own_agency on public.document_registry;
drop policy if exists document_registry_delete_admin on public.document_registry;

revoke insert, update, delete on table public.document_registry from authenticated;
grant select on table public.document_registry to authenticated;

create or replace function public.fn_prepare_managed_document(
  p_document_type text,
  p_entity_id text,
  p_period text,
  p_reference text,
  p_data_hash text,
  p_file_size bigint,
  p_mime_type text,
  p_retention_policy text default 'critical',
  p_metadata jsonb default '{}'::jsonb,
  p_template_revision_id uuid default null,
  p_template_checksum text default null,
  p_renderer_version text default null,
  p_asset_checksums jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.current_user_agency_id();
  v_user_id uuid := auth.uid();
  v_existing public.document_registry;
  v_reserved public.document_registry;
  v_version integer;
  v_id uuid := gen_random_uuid();
begin
  if v_user_id is null
    or v_agency_id is null
    or not (
      public.fn_user_can(v_user_id, 'documents', 'export')
      or public.current_user_is_individual_landlord_account()
    )
  then
    raise exception 'Accès documentaire refusé';
  end if;

  if p_document_type not in ('contrat', 'mandat', 'quittance', 'facture', 'rapport_bailleur', 'export', 'pdf', 'document') then
    raise exception 'Type de document invalide';
  end if;
  if nullif(btrim(p_entity_id), '') is null or nullif(btrim(p_reference), '') is null then
    raise exception 'Identité documentaire incomplète';
  end if;
  if p_data_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Empreinte de données invalide';
  end if;
  if coalesce(p_file_size, 0) <= 0 then
    raise exception 'Fichier documentaire vide';
  end if;
  if p_retention_policy not in ('critical', 'standard', 'temporary') then
    raise exception 'Politique de conservation invalide';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(concat_ws('|', v_agency_id::text, p_document_type, p_entity_id, coalesce(p_period, '')), 0)
  );

  select * into v_existing
  from public.document_registry
  where agency_id = v_agency_id
    and document_type = p_document_type
    and entity_id = p_entity_id
    and period is not distinct from p_period
    and data_hash = p_data_hash
    and status = 'active'
    and deleted_at is null
  order by version desc
  limit 1;

  if found then
    return jsonb_build_object('reused', true, 'entry', to_jsonb(v_existing));
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.document_registry
  where agency_id = v_agency_id
    and document_type = p_document_type
    and entity_id = p_entity_id
    and period is not distinct from p_period;

  insert into public.document_registry (
    id, agency_id, document_type, entity_id, period, reference, version,
    storage_path, file_hash, data_hash, generated_by, status,
    retention_policy, file_size, mime_type, metadata,
    template_revision_id, template_checksum, renderer_version, asset_checksums
  ) values (
    v_id, v_agency_id, p_document_type, btrim(p_entity_id), p_period,
    btrim(p_reference), v_version,
    concat('pending/', v_agency_id::text, '/', v_id::text), repeat('0', 64),
    p_data_hash, v_user_id, 'pending', p_retention_policy, p_file_size,
    coalesce(nullif(btrim(p_mime_type), ''), 'application/pdf'), coalesce(p_metadata, '{}'::jsonb),
    p_template_revision_id, p_template_checksum, p_renderer_version,
    coalesce(p_asset_checksums, '{}'::jsonb)
  ) returning * into v_reserved;

  return jsonb_build_object('reused', false, 'entry', to_jsonb(v_reserved));
end;
$$;

create or replace function public.fn_finalize_managed_document(
  p_registry_id uuid,
  p_storage_path text,
  p_file_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_agency_id uuid := public.current_user_agency_id();
  v_entry public.document_registry;
  v_folder text;
begin
  if auth.uid() is null
    or v_agency_id is null
    or not (
      public.fn_user_can(auth.uid(), 'documents', 'export')
      or public.current_user_is_individual_landlord_account()
    )
  then
    raise exception 'Accès documentaire refusé';
  end if;

  select * into v_entry
  from public.document_registry
  where id = p_registry_id and agency_id = v_agency_id
  for update;

  if not found or v_entry.status <> 'pending' then
    raise exception 'Réservation documentaire invalide';
  end if;
  if p_file_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Empreinte de fichier invalide';
  end if;
  if public.document_storage_agency_id(p_storage_path) is distinct from v_agency_id then
    raise exception 'Chemin de stockage invalide';
  end if;

  v_folder := case v_entry.document_type
    when 'contrat' then 'contrats'
    when 'mandat' then 'mandats'
    when 'quittance' then 'quittances'
    when 'facture' then 'factures'
    when 'rapport_bailleur' then 'rapports-bailleurs'
    else 'exports'
  end;

  if p_storage_path not like concat('agencies/', v_agency_id::text, '/', v_folder, '/%') then
    raise exception 'Dossier documentaire invalide';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'documents' and name = p_storage_path
  ) then
    raise exception 'Fichier documentaire absent du stockage';
  end if;

  update public.document_registry
  set storage_path = p_storage_path,
      file_hash = p_file_hash,
      status = 'active',
      generated_at = now(),
      last_accessed_at = now()
  where id = p_registry_id
  returning * into v_entry;

  return to_jsonb(v_entry);
end;
$$;

create or replace function public.fn_touch_managed_document(
  p_registry_id uuid,
  p_mark_corrupt boolean default false,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.current_user_agency_id();
begin
  if auth.uid() is null or v_agency_id is null then
    raise exception 'Accès documentaire refusé';
  end if;

  update public.document_registry
  set last_accessed_at = now(),
      status = case when p_mark_corrupt then 'corrupt' else status end,
      metadata = case
        when p_mark_corrupt then metadata || jsonb_build_object(
          'corrupt_reason', coalesce(nullif(btrim(p_reason), ''), 'storage_access_failed'),
          'corrupt_at', now()
        )
        else metadata
      end
  where id = p_registry_id
    and agency_id = v_agency_id
    and status in ('active', 'corrupt');
end;
$$;

create or replace function public.fn_abort_managed_document(p_registry_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.current_user_agency_id() is null then
    raise exception 'Accès documentaire refusé';
  end if;

  delete from public.document_registry
  where id = p_registry_id
    and agency_id = public.current_user_agency_id()
    and status = 'pending';
end;
$$;

revoke all on function public.fn_prepare_managed_document(text, text, text, text, text, bigint, text, text, jsonb, uuid, text, text, jsonb) from public, anon;
revoke all on function public.fn_finalize_managed_document(uuid, text, text) from public, anon;
revoke all on function public.fn_touch_managed_document(uuid, boolean, text) from public, anon;
revoke all on function public.fn_abort_managed_document(uuid) from public, anon;

grant execute on function public.fn_prepare_managed_document(text, text, text, text, text, bigint, text, text, jsonb, uuid, text, text, jsonb) to authenticated;
grant execute on function public.fn_finalize_managed_document(uuid, text, text) to authenticated;
grant execute on function public.fn_touch_managed_document(uuid, boolean, text) to authenticated;
grant execute on function public.fn_abort_managed_document(uuid) to authenticated;

comment on function public.fn_prepare_managed_document(text, text, text, text, text, bigint, text, text, jsonb, uuid, text, text, jsonb)
  is 'Reserves an immutable generated-document version or reuses an identical active version.';
comment on function public.fn_finalize_managed_document(uuid, text, text)
  is 'Activates a reserved registry entry only after its private Storage object exists.';

-- Generated documents are append-only once their registry entry is active.
-- User uploads remain editable/removable, while a failed generated upload can
-- still be cleaned up before finalization because it has no active registry row.
drop policy if exists "documents_update_own_agency" on storage.objects;
create policy "documents_update_own_agency"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and public.document_storage_agency_id(name) = public.current_user_agency_id()
    and name like concat(
      'agencies/', public.current_user_agency_id()::text, '/uploads/%'
    )
  )
  with check (
    bucket_id = 'documents'
    and public.document_storage_agency_id(name) = public.current_user_agency_id()
    and name like concat(
      'agencies/', public.current_user_agency_id()::text, '/uploads/%'
    )
  );

drop policy if exists "documents_delete_own_agency" on storage.objects;
create policy "documents_delete_own_agency"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or (
        public.document_storage_agency_id(name) = public.current_user_agency_id()
        and (
          name like concat(
            'agencies/', public.current_user_agency_id()::text, '/uploads/%'
          )
          or not exists (
            select 1
            from public.document_registry registry
            where registry.storage_path = name
              and registry.status = 'active'
              and registry.deleted_at is null
          )
        )
      )
    )
  );
