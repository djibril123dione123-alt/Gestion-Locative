-- Admin console operational RPCs.
-- Complements the control tower schema with safe super-admin entry points for
-- support tickets, incidents, notes, announcements and feature flag management.

create or replace function public.admin_create_support_ticket(
  p_organization_id uuid,
  p_subject text,
  p_category text default 'support_general',
  p_priority text default 'normal',
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  new_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin access required' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_subject, ''))) < 3 then
    raise exception 'Ticket subject is required' using errcode = '22023';
  end if;

  insert into samay_admin.support_tickets (
    organization_id,
    subject,
    category,
    priority,
    description,
    assigned_to
  )
  values (
    p_organization_id,
    trim(p_subject),
    coalesce(nullif(trim(p_category), ''), 'support_general'),
    coalesce(nullif(trim(p_priority), ''), 'normal'),
    nullif(trim(coalesce(p_description, '')), ''),
    auth.uid()
  )
  returning id into new_id;

  perform public.admin_audit_action(
    'support_ticket_created',
    'Création ticket depuis console admin',
    p_organization_id,
    null,
    jsonb_build_object('ticket_id', new_id, 'subject', trim(p_subject), 'priority', p_priority)
  );

  return new_id;
end;
$$;

create or replace function public.admin_update_support_ticket(
  p_ticket_id uuid,
  p_status text,
  p_internal_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  target_org uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin access required' using errcode = '42501';
  end if;

  update samay_admin.support_tickets
     set status = coalesce(nullif(trim(p_status), ''), status),
         internal_notes = coalesce(nullif(trim(coalesce(p_internal_notes, '')), ''), internal_notes),
         resolved_at = case when p_status in ('resolved','closed') then now() else resolved_at end
   where id = p_ticket_id
   returning organization_id into target_org;

  if not found then
    raise exception 'Support ticket not found' using errcode = '02000';
  end if;

  perform public.admin_audit_action(
    'support_ticket_updated',
    'Mise à jour ticket support',
    target_org,
    null,
    jsonb_build_object('ticket_id', p_ticket_id, 'status', p_status)
  );
end;
$$;

create or replace function public.admin_record_incident(
  p_type text,
  p_severity text,
  p_message text,
  p_organization_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  new_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin access required' using errcode = '42501';
  end if;

  insert into samay_admin.incidents (
    type,
    severity,
    message,
    organization_id,
    metadata
  )
  values (
    coalesce(nullif(trim(p_type), ''), 'manual_admin_incident'),
    coalesce(nullif(trim(p_severity), ''), 'warning'),
    coalesce(nullif(trim(p_message), ''), 'Incident créé depuis console admin'),
    p_organization_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into new_id;

  perform public.admin_audit_action(
    'incident_recorded',
    'Incident manuel console admin',
    p_organization_id,
    null,
    jsonb_build_object('incident_id', new_id, 'type', p_type, 'severity', p_severity)
  );

  return new_id;
end;
$$;

create or replace function public.admin_resolve_incident(
  p_incident_id uuid,
  p_resolution text
)
returns void
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  target_org uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin access required' using errcode = '42501';
  end if;

  update samay_admin.incidents
     set status = 'resolved',
         resolution = nullif(trim(coalesce(p_resolution, '')), ''),
         last_seen_at = now()
   where id = p_incident_id
   returning organization_id into target_org;

  if not found then
    raise exception 'Incident not found' using errcode = '02000';
  end if;

  perform public.admin_audit_action(
    'incident_resolved',
    coalesce(nullif(trim(p_resolution), ''), 'Résolution incident'),
    target_org,
    null,
    jsonb_build_object('incident_id', p_incident_id)
  );
end;
$$;

create or replace function public.admin_create_admin_note(
  p_organization_id uuid,
  p_note text,
  p_visibility text default 'internal'
)
returns uuid
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  new_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin access required' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'Note is required' using errcode = '22023';
  end if;

  insert into samay_admin.admin_notes (
    organization_id,
    author_user_id,
    note,
    visibility
  )
  values (
    p_organization_id,
    auth.uid(),
    trim(p_note),
    coalesce(nullif(trim(p_visibility), ''), 'internal')
  )
  returning id into new_id;

  perform public.admin_audit_action(
    'admin_note_created',
    'Note interne console admin',
    p_organization_id,
    null,
    jsonb_build_object('note_id', new_id, 'visibility', p_visibility)
  );

  return new_id;
end;
$$;

create or replace function public.admin_upsert_feature_flag(
  p_key text,
  p_name text,
  p_description text default null,
  p_status text default 'draft',
  p_owner text default null,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  flag_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin access required' using errcode = '42501';
  end if;

  insert into samay_admin.feature_flags (
    key,
    name,
    description,
    status,
    owner,
    expires_at
  )
  values (
    trim(p_key),
    coalesce(nullif(trim(p_name), ''), trim(p_key)),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(nullif(trim(p_status), ''), 'draft'),
    nullif(trim(coalesce(p_owner, '')), ''),
    p_expires_at
  )
  on conflict (key) do update
    set name = excluded.name,
        description = excluded.description,
        status = excluded.status,
        owner = excluded.owner,
        expires_at = excluded.expires_at,
        archived_at = case when excluded.status = 'archived' then coalesce(samay_admin.feature_flags.archived_at, now()) else null end
  returning id into flag_id;

  perform public.admin_audit_action(
    'admin_feature_flag_upserted',
    'Gestion feature flag console admin',
    null,
    null,
    jsonb_build_object('flag_id', flag_id, 'key', p_key, 'status', p_status)
  );

  return flag_id;
end;
$$;

create or replace function public.admin_create_maintenance_announcement(
  p_title text,
  p_message text,
  p_status text default 'draft',
  p_target jsonb default '{"type":"all"}'::jsonb,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, samay_admin, pg_temp
as $$
declare
  new_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin access required' using errcode = '42501';
  end if;

  insert into samay_admin.maintenance_announcements (
    title,
    message,
    status,
    target,
    starts_at,
    ends_at,
    created_by
  )
  values (
    trim(p_title),
    trim(p_message),
    coalesce(nullif(trim(p_status), ''), 'draft'),
    coalesce(p_target, '{"type":"all"}'::jsonb),
    p_starts_at,
    p_ends_at,
    auth.uid()
  )
  returning id into new_id;

  perform public.admin_audit_action(
    'maintenance_announcement_created',
    'Annonce maintenance console admin',
    null,
    null,
    jsonb_build_object('announcement_id', new_id, 'status', p_status, 'target', p_target)
  );

  return new_id;
end;
$$;

grant execute on function public.admin_create_support_ticket(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_update_support_ticket(uuid, text, text) to authenticated;
grant execute on function public.admin_record_incident(text, text, text, uuid, jsonb) to authenticated;
grant execute on function public.admin_resolve_incident(uuid, text) to authenticated;
grant execute on function public.admin_create_admin_note(uuid, text, text) to authenticated;
grant execute on function public.admin_upsert_feature_flag(text, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.admin_create_maintenance_announcement(text, text, text, jsonb, timestamptz, timestamptz) to authenticated;
