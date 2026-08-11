-- Rental due integrity guardrails and canonical reporting read models.
-- This migration is additive and does not enable the engine for any agency.

begin;

-- ---------------------------------------------------------------------------
-- Cross-table tenant integrity. RLS protects reads, while these triggers also
-- prevent a privileged command from accidentally linking records from two
-- different agencies or two unrelated rental dues.
-- ---------------------------------------------------------------------------

create or replace function public.validate_rental_due_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_agency_id uuid := nullif(v_row->>'agency_id', '')::uuid;
  v_due_id uuid := nullif(v_row->>'due_id', '')::uuid;
  v_document_id uuid := nullif(v_row->>'document_id', '')::uuid;
  v_document_registry_id uuid := nullif(v_row->>'document_registry_id', '')::uuid;
  v_payment_id uuid := nullif(v_row->>'payment_id', '')::uuid;
  v_credit_account_id uuid := nullif(v_row->>'credit_account_id', '')::uuid;
  v_contract_id uuid := nullif(v_row->>'contract_id', '')::uuid;
  v_reversal_id uuid := nullif(v_row->>'reverses_allocation_id', '')::uuid;
  v_related_agency_id uuid;
  v_related_due_id uuid;
  v_related_payment_id uuid;
begin
  if v_agency_id is null then
    raise exception 'RENTAL_DUE_SCOPE_AGENCY_REQUIRED' using errcode = '23514';
  end if;

  if v_due_id is not null then
    select d.agency_id into v_related_agency_id
      from public.rental_dues d where d.id = v_due_id;
    if not found then
      raise exception 'RENTAL_DUE_SCOPE_DUE_NOT_FOUND' using errcode = '23503';
    end if;
    if v_related_agency_id <> v_agency_id then
      raise exception 'RENTAL_DUE_SCOPE_AGENCY_MISMATCH' using errcode = '23514';
    end if;
  end if;

  if v_document_id is not null then
    select d.agency_id, d.due_id into v_related_agency_id, v_related_due_id
      from public.rental_due_documents d where d.id = v_document_id;
    if not found then
      raise exception 'RENTAL_DUE_SCOPE_DOCUMENT_NOT_FOUND' using errcode = '23503';
    end if;
    if v_related_agency_id <> v_agency_id
       or (v_due_id is not null and v_related_due_id <> v_due_id) then
      raise exception 'RENTAL_DUE_SCOPE_DOCUMENT_MISMATCH' using errcode = '23514';
    end if;
  end if;

  if v_document_registry_id is not null then
    select r.agency_id into v_related_agency_id
      from public.document_registry r where r.id = v_document_registry_id;
    if not found then
      raise exception 'RENTAL_DUE_SCOPE_REGISTRY_DOCUMENT_NOT_FOUND' using errcode = '23503';
    end if;
    if v_related_agency_id <> v_agency_id then
      raise exception 'RENTAL_DUE_SCOPE_REGISTRY_DOCUMENT_MISMATCH' using errcode = '23514';
    end if;
  end if;

  if v_payment_id is not null then
    select p.agency_id into v_related_agency_id
      from public.paiements p where p.id = v_payment_id;
    if not found then
      raise exception 'RENTAL_DUE_SCOPE_PAYMENT_NOT_FOUND' using errcode = '23503';
    end if;
    if v_related_agency_id <> v_agency_id then
      raise exception 'RENTAL_DUE_SCOPE_PAYMENT_MISMATCH' using errcode = '23514';
    end if;
  end if;

  if v_credit_account_id is not null then
    select c.agency_id into v_related_agency_id
      from public.rental_account_credits c where c.id = v_credit_account_id;
    if not found then
      raise exception 'RENTAL_DUE_SCOPE_CREDIT_NOT_FOUND' using errcode = '23503';
    end if;
    if v_related_agency_id <> v_agency_id then
      raise exception 'RENTAL_DUE_SCOPE_CREDIT_MISMATCH' using errcode = '23514';
    end if;
  end if;

  if v_contract_id is not null then
    select c.agency_id into v_related_agency_id
      from public.contrats c where c.id = v_contract_id;
    if not found then
      raise exception 'RENTAL_DUE_SCOPE_CONTRACT_NOT_FOUND' using errcode = '23503';
    end if;
    if v_related_agency_id <> v_agency_id then
      raise exception 'RENTAL_DUE_SCOPE_CONTRACT_MISMATCH' using errcode = '23514';
    end if;
  end if;

  if v_reversal_id is not null then
    select a.agency_id, a.due_id, a.payment_id
      into v_related_agency_id, v_related_due_id, v_related_payment_id
      from public.payment_allocations a where a.id = v_reversal_id;
    if not found then
      raise exception 'RENTAL_DUE_SCOPE_ALLOCATION_NOT_FOUND' using errcode = '23503';
    end if;
    if v_related_agency_id <> v_agency_id
       or v_related_due_id <> v_due_id
       or v_related_payment_id <> v_payment_id then
      raise exception 'RENTAL_DUE_SCOPE_REVERSAL_MISMATCH' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'contract_billing_settings',
    'rental_due_lines',
    'payment_allocations',
    'rental_account_credits',
    'rental_credit_movements',
    'rental_due_documents',
    'rental_due_deliveries',
    'rental_due_reminders',
    'rental_due_events'
  ] loop
    execute format('drop trigger if exists trg_validate_rental_due_scope on public.%I', v_table);
    execute format(
      'create trigger trg_validate_rental_due_scope before insert or update on public.%I for each row execute function public.validate_rental_due_scope()',
      v_table
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Document state machine. A document can only be prepared when its business
-- state is true, and a credit note cannot exist without a previously issued
-- bill. The advisory lock preserves idempotence under concurrent requests.
-- ---------------------------------------------------------------------------

create or replace function public.fn_prepare_rental_due_document_command(
  p_agency_id uuid,
  p_actor_id uuid,
  p_due_id uuid,
  p_document_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due public.rental_dues%rowtype;
  v_existing public.rental_due_documents%rowtype;
  v_document public.rental_due_documents%rowtype;
  v_version integer;
  v_reference text;
  v_snapshot jsonb;
begin
  if not public.fn_rental_due_actor_can_manage(p_agency_id, p_actor_id, 'create')
     and not public.fn_user_can(p_actor_id, 'documents', 'export') then
    raise exception 'DUE_DOCUMENT_FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_due
    from public.rental_dues
   where id = p_due_id and agency_id = p_agency_id
   for update;
  if not found then
    raise exception 'DUE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_document_type not in (
    'due_notice', 'rent_invoice', 'partial_payment_receipt', 'rent_receipt', 'credit_note'
  ) then
    raise exception 'DUE_DOCUMENT_TYPE_INVALID' using errcode = '22023';
  end if;

  if v_due.status = 'CANCELLED' then
    raise exception 'CANCELLED_DUE_DOCUMENT_FORBIDDEN' using errcode = '22023';
  end if;
  if p_document_type in ('due_notice', 'rent_invoice')
     and v_due.status = 'PAID' then
    raise exception 'PAID_DUE_BILLING_DOCUMENT_FORBIDDEN' using errcode = '22023';
  end if;
  if p_document_type = 'partial_payment_receipt'
     and v_due.status <> 'PARTIALLY_PAID' then
    raise exception 'PARTIAL_RECEIPT_REQUIRES_PARTIAL_DUE' using errcode = '22023';
  end if;
  if p_document_type = 'rent_receipt'
     and v_due.status <> 'PAID' then
    raise exception 'RENT_RECEIPT_REQUIRES_PAID_DUE' using errcode = '22023';
  end if;
  if p_document_type = 'credit_note' then
    if not exists (
      select 1 from public.rental_due_documents d
       where d.due_id = p_due_id
         and d.document_type in ('due_notice', 'rent_invoice')
         and d.status in ('issued', 'archived')
    ) then
      raise exception 'CREDIT_NOTE_REQUIRES_ISSUED_BILL' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.rental_due_documents d
       where d.due_id = p_due_id
         and d.document_type = 'credit_note'
         and d.status in ('issued', 'archived')
    ) then
      raise exception 'CREDIT_NOTE_ALREADY_ISSUED' using errcode = '23505';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'due-document:' || p_due_id::text || ':' || p_document_type, 0
  ));

  v_snapshot := public.fn_rental_due_snapshot_internal(p_due_id)
    || jsonb_build_object('prepared_at', now(), 'due_updated_at', v_due.updated_at);

  select * into v_existing
    from public.rental_due_documents
   where due_id = p_due_id
     and document_type = p_document_type
     and status in ('draft', 'issued', 'archived')
     and data_snapshot->>'due_updated_at' = v_due.updated_at::text
   order by version desc
   limit 1;
  if found then
    return jsonb_build_object('reused', true, 'document', to_jsonb(v_existing));
  end if;

  select coalesce(max(version), 0) + 1 into v_version
    from public.rental_due_documents
   where due_id = p_due_id and document_type = p_document_type;

  v_reference := public.fn_next_rental_document_reference(
    p_agency_id, p_document_type, current_date
  );

  insert into public.rental_due_documents (
    agency_id, due_id, document_type, status, reference, version,
    data_snapshot, renderer_version, created_by
  ) values (
    p_agency_id, p_due_id, p_document_type, 'draft', v_reference, v_version,
    v_snapshot, 'rental-due-v1', p_actor_id
  ) returning * into v_document;

  insert into public.rental_due_events (
    agency_id, due_id, event_type, event_key, actor_id, payload
  ) values (
    p_agency_id, p_due_id, 'document_prepared',
    'due-document:' || v_document.id::text || ':prepared', p_actor_id,
    jsonb_build_object(
      'document_id', v_document.id,
      'type', p_document_type,
      'reference', v_reference,
      'version', v_version
    )
  ) on conflict (event_key) where event_key is not null do nothing;

  return jsonb_build_object('reused', false, 'document', to_jsonb(v_document));
end;
$$;

-- ---------------------------------------------------------------------------
-- Canonical read models. Both fail closed for inactive or foreign profiles and
-- expose aggregates derived from the server-side due ledger only.
-- ---------------------------------------------------------------------------

create or replace function public.fn_rental_due_dashboard_summary(
  p_agency_id uuid,
  p_as_of date default current_date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_allowed boolean;
begin
  select exists (
    select 1 from public.user_profiles up
     where up.id = auth.uid()
       and up.agency_id = p_agency_id
       and coalesce(up.actif, true)
  ) or public.is_super_admin() into v_allowed;
  if not v_allowed then
    raise exception 'FINANCE_FORBIDDEN' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'as_of', p_as_of,
    'currency', 'XOF',
    'due_count', count(*),
    'total_billed', coalesce(sum(d.amount_ttc) filter (where d.status <> 'CANCELLED'), 0),
    'total_collected', coalesce(sum(d.allocated_amount + d.credit_applied) filter (where d.status <> 'CANCELLED'), 0),
    'total_outstanding', coalesce(sum(d.outstanding_amount) filter (where d.status <> 'CANCELLED'), 0),
    'overdue_count', count(*) filter (where d.status = 'OVERDUE' or (d.outstanding_amount > 0 and d.due_date < p_as_of and d.status <> 'CANCELLED')),
    'overdue_amount', coalesce(sum(d.outstanding_amount) filter (where d.status = 'OVERDUE' or (d.outstanding_amount > 0 and d.due_date < p_as_of and d.status <> 'CANCELLED')), 0),
    'paid_count', count(*) filter (where d.status = 'PAID'),
    'partial_count', count(*) filter (where d.status = 'PARTIALLY_PAID')
  )
  from public.rental_dues d
  where d.agency_id = p_agency_id;
end;
$$;

create or replace function public.fn_owner_rental_due_summary(
  p_agency_id uuid,
  p_landlord_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_profile_landlord_id uuid;
  v_owner_account boolean;
  v_profile_found boolean := false;
  v_super_admin boolean := false;
  v_landlord_exists boolean := false;
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'FINANCE_INVALID_PERIOD' using errcode = '22023';
  end if;

  select up.role::text, up.bailleur_id, coalesce(a.is_bailleur_account, false)
    into v_role, v_profile_landlord_id, v_owner_account
    from public.user_profiles up
    join public.agencies a on a.id = up.agency_id
   where up.id = auth.uid()
     and up.agency_id = p_agency_id
     and coalesce(up.actif, true);

  v_profile_found := found;
  v_super_admin := public.is_super_admin();

  if not v_profile_found and not v_super_admin then
    raise exception 'FINANCE_FORBIDDEN' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.bailleurs b
     where b.id = p_landlord_id
       and b.agency_id = p_agency_id
  ) into v_landlord_exists;
  if not v_landlord_exists then
    raise exception 'FINANCE_LANDLORD_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_profile_found and v_role = 'bailleur' and not v_owner_account
     and (v_profile_landlord_id is null or v_profile_landlord_id <> p_landlord_id) then
    raise exception 'FINANCE_FORBIDDEN' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'agency_id', p_agency_id,
    'landlord_id', p_landlord_id,
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'currency', 'XOF',
    'total_billed', coalesce(sum(d.amount_ttc) filter (where d.status <> 'CANCELLED'), 0),
    'total_collected', coalesce(sum(d.allocated_amount + d.credit_applied) filter (where d.status <> 'CANCELLED'), 0),
    'total_outstanding', coalesce(sum(d.outstanding_amount) filter (where d.status <> 'CANCELLED'), 0),
    'due_count', count(*) filter (where d.status <> 'CANCELLED'),
    'lines', coalesce(jsonb_agg(jsonb_build_object(
      'due_id', d.id,
      'contract_id', d.contract_id,
      'unit_id', d.unit_id,
      'tenant_id', d.tenant_id,
      'period_start', d.period_start,
      'period_end', d.period_end,
      'due_date', d.due_date,
      'status', d.status,
      'reference', d.reference,
      'amount_ttc', d.amount_ttc,
      'collected', d.allocated_amount + d.credit_applied,
      'outstanding', d.outstanding_amount
    ) order by d.period_start, d.due_date) filter (where d.id is not null), '[]'::jsonb)
  )
  from public.rental_dues d
  where d.agency_id = p_agency_id
    and d.landlord_id = p_landlord_id
    and d.period_start between date_trunc('month', p_from)::date and date_trunc('month', p_to)::date;
end;
$$;

revoke all on function public.validate_rental_due_scope() from public, anon, authenticated;
revoke all on function public.fn_prepare_rental_due_document_command(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.fn_rental_due_dashboard_summary(uuid, date)
  from public, anon;
revoke all on function public.fn_owner_rental_due_summary(uuid, uuid, date, date)
  from public, anon;

grant execute on function public.fn_prepare_rental_due_document_command(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.fn_rental_due_dashboard_summary(uuid, date)
  to authenticated;
grant execute on function public.fn_owner_rental_due_summary(uuid, uuid, date, date)
  to authenticated;

commit;
