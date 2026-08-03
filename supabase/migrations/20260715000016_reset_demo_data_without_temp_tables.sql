-- Keep demo reset tenant-scoped and statically analyzable.
-- Arrays replace pg_temp tables so PostgreSQL linting and pooled executions do
-- not depend on session-local relations.

create or replace function public.reset_demo_data(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor_role text;
  v_is_individual_account boolean := false;
  v_organization_type text := 'agency';
  v_can_reset boolean := false;
  v_sql text;
  v_has_agency_id boolean := false;
  v_has_entity_id boolean := false;
  v_demo_bailleurs uuid[] := '{}'::uuid[];
  v_demo_immeubles uuid[] := '{}'::uuid[];
  v_demo_unites uuid[] := '{}'::uuid[];
  v_demo_locataires uuid[] := '{}'::uuid[];
  v_demo_contrats uuid[] := '{}'::uuid[];
  v_demo_paiements uuid[] := '{}'::uuid[];
  v_demo_entities uuid[] := '{}'::uuid[];
  v_demo_entities_text text[] := '{}'::text[];
  v_deleted_document_verifications integer := 0;
  v_deleted_document_registry integer := 0;
  v_touched_documents integer := 0;
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
  if p_agency_id is null then
    raise exception 'Agency id is required';
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select
    up.role::text,
    coalesce((to_jsonb(a)->>'is_bailleur_account')::boolean, false),
    coalesce(to_jsonb(a)->>'organization_type', 'agency')
  into v_actor_role, v_is_individual_account, v_organization_type
  from public.user_profiles up
  join public.agencies a on a.id = p_agency_id
  where up.id = auth.uid()
    and coalesce(up.actif, true) = true
    and (
      up.agency_id = p_agency_id
      or up.role::text = 'super_admin'
    )
  limit 1;

  if v_actor_role is null then
    raise exception 'Access denied for this agency';
  end if;

  v_can_reset :=
    v_actor_role in ('admin', 'super_admin')
    or (
      v_actor_role = 'bailleur'
      and (
        v_is_individual_account
        or v_organization_type in ('individual_landlord', 'multi_property_landlord')
      )
    );

  if not v_can_reset then
    raise exception 'Only an administrator or the individual owner can reset demo data';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_demo_bailleurs
  from public.bailleurs
  where agency_id = p_agency_id and is_demo_data = true;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_demo_immeubles
  from public.immeubles
  where agency_id = p_agency_id and is_demo_data = true;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_demo_unites
  from public.unites
  where agency_id = p_agency_id and is_demo_data = true;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_demo_locataires
  from public.locataires
  where agency_id = p_agency_id and is_demo_data = true;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_demo_contrats
  from public.contrats
  where agency_id = p_agency_id and is_demo_data = true;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_demo_paiements
  from public.paiements
  where agency_id = p_agency_id and is_demo_data = true;

  v_demo_entities :=
    v_demo_bailleurs
    || v_demo_immeubles
    || v_demo_unites
    || v_demo_locataires
    || v_demo_contrats
    || v_demo_paiements;

  select coalesce(array_agg(entity_id::text), '{}'::text[])
  into v_demo_entities_text
  from unnest(v_demo_entities) as entity_id;

  delete from public.document_verifications
  where agency_id = p_agency_id
    and (
      metadata->>'paiement_id' = any(v_demo_entities_text)
      or metadata->>'contrat_id' = any(v_demo_entities_text)
      or metadata->>'bailleur_id' = any(v_demo_entities_text)
      or metadata->>'immeuble_id' = any(v_demo_entities_text)
      or metadata->>'unite_id' = any(v_demo_entities_text)
      or metadata->>'locataire_id' = any(v_demo_entities_text)
    );
  get diagnostics v_deleted_document_verifications = row_count;

  delete from public.document_registry
  where agency_id = p_agency_id
    and entity_id = any(v_demo_entities_text);
  get diagnostics v_deleted_document_registry = row_count;

  -- Preserve the stored file while removing links to records being deleted.
  update public.documents
  set
    lifecycle_status = 'deleted',
    deleted_at = coalesce(deleted_at, now()),
    updated_at = now(),
    contrat_id = null,
    unite_id = null,
    immeuble_id = null,
    bailleur_id = null,
    entity_id = null
  where agency_id = p_agency_id
    and (
      contrat_id = any(v_demo_contrats)
      or unite_id = any(v_demo_unites)
      or immeuble_id = any(v_demo_immeubles)
      or bailleur_id = any(v_demo_bailleurs)
      or entity_id = any(v_demo_entities)
    );
  get diagnostics v_touched_documents = row_count;

  delete from public.inventaires
  where agency_id = p_agency_id
    and contrat_id = any(v_demo_contrats);
  get diagnostics v_deleted_inventaires = row_count;

  delete from public.revenus
  where paiement_id = any(v_demo_paiements);
  get diagnostics v_deleted_revenus = row_count;

  -- These event tables are optional across historical deployments. Dynamic SQL
  -- keeps the RPC deployable while preserving agency and entity scoping.
  if to_regclass('public.event_log') is not null then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'event_log'
        and column_name = 'agency_id'
    ) into v_has_agency_id;
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'event_log'
        and column_name = 'entity_id'
    ) into v_has_entity_id;

    if v_has_agency_id and v_has_entity_id then
      v_sql := 'delete from public.event_log where agency_id = $1 and entity_id::text = any($2)';
      execute v_sql using p_agency_id, v_demo_entities_text;
      get diagnostics v_deleted_event_log = row_count;
    end if;
  end if;

  if to_regclass('public.event_outbox') is not null then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'event_outbox'
        and column_name = 'agency_id'
    ) into v_has_agency_id;
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'event_outbox'
        and column_name = 'entity_id'
    ) into v_has_entity_id;

    if v_has_agency_id and v_has_entity_id then
      v_sql := 'delete from public.event_outbox where agency_id = $1 and entity_id::text = any($2)';
      execute v_sql using p_agency_id, v_demo_entities_text;
      get diagnostics v_deleted_event_outbox = row_count;
    end if;
  end if;

  delete from public.paiements
  where agency_id = p_agency_id
    and id = any(v_demo_paiements);
  get diagnostics v_deleted_paiements = row_count;

  delete from public.contrats
  where agency_id = p_agency_id
    and id = any(v_demo_contrats);
  get diagnostics v_deleted_contrats = row_count;

  delete from public.locataires
  where agency_id = p_agency_id
    and id = any(v_demo_locataires);
  get diagnostics v_deleted_locataires = row_count;

  delete from public.unites
  where agency_id = p_agency_id
    and id = any(v_demo_unites);
  get diagnostics v_deleted_unites = row_count;

  delete from public.immeubles
  where agency_id = p_agency_id
    and id = any(v_demo_immeubles);
  get diagnostics v_deleted_immeubles = row_count;

  delete from public.bailleurs
  where agency_id = p_agency_id
    and id = any(v_demo_bailleurs);
  get diagnostics v_deleted_bailleurs = row_count;

  update public.agencies
  set demo_data_loaded = false
  where id = p_agency_id;

  return jsonb_build_object(
    'success', true,
    'deleted_demo_data', true,
    'document_verifications', v_deleted_document_verifications,
    'document_registry', v_deleted_document_registry,
    'documents_detached', v_touched_documents,
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
