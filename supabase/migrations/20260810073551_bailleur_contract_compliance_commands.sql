-- Atomic tenant-scoped commands for landlord and lease compliance settings.
-- Browser clients retain read access through RLS but cannot write these
-- coordinated profiles table by table.

create or replace function public.fn_upsert_bailleur_compliance_profile(
  p_bailleur_id uuid,
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
  v_legal public.bailleur_legal_profiles%rowtype;
  v_fiscal public.bailleur_fiscal_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if v_agency_id is null or not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.bailleurs
    where id = p_bailleur_id and agency_id = v_agency_id
  ) then
    raise exception 'BAILLEUR_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.bailleur_legal_profiles (
    bailleur_id, agency_id, party_type, legal_form, legal_name, trade_name,
    ninea, rccm, representative_name, representative_capacity,
    document_role, notes
  ) values (
    p_bailleur_id,
    v_agency_id,
    coalesce(nullif(p_legal ->> 'party_type', ''), 'unknown'),
    coalesce(nullif(p_legal ->> 'legal_form', ''), 'unknown'),
    nullif(trim(p_legal ->> 'legal_name'), ''),
    nullif(trim(p_legal ->> 'trade_name'), ''),
    upper(nullif(trim(p_legal ->> 'ninea'), '')),
    upper(nullif(trim(p_legal ->> 'rccm'), '')),
    nullif(trim(p_legal ->> 'representative_name'), ''),
    nullif(trim(p_legal ->> 'representative_capacity'), ''),
    coalesce(nullif(p_legal ->> 'document_role', ''), 'principal'),
    nullif(trim(p_legal ->> 'notes'), '')
  )
  on conflict (bailleur_id) do update set
    party_type = excluded.party_type,
    legal_form = excluded.legal_form,
    legal_name = excluded.legal_name,
    trade_name = excluded.trade_name,
    ninea = excluded.ninea,
    rccm = excluded.rccm,
    representative_name = excluded.representative_name,
    representative_capacity = excluded.representative_capacity,
    document_role = excluded.document_role,
    notes = excluded.notes,
    professional_validation_status = case
      when public.bailleur_legal_profiles.professional_validation_status = 'not_applicable'
        then 'not_applicable'
      else 'to_validate'
    end,
    updated_at = now()
  returning * into v_legal;

  insert into public.bailleur_fiscal_profiles (
    bailleur_id, agency_id, tax_status, vat_registration_status, vat_number,
    default_rent_tax_treatment, effective_from, notes
  ) values (
    p_bailleur_id,
    v_agency_id,
    coalesce(nullif(p_fiscal ->> 'tax_status', ''), 'unknown'),
    coalesce(nullif(p_fiscal ->> 'vat_registration_status', ''), 'unknown'),
    upper(nullif(trim(p_fiscal ->> 'vat_number'), '')),
    coalesce(nullif(p_fiscal ->> 'default_rent_tax_treatment', ''), 'unknown'),
    coalesce(nullif(p_fiscal ->> 'effective_from', '')::date, current_date),
    nullif(trim(p_fiscal ->> 'notes'), '')
  )
  on conflict (bailleur_id) do update set
    tax_status = excluded.tax_status,
    vat_registration_status = excluded.vat_registration_status,
    vat_number = excluded.vat_number,
    default_rent_tax_treatment = excluded.default_rent_tax_treatment,
    effective_from = excluded.effective_from,
    notes = excluded.notes,
    professional_validation_status = case
      when public.bailleur_fiscal_profiles.professional_validation_status = 'not_applicable'
        then 'not_applicable'
      else 'to_validate'
    end,
    updated_at = now()
  returning * into v_fiscal;

  return jsonb_build_object('legal', to_jsonb(v_legal), 'fiscal', to_jsonb(v_fiscal));
end;
$$;

create or replace function public.fn_upsert_contract_billing_fiscal_settings(
  p_contract_id uuid,
  p_billing jsonb,
  p_fiscal jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.current_user_agency_id();
  v_bailleur_id uuid;
  v_billing public.contract_billing_settings%rowtype;
  v_fiscal public.contract_fiscal_settings%rowtype;
  v_default_due_day smallint;
  v_rent_tax_rate_id uuid := nullif(p_fiscal ->> 'rent_tax_rate_id', '')::uuid;
  v_commission_tax_rate_id uuid := nullif(p_fiscal ->> 'commission_tax_rate_id', '')::uuid;
  v_delivery_channels jsonb := case
    when jsonb_typeof(coalesce(p_billing -> 'delivery_channels', '[]'::jsonb)) = 'array'
      then coalesce(p_billing -> 'delivery_channels', '[]'::jsonb)
    else '[]'::jsonb
  end;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if v_agency_id is null or not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select i.bailleur_id
    into v_bailleur_id
  from public.contrats c
  join public.unites u on u.id = c.unite_id
  join public.immeubles i on i.id = u.immeuble_id
  where c.id = p_contract_id and c.agency_id = v_agency_id;

  if not found then
    raise exception 'CONTRACT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(s.rent_due_day, 5)
    into v_default_due_day
  from public.agency_settings s
  where s.agency_id = v_agency_id;

  v_default_due_day := coalesce(v_default_due_day, 5);

  if coalesce(nullif(p_fiscal ->> 'rent_tax_treatment', ''), 'unknown') = 'taxable'
     and v_rent_tax_rate_id is null then
    raise exception 'RENT_TAX_RATE_REQUIRED' using errcode = '22023';
  end if;

  if coalesce(nullif(p_fiscal ->> 'commission_tax_treatment', ''), 'unknown') = 'taxable'
     and v_commission_tax_rate_id is null then
    raise exception 'COMMISSION_TAX_RATE_REQUIRED' using errcode = '22023';
  end if;

  if v_rent_tax_rate_id is not null and not exists (
    select 1 from public.tax_rate_versions where id = v_rent_tax_rate_id
  ) then
    raise exception 'INVALID_RENT_TAX_RATE' using errcode = '22023';
  end if;

  if v_commission_tax_rate_id is not null and not exists (
    select 1 from public.tax_rate_versions where id = v_commission_tax_rate_id
  ) then
    raise exception 'INVALID_COMMISSION_TAX_RATE' using errcode = '22023';
  end if;

  insert into public.contract_billing_settings (
    contract_id, agency_id, due_day, generation_lead_days, document_policy,
    allocation_strategy, auto_issue, delivery_channels
  ) values (
    p_contract_id,
    v_agency_id,
    coalesce(nullif(p_billing ->> 'due_day', '')::smallint, v_default_due_day),
    coalesce(nullif(p_billing ->> 'generation_lead_days', '')::smallint, 0),
    coalesce(nullif(p_billing ->> 'document_policy', ''), 'notice'),
    coalesce(nullif(p_billing ->> 'allocation_strategy', ''), 'oldest_first'),
    coalesce((p_billing ->> 'auto_issue')::boolean, false),
    v_delivery_channels
  )
  on conflict (contract_id) do update set
    due_day = excluded.due_day,
    generation_lead_days = excluded.generation_lead_days,
    document_policy = excluded.document_policy,
    allocation_strategy = excluded.allocation_strategy,
    auto_issue = excluded.auto_issue,
    delivery_channels = excluded.delivery_channels,
    updated_at = now()
  returning * into v_billing;

  insert into public.contract_fiscal_settings (
    contract_id, agency_id, bailleur_id, lease_destination, invoice_required,
    rent_tax_treatment, rent_tax_rate_id, rent_price_input_mode,
    commission_tax_treatment, commission_tax_rate_id,
    commission_price_input_mode, document_issuer,
    lease_registration_status, lease_registration_reference,
    lease_registration_date, effective_from
  ) values (
    p_contract_id,
    v_agency_id,
    v_bailleur_id,
    coalesce(nullif(p_fiscal ->> 'lease_destination', ''), 'unknown'),
    nullif(p_fiscal ->> 'invoice_required', '')::boolean,
    coalesce(nullif(p_fiscal ->> 'rent_tax_treatment', ''), 'unknown'),
    v_rent_tax_rate_id,
    coalesce(nullif(p_fiscal ->> 'rent_price_input_mode', ''), 'ttc'),
    coalesce(nullif(p_fiscal ->> 'commission_tax_treatment', ''), 'unknown'),
    v_commission_tax_rate_id,
    coalesce(nullif(p_fiscal ->> 'commission_price_input_mode', ''), 'ttc'),
    coalesce(nullif(p_fiscal ->> 'document_issuer', ''), 'unknown'),
    coalesce(nullif(p_fiscal ->> 'lease_registration_status', ''), 'unknown'),
    nullif(trim(p_fiscal ->> 'lease_registration_reference'), ''),
    nullif(p_fiscal ->> 'lease_registration_date', '')::date,
    coalesce(nullif(p_fiscal ->> 'effective_from', '')::date, current_date)
  )
  on conflict (contract_id) do update set
    bailleur_id = excluded.bailleur_id,
    lease_destination = excluded.lease_destination,
    invoice_required = excluded.invoice_required,
    rent_tax_treatment = excluded.rent_tax_treatment,
    rent_tax_rate_id = excluded.rent_tax_rate_id,
    rent_price_input_mode = excluded.rent_price_input_mode,
    commission_tax_treatment = excluded.commission_tax_treatment,
    commission_tax_rate_id = excluded.commission_tax_rate_id,
    commission_price_input_mode = excluded.commission_price_input_mode,
    document_issuer = excluded.document_issuer,
    lease_registration_status = excluded.lease_registration_status,
    lease_registration_reference = excluded.lease_registration_reference,
    lease_registration_date = excluded.lease_registration_date,
    effective_from = excluded.effective_from,
    professional_validation_status = case
      when public.contract_fiscal_settings.professional_validation_status = 'not_applicable'
        then 'not_applicable'
      else 'to_validate'
    end,
    updated_at = now()
  returning * into v_fiscal;

  return jsonb_build_object('billing', to_jsonb(v_billing), 'fiscal', to_jsonb(v_fiscal));
end;
$$;

revoke all on function public.fn_upsert_bailleur_compliance_profile(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.fn_upsert_bailleur_compliance_profile(uuid, jsonb, jsonb) to authenticated;

revoke all on function public.fn_upsert_contract_billing_fiscal_settings(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.fn_upsert_contract_billing_fiscal_settings(uuid, jsonb, jsonb) to authenticated;

-- The commands above are the only authenticated write path for coordinated
-- landlord and lease profiles. Existing tenant read policies remain intact.
drop policy if exists bailleur_legal_profiles_admin_write on public.bailleur_legal_profiles;
drop policy if exists bailleur_fiscal_profiles_admin_write on public.bailleur_fiscal_profiles;
drop policy if exists contract_fiscal_settings_admin_write on public.contract_fiscal_settings;

revoke insert, update, delete on public.bailleur_legal_profiles from authenticated;
revoke insert, update, delete on public.bailleur_fiscal_profiles from authenticated;
revoke insert, update, delete on public.contract_fiscal_settings from authenticated;
revoke insert, update, delete on public.contract_billing_settings from authenticated;
