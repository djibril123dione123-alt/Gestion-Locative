-- Phase 2 socle : type de compte, mode documentaire et modules activables.
-- Migration volontairement additive pour preserver tous les comptes existants.

alter table public.agencies
  add column if not exists organization_type text not null default 'agency';

alter table public.agencies
  drop constraint if exists agencies_organization_type_check;

alter table public.agencies
  add constraint agencies_organization_type_check
  check (organization_type in (
    'agency',
    'individual_landlord',
    'multi_property_landlord',
    'property_manager',
    'group'
  ));

update public.agencies
set organization_type = 'individual_landlord'
where coalesce(is_bailleur_account, false) = true
  and organization_type = 'agency';

update public.agencies
set organization_type = 'agency'
where organization_type is null;

alter table public.agency_settings
  add column if not exists document_mode text not null default 'professional',
  add column if not exists enabled_modules jsonb not null default '{}'::jsonb,
  add column if not exists proprietaire_info jsonb not null default '{}'::jsonb;

alter table public.agency_settings
  drop constraint if exists agency_settings_document_mode_check;

alter table public.agency_settings
  add constraint agency_settings_document_mode_check
  check (document_mode in ('simple', 'professional', 'legal'));

update public.agency_settings s
set document_mode = 'simple'
from public.agencies a
where a.id = s.agency_id
  and coalesce(a.is_bailleur_account, false) = true
  and s.document_mode = 'professional';

create or replace function public.normalize_agency_account_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.organization_type is null then
    new.organization_type := case
      when coalesce(new.is_bailleur_account, false) then 'individual_landlord'
      else 'agency'
    end;
  end if;

  if new.organization_type = 'individual_landlord' then
    new.is_bailleur_account := true;
  elsif new.is_bailleur_account = true and new.organization_type = 'agency' then
    new.organization_type := 'individual_landlord';
  elsif TG_OP = 'INSERT' or old.organization_type is distinct from new.organization_type then
    new.is_bailleur_account := false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_agency_account_profile on public.agencies;
create trigger trg_normalize_agency_account_profile
before insert or update of organization_type, is_bailleur_account
on public.agencies
for each row
execute function public.normalize_agency_account_profile();

create or replace function public.default_enabled_modules_for_organization(p_organization_type text)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select case p_organization_type
    when 'individual_landlord' then jsonb_build_object(
      'mandates', false,
      'commissions', false,
      'team', false,
      'audit_trail', false,
      'advanced_reports', false,
      'document_qr', true,
      'expenses', true
    )
    when 'multi_property_landlord' then jsonb_build_object(
      'mandates', false,
      'commissions', false,
      'team', false,
      'audit_trail', false,
      'advanced_reports', true,
      'document_qr', true,
      'expenses', true
    )
    when 'property_manager' then jsonb_build_object(
      'mandates', true,
      'commissions', true,
      'team', true,
      'audit_trail', false,
      'advanced_reports', true,
      'document_qr', true,
      'expenses', true
    )
    else jsonb_build_object(
      'mandates', true,
      'commissions', true,
      'team', true,
      'audit_trail', true,
      'advanced_reports', true,
      'document_qr', true,
      'expenses', true
    )
  end;
$$;

update public.agency_settings s
set enabled_modules = public.default_enabled_modules_for_organization(a.organization_type)
from public.agencies a
where a.id = s.agency_id
  and (s.enabled_modules = '{}'::jsonb or s.enabled_modules is null);

create or replace function public.normalize_agency_settings_account_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org_type text;
begin
  select organization_type
  into org_type
  from public.agencies
  where id = new.agency_id;

  org_type := coalesce(org_type, 'agency');

  if TG_OP = 'INSERT' and org_type in ('individual_landlord', 'multi_property_landlord') and new.document_mode = 'professional' then
    new.document_mode := 'simple';
  end if;

  if new.enabled_modules is null or new.enabled_modules = '{}'::jsonb then
    new.enabled_modules := public.default_enabled_modules_for_organization(org_type);
  end if;

  if new.proprietaire_info is null then
    new.proprietaire_info := '{}'::jsonb;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_agency_settings_account_profile on public.agency_settings;
create trigger trg_normalize_agency_settings_account_profile
before insert or update of document_mode, enabled_modules, proprietaire_info
on public.agency_settings
for each row
execute function public.normalize_agency_settings_account_profile();
