-- Harden demo data reset so sample data can be removed after the dashboard is populated.
-- The function only targets rows marked is_demo_data = true, plus dependent records
-- attached to those demo rows, and never touches agency_settings.onboarding_completed_at.

create or replace function public.reset_demo_data(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_deleted_document_verifications integer := 0;
  v_deleted_document_registry integer := 0;
  v_deleted_documents integer := 0;
  v_deleted_inventaires integer := 0;
  v_deleted_revenus integer := 0;
  v_deleted_event_log integer := 0;
  v_deleted_event_outbox integer := 0;
  v_deleted_paiements integer := 0;
  v_deleted_contrats integer := 0;
  v_deleted_locataires integer := 0;
  v_deleted_unites integer := 0;
  v_deleted_immeubles integer := 0;
  v_deleted_bailleurs integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select up.role::text
  into v_actor_role
  from public.user_profiles up
  where up.id = auth.uid()
    and coalesce(up.actif, true) = true
    and (up.agency_id = p_agency_id or up.role::text = 'super_admin')
  limit 1;

  if v_actor_role is null then
    raise exception 'Access denied for this agency';
  end if;

  if v_actor_role not in ('admin', 'super_admin') then
    raise exception 'Only an administrator can reset demo data';
  end if;

  create temporary table if not exists pg_temp.demo_bailleurs(id uuid primary key) on commit drop;
  create temporary table if not exists pg_temp.demo_immeubles(id uuid primary key) on commit drop;
  create temporary table if not exists pg_temp.demo_unites(id uuid primary key) on commit drop;
  create temporary table if not exists pg_temp.demo_locataires(id uuid primary key) on commit drop;
  create temporary table if not exists pg_temp.demo_contrats(id uuid primary key) on commit drop;
  create temporary table if not exists pg_temp.demo_paiements(id uuid primary key) on commit drop;

  truncate pg_temp.demo_bailleurs;
  truncate pg_temp.demo_immeubles;
  truncate pg_temp.demo_unites;
  truncate pg_temp.demo_locataires;
  truncate pg_temp.demo_contrats;
  truncate pg_temp.demo_paiements;

  insert into pg_temp.demo_bailleurs(id)
  select id from public.bailleurs
  where agency_id = p_agency_id and is_demo_data = true;

  insert into pg_temp.demo_immeubles(id)
  select id from public.immeubles
  where agency_id = p_agency_id and is_demo_data = true;

  insert into pg_temp.demo_unites(id)
  select id from public.unites
  where agency_id = p_agency_id and is_demo_data = true;

  insert into pg_temp.demo_locataires(id)
  select id from public.locataires
  where agency_id = p_agency_id and is_demo_data = true;

  insert into pg_temp.demo_contrats(id)
  select id from public.contrats
  where agency_id = p_agency_id and is_demo_data = true;

  insert into pg_temp.demo_paiements(id)
  select id from public.paiements
  where agency_id = p_agency_id and is_demo_data = true;

  delete from public.document_verifications
  where agency_id = p_agency_id
    and (
      metadata->>'paiement_id' in (select id::text from pg_temp.demo_paiements)
      or metadata->>'contrat_id' in (select id::text from pg_temp.demo_contrats)
      or metadata->>'bailleur_id' in (select id::text from pg_temp.demo_bailleurs)
      or metadata->>'immeuble_id' in (select id::text from pg_temp.demo_immeubles)
      or metadata->>'unite_id' in (select id::text from pg_temp.demo_unites)
      or metadata->>'locataire_id' in (select id::text from pg_temp.demo_locataires)
    );
  get diagnostics v_deleted_document_verifications = row_count;

  delete from public.document_registry
  where agency_id = p_agency_id
    and (
      entity_id in (select id::text from pg_temp.demo_paiements)
      or entity_id in (select id::text from pg_temp.demo_contrats)
      or entity_id in (select id::text from pg_temp.demo_bailleurs)
      or entity_id in (select id::text from pg_temp.demo_immeubles)
      or entity_id in (select id::text from pg_temp.demo_unites)
      or entity_id in (select id::text from pg_temp.demo_locataires)
    );
  get diagnostics v_deleted_document_registry = row_count;

  update public.documents
  set
    lifecycle_status = 'deleted',
    deleted_at = coalesce(deleted_at, now()),
    contrat_id = null,
    unite_id = null,
    immeuble_id = null,
    bailleur_id = null,
    entity_id = null,
    updated_at = now()
  where agency_id = p_agency_id
    and (
      contrat_id in (select id from pg_temp.demo_contrats)
      or unite_id in (select id from pg_temp.demo_unites)
      or immeuble_id in (select id from pg_temp.demo_immeubles)
      or bailleur_id in (select id from pg_temp.demo_bailleurs)
      or entity_id in (select id from pg_temp.demo_paiements)
      or entity_id in (select id from pg_temp.demo_contrats)
      or entity_id in (select id from pg_temp.demo_bailleurs)
      or entity_id in (select id from pg_temp.demo_immeubles)
      or entity_id in (select id from pg_temp.demo_unites)
      or entity_id in (select id from pg_temp.demo_locataires)
    );
  get diagnostics v_deleted_documents = row_count;

  delete from public.inventaires
  where agency_id = p_agency_id
    and contrat_id in (select id from pg_temp.demo_contrats);
  get diagnostics v_deleted_inventaires = row_count;

  delete from public.revenus
  where agency_id = p_agency_id
    and paiement_id in (select id from pg_temp.demo_paiements);
  get diagnostics v_deleted_revenus = row_count;

  delete from public.event_log
  where agency_id = p_agency_id
    and (
      entity_id in (select id from pg_temp.demo_paiements)
      or entity_id in (select id from pg_temp.demo_contrats)
      or entity_id in (select id from pg_temp.demo_locataires)
      or entity_id in (select id from pg_temp.demo_unites)
      or entity_id in (select id from pg_temp.demo_immeubles)
      or entity_id in (select id from pg_temp.demo_bailleurs)
    );
  get diagnostics v_deleted_event_log = row_count;

  delete from public.event_outbox
  where agency_id = p_agency_id
    and (
      entity_id in (select id from pg_temp.demo_paiements)
      or entity_id in (select id from pg_temp.demo_contrats)
      or entity_id in (select id from pg_temp.demo_locataires)
      or entity_id in (select id from pg_temp.demo_unites)
      or entity_id in (select id from pg_temp.demo_immeubles)
      or entity_id in (select id from pg_temp.demo_bailleurs)
    );
  get diagnostics v_deleted_event_outbox = row_count;

  delete from public.paiements
  where agency_id = p_agency_id
    and id in (select id from pg_temp.demo_paiements);
  get diagnostics v_deleted_paiements = row_count;

  delete from public.contrats
  where agency_id = p_agency_id
    and id in (select id from pg_temp.demo_contrats);
  get diagnostics v_deleted_contrats = row_count;

  delete from public.locataires
  where agency_id = p_agency_id
    and id in (select id from pg_temp.demo_locataires);
  get diagnostics v_deleted_locataires = row_count;

  delete from public.unites
  where agency_id = p_agency_id
    and id in (select id from pg_temp.demo_unites);
  get diagnostics v_deleted_unites = row_count;

  delete from public.immeubles
  where agency_id = p_agency_id
    and id in (select id from pg_temp.demo_immeubles);
  get diagnostics v_deleted_immeubles = row_count;

  delete from public.bailleurs
  where agency_id = p_agency_id
    and id in (select id from pg_temp.demo_bailleurs);
  get diagnostics v_deleted_bailleurs = row_count;

  update public.agencies
  set demo_data_loaded = false
  where id = p_agency_id;

  return jsonb_build_object(
    'document_verifications', v_deleted_document_verifications,
    'document_registry', v_deleted_document_registry,
    'documents_soft_deleted', v_deleted_documents,
    'inventaires', v_deleted_inventaires,
    'revenus', v_deleted_revenus,
    'event_log', v_deleted_event_log,
    'event_outbox', v_deleted_event_outbox,
    'paiements', v_deleted_paiements,
    'contrats', v_deleted_contrats,
    'locataires', v_deleted_locataires,
    'unites', v_deleted_unites,
    'immeubles', v_deleted_immeubles,
    'bailleurs', v_deleted_bailleurs
  );
end;
$$;

revoke all on function public.reset_demo_data(uuid) from public, anon;
grant execute on function public.reset_demo_data(uuid) to authenticated;
