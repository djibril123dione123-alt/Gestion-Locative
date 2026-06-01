-- Admin Control Tower foundation for Samay Këur.
-- This migration creates an isolated admin schema, secured metadata tables,
-- and a read-only snapshot RPC for the super-admin console.

create schema if not exists samay_admin;

create table if not exists samay_admin.platform_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null default current_date,
  total_organizations integer not null default 0,
  active_organizations integer not null default 0,
  trial_organizations integer not null default 0,
  paying_organizations integer not null default 0,
  total_users integer not null default 0,
  total_documents integer not null default 0,
  total_storage_mb numeric not null default 0,
  estimated_mrr numeric not null default 0,
  incidents_count integer not null default 0,
  errors_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(metric_date)
);

create table if not exists samay_admin.organization_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.agencies(id) on delete cascade,
  metric_date date not null default current_date,
  active_users integer not null default 0,
  total_properties integer not null default 0,
  total_units integer not null default 0,
  total_contracts integer not null default 0,
  total_documents integer not null default 0,
  storage_used_mb numeric not null default 0,
  payments_count integer not null default 0,
  payments_amount numeric not null default 0,
  unpaid_amount numeric not null default 0,
  last_activity_at timestamptz,
  health_score integer not null default 70 check (health_score between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(organization_id, metric_date)
);

create table if not exists samay_admin.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null default current_date,
  metric_key text not null,
  metric_value numeric not null default 0,
  dimensions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(metric_date, metric_key, dimensions)
);

create table if not exists samay_admin.document_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null default current_date,
  organization_id uuid references public.agencies(id) on delete cascade,
  document_type text not null default 'unknown',
  generated_count integer not null default 0,
  failed_count integer not null default 0,
  verified_count integer not null default 0,
  storage_mb numeric not null default 0,
  created_at timestamptz not null default now(),
  unique(metric_date, organization_id, document_type)
);

create table if not exists samay_admin.subscription_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null default current_date,
  plan_id text not null,
  active_count integer not null default 0,
  trial_count integer not null default 0,
  past_due_count integer not null default 0,
  estimated_mrr numeric not null default 0,
  created_at timestamptz not null default now(),
  unique(metric_date, plan_id)
);

create table if not exists samay_admin.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text,
  target_organization_id uuid references public.agencies(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists samay_admin.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  severity text not null default 'info' check (severity in ('info','warning','critical','blocking')),
  title text not null,
  message text,
  target_organization_id uuid references public.agencies(id) on delete cascade,
  status text not null default 'new' check (status in ('new','read','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists samay_admin.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','active','testing','deprecated','archived')),
  owner text,
  impact text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  archived_at timestamptz
);

create table if not exists samay_admin.feature_flag_targets (
  id uuid primary key default gen_random_uuid(),
  flag_id uuid not null references samay_admin.feature_flags(id) on delete cascade,
  target_type text not null check (target_type in ('all','organization','user','plan','account_type','beta_group')),
  target_id text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists samay_admin.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  target_organization_id uuid not null references public.agencies(id) on delete cascade,
  reason text not null check (length(trim(reason)) >= 12),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active','ended','expired','revoked')),
  ip_address text,
  user_agent text,
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists samay_admin.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.agencies(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  subject text not null,
  category text not null default 'support_general',
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'new' check (status in ('new','in_progress','waiting_customer','resolved','closed')),
  description text,
  internal_notes text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists samay_admin.incidents (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  severity text not null default 'warning' check (severity in ('info','warning','critical','blocking')),
  status text not null default 'new' check (status in ('new','in_progress','resolved','ignored','watching')),
  organization_id uuid references public.agencies(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  stack_trace text,
  occurrences integer not null default 1,
  last_seen_at timestamptz not null default now(),
  resolution text,
  owner text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists samay_admin.system_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null default 'info',
  organization_id uuid references public.agencies(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists samay_admin.admin_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.agencies(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  note text not null,
  visibility text not null default 'internal' check (visibility in ('internal','support','commercial','security')),
  created_at timestamptz not null default now()
);

create table if not exists samay_admin.maintenance_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','active','expired','cancelled')),
  target jsonb not null default '{"type":"all"}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table samay_admin.platform_metrics enable row level security;
alter table samay_admin.organization_metrics enable row level security;
alter table samay_admin.daily_metrics enable row level security;
alter table samay_admin.document_metrics enable row level security;
alter table samay_admin.subscription_metrics enable row level security;
alter table samay_admin.admin_audit_logs enable row level security;
alter table samay_admin.admin_notifications enable row level security;
alter table samay_admin.feature_flags enable row level security;
alter table samay_admin.feature_flag_targets enable row level security;
alter table samay_admin.impersonation_sessions enable row level security;
alter table samay_admin.support_tickets enable row level security;
alter table samay_admin.incidents enable row level security;
alter table samay_admin.system_events enable row level security;
alter table samay_admin.admin_notes enable row level security;
alter table samay_admin.maintenance_announcements enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'platform_metrics','organization_metrics','daily_metrics','document_metrics',
    'subscription_metrics','admin_audit_logs','admin_notifications','feature_flags',
    'feature_flag_targets','impersonation_sessions','support_tickets','incidents',
    'system_events','admin_notes','maintenance_announcements'
  ]
  loop
    execute format('drop policy if exists "samay_admin_super_admin_all" on samay_admin.%I', table_name);
    execute format(
      'create policy "samay_admin_super_admin_all" on samay_admin.%I for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin())',
      table_name
    );
  end loop;
end $$;

create index if not exists idx_admin_audit_created on samay_admin.admin_audit_logs(created_at desc);
create index if not exists idx_admin_audit_target_org on samay_admin.admin_audit_logs(target_organization_id);
create index if not exists idx_admin_incidents_status on samay_admin.incidents(status, severity, last_seen_at desc);
create index if not exists idx_admin_tickets_status on samay_admin.support_tickets(status, priority, created_at desc);
create index if not exists idx_admin_org_metrics_org_date on samay_admin.organization_metrics(organization_id, metric_date desc);

create or replace function public.admin_console_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'platform', jsonb_build_object(
      'total_organizations', (select count(*) from public.agencies),
      'active_organizations', (select count(*) from public.agencies where coalesce(status, 'active') = 'active'),
      'trial_organizations', (select count(*) from public.agencies where coalesce(status, '') = 'trial'),
      'suspended_organizations', (select count(*) from public.agencies where coalesce(status, '') = 'suspended'),
      'individual_landlords', (select count(*) from public.agencies where coalesce(is_bailleur_account, false) = true or coalesce(organization_type, '') in ('individual_landlord','multi_property_landlord')),
      'property_managers', (select count(*) from public.agencies where coalesce(organization_type, '') = 'property_manager'),
      'groups', (select count(*) from public.agencies where coalesce(organization_type, '') = 'group'),
      'total_users', (select count(*) from public.user_profiles where role <> 'super_admin'),
      'active_users', (select count(*) from public.user_profiles where role <> 'super_admin' and coalesce(actif, true) = true),
      'total_documents', (select count(*) from public.document_registry),
      'documents_this_month', (select count(*) from public.document_registry where created_at >= date_trunc('month', now())),
      'estimated_mrr', (
        select coalesce(sum(case coalesce(a.plan, s.plan_id)
          when 'starter' then 5000
          when 'basic' then 5000
          when 'pro' then 15000
          when 'business' then 35000
          else 0 end), 0)
        from public.agencies a
        left join public.subscriptions s on s.agency_id = a.id and s.status = 'active'
        where coalesce(a.status, 'active') in ('active','trial')
      ),
      'open_incidents', (select count(*) from samay_admin.incidents where status in ('new','in_progress','watching')),
      'open_tickets', (select count(*) from samay_admin.support_tickets where status in ('new','in_progress','waiting_customer'))
    ),
    'incidents', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from (select * from samay_admin.incidents order by created_at desc limit 20) i), '[]'::jsonb),
    'tickets', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (select * from samay_admin.support_tickets order by created_at desc limit 20) t), '[]'::jsonb),
    'feature_flags', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at desc) from (select * from samay_admin.feature_flags order by created_at desc limit 50) f), '[]'::jsonb),
    'audit_logs', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from (select * from samay_admin.admin_audit_logs order by created_at desc limit 50) l), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

create or replace function public.admin_audit_action(
  p_action text,
  p_reason text default null,
  p_target_organization_id uuid default null,
  p_target_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  new_id uuid;
  actor_role text;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin access required' using errcode = '42501';
  end if;

  select role::text into actor_role from public.user_profiles where id = auth.uid();

  insert into samay_admin.admin_audit_logs (
    actor_user_id,
    actor_role,
    target_organization_id,
    target_user_id,
    action,
    reason,
    metadata
  )
  values (
    auth.uid(),
    actor_role,
    p_target_organization_id,
    p_target_user_id,
    p_action,
    nullif(trim(coalesce(p_reason, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.admin_start_impersonation(
  p_target_organization_id uuid,
  p_reason text,
  p_duration_minutes integer default 30
)
returns uuid
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  session_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin access required' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 12 then
    raise exception 'A clear support reason is required' using errcode = '22023';
  end if;

  insert into samay_admin.impersonation_sessions (
    admin_user_id,
    target_organization_id,
    reason,
    expires_at,
    created_by
  )
  values (
    auth.uid(),
    p_target_organization_id,
    trim(p_reason),
    now() + make_interval(mins => greatest(5, least(coalesce(p_duration_minutes, 30), 60))),
    auth.uid()
  )
  returning id into session_id;

  perform public.admin_audit_action(
    'impersonation_started',
    trim(p_reason),
    p_target_organization_id,
    null,
    jsonb_build_object('session_id', session_id)
  );

  return session_id;
end;
$$;

revoke all on schema samay_admin from public;
grant usage on schema samay_admin to authenticated;
grant execute on function public.admin_console_snapshot() to authenticated;
grant execute on function public.admin_audit_action(text, text, uuid, uuid, jsonb) to authenticated;
grant execute on function public.admin_start_impersonation(uuid, text, integer) to authenticated;
