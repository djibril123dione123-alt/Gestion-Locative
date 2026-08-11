-- Operational completion for the canonical rental-due engine.
-- This migration is additive: it does not enable the engine for any tenant and
-- does not modify the legacy payment/ledger path.

begin;

-- The canonical detail must tell the whole operational story. Keeping these
-- arrays in the same snapshot prevents the frontend from rebuilding state from
-- unrelated queries.
create or replace function public.fn_rental_due_snapshot_internal(p_due_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due public.rental_dues;
begin
  select * into v_due from public.rental_dues where id = p_due_id;
  if not found then
    raise exception 'DUE_NOT_FOUND' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'due', to_jsonb(v_due),
    'lines', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.display_order, x.created_at)
      from public.rental_due_lines x where x.due_id = v_due.id
    ), '[]'::jsonb),
    'allocations', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.allocated_at)
      from public.payment_allocations x where x.due_id = v_due.id
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.version desc, x.created_at desc)
      from public.rental_due_documents x where x.due_id = v_due.id
    ), '[]'::jsonb),
    'deliveries', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from public.rental_due_deliveries x where x.due_id = v_due.id
    ), '[]'::jsonb),
    'reminders', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.scheduled_for, x.created_at)
      from public.rental_due_reminders x where x.due_id = v_due.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.occurred_at desc)
      from public.rental_due_events x where x.due_id = v_due.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.fn_rental_due_snapshot_internal(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_rental_due_snapshot_internal(uuid) to service_role;

-- Read-only preflight used before a monthly batch. It deliberately reports
-- uncertain fiscal/legal configuration instead of silently inventing it.
create or replace function public.fn_preview_rental_due_generation_command(
  p_agency_id uuid,
  p_actor_id uuid,
  p_period_start date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_period date := date_trunc('month', p_period_start)::date;
  v_result jsonb;
begin
  if not public.fn_rental_due_actor_can_manage(p_agency_id, p_actor_id, 'manage') then
    raise exception 'DUE_PREVIEW_FORBIDDEN' using errcode = '42501';
  end if;
  if p_period_start is null
     or v_period < date_trunc('month', current_date - interval '24 months')::date
     or v_period > date_trunc('month', current_date + interval '12 months')::date then
    raise exception 'DUE_PREVIEW_PERIOD_INVALID' using errcode = '22023';
  end if;

  with candidates as (
    select
      c.id as contract_id,
      c.loyer_mensuel,
      c.date_debut,
      c.date_fin,
      trim(concat_ws(' ', l.prenom, l.nom)) as tenant_name,
      coalesce(nullif(u.nom, ''), nullif(u.numero, ''), 'Unite sans libelle') as unit_name,
      coalesce(nullif(i.nom, ''), 'Bien sans libelle') as property_name,
      i.bailleur_id,
      cbs.contract_id is not null as has_billing_settings,
      coalesce(cbs.due_day, s.rent_due_day, 5) as due_day,
      cfs.contract_id is not null as has_fiscal_settings,
      coalesce(cfs.rent_tax_treatment, 'unknown') as rent_tax_treatment,
      cfs.rent_tax_rate_id,
      coalesce(cfs.document_issuer, 'unknown') as document_issuer,
      coalesce(cfs.professional_validation_status, 'to_validate') as fiscal_validation_status,
      coalesce(olp.professional_validation_status, 'to_validate') as organization_legal_status,
      coalesce(ofp.professional_validation_status, 'to_validate') as organization_fiscal_status,
      existing.id as existing_due_id,
      existing.status as existing_due_status,
      existing.reference as existing_due_reference
    from public.contrats c
    join public.unites u on u.id = c.unite_id
    join public.immeubles i on i.id = u.immeuble_id
    join public.locataires l on l.id = c.locataire_id
    left join public.agency_settings s on s.agency_id = c.agency_id
    left join public.contract_billing_settings cbs on cbs.contract_id = c.id
    left join public.contract_fiscal_settings cfs on cfs.contract_id = c.id
    left join public.organization_legal_profiles olp on olp.agency_id = c.agency_id
    left join public.organization_fiscal_profiles ofp on ofp.agency_id = c.agency_id
    left join public.rental_dues existing
      on existing.agency_id = c.agency_id
     and existing.contract_id = c.id
     and existing.period_start = v_period
     and existing.version = 1
    where c.agency_id = p_agency_id
      and c.statut::text = 'actif'
      and c.date_debut <= (v_period + interval '1 month - 1 day')::date
      and (c.date_fin is null or c.date_fin >= v_period)
  ), assessed as (
    select
      c.*,
      (c.loyer_mensuel is null or c.loyer_mensuel <= 0) as is_blocked,
      (
        not c.has_billing_settings
        or not c.has_fiscal_settings
        or c.rent_tax_treatment = 'unknown'
        or c.document_issuer = 'unknown'
        or c.fiscal_validation_status = 'to_validate'
        or c.organization_legal_status = 'to_validate'
        or c.organization_fiscal_status = 'to_validate'
      ) as has_warning,
      jsonb_strip_nulls(jsonb_build_object(
        'rent', case when c.loyer_mensuel is null or c.loyer_mensuel <= 0
          then 'Montant de loyer invalide' end,
        'billing', case when not c.has_billing_settings
          then 'Regles de facturation par defaut' end,
        'fiscal', case
          when not c.has_fiscal_settings then 'Profil fiscal du bail a completer'
          when c.rent_tax_treatment = 'unknown' then 'Traitement fiscal du loyer a valider'
          when c.rent_tax_treatment = 'taxable' and c.rent_tax_rate_id is null
            then 'Taux fiscal obligatoire manquant'
        end,
        'issuer', case when c.document_issuer = 'unknown'
          then 'Emetteur documentaire a confirmer' end,
        'organization', case
          when c.organization_legal_status = 'to_validate'
            or c.organization_fiscal_status = 'to_validate'
          then 'Identite legale ou fiscale de l organisation a valider'
        end,
        'existing_due', case when c.existing_due_id is not null
          then 'Echeance deja preparee : elle sera reutilisee' end
      )) as issues
    from candidates c
  )
  select jsonb_build_object(
    'agency_id', p_agency_id,
    'period_start', v_period,
    'period_end', (v_period + interval '1 month - 1 day')::date,
    'candidate_count', count(*),
    'ready_count', count(*) filter (where not is_blocked and not has_warning),
    'warning_count', count(*) filter (where not is_blocked and has_warning),
    'blocked_count', count(*) filter (where is_blocked),
    'existing_count', count(*) filter (where existing_due_id is not null),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'contract_id', contract_id,
      'tenant_name', tenant_name,
      'property_name', property_name,
      'unit_name', unit_name,
      'rent_amount', loyer_mensuel,
      'due_day', due_day,
      'readiness', case when is_blocked then 'blocked'
        when has_warning then 'warning' else 'ready' end,
      'issues', issues,
      'existing_due_id', existing_due_id,
      'existing_due_status', existing_due_status,
      'existing_due_reference', existing_due_reference
    ) order by property_name, unit_name, tenant_name), '[]'::jsonb)
  ) into v_result
  from assessed;

  return v_result;
end;
$$;

-- Cancellation never edits ledger entries. A due with money applied is refused;
-- an already-issued invoice requires an issued credit note before cancellation.
create or replace function public.fn_cancel_rental_due_command(
  p_agency_id uuid,
  p_actor_id uuid,
  p_due_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due public.rental_dues%rowtype;
  v_net_allocated numeric(14,2);
begin
  if not public.fn_rental_due_actor_can_manage(p_agency_id, p_actor_id, 'manage') then
    raise exception 'DUE_CANCEL_FORBIDDEN' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 8 then
    raise exception 'DUE_CANCEL_REASON_REQUIRED' using errcode = '22023';
  end if;

  select * into v_due
  from public.rental_dues
  where id = p_due_id and agency_id = p_agency_id
  for update;
  if not found then raise exception 'DUE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_due.status = 'CANCELLED' then
    return public.fn_rental_due_snapshot_internal(v_due.id);
  end if;

  select coalesce(sum(case when allocation_type = 'reversal' then -amount else amount end), 0)
    into v_net_allocated
  from public.payment_allocations
  where due_id = v_due.id;
  if v_net_allocated > 0.01 or v_due.credit_applied > 0.01
     or v_due.status in ('PARTIALLY_PAID', 'PAID') then
    raise exception 'DUE_CANCEL_REQUIRES_PAYMENT_REVERSAL' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.rental_due_documents
    where due_id = v_due.id and document_type in ('rent_invoice', 'due_notice')
      and status in ('issued', 'archived')
  ) and not exists (
    select 1 from public.rental_due_documents
    where due_id = v_due.id and document_type = 'credit_note'
      and status in ('issued', 'archived')
  ) then
    raise exception 'DUE_CANCEL_REQUIRES_CREDIT_NOTE' using errcode = '55000';
  end if;

  update public.rental_dues
  set status = 'CANCELLED', cancelled_at = now(),
      cancellation_reason = trim(p_reason), updated_at = now()
  where id = v_due.id;
  update public.rental_due_documents
  set status = 'cancelled', cancelled_at = now()
  where due_id = v_due.id and status = 'draft';
  update public.rental_due_reminders
  set status = 'cancelled', updated_at = now()
  where due_id = v_due.id and status in ('scheduled', 'processing');
  update public.rental_due_deliveries
  set status = 'cancelled'
  where due_id = v_due.id and status = 'pending';

  insert into public.rental_due_events (
    agency_id, due_id, event_type, event_key, actor_id, payload
  ) values (
    p_agency_id, v_due.id, 'due_cancelled',
    'due:' || v_due.id::text || ':cancelled', p_actor_id,
    jsonb_build_object('reason', trim(p_reason), 'previous_status', v_due.status)
  ) on conflict (event_key) where event_key is not null do nothing;

  return public.fn_rental_due_snapshot_internal(v_due.id);
end;
$$;

-- Records a real user delivery action only. Provider delivery channels remain
-- unavailable until a sender integration can supply trustworthy callbacks.
create or replace function public.fn_record_rental_due_delivery_command(
  p_agency_id uuid,
  p_actor_id uuid,
  p_due_id uuid,
  p_document_id uuid,
  p_channel text,
  p_recipient text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document public.rental_due_documents%rowtype;
  v_delivery public.rental_due_deliveries%rowtype;
  v_key text;
begin
  if not public.fn_rental_due_actor_can_manage(p_agency_id, p_actor_id, 'create')
     and not public.fn_user_can(p_actor_id, 'documents', 'export') then
    raise exception 'DUE_DELIVERY_FORBIDDEN' using errcode = '42501';
  end if;
  if p_channel not in ('download', 'manual') then
    raise exception 'DUE_DELIVERY_CHANNEL_UNAVAILABLE' using errcode = '22023';
  end if;
  select * into v_document
  from public.rental_due_documents
  where id = p_document_id and due_id = p_due_id and agency_id = p_agency_id
    and status in ('issued', 'archived');
  if not found then
    raise exception 'DUE_DOCUMENT_NOT_ISSUED' using errcode = '55000';
  end if;

  v_key := 'due-document:' || v_document.id::text || ':first-' || p_channel;
  insert into public.rental_due_deliveries (
    agency_id, due_id, document_id, channel, recipient, status,
    idempotency_key, sent_at, metadata
  ) values (
    p_agency_id, p_due_id, p_document_id, p_channel,
    nullif(trim(coalesce(p_recipient, '')), ''), 'delivered',
    v_key, now(), jsonb_build_object('recorded_by', p_actor_id)
  ) on conflict (idempotency_key) do update
    set recipient = coalesce(public.rental_due_deliveries.recipient, excluded.recipient)
  returning * into v_delivery;

  insert into public.rental_due_events (
    agency_id, due_id, event_type, event_key, actor_id, payload
  ) values (
    p_agency_id, p_due_id, 'document_delivered',
    v_key || ':event', p_actor_id,
    jsonb_build_object('document_id', p_document_id, 'channel', p_channel)
  ) on conflict (event_key) where event_key is not null do nothing;

  return to_jsonb(v_delivery);
end;
$$;

-- Scheduling is callable through the service command only. An authenticated
-- actor is checked when provided; the daily service job uses a null actor.
create or replace function public.fn_schedule_rental_due_reminders(
  p_due_id uuid,
  p_actor_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due public.rental_dues%rowtype;
  v_offsets jsonb;
  v_offset integer;
  v_count integer := 0;
  v_inserted integer := 0;
begin
  select * into v_due from public.rental_dues where id = p_due_id for update;
  if not found then raise exception 'DUE_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_actor_id is not null
     and not public.fn_rental_due_actor_can_manage(v_due.agency_id, p_actor_id, 'create') then
    raise exception 'DUE_REMINDER_FORBIDDEN' using errcode = '42501';
  end if;
  if v_due.status in ('PAID', 'CANCELLED') then
    raise exception 'DUE_REMINDER_NOT_APPLICABLE' using errcode = '22023';
  end if;

  select coalesce(s.due_reminder_schedule, '[0,3,7,15]'::jsonb) into v_offsets
  from public.agency_settings s where s.agency_id = v_due.agency_id;
  v_offsets := coalesce(v_offsets, '[0,3,7,15]'::jsonb);
  for v_offset in select value::text::integer from jsonb_array_elements(v_offsets)
  loop
    insert into public.rental_due_reminders (
      agency_id, due_id, reminder_type, scheduled_for, idempotency_key
    ) values (
      v_due.agency_id, v_due.id,
      case when v_offset = 0 then 'due' when v_offset >= 15 then 'final' else 'overdue' end,
      (v_due.due_date + v_offset)::timestamp at time zone 'UTC',
      'due:' || v_due.id::text || ':reminder:' || v_offset::text
    ) on conflict (idempotency_key) do nothing;
    get diagnostics v_inserted = row_count;
    v_count := v_count + v_inserted;
  end loop;
  return v_count;
end;
$$;

-- Contract workspace read model. It follows the same tenant/owner restrictions
-- as fn_rental_due_detail and exposes no cross-tenant rows.
create or replace function public.fn_contract_rental_due_summary(p_contract_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract public.contrats%rowtype;
  v_role text;
  v_bailleur_id uuid;
  v_owner_account boolean;
begin
  select * into v_contract from public.contrats where id = p_contract_id;
  if not found then raise exception 'CONTRACT_NOT_FOUND' using errcode = 'P0002'; end if;

  select up.role::text, up.bailleur_id, coalesce(a.is_bailleur_account, false)
    into v_role, v_bailleur_id, v_owner_account
  from public.user_profiles up
  join public.agencies a on a.id = up.agency_id
  where up.id = auth.uid() and coalesce(up.actif, true);
  if not found then raise exception 'FINANCE_FORBIDDEN' using errcode = '42501'; end if;
  if v_contract.agency_id <> public.current_user_agency_id()
     or (v_role = 'bailleur' and not v_owner_account and (
       v_bailleur_id is null or not exists (
         select 1 from public.rental_dues d
         where d.contract_id = v_contract.id and d.landlord_id = v_bailleur_id
       )
     )) then
    raise exception 'FINANCE_FORBIDDEN' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', d.id,
      'period_start', d.period_start,
      'period_end', d.period_end,
      'due_date', d.due_date,
      'status', d.status,
      'currency', d.currency,
      'amount_ttc', d.amount_ttc,
      'allocated_amount', d.allocated_amount,
      'outstanding_amount', d.outstanding_amount,
      'reference', d.reference,
      'issued_at', d.issued_at,
      'document_count', (select count(*) from public.rental_due_documents rd where rd.due_id = d.id and rd.status <> 'cancelled'),
      'reminder_count', (select count(*) from public.rental_due_reminders rr where rr.due_id = d.id and rr.status <> 'cancelled')
    ) order by d.period_start desc, d.version desc)
    from public.rental_dues d
    where d.contract_id = v_contract.id and d.agency_id = v_contract.agency_id
      and (v_role <> 'bailleur' or v_owner_account or d.landlord_id = v_bailleur_id)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.fn_preview_rental_due_generation_command(uuid, uuid, date)
  from public, anon, authenticated;
revoke all on function public.fn_cancel_rental_due_command(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.fn_record_rental_due_delivery_command(uuid, uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.fn_schedule_rental_due_reminders(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.fn_contract_rental_due_summary(uuid)
  from public, anon;

grant execute on function public.fn_preview_rental_due_generation_command(uuid, uuid, date) to service_role;
grant execute on function public.fn_cancel_rental_due_command(uuid, uuid, uuid, text) to service_role;
grant execute on function public.fn_record_rental_due_delivery_command(uuid, uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.fn_schedule_rental_due_reminders(uuid, uuid) to service_role;
grant execute on function public.fn_contract_rental_due_summary(uuid) to authenticated, service_role;

commit;
