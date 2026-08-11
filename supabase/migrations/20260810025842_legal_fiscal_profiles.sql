-- Legal and fiscal identities are deliberately separate from the business account type.
-- Existing tenants remain usable: every uncertain value starts as "unknown" and the UI
-- must request professional validation before issuing a fiscal document.

create table if not exists public.organization_legal_profiles (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  legal_form text not null default 'unknown' check (legal_form in (
    'unknown', 'individual', 'sole_proprietorship', 'sarl', 'sa', 'sas',
    'snc', 'scs', 'gie', 'association', 'public_entity', 'other'
  )),
  business_activities text[] not null default '{}'::text[],
  trade_name text,
  legal_name text,
  ninea text,
  rccm text,
  registered_office text,
  representative_name text,
  representative_capacity text,
  document_role text not null default 'unknown' check (document_role in (
    'unknown', 'principal', 'agent', 'representative', 'manager_on_behalf'
  )),
  mandate_reference text,
  professional_validation_status text not null default 'to_validate' check (
    professional_validation_status in ('to_validate', 'validated', 'not_applicable')
  ),
  validated_at timestamptz,
  validated_by uuid references public.user_profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_fiscal_profiles (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  tax_status text not null default 'unknown' check (tax_status in (
    'unknown', 'not_subject', 'subject', 'exempt', 'mixed'
  )),
  vat_registration_status text not null default 'unknown' check (vat_registration_status in (
    'unknown', 'not_registered', 'registered', 'exempt'
  )),
  vat_number text,
  rent_tax_treatment text not null default 'unknown' check (rent_tax_treatment in (
    'unknown', 'outside_scope', 'exempt', 'taxable', 'mixed'
  )),
  commission_tax_treatment text not null default 'unknown' check (commission_tax_treatment in (
    'unknown', 'outside_scope', 'exempt', 'taxable'
  )),
  price_input_mode text not null default 'ttc' check (price_input_mode in ('ht', 'ttc')),
  professional_validation_status text not null default 'to_validate' check (
    professional_validation_status in ('to_validate', 'validated', 'not_applicable')
  ),
  effective_from date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bailleur_legal_profiles (
  bailleur_id uuid primary key references public.bailleurs(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  party_type text not null default 'unknown' check (party_type in (
    'unknown', 'individual', 'legal_entity', 'joint_ownership', 'estate', 'other'
  )),
  legal_form text not null default 'unknown' check (legal_form in (
    'unknown', 'individual', 'sole_proprietorship', 'sarl', 'sa', 'sas',
    'snc', 'scs', 'gie', 'association', 'public_entity', 'other'
  )),
  legal_name text,
  trade_name text,
  ninea text,
  rccm text,
  representative_name text,
  representative_capacity text,
  document_role text not null default 'principal' check (document_role in (
    'principal', 'represented', 'co_owner', 'beneficiary', 'other'
  )),
  professional_validation_status text not null default 'to_validate' check (
    professional_validation_status in ('to_validate', 'validated', 'not_applicable')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bailleur_legal_profiles_agency
  on public.bailleur_legal_profiles (agency_id, bailleur_id);

create table if not exists public.bailleur_fiscal_profiles (
  bailleur_id uuid primary key references public.bailleurs(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  tax_status text not null default 'unknown' check (tax_status in (
    'unknown', 'not_subject', 'subject', 'exempt', 'mixed'
  )),
  vat_registration_status text not null default 'unknown' check (vat_registration_status in (
    'unknown', 'not_registered', 'registered', 'exempt'
  )),
  vat_number text,
  default_rent_tax_treatment text not null default 'unknown' check (default_rent_tax_treatment in (
    'unknown', 'outside_scope', 'exempt', 'taxable', 'mixed'
  )),
  professional_validation_status text not null default 'to_validate' check (
    professional_validation_status in ('to_validate', 'validated', 'not_applicable')
  ),
  effective_from date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bailleur_fiscal_profiles_agency
  on public.bailleur_fiscal_profiles (agency_id, bailleur_id);

create table if not exists public.tax_rate_versions (
  id uuid primary key default gen_random_uuid(),
  jurisdiction text not null default 'SN',
  tax_code text not null,
  label text not null,
  rate numeric(7,4) not null check (rate >= 0 and rate <= 100),
  effective_from date not null,
  effective_to date,
  source_label text,
  source_url text,
  validation_status text not null default 'to_validate' check (
    validation_status in ('to_validate', 'validated', 'retired')
  ),
  created_at timestamptz not null default now(),
  constraint tax_rate_versions_dates_check check (
    effective_to is null or effective_to >= effective_from
  ),
  constraint tax_rate_versions_unique unique (jurisdiction, tax_code, effective_from)
);

create index if not exists idx_tax_rate_versions_lookup
  on public.tax_rate_versions (jurisdiction, tax_code, effective_from desc);

-- This catalog entry is informative until a professional validates the tenant's
-- applicability. It is never selected automatically by the due engine.
insert into public.tax_rate_versions (
  jurisdiction, tax_code, label, rate, effective_from, source_label, source_url, validation_status
) values (
  'SN', 'VAT_STANDARD', 'TVA - taux normal', 18.0000, date '2013-01-01',
  'Code général des impôts / DGID Sénégal',
  'https://www.servicepublic.gouv.sn/storage/texte_references/t-code-general-impots-2013.pdf',
  'to_validate'
)
on conflict (jurisdiction, tax_code, effective_from) do nothing;

create table if not exists public.contract_fiscal_settings (
  contract_id uuid primary key references public.contrats(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  bailleur_id uuid references public.bailleurs(id) on delete set null,
  lease_destination text not null default 'unknown' check (lease_destination in (
    'unknown', 'residential', 'professional', 'commercial', 'mixed', 'other'
  )),
  invoice_required boolean,
  rent_tax_treatment text not null default 'unknown' check (rent_tax_treatment in (
    'unknown', 'outside_scope', 'exempt', 'taxable'
  )),
  rent_tax_rate_id uuid references public.tax_rate_versions(id) on delete restrict,
  rent_price_input_mode text not null default 'ttc' check (rent_price_input_mode in ('ht', 'ttc')),
  commission_tax_treatment text not null default 'unknown' check (commission_tax_treatment in (
    'unknown', 'outside_scope', 'exempt', 'taxable'
  )),
  commission_tax_rate_id uuid references public.tax_rate_versions(id) on delete restrict,
  commission_price_input_mode text not null default 'ttc' check (commission_price_input_mode in ('ht', 'ttc')),
  document_issuer text not null default 'unknown' check (document_issuer in (
    'unknown', 'agency', 'landlord', 'agency_on_behalf_of_landlord'
  )),
  lease_registration_status text not null default 'unknown' check (lease_registration_status in (
    'unknown', 'to_register', 'registered', 'not_applicable'
  )),
  lease_registration_reference text,
  lease_registration_date date,
  professional_validation_status text not null default 'to_validate' check (
    professional_validation_status in ('to_validate', 'validated', 'not_applicable')
  ),
  effective_from date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_fiscal_tax_rate_check check (
    (rent_tax_treatment <> 'taxable' or rent_tax_rate_id is not null)
    and (commission_tax_treatment <> 'taxable' or commission_tax_rate_id is not null)
  )
);

create index if not exists idx_contract_fiscal_settings_agency
  on public.contract_fiscal_settings (agency_id, contract_id);

create or replace function public.touch_legal_fiscal_profile_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organization_legal_profiles', 'organization_fiscal_profiles',
    'bailleur_legal_profiles', 'bailleur_fiscal_profiles', 'contract_fiscal_settings'
  ] loop
    execute format('drop trigger if exists trg_%I_touch on public.%I', table_name, table_name);
    execute format(
      'create trigger trg_%I_touch before update on public.%I for each row execute function public.touch_legal_fiscal_profile_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

-- Tenant isolation. Fiscal configuration can be maintained by agency admins, while
-- the global tax catalog is read-only from the browser.
alter table public.organization_legal_profiles enable row level security;
alter table public.organization_legal_profiles force row level security;
alter table public.organization_fiscal_profiles enable row level security;
alter table public.organization_fiscal_profiles force row level security;
alter table public.bailleur_legal_profiles enable row level security;
alter table public.bailleur_legal_profiles force row level security;
alter table public.bailleur_fiscal_profiles enable row level security;
alter table public.bailleur_fiscal_profiles force row level security;
alter table public.contract_fiscal_settings enable row level security;
alter table public.contract_fiscal_settings force row level security;
alter table public.tax_rate_versions enable row level security;
alter table public.tax_rate_versions force row level security;

create policy organization_legal_profiles_select_tenant
  on public.organization_legal_profiles for select to authenticated
  using (agency_id = public.current_user_agency_id() or public.is_super_admin());
create policy organization_legal_profiles_admin_write
  on public.organization_legal_profiles for all to authenticated
  using (agency_id = public.current_user_agency_id() and public.is_admin())
  with check (agency_id = public.current_user_agency_id() and public.is_admin());

create policy organization_fiscal_profiles_select_tenant
  on public.organization_fiscal_profiles for select to authenticated
  using (agency_id = public.current_user_agency_id() or public.is_super_admin());
create policy organization_fiscal_profiles_admin_write
  on public.organization_fiscal_profiles for all to authenticated
  using (agency_id = public.current_user_agency_id() and public.is_admin())
  with check (agency_id = public.current_user_agency_id() and public.is_admin());

create policy bailleur_legal_profiles_select_tenant
  on public.bailleur_legal_profiles for select to authenticated
  using (agency_id = public.current_user_agency_id() or public.is_super_admin());
create policy bailleur_legal_profiles_admin_write
  on public.bailleur_legal_profiles for all to authenticated
  using (agency_id = public.current_user_agency_id() and public.is_admin())
  with check (agency_id = public.current_user_agency_id() and public.is_admin());

create policy bailleur_fiscal_profiles_select_tenant
  on public.bailleur_fiscal_profiles for select to authenticated
  using (agency_id = public.current_user_agency_id() or public.is_super_admin());
create policy bailleur_fiscal_profiles_admin_write
  on public.bailleur_fiscal_profiles for all to authenticated
  using (agency_id = public.current_user_agency_id() and public.is_admin())
  with check (agency_id = public.current_user_agency_id() and public.is_admin());

create policy contract_fiscal_settings_select_tenant
  on public.contract_fiscal_settings for select to authenticated
  using (agency_id = public.current_user_agency_id() or public.is_super_admin());
create policy contract_fiscal_settings_admin_write
  on public.contract_fiscal_settings for all to authenticated
  using (agency_id = public.current_user_agency_id() and public.is_admin())
  with check (agency_id = public.current_user_agency_id() and public.is_admin());

create policy tax_rate_versions_authenticated_read
  on public.tax_rate_versions for select to authenticated using (true);

revoke all on public.tax_rate_versions from anon, authenticated;
grant select on public.tax_rate_versions to authenticated;
grant select, insert, update on public.organization_legal_profiles to authenticated;
grant select, insert, update on public.organization_fiscal_profiles to authenticated;
grant select, insert, update on public.bailleur_legal_profiles to authenticated;
grant select, insert, update on public.bailleur_fiscal_profiles to authenticated;
grant select, insert, update on public.contract_fiscal_settings to authenticated;

create or replace function public.fn_upsert_organization_compliance_profile(
  p_legal jsonb,
  p_fiscal jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.current_user_agency_id();
  v_legal public.organization_legal_profiles%rowtype;
  v_fiscal public.organization_fiscal_profiles%rowtype;
  v_activities text[] := '{}'::text[];
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if v_agency_id is null or not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_legal -> 'business_activities', '[]'::jsonb)) = 'array' then
    select coalesce(
      array_agg(distinct nullif(trim(value), '')) filter (where nullif(trim(value), '') is not null),
      '{}'::text[]
    )
      into v_activities
      from jsonb_array_elements_text(coalesce(p_legal -> 'business_activities', '[]'::jsonb)) as activity(value);
  end if;

  insert into public.organization_legal_profiles (
    agency_id, legal_form, business_activities, trade_name, legal_name,
    ninea, rccm, registered_office, representative_name,
    representative_capacity, document_role, mandate_reference, notes
  )
  values (
    v_agency_id,
    coalesce(nullif(p_legal ->> 'legal_form', ''), 'unknown'),
    v_activities,
    nullif(trim(p_legal ->> 'trade_name'), ''),
    nullif(trim(p_legal ->> 'legal_name'), ''),
    upper(nullif(trim(p_legal ->> 'ninea'), '')),
    upper(nullif(trim(p_legal ->> 'rccm'), '')),
    nullif(trim(p_legal ->> 'registered_office'), ''),
    nullif(trim(p_legal ->> 'representative_name'), ''),
    nullif(trim(p_legal ->> 'representative_capacity'), ''),
    coalesce(nullif(p_legal ->> 'document_role', ''), 'unknown'),
    nullif(trim(p_legal ->> 'mandate_reference'), ''),
    nullif(trim(p_legal ->> 'notes'), '')
  )
  on conflict (agency_id) do update set
    legal_form = excluded.legal_form,
    business_activities = excluded.business_activities,
    trade_name = excluded.trade_name,
    legal_name = excluded.legal_name,
    ninea = excluded.ninea,
    rccm = excluded.rccm,
    registered_office = excluded.registered_office,
    representative_name = excluded.representative_name,
    representative_capacity = excluded.representative_capacity,
    document_role = excluded.document_role,
    mandate_reference = excluded.mandate_reference,
    notes = excluded.notes,
    professional_validation_status = case
      when public.organization_legal_profiles.professional_validation_status = 'not_applicable'
        then 'not_applicable'
      else 'to_validate'
    end,
    updated_at = now()
  returning * into v_legal;

  insert into public.organization_fiscal_profiles (
    agency_id, tax_status, vat_registration_status, vat_number,
    rent_tax_treatment, commission_tax_treatment, price_input_mode,
    effective_from, notes
  )
  values (
    v_agency_id,
    coalesce(nullif(p_fiscal ->> 'tax_status', ''), 'unknown'),
    coalesce(nullif(p_fiscal ->> 'vat_registration_status', ''), 'unknown'),
    upper(nullif(trim(p_fiscal ->> 'vat_number'), '')),
    coalesce(nullif(p_fiscal ->> 'rent_tax_treatment', ''), 'unknown'),
    coalesce(nullif(p_fiscal ->> 'commission_tax_treatment', ''), 'unknown'),
    coalesce(nullif(p_fiscal ->> 'price_input_mode', ''), 'ttc'),
    coalesce(nullif(p_fiscal ->> 'effective_from', '')::date, current_date),
    nullif(trim(p_fiscal ->> 'notes'), '')
  )
  on conflict (agency_id) do update set
    tax_status = excluded.tax_status,
    vat_registration_status = excluded.vat_registration_status,
    vat_number = excluded.vat_number,
    rent_tax_treatment = excluded.rent_tax_treatment,
    commission_tax_treatment = excluded.commission_tax_treatment,
    price_input_mode = excluded.price_input_mode,
    effective_from = excluded.effective_from,
    notes = excluded.notes,
    professional_validation_status = case
      when public.organization_fiscal_profiles.professional_validation_status = 'not_applicable'
        then 'not_applicable'
      else 'to_validate'
    end,
    updated_at = now()
  returning * into v_fiscal;

  return jsonb_build_object('legal', to_jsonb(v_legal), 'fiscal', to_jsonb(v_fiscal));
end;
$$;

revoke all on function public.fn_upsert_organization_compliance_profile(jsonb, jsonb) from public, anon;
grant execute on function public.fn_upsert_organization_compliance_profile(jsonb, jsonb) to authenticated;

-- Compliance writes remain atomic and the tenant always comes from the session.
revoke insert, update on public.organization_legal_profiles from authenticated;
revoke insert, update on public.organization_fiscal_profiles from authenticated;

-- Add unknown profiles without inferring legal or fiscal facts from account names.
insert into public.organization_legal_profiles (
  agency_id, legal_name, trade_name, ninea, registered_office,
  representative_name, representative_capacity, business_activities
)
select
  a.id,
  nullif(trim(a.name), ''),
  nullif(trim(a.name), ''),
  coalesce(nullif(trim(s.ninea), ''), nullif(trim(a.ninea), '')),
  coalesce(nullif(trim(s.adresse), ''), nullif(trim(a.address), '')),
  nullif(trim(s.representant_nom), ''),
  nullif(trim(s.representant_fonction), ''),
  case
    when a.organization_type in ('agency', 'property_manager') then array['real_estate_management']::text[]
    else array['property_ownership']::text[]
  end
from public.agencies a
left join public.agency_settings s on s.agency_id = a.id
on conflict (agency_id) do nothing;

insert into public.organization_fiscal_profiles (agency_id)
select id from public.agencies
on conflict (agency_id) do nothing;

insert into public.bailleur_legal_profiles (
  bailleur_id, agency_id, party_type, legal_form, legal_name, professional_validation_status
)
select
  b.id,
  b.agency_id,
  'unknown',
  'unknown',
  nullif(trim(concat_ws(' ', b.prenom, b.nom)), ''),
  'to_validate'
from public.bailleurs b
where b.agency_id is not null
on conflict (bailleur_id) do nothing;

insert into public.bailleur_fiscal_profiles (bailleur_id, agency_id)
select b.id, b.agency_id
from public.bailleurs b
where b.agency_id is not null
on conflict (bailleur_id) do nothing;

insert into public.contract_fiscal_settings (
  contract_id, agency_id, bailleur_id, lease_destination
)
select
  c.id,
  c.agency_id,
  i.bailleur_id,
  case lower(coalesce(c.destination, ''))
    when 'habitation' then 'residential'
    when 'commercial' then 'commercial'
    when 'mixte' then 'mixed'
    else 'unknown'
  end
from public.contrats c
join public.unites u on u.id = c.unite_id
join public.immeubles i on i.id = u.immeuble_id
where c.agency_id is not null
on conflict (contract_id) do nothing;
