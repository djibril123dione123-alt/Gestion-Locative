-- ============================================================================
-- Document Studio: versioned templates, atomic publication and traceability
-- ============================================================================

create table if not exists public.agency_document_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  document_type text not null check (
    document_type in (
      'contrat',
      'mandat',
      'quittance',
      'facture',
      'rapport_bailleur',
      'rapport_proprietaire'
    )
  ),
  variant text not null default 'default',
  name text not null,
  draft_content jsonb not null,
  published_revision_id uuid,
  lock_version integer not null default 1 check (lock_version > 0),
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, document_type, variant)
);

create table if not exists public.document_template_revisions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.agency_document_templates(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  revision integer not null check (revision > 0),
  content jsonb not null,
  checksum text not null check (length(checksum) >= 32),
  catalog_version text not null,
  renderer_version text not null,
  change_note text,
  published_by uuid references public.user_profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  unique (template_id, revision),
  unique (template_id, checksum)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agency_document_templates_published_revision_fkey'
  ) then
    alter table public.agency_document_templates
      add constraint agency_document_templates_published_revision_fkey
      foreign key (published_revision_id)
      references public.document_template_revisions(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_agency_document_templates_lookup
  on public.agency_document_templates (agency_id, document_type, variant);

create index if not exists idx_document_template_revisions_history
  on public.document_template_revisions (agency_id, template_id, revision desc);

alter table public.agency_document_templates enable row level security;
alter table public.document_template_revisions enable row level security;

revoke all on public.agency_document_templates from anon;
revoke all on public.document_template_revisions from anon;
revoke delete on public.agency_document_templates from authenticated;
grant select, insert, update on public.agency_document_templates to authenticated;
grant select on public.document_template_revisions to authenticated;

drop policy if exists agency_document_templates_select on public.agency_document_templates;
create policy agency_document_templates_select
  on public.agency_document_templates for select
  to authenticated
  using (
    agency_id = public.current_user_agency_id()
    or public.is_super_admin()
  );

drop policy if exists agency_document_templates_admin_insert on public.agency_document_templates;
create policy agency_document_templates_admin_insert
  on public.agency_document_templates for insert
  to authenticated
  with check (
    agency_id = public.current_user_agency_id()
    and public.is_admin()
  );

drop policy if exists agency_document_templates_admin_update on public.agency_document_templates;
create policy agency_document_templates_admin_update
  on public.agency_document_templates for update
  to authenticated
  using (
    agency_id = public.current_user_agency_id()
    and public.is_admin()
  )
  with check (
    agency_id = public.current_user_agency_id()
    and public.is_admin()
  );

drop policy if exists agency_document_templates_admin_delete on public.agency_document_templates;

drop policy if exists document_template_revisions_select on public.document_template_revisions;
create policy document_template_revisions_select
  on public.document_template_revisions for select
  to authenticated
  using (
    agency_id = public.current_user_agency_id()
    or public.is_super_admin()
  );

create or replace function public.touch_agency_document_template()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.lock_version := old.lock_version + 1;
  return new;
end;
$$;

drop trigger if exists trg_touch_agency_document_template on public.agency_document_templates;
create trigger trg_touch_agency_document_template
before update on public.agency_document_templates
for each row execute function public.touch_agency_document_template();

create or replace function public.publish_agency_document_template(
  p_template_id uuid,
  p_expected_lock_version integer,
  p_content jsonb,
  p_checksum text,
  p_catalog_version text,
  p_renderer_version text,
  p_change_note text default null
)
returns public.document_template_revisions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_agency_id uuid;
  v_current_lock integer;
  v_document_type text;
  v_revision integer;
  v_result public.document_template_revisions;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select t.agency_id, t.lock_version, t.document_type
  into v_agency_id, v_current_lock, v_document_type
  from public.agency_document_templates t
  where t.id = p_template_id
  for update;

  if v_agency_id is null then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.user_profiles up
    where up.id = v_user_id
      and up.agency_id = v_agency_id
      and up.role = 'admin'
      and coalesce(up.actif, true)
  ) then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if v_current_lock <> p_expected_lock_version then
    raise exception 'TEMPLATE_CONFLICT' using errcode = '40001';
  end if;

  if jsonb_typeof(p_content) <> 'object'
     or jsonb_typeof(p_content -> 'blocks') <> 'array'
     or jsonb_array_length(p_content -> 'blocks') = 0 then
    raise exception 'INVALID_TEMPLATE_CONTENT' using errcode = '22023';
  end if;

  if coalesce((p_content ->> 'schemaVersion')::integer, 0) <> 1
     or p_content ->> 'documentType' <> v_document_type then
    raise exception 'INVALID_TEMPLATE_SCHEMA' using errcode = '22023';
  end if;

  if v_document_type in ('contrat', 'mandat') and (
    not exists (
      select 1 from jsonb_array_elements(p_content -> 'blocks') b
      where b ->> 'code' = 'parties' and coalesce((b ->> 'enabled')::boolean, false)
    )
    or not exists (
      select 1 from jsonb_array_elements(p_content -> 'blocks') b
      where b ->> 'code' = 'signature' and coalesce((b ->> 'enabled')::boolean, false)
    )
  ) then
    raise exception 'REQUIRED_LEGAL_BLOCK_MISSING' using errcode = '22023';
  end if;

  if v_document_type in ('quittance', 'facture') and not exists (
    select 1 from jsonb_array_elements(p_content -> 'blocks') b
    where b ->> 'code' = 'summary' and coalesce((b ->> 'enabled')::boolean, false)
  ) then
    raise exception 'REQUIRED_PAYMENT_BLOCK_MISSING' using errcode = '22023';
  end if;

  if v_document_type in ('rapport_bailleur', 'rapport_proprietaire') and not exists (
    select 1 from jsonb_array_elements(p_content -> 'blocks') b
    where b ->> 'code' = 'owner' and coalesce((b ->> 'enabled')::boolean, false)
  ) then
    raise exception 'REQUIRED_REPORT_BLOCK_MISSING' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_checksum, ''))) < 32 then
    raise exception 'INVALID_TEMPLATE_CHECKSUM' using errcode = '22023';
  end if;

  select coalesce(max(r.revision), 0) + 1
  into v_revision
  from public.document_template_revisions r
  where r.template_id = p_template_id;

  insert into public.document_template_revisions (
    template_id,
    agency_id,
    revision,
    content,
    checksum,
    catalog_version,
    renderer_version,
    change_note,
    published_by
  )
  values (
    p_template_id,
    v_agency_id,
    v_revision,
    p_content,
    p_checksum,
    p_catalog_version,
    p_renderer_version,
    nullif(trim(coalesce(p_change_note, '')), ''),
    v_user_id
  )
  on conflict (template_id, checksum) do nothing
  returning * into v_result;

  if v_result.id is null then
    select r.*
    into v_result
    from public.document_template_revisions r
    where r.template_id = p_template_id
      and r.checksum = p_checksum;
  end if;

  update public.agency_document_templates
  set draft_content = p_content,
      published_revision_id = v_result.id,
      updated_by = v_user_id
  where id = p_template_id;

  return v_result;
end;
$$;

revoke all on function public.publish_agency_document_template(
  uuid, integer, jsonb, text, text, text, text
) from public, anon;
grant execute on function public.publish_agency_document_template(
  uuid, integer, jsonb, text, text, text, text
) to authenticated;

-- Stable, tenant-scoped references. An entity/period keeps the same number.
create table if not exists public.document_number_sequences (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  document_type text not null,
  sequence_year integer not null,
  last_value integer not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now(),
  primary key (agency_id, document_type, sequence_year)
);

create table if not exists public.document_reference_allocations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  document_type text not null,
  entity_id text not null,
  period_key text not null default '',
  sequence_year integer not null,
  sequence_value integer not null check (sequence_value > 0),
  reference text not null,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (agency_id, document_type, entity_id, period_key),
  unique (agency_id, reference)
);

alter table public.document_number_sequences enable row level security;
alter table public.document_reference_allocations enable row level security;
revoke all on public.document_number_sequences from anon, authenticated;
revoke all on public.document_reference_allocations from anon;
grant select on public.document_reference_allocations to authenticated;

drop policy if exists document_reference_allocations_select on public.document_reference_allocations;
create policy document_reference_allocations_select
  on public.document_reference_allocations for select
  to authenticated
  using (
    agency_id = public.current_user_agency_id()
    or public.is_super_admin()
  );

create or replace function public.allocate_document_reference(
  p_document_type text,
  p_entity_id text,
  p_period_key text,
  p_format text,
  p_prefix text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_agency_id uuid;
  v_year integer := extract(year from now())::integer;
  v_value integer;
  v_reference text;
  v_existing text;
  v_prefix text := upper(regexp_replace(coalesce(p_prefix, 'DOC'), '[^A-Z0-9]', '', 'g'));
  v_format text := coalesce(nullif(trim(p_format), ''), 'Q-YYYY-0001');
begin
  select up.agency_id
  into v_agency_id
  from public.user_profiles up
  where up.id = v_user_id
    and coalesce(up.actif, true);

  if v_agency_id is null then
    raise exception 'AGENCY_REQUIRED' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_document_type, '')), '') is null
     or nullif(trim(coalesce(p_entity_id, '')), '') is null then
    raise exception 'INVALID_REFERENCE_INPUT' using errcode = '22023';
  end if;

  select a.reference
  into v_existing
  from public.document_reference_allocations a
  where a.agency_id = v_agency_id
    and a.document_type = p_document_type
    and a.entity_id = p_entity_id
    and a.period_key = coalesce(p_period_key, '');

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.document_number_sequences (
    agency_id, document_type, sequence_year, last_value
  )
  values (v_agency_id, p_document_type, v_year, 1)
  on conflict (agency_id, document_type, sequence_year)
  do update set
    last_value = document_number_sequences.last_value + 1,
    updated_at = now()
  returning last_value into v_value;

  v_reference := replace(v_format, 'AGENCE', v_prefix);
  v_reference := replace(v_reference, 'Q', v_prefix);
  v_reference := replace(v_reference, 'YYYY', v_year::text);
  v_reference := replace(v_reference, '0001', lpad(v_value::text, 4, '0'));

  insert into public.document_reference_allocations (
    agency_id,
    document_type,
    entity_id,
    period_key,
    sequence_year,
    sequence_value,
    reference,
    created_by
  )
  values (
    v_agency_id,
    p_document_type,
    p_entity_id,
    coalesce(p_period_key, ''),
    v_year,
    v_value,
    v_reference,
    v_user_id
  )
  on conflict (agency_id, document_type, entity_id, period_key)
  do update set reference = document_reference_allocations.reference
  returning reference into v_reference;

  return v_reference;
end;
$$;

revoke all on function public.allocate_document_reference(text, text, text, text, text)
  from public, anon;
grant execute on function public.allocate_document_reference(text, text, text, text, text)
  to authenticated;

-- Registry and QR trace the exact template/renderer used for each issued PDF.
alter table public.document_registry
  add column if not exists template_revision_id uuid
    references public.document_template_revisions(id) on delete set null,
  add column if not exists template_checksum text,
  add column if not exists renderer_version text,
  add column if not exists asset_checksums jsonb not null default '{}'::jsonb;

alter table public.document_verifications
  add column if not exists document_registry_id uuid
    references public.document_registry(id) on delete set null,
  add column if not exists registry_version integer,
  add column if not exists template_checksum text;

grant update on public.document_verifications to authenticated;

drop policy if exists document_verifications_update_own_agency on public.document_verifications;
create policy document_verifications_update_own_agency
  on public.document_verifications for update
  to authenticated
  using (
    agency_id = public.current_user_agency_id()
    and public.is_agent_or_admin()
  )
  with check (
    agency_id = public.current_user_agency_id()
    and public.is_agent_or_admin()
  );

create index if not exists idx_document_registry_template_revision
  on public.document_registry (template_revision_id);

create index if not exists idx_document_verifications_registry
  on public.document_verifications (document_registry_id);

-- Signature and stamp are separate assets with explicit insertion controls.
alter table public.agency_settings
  add column if not exists stamp_url text,
  add column if not exists signature_enabled boolean not null default false,
  add column if not exists stamp_enabled boolean not null default false;

do $$
begin
  execute 'drop policy if exists "agency_assets_identity_read" on storage.objects';
  execute 'drop policy if exists "agency_assets_identity_insert" on storage.objects';
  execute 'drop policy if exists "agency_assets_identity_update" on storage.objects';
  execute 'drop policy if exists "agency_assets_identity_delete" on storage.objects';

  execute $policy$
    create policy "agency_assets_identity_read"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'agency-assets'
        and (storage.foldername(name))[1] = (
          select agency_id::text from public.user_profiles where id = auth.uid()
        )
        and (storage.foldername(name))[2] in ('logos', 'signatures', 'stamps')
      )
  $policy$;

  execute $policy$
    create policy "agency_assets_identity_insert"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'agency-assets'
        and (storage.foldername(name))[1] = (
          select agency_id::text from public.user_profiles where id = auth.uid()
        )
        and (storage.foldername(name))[2] in ('logos', 'signatures', 'stamps')
        and exists (
          select 1 from public.user_profiles
          where id = auth.uid() and role = 'admin'
        )
      )
  $policy$;

  execute $policy$
    create policy "agency_assets_identity_update"
      on storage.objects for update to authenticated
      using (
        bucket_id = 'agency-assets'
        and (storage.foldername(name))[1] = (
          select agency_id::text from public.user_profiles where id = auth.uid()
        )
        and (storage.foldername(name))[2] in ('logos', 'signatures', 'stamps')
        and exists (
          select 1 from public.user_profiles
          where id = auth.uid() and role = 'admin'
        )
      )
      with check (
        bucket_id = 'agency-assets'
        and (storage.foldername(name))[1] = (
          select agency_id::text from public.user_profiles where id = auth.uid()
        )
        and (storage.foldername(name))[2] in ('logos', 'signatures', 'stamps')
      )
  $policy$;

  execute $policy$
    create policy "agency_assets_identity_delete"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'agency-assets'
        and (storage.foldername(name))[1] = (
          select agency_id::text from public.user_profiles where id = auth.uid()
        )
        and (storage.foldername(name))[2] in ('logos', 'signatures', 'stamps')
        and exists (
          select 1 from public.user_profiles
          where id = auth.uid() and role = 'admin'
        )
      )
  $policy$;
exception
  when insufficient_privilege then
    raise notice 'Storage policies require an owner role; apply them from the Supabase dashboard.';
end $$;

comment on table public.agency_document_templates is
  'Mutable agency drafts and pointer to the currently published immutable revision.';
comment on table public.document_template_revisions is
  'Immutable publication history used to reproduce issued documents.';
comment on function public.publish_agency_document_template(uuid, integer, jsonb, text, text, text, text) is
  'Atomically publishes a validated agency document template with optimistic locking.';
