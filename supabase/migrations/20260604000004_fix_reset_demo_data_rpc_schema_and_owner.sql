-- Final hardening for demo-data reset.
-- The previous RPC assumed every dependent table had agency_id and only allowed
-- admin/super_admin. This version checks optional dependency columns at runtime
-- and also allows the owner role used by individual landlord accounts.

create or replace function public.reset_demo_data(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_is_individual_account boolean := false;
  v_organization_type text := 'agency';
  v_can_reset boolean := false;
  v_sql text;
  v_set_sql text;
  v_where_sql text;
  v_has_agency_id boolean := false;
  v_has_metadata boolean := false;
  v_has_entity_id boolean := false;
  v_has_paiement_id boolean := false;
  v_has_contrat_id boolean := false;
  v_has_bailleur_id boolean := false;
  v_has_immeuble_id boolean := false;
  v_has_unite_id boolean := false;
  v_has_lifecycle_status boolean := false;
  v_has_deleted_at boolean := false;
  v_has_updated_at boolean := false;
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

  execute 'create temporary table if not exists pg_temp.demo_bailleurs(id uuid primary key) on commit drop';
  execute 'create temporary table if not exists pg_temp.demo_immeubles(id uuid primary key) on commit drop';
  execute 'create temporary table if not exists pg_temp.demo_unites(id uuid primary key) on commit drop';
  execute 'create temporary table if not exists pg_temp.demo_locataires(id uuid primary key) on commit drop';
  execute 'create temporary table if not exists pg_temp.demo_contrats(id uuid primary key) on commit drop';
  execute 'create temporary table if not exists pg_temp.demo_paiements(id uuid primary key) on commit drop';

  execute 'truncate pg_temp.demo_bailleurs';
  execute 'truncate pg_temp.demo_immeubles';
  execute 'truncate pg_temp.demo_unites';
  execute 'truncate pg_temp.demo_locataires';
  execute 'truncate pg_temp.demo_contrats';
  execute 'truncate pg_temp.demo_paiements';

  execute 'insert into pg_temp.demo_bailleurs(id)
    select id from public.bailleurs where agency_id = $1 and is_demo_data = true'
    using p_agency_id;
  execute 'insert into pg_temp.demo_immeubles(id)
    select id from public.immeubles where agency_id = $1 and is_demo_data = true'
    using p_agency_id;
  execute 'insert into pg_temp.demo_unites(id)
    select id from public.unites where agency_id = $1 and is_demo_data = true'
    using p_agency_id;
  execute 'insert into pg_temp.demo_locataires(id)
    select id from public.locataires where agency_id = $1 and is_demo_data = true'
    using p_agency_id;
  execute 'insert into pg_temp.demo_contrats(id)
    select id from public.contrats where agency_id = $1 and is_demo_data = true'
    using p_agency_id;
  execute 'insert into pg_temp.demo_paiements(id)
    select id from public.paiements where agency_id = $1 and is_demo_data = true'
    using p_agency_id;

  -- Verification registry: optional schema across deployments, so every column
  -- is checked before it appears in dynamic SQL.
  if to_regclass('public.document_verifications') is not null then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'document_verifications' and column_name = 'agency_id'
    ) into v_has_agency_id;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'document_verifications' and column_name = 'metadata'
    ) into v_has_metadata;

    if v_has_metadata then
      v_sql := 'delete from public.document_verifications where ';
      if v_has_agency_id then
        v_sql := v_sql || 'agency_id = $1 and ';
      end if;
      v_sql := v_sql || '(
        metadata->>''paiement_id'' in (select id::text from pg_temp.demo_paiements)
        or metadata->>''contrat_id'' in (select id::text from pg_temp.demo_contrats)
        or metadata->>''bailleur_id'' in (select id::text from pg_temp.demo_bailleurs)
        or metadata->>''immeuble_id'' in (select id::text from pg_temp.demo_immeubles)
        or metadata->>''unite_id'' in (select id::text from pg_temp.demo_unites)
        or metadata->>''locataire_id'' in (select id::text from pg_temp.demo_locataires)
      )';

      if v_has_agency_id then
        execute v_sql using p_agency_id;
      else
        execute v_sql;
      end if;
      get diagnostics v_deleted_document_verifications = row_count;
    end if;
  end if;

  if to_regclass('public.document_registry') is not null then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'document_registry' and column_name = 'agency_id'
    ) into v_has_agency_id;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'document_registry' and column_name = 'entity_id'
    ) into v_has_entity_id;

    if v_has_entity_id then
      v_sql := 'delete from public.document_registry where ';
      if v_has_agency_id then
        v_sql := v_sql || 'agency_id = $1 and ';
      end if;
      v_sql := v_sql || 'entity_id in (
        select id::text from pg_temp.demo_paiements
        union all select id::text from pg_temp.demo_contrats
        union all select id::text from pg_temp.demo_bailleurs
        union all select id::text from pg_temp.demo_immeubles
        union all select id::text from pg_temp.demo_unites
        union all select id::text from pg_temp.demo_locataires
      )';

      if v_has_agency_id then
        execute v_sql using p_agency_id;
      else
        execute v_sql;
      end if;
      get diagnostics v_deleted_document_registry = row_count;
    end if;
  end if;

  -- Detach GED records instead of deleting the files. This avoids data loss while
  -- allowing FK parents from demo data to be deleted.
  if to_regclass('public.documents') is not null then
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'documents' and column_name = 'agency_id') into v_has_agency_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'documents' and column_name = 'entity_id') into v_has_entity_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'documents' and column_name = 'contrat_id') into v_has_contrat_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'documents' and column_name = 'bailleur_id') into v_has_bailleur_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'documents' and column_name = 'immeuble_id') into v_has_immeuble_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'documents' and column_name = 'unite_id') into v_has_unite_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'documents' and column_name = 'lifecycle_status') into v_has_lifecycle_status;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'documents' and column_name = 'deleted_at') into v_has_deleted_at;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'documents' and column_name = 'updated_at') into v_has_updated_at;

    v_set_sql := '';
    v_where_sql := '';

    if v_has_lifecycle_status then
      v_set_sql := v_set_sql || 'lifecycle_status = ''deleted'', ';
    end if;
    if v_has_deleted_at then
      v_set_sql := v_set_sql || 'deleted_at = coalesce(deleted_at, now()), ';
    end if;
    if v_has_updated_at then
      v_set_sql := v_set_sql || 'updated_at = now(), ';
    end if;
    if v_has_contrat_id then
      v_set_sql := v_set_sql || 'contrat_id = null, ';
      v_where_sql := v_where_sql || ' or contrat_id in (select id from pg_temp.demo_contrats)';
    end if;
    if v_has_unite_id then
      v_set_sql := v_set_sql || 'unite_id = null, ';
      v_where_sql := v_where_sql || ' or unite_id in (select id from pg_temp.demo_unites)';
    end if;
    if v_has_immeuble_id then
      v_set_sql := v_set_sql || 'immeuble_id = null, ';
      v_where_sql := v_where_sql || ' or immeuble_id in (select id from pg_temp.demo_immeubles)';
    end if;
    if v_has_bailleur_id then
      v_set_sql := v_set_sql || 'bailleur_id = null, ';
      v_where_sql := v_where_sql || ' or bailleur_id in (select id from pg_temp.demo_bailleurs)';
    end if;
    if v_has_entity_id then
      v_set_sql := v_set_sql || 'entity_id = null, ';
      v_where_sql := v_where_sql || ' or entity_id in (
        select id from pg_temp.demo_paiements
        union all select id from pg_temp.demo_contrats
        union all select id from pg_temp.demo_bailleurs
        union all select id from pg_temp.demo_immeubles
        union all select id from pg_temp.demo_unites
        union all select id from pg_temp.demo_locataires
      )';
    end if;

    v_set_sql := regexp_replace(v_set_sql, ',\s*$', '');
    v_where_sql := regexp_replace(v_where_sql, '^\s*or\s+', '');

    if v_set_sql <> '' and v_where_sql <> '' then
      v_sql := 'update public.documents set ' || v_set_sql || ' where ';
      if v_has_agency_id then
        v_sql := v_sql || 'agency_id = $1 and ';
      end if;
      v_sql := v_sql || '(' || v_where_sql || ')';

      if v_has_agency_id then
        execute v_sql using p_agency_id;
      else
        execute v_sql;
      end if;
      get diagnostics v_touched_documents = row_count;
    end if;
  end if;

  if to_regclass('public.inventaires') is not null then
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inventaires' and column_name = 'agency_id') into v_has_agency_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inventaires' and column_name = 'contrat_id') into v_has_contrat_id;

    if v_has_contrat_id then
      v_sql := 'delete from public.inventaires where ';
      if v_has_agency_id then
        v_sql := v_sql || 'agency_id = $1 and ';
      end if;
      v_sql := v_sql || 'contrat_id in (select id from pg_temp.demo_contrats)';

      if v_has_agency_id then
        execute v_sql using p_agency_id;
      else
        execute v_sql;
      end if;
      get diagnostics v_deleted_inventaires = row_count;
    end if;
  end if;

  if to_regclass('public.revenus') is not null then
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'revenus' and column_name = 'agency_id') into v_has_agency_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'revenus' and column_name = 'paiement_id') into v_has_paiement_id;

    if v_has_paiement_id then
      v_sql := 'delete from public.revenus where ';
      if v_has_agency_id then
        v_sql := v_sql || 'agency_id = $1 and ';
      end if;
      v_sql := v_sql || 'paiement_id in (select id from pg_temp.demo_paiements)';

      if v_has_agency_id then
        execute v_sql using p_agency_id;
      else
        execute v_sql;
      end if;
      get diagnostics v_deleted_revenus = row_count;
    end if;
  end if;

  if to_regclass('public.event_log') is not null then
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'event_log' and column_name = 'agency_id') into v_has_agency_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'event_log' and column_name = 'entity_id') into v_has_entity_id;

    if v_has_entity_id then
      v_sql := 'delete from public.event_log where ';
      if v_has_agency_id then
        v_sql := v_sql || 'agency_id = $1 and ';
      end if;
      v_sql := v_sql || 'entity_id in (
        select id from pg_temp.demo_paiements
        union all select id from pg_temp.demo_contrats
        union all select id from pg_temp.demo_locataires
        union all select id from pg_temp.demo_unites
        union all select id from pg_temp.demo_immeubles
        union all select id from pg_temp.demo_bailleurs
      )';

      if v_has_agency_id then
        execute v_sql using p_agency_id;
      else
        execute v_sql;
      end if;
      get diagnostics v_deleted_event_log = row_count;
    end if;
  end if;

  if to_regclass('public.event_outbox') is not null then
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'event_outbox' and column_name = 'agency_id') into v_has_agency_id;
    select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'event_outbox' and column_name = 'entity_id') into v_has_entity_id;

    if v_has_entity_id then
      v_sql := 'delete from public.event_outbox where ';
      if v_has_agency_id then
        v_sql := v_sql || 'agency_id = $1 and ';
      end if;
      v_sql := v_sql || 'entity_id in (
        select id from pg_temp.demo_paiements
        union all select id from pg_temp.demo_contrats
        union all select id from pg_temp.demo_locataires
        union all select id from pg_temp.demo_unites
        union all select id from pg_temp.demo_immeubles
        union all select id from pg_temp.demo_bailleurs
      )';

      if v_has_agency_id then
        execute v_sql using p_agency_id;
      else
        execute v_sql;
      end if;
      get diagnostics v_deleted_event_outbox = row_count;
    end if;
  end if;

  execute 'delete from public.paiements
    where agency_id = $1 and id in (select id from pg_temp.demo_paiements)'
    using p_agency_id;
  get diagnostics v_deleted_paiements = row_count;

  execute 'delete from public.contrats
    where agency_id = $1 and id in (select id from pg_temp.demo_contrats)'
    using p_agency_id;
  get diagnostics v_deleted_contrats = row_count;

  execute 'delete from public.locataires
    where agency_id = $1 and id in (select id from pg_temp.demo_locataires)'
    using p_agency_id;
  get diagnostics v_deleted_locataires = row_count;

  execute 'delete from public.unites
    where agency_id = $1 and id in (select id from pg_temp.demo_unites)'
    using p_agency_id;
  get diagnostics v_deleted_unites = row_count;

  execute 'delete from public.immeubles
    where agency_id = $1 and id in (select id from pg_temp.demo_immeubles)'
    using p_agency_id;
  get diagnostics v_deleted_immeubles = row_count;

  execute 'delete from public.bailleurs
    where agency_id = $1 and id in (select id from pg_temp.demo_bailleurs)'
    using p_agency_id;
  get diagnostics v_deleted_bailleurs = row_count;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agencies' and column_name = 'demo_data_loaded'
  ) then
    update public.agencies
    set demo_data_loaded = false
    where id = p_agency_id;
  end if;

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
