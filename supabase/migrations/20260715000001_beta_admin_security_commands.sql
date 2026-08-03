-- Pre-beta hardening: authoritative admin commands, subscription RLS and
-- fail-closed owner finance reads. All changes are additive and reversible.

-- ---------------------------------------------------------------------------
-- Subscription data: readable by the tenant, writable only through commands.
-- ---------------------------------------------------------------------------

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
      from pg_policies
     where schemaname = 'public'
       and tablename = 'subscriptions'
  loop
    execute format(
      'drop policy if exists %I on public.subscriptions',
      v_policy.policyname
    );
  end loop;
end;
$$;

create policy "subscriptions_tenant_read"
  on public.subscriptions
  for select
  to authenticated
  using (
    public.is_super_admin()
    or agency_id in (
      select up.agency_id
      from public.user_profiles up
      where up.id = (select auth.uid())
        and coalesce(up.actif, true) = true
    )
  );

revoke all on table public.subscriptions from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.subscriptions from authenticated;
grant select on table public.subscriptions to authenticated;
grant all on table public.subscriptions to service_role;

alter table public.subscription_payment_proofs enable row level security;
alter table public.subscription_payment_proofs force row level security;
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
      from pg_policies
     where schemaname = 'public'
       and tablename = 'subscription_payment_proofs'
       and cmd in ('ALL', 'UPDATE', 'DELETE')
  loop
    execute format(
      'drop policy if exists %I on public.subscription_payment_proofs',
      v_policy.policyname
    );
  end loop;
end;
$$;
revoke update, delete, truncate, references, trigger
  on table public.subscription_payment_proofs from authenticated;

-- ---------------------------------------------------------------------------
-- Idempotency registry used by every critical owner command.
-- ---------------------------------------------------------------------------

create schema if not exists samay_admin;

create table if not exists samay_admin.admin_command_idempotency (
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  command text not null,
  request_payload jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (actor_user_id, idempotency_key),
  constraint admin_command_idempotency_key_length
    check (char_length(idempotency_key) between 12 and 160)
);

alter table samay_admin.admin_command_idempotency enable row level security;
alter table samay_admin.admin_command_idempotency force row level security;
revoke all on table samay_admin.admin_command_idempotency from public, anon, authenticated;
grant all on table samay_admin.admin_command_idempotency to service_role;

create or replace function samay_admin.command_replay(
  p_command text,
  p_idempotency_key text,
  p_request_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_existing samay_admin.admin_command_idempotency%rowtype;
begin
  if v_actor is null or not public.is_super_admin() then
    raise exception 'ADMIN_COMMAND_FORBIDDEN' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_idempotency_key, ''))) not between 12 and 160 then
    raise exception 'ADMIN_IDEMPOTENCY_KEY_INVALID' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || ':' || trim(p_idempotency_key), 0)
  );

  select *
    into v_existing
    from samay_admin.admin_command_idempotency
   where actor_user_id = v_actor
     and idempotency_key = trim(p_idempotency_key);

  if found then
    if v_existing.command <> p_command
       or v_existing.request_payload <> coalesce(p_request_payload, '{}'::jsonb) then
      raise exception 'ADMIN_IDEMPOTENCY_CONFLICT' using errcode = '22023';
    end if;

    if v_existing.completed_at is null then
      raise exception 'ADMIN_COMMAND_ALREADY_RUNNING' using errcode = '55P03';
    end if;

    return v_existing.result;
  end if;

  insert into samay_admin.admin_command_idempotency (
    actor_user_id,
    idempotency_key,
    command,
    request_payload
  ) values (
    v_actor,
    trim(p_idempotency_key),
    p_command,
    coalesce(p_request_payload, '{}'::jsonb)
  );

  return null;
end;
$$;

create or replace function samay_admin.command_complete(
  p_idempotency_key text,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
begin
  update samay_admin.admin_command_idempotency
     set result = coalesce(p_result, '{}'::jsonb),
         completed_at = now()
   where actor_user_id = auth.uid()
     and idempotency_key = trim(p_idempotency_key)
     and completed_at is null;

  if not found then
    raise exception 'ADMIN_IDEMPOTENCY_COMPLETION_FAILED' using errcode = 'P0001';
  end if;

  return coalesce(p_result, '{}'::jsonb);
end;
$$;

revoke all on function samay_admin.command_replay(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function samay_admin.command_complete(text, jsonb)
  from public, anon, authenticated;

-- Keep the agency catalogue aligned with the public pricing catalogue while
-- preserving the historical `basic` identifier used by existing tenants.
alter table public.agencies drop constraint if exists agencies_plan_check;
alter table public.agencies
  add constraint agencies_plan_check
  check (plan in ('basic', 'starter', 'pro', 'business', 'enterprise')) not valid;
alter table public.agencies validate constraint agencies_plan_check;

create or replace function public.admin_create_agency(
  p_name text,
  p_email text,
  p_phone text,
  p_plan text,
  p_status text,
  p_trial_days integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  v_request jsonb;
  v_replay jsonb;
  v_agency public.agencies%rowtype;
  v_trial_ends_at timestamptz;
  v_result jsonb;
begin
  v_request := jsonb_build_object(
    'name', trim(coalesce(p_name, '')),
    'email', lower(trim(coalesce(p_email, ''))),
    'phone', trim(coalesce(p_phone, '')),
    'plan', p_plan,
    'status', p_status,
    'trial_days', p_trial_days
  );
  v_replay := samay_admin.command_replay('admin_create_agency', p_idempotency_key, v_request);
  if v_replay is not null then return v_replay; end if;

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'AGENCY_NAME_INVALID' using errcode = '22023';
  end if;
  if lower(trim(coalesce(p_email, ''))) !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'AGENCY_EMAIL_INVALID' using errcode = '22023';
  end if;
  if char_length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 9 then
    raise exception 'AGENCY_PHONE_INVALID' using errcode = '22023';
  end if;
  if p_plan not in ('basic', 'starter', 'pro', 'business', 'enterprise') then
    raise exception 'AGENCY_PLAN_INVALID' using errcode = '22023';
  end if;
  if p_status not in ('active', 'trial', 'suspended', 'cancelled') then
    raise exception 'AGENCY_STATUS_INVALID' using errcode = '22023';
  end if;
  if p_status = 'trial' and coalesce(p_trial_days, 0) not between 1 and 365 then
    raise exception 'AGENCY_TRIAL_DAYS_INVALID' using errcode = '22023';
  end if;

  v_trial_ends_at := case
    when p_status = 'trial' then now() + make_interval(days => p_trial_days)
    else null
  end;

  perform set_config('samay.admin_command', 'on', true);
  insert into public.agencies (name, email, phone, plan, status, trial_ends_at)
  values (
    trim(p_name), lower(trim(p_email)), trim(p_phone), p_plan, p_status, v_trial_ends_at
  )
  returning * into v_agency;

  insert into public.subscriptions (
    agency_id, plan_id, status, current_period_start, current_period_end
  ) values (
    v_agency.id,
    p_plan,
    case when p_status in ('cancelled', 'suspended') then 'cancelled' else 'active' end,
    now(),
    coalesce(v_trial_ends_at, now() + interval '1 month')
  )
  on conflict (agency_id) do nothing;

  perform public.admin_audit_action(
    'agency_created',
    'Création du tenant depuis la console propriétaire',
    v_agency.id,
    null,
    jsonb_build_object(
      'plan', p_plan,
      'status', p_status,
      'trial_days', case when p_status = 'trial' then p_trial_days else null end,
      'idempotency_key', p_idempotency_key
    )
  );

  v_result := jsonb_build_object(
    'id', v_agency.id,
    'name', v_agency.name,
    'email', v_agency.email,
    'plan', v_agency.plan,
    'status', v_agency.status,
    'trial_ends_at', v_agency.trial_ends_at
  );
  return samay_admin.command_complete(p_idempotency_key, v_result);
end;
$$;

create or replace function public.admin_create_invitation(
  p_email text,
  p_agency_id uuid,
  p_role text,
  p_message text,
  p_days_valid integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, extensions, pg_temp
as $$
declare
  v_request jsonb;
  v_replay jsonb;
  v_invitation public.invitations%rowtype;
  v_token text;
  v_existing_id uuid;
  v_result jsonb;
begin
  v_request := jsonb_build_object(
    'email', lower(trim(coalesce(p_email, ''))),
    'agency_id', p_agency_id,
    'role', p_role,
    'message', nullif(trim(coalesce(p_message, '')), ''),
    'days_valid', p_days_valid
  );
  v_replay := samay_admin.command_replay('admin_create_invitation', p_idempotency_key, v_request);
  if v_replay is not null then return v_replay; end if;

  if lower(trim(coalesce(p_email, ''))) !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'INVITATION_EMAIL_INVALID' using errcode = '22023';
  end if;
  if p_role not in ('admin', 'agent', 'comptable') then
    raise exception 'INVITATION_ROLE_INVALID' using errcode = '22023';
  end if;
  if coalesce(p_days_valid, 0) not between 1 and 30 then
    raise exception 'INVITATION_DURATION_INVALID' using errcode = '22023';
  end if;
  if not exists (select 1 from public.agencies where id = p_agency_id) then
    raise exception 'INVITATION_AGENCY_NOT_FOUND' using errcode = 'P0002';
  end if;

  select id into v_existing_id
    from public.invitations
   where agency_id = p_agency_id
     and lower(email) = lower(trim(p_email))
     and status = 'pending'
     and expires_at > now()
   order by created_at desc
   limit 1
   for update;
  if found then
    raise exception 'INVITATION_ALREADY_PENDING' using errcode = '23505';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.invitations (
    email, agency_id, role, status, token, invited_by, message, expires_at
  ) values (
    lower(trim(p_email)),
    p_agency_id,
    p_role,
    'pending',
    v_token,
    auth.uid(),
    nullif(trim(coalesce(p_message, '')), ''),
    now() + make_interval(days => p_days_valid)
  )
  returning * into v_invitation;

  perform public.admin_audit_action(
    'user_invited',
    'Invitation créée depuis la console propriétaire',
    p_agency_id,
    null,
    jsonb_build_object(
      'invitation_id', v_invitation.id,
      'email', v_invitation.email,
      'role', v_invitation.role,
      'expires_at', v_invitation.expires_at,
      'idempotency_key', p_idempotency_key
    )
  );

  v_result := jsonb_build_object(
    'id', v_invitation.id,
    'token', v_invitation.token,
    'email', v_invitation.email,
    'expires_at', v_invitation.expires_at
  );
  return samay_admin.command_complete(p_idempotency_key, v_result);
end;
$$;

revoke all on function public.admin_create_agency(text, text, text, text, text, integer, text)
  from public, anon;
grant execute on function public.admin_create_agency(text, text, text, text, text, integer, text)
  to authenticated, service_role;
revoke all on function public.admin_create_invitation(text, uuid, text, text, integer, text)
  from public, anon;
grant execute on function public.admin_create_invitation(text, uuid, text, text, integer, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Sensitive-column guards. SECURITY DEFINER commands set a transaction-local
-- marker; direct PostgREST updates remain rejected even if a broad legacy RLS
-- policy still exists.
-- ---------------------------------------------------------------------------

create or replace function public.guard_agency_sensitive_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (
    new.status is distinct from old.status
    or new.plan is distinct from old.plan
    or new.trial_ends_at is distinct from old.trial_ends_at
  ) and coalesce(current_setting('samay.admin_command', true), '') <> 'on'
    and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'AGENCY_SENSITIVE_UPDATE_REQUIRES_COMMAND' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_agency_sensitive_update on public.agencies;
create trigger guard_agency_sensitive_update
  before update on public.agencies
  for each row execute function public.guard_agency_sensitive_update();

create or replace function public.guard_user_access_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (
    new.role is distinct from old.role
    or new.agency_id is distinct from old.agency_id
    or new.actif is distinct from old.actif
  ) and coalesce(current_setting('samay.admin_command', true), '') <> 'on'
    and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'USER_ACCESS_UPDATE_REQUIRES_COMMAND' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_user_access_update on public.user_profiles;
create trigger guard_user_access_update
  before update on public.user_profiles
  for each row execute function public.guard_user_access_update();

revoke execute on function public.guard_agency_sensitive_update() from public, anon, authenticated;
revoke execute on function public.guard_user_access_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Atomic owner commands.
-- ---------------------------------------------------------------------------

create or replace function public.admin_change_agency_status(
  p_agency_id uuid,
  p_next_status text,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  v_replay jsonb;
  v_previous text;
  v_result jsonb;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 8 then
    raise exception 'ADMIN_REASON_REQUIRED' using errcode = '22023';
  end if;
  if p_next_status not in ('active', 'suspended', 'trial', 'cancelled') then
    raise exception 'AGENCY_STATUS_INVALID' using errcode = '22023';
  end if;

  v_replay := samay_admin.command_replay(
    'change_agency_status', p_idempotency_key,
    jsonb_build_object('agency_id', p_agency_id, 'next_status', p_next_status, 'reason', trim(p_reason))
  );
  if v_replay is not null then return v_replay; end if;

  select status into v_previous from public.agencies where id = p_agency_id for update;
  if not found then raise exception 'AGENCY_NOT_FOUND' using errcode = 'P0002'; end if;

  perform set_config('samay.admin_command', 'on', true);
  update public.agencies set status = p_next_status where id = p_agency_id;

  perform public.admin_audit_action(
    'agency_status_changed', trim(p_reason), p_agency_id, null,
    jsonb_build_object('previous_status', v_previous, 'next_status', p_next_status, 'idempotency_key', p_idempotency_key)
  );

  v_result := jsonb_build_object('agency_id', p_agency_id, 'status', p_next_status);
  return samay_admin.command_complete(p_idempotency_key, v_result);
end;
$$;

create or replace function public.admin_change_agency_plan(
  p_agency_id uuid,
  p_next_plan text,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  v_replay jsonb;
  v_previous text;
  v_result jsonb;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 8 then
    raise exception 'ADMIN_REASON_REQUIRED' using errcode = '22023';
  end if;
  if not exists (select 1 from public.subscription_plans where id = p_next_plan) then
    raise exception 'SUBSCRIPTION_PLAN_INVALID' using errcode = '22023';
  end if;

  v_replay := samay_admin.command_replay(
    'change_agency_plan', p_idempotency_key,
    jsonb_build_object('agency_id', p_agency_id, 'next_plan', p_next_plan, 'reason', trim(p_reason))
  );
  if v_replay is not null then return v_replay; end if;

  select plan into v_previous from public.agencies where id = p_agency_id for update;
  if not found then raise exception 'AGENCY_NOT_FOUND' using errcode = 'P0002'; end if;

  perform set_config('samay.admin_command', 'on', true);
  update public.agencies set plan = p_next_plan where id = p_agency_id;
  insert into public.subscriptions (agency_id, plan_id, status)
  values (p_agency_id, p_next_plan, 'active')
  on conflict (agency_id) do update
    set plan_id = excluded.plan_id,
        updated_at = now();

  perform public.admin_audit_action(
    'agency_plan_changed', trim(p_reason), p_agency_id, null,
    jsonb_build_object('previous_plan', v_previous, 'next_plan', p_next_plan, 'idempotency_key', p_idempotency_key)
  );

  v_result := jsonb_build_object('agency_id', p_agency_id, 'plan', p_next_plan);
  return samay_admin.command_complete(p_idempotency_key, v_result);
end;
$$;

create or replace function public.admin_extend_agency_trial(
  p_agency_id uuid,
  p_days integer,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  v_replay jsonb;
  v_previous timestamptz;
  v_next timestamptz;
  v_result jsonb;
begin
  if p_days < 1 or p_days > 90 then
    raise exception 'TRIAL_EXTENSION_INVALID' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 8 then
    raise exception 'ADMIN_REASON_REQUIRED' using errcode = '22023';
  end if;

  v_replay := samay_admin.command_replay(
    'extend_agency_trial', p_idempotency_key,
    jsonb_build_object('agency_id', p_agency_id, 'days', p_days, 'reason', trim(p_reason))
  );
  if v_replay is not null then return v_replay; end if;

  select trial_ends_at into v_previous from public.agencies where id = p_agency_id for update;
  if not found then raise exception 'AGENCY_NOT_FOUND' using errcode = 'P0002'; end if;
  v_next := greatest(coalesce(v_previous, now()), now()) + make_interval(days => p_days);

  perform set_config('samay.admin_command', 'on', true);
  update public.agencies set status = 'trial', trial_ends_at = v_next where id = p_agency_id;

  perform public.admin_audit_action(
    'agency_trial_extended', trim(p_reason), p_agency_id, null,
    jsonb_build_object('days', p_days, 'previous_trial_ends_at', v_previous, 'trial_ends_at', v_next, 'idempotency_key', p_idempotency_key)
  );

  v_result := jsonb_build_object('agency_id', p_agency_id, 'status', 'trial', 'trial_ends_at', v_next);
  return samay_admin.command_complete(p_idempotency_key, v_result);
end;
$$;

create or replace function public.admin_review_subscription_payment_proof(
  p_proof_id uuid,
  p_decision text,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  v_replay jsonb;
  v_proof public.subscription_payment_proofs%rowtype;
  v_result jsonb;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'PAYMENT_PROOF_DECISION_INVALID' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 8 then
    raise exception 'ADMIN_REASON_REQUIRED' using errcode = '22023';
  end if;

  v_replay := samay_admin.command_replay(
    'review_subscription_payment_proof', p_idempotency_key,
    jsonb_build_object('proof_id', p_proof_id, 'decision', p_decision, 'reason', trim(p_reason))
  );
  if v_replay is not null then return v_replay; end if;

  select * into v_proof
    from public.subscription_payment_proofs
   where id = p_proof_id
   for update;
  if not found then raise exception 'PAYMENT_PROOF_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_proof.status <> 'pending' then
    raise exception 'PAYMENT_PROOF_ALREADY_REVIEWED' using errcode = '22023';
  end if;

  update public.subscription_payment_proofs
     set status = p_decision,
         reviewed_at = now(),
         reviewed_by = auth.uid(),
         rejection_reason = case when p_decision = 'rejected' then trim(p_reason) else null end
   where id = p_proof_id;

  if p_decision = 'approved' then
    perform set_config('samay.admin_command', 'on', true);
    insert into public.subscriptions (
      agency_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end
    ) values (
      v_proof.agency_id, v_proof.plan_key, 'active', now(), now() + interval '1 month', false
    )
    on conflict (agency_id) do update
      set plan_id = excluded.plan_id,
          status = 'active',
          current_period_start = excluded.current_period_start,
          current_period_end = excluded.current_period_end,
          cancel_at_period_end = false,
          updated_at = now();

    update public.agencies
       set plan = v_proof.plan_key,
           status = 'active',
           last_payment_at = now(),
           next_renewal_at = now() + interval '1 month'
     where id = v_proof.agency_id;
  end if;

  perform public.admin_audit_action(
    case when p_decision = 'approved' then 'payment_proof_approved' else 'payment_proof_rejected' end,
    trim(p_reason), v_proof.agency_id, null,
    jsonb_build_object(
      'proof_id', p_proof_id,
      'amount', v_proof.amount,
      'plan_key', v_proof.plan_key,
      'method', v_proof.method,
      'decision', p_decision,
      'idempotency_key', p_idempotency_key
    )
  );

  v_result := jsonb_build_object(
    'proof_id', p_proof_id,
    'agency_id', v_proof.agency_id,
    'status', p_decision,
    'plan', v_proof.plan_key
  );
  return samay_admin.command_complete(p_idempotency_key, v_result);
end;
$$;

create or replace function public.admin_update_user_access(
  p_target_user_id uuid,
  p_next_role text,
  p_next_active boolean,
  p_next_agency_id uuid,
  p_change_agency boolean,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  v_replay jsonb;
  v_user public.user_profiles%rowtype;
  v_effective_role text;
  v_effective_active boolean;
  v_effective_agency uuid;
  v_other_admins integer;
  v_result jsonb;
begin
  if p_next_role is not null and p_next_role not in ('admin', 'agent', 'comptable', 'bailleur') then
    raise exception 'USER_ROLE_INVALID' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 8 then
    raise exception 'ADMIN_REASON_REQUIRED' using errcode = '22023';
  end if;

  v_replay := samay_admin.command_replay(
    'update_user_access', p_idempotency_key,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'next_role', p_next_role,
      'next_active', p_next_active,
      'next_agency_id', p_next_agency_id,
      'change_agency', p_change_agency,
      'reason', trim(p_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;

  select * into v_user from public.user_profiles where id = p_target_user_id for update;
  if not found then raise exception 'USER_PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_user.role::text = 'super_admin' then
    raise exception 'SUPER_ADMIN_ACCESS_PROTECTED' using errcode = '42501';
  end if;

  v_effective_role := coalesce(p_next_role, v_user.role::text);
  v_effective_active := coalesce(p_next_active, v_user.actif, true);
  v_effective_agency := case when p_change_agency then p_next_agency_id else v_user.agency_id end;

  if v_user.role::text = 'admin'
     and coalesce(v_user.actif, true)
     and (v_effective_role <> 'admin' or not v_effective_active or v_effective_agency is distinct from v_user.agency_id) then
    perform 1 from public.user_profiles where agency_id = v_user.agency_id for update;
    select count(*) into v_other_admins
      from public.user_profiles
     where agency_id = v_user.agency_id
       and id <> v_user.id
       and role::text = 'admin'
       and coalesce(actif, true) = true;
    if v_other_admins = 0 then
      raise exception 'LAST_ACTIVE_ADMIN_PROTECTED' using errcode = '42501';
    end if;
  end if;

  if v_effective_agency is not null
     and not exists (select 1 from public.agencies where id = v_effective_agency) then
    raise exception 'AGENCY_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform set_config('samay.admin_command', 'on', true);
  update public.user_profiles
     set role = v_effective_role::public.user_role,
         actif = v_effective_active,
         agency_id = v_effective_agency
   where id = p_target_user_id;

  perform public.admin_audit_action(
    'user_access_changed', trim(p_reason), v_effective_agency, p_target_user_id,
    jsonb_build_object(
      'previous_role', v_user.role::text,
      'next_role', v_effective_role,
      'previous_active', coalesce(v_user.actif, true),
      'next_active', v_effective_active,
      'previous_agency_id', v_user.agency_id,
      'next_agency_id', v_effective_agency,
      'idempotency_key', p_idempotency_key
    )
  );

  v_result := jsonb_build_object(
    'user_id', p_target_user_id,
    'role', v_effective_role,
    'active', v_effective_active,
    'agency_id', v_effective_agency
  );
  return samay_admin.command_complete(p_idempotency_key, v_result);
end;
$$;

create or replace function public.admin_update_subscription(
  p_subscription_id uuid,
  p_plan_id text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  v_replay jsonb;
  v_subscription public.subscriptions%rowtype;
  v_result jsonb;
begin
  if p_status not in ('active', 'cancelled', 'past_due') then
    raise exception 'SUBSCRIPTION_STATUS_INVALID' using errcode = '22023';
  end if;
  if not exists (select 1 from public.subscription_plans where id = p_plan_id) then
    raise exception 'SUBSCRIPTION_PLAN_INVALID' using errcode = '22023';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
    raise exception 'SUBSCRIPTION_PERIOD_INVALID' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 8 then
    raise exception 'ADMIN_REASON_REQUIRED' using errcode = '22023';
  end if;

  v_replay := samay_admin.command_replay(
    'update_subscription', p_idempotency_key,
    jsonb_build_object(
      'subscription_id', p_subscription_id,
      'plan_id', p_plan_id,
      'status', p_status,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'reason', trim(p_reason)
    )
  );
  if v_replay is not null then return v_replay; end if;

  select * into v_subscription
    from public.subscriptions
   where id = p_subscription_id
   for update;
  if not found then raise exception 'SUBSCRIPTION_NOT_FOUND' using errcode = 'P0002'; end if;

  perform set_config('samay.admin_command', 'on', true);
  update public.subscriptions
     set plan_id = p_plan_id,
         status = p_status,
         current_period_start = p_period_start,
         current_period_end = p_period_end
   where id = p_subscription_id;
  update public.agencies
     set plan = p_plan_id,
         status = case when p_status = 'active' then 'active' else status end
   where id = v_subscription.agency_id;

  perform public.admin_audit_action(
    'subscription_updated', trim(p_reason), v_subscription.agency_id, null,
    jsonb_build_object(
      'subscription_id', p_subscription_id,
      'previous_plan', v_subscription.plan_id,
      'next_plan', p_plan_id,
      'previous_status', v_subscription.status,
      'next_status', p_status,
      'idempotency_key', p_idempotency_key
    )
  );

  v_result := jsonb_build_object(
    'subscription_id', p_subscription_id,
    'agency_id', v_subscription.agency_id,
    'plan', p_plan_id,
    'status', p_status
  );
  return samay_admin.command_complete(p_idempotency_key, v_result);
end;
$$;

revoke all on function public.admin_change_agency_status(uuid, text, text, text) from public, anon;
revoke all on function public.admin_change_agency_plan(uuid, text, text, text) from public, anon;
revoke all on function public.admin_extend_agency_trial(uuid, integer, text, text) from public, anon;
revoke all on function public.admin_review_subscription_payment_proof(uuid, text, text, text) from public, anon;
revoke all on function public.admin_update_user_access(uuid, text, boolean, uuid, boolean, text, text) from public, anon;
revoke all on function public.admin_update_subscription(uuid, text, text, timestamptz, timestamptz, text, text) from public, anon;

grant execute on function public.admin_change_agency_status(uuid, text, text, text) to authenticated;
grant execute on function public.admin_change_agency_plan(uuid, text, text, text) to authenticated;
grant execute on function public.admin_extend_agency_trial(uuid, integer, text, text) to authenticated;
grant execute on function public.admin_review_subscription_payment_proof(uuid, text, text, text) to authenticated;
grant execute on function public.admin_update_user_access(uuid, text, boolean, uuid, boolean, text, text) to authenticated;
grant execute on function public.admin_update_subscription(uuid, text, text, timestamptz, timestamptz, text, text) to authenticated;

-- Wrap legacy onboarding decisions and tenant deletion with the same replay
-- protection as every other owner-console mutation. The legacy RPCs remain the
-- single implementation of their business transaction and audit trail.
create or replace function public.admin_review_agency_request(
  p_request_id uuid,
  p_decision text,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  v_request jsonb;
  v_replay jsonb;
  v_result jsonb;
begin
  if p_request_id is null then
    raise exception 'ADMIN_REQUEST_ID_REQUIRED' using errcode = '22023';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'ADMIN_REQUEST_DECISION_INVALID' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 12 then
    raise exception 'ADMIN_REASON_TOO_SHORT' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'request_id', p_request_id,
    'decision', p_decision,
    'reason', trim(p_reason)
  );
  v_replay := samay_admin.command_replay(
    'admin_review_agency_request', p_idempotency_key, v_request
  );
  if v_replay is not null then return v_replay; end if;

  if p_decision = 'approved' then
    v_result := public.approve_agency_request(p_request_id);
  else
    perform public.reject_agency_request(p_request_id, trim(p_reason));
    v_result := jsonb_build_object(
      'request_id', p_request_id,
      'decision', 'rejected'
    );
  end if;

  v_result := coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'request_id', p_request_id,
    'decision', p_decision,
    'reason', trim(p_reason),
    'idempotency_key', p_idempotency_key
  );
  return samay_admin.command_complete(p_idempotency_key, v_result);
end;
$$;

create or replace function public.admin_delete_agency(
  p_agency_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, storage, pg_temp
as $$
declare
  v_request jsonb;
  v_replay jsonb;
  v_result jsonb;
begin
  if p_agency_id is null then
    raise exception 'ADMIN_AGENCY_ID_REQUIRED' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 12 then
    raise exception 'ADMIN_REASON_TOO_SHORT' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'agency_id', p_agency_id,
    'reason', trim(p_reason)
  );
  v_replay := samay_admin.command_replay(
    'admin_delete_agency', p_idempotency_key, v_request
  );
  if v_replay is not null then return v_replay; end if;

  v_result := public.delete_agency_cascade(p_agency_id, trim(p_reason));
  return samay_admin.command_complete(
    p_idempotency_key,
    coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
      'reason', trim(p_reason),
      'idempotency_key', p_idempotency_key
    )
  );
end;
$$;

revoke all on function public.admin_review_agency_request(uuid, text, text, text)
  from public, anon;
revoke all on function public.admin_delete_agency(uuid, text, text)
  from public, anon;
grant execute on function public.admin_review_agency_request(uuid, text, text, text)
  to authenticated;
grant execute on function public.admin_delete_agency(uuid, text, text)
  to authenticated;

-- Payment cancellation is a single, locked server-side transaction. The
-- status transition triggers the append-only ledger reversal and schedule
-- recomputation; legacy revenue cleanup and audit are committed with it.
create or replace function public.fn_cancel_paiement_financial(
  p_agency_id uuid,
  p_user_id uuid,
  p_id uuid,
  p_reason text
)
returns public.paiements
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.paiements;
  v_cancelled public.paiements;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if p_agency_id is null or p_user_id is null or p_id is null then
    raise exception 'INVALID_CANCELLATION_CONTEXT';
  end if;

  if char_length(v_reason) < 5 or char_length(v_reason) > 300 then
    raise exception 'INVALID_CANCELLATION_REASON';
  end if;

  select *
    into v_existing
    from public.paiements
   where id = p_id
     and agency_id = p_agency_id
   for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  -- Network retries are safe: a committed cancellation is returned unchanged.
  if v_existing.statut = 'annule' then
    return v_existing;
  end if;

  if v_existing.statut not in ('paye', 'partiel', 'en_attente') then
    raise exception 'PAYMENT_STATUS_NOT_CANCELLABLE';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_agency_id::text || ':' || v_existing.contrat_id::text || ':' || v_existing.mois_concerne::text,
      0
    )
  );

  update public.paiements
     set statut = 'annule',
         notes = case
           when nullif(btrim(coalesce(notes, '')), '') is null
             then 'Annulation : ' || v_reason
           else notes || E'\nAnnulation : ' || v_reason
         end,
         updated_at = now()
   where id = v_existing.id
     and agency_id = p_agency_id
  returning * into v_cancelled;

  -- `revenus` is legacy-derived data. Keeping cleanup in this transaction
  -- prevents it from disagreeing with the authoritative payment/ledger state.
  delete from public.revenus where paiement_id = v_existing.id;

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    p_agency_id,
    'paiement.cancelled',
    'paiements',
    v_existing.id,
    jsonb_build_object(
      'raison', v_reason,
      'montant', v_existing.montant_total,
      'previous_statut', v_existing.statut,
      'cancelled_by', p_user_id
    ),
    p_user_id
  );

  return v_cancelled;
end;
$$;

revoke all on function public.fn_cancel_paiement_financial(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.fn_cancel_paiement_financial(uuid, uuid, uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Bailleur reads must fail closed when a tenant role has no owner linkage.
-- Keep the verified legacy calculation intact behind an inaccessible function.
-- ---------------------------------------------------------------------------

alter function public.fn_finance_open_receivables(uuid, date, date)
  rename to fn_finance_open_receivables_unchecked_20260614;
revoke all on function public.fn_finance_open_receivables_unchecked_20260614(uuid, date, date)
  from public, anon, authenticated;

create function public.fn_finance_open_receivables(
  p_agency_id uuid,
  p_start date default null,
  p_end date default null
)
returns table (
  id text,
  contrat_id uuid,
  bailleur_id uuid,
  locataire_nom text,
  locataire_prenom text,
  telephone_locataire text,
  unite_nom text,
  immeuble_nom text,
  bailleur_nom text,
  bailleur_prenom text,
  montant_attendu numeric,
  montant_encaisse numeric,
  montant_du numeric,
  mois_concerne date,
  date_echeance date,
  statut text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_bailleur_id uuid;
  v_owner_account boolean;
begin
  select up.role::text, up.bailleur_id, coalesce(a.is_bailleur_account, false)
    into v_role, v_bailleur_id, v_owner_account
    from public.user_profiles up
    left join public.agencies a on a.id = up.agency_id
   where up.id = auth.uid()
     and up.agency_id = p_agency_id
     and coalesce(up.actif, true) = true;

  if not found then raise exception 'FINANCE_FORBIDDEN' using errcode = '42501'; end if;
  if v_role = 'bailleur' and not v_owner_account and v_bailleur_id is null then
    raise exception 'FINANCE_BAILLEUR_LINK_REQUIRED' using errcode = '42501';
  end if;

  return query
  select * from public.fn_finance_open_receivables_unchecked_20260614(p_agency_id, p_start, p_end);
end;
$$;

alter function public.fn_finance_owner_summary(uuid, date, date, uuid)
  rename to fn_finance_owner_summary_unchecked_20260614;
revoke all on function public.fn_finance_owner_summary_unchecked_20260614(uuid, date, date, uuid)
  from public, anon, authenticated;

create function public.fn_finance_owner_summary(
  p_agency_id uuid,
  p_start date,
  p_end date,
  p_bailleur_id uuid default null
)
returns table (
  bailleur_id uuid,
  bailleur_nom text,
  bailleur_prenom text,
  loyers_encaisses numeric,
  commissions_agence numeric,
  net_bailleur numeric,
  depenses_total numeric,
  reliquats_ouverts numeric,
  contrats_actifs integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_bailleur_id uuid;
  v_owner_account boolean;
  v_effective_bailleur uuid;
begin
  select up.role::text, up.bailleur_id, coalesce(a.is_bailleur_account, false)
    into v_role, v_bailleur_id, v_owner_account
    from public.user_profiles up
    left join public.agencies a on a.id = up.agency_id
   where up.id = auth.uid()
     and up.agency_id = p_agency_id
     and coalesce(up.actif, true) = true;

  if not found then raise exception 'FINANCE_FORBIDDEN' using errcode = '42501'; end if;
  if v_role = 'bailleur' and not v_owner_account then
    if v_bailleur_id is null then
      raise exception 'FINANCE_BAILLEUR_LINK_REQUIRED' using errcode = '42501';
    end if;
    if p_bailleur_id is not null and p_bailleur_id <> v_bailleur_id then
      raise exception 'FINANCE_FORBIDDEN' using errcode = '42501';
    end if;
    v_effective_bailleur := v_bailleur_id;
  else
    v_effective_bailleur := p_bailleur_id;
  end if;

  return query
  select * from public.fn_finance_owner_summary_unchecked_20260614(
    p_agency_id, p_start, p_end, v_effective_bailleur
  );
end;
$$;

revoke all on function public.fn_finance_open_receivables(uuid, date, date) from public, anon;
revoke all on function public.fn_finance_owner_summary(uuid, date, date, uuid) from public, anon;
grant execute on function public.fn_finance_open_receivables(uuid, date, date) to authenticated;
grant execute on function public.fn_finance_owner_summary(uuid, date, date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Contract lifecycle commands. Creation, lifecycle transitions and renewal
-- must update the contract, unit occupancy and audit trail in one transaction.
-- These commands are callable only by Edge Functions using the service role.
-- ---------------------------------------------------------------------------

create or replace function public.fn_create_contrat_command(
  p_agency_id uuid,
  p_user_id uuid,
  p_locataire_id uuid,
  p_unite_id uuid,
  p_date_debut date,
  p_date_fin date,
  p_loyer_mensuel numeric,
  p_commission numeric default null,
  p_caution numeric default null,
  p_destination text default null,
  p_is_demo_data boolean default false
)
returns public.contrats
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unite public.unites;
  v_contrat public.contrats;
  v_is_owner boolean;
  v_date_fin date;
begin
  if p_agency_id is null or p_user_id is null or p_locataire_id is null or p_unite_id is null then
    raise exception 'INVALID_CONTRACT_CONTEXT';
  end if;
  if p_date_debut is null or p_loyer_mensuel is null or p_loyer_mensuel <= 0 then
    raise exception 'INVALID_CONTRACT_VALUES';
  end if;
  if p_commission is not null and (p_commission < 0 or p_commission > 100) then
    raise exception 'INVALID_CONTRACT_COMMISSION';
  end if;
  if p_caution is not null and p_caution < 0 then
    raise exception 'INVALID_CONTRACT_CAUTION';
  end if;

  v_date_fin := coalesce(p_date_fin, (p_date_debut + interval '2 years')::date);
  if v_date_fin <= p_date_debut then
    raise exception 'INVALID_CONTRACT_END_DATE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_agency_id::text || ':contract:' || p_unite_id::text, 0));

  if not exists (
    select 1 from public.locataires
     where id = p_locataire_id and agency_id = p_agency_id
  ) then
    raise exception 'LOCATAIRE_NOT_FOUND';
  end if;

  select * into v_unite
    from public.unites
   where id = p_unite_id and agency_id = p_agency_id
   for update;
  if not found then raise exception 'UNITE_NOT_FOUND'; end if;

  if exists (
    select 1 from public.contrats
     where agency_id = p_agency_id and unite_id = p_unite_id and statut = 'actif'
  ) then
    raise exception 'CONTRAT_ALREADY_EXISTS';
  end if;

  select coalesce(is_bailleur_account, false) into v_is_owner
    from public.agencies where id = p_agency_id;
  if not found then raise exception 'AGENCY_NOT_FOUND'; end if;

  insert into public.contrats (
    agency_id, locataire_id, unite_id, date_debut, date_fin,
    loyer_mensuel, commission, caution, statut, destination, created_by,
    is_demo_data
  ) values (
    p_agency_id, p_locataire_id, p_unite_id, p_date_debut, v_date_fin,
    p_loyer_mensuel,
    case when v_is_owner then 0 else coalesce(p_commission, 10) end,
    coalesce(p_caution, p_loyer_mensuel * 2),
    'actif', nullif(btrim(coalesce(p_destination, '')), ''), p_user_id,
    coalesce(p_is_demo_data, false)
  ) returning * into v_contrat;

  update public.unites set statut = 'loue'
   where id = p_unite_id and agency_id = p_agency_id;
  if not found then raise exception 'UNITE_OCCUPATION_FAILED'; end if;

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    p_agency_id, 'contrat.created', 'contrats', v_contrat.id,
    jsonb_build_object(
      'locataire_id', p_locataire_id,
      'unite_id', p_unite_id,
      'date_debut', p_date_debut,
      'date_fin', v_date_fin,
      'loyer_mensuel', p_loyer_mensuel,
      'lifecycle', jsonb_build_object('action', 'occupation_unite')
    ),
    p_user_id
  );

  update public.agencies
     set first_contract_at = coalesce(first_contract_at, now())
   where id = p_agency_id;

  return v_contrat;
end;
$$;

create or replace function public.fn_update_contrat_command(
  p_agency_id uuid,
  p_user_id uuid,
  p_id uuid,
  p_patch jsonb
)
returns public.contrats
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.contrats;
  v_updated public.contrats;
  v_new_status public.contrat_statut;
  v_new_date_fin date;
  v_new_commission numeric;
  v_new_caution numeric;
  v_is_owner boolean;
  v_lifecycle text;
  v_allowed text[];
begin
  if p_agency_id is null or p_user_id is null or p_id is null or p_patch is null then
    raise exception 'INVALID_CONTRACT_CONTEXT';
  end if;
  if p_patch - array['statut','date_fin','commission','caution','resiliation_motif','resiliation_observations'] <> '{}'::jsonb then
    raise exception 'UNSUPPORTED_CONTRACT_PATCH';
  end if;

  select * into v_existing
    from public.contrats
   where id = p_id and agency_id = p_agency_id
   for update;
  if not found then raise exception 'CONTRAT_NOT_FOUND'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_agency_id::text || ':contract:' || v_existing.unite_id::text, 0));

  v_new_status := case
    when p_patch ? 'statut' then (p_patch->>'statut')::public.contrat_statut
    else v_existing.statut
  end;
  v_new_date_fin := case
    when p_patch ? 'date_fin' and p_patch->'date_fin' <> 'null'::jsonb then (p_patch->>'date_fin')::date
    when p_patch ? 'date_fin' then null
    else v_existing.date_fin
  end;
  v_new_commission := case
    when p_patch ? 'commission' and p_patch->'commission' <> 'null'::jsonb then (p_patch->>'commission')::numeric
    when p_patch ? 'commission' then null
    else v_existing.commission
  end;
  v_new_caution := case
    when p_patch ? 'caution' and p_patch->'caution' <> 'null'::jsonb then (p_patch->>'caution')::numeric
    when p_patch ? 'caution' then null
    else v_existing.caution
  end;

  if v_new_date_fin is not null and v_new_date_fin < v_existing.date_debut then
    raise exception 'INVALID_CONTRACT_END_DATE';
  end if;
  if v_new_status = 'resilie' and v_new_date_fin is null then
    raise exception 'RESILIATION_DATE_REQUIRED';
  end if;
  if v_new_commission is not null and (v_new_commission < 0 or v_new_commission > 100) then
    raise exception 'INVALID_CONTRACT_COMMISSION';
  end if;
  if v_new_caution is not null and v_new_caution < 0 then
    raise exception 'INVALID_CONTRACT_CAUTION';
  end if;

  if v_new_status is distinct from v_existing.statut then
    v_allowed := case v_existing.statut::text
      when 'actif' then array['expire','resilie']
      when 'expire' then array['actif','archive']
      when 'resilie' then array['archive']
      else array[]::text[]
    end;
    if not (v_new_status::text = any(v_allowed)) then
      raise exception 'INVALID_CONTRACT_TRANSITION';
    end if;
  end if;

  if v_new_status = 'actif' and v_existing.statut <> 'actif' and exists (
    select 1 from public.contrats
     where agency_id = p_agency_id
       and unite_id = v_existing.unite_id
       and statut = 'actif'
       and id <> p_id
  ) then
    raise exception 'CONTRAT_ALREADY_EXISTS';
  end if;

  select coalesce(is_bailleur_account, false) into v_is_owner
    from public.agencies where id = p_agency_id;
  if not found then raise exception 'AGENCY_NOT_FOUND'; end if;
  if v_is_owner then v_new_commission := 0; end if;

  update public.contrats
     set statut = v_new_status,
         date_fin = v_new_date_fin,
         commission = v_new_commission,
         caution = v_new_caution,
         updated_at = now()
   where id = p_id and agency_id = p_agency_id
  returning * into v_updated;

  if v_new_status in ('resilie', 'expire') and v_existing.statut = 'actif' then
    update public.unites set statut = 'libre'
     where id = v_existing.unite_id and agency_id = p_agency_id;
    if not found then raise exception 'UNITE_RELEASE_FAILED'; end if;
  elsif v_new_status = 'actif' and v_existing.statut <> 'actif' then
    update public.unites set statut = 'loue'
     where id = v_existing.unite_id and agency_id = p_agency_id;
    if not found then raise exception 'UNITE_OCCUPATION_FAILED'; end if;
  end if;

  v_lifecycle := case
    when v_new_status = 'resilie' and v_existing.statut <> 'resilie' then 'resiliation'
    when v_new_status = 'expire' and v_existing.statut <> 'expire' then 'expiration'
    when v_new_status = 'archive' and v_existing.statut <> 'archive' then 'archivage'
    when v_new_status = 'actif' and v_existing.statut = 'expire' then 'reactivation'
    else null
  end;

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values (
    p_agency_id,
    case v_lifecycle
      when 'resiliation' then 'contrat.resiliated'
      when 'archivage' then 'contrat.archived'
      when 'reactivation' then 'contrat.reactivated'
      else 'contrat.updated'
    end,
    'contrats', p_id,
    jsonb_build_object(
      'previous_statut', v_existing.statut,
      'new_statut', v_new_status,
      'patch', p_patch,
      'lifecycle', jsonb_build_object(
        'action', v_lifecycle,
        'motif', nullif(btrim(coalesce(p_patch->>'resiliation_motif', '')), ''),
        'observations', nullif(btrim(coalesce(p_patch->>'resiliation_observations', '')), '')
      )
    ),
    p_user_id
  );

  return v_updated;
end;
$$;

create or replace function public.fn_renew_contrat_command(
  p_agency_id uuid,
  p_user_id uuid,
  p_id uuid,
  p_nouvelle_date_fin date,
  p_nouveau_loyer numeric default null,
  p_remarques text default null
)
returns public.contrats
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.contrats;
  v_renewed public.contrats;
  v_new_start date;
  v_new_loyer numeric;
  v_is_owner boolean;
begin
  if p_agency_id is null or p_user_id is null or p_id is null or p_nouvelle_date_fin is null then
    raise exception 'INVALID_RENEWAL_CONTEXT';
  end if;

  select * into v_existing
    from public.contrats
   where id = p_id and agency_id = p_agency_id
   for update;
  if not found then raise exception 'CONTRAT_NOT_FOUND'; end if;
  if v_existing.statut not in ('actif', 'expire') then raise exception 'INVALID_RENEWAL_STATUS'; end if;
  if v_existing.date_fin is null then raise exception 'MISSING_END_DATE'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_agency_id::text || ':contract:' || v_existing.unite_id::text, 0));
  perform 1 from public.unites
   where id = v_existing.unite_id and agency_id = p_agency_id
   for update;
  if not found then raise exception 'UNITE_NOT_FOUND'; end if;

  v_new_start := v_existing.date_fin + 1;
  v_new_loyer := coalesce(p_nouveau_loyer, v_existing.loyer_mensuel);
  if p_nouvelle_date_fin <= v_new_start then raise exception 'INVALID_RENEWAL_END_DATE'; end if;
  if v_new_loyer <= 0 then raise exception 'INVALID_RENEWAL_RENT'; end if;

  if exists (
    select 1 from public.contrats
     where agency_id = p_agency_id
       and unite_id = v_existing.unite_id
       and statut = 'actif'
       and id <> p_id
  ) then
    raise exception 'CONTRAT_ALREADY_EXISTS';
  end if;

  select coalesce(is_bailleur_account, false) into v_is_owner
    from public.agencies where id = p_agency_id;
  if not found then raise exception 'AGENCY_NOT_FOUND'; end if;

  if v_existing.statut = 'actif' then
    update public.contrats set statut = 'expire', updated_at = now()
     where id = v_existing.id and agency_id = p_agency_id;
  end if;

  insert into public.contrats (
    agency_id, locataire_id, unite_id, date_debut, date_fin,
    loyer_mensuel, commission, caution, statut, destination, notes, created_by
  ) values (
    p_agency_id, v_existing.locataire_id, v_existing.unite_id,
    v_new_start, p_nouvelle_date_fin, v_new_loyer,
    case when v_is_owner then 0 else v_existing.commission end,
    v_existing.caution, 'actif', v_existing.destination,
    nullif(btrim(coalesce(p_remarques, '')), ''), p_user_id
  ) returning * into v_renewed;

  update public.unites set statut = 'loue'
   where id = v_existing.unite_id and agency_id = p_agency_id;
  if not found then raise exception 'UNITE_OCCUPATION_FAILED'; end if;

  insert into public.event_log (
    agency_id, event_type, entity_type, entity_id, payload, created_by
  ) values
  (
    p_agency_id, 'contrat.renewed', 'contrats', v_existing.id,
    jsonb_build_object(
      'previous_contract_id', v_existing.id,
      'new_contract_id', v_renewed.id,
      'previous_date_fin', v_existing.date_fin,
      'new_date_debut', v_new_start,
      'new_date_fin', p_nouvelle_date_fin,
      'previous_loyer', v_existing.loyer_mensuel,
      'new_loyer', v_new_loyer,
      'remarks', nullif(btrim(coalesce(p_remarques, '')), '')
    ), p_user_id
  ),
  (
    p_agency_id, 'contrat.created', 'contrats', v_renewed.id,
    jsonb_build_object('source', 'renewal', 'previous_contract_id', v_existing.id),
    p_user_id
  );

  return v_renewed;
end;
$$;

revoke all on function public.fn_create_contrat_command(uuid, uuid, uuid, uuid, date, date, numeric, numeric, numeric, text, boolean)
  from public, anon, authenticated;
revoke all on function public.fn_update_contrat_command(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.fn_renew_contrat_command(uuid, uuid, uuid, date, numeric, text)
  from public, anon, authenticated;
grant execute on function public.fn_create_contrat_command(uuid, uuid, uuid, uuid, date, date, numeric, numeric, numeric, text, boolean)
  to service_role;
grant execute on function public.fn_update_contrat_command(uuid, uuid, uuid, jsonb)
  to service_role;
grant execute on function public.fn_renew_contrat_command(uuid, uuid, uuid, date, numeric, text)
  to service_role;

-- Direct browser writes to critical financial and contractual records are
-- removed. Authenticated clients keep tenant-scoped reads and must use the
-- audited RPC/Edge command paths for every mutation.
do $$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array['contrats', 'paiements', 'revenus', 'depenses'] loop
    for v_policy in
      select policyname
        from pg_policies
       where schemaname = 'public'
         and tablename = v_table
         and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    loop
      execute format('drop policy if exists %I on public.%I', v_policy.policyname, v_table);
    end loop;
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on table public.%I from authenticated',
      v_table
    );
    execute format('grant select on table public.%I to authenticated', v_table);
  end loop;
end
$$;

-- Close the search_path ambiguity left by earlier finance RPC definitions.
alter function public.fn_finance_create_depense(uuid, numeric, date, text, text, text, uuid, text)
  set search_path = public, pg_temp;
alter function public.fn_finance_update_depense(uuid, uuid, numeric, date, text, text, text, uuid, text)
  set search_path = public, pg_temp;
alter function public.fn_finance_cancel_depense(uuid, uuid, text)
  set search_path = public, pg_temp;
