-- Consolidate the super-admin console behind one strictly guarded source.
-- Direct browser reads remain available as a temporary frontend fallback, but
-- the console no longer depends on grants to the internal samay_admin schema.

create or replace function public.admin_console_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
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
      'active_organizations', (
        select count(*) from public.agencies
        where coalesce(status, 'active') = 'active'
      ),
      'trial_organizations', (
        select count(*) from public.agencies
        where coalesce(status, '') = 'trial'
      ),
      'suspended_organizations', (
        select count(*) from public.agencies
        where coalesce(status, '') = 'suspended'
      ),
      'individual_landlords', (
        select count(*) from public.agencies
        where coalesce(is_bailleur_account, false)
          or coalesce(organization_type, '') in ('individual_landlord', 'multi_property_landlord')
      ),
      'total_users', (
        select count(*) from public.user_profiles
        where role <> 'super_admin'
      ),
      'active_users', (
        select count(*) from public.user_profiles
        where role <> 'super_admin' and coalesce(actif, true)
      ),
      'total_documents', (select count(*) from public.document_registry),
      'documents_this_month', (
        select count(*) from public.document_registry
        where created_at >= date_trunc('month', now())
      ),
      'estimated_mrr', (
        select coalesce(sum(
          case coalesce(a.plan, s.plan_id)
            when 'starter' then 5000
            when 'basic' then 5000
            when 'pro' then 15000
            when 'business' then 35000
            else 0
          end
        ), 0)
        from public.agencies a
        left join public.subscriptions s
          on s.agency_id = a.id and s.status = 'active'
        where coalesce(a.status, 'active') in ('active', 'trial')
      ),
      'open_incidents', (
        select count(*) from samay_admin.incidents
        where status in ('new', 'in_progress', 'watching')
      ),
      'open_tickets', (
        select count(*) from samay_admin.support_tickets
        where status in ('new', 'in_progress', 'waiting_customer')
      ),
      'pending_proofs', (
        select count(*) from public.subscription_payment_proofs
        where status = 'pending'
      ),
      'pending_requests', (
        select count(*) from public.agency_creation_requests
        where status = 'pending'
      )
    ),
    'agencies', coalesce((
      select jsonb_agg(source.payload order by source.created_at desc)
      from (
        select
          to_jsonb(stats)
            || jsonb_build_object(
              'organization_type', agency.organization_type,
              'is_bailleur_account', agency.is_bailleur_account,
              'email', agency.email,
              'phone', agency.phone,
              'derniere_activite', coalesce(stats.derniere_activite, agency.derniere_activite)
            ) as payload,
          stats.created_at
        from public.vw_owner_agency_stats stats
        join public.agencies agency on agency.id = stats.id
        order by stats.created_at desc
        limit 500
      ) source
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(source.payload order by source.created_at desc)
      from (
        select
          to_jsonb(profile)
            || jsonb_build_object('agency_name', agency.name) as payload,
          profile.created_at
        from public.user_profiles profile
        left join public.agencies agency on agency.id = profile.agency_id
        order by profile.created_at desc
        limit 500
      ) source
    ), '[]'::jsonb),
    'subscriptions', coalesce((
      select jsonb_agg(source.payload order by source.created_at desc)
      from (
        select
          to_jsonb(subscription)
            || jsonb_build_object('agency_name', agency.name) as payload,
          subscription.created_at
        from public.subscriptions subscription
        left join public.agencies agency on agency.id = subscription.agency_id
        order by subscription.created_at desc
        limit 300
      ) source
    ), '[]'::jsonb),
    'proofs', coalesce((
      select jsonb_agg(source.payload order by source.created_at desc)
      from (
        select
          to_jsonb(proof)
            || jsonb_build_object(
              'agencies',
              jsonb_build_object(
                'name', agency.name,
                'organization_type', agency.organization_type,
                'is_bailleur_account', agency.is_bailleur_account
              )
            ) as payload,
          proof.created_at
        from public.subscription_payment_proofs proof
        left join public.agencies agency on agency.id = proof.agency_id
        order by proof.created_at desc
        limit 200
      ) source
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(to_jsonb(request) order by request.created_at desc)
      from (
        select *
        from public.agency_creation_requests
        order by created_at desc
        limit 200
      ) request
    ), '[]'::jsonb),
    'incidents', coalesce((
      select jsonb_agg(to_jsonb(incident) order by incident.created_at desc)
      from (
        select id, type, severity, status, organization_id, user_id, message,
          occurrences, last_seen_at, resolution, owner, metadata, created_at
        from samay_admin.incidents
        order by created_at desc
        limit 120
      ) incident
    ), '[]'::jsonb),
    'tickets', coalesce((
      select jsonb_agg(to_jsonb(ticket) order by ticket.created_at desc)
      from (
        select *
        from samay_admin.support_tickets
        order by created_at desc
        limit 120
      ) ticket
    ), '[]'::jsonb),
    'feature_flags', coalesce((
      select jsonb_agg(to_jsonb(flag) order by flag.created_at desc)
      from (
        select *
        from samay_admin.feature_flags
        order by created_at desc
        limit 120
      ) flag
    ), '[]'::jsonb),
    'audit_logs', coalesce((
      select jsonb_agg(to_jsonb(log_entry) order by log_entry.created_at desc)
      from (
        select *
        from samay_admin.admin_audit_logs
        order by created_at desc
        limit 120
      ) log_entry
    ), '[]'::jsonb),
    'config_rows', coalesce((
      select jsonb_agg(to_jsonb(config) order by config.key)
      from (
        select *
        from public.saas_config
        order by key
      ) config
    ), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(to_jsonb(note) order by note.created_at desc)
      from (
        select *
        from samay_admin.admin_notes
        order by created_at desc
        limit 200
      ) note
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(to_jsonb(notification) order by notification.created_at desc)
      from (
        select *
        from samay_admin.admin_notifications
        order by created_at desc
        limit 120
      ) notification
    ), '[]'::jsonb),
    'system_events', coalesce((
      select jsonb_agg(to_jsonb(system_event) order by system_event.created_at desc)
      from (
        select *
        from samay_admin.system_events
        order by created_at desc
        limit 120
      ) system_event
    ), '[]'::jsonb),
    'organization_metrics', coalesce((
      select jsonb_agg(to_jsonb(metric) order by metric.metric_date desc)
      from (
        select *
        from samay_admin.organization_metrics
        order by metric_date desc
        limit 300
      ) metric
    ), '[]'::jsonb),
    'announcements', coalesce((
      select jsonb_agg(to_jsonb(announcement) order by announcement.created_at desc)
      from (
        select *
        from samay_admin.maintenance_announcements
        order by created_at desc
        limit 80
      ) announcement
    ), '[]'::jsonb),
    'document_registry', coalesce((
      select jsonb_agg(source.payload order by source.created_at desc)
      from (
        select
          to_jsonb(registry)
            || jsonb_build_object('agencies', jsonb_build_object('name', agency.name)) as payload,
          registry.created_at
        from public.document_registry registry
        left join public.agencies agency on agency.id = registry.agency_id
        order by registry.created_at desc
        limit 200
      ) source
    ), '[]'::jsonb),
    'document_verifications', coalesce((
      select jsonb_agg(source.payload order by source.created_at desc)
      from (
        select
          to_jsonb(verification)
            || jsonb_build_object('agencies', jsonb_build_object('name', agency.name)) as payload,
          verification.created_at
        from public.document_verifications verification
        left join public.agencies agency on agency.id = verification.agency_id
        order by verification.created_at desc
        limit 200
      ) source
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$function$;

revoke all on function public.admin_console_snapshot() from public;
revoke all on function public.admin_console_snapshot() from anon;
grant execute on function public.admin_console_snapshot() to authenticated;
