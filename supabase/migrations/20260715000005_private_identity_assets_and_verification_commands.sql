-- Private visual identity assets and server-owned QR verification commands.

update storage.buckets
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'agency-assets';

do $$
begin
  if to_regprocedure('public.current_user_agency_id()') is null then
    raise exception 'Required helper public.current_user_agency_id() is missing';
  end if;

  execute 'drop policy if exists "agency_assets_identity_read" on storage.objects';
  execute 'drop policy if exists "agency_assets_identity_insert" on storage.objects';
  execute 'drop policy if exists "agency_assets_identity_update" on storage.objects';
  execute 'drop policy if exists "agency_assets_identity_delete" on storage.objects';

  execute $policy$
    create policy "agency_assets_identity_read"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'agency-assets'
        and (
          public.is_super_admin() or (
          bucket_id = 'agency-assets'
          and (storage.foldername(name))[1] = public.current_user_agency_id()::text
          )
        )
      )
  $policy$;

  -- Identity assets are mutated only by the validated Edge command. Authenticated
  -- clients may read their tenant files to create short-lived signed previews,
  -- but receive no direct INSERT, UPDATE or DELETE policy on storage.objects.
exception
  when insufficient_privilege then
    raise exception 'Cannot secure storage.objects policies with the migration role';
end $$;

alter table public.document_verifications force row level security;
revoke insert, update, delete on public.document_verifications from authenticated;

drop policy if exists "Agency users can insert document verifications" on public.document_verifications;
drop policy if exists document_verifications_update_own_agency on public.document_verifications;

create or replace function public.register_document_verification_command(
  p_agency_id uuid,
  p_document_ref text,
  p_document_type text,
  p_agency_name text,
  p_issued_at timestamptz,
  p_amount_xof numeric,
  p_payment_status text,
  p_payload_hash text,
  p_metadata jsonb default '{}'::jsonb
)
returns table(id uuid, token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_existing public.document_verifications%rowtype;
  v_id uuid;
  v_token text;
begin
  if auth.uid() is null or p_agency_id is null or p_agency_id <> public.current_user_agency_id() then
    raise exception 'Access denied';
  end if;
  if nullif(btrim(p_document_ref), '') is null
    or nullif(btrim(p_payload_hash), '') is null
    or nullif(btrim(p_agency_name), '') is null then
    raise exception 'Document reference, payload hash and agency name are required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_agency_id::text || ':' || p_document_type || ':' || p_document_ref, 0));

  select * into v_existing
  from public.document_verifications dv
  where dv.agency_id = p_agency_id
    and dv.document_ref = btrim(p_document_ref)
    and dv.document_type = p_document_type
    and dv.payload_hash = p_payload_hash
    and dv.document_status = 'authentic'
  order by dv.created_at desc
  limit 1;

  if v_existing.id is not null then
    return query select v_existing.id, v_existing.token;
    return;
  end if;

  update public.document_verifications
  set document_status = 'superseded',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('superseded_at', now())
  where agency_id = p_agency_id
    and document_ref = btrim(p_document_ref)
    and document_type = p_document_type
    and document_status = 'authentic';

  v_id := gen_random_uuid();
  v_token := encode(digest(v_id::text || ':' || gen_random_uuid()::text || ':' || clock_timestamp()::text, 'sha256'), 'hex');
  insert into public.document_verifications(
    id, token, agency_id, document_ref, document_type, agency_name, issued_at,
    amount_xof, payment_status, document_status, payload_hash, metadata, created_by
  ) values (
    v_id, v_token, p_agency_id, btrim(p_document_ref), p_document_type,
    btrim(p_agency_name), coalesce(p_issued_at, now()), p_amount_xof,
    p_payment_status, 'authentic', p_payload_hash, coalesce(p_metadata, '{}'::jsonb), auth.uid()
  );
  return query select v_id, v_token;
end;
$$;

create or replace function public.link_document_verification_registry_command(
  p_verification_id uuid,
  p_registry_id uuid,
  p_registry_version integer,
  p_template_checksum text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.document_verifications dv
  set document_registry_id = p_registry_id,
      registry_version = p_registry_version,
      template_checksum = p_template_checksum,
      metadata = coalesce(dv.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
  where dv.id = p_verification_id
    and dv.agency_id = public.current_user_agency_id()
    and exists (
      select 1 from public.document_registry dr
      where dr.id = p_registry_id and dr.agency_id = dv.agency_id
    );
  if not found then raise exception 'Verification or registry entry not found'; end if;
end;
$$;

create or replace function public.revoke_document_verification_command(
  p_verification_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(p_reason), '') is null then raise exception 'A revocation reason is required'; end if;
  update public.document_verifications dv
  set document_status = 'revoked',
      metadata = coalesce(dv.metadata, '{}'::jsonb) || jsonb_build_object('revoked_at', now(), 'reason', btrim(p_reason))
  where dv.id = p_verification_id and dv.agency_id = public.current_user_agency_id();
  if not found then raise exception 'Verification not found'; end if;
end;
$$;

revoke all on function public.register_document_verification_command(uuid,text,text,text,timestamptz,numeric,text,text,jsonb) from public, anon;
revoke all on function public.link_document_verification_registry_command(uuid,uuid,integer,text,jsonb) from public, anon;
revoke all on function public.revoke_document_verification_command(uuid,text) from public, anon;
grant execute on function public.register_document_verification_command(uuid,text,text,text,timestamptz,numeric,text,text,jsonb) to authenticated;
grant execute on function public.link_document_verification_registry_command(uuid,uuid,integer,text,jsonb) to authenticated;
grant execute on function public.revoke_document_verification_command(uuid,text) to authenticated;
