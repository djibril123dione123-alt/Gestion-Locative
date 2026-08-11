-- Canonical rental billing engine.
-- The existing payment and ledger path remains intact. This migration adds an
-- immutable due source of truth and mirrors legacy payments into allocations.

alter table public.agency_settings
  add column if not exists rental_due_engine_enabled boolean not null default false,
  add column if not exists rental_due_auto_generate boolean not null default false,
  add column if not exists rent_due_day smallint not null default 5,
  add column if not exists due_generation_day smallint not null default 25,
  add column if not exists due_reminder_schedule jsonb not null default '[0, 3, 7, 15]'::jsonb;

alter table public.agency_settings
  drop constraint if exists agency_settings_rent_due_day_check,
  add constraint agency_settings_rent_due_day_check check (rent_due_day between 1 and 28),
  drop constraint if exists agency_settings_due_generation_day_check,
  add constraint agency_settings_due_generation_day_check check (due_generation_day between 1 and 28),
  drop constraint if exists agency_settings_due_reminder_schedule_check,
  add constraint agency_settings_due_reminder_schedule_check check (jsonb_typeof(due_reminder_schedule) = 'array');

create table if not exists public.contract_billing_settings (
  contract_id uuid primary key references public.contrats(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  due_day smallint check (due_day between 1 and 28),
  generation_lead_days smallint check (generation_lead_days between 0 and 62),
  document_policy text not null default 'notice' check (document_policy in ('notice', 'invoice', 'automatic')),
  allocation_strategy text not null default 'oldest_first' check (allocation_strategy in ('oldest_first', 'current_period', 'manual')),
  auto_issue boolean not null default false,
  delivery_channels jsonb not null default '[]'::jsonb check (jsonb_typeof(delivery_channels) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contract_billing_settings_agency
  on public.contract_billing_settings (agency_id, auto_issue, document_policy);

drop trigger if exists set_contract_billing_settings_updated_at on public.contract_billing_settings;
create trigger set_contract_billing_settings_updated_at
before update on public.contract_billing_settings
for each row execute function public.update_updated_at_column();

insert into public.contract_billing_settings (contract_id, agency_id)
select c.id, c.agency_id
from public.contrats c
on conflict (contract_id) do nothing;

create table if not exists public.rental_dues (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  contract_id uuid not null references public.contrats(id) on delete restrict,
  tenant_id uuid not null references public.locataires(id) on delete restrict,
  unit_id uuid not null references public.unites(id) on delete restrict,
  landlord_id uuid references public.bailleurs(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'SCHEDULED', 'TO_ISSUE', 'ISSUED', 'PARTIALLY_PAID',
    'PAID', 'OVERDUE', 'CANCELLED'
  )),
  currency text not null default 'XOF',
  amount_ht numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  amount_ttc numeric(14,2) not null default 0,
  allocated_amount numeric(14,2) not null default 0,
  outstanding_amount numeric(14,2) not null default 0,
  prior_balance numeric(14,2) not null default 0,
  credit_applied numeric(14,2) not null default 0,
  reference text,
  version integer not null default 1 check (version > 0),
  source text not null default 'generated' check (source in ('generated', 'backfill', 'manual', 'correction')),
  generation_key text not null,
  issuer_snapshot jsonb not null default '{}'::jsonb,
  parties_snapshot jsonb not null default '{}'::jsonb,
  legal_snapshot jsonb not null default '{}'::jsonb,
  fiscal_snapshot jsonb not null default '{}'::jsonb,
  contract_snapshot jsonb not null default '{}'::jsonb,
  migration_metadata jsonb not null default '{}'::jsonb,
  issued_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_dues_period_check check (period_end >= period_start),
  constraint rental_dues_amounts_check check (
    amount_ht >= 0 and tax_amount >= 0 and amount_ttc >= 0
    and allocated_amount >= 0 and outstanding_amount >= 0
    and prior_balance >= 0 and credit_applied >= 0
    and amount_ttc = amount_ht + tax_amount
  ),
  constraint rental_dues_generation_unique unique (agency_id, generation_key),
  constraint rental_dues_contract_period_version_unique unique (
    agency_id, contract_id, period_start, version
  )
);

create index if not exists idx_rental_dues_agency_status_due
  on public.rental_dues (agency_id, status, due_date, period_start);
create index if not exists idx_rental_dues_contract_period
  on public.rental_dues (agency_id, contract_id, period_start desc);
create index if not exists idx_rental_dues_landlord_period
  on public.rental_dues (agency_id, landlord_id, period_start desc);
create index if not exists idx_rental_dues_tenant_period
  on public.rental_dues (agency_id, tenant_id, period_start desc);

create table if not exists public.rental_due_lines (
  id uuid primary key default gen_random_uuid(),
  due_id uuid not null references public.rental_dues(id) on delete restrict,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  line_type text not null check (line_type in (
    'rent', 'recoverable_charge', 'service', 'penalty', 'discount', 'adjustment', 'other'
  )),
  label text not null,
  description text,
  quantity numeric(12,4) not null default 1 check (quantity > 0),
  unit_amount numeric(14,2) not null,
  price_input_mode text not null default 'ttc' check (price_input_mode in ('ht', 'ttc')),
  tax_treatment text not null default 'unknown' check (tax_treatment in (
    'unknown', 'outside_scope', 'exempt', 'taxable'
  )),
  tax_rate_id uuid references public.tax_rate_versions(id) on delete restrict,
  tax_rate numeric(7,4) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  amount_ht numeric(14,2) not null,
  tax_amount numeric(14,2) not null,
  amount_ttc numeric(14,2) not null,
  source_entity_type text,
  source_entity_id uuid,
  display_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint rental_due_lines_tax_check check (
    amount_ttc = amount_ht + tax_amount
    and (tax_treatment <> 'taxable' or tax_rate_id is not null)
  )
);

create index if not exists idx_rental_due_lines_due_order
  on public.rental_due_lines (due_id, display_order, created_at);

create unique index if not exists idx_rental_due_lines_source_unique
  on public.rental_due_lines (
    due_id,
    line_type,
    coalesce(source_entity_type, ''),
    coalesce(source_entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    display_order
  );

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  payment_id uuid not null references public.paiements(id) on delete restrict,
  due_id uuid not null references public.rental_dues(id) on delete restrict,
  allocation_type text not null default 'allocation' check (allocation_type in ('allocation', 'reversal')),
  amount numeric(14,2) not null check (amount > 0),
  strategy text not null default 'oldest_first' check (strategy in (
    'oldest_first', 'current_period', 'manual', 'legacy_month', 'credit'
  )),
  reverses_allocation_id uuid references public.payment_allocations(id) on delete restrict,
  posting_key text not null unique,
  allocated_by uuid references public.user_profiles(id) on delete set null,
  allocated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint payment_allocations_reversal_check check (
    (allocation_type = 'allocation' and reverses_allocation_id is null)
    or (allocation_type = 'reversal' and reverses_allocation_id is not null)
  )
);

create index if not exists idx_payment_allocations_due
  on public.payment_allocations (agency_id, due_id, allocated_at);
create index if not exists idx_payment_allocations_payment
  on public.payment_allocations (agency_id, payment_id, allocated_at);

create table if not exists public.rental_account_credits (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  contract_id uuid not null references public.contrats(id) on delete restrict,
  tenant_id uuid not null references public.locataires(id) on delete restrict,
  currency text not null default 'XOF',
  balance numeric(14,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  constraint rental_account_credits_unique unique (agency_id, contract_id, currency)
);

create table if not exists public.rental_credit_movements (
  id uuid primary key default gen_random_uuid(),
  credit_account_id uuid not null references public.rental_account_credits(id) on delete restrict,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  movement_type text not null check (movement_type in ('credit', 'application', 'reversal', 'refund')),
  amount numeric(14,2) not null check (amount > 0),
  payment_id uuid references public.paiements(id) on delete restrict,
  due_id uuid references public.rental_dues(id) on delete restrict,
  posting_key text not null unique,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_rental_credit_movements_account
  on public.rental_credit_movements (credit_account_id, created_at);

create table if not exists public.rental_due_documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  due_id uuid not null references public.rental_dues(id) on delete restrict,
  document_type text not null check (document_type in (
    'due_notice', 'rent_invoice', 'partial_payment_receipt', 'rent_receipt', 'credit_note'
  )),
  status text not null default 'draft' check (status in (
    'draft', 'issued', 'archived', 'cancelled', 'failed'
  )),
  reference text,
  version integer not null default 1 check (version > 0),
  document_registry_id uuid references public.document_registry(id) on delete set null,
  data_snapshot jsonb not null default '{}'::jsonb,
  renderer_version text,
  issued_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint rental_due_documents_unique unique (due_id, document_type, version)
);

create index if not exists idx_rental_due_documents_lookup
  on public.rental_due_documents (agency_id, due_id, document_type, version desc);

create table if not exists public.rental_due_deliveries (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  due_id uuid not null references public.rental_dues(id) on delete restrict,
  document_id uuid references public.rental_due_documents(id) on delete restrict,
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'download', 'manual')),
  recipient text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'failed', 'cancelled')),
  provider_reference text,
  idempotency_key text not null unique,
  error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.rental_due_reminders (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  due_id uuid not null references public.rental_dues(id) on delete restrict,
  reminder_type text not null check (reminder_type in ('due', 'overdue', 'final', 'manual')),
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'processing', 'sent', 'failed', 'cancelled')),
  idempotency_key text not null unique,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rental_due_reminders_queue
  on public.rental_due_reminders (status, scheduled_for);

create table if not exists public.rental_due_events (
  id bigint generated always as identity primary key,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  due_id uuid references public.rental_dues(id) on delete restrict,
  payment_id uuid references public.paiements(id) on delete restrict,
  event_type text not null,
  event_key text,
  actor_id uuid references public.user_profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create unique index if not exists rental_due_events_event_key_unique
  on public.rental_due_events (event_key)
  where event_key is not null;

create index if not exists idx_rental_due_events_due
  on public.rental_due_events (agency_id, due_id, occurred_at desc);

create table if not exists public.rental_due_automation_runs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  run_type text not null check (run_type in ('generation', 'status_refresh', 'reminder', 'reconciliation')),
  period_key text not null,
  idempotency_key text not null unique,
  status text not null default 'running' check (status in ('running', 'completed', 'partial', 'failed')),
  processed_count integer not null default 0,
  success_count integer not null default 0,
  error_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb
);

create or replace function public.fn_tax_amounts(
  p_amount numeric,
  p_tax_rate numeric,
  p_input_mode text
)
returns table (amount_ht numeric, tax_amount numeric, amount_ttc numeric)
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    case when p_input_mode = 'ht'
      then round(p_amount, 2)
      else round(p_amount / (1 + coalesce(p_tax_rate, 0) / 100), 2)
    end,
    case when p_input_mode = 'ht'
      then round(p_amount * coalesce(p_tax_rate, 0) / 100, 2)
      else round(p_amount - (p_amount / (1 + coalesce(p_tax_rate, 0) / 100)), 2)
    end,
    case when p_input_mode = 'ht'
      then round(p_amount * (1 + coalesce(p_tax_rate, 0) / 100), 2)
      else round(p_amount, 2)
    end;
$$;

create or replace function public.fn_refresh_rental_due(p_due_id uuid)
returns public.rental_dues
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due public.rental_dues%rowtype;
  v_allocated numeric(14,2);
  v_status text;
begin
  select * into v_due
  from public.rental_dues
  where id = p_due_id
  for update;

  if not found then
    raise exception 'DUE_NOT_FOUND';
  end if;

  select coalesce(sum(case when allocation_type = 'allocation' then amount else -amount end), 0)
  into v_allocated
  from public.payment_allocations
  where due_id = p_due_id;

  v_allocated := greatest(0, least(v_allocated, v_due.amount_ttc));

  v_status := case
    when v_due.status = 'CANCELLED' then 'CANCELLED'
    when v_allocated + v_due.credit_applied >= v_due.amount_ttc and v_due.amount_ttc > 0 then 'PAID'
    when v_allocated + v_due.credit_applied > 0 then 'PARTIALLY_PAID'
    when v_due.issued_at is not null and v_due.due_date < current_date then 'OVERDUE'
    when v_due.issued_at is not null then 'ISSUED'
    when v_due.due_date <= current_date then 'TO_ISSUE'
    else 'SCHEDULED'
  end;

  update public.rental_dues
  set allocated_amount = v_allocated,
      outstanding_amount = greatest(amount_ttc - v_allocated - credit_applied, 0),
      status = v_status,
      updated_at = now()
  where id = p_due_id
  returning * into v_due;

  return v_due;
end;
$$;

create or replace function public.fn_apply_available_rental_credit(
  p_due_id uuid,
  p_actor_id uuid default null
)
returns public.rental_dues
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due public.rental_dues%rowtype;
  v_credit public.rental_account_credits%rowtype;
  v_amount numeric(14,2);
  v_balance numeric(14,2);
begin
  select * into v_due
  from public.rental_dues
  where id = p_due_id
  for update;

  if not found then raise exception 'DUE_NOT_FOUND'; end if;
  if v_due.status = 'CANCELLED' then return v_due; end if;

  select * into v_credit
  from public.rental_account_credits
  where agency_id = v_due.agency_id
    and contract_id = v_due.contract_id
    and currency = v_due.currency
    and balance > 0
  for update;

  if not found then return public.fn_refresh_rental_due(p_due_id); end if;

  v_amount := least(v_credit.balance, greatest(v_due.outstanding_amount, 0));
  if v_amount <= 0 then return public.fn_refresh_rental_due(p_due_id); end if;

  insert into public.rental_credit_movements (
    credit_account_id, agency_id, movement_type, amount, due_id,
    posting_key, created_by, metadata
  ) values (
    v_credit.id, v_due.agency_id, 'application', v_amount, v_due.id,
    'credit:' || v_credit.id::text || ':due:' || v_due.id::text,
    p_actor_id,
    jsonb_build_object('reason', 'automatic_oldest_due_application')
  ) on conflict (posting_key) do nothing;

  select coalesce(sum(case
    when movement_type in ('credit', 'reversal') then amount
    else -amount
  end), 0)
  into v_balance
  from public.rental_credit_movements
  where credit_account_id = v_credit.id;

  update public.rental_account_credits
  set balance = greatest(v_balance, 0), updated_at = now()
  where id = v_credit.id;

  update public.rental_dues
  set credit_applied = (
        select coalesce(sum(case
          when movement_type = 'application' then amount
          when movement_type = 'reversal' then -amount
          else 0
        end), 0)
        from public.rental_credit_movements
        where due_id = p_due_id
      ),
      updated_at = now()
  where id = p_due_id;

  return public.fn_refresh_rental_due(p_due_id);
end;
$$;

create or replace function public.fn_generate_rental_due(
  p_contract_id uuid,
  p_period_start date,
  p_source text default 'generated',
  p_actor_id uuid default null
)
returns public.rental_dues
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract record;
  v_settings record;
  v_billing record;
  v_fiscal record;
  v_tax_rate numeric(7,4) := 0;
  v_tax_treatment text := 'unknown';
  v_input_mode text := 'ttc';
  v_amount record;
  v_due public.rental_dues%rowtype;
  v_period_start date := date_trunc('month', p_period_start)::date;
  v_period_end date := (date_trunc('month', p_period_start) + interval '1 month - 1 day')::date;
  v_due_date date;
  v_generation_key text;
  v_prior_balance numeric(14,2);
begin
  select
    c.*,
    u.nom as unit_name,
    u.numero as unit_number,
    i.id as property_id,
    i.nom as property_name,
    i.adresse as property_address,
    i.bailleur_id,
    l.nom as tenant_last_name,
    l.prenom as tenant_first_name,
    l.email as tenant_email,
    l.telephone as tenant_phone,
    b.nom as landlord_last_name,
    b.prenom as landlord_first_name
  into v_contract
  from public.contrats c
  join public.unites u on u.id = c.unite_id
  join public.immeubles i on i.id = u.immeuble_id
  join public.locataires l on l.id = c.locataire_id
  left join public.bailleurs b on b.id = i.bailleur_id
  where c.id = p_contract_id
  for update of c;

  if not found then raise exception 'CONTRACT_NOT_FOUND'; end if;
  if v_contract.statut::text <> 'actif' and p_source <> 'backfill' then
    raise exception 'CONTRACT_NOT_ACTIVE';
  end if;
  if v_period_end < v_contract.date_debut
     or (v_contract.date_fin is not null and v_period_start > v_contract.date_fin) then
    raise exception 'PERIOD_OUTSIDE_CONTRACT';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_contract.agency_id::text || ':' || p_contract_id::text || ':' || v_period_start::text, 0));

  insert into public.agency_settings (agency_id)
  values (v_contract.agency_id)
  on conflict (agency_id) do nothing;

  insert into public.contract_fiscal_settings (
    contract_id, agency_id, bailleur_id, lease_destination
  ) values (
    p_contract_id,
    v_contract.agency_id,
    v_contract.bailleur_id,
    case lower(coalesce(v_contract.destination, ''))
      when 'habitation' then 'residential'
      when 'commercial' then 'commercial'
      when 'mixte' then 'mixed'
      else 'unknown'
    end
  )
  on conflict (contract_id) do nothing;

  insert into public.contract_billing_settings (contract_id, agency_id)
  values (p_contract_id, v_contract.agency_id)
  on conflict (contract_id) do nothing;

  select * into v_settings from public.agency_settings where agency_id = v_contract.agency_id;
  select cfs.*, tr.rate as configured_tax_rate
  into v_fiscal
  from public.contract_fiscal_settings cfs
  left join public.tax_rate_versions tr on tr.id = cfs.rent_tax_rate_id
  where cfs.contract_id = p_contract_id;

  select * into v_billing
  from public.contract_billing_settings
  where contract_id = p_contract_id;

  if v_fiscal.contract_id is not null then
    v_tax_treatment := v_fiscal.rent_tax_treatment;
    v_input_mode := v_fiscal.rent_price_input_mode;
    if v_tax_treatment = 'taxable' then
      v_tax_rate := coalesce(v_fiscal.configured_tax_rate, 0);
    end if;
  end if;

  select * into v_amount
  from public.fn_tax_amounts(v_contract.loyer_mensuel, v_tax_rate, v_input_mode);

  v_due_date := make_date(
    extract(year from v_period_start)::integer,
    extract(month from v_period_start)::integer,
    least(coalesce(v_billing.due_day, v_settings.rent_due_day, 5), 28)
  );
  v_generation_key := p_contract_id::text || ':' || to_char(v_period_start, 'YYYY-MM') || ':v1';

  select coalesce(sum(outstanding_amount), 0)
  into v_prior_balance
  from public.rental_dues
  where agency_id = v_contract.agency_id
    and contract_id = p_contract_id
    and period_start < v_period_start
    and status <> 'CANCELLED';

  insert into public.rental_dues (
    agency_id, contract_id, tenant_id, unit_id, landlord_id,
    period_start, period_end, due_date, status, currency,
    amount_ht, tax_amount, amount_ttc, outstanding_amount, prior_balance,
    source, generation_key, issuer_snapshot, parties_snapshot, legal_snapshot,
    fiscal_snapshot, contract_snapshot, created_by
  ) values (
    v_contract.agency_id, p_contract_id, v_contract.locataire_id, v_contract.unite_id,
    v_contract.bailleur_id, v_period_start, v_period_end, v_due_date,
    case when v_due_date <= current_date then 'TO_ISSUE' else 'SCHEDULED' end,
    coalesce(v_settings.devise, 'XOF'),
    v_amount.amount_ht, v_amount.tax_amount, v_amount.amount_ttc,
    v_amount.amount_ttc, v_prior_balance, p_source, v_generation_key,
    jsonb_build_object(
      'agency_id', v_contract.agency_id,
      'name', coalesce(v_settings.nom_agence, (select name from public.agencies where id = v_contract.agency_id)),
      'ninea', v_settings.ninea,
      'rccm', v_settings.rc,
      'address', v_settings.adresse,
      'document_role', coalesce(v_fiscal.document_issuer, 'unknown')
    ),
    jsonb_build_object(
      'tenant', jsonb_build_object(
        'id', v_contract.locataire_id,
        'name', trim(concat_ws(' ', v_contract.tenant_first_name, v_contract.tenant_last_name)),
        'email', v_contract.tenant_email,
        'phone', v_contract.tenant_phone
      ),
      'landlord', jsonb_build_object(
        'id', v_contract.bailleur_id,
        'name', trim(concat_ws(' ', v_contract.landlord_first_name, v_contract.landlord_last_name))
      )
    ),
    jsonb_build_object(
      'professional_validation_status', coalesce(v_fiscal.professional_validation_status, 'to_validate'),
      'warning', 'À valider juridiquement/fiscalement'
    ),
    jsonb_build_object(
      'rent_tax_treatment', v_tax_treatment,
      'tax_rate', v_tax_rate,
      'price_input_mode', v_input_mode,
      'tax_rate_id', v_fiscal.rent_tax_rate_id,
      'effective_from', v_fiscal.effective_from,
      'validation_status', coalesce(v_fiscal.professional_validation_status, 'to_validate')
    ),
    jsonb_build_object(
      'contract_id', p_contract_id,
      'rent', v_contract.loyer_mensuel,
      'commission_rate', v_contract.commission,
      'destination', v_contract.destination,
      'property', jsonb_build_object(
        'id', v_contract.property_id,
        'name', v_contract.property_name,
        'address', v_contract.property_address
      ),
      'unit', jsonb_build_object(
        'id', v_contract.unite_id,
        'name', v_contract.unit_name,
        'number', v_contract.unit_number
      )
    ),
    p_actor_id
  )
  on conflict (agency_id, generation_key)
  do update set generation_key = excluded.generation_key
  returning * into v_due;

  insert into public.rental_due_lines (
    due_id, agency_id, line_type, label, quantity, unit_amount,
    price_input_mode, tax_treatment, tax_rate_id, tax_rate,
    amount_ht, tax_amount, amount_ttc, source_entity_type, source_entity_id, display_order
  ) values (
    v_due.id, v_due.agency_id, 'rent',
    'Loyer ' || to_char(v_period_start, 'MM/YYYY'), 1, v_contract.loyer_mensuel,
    v_input_mode, v_tax_treatment, v_fiscal.rent_tax_rate_id, v_tax_rate,
    v_amount.amount_ht, v_amount.tax_amount, v_amount.amount_ttc,
    'contract', p_contract_id, 10
  )
  on conflict do nothing;

  v_due := public.fn_apply_available_rental_credit(v_due.id, p_actor_id);

  insert into public.rental_due_events (agency_id, due_id, event_type, event_key, actor_id, payload)
  values (
    v_due.agency_id, v_due.id,
    case when p_source = 'backfill' then 'due_backfilled' else 'due_generated' end,
    'due:' || v_due.id::text || ':' || case when p_source = 'backfill' then 'backfilled' else 'generated' end,
    p_actor_id,
    jsonb_build_object('period', v_period_start, 'source', p_source)
  ) on conflict (event_key) where event_key is not null do nothing;

  return v_due;
end;
$$;

create or replace function public.fn_apply_payment_allocations(
  p_payment_id uuid,
  p_allocations jsonb default null,
  p_strategy text default 'oldest_first',
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment record;
  v_due record;
  v_requested record;
  v_remaining numeric(14,2);
  v_amount numeric(14,2);
  v_credit_account public.rental_account_credits%rowtype;
  v_allocated numeric(14,2) := 0;
  v_credit_created numeric(14,2) := 0;
  v_inserted integer := 0;
begin
  select p.*, c.locataire_id
  into v_payment
  from public.paiements p
  join public.contrats c on c.id = p.contrat_id
  where p.id = p_payment_id
  for update of p;

  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_payment.statut::text not in ('paye', 'partiel') or coalesce(v_payment.actif, true) = false then
    raise exception 'PAYMENT_NOT_POSTABLE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_payment.agency_id::text || ':' || v_payment.contrat_id::text, 0));

  select greatest(
    v_payment.montant_total - coalesce(sum(case when pa.allocation_type = 'allocation' then pa.amount else -pa.amount end), 0),
    0
  )
  into v_remaining
  from public.payment_allocations pa
  where pa.payment_id = p_payment_id;

  if p_allocations is not null and jsonb_typeof(p_allocations) = 'array' then
    for v_requested in
      select value->>'due_id' as due_id, (value->>'amount')::numeric as amount
      from jsonb_array_elements(p_allocations)
    loop
      select * into v_due
      from public.rental_dues
      where id = v_requested.due_id::uuid
        and agency_id = v_payment.agency_id
        and contract_id = v_payment.contrat_id
        and status <> 'CANCELLED'
      for update;
      if not found then raise exception 'INVALID_DUE_ALLOCATION'; end if;

      v_amount := least(v_requested.amount, v_remaining, v_due.outstanding_amount);
      if v_amount <= 0 then continue; end if;

      insert into public.payment_allocations (
        agency_id, payment_id, due_id, amount, strategy, posting_key, allocated_by
      ) values (
        v_payment.agency_id, p_payment_id, v_due.id, v_amount, 'manual',
        'payment:' || p_payment_id::text || ':due:' || v_due.id::text || ':manual', p_actor_id
      ) on conflict (posting_key) do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted = 1 then
        v_remaining := v_remaining - v_amount;
        v_allocated := v_allocated + v_amount;
        perform public.fn_refresh_rental_due(v_due.id);
      end if;
    end loop;
  else
    for v_due in
      select *
      from public.rental_dues
      where agency_id = v_payment.agency_id
        and contract_id = v_payment.contrat_id
        and status in ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE', 'TO_ISSUE', 'SCHEDULED')
        and outstanding_amount > 0
      order by
        case when p_strategy = 'current_period' and period_start = date_trunc('month', v_payment.mois_concerne)::date then 0 else 1 end,
        period_start,
        due_date,
        id
      for update
    loop
      exit when v_remaining <= 0;
      v_amount := least(v_remaining, v_due.outstanding_amount);
      insert into public.payment_allocations (
        agency_id, payment_id, due_id, amount, strategy, posting_key, allocated_by
      ) values (
        v_payment.agency_id, p_payment_id, v_due.id, v_amount, p_strategy,
        'payment:' || p_payment_id::text || ':due:' || v_due.id::text || ':' || p_strategy, p_actor_id
      ) on conflict (posting_key) do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted = 1 then
        v_remaining := v_remaining - v_amount;
        v_allocated := v_allocated + v_amount;
        perform public.fn_refresh_rental_due(v_due.id);
      end if;
    end loop;
  end if;

  if v_remaining > 0 then
    insert into public.rental_account_credits (
      agency_id, contract_id, tenant_id, currency, balance
    ) values (
      v_payment.agency_id, v_payment.contrat_id, v_payment.locataire_id, 'XOF', 0
    )
    on conflict (agency_id, contract_id, currency)
    do update set updated_at = now()
    returning * into v_credit_account;

    insert into public.rental_credit_movements (
      credit_account_id, agency_id, movement_type, amount, payment_id,
      posting_key, created_by
    ) values (
      v_credit_account.id, v_payment.agency_id, 'credit', v_remaining, p_payment_id,
      'payment:' || p_payment_id::text || ':credit', p_actor_id
    ) on conflict (posting_key) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 1 then
      v_credit_created := v_remaining;
    end if;

    update public.rental_account_credits rac
    set balance = (
      select coalesce(sum(case
        when movement_type in ('credit', 'reversal') then amount
        else -amount
      end), 0)
      from public.rental_credit_movements rcm
      where rcm.credit_account_id = rac.id
    ), updated_at = now()
    where rac.id = v_credit_account.id;
  end if;

  insert into public.rental_due_events (agency_id, payment_id, event_type, event_key, actor_id, payload)
  values (
    v_payment.agency_id, p_payment_id, 'payment_allocated',
    'payment:' || p_payment_id::text || ':allocated', p_actor_id,
    jsonb_build_object('allocated', v_allocated, 'credit', v_credit_created, 'strategy', p_strategy)
  ) on conflict (event_key) where event_key is not null do nothing;

  return jsonb_build_object('payment_id', p_payment_id, 'allocated', v_allocated, 'credit', v_credit_created);
end;
$$;

create or replace function public.trg_allocate_legacy_payment_to_due()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due public.rental_dues%rowtype;
  v_engine_enabled boolean := false;
begin
  select coalesce(s.rental_due_engine_enabled, false)
    into v_engine_enabled
    from public.agency_settings s
   where s.agency_id = new.agency_id;

  if v_engine_enabled
     and new.statut::text in ('paye', 'partiel')
     and coalesce(new.actif, true) then
    v_due := public.fn_generate_rental_due(
      new.contrat_id,
      date_trunc('month', new.mois_concerne)::date,
      case
        when exists (
          select 1 from public.contrats c
          where c.id = new.contrat_id and c.statut::text = 'actif'
        ) then 'generated'
        else 'backfill'
      end,
      new.created_by
    );
    perform public.fn_apply_payment_allocations(new.id, null, 'oldest_first', new.created_by);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_allocate_legacy_payment_to_due on public.paiements;
create trigger trg_allocate_legacy_payment_to_due
after insert on public.paiements
for each row execute function public.trg_allocate_legacy_payment_to_due();

create or replace function public.trg_reverse_due_allocations_on_payment_cancel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allocation record;
  v_credit record;
  v_engine_enabled boolean := false;
begin
  select coalesce(s.rental_due_engine_enabled, false)
    into v_engine_enabled
    from public.agency_settings s
   where s.agency_id = new.agency_id;

  if v_engine_enabled
     and old.statut::text in ('paye', 'partiel')
     and coalesce(old.actif, true)
     and (new.statut::text not in ('paye', 'partiel') or not coalesce(new.actif, true)) then
    for v_allocation in
      select pa.*
      from public.payment_allocations pa
      where pa.payment_id = new.id
        and pa.allocation_type = 'allocation'
        and not exists (
          select 1 from public.payment_allocations rev
          where rev.reverses_allocation_id = pa.id
        )
      for update
    loop
      insert into public.payment_allocations (
        agency_id, payment_id, due_id, allocation_type, amount, strategy,
        reverses_allocation_id, posting_key, allocated_by, metadata
      ) values (
        v_allocation.agency_id, v_allocation.payment_id, v_allocation.due_id,
        'reversal', v_allocation.amount, v_allocation.strategy, v_allocation.id,
        v_allocation.posting_key || ':reversal', new.created_by,
        jsonb_build_object('payment_status', new.statut::text)
      ) on conflict (posting_key) do nothing;
      perform public.fn_refresh_rental_due(v_allocation.due_id);
    end loop;

    for v_credit in
      select rcm.*
      from public.rental_credit_movements rcm
      where rcm.payment_id = new.id
        and rcm.movement_type = 'credit'
        and not exists (
          select 1
          from public.rental_credit_movements reversal
          where reversal.posting_key = rcm.posting_key || ':reversal'
        )
      for update
    loop
      insert into public.rental_credit_movements (
        credit_account_id, agency_id, movement_type, amount, payment_id,
        posting_key, created_by, metadata
      ) values (
        v_credit.credit_account_id, v_credit.agency_id, 'refund', v_credit.amount,
        new.id, v_credit.posting_key || ':reversal', new.created_by,
        jsonb_build_object('payment_status', new.statut::text, 'payment_active', new.actif)
      ) on conflict (posting_key) do nothing;

      update public.rental_account_credits rac
      set balance = greatest((
        select coalesce(sum(case
          when movement_type in ('credit', 'reversal') then amount
          else -amount
        end), 0)
        from public.rental_credit_movements movement
        where movement.credit_account_id = rac.id
      ), 0), updated_at = now()
      where rac.id = v_credit.credit_account_id;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reverse_due_allocations_on_payment_cancel on public.paiements;
create trigger trg_reverse_due_allocations_on_payment_cancel
after update of statut, actif on public.paiements
for each row execute function public.trg_reverse_due_allocations_on_payment_cancel();

create or replace function public.prevent_financial_history_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'FINANCIAL_HISTORY_IS_IMMUTABLE';
end;
$$;

drop trigger if exists trg_payment_allocations_immutable on public.payment_allocations;
create trigger trg_payment_allocations_immutable
before update or delete on public.payment_allocations
for each row execute function public.prevent_financial_history_mutation();

drop trigger if exists trg_rental_credit_movements_immutable on public.rental_credit_movements;
create trigger trg_rental_credit_movements_immutable
before update or delete on public.rental_credit_movements
for each row execute function public.prevent_financial_history_mutation();

create or replace function public.prevent_issued_due_line_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.rental_dues
  where id = case when tg_op = 'DELETE' then old.due_id else new.due_id end;
  if v_status not in ('DRAFT', 'SCHEDULED', 'TO_ISSUE') then
    raise exception 'ISSUED_DUE_LINES_ARE_IMMUTABLE';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rental_due_lines_guard on public.rental_due_lines;
create trigger trg_rental_due_lines_guard
before update or delete on public.rental_due_lines
for each row execute function public.prevent_issued_due_line_mutation();

-- Read-only browser access; all mutations pass through server-side commands.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'contract_billing_settings',
    'rental_dues', 'rental_due_lines', 'payment_allocations',
    'rental_account_credits', 'rental_credit_movements',
    'rental_due_documents', 'rental_due_deliveries', 'rental_due_reminders',
    'rental_due_events', 'rental_due_automation_runs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (agency_id = public.current_user_agency_id() or public.is_super_admin())',
      table_name || '_select_tenant', table_name
    );
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
  end loop;
end;
$$;

revoke all on function public.fn_refresh_rental_due(uuid) from public, anon, authenticated;
revoke all on function public.fn_apply_available_rental_credit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fn_generate_rental_due(uuid, date, text, uuid) from public, anon, authenticated;
revoke all on function public.fn_apply_payment_allocations(uuid, jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.trg_allocate_legacy_payment_to_due() from public, anon, authenticated;
revoke all on function public.trg_reverse_due_allocations_on_payment_cancel() from public, anon, authenticated;
revoke all on function public.prevent_financial_history_mutation() from public, anon, authenticated;
revoke all on function public.prevent_issued_due_line_mutation() from public, anon, authenticated;
grant execute on function public.fn_refresh_rental_due(uuid) to service_role;
grant execute on function public.fn_apply_available_rental_credit(uuid, uuid) to service_role;
grant execute on function public.fn_generate_rental_due(uuid, date, text, uuid) to service_role;
grant execute on function public.fn_apply_payment_allocations(uuid, jsonb, text, uuid) to service_role;
grant execute on function public.fn_tax_amounts(numeric, numeric, text) to authenticated, service_role;

alter table public.rental_dues force row level security;
alter table public.contract_billing_settings force row level security;
alter table public.rental_due_lines force row level security;
alter table public.payment_allocations force row level security;
alter table public.rental_account_credits force row level security;
alter table public.rental_credit_movements force row level security;
alter table public.rental_due_documents force row level security;
alter table public.rental_due_deliveries force row level security;
alter table public.rental_due_reminders force row level security;
alter table public.rental_due_events force row level security;
alter table public.rental_due_automation_runs force row level security;
