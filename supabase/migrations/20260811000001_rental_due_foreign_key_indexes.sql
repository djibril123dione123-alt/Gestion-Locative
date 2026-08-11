-- Cover foreign keys introduced by the legal/fiscal and canonical rental due engines.
-- These indexes preserve lookup and referential-action performance as tenant volume grows.

create index if not exists idx_contract_fiscal_settings_bailleur
  on public.contract_fiscal_settings (bailleur_id);
create index if not exists idx_contract_fiscal_settings_rent_tax_rate
  on public.contract_fiscal_settings (rent_tax_rate_id);
create index if not exists idx_contract_fiscal_settings_commission_tax_rate
  on public.contract_fiscal_settings (commission_tax_rate_id);
create index if not exists idx_organization_legal_profiles_validated_by
  on public.organization_legal_profiles (validated_by);

create index if not exists idx_rental_dues_contract_fk
  on public.rental_dues (contract_id);
create index if not exists idx_rental_dues_tenant_fk
  on public.rental_dues (tenant_id);
create index if not exists idx_rental_dues_unit_fk
  on public.rental_dues (unit_id);
create index if not exists idx_rental_dues_landlord_fk
  on public.rental_dues (landlord_id);
create index if not exists idx_rental_dues_created_by_fk
  on public.rental_dues (created_by);

create index if not exists idx_rental_due_lines_agency_fk
  on public.rental_due_lines (agency_id);
create index if not exists idx_rental_due_lines_tax_rate_fk
  on public.rental_due_lines (tax_rate_id);

create index if not exists idx_payment_allocations_due_fk
  on public.payment_allocations (due_id);
create index if not exists idx_payment_allocations_payment_fk
  on public.payment_allocations (payment_id);
create index if not exists idx_payment_allocations_reversal_fk
  on public.payment_allocations (reverses_allocation_id);
create index if not exists idx_payment_allocations_allocated_by_fk
  on public.payment_allocations (allocated_by);

create index if not exists idx_rental_account_credits_contract_fk
  on public.rental_account_credits (contract_id);
create index if not exists idx_rental_account_credits_tenant_fk
  on public.rental_account_credits (tenant_id);

create index if not exists idx_rental_due_documents_registry_fk
  on public.rental_due_documents (document_registry_id);
create index if not exists idx_rental_due_documents_created_by_fk
  on public.rental_due_documents (created_by);

create index if not exists idx_rental_due_deliveries_agency_fk
  on public.rental_due_deliveries (agency_id);
create index if not exists idx_rental_due_deliveries_due_fk
  on public.rental_due_deliveries (due_id);
create index if not exists idx_rental_due_deliveries_document_fk
  on public.rental_due_deliveries (document_id);

create index if not exists idx_rental_due_reminders_agency_fk
  on public.rental_due_reminders (agency_id);
create index if not exists idx_rental_due_reminders_due_fk
  on public.rental_due_reminders (due_id);

create index if not exists idx_rental_due_events_due_fk
  on public.rental_due_events (due_id);
create index if not exists idx_rental_due_events_payment_fk
  on public.rental_due_events (payment_id);
create index if not exists idx_rental_due_events_actor_fk
  on public.rental_due_events (actor_id);

create index if not exists idx_rental_due_automation_runs_agency_fk
  on public.rental_due_automation_runs (agency_id);
