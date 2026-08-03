-- Regression hardening for financial snapshots, document finalization and QR commands.
-- This migration preserves public RPC signatures while moving sensitive checks server-side.

do $$
begin
  if to_regprocedure(
    'public.fn_create_owner_report_snapshot_authorized_impl(uuid,uuid,date,date,text)'
  ) is null then
    execute 'alter function public.fn_create_owner_report_snapshot(uuid,uuid,date,date,text)
      rename to fn_create_owner_report_snapshot_authorized_impl';
  end if;

  if to_regprocedure(
    'public.fn_create_payment_receipt_snapshot_authorized_impl(uuid,uuid)'
  ) is null then
    execute 'alter function public.fn_create_payment_receipt_snapshot(uuid,uuid)
      rename to fn_create_payment_receipt_snapshot_authorized_impl';
  end if;
end;
$$;

revoke all on function public.fn_create_owner_report_snapshot_authorized_impl(
  uuid, uuid, date, date, text
) from public, anon, authenticated;
revoke all on function public.fn_create_payment_receipt_snapshot_authorized_impl(
  uuid, uuid
) from public, anon, authenticated;

create or replace function public.fn_create_owner_report_snapshot(
  p_agency_id uuid,
  p_bailleur_id uuid,
  p_period_start date,
  p_period_end date,
  p_document_kind text default 'rapport_bailleur'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
    or p_agency_id is distinct from public.current_user_agency_id()
    or not (
      public.fn_user_can(auth.uid(), 'documents', 'export')
      or public.current_user_is_individual_landlord_account()
    )
  then
    raise exception 'FINANCE_FORBIDDEN' using errcode = '42501';
  end if;

  return public.fn_create_owner_report_snapshot_authorized_impl(
    p_agency_id,
    p_bailleur_id,
    p_period_start,
    p_period_end,
    p_document_kind
  );
end;
$$;

create or replace function public.fn_create_payment_receipt_snapshot(
  p_agency_id uuid,
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
    or p_agency_id is distinct from public.current_user_agency_id()
    or not public.fn_user_can(auth.uid(), 'paiements', 'export')
  then
    raise exception 'FINANCE_FORBIDDEN' using errcode = '42501';
  end if;

  return public.fn_create_payment_receipt_snapshot_authorized_impl(
    p_agency_id,
    p_payment_id
  );
end;
$$;

revoke all on function public.fn_create_owner_report_snapshot(
  uuid, uuid, date, date, text
) from public, anon;
revoke all on function public.fn_create_payment_receipt_snapshot(
  uuid, uuid
) from public, anon;
grant execute on function public.fn_create_owner_report_snapshot(
  uuid, uuid, date, date, text
) to authenticated;
grant execute on function public.fn_create_payment_receipt_snapshot(
  uuid, uuid
) to authenticated;

create or replace function public.fn_finalize_managed_document_server(
  p_registry_id uuid,
  p_storage_path text,
  p_file_hash text,
  p_actor_id uuid,
  p_agency_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_entry public.document_registry;
  v_folder text;
  v_owner_account boolean := false;
begin
  if p_actor_id is null or p_agency_id is null then
    raise exception 'DOCUMENT_FINALIZE_FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_profiles up
    where up.id = p_actor_id
      and up.agency_id = p_agency_id
      and coalesce(up.actif, true) = true
  ) then
    raise exception 'DOCUMENT_FINALIZE_FORBIDDEN' using errcode = '42501';
  end if;

  select coalesce(a.is_bailleur_account, false)
    into v_owner_account
  from public.agencies a
  where a.id = p_agency_id;

  if not (
    public.fn_user_can(p_actor_id, 'documents', 'export')
    or v_owner_account
  ) then
    raise exception 'DOCUMENT_FINALIZE_FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_entry
  from public.document_registry
  where id = p_registry_id
    and agency_id = p_agency_id
  for update;

  if not found or v_entry.status <> 'pending' then
    raise exception 'DOCUMENT_RESERVATION_INVALID' using errcode = '55000';
  end if;
  if p_file_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'DOCUMENT_HASH_INVALID' using errcode = '22023';
  end if;
  if public.document_storage_agency_id(p_storage_path) is distinct from p_agency_id then
    raise exception 'DOCUMENT_STORAGE_PATH_INVALID' using errcode = '42501';
  end if;

  v_folder := case v_entry.document_type
    when 'contrat' then 'contrats'
    when 'mandat' then 'mandats'
    when 'quittance' then 'quittances'
    when 'facture' then 'factures'
    when 'rapport_bailleur' then 'rapports-bailleurs'
    else 'exports'
  end;

  if p_storage_path not like concat(
    'agencies/', p_agency_id::text, '/', v_folder, '/%'
  ) then
    raise exception 'DOCUMENT_STORAGE_FOLDER_INVALID' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'documents'
      and name = p_storage_path
  ) then
    raise exception 'DOCUMENT_STORAGE_OBJECT_MISSING' using errcode = 'P0002';
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

revoke all on function public.fn_finalize_managed_document(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.fn_finalize_managed_document_server(
  uuid, text, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.fn_finalize_managed_document_server(
  uuid, text, text, uuid, uuid
) to service_role;

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
  if auth.uid() is null
    or p_agency_id is null
    or p_agency_id <> public.current_user_agency_id()
    or not (
      public.fn_user_can(auth.uid(), 'documents', 'export')
      or public.current_user_is_individual_landlord_account()
    )
  then
    raise exception 'DOCUMENT_VERIFICATION_FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(btrim(p_document_ref), '') is null
    or nullif(btrim(p_payload_hash), '') is null
    or nullif(btrim(p_agency_name), '') is null then
    raise exception 'DOCUMENT_VERIFICATION_FIELDS_REQUIRED' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_agency_id::text || ':' || p_document_type || ':' || p_document_ref,
    0
  ));

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
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object('superseded_at', now())
  where agency_id = p_agency_id
    and document_ref = btrim(p_document_ref)
    and document_type = p_document_type
    and document_status = 'authentic';

  v_id := gen_random_uuid();
  v_token := encode(digest(
    v_id::text || ':' || gen_random_uuid()::text || ':' || clock_timestamp()::text,
    'sha256'
  ), 'hex');

  insert into public.document_verifications(
    id, token, agency_id, document_ref, document_type, agency_name, issued_at,
    amount_xof, payment_status, document_status, payload_hash, metadata, created_by
  ) values (
    v_id, v_token, p_agency_id, btrim(p_document_ref), p_document_type,
    btrim(p_agency_name), coalesce(p_issued_at, now()), p_amount_xof,
    p_payment_status, 'authentic', p_payload_hash,
    coalesce(p_metadata, '{}'::jsonb), auth.uid()
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
declare
  v_actor uuid := auth.uid();
  v_can_manage boolean := false;
begin
  v_can_manage := public.fn_user_can(v_actor, 'documents', 'manage');
  if v_actor is null
    or not (
      public.fn_user_can(v_actor, 'documents', 'export')
      or public.current_user_is_individual_landlord_account()
    )
  then
    raise exception 'DOCUMENT_VERIFICATION_FORBIDDEN' using errcode = '42501';
  end if;

  update public.document_verifications dv
  set document_registry_id = p_registry_id,
      registry_version = p_registry_version,
      template_checksum = p_template_checksum,
      metadata = coalesce(dv.metadata, '{}'::jsonb)
        || coalesce(p_metadata, '{}'::jsonb)
  where dv.id = p_verification_id
    and dv.agency_id = public.current_user_agency_id()
    and (dv.created_by = v_actor or v_can_manage)
    and exists (
      select 1
      from public.document_registry dr
      where dr.id = p_registry_id
        and dr.agency_id = dv.agency_id
    );

  if not found then
    raise exception 'DOCUMENT_VERIFICATION_NOT_FOUND' using errcode = 'P0002';
  end if;
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
declare
  v_actor uuid := auth.uid();
  v_can_manage boolean := false;
begin
  if nullif(btrim(p_reason), '') is null then
    raise exception 'DOCUMENT_REVOCATION_REASON_REQUIRED' using errcode = '22023';
  end if;

  v_can_manage := public.fn_user_can(v_actor, 'documents', 'manage');
  if v_actor is null
    or not (
      public.fn_user_can(v_actor, 'documents', 'export')
      or public.current_user_is_individual_landlord_account()
    )
  then
    raise exception 'DOCUMENT_VERIFICATION_FORBIDDEN' using errcode = '42501';
  end if;

  update public.document_verifications dv
  set document_status = 'revoked',
      metadata = coalesce(dv.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'revoked_at', now(),
          'reason', btrim(p_reason),
          'revoked_by', v_actor
        )
  where dv.id = p_verification_id
    and dv.agency_id = public.current_user_agency_id()
    and (dv.created_by = v_actor or v_can_manage);

  if not found then
    raise exception 'DOCUMENT_VERIFICATION_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.register_document_verification_command(
  uuid, text, text, text, timestamptz, numeric, text, text, jsonb
) from public, anon;
revoke all on function public.link_document_verification_registry_command(
  uuid, uuid, integer, text, jsonb
) from public, anon;
revoke all on function public.revoke_document_verification_command(
  uuid, text
) from public, anon;
grant execute on function public.register_document_verification_command(
  uuid, text, text, text, timestamptz, numeric, text, text, jsonb
) to authenticated;
grant execute on function public.link_document_verification_registry_command(
  uuid, uuid, integer, text, jsonb
) to authenticated;
grant execute on function public.revoke_document_verification_command(
  uuid, text
) to authenticated;

