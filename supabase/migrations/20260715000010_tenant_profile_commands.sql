-- Tenant-owned profile commands. These commands keep onboarding, owner profile,
-- legal consent and demo-state writes server-side and transactionally scoped.

begin;

create or replace function samay_tenant.assert_tenant_actor()
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

  select up.agency_id
    into v_agency_id
    from public.user_profiles up
    join public.agencies a on a.id = up.agency_id
   where up.id = auth.uid()
     and coalesce(up.actif, true) = true
     and up.role::text in ('admin', 'agent', 'comptable', 'bailleur')
     and coalesce(a.status, 'active') in ('active', 'trial');

  if v_agency_id is null then
    raise exception 'ACTIVE_TENANT_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;

  return v_agency_id;
end;
$$;

-- Keep the common idempotency primitive usable by commands available to active
-- tenant members. Admin-only commands still assert the admin role themselves.
create or replace function samay_tenant.command_replay(
  p_command text,
  p_idempotency_key text,
  p_request_payload jsonb,
  p_agency_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_tenant, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_agency uuid := samay_tenant.assert_tenant_actor();
  v_existing samay_tenant.command_idempotency%rowtype;
begin
  if p_agency_id is null or p_agency_id <> v_actor_agency then
    raise exception 'TENANT_COMMAND_SCOPE_MISMATCH' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_idempotency_key, ''))) not between 12 and 160 then
    raise exception 'TENANT_IDEMPOTENCY_KEY_INVALID' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || ':' || trim(p_idempotency_key), 0)
  );

  select *
    into v_existing
    from samay_tenant.command_idempotency
   where actor_user_id = v_actor
     and idempotency_key = trim(p_idempotency_key);

  if found then
    if v_existing.agency_id <> p_agency_id
       or v_existing.command <> p_command
       or v_existing.request_payload <> coalesce(p_request_payload, '{}'::jsonb) then
      raise exception 'TENANT_IDEMPOTENCY_CONFLICT' using errcode = '22023';
    end if;
    if v_existing.completed_at is null then
      raise exception 'TENANT_COMMAND_ALREADY_RUNNING' using errcode = '55P03';
    end if;
    return v_existing.result;
  end if;

  insert into samay_tenant.command_idempotency (
    actor_user_id, agency_id, idempotency_key, command, request_payload
  ) values (
    v_actor, p_agency_id, trim(p_idempotency_key), p_command,
    coalesce(p_request_payload, '{}'::jsonb)
  );

  return null;
end;
$$;

revoke all on function samay_tenant.assert_tenant_actor() from public, anon, authenticated;
revoke all on function samay_tenant.command_replay(text, text, jsonb, uuid) from public, anon, authenticated;

create or replace function public.tenant_complete_onboarding(
  p_agency_name text,
  p_logo_url text,
  p_phone text,
  p_address text,
  p_representative_name text,
  p_currency text,
  p_city text,
  p_completed_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_tenant, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_agency_id uuid := samay_tenant.assert_agency_admin();
  v_agency public.agencies%rowtype;
  v_name text := trim(coalesce(p_agency_name, ''));
  v_logo text := nullif(trim(coalesce(p_logo_url, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_address text := nullif(trim(coalesce(p_address, '')), '');
  v_representative text := nullif(trim(coalesce(p_representative_name, '')), '');
  v_currency text := upper(trim(coalesce(p_currency, 'XOF')));
  v_city text := nullif(trim(coalesce(p_city, '')), '');
  v_completed_at timestamptz := coalesce(p_completed_at, now());
  v_is_owner boolean;
  v_payload jsonb;
  v_replay jsonb;
begin
  if char_length(v_name) not between 2 and 160 then
    raise exception 'ORGANIZATION_NAME_INVALID' using errcode = '22023';
  end if;
  if v_logo is not null and v_logo not like v_agency_id::text || '/%' then
    raise exception 'IDENTITY_ASSET_SCOPE_MISMATCH' using errcode = '42501';
  end if;
  if v_phone is not null and (char_length(v_phone) not between 7 and 24 or v_phone !~ '^[0-9+() .-]+$') then
    raise exception 'ORGANIZATION_PHONE_INVALID' using errcode = '22023';
  end if;
  if v_address is not null and char_length(v_address) > 300 then
    raise exception 'ORGANIZATION_ADDRESS_TOO_LONG' using errcode = '22023';
  end if;
  if v_representative is not null and char_length(v_representative) > 160 then
    raise exception 'REPRESENTATIVE_NAME_TOO_LONG' using errcode = '22023';
  end if;
  if v_currency not in ('XOF', 'EUR', 'USD') then
    raise exception 'ORGANIZATION_CURRENCY_INVALID' using errcode = '22023';
  end if;
  if v_city is not null and char_length(v_city) > 100 then
    raise exception 'ORGANIZATION_CITY_TOO_LONG' using errcode = '22023';
  end if;
  if v_completed_at > now() + interval '5 minutes' then
    raise exception 'ONBOARDING_COMPLETION_DATE_INVALID' using errcode = '22023';
  end if;

  select * into v_agency from public.agencies where id = v_agency_id for update;
  if not found then raise exception 'AGENCY_NOT_FOUND' using errcode = 'P0002'; end if;
  v_is_owner := coalesce(v_agency.is_bailleur_account, false)
    or coalesce(v_agency.organization_type, '') in ('individual_landlord', 'multi_property_landlord');

  v_payload := jsonb_build_object(
    'profile_hash', encode(extensions.digest(concat_ws('|', v_name, v_logo, v_phone, v_address,
      v_representative, v_currency, v_city, v_completed_at::text), 'sha256'), 'hex')
  );
  v_replay := samay_tenant.command_replay(
    'tenant_complete_onboarding', p_idempotency_key, v_payload, v_agency_id
  );
  if v_replay is not null then return v_replay; end if;

  update public.agencies
     set name = v_name,
         logo_url = v_logo,
         phone = case when v_is_owner then coalesce(v_phone, phone) else phone end,
         address = case when v_is_owner then v_address else address end,
         updated_at = now()
   where id = v_agency_id;

  insert into public.agency_settings (
    agency_id, nom_agence, representant_nom, devise, city, logo_url,
    telephone, adresse, onboarding_completed_at
  ) values (
    v_agency_id, v_name, case when v_is_owner then null else v_representative end,
    v_currency, v_city, v_logo, case when v_is_owner then v_phone else null end,
    case when v_is_owner then v_address else null end, v_completed_at
  )
  on conflict (agency_id) do update
    set nom_agence = excluded.nom_agence,
        representant_nom = excluded.representant_nom,
        devise = excluded.devise,
        city = excluded.city,
        logo_url = excluded.logo_url,
        telephone = case when v_is_owner then excluded.telephone else public.agency_settings.telephone end,
        adresse = case when v_is_owner then excluded.adresse else public.agency_settings.adresse end,
        onboarding_completed_at = excluded.onboarding_completed_at;

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    v_agency_id, 'organization.onboarding_completed', 'agencies', v_agency_id,
    jsonb_build_object('account_mode', case when v_is_owner then 'owner' else 'agency' end), v_actor
  );

  return samay_tenant.command_complete(
    p_idempotency_key,
    jsonb_build_object('agency_id', v_agency_id, 'completed_at', v_completed_at, 'logo_url', v_logo)
  );
end;
$$;

create or replace function public.tenant_mark_onboarding_complete(
  p_completed_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_tenant, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_agency_id uuid := samay_tenant.assert_agency_admin();
  v_completed_at timestamptz := coalesce(p_completed_at, now());
  v_payload jsonb;
  v_replay jsonb;
begin
  if v_completed_at > now() + interval '5 minutes' then
    raise exception 'ONBOARDING_COMPLETION_DATE_INVALID' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('completed_at', v_completed_at);
  v_replay := samay_tenant.command_replay(
    'tenant_mark_onboarding_complete', p_idempotency_key, v_payload, v_agency_id
  );
  if v_replay is not null then return v_replay; end if;

  insert into public.agency_settings (agency_id, onboarding_completed_at)
  values (v_agency_id, v_completed_at)
  on conflict (agency_id) do update
    set onboarding_completed_at = excluded.onboarding_completed_at;

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    v_agency_id, 'organization.onboarding_deferred', 'agencies', v_agency_id,
    jsonb_build_object('completed_at', v_completed_at), v_actor
  );

  return samay_tenant.command_complete(
    p_idempotency_key,
    jsonb_build_object('agency_id', v_agency_id, 'completed_at', v_completed_at)
  );
end;
$$;

create or replace function public.tenant_update_owner_profile(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_logo_url text,
  p_owner_bailleur_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_tenant, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_agency_id uuid := samay_tenant.assert_tenant_actor();
  v_profile public.user_profiles%rowtype;
  v_agency public.agencies%rowtype;
  v_owner public.bailleurs%rowtype;
  v_first_name text := nullif(trim(coalesce(p_first_name, '')), '');
  v_last_name text := nullif(trim(coalesce(p_last_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_address text := nullif(trim(coalesce(p_address, '')), '');
  v_logo text := nullif(trim(coalesce(p_logo_url, '')), '');
  v_full_name text;
  v_payload jsonb;
  v_replay jsonb;
begin
  select * into v_profile from public.user_profiles where id = v_actor for update;
  select * into v_agency from public.agencies where id = v_agency_id for update;
  if not found then raise exception 'AGENCY_NOT_FOUND' using errcode = 'P0002'; end if;

  if v_profile.role::text not in ('admin', 'bailleur') then
    raise exception 'OWNER_PROFILE_ACCESS_DENIED' using errcode = '42501';
  end if;

  if not (
    coalesce(v_agency.is_bailleur_account, false)
    or coalesce(v_agency.organization_type, '') in ('individual_landlord', 'multi_property_landlord')
  ) then
    raise exception 'INDIVIDUAL_OWNER_ACCOUNT_REQUIRED' using errcode = '42501';
  end if;
  if v_first_name is null and v_last_name is null then
    raise exception 'OWNER_NAME_REQUIRED' using errcode = '22023';
  end if;
  if greatest(char_length(coalesce(v_first_name, '')), char_length(coalesce(v_last_name, ''))) > 100 then
    raise exception 'OWNER_NAME_TOO_LONG' using errcode = '22023';
  end if;
  if v_phone is not null and (char_length(v_phone) not between 7 and 24 or v_phone !~ '^[0-9+() .-]+$') then
    raise exception 'OWNER_PHONE_INVALID' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'OWNER_EMAIL_INVALID' using errcode = '22023';
  end if;
  if v_address is not null and char_length(v_address) > 300 then
    raise exception 'OWNER_ADDRESS_TOO_LONG' using errcode = '22023';
  end if;
  if v_logo is not null and v_logo not like v_agency_id::text || '/%' then
    raise exception 'IDENTITY_ASSET_SCOPE_MISMATCH' using errcode = '42501';
  end if;

  if p_owner_bailleur_id is not null then
    select * into v_owner
      from public.bailleurs
     where id = p_owner_bailleur_id
       and agency_id = v_agency_id
       and coalesce(is_account_owner, false) = true
       and (account_user_id is null or account_user_id = v_actor)
     for update;
    if not found then raise exception 'OWNER_PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;
  else
    select * into v_owner
      from public.bailleurs
     where agency_id = v_agency_id
       and coalesce(is_account_owner, false) = true
       and (account_user_id is null or account_user_id = v_actor)
     order by created_at asc
     limit 1
     for update;
  end if;

  v_first_name := coalesce(v_first_name, nullif(trim(v_profile.prenom), ''), 'Propriétaire');
  v_last_name := coalesce(v_last_name, nullif(trim(v_profile.nom), ''), 'Principal');
  v_full_name := trim(v_first_name || ' ' || v_last_name);
  v_payload := jsonb_build_object(
    'profile_hash', encode(extensions.digest(concat_ws('|', v_first_name, v_last_name, v_phone,
      v_email, v_address, v_logo, p_owner_bailleur_id::text), 'sha256'), 'hex')
  );
  v_replay := samay_tenant.command_replay(
    'tenant_update_owner_profile', p_idempotency_key, v_payload, v_agency_id
  );
  if v_replay is not null then return v_replay; end if;

  update public.agencies
     set name = v_full_name,
         phone = coalesce(v_phone, phone),
         address = v_address,
         logo_url = v_logo,
         updated_at = now()
   where id = v_agency_id;

  insert into public.agency_settings (
    agency_id, nom_agence, telephone, email, adresse, logo_url
  ) values (
    v_agency_id, v_full_name, v_phone, v_email, v_address, v_logo
  )
  on conflict (agency_id) do update
    set nom_agence = excluded.nom_agence,
        telephone = coalesce(excluded.telephone, public.agency_settings.telephone),
        email = excluded.email,
        adresse = excluded.adresse,
        logo_url = excluded.logo_url;

  update public.user_profiles
     set prenom = v_first_name,
         nom = v_last_name,
         telephone = coalesce(v_phone, telephone),
         updated_at = now()
   where id = v_actor;

  if v_owner.id is not null then
    update public.bailleurs
       set prenom = v_first_name,
           nom = v_last_name,
           telephone = coalesce(v_phone, telephone),
           email = v_email,
           adresse = v_address,
           account_user_id = coalesce(account_user_id, v_actor),
           updated_at = now()
     where id = v_owner.id;
  end if;

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    v_agency_id, 'owner.profile_updated', 'user_profiles', v_actor,
    jsonb_build_object('owner_bailleur_id', v_owner.id, 'identity_asset_configured', v_logo is not null),
    v_actor
  );

  return samay_tenant.command_complete(
    p_idempotency_key,
    jsonb_build_object(
      'agency_id', v_agency_id, 'owner_bailleur_id', v_owner.id,
      'first_name', v_first_name, 'last_name', v_last_name,
      'full_name', v_full_name, 'phone', v_phone, 'email', v_email,
      'address', v_address, 'logo_url', v_logo
    )
  );
end;
$$;

create or replace function public.tenant_accept_legal_terms(
  p_accepted_terms_at timestamptz,
  p_accepted_privacy_at timestamptz,
  p_terms_version text,
  p_privacy_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.user_profiles%rowtype;
  v_terms_at timestamptz := p_accepted_terms_at;
  v_privacy_at timestamptz := coalesce(p_accepted_privacy_at, p_accepted_terms_at);
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if v_terms_at is null or v_privacy_at is null
     or v_terms_at > now() + interval '5 minutes'
     or v_privacy_at > now() + interval '5 minutes' then
    raise exception 'LEGAL_ACCEPTANCE_DATE_INVALID' using errcode = '22023';
  end if;
  if char_length(coalesce(p_terms_version, '')) > 64
     or char_length(coalesce(p_privacy_version, '')) > 64 then
    raise exception 'LEGAL_VERSION_INVALID' using errcode = '22023';
  end if;

  update public.user_profiles
     set accepted_terms_at = coalesce(accepted_terms_at, v_terms_at),
         accepted_privacy_at = coalesce(accepted_privacy_at, v_privacy_at),
         terms_version = coalesce(terms_version, nullif(trim(p_terms_version), '')),
         privacy_version = coalesce(privacy_version, nullif(trim(p_privacy_version), '')),
         updated_at = now()
   where id = v_actor
   returning * into v_profile;
  if not found then raise exception 'USER_PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;

  if v_profile.agency_id is not null then
    insert into public.event_log (
      agency_id, event_type, entity_type, entity_id, payload, created_by
    ) values (
      v_profile.agency_id, 'legal.acceptance_recorded', 'user_profiles', v_actor,
      jsonb_build_object('terms_version', v_profile.terms_version, 'privacy_version', v_profile.privacy_version),
      v_actor
    );
  end if;

  return jsonb_build_object(
    'accepted_terms_at', v_profile.accepted_terms_at,
    'accepted_privacy_at', v_profile.accepted_privacy_at,
    'terms_version', v_profile.terms_version,
    'privacy_version', v_profile.privacy_version
  );
end;
$$;

create or replace function public.tenant_mark_demo_data_loaded(
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_tenant, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_agency_id uuid := samay_tenant.assert_agency_admin();
  v_payload jsonb := '{}'::jsonb;
  v_replay jsonb;
begin
  v_replay := samay_tenant.command_replay(
    'tenant_mark_demo_data_loaded', p_idempotency_key, v_payload, v_agency_id
  );
  if v_replay is not null then return v_replay; end if;

  update public.agencies
     set demo_data_loaded = true, updated_at = now()
   where id = v_agency_id;
  if not found then raise exception 'AGENCY_NOT_FOUND' using errcode = 'P0002'; end if;

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    v_agency_id, 'demo.data_loaded', 'agencies', v_agency_id, '{}'::jsonb, v_actor
  );

  return samay_tenant.command_complete(
    p_idempotency_key,
    jsonb_build_object('agency_id', v_agency_id, 'demo_data_loaded', true)
  );
end;
$$;

revoke all on function public.tenant_complete_onboarding(text, text, text, text, text, text, text, timestamptz, text) from public, anon;
revoke all on function public.tenant_mark_onboarding_complete(timestamptz, text) from public, anon;
revoke all on function public.tenant_update_owner_profile(text, text, text, text, text, text, uuid, text) from public, anon;
revoke all on function public.tenant_accept_legal_terms(timestamptz, timestamptz, text, text) from public, anon;
revoke all on function public.tenant_mark_demo_data_loaded(text) from public, anon;

grant execute on function public.tenant_complete_onboarding(text, text, text, text, text, text, text, timestamptz, text) to authenticated;
grant execute on function public.tenant_mark_onboarding_complete(timestamptz, text) to authenticated;
grant execute on function public.tenant_update_owner_profile(text, text, text, text, text, text, uuid, text) to authenticated;
grant execute on function public.tenant_accept_legal_terms(timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.tenant_mark_demo_data_loaded(text) to authenticated;

commit;
