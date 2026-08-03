-- Tenant administration hardening: invitations, per-member permissions,
-- member deactivation and manual subscription proofs are server commands.

begin;

create schema if not exists samay_tenant;

create table if not exists samay_tenant.command_idempotency (
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  idempotency_key text not null,
  command text not null,
  request_payload jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (actor_user_id, idempotency_key),
  constraint tenant_command_idempotency_key_length
    check (char_length(idempotency_key) between 12 and 160)
);

alter table samay_tenant.command_idempotency enable row level security;
alter table samay_tenant.command_idempotency force row level security;
revoke all on schema samay_tenant from public, anon, authenticated;
revoke all on table samay_tenant.command_idempotency from public, anon, authenticated;
grant all on schema samay_tenant to service_role;
grant all on table samay_tenant.command_idempotency to service_role;

create or replace function samay_tenant.assert_agency_admin()
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
   where up.id = auth.uid()
     and up.role = 'admin'
     and coalesce(up.actif, true) = true;

  if v_agency_id is null then
    raise exception 'AGENCY_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  return v_agency_id;
end;
$$;

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
  v_actor_agency uuid := samay_tenant.assert_agency_admin();
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

create or replace function samay_tenant.command_complete(
  p_idempotency_key text,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_tenant, pg_temp
as $$
begin
  update samay_tenant.command_idempotency
     set result = coalesce(p_result, '{}'::jsonb),
         completed_at = now()
   where actor_user_id = auth.uid()
     and idempotency_key = trim(p_idempotency_key)
     and completed_at is null;

  if not found then
    raise exception 'TENANT_IDEMPOTENCY_COMPLETION_FAILED' using errcode = 'P0001';
  end if;
  return coalesce(p_result, '{}'::jsonb);
end;
$$;

revoke all on function samay_tenant.assert_agency_admin() from public, anon, authenticated;
revoke all on function samay_tenant.command_replay(text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function samay_tenant.command_complete(text, jsonb) from public, anon, authenticated;

create or replace function public.tenant_create_invitation(
  p_email text,
  p_role text,
  p_message text default null,
  p_days_valid integer default 7,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_tenant, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_agency_id uuid := samay_tenant.assert_agency_admin();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := lower(trim(coalesce(p_role, '')));
  v_payload jsonb;
  v_replay jsonb;
  v_token text;
  v_invitation public.invitations%rowtype;
  v_max_users integer := 1;
  v_seat_count integer := 0;
begin
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'INVITATION_EMAIL_INVALID' using errcode = '22023';
  end if;
  if v_role not in ('admin', 'agent', 'comptable') then
    raise exception 'INVITATION_ROLE_INVALID' using errcode = '22023';
  end if;
  if p_days_valid not between 1 and 30 then
    raise exception 'INVITATION_EXPIRY_INVALID' using errcode = '22023';
  end if;
  if char_length(coalesce(p_message, '')) > 2000 then
    raise exception 'INVITATION_MESSAGE_TOO_LONG' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'email', v_email, 'role', v_role, 'message', nullif(trim(p_message), ''),
    'days_valid', p_days_valid
  );
  v_replay := samay_tenant.command_replay(
    'tenant_create_invitation', p_idempotency_key, v_payload, v_agency_id
  );
  if v_replay is not null then return v_replay; end if;

  perform pg_advisory_xact_lock(hashtextextended('tenant-seats:' || v_agency_id::text, 0));

  select coalesce(sp.max_users, 1)
    into v_max_users
    from public.agencies a
    left join public.subscriptions s on s.agency_id = a.id
    left join public.subscription_plans sp on sp.id = coalesce(s.plan_id, a.plan)
   where a.id = v_agency_id;

  select count(*)::integer
    into v_seat_count
    from (
      select up.id::text
        from public.user_profiles up
       where up.agency_id = v_agency_id and coalesce(up.actif, true) = true
      union all
      select i.id::text
        from public.invitations i
       where i.agency_id = v_agency_id
         and i.status = 'pending'
         and coalesce(i.expires_at, now() + interval '1 day') > now()
    ) seats;

  if v_max_users <> -1 and v_seat_count >= v_max_users then
    raise exception 'SUBSCRIPTION_SEAT_LIMIT_REACHED' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.user_profiles up
     where up.agency_id = v_agency_id
       and lower(coalesce(up.email, '')) = v_email
       and coalesce(up.actif, true) = true
  ) then
    raise exception 'INVITATION_MEMBER_ALREADY_ACTIVE' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.invitations i
     where i.agency_id = v_agency_id and lower(i.email) = v_email
       and i.status = 'pending' and coalesce(i.expires_at, now() + interval '1 day') > now()
  ) then
    raise exception 'INVITATION_ALREADY_PENDING' using errcode = '23505';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.invitations (
    email, agency_id, role, token, invited_by, message, expires_at, status
  ) values (
    v_email, v_agency_id, v_role, v_token, v_actor, nullif(trim(p_message), ''),
    now() + make_interval(days => p_days_valid), 'pending'
  ) returning * into v_invitation;

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    v_agency_id, 'team.invitation_created', 'invitations', v_invitation.id,
    jsonb_build_object('email', v_email, 'role', v_role, 'expires_at', v_invitation.expires_at),
    v_actor
  );

  return samay_tenant.command_complete(
    p_idempotency_key,
    jsonb_build_object(
      'id', v_invitation.id, 'email', v_invitation.email, 'role', v_invitation.role,
      'token', v_invitation.token, 'expires_at', v_invitation.expires_at
    )
  );
end;
$$;

create or replace function public.tenant_replace_user_page_permissions(
  p_target_user_id uuid,
  p_permissions jsonb,
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
  v_target public.user_profiles%rowtype;
  v_payload jsonb;
  v_replay jsonb;
  v_item jsonb;
  v_page text;
  v_level text;
  v_create boolean;
  v_update boolean;
  v_delete boolean;
  v_export boolean;
  v_manage boolean;
  v_settings public.agency_settings%rowtype;
  v_result jsonb;
  v_known_pages constant text[] := array[
    'dashboard','bailleurs','patrimoine','immeubles','unites','locataires','contrats',
    'occupants-baux','paiements','loyers-impayes','depenses','commissions','documents',
    'documents/scan','documents/studio','notifications','calendrier','interventions',
    'inventaires','audit','parametres','equipe','abonnement','pricing'
  ];
begin
  if p_target_user_id is null or jsonb_typeof(p_permissions) <> 'array'
     or jsonb_array_length(p_permissions) > 60 then
    raise exception 'PERMISSION_PAYLOAD_INVALID' using errcode = '22023';
  end if;

  select * into v_target from public.user_profiles where id = p_target_user_id for update;
  if not found or v_target.agency_id <> v_agency_id then
    raise exception 'TEAM_MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_target_user_id = v_actor or v_target.role in ('admin', 'super_admin') then
    raise exception 'PROTECTED_ADMIN_PERMISSIONS' using errcode = '42501';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_permissions) item
    group by item->>'page' having count(*) > 1
  ) then
    raise exception 'DUPLICATE_PERMISSION_PAGE' using errcode = '22023';
  end if;

  select * into v_settings from public.agency_settings where agency_id = v_agency_id;
  v_payload := jsonb_build_object('target_user_id', p_target_user_id, 'permissions', p_permissions);
  v_replay := samay_tenant.command_replay(
    'tenant_replace_user_page_permissions', p_idempotency_key, v_payload, v_agency_id
  );
  if v_replay is not null then return v_replay; end if;

  delete from public.user_page_permissions
   where agency_id = v_agency_id and user_id = p_target_user_id;

  for v_item in select value from jsonb_array_elements(p_permissions)
  loop
    v_page := v_item->>'page';
    v_level := v_item->>'access_level';
    v_create := coalesce((v_item->>'can_create')::boolean, false);
    v_update := coalesce((v_item->>'can_update')::boolean, false);
    v_delete := coalesce((v_item->>'can_delete')::boolean, false);
    v_export := coalesce((v_item->>'can_export')::boolean, false);
    v_manage := coalesce((v_item->>'can_manage')::boolean, false);

    if not (v_page = any(v_known_pages)) or v_level not in ('none','read','write','admin') then
      raise exception 'PERMISSION_ENTRY_INVALID' using errcode = '22023';
    end if;
    if (v_page = 'depenses' and coalesce(v_settings.module_depenses_actif, true) = false)
       or (v_page = 'inventaires' and coalesce(v_settings.module_inventaires_actif, true) = false)
       or (v_page = 'interventions' and coalesce(v_settings.module_interventions_actif, true) = false)
       or (v_page = 'commissions' and coalesce((v_settings.enabled_modules->>'commissions')::boolean, true) = false)
       or (v_page = 'calendrier' and coalesce((v_settings.enabled_modules->>'planning')::boolean, true) = false)
       or (v_page = 'audit' and coalesce((v_settings.enabled_modules->>'audit_trail')::boolean, false) = false)
       or (v_page = 'documents/scan' and (
         coalesce((v_settings.enabled_modules->>'document_scanner')::boolean, true) = false
         or coalesce(v_settings.qr_code_quittances, true) = false
       )) then
      raise exception 'MODULE_DISABLED_FOR_PERMISSION:%', v_page using errcode = '23514';
    end if;
    if (v_level = 'none' and (v_create or v_update or v_delete or v_export or v_manage))
       or (v_level = 'read' and (v_create or v_update or v_delete or v_manage))
       or (v_level = 'write' and (v_delete or v_manage)) then
      raise exception 'PERMISSION_ACTION_LEVEL_MISMATCH:%', v_page using errcode = '23514';
    end if;

    insert into public.user_page_permissions (
      agency_id, user_id, page, access_level, can_create, can_update,
      can_delete, can_export, can_manage, created_by
    ) values (
      v_agency_id, p_target_user_id, v_page, v_level,
      v_create, v_update, v_delete, v_export, v_manage, v_actor
    );
  end loop;

  select coalesce(jsonb_agg(to_jsonb(upp) - 'agency_id' - 'user_id' - 'created_by'), '[]'::jsonb)
    into v_result
    from public.user_page_permissions upp
   where upp.agency_id = v_agency_id and upp.user_id = p_target_user_id;

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    v_agency_id, 'team.permissions_replaced', 'user_profiles', p_target_user_id,
    jsonb_build_object('permission_count', jsonb_array_length(v_result)), v_actor
  );

  return samay_tenant.command_complete(
    p_idempotency_key,
    jsonb_build_object('target_user_id', p_target_user_id, 'permissions', v_result)
  );
end;
$$;

create or replace function public.tenant_deactivate_member(
  p_target_user_id uuid,
  p_reason text,
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
  v_target public.user_profiles%rowtype;
  v_payload jsonb;
  v_replay jsonb;
begin
  if char_length(trim(coalesce(p_reason, ''))) not between 5 and 300 then
    raise exception 'DEACTIVATION_REASON_INVALID' using errcode = '22023';
  end if;
  select * into v_target from public.user_profiles where id = p_target_user_id for update;
  if not found or v_target.agency_id <> v_agency_id then
    raise exception 'TEAM_MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_target_user_id = v_actor or v_target.role = 'super_admin' then
    raise exception 'PROTECTED_ACCOUNT' using errcode = '42501';
  end if;
  if v_target.role = 'admin' and not exists (
    select 1 from public.user_profiles up
     where up.agency_id = v_agency_id and up.role = 'admin'
       and coalesce(up.actif, true) = true and up.id <> p_target_user_id
  ) then
    raise exception 'LAST_ADMIN_CANNOT_BE_DEACTIVATED' using errcode = '23514';
  end if;

  v_payload := jsonb_build_object('target_user_id', p_target_user_id, 'reason', trim(p_reason));
  v_replay := samay_tenant.command_replay(
    'tenant_deactivate_member', p_idempotency_key, v_payload, v_agency_id
  );
  if v_replay is not null then return v_replay; end if;

  perform set_config('samay.admin_command', 'on', true);
  update public.user_profiles set actif = false where id = p_target_user_id;

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    v_agency_id, 'team.member_deactivated', 'user_profiles', p_target_user_id,
    jsonb_build_object('reason', trim(p_reason), 'previous_role', v_target.role), v_actor
  );

  return samay_tenant.command_complete(
    p_idempotency_key,
    jsonb_build_object('target_user_id', p_target_user_id, 'active', false)
  );
end;
$$;

create or replace function public.tenant_submit_subscription_payment_proof(
  p_subscription_id uuid,
  p_plan_key text,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_payment_date date,
  p_proof_file_url text,
  p_comment text,
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
  v_plan text := lower(trim(coalesce(p_plan_key, '')));
  v_method text := lower(trim(coalesce(p_method, '')));
  v_payload jsonb;
  v_replay jsonb;
  v_proof public.subscription_payment_proofs%rowtype;
begin
  if v_plan not in ('starter','pro','business','enterprise')
     or not exists (select 1 from public.subscription_plans where id = v_plan) then
    raise exception 'SUBSCRIPTION_PLAN_INVALID' using errcode = '22023';
  end if;
  if v_method not in ('orange_money','wave','djamo','card','bank_transfer','cash','manual_support','other') then
    raise exception 'PAYMENT_METHOD_INVALID' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000000 then
    raise exception 'PAYMENT_PROOF_AMOUNT_INVALID' using errcode = '22023';
  end if;
  if p_payment_date is null or p_payment_date > current_date + 1 then
    raise exception 'PAYMENT_PROOF_DATE_INVALID' using errcode = '22023';
  end if;
  if char_length(coalesce(p_reference, '')) > 160 or char_length(coalesce(p_comment, '')) > 2000 then
    raise exception 'PAYMENT_PROOF_TEXT_TOO_LONG' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_proof_file_url, '')), '') is not null
     and trim(p_proof_file_url) !~ '^https://[^[:space:]]+$' then
    raise exception 'PAYMENT_PROOF_URL_INVALID' using errcode = '22023';
  end if;
  if p_subscription_id is not null and not exists (
    select 1 from public.subscriptions s where s.id = p_subscription_id and s.agency_id = v_agency_id
  ) then
    raise exception 'SUBSCRIPTION_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_payload := jsonb_build_object(
    'subscription_id', p_subscription_id, 'plan_key', v_plan, 'amount', p_amount,
    'method', v_method, 'reference', nullif(trim(p_reference), ''),
    'payment_date', p_payment_date, 'proof_file_url', nullif(trim(p_proof_file_url), ''),
    'comment', nullif(trim(p_comment), '')
  );
  v_replay := samay_tenant.command_replay(
    'tenant_submit_subscription_payment_proof', p_idempotency_key, v_payload, v_agency_id
  );
  if v_replay is not null then return v_replay; end if;

  insert into public.subscription_payment_proofs (
    agency_id, subscription_id, plan_key, amount, currency, method, reference,
    payment_date, proof_file_url, comment, status, submitted_by
  ) values (
    v_agency_id, p_subscription_id, v_plan, p_amount, 'XOF', v_method,
    nullif(trim(p_reference), ''), p_payment_date,
    nullif(trim(p_proof_file_url), ''), nullif(trim(p_comment), ''), 'pending', v_actor
  ) returning * into v_proof;

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    v_agency_id, 'subscription.payment_proof_submitted', 'subscription_payment_proofs', v_proof.id,
    jsonb_build_object('plan_key', v_plan, 'amount', p_amount, 'method', v_method), v_actor
  );

  return samay_tenant.command_complete(
    p_idempotency_key,
    jsonb_build_object('id', v_proof.id, 'status', v_proof.status, 'created_at', v_proof.created_at)
  );
end;
$$;

-- Invitation acceptance remains a public RPC for the authenticated recipient,
-- but seat limits and cross-tenant reattachment are now enforced server-side.
create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv public.invitations%rowtype;
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_agency_name text;
  v_existing_agency uuid;
  v_max_users integer := 1;
  v_active_users integer := 0;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_token, ''))) < 20 then
    raise exception 'INVITATION_TOKEN_INVALID' using errcode = '22023';
  end if;

  select email into v_user_email from auth.users where id = v_user_id;
  select * into v_inv from public.invitations where token = trim(p_token) for update;
  if not found then raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_inv.status = 'accepted' then raise exception 'INVITATION_ALREADY_ACCEPTED' using errcode = '23505'; end if;
  if v_inv.status <> 'pending' then raise exception 'INVITATION_NOT_PENDING' using errcode = '23514'; end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    update public.invitations set status = 'expired' where id = v_inv.id;
    raise exception 'INVITATION_EXPIRED' using errcode = '22023';
  end if;
  if lower(v_inv.email) <> lower(coalesce(v_user_email, '')) then
    raise exception 'INVITATION_EMAIL_MISMATCH' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tenant-seats:' || v_inv.agency_id::text, 0));
  select up.agency_id into v_existing_agency from public.user_profiles up where up.id = v_user_id;
  if v_existing_agency is not null and v_existing_agency <> v_inv.agency_id then
    raise exception 'USER_ALREADY_ATTACHED_TO_ANOTHER_AGENCY' using errcode = '42501';
  end if;

  select coalesce(sp.max_users, 1)
    into v_max_users
    from public.agencies a
    left join public.subscriptions s on s.agency_id = a.id
    left join public.subscription_plans sp on sp.id = coalesce(s.plan_id, a.plan)
   where a.id = v_inv.agency_id;
  select count(*)::integer into v_active_users
    from public.user_profiles up
   where up.agency_id = v_inv.agency_id and coalesce(up.actif, true) = true and up.id <> v_user_id;
  if v_max_users <> -1 and v_active_users >= v_max_users then
    raise exception 'SUBSCRIPTION_SEAT_LIMIT_REACHED' using errcode = '23514';
  end if;

  perform set_config('samay.admin_command', 'on', true);
  insert into public.user_profiles (id, email, nom, prenom, role, agency_id, actif)
  values (v_user_id, v_user_email, '', '', v_inv.role::public.user_role, v_inv.agency_id, true)
  on conflict (id) do update
    set agency_id = excluded.agency_id, role = excluded.role, actif = true, updated_at = now();

  update public.invitations set status = 'accepted' where id = v_inv.id;
  select name into v_agency_name from public.agencies where id = v_inv.agency_id;

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    v_inv.agency_id, 'team.invitation_accepted', 'invitations', v_inv.id,
    jsonb_build_object('role', v_inv.role, 'email', v_inv.email), v_user_id
  );

  if to_regclass('public.owner_actions_log') is not null then
    insert into public.owner_actions_log (
      actor_id, actor_email, action, target_type, target_id, target_label, details
    ) values (
      v_user_id, v_user_email, 'invitation.accept', 'invitation', v_inv.id,
      coalesce(v_agency_name, 'agence'),
      jsonb_build_object('agency_id', v_inv.agency_id, 'role', v_inv.role, 'email', v_inv.email)
    );
  end if;

  return jsonb_build_object(
    'agency_id', v_inv.agency_id, 'agency_name', coalesce(v_agency_name, ''), 'role', v_inv.role
  );
end;
$$;

alter table public.invitations enable row level security;
alter table public.invitations force row level security;
alter table public.user_page_permissions enable row level security;
alter table public.user_page_permissions force row level security;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('invitations', 'user_page_permissions', 'subscription_payment_proofs')
       and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
  loop
    execute format('drop policy if exists %I on %I.%I', v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  end loop;
end;
$$;

revoke insert, update, delete, truncate, references, trigger
  on table public.invitations from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.user_page_permissions from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.subscription_payment_proofs from authenticated;
grant select on table public.invitations to authenticated;
grant select on table public.user_page_permissions to authenticated;
grant select on table public.subscription_payment_proofs to authenticated;

revoke all on function public.tenant_create_invitation(text, text, text, integer, text) from public, anon;
revoke all on function public.tenant_replace_user_page_permissions(uuid, jsonb, text) from public, anon;
revoke all on function public.tenant_deactivate_member(uuid, text, text) from public, anon;
revoke all on function public.tenant_submit_subscription_payment_proof(uuid, text, numeric, text, text, date, text, text, text) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.tenant_create_invitation(text, text, text, integer, text) to authenticated;
grant execute on function public.tenant_replace_user_page_permissions(uuid, jsonb, text) to authenticated;
grant execute on function public.tenant_deactivate_member(uuid, text, text) to authenticated;
grant execute on function public.tenant_submit_subscription_payment_proof(uuid, text, numeric, text, text, date, text, text, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

commit;
