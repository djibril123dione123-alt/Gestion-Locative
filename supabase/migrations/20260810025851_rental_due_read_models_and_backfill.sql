-- Canonical rental due rollout, read models and compatibility bridge.
-- Nothing is enabled globally. Agencies are activated only after a zero-delta
-- reconciliation against the legacy monthly receivable model.

begin;

-- ---------------------------------------------------------------------------
-- Document vocabulary shared by registry, Storage and verification.
-- ---------------------------------------------------------------------------

alter table public.document_registry
  drop constraint if exists document_registry_document_type_check;
alter table public.document_registry
  add constraint document_registry_document_type_check check (document_type in (
    'contrat', 'mandat', 'quittance', 'facture', 'rapport_bailleur',
    'due_notice', 'rent_invoice', 'partial_payment_receipt', 'rent_receipt',
    'credit_note', 'export', 'pdf', 'document'
  ));

alter table public.document_verifications
  drop constraint if exists document_verifications_document_type_check;
alter table public.document_verifications
  add constraint document_verifications_document_type_check check (document_type in (
    'quittance', 'facture', 'contrat', 'mandat', 'rapport', 'rapport_bailleur',
    'due_notice', 'rent_invoice', 'partial_payment_receipt', 'rent_receipt',
    'credit_note', 'export', 'document'
  ));

create or replace function public.document_storage_folder(p_document_type text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_document_type
    when 'contrat' then 'contrats'
    when 'mandat' then 'mandats'
    when 'quittance' then 'quittances'
    when 'rent_receipt' then 'quittances'
    when 'partial_payment_receipt' then 'recus-partiels'
    when 'facture' then 'factures'
    when 'rent_invoice' then 'factures-loyer'
    when 'due_notice' then 'avis-echeance'
    when 'credit_note' then 'avoirs'
    when 'rapport_bailleur' then 'rapports-bailleurs'
    else 'exports'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Legacy payment summary compatibility. The legacy columns remain readable,
-- but the canonical due owns the balance as soon as the agency is enabled.
-- ---------------------------------------------------------------------------

create or replace function public.fn_recompute_paiement_echeance(
  p_agency_id uuid,
  p_contrat_id uuid,
  p_mois_concerne date
)
returns table (
  montant_attendu numeric,
  montant_encaisse numeric,
  reliquat numeric,
  statut_echeance text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expected numeric(14,2);
  v_paid numeric(14,2);
  v_due public.rental_dues%rowtype;
  v_engine_enabled boolean := false;
begin
  select coalesce(s.rental_due_engine_enabled, false)
    into v_engine_enabled
    from public.agency_settings s
   where s.agency_id = p_agency_id;

  if v_engine_enabled then
    select * into v_due
      from public.rental_dues d
     where d.agency_id = p_agency_id
       and d.contract_id = p_contrat_id
       and d.period_start = date_trunc('month', p_mois_concerne)::date
       and d.status <> 'CANCELLED'
     order by d.version desc
     limit 1;

    if not found then
      v_due := public.fn_generate_rental_due(
        p_contrat_id,
        date_trunc('month', p_mois_concerne)::date,
        'generated',
        null
      );
    end if;

    v_due := public.fn_refresh_rental_due(v_due.id);
    update public.paiements p
       set montant_attendu = v_due.amount_ttc,
           montant_encaisse_cumul = v_due.allocated_amount + v_due.credit_applied,
           reliquat = v_due.outstanding_amount,
           updated_at = now()
     where p.agency_id = p_agency_id
       and p.contrat_id = p_contrat_id
       and date_trunc('month', p.mois_concerne)::date = v_due.period_start
       and p.deleted_at is null;

    return query select
      v_due.amount_ttc,
      v_due.allocated_amount + v_due.credit_applied,
      v_due.outstanding_amount,
      case v_due.status
        when 'PAID' then 'paye'
        when 'PARTIALLY_PAID' then 'partiel'
        else 'impaye'
      end;
    return;
  end if;

  select c.loyer_mensuel into v_expected
    from public.contrats c
   where c.id = p_contrat_id and c.agency_id = p_agency_id;
  if v_expected is null then raise exception 'CONTRAT_NOT_FOUND'; end if;

  select coalesce(sum(p.montant_total), 0) into v_paid
    from public.paiements p
   where p.agency_id = p_agency_id
     and p.contrat_id = p_contrat_id
     and p.mois_concerne = p_mois_concerne
     and p.statut in ('paye', 'partiel')
     and p.deleted_at is null;

  if v_paid > v_expected then
    raise exception 'OVERPAYMENT: total encaisse % XOF, loyer attendu % XOF', v_paid, v_expected;
  end if;

  update public.paiements p
     set montant_attendu = v_expected,
         montant_encaisse_cumul = v_paid,
         reliquat = greatest(v_expected - v_paid, 0),
         updated_at = now()
   where p.agency_id = p_agency_id
     and p.contrat_id = p_contrat_id
     and p.mois_concerne = p_mois_concerne
     and p.deleted_at is null;

  return query select v_expected, v_paid, greatest(v_expected - v_paid, 0),
    case when v_paid <= 0 then 'impaye' when v_paid < v_expected then 'partiel' else 'paye' end;
end;
$$;

revoke all on function public.fn_recompute_paiement_echeance(uuid, uuid, date)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Authenticated read model. Tenant and landlord restrictions fail closed.
-- ---------------------------------------------------------------------------

create or replace function public.fn_finance_open_receivables(
  p_agency_id uuid,
  p_start date default null,
  p_end date default null
)
returns table (
  id text,
  contrat_id uuid,
  bailleur_id uuid,
  locataire_nom text,
  locataire_prenom text,
  telephone_locataire text,
  unite_nom text,
  immeuble_nom text,
  bailleur_nom text,
  bailleur_prenom text,
  montant_attendu numeric,
  montant_encaisse numeric,
  montant_du numeric,
  mois_concerne date,
  date_echeance date,
  statut text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_bailleur_id uuid;
  v_owner_account boolean;
  v_engine_enabled boolean := false;
  v_start date := coalesce(date_trunc('month', p_start)::date, date_trunc('month', current_date - interval '12 months')::date);
  v_end date := coalesce(date_trunc('month', p_end)::date, date_trunc('month', current_date + interval '2 months')::date);
begin
  select up.role::text, up.bailleur_id, coalesce(a.is_bailleur_account, false)
    into v_role, v_bailleur_id, v_owner_account
    from public.user_profiles up
    join public.agencies a on a.id = up.agency_id
   where up.id = auth.uid()
     and up.agency_id = p_agency_id
     and coalesce(up.actif, true) = true;
  if not found then raise exception 'FINANCE_FORBIDDEN' using errcode = '42501'; end if;
  if v_role = 'bailleur' and not v_owner_account and v_bailleur_id is null then
    raise exception 'FINANCE_BAILLEUR_LINK_REQUIRED' using errcode = '42501';
  end if;
  if v_end < v_start then raise exception 'FINANCE_INVALID_PERIOD'; end if;

  select coalesce(s.rental_due_engine_enabled, false) into v_engine_enabled
    from public.agency_settings s where s.agency_id = p_agency_id;
  if not v_engine_enabled then
    return query select *
      from public.fn_finance_open_receivables_unchecked_20260614(p_agency_id, p_start, p_end);
    return;
  end if;

  return query
  select
    d.id::text,
    d.contract_id,
    d.landlord_id,
    coalesce(l.nom, '')::text,
    coalesce(l.prenom, '')::text,
    coalesce(l.telephone, '')::text,
    coalesce(u.nom, '')::text,
    coalesce(i.nom, '')::text,
    coalesce(b.nom, '')::text,
    coalesce(b.prenom, '')::text,
    d.amount_ttc,
    d.allocated_amount + d.credit_applied,
    d.outstanding_amount,
    d.period_start,
    d.due_date,
    case
      when d.status = 'PARTIALLY_PAID' then 'partiel'
      when d.due_date > current_date then 'a_venir'
      else 'en_retard'
    end::text
  from public.rental_dues d
  join public.locataires l on l.id = d.tenant_id
  join public.unites u on u.id = d.unit_id
  join public.immeubles i on i.id = u.immeuble_id
  left join public.bailleurs b on b.id = d.landlord_id
  where d.agency_id = p_agency_id
    and d.period_start between v_start and v_end
    and d.status in ('SCHEDULED', 'TO_ISSUE', 'ISSUED', 'PARTIALLY_PAID', 'OVERDUE')
    and d.outstanding_amount > 0.01
    and (v_role <> 'bailleur' or v_owner_account or d.landlord_id = v_bailleur_id)
  order by
    case when d.status = 'OVERDUE' then 0 when d.status = 'PARTIALLY_PAID' then 1 else 2 end,
    d.due_date,
    l.nom;
end;
$$;

revoke all on function public.fn_finance_open_receivables(uuid, date, date) from public, anon;
grant execute on function public.fn_finance_open_receivables(uuid, date, date) to authenticated;

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
  if not found then raise exception 'DUE_NOT_FOUND' using errcode = 'P0002'; end if;

  return jsonb_build_object(
    'due', to_jsonb(v_due),
    'lines', coalesce((select jsonb_agg(to_jsonb(x) order by x.display_order, x.created_at)
      from public.rental_due_lines x where x.due_id = v_due.id), '[]'::jsonb),
    'allocations', coalesce((select jsonb_agg(to_jsonb(x) order by x.allocated_at)
      from public.payment_allocations x where x.due_id = v_due.id), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(to_jsonb(x) order by x.version desc)
      from public.rental_due_documents x where x.due_id = v_due.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(x) order by x.occurred_at desc)
      from public.rental_due_events x where x.due_id = v_due.id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.fn_rental_due_snapshot_internal(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_rental_due_snapshot_internal(uuid) to service_role;

create or replace function public.fn_rental_due_detail(p_due_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due public.rental_dues;
  v_role text;
  v_bailleur_id uuid;
  v_owner_account boolean;
begin
  select up.role::text, up.bailleur_id, coalesce(a.is_bailleur_account, false)
    into v_role, v_bailleur_id, v_owner_account
    from public.user_profiles up
    join public.agencies a on a.id = up.agency_id
   where up.id = auth.uid() and coalesce(up.actif, true);
  if not found then raise exception 'FINANCE_FORBIDDEN' using errcode = '42501'; end if;

  select * into v_due from public.rental_dues where id = p_due_id;
  if not found then raise exception 'DUE_NOT_FOUND'; end if;
  if v_due.agency_id <> public.current_user_agency_id()
     or (v_role = 'bailleur' and not v_owner_account and (v_bailleur_id is null or v_due.landlord_id <> v_bailleur_id)) then
    raise exception 'FINANCE_FORBIDDEN' using errcode = '42501';
  end if;

  return public.fn_rental_due_snapshot_internal(v_due.id);
end;
$$;

revoke all on function public.fn_rental_due_detail(uuid) from public, anon;
grant execute on function public.fn_rental_due_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Generated-document compatibility. New rent-document types use the same
-- immutable registry and private Storage lifecycle as existing PDFs.
-- ---------------------------------------------------------------------------

create or replace function public.fn_prepare_managed_document(
  p_document_type text,
  p_entity_id text,
  p_period text,
  p_reference text,
  p_data_hash text,
  p_file_size bigint,
  p_mime_type text,
  p_retention_policy text default 'critical',
  p_metadata jsonb default '{}'::jsonb,
  p_template_revision_id uuid default null,
  p_template_checksum text default null,
  p_renderer_version text default null,
  p_asset_checksums jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.current_user_agency_id();
  v_user_id uuid := auth.uid();
  v_existing public.document_registry;
  v_reserved public.document_registry;
  v_version integer;
  v_id uuid := gen_random_uuid();
begin
  if v_user_id is null or v_agency_id is null or not (
    public.fn_user_can(v_user_id, 'documents', 'export')
    or public.current_user_is_individual_landlord_account()
  ) then
    raise exception 'DOCUMENT_PREPARE_FORBIDDEN' using errcode = '42501';
  end if;

  if p_document_type not in (
    'contrat', 'mandat', 'quittance', 'facture', 'rapport_bailleur',
    'due_notice', 'rent_invoice', 'partial_payment_receipt', 'rent_receipt',
    'credit_note', 'export', 'pdf', 'document'
  ) then
    raise exception 'DOCUMENT_TYPE_INVALID' using errcode = '22023';
  end if;
  if nullif(btrim(p_entity_id), '') is null or nullif(btrim(p_reference), '') is null then
    raise exception 'DOCUMENT_IDENTITY_INCOMPLETE' using errcode = '22023';
  end if;
  if p_data_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'DOCUMENT_DATA_HASH_INVALID' using errcode = '22023';
  end if;
  if coalesce(p_file_size, 0) <= 0 then
    raise exception 'DOCUMENT_FILE_EMPTY' using errcode = '22023';
  end if;
  if p_retention_policy not in ('critical', 'standard', 'temporary') then
    raise exception 'DOCUMENT_RETENTION_INVALID' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(concat_ws(
    '|', v_agency_id::text, p_document_type, p_entity_id, coalesce(p_period, '')
  ), 0));

  select * into v_existing
  from public.document_registry
  where agency_id = v_agency_id
    and document_type = p_document_type
    and entity_id = btrim(p_entity_id)
    and period is not distinct from p_period
    and data_hash = p_data_hash
    and status = 'active'
    and deleted_at is null
  order by version desc
  limit 1;

  if found then
    return jsonb_build_object('reused', true, 'entry', to_jsonb(v_existing));
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.document_registry
  where agency_id = v_agency_id
    and document_type = p_document_type
    and entity_id = btrim(p_entity_id)
    and period is not distinct from p_period;

  insert into public.document_registry (
    id, agency_id, document_type, entity_id, period, reference, version,
    storage_path, file_hash, data_hash, generated_by, status,
    retention_policy, file_size, mime_type, metadata,
    template_revision_id, template_checksum, renderer_version, asset_checksums
  ) values (
    v_id, v_agency_id, p_document_type, btrim(p_entity_id), p_period,
    btrim(p_reference), v_version,
    concat('pending/', v_agency_id::text, '/', v_id::text), repeat('0', 64),
    p_data_hash, v_user_id, 'pending', p_retention_policy, p_file_size,
    coalesce(nullif(btrim(p_mime_type), ''), 'application/pdf'),
    coalesce(p_metadata, '{}'::jsonb), p_template_revision_id,
    p_template_checksum, p_renderer_version, coalesce(p_asset_checksums, '{}'::jsonb)
  ) returning * into v_reserved;

  return jsonb_build_object('reused', false, 'entry', to_jsonb(v_reserved));
end;
$$;

create or replace function public.fn_finalize_managed_document_server(
  p_registry_id uuid,
  p_storage_path text,
  p_file_hash text,
  p_actor_id uuid,
  p_agency_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_entry public.document_registry;
  v_folder text;
  v_owner_account boolean := false;
begin
  if p_actor_id is null or p_agency_id is null or not exists (
    select 1 from public.user_profiles up
    where up.id = p_actor_id and up.agency_id = p_agency_id and coalesce(up.actif, true)
  ) then
    raise exception 'DOCUMENT_FINALIZE_FORBIDDEN' using errcode = '42501';
  end if;

  select coalesce(a.is_bailleur_account, false) into v_owner_account
  from public.agencies a where a.id = p_agency_id;
  if not (public.fn_user_can(p_actor_id, 'documents', 'export') or v_owner_account) then
    raise exception 'DOCUMENT_FINALIZE_FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_entry from public.document_registry
  where id = p_registry_id and agency_id = p_agency_id for update;
  if not found or v_entry.status <> 'pending' then
    raise exception 'DOCUMENT_RESERVATION_INVALID' using errcode = '55000';
  end if;
  if p_file_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'DOCUMENT_HASH_INVALID' using errcode = '22023';
  end if;
  if public.document_storage_agency_id(p_storage_path) is distinct from p_agency_id then
    raise exception 'DOCUMENT_STORAGE_PATH_INVALID' using errcode = '42501';
  end if;

  v_folder := public.document_storage_folder(v_entry.document_type);
  if p_storage_path not like concat('agencies/', p_agency_id::text, '/', v_folder, '/%') then
    raise exception 'DOCUMENT_STORAGE_FOLDER_INVALID' using errcode = '42501';
  end if;
  if not exists (
    select 1 from storage.objects where bucket_id = 'documents' and name = p_storage_path
  ) then
    raise exception 'DOCUMENT_STORAGE_OBJECT_MISSING' using errcode = 'P0002';
  end if;

  update public.document_registry
  set storage_path = p_storage_path, file_hash = p_file_hash, status = 'active',
      generated_at = now(), last_accessed_at = now()
  where id = p_registry_id
  returning * into v_entry;
  return to_jsonb(v_entry);
end;
$$;

revoke all on function public.fn_prepare_managed_document(
  text, text, text, text, text, bigint, text, text, jsonb, uuid, text, text, jsonb
) from public, anon;
grant execute on function public.fn_prepare_managed_document(
  text, text, text, text, text, bigint, text, text, jsonb, uuid, text, text, jsonb
) to authenticated;
revoke all on function public.fn_finalize_managed_document_server(
  uuid, text, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.fn_finalize_managed_document_server(
  uuid, text, text, uuid, uuid
) to service_role;

-- ---------------------------------------------------------------------------
-- Payment bridge. The hardened legacy command remains the single entry point.
-- Enabled agencies gain allocations and credits without weakening validation,
-- tenant locking, idempotency or the existing ledger trigger chain.
-- ---------------------------------------------------------------------------

create or replace function public.fn_create_paiement_financial(
  p_agency_id uuid,
  p_user_id uuid,
  p_contrat_id uuid,
  p_montant_total numeric,
  p_mois_concerne date,
  p_date_paiement date,
  p_mode_paiement text,
  p_statut text,
  p_reference text default null,
  p_notes text default null,
  p_idempotency_key text default null,
  p_is_demo_data boolean default false
)
returns public.paiements
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contrat record;
  v_due public.rental_dues%rowtype;
  v_existing public.paiements;
  v_request_payload jsonb;
  v_paid_before numeric(12,2);
  v_paid_after numeric(12,2);
  v_commission numeric(8,4);
  v_part_agence numeric(12,2);
  v_part_bailleur numeric(12,2);
  v_effective_statut public.paiement_statut;
  v_inserted public.paiements;
  v_lock_id uuid;
  v_engine_enabled boolean := false;
  v_expected numeric(14,2);
  v_idempotency_key text := nullif(btrim(p_idempotency_key), '');
  v_reference text := nullif(btrim(p_reference), '');
  v_notes text := nullif(btrim(p_notes), '');
begin
  if p_agency_id is null or p_user_id is null or p_contrat_id is null then
    raise exception 'PAYMENT_CONTEXT_REQUIRED';
  end if;
  if p_montant_total is null or p_montant_total <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_mois_concerne is null or p_date_paiement is null then
    raise exception 'PAYMENT_DATE_REQUIRED';
  end if;
  if p_mode_paiement not in ('especes', 'virement', 'cheque', 'mobile_money', 'autre') then
    raise exception 'PAYMENT_MODE_INVALID';
  end if;
  if p_statut not in ('paye', 'partiel', 'en_attente') then
    raise exception 'PAYMENT_STATUS_INVALID';
  end if;
  if v_idempotency_key is not null and char_length(v_idempotency_key) not between 12 and 120 then
    raise exception 'PAYMENT_IDEMPOTENCY_KEY_INVALID';
  end if;

  v_request_payload := jsonb_build_object(
    'agency_id', p_agency_id, 'user_id', p_user_id,
    'contrat_id', p_contrat_id, 'montant_total', p_montant_total,
    'mois_concerne', p_mois_concerne, 'date_paiement', p_date_paiement,
    'mode_paiement', p_mode_paiement, 'statut_demande', p_statut,
    'reference', v_reference, 'notes', v_notes,
    'is_demo_data', coalesce(p_is_demo_data, false)
  );

  if v_idempotency_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(
      p_agency_id::text || ':payment:' || v_idempotency_key, 0
    ));
    select * into v_existing from public.paiements
    where agency_id = p_agency_id and idempotency_key = v_idempotency_key
      and deleted_at is null limit 1;
    if found then
      if v_existing.idempotency_payload is null then
        raise exception 'PAYMENT_IDEMPOTENCY_LEGACY_UNVERIFIABLE';
      end if;
      if v_existing.idempotency_payload is distinct from v_request_payload then
        raise exception 'PAYMENT_IDEMPOTENCY_CONFLICT';
      end if;
      return v_existing;
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_agency_id::text || ':' || p_contrat_id::text || ':' || p_mois_concerne::text, 0
  ));

  select id, agency_id, commission, loyer_mensuel, statut
    into v_contrat
    from public.contrats
   where id = p_contrat_id and agency_id = p_agency_id
   for update;
  if not found then raise exception 'CONTRAT_NOT_FOUND'; end if;
  if v_contrat.commission is null then raise exception 'COMMISSION_REQUIRED'; end if;
  v_commission := v_contrat.commission;
  if v_commission < 0 or v_commission > 100 then raise exception 'COMMISSION_RANGE'; end if;

  select coalesce(s.rental_due_engine_enabled, false) into v_engine_enabled
  from public.agency_settings s where s.agency_id = p_agency_id;

  select p.id into v_lock_id from public.paiements p
  where p.agency_id = p_agency_id and p.contrat_id = p_contrat_id
    and p.mois_concerne = p_mois_concerne and p.deleted_at is null
  order by p.created_at, p.id limit 1 for update;

  select coalesce(sum(p.montant_total), 0) into v_paid_before
  from public.paiements p
  where p.agency_id = p_agency_id and p.contrat_id = p_contrat_id
    and p.mois_concerne = p_mois_concerne
    and p.statut in ('paye', 'partiel') and p.deleted_at is null;

  if v_engine_enabled then
    select * into v_due from public.rental_dues d
    where d.agency_id = p_agency_id and d.contract_id = p_contrat_id
      and d.period_start = date_trunc('month', p_mois_concerne)::date
      and d.status <> 'CANCELLED'
    order by d.version desc limit 1 for update;
    if not found then
      v_due := public.fn_generate_rental_due(
        p_contrat_id, date_trunc('month', p_mois_concerne)::date,
        case when v_contrat.statut::text = 'actif' then 'generated' else 'backfill' end,
        p_user_id
      );
    end if;
    v_expected := v_due.amount_ttc;
  else
    v_expected := v_contrat.loyer_mensuel;
  end if;

  if p_statut = 'en_attente' then
    v_paid_after := v_paid_before;
    v_effective_statut := 'en_attente'::public.paiement_statut;
  else
    v_paid_after := v_paid_before + p_montant_total;
    if not v_engine_enabled and v_paid_after > v_expected then
      raise exception
        'OVERPAYMENT: total deja encaisse % XOF, nouveau paiement % XOF, loyer attendu % XOF',
        v_paid_before, p_montant_total, v_expected;
    end if;
    v_effective_statut := case
      when v_paid_after >= v_expected then 'paye'::public.paiement_statut
      else 'partiel'::public.paiement_statut
    end;
  end if;

  v_part_agence := round((p_montant_total * v_commission) / 100);
  v_part_bailleur := p_montant_total - v_part_agence;

  insert into public.paiements (
    contrat_id, agency_id, montant_total, mois_concerne, date_paiement,
    mode_paiement, part_agence, part_bailleur, statut, reference, notes,
    idempotency_key, idempotency_payload, montant_attendu,
    montant_encaisse_cumul, reliquat, created_by, is_demo_data
  ) values (
    p_contrat_id, p_agency_id, p_montant_total, p_mois_concerne, p_date_paiement,
    p_mode_paiement::public.mode_paiement, v_part_agence, v_part_bailleur,
    v_effective_statut, v_reference, v_notes, v_idempotency_key, v_request_payload,
    v_expected, v_paid_after, greatest(v_expected - v_paid_after, 0), p_user_id,
    coalesce(p_is_demo_data, false)
  ) returning * into v_inserted;

  perform public.fn_recompute_paiement_echeance(
    p_agency_id, p_contrat_id, p_mois_concerne
  );
  select * into v_inserted from public.paiements where id = v_inserted.id;
  return v_inserted;
end;
$$;

revoke all on function public.fn_create_paiement_financial(
  uuid, uuid, uuid, numeric, date, date, text, text, text, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.fn_create_paiement_financial(
  uuid, uuid, uuid, numeric, date, date, text, text, text, text, text, boolean
) to service_role;

-- ---------------------------------------------------------------------------
-- Service commands, deterministic backfill and zero-delta rollout gate.
-- ---------------------------------------------------------------------------

create or replace function public.fn_rental_due_actor_can_manage(
  p_agency_id uuid,
  p_actor_id uuid,
  p_action text default 'create'
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = p_actor_id
      and up.agency_id = p_agency_id
      and coalesce(up.actif, true)
      and (
        up.role::text in ('admin', 'super-admin', 'super_admin')
        or public.fn_user_can(p_actor_id, 'paiements', p_action)
      )
  );
$$;

create or replace function public.fn_generate_rental_due_command(
  p_agency_id uuid,
  p_actor_id uuid,
  p_contract_id uuid,
  p_period_start date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due public.rental_dues%rowtype;
begin
  if not public.fn_rental_due_actor_can_manage(p_agency_id, p_actor_id, 'create') then
    raise exception 'DUE_COMMAND_FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.contrats c
    where c.id = p_contract_id and c.agency_id = p_agency_id
  ) then
    raise exception 'CONTRACT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_due := public.fn_generate_rental_due(
    p_contract_id, date_trunc('month', p_period_start)::date, 'generated', p_actor_id
  );
  return public.fn_rental_due_snapshot_internal(v_due.id);
end;
$$;

create or replace function public.fn_generate_rental_dues_bulk_command(
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
  v_key text;
  v_run public.rental_due_automation_runs%rowtype;
  v_contract record;
  v_due public.rental_dues%rowtype;
  v_processed integer := 0;
  v_success integer := 0;
  v_errors integer := 0;
  v_error_items jsonb := '[]'::jsonb;
begin
  if not public.fn_rental_due_actor_can_manage(p_agency_id, p_actor_id, 'create') then
    raise exception 'DUE_COMMAND_FORBIDDEN' using errcode = '42501';
  end if;

  v_key := 'generation:' || p_agency_id::text || ':' || to_char(v_period, 'YYYY-MM');
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  select * into v_run from public.rental_due_automation_runs
  where idempotency_key = v_key;
  if found and v_run.status = 'completed' then
    return jsonb_build_object('reused', true, 'run', to_jsonb(v_run));
  end if;

  insert into public.rental_due_automation_runs (
    agency_id, run_type, period_key, idempotency_key, status
  ) values (
    p_agency_id, 'generation', to_char(v_period, 'YYYY-MM'), v_key, 'running'
  ) on conflict (idempotency_key) do update
    set status = 'running', started_at = now(), completed_at = null
  returning * into v_run;

  for v_contract in
    select c.id
    from public.contrats c
    where c.agency_id = p_agency_id
      and c.statut::text = 'actif'
      and c.date_debut <= (v_period + interval '1 month - 1 day')::date
      and (c.date_fin is null or c.date_fin >= v_period)
    order by c.id
  loop
    v_processed := v_processed + 1;
    begin
      v_due := public.fn_generate_rental_due(v_contract.id, v_period, 'generated', p_actor_id);
      v_success := v_success + 1;
    exception when others then
      v_errors := v_errors + 1;
      v_error_items := v_error_items || jsonb_build_array(jsonb_build_object(
        'contract_id', v_contract.id,
        'error_code', sqlstate,
        'message', left(sqlerrm, 180)
      ));
    end;
  end loop;

  update public.rental_due_automation_runs
  set status = case when v_errors = 0 then 'completed' else 'partial' end,
      processed_count = v_processed, success_count = v_success,
      error_count = v_errors, completed_at = now(),
      summary = jsonb_build_object('errors', v_error_items)
  where id = v_run.id
  returning * into v_run;

  return jsonb_build_object('reused', false, 'run', to_jsonb(v_run));
end;
$$;

create or replace function public.fn_backfill_rental_dues_command(
  p_agency_id uuid,
  p_actor_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from date := date_trunc('month', p_from)::date;
  v_to date := date_trunc('month', p_to)::date;
  v_engine_enabled boolean := false;
  v_contract record;
  v_period date;
  v_payment record;
  v_due public.rental_dues%rowtype;
  v_generated integer := 0;
  v_payments integer := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  if not public.fn_rental_due_actor_can_manage(p_agency_id, p_actor_id, 'manage') then
    raise exception 'DUE_BACKFILL_FORBIDDEN' using errcode = '42501';
  end if;
  if v_from is null or v_to is null or v_to < v_from
     or v_to > date_trunc('month', current_date + interval '2 months')::date then
    raise exception 'DUE_BACKFILL_PERIOD_INVALID' using errcode = '22023';
  end if;
  select coalesce(s.rental_due_engine_enabled, false) into v_engine_enabled
  from public.agency_settings s where s.agency_id = p_agency_id;
  if v_engine_enabled then
    raise exception 'DUE_BACKFILL_REQUIRES_DISABLED_ENGINE' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'due-backfill:' || p_agency_id::text, 0
  ));

  for v_contract in
    select c.id, c.date_debut, c.date_fin
    from public.contrats c
    where c.agency_id = p_agency_id
      and c.date_debut <= (v_to + interval '1 month - 1 day')::date
      and (c.date_fin is null or c.date_fin >= v_from)
    order by c.id
  loop
    for v_period in
      select generate_series(
        greatest(v_from, date_trunc('month', v_contract.date_debut)::date),
        least(v_to, date_trunc('month', coalesce(v_contract.date_fin, v_to))::date),
        interval '1 month'
      )::date
    loop
      begin
        v_due := public.fn_generate_rental_due(v_contract.id, v_period, 'backfill', p_actor_id);
        v_generated := v_generated + 1;
      exception when others then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'contract_id', v_contract.id, 'period', v_period,
          'error_code', sqlstate, 'message', left(sqlerrm, 180)
        ));
      end;
    end loop;
  end loop;

  for v_payment in
    select p.id
    from public.paiements p
    where p.agency_id = p_agency_id
      and p.statut in ('paye', 'partiel')
      and coalesce(p.actif, true)
      and p.deleted_at is null
      and date_trunc('month', p.mois_concerne)::date between v_from and v_to
    order by p.date_paiement, p.created_at, p.id
  loop
    perform public.fn_apply_payment_allocations(
      v_payment.id, null, 'legacy_month', p_actor_id
    );
    v_payments := v_payments + 1;
  end loop;

  insert into public.rental_due_automation_runs (
    agency_id, run_type, period_key, idempotency_key, status,
    processed_count, success_count, error_count, completed_at, summary
  ) values (
    p_agency_id, 'reconciliation',
    to_char(v_from, 'YYYY-MM') || ':' || to_char(v_to, 'YYYY-MM'),
    'backfill:' || p_agency_id::text || ':' || to_char(v_from, 'YYYY-MM') || ':' || to_char(v_to, 'YYYY-MM'),
    case when jsonb_array_length(v_errors) = 0 then 'completed' else 'partial' end,
    v_generated + v_payments, v_generated + v_payments,
    jsonb_array_length(v_errors), now(), jsonb_build_object('errors', v_errors)
  ) on conflict (idempotency_key) do update
    set status = excluded.status, processed_count = excluded.processed_count,
        success_count = excluded.success_count, error_count = excluded.error_count,
        completed_at = excluded.completed_at, summary = excluded.summary;

  return jsonb_build_object(
    'generated_due_count', v_generated,
    'allocated_payment_count', v_payments,
    'errors', v_errors
  );
end;
$$;

create or replace function public.fn_reconcile_rental_dues(
  p_agency_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from date := date_trunc('month', p_from)::date;
  v_to date := date_trunc('month', p_to)::date;
  v_legacy_expected numeric(16,2) := 0;
  v_legacy_paid numeric(16,2) := 0;
  v_canonical_expected numeric(16,2) := 0;
  v_canonical_funds numeric(16,2) := 0;
  v_due_count integer := 0;
  v_contract_months integer := 0;
begin
  if auth.role() <> 'service_role' and not (
    public.current_user_agency_id() = p_agency_id and public.is_admin()
  ) and not public.is_super_admin() then
    raise exception 'DUE_RECONCILIATION_FORBIDDEN' using errcode = '42501';
  end if;
  if v_from is null or v_to is null or v_to < v_from then
    raise exception 'DUE_RECONCILIATION_PERIOD_INVALID' using errcode = '22023';
  end if;

  with contract_months as (
    select c.id, month_start::date, c.loyer_mensuel
    from public.contrats c
    cross join lateral generate_series(
      greatest(v_from, date_trunc('month', c.date_debut)::date),
      least(v_to, date_trunc('month', coalesce(c.date_fin, v_to))::date),
      interval '1 month'
    ) month_start
    where c.agency_id = p_agency_id
      and c.date_debut <= (v_to + interval '1 month - 1 day')::date
      and (c.date_fin is null or c.date_fin >= v_from)
  )
  select coalesce(sum(loyer_mensuel), 0), count(*)
    into v_legacy_expected, v_contract_months
  from contract_months;

  select coalesce(sum(p.montant_total), 0) into v_legacy_paid
  from public.paiements p
  where p.agency_id = p_agency_id
    and p.statut in ('paye', 'partiel') and coalesce(p.actif, true)
    and p.deleted_at is null
    and date_trunc('month', p.mois_concerne)::date between v_from and v_to;

  select coalesce(sum(d.amount_ttc), 0), count(*)
    into v_canonical_expected, v_due_count
  from public.rental_dues d
  where d.agency_id = p_agency_id and d.status <> 'CANCELLED'
    and d.period_start between v_from and v_to;

  select coalesce(sum(p.montant_total), 0)
    into v_canonical_funds
  from public.paiements p
  where p.agency_id = p_agency_id
    and p.statut in ('paye', 'partiel') and coalesce(p.actif, true)
    and p.deleted_at is null
    and date_trunc('month', p.mois_concerne)::date between v_from and v_to
    and (
      exists (select 1 from public.payment_allocations pa where pa.payment_id = p.id)
      or exists (select 1 from public.rental_credit_movements rcm where rcm.payment_id = p.id)
    );

  return jsonb_build_object(
    'agency_id', p_agency_id, 'from', v_from, 'to', v_to,
    'legacy_expected', v_legacy_expected,
    'canonical_expected', v_canonical_expected,
    'expected_delta', round(v_canonical_expected - v_legacy_expected, 2),
    'legacy_paid', v_legacy_paid,
    'canonical_funds', v_canonical_funds,
    'payment_delta', round(v_canonical_funds - v_legacy_paid, 2),
    'contract_month_count', v_contract_months, 'due_count', v_due_count,
    'is_zero_delta', abs(v_canonical_expected - v_legacy_expected) <= 0.01
      and abs(v_canonical_funds - v_legacy_paid) <= 0.01
      and v_contract_months = v_due_count
  );
end;
$$;

create or replace function public.fn_activate_rental_due_engine_command(
  p_agency_id uuid,
  p_actor_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reconciliation jsonb;
begin
  if not public.fn_rental_due_actor_can_manage(p_agency_id, p_actor_id, 'manage') then
    raise exception 'DUE_ACTIVATION_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('due-activate:' || p_agency_id::text, 0));
  v_reconciliation := public.fn_reconcile_rental_dues(p_agency_id, p_from, p_to);
  if not coalesce((v_reconciliation->>'is_zero_delta')::boolean, false) then
    raise exception 'DUE_RECONCILIATION_REQUIRED' using errcode = '55000';
  end if;
  update public.agency_settings
  set rental_due_engine_enabled = true, updated_at = now()
  where agency_id = p_agency_id;
  insert into public.rental_due_events (agency_id, event_type, event_key, actor_id, payload)
  values (
    p_agency_id, 'engine_activated', 'engine:' || p_agency_id::text || ':activated',
    p_actor_id, v_reconciliation
  ) on conflict (event_key) where event_key is not null do nothing;
  return v_reconciliation || jsonb_build_object('enabled', true);
end;
$$;

revoke all on function public.fn_rental_due_actor_can_manage(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.fn_generate_rental_due_command(uuid, uuid, uuid, date)
  from public, anon, authenticated;
revoke all on function public.fn_generate_rental_dues_bulk_command(uuid, uuid, date)
  from public, anon, authenticated;
revoke all on function public.fn_backfill_rental_dues_command(uuid, uuid, date, date)
  from public, anon, authenticated;
revoke all on function public.fn_reconcile_rental_dues(uuid, date, date)
  from public, anon;
revoke all on function public.fn_activate_rental_due_engine_command(uuid, uuid, date, date)
  from public, anon, authenticated;
grant execute on function public.fn_rental_due_actor_can_manage(uuid, uuid, text) to service_role;
grant execute on function public.fn_generate_rental_due_command(uuid, uuid, uuid, date) to service_role;
grant execute on function public.fn_generate_rental_dues_bulk_command(uuid, uuid, date) to service_role;
grant execute on function public.fn_backfill_rental_dues_command(uuid, uuid, date, date) to service_role;
grant execute on function public.fn_reconcile_rental_dues(uuid, date, date) to authenticated, service_role;
grant execute on function public.fn_activate_rental_due_engine_command(uuid, uuid, date, date) to service_role;

-- ---------------------------------------------------------------------------
-- Due documents, numbering, reminders and operational automation.
-- ---------------------------------------------------------------------------

create table if not exists public.rental_document_counters (
  agency_id uuid not null references public.agencies(id) on delete restrict,
  document_type text not null,
  counter_year integer not null,
  last_value bigint not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now(),
  primary key (agency_id, document_type, counter_year)
);

alter table public.rental_document_counters enable row level security;
alter table public.rental_document_counters force row level security;
create policy rental_document_counters_select_tenant
  on public.rental_document_counters for select to authenticated
  using (agency_id = public.current_user_agency_id() or public.is_super_admin());
revoke all on public.rental_document_counters from anon, authenticated;
grant select on public.rental_document_counters to authenticated;

create or replace function public.fn_next_rental_document_reference(
  p_agency_id uuid,
  p_document_type text,
  p_date date default current_date
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year integer := extract(year from p_date)::integer;
  v_value bigint;
  v_prefix text;
begin
  if p_document_type not in (
    'due_notice', 'rent_invoice', 'partial_payment_receipt', 'rent_receipt', 'credit_note'
  ) then
    raise exception 'DUE_DOCUMENT_TYPE_INVALID' using errcode = '22023';
  end if;
  v_prefix := case p_document_type
    when 'due_notice' then 'AVE'
    when 'rent_invoice' then 'FAC'
    when 'partial_payment_receipt' then 'RCP'
    when 'rent_receipt' then 'QIT'
    when 'credit_note' then 'AVO'
  end;
  insert into public.rental_document_counters (
    agency_id, document_type, counter_year, last_value
  ) values (p_agency_id, p_document_type, v_year, 1)
  on conflict (agency_id, document_type, counter_year)
  do update set last_value = public.rental_document_counters.last_value + 1,
                updated_at = now()
  returning last_value into v_value;
  return v_prefix || '-' || v_year::text || '-' || lpad(v_value::text, 6, '0');
end;
$$;

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
  select * into v_due from public.rental_dues
  where id = p_due_id and agency_id = p_agency_id for update;
  if not found then raise exception 'DUE_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_document_type not in (
    'due_notice', 'rent_invoice', 'partial_payment_receipt', 'rent_receipt', 'credit_note'
  ) then
    raise exception 'DUE_DOCUMENT_TYPE_INVALID' using errcode = '22023';
  end if;
  if p_document_type = 'partial_payment_receipt' and v_due.status <> 'PARTIALLY_PAID' then
    raise exception 'PARTIAL_RECEIPT_REQUIRES_PARTIAL_DUE' using errcode = '22023';
  end if;
  if p_document_type = 'rent_receipt' and v_due.status <> 'PAID' then
    raise exception 'RENT_RECEIPT_REQUIRES_PAID_DUE' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'due-document:' || p_due_id::text || ':' || p_document_type, 0
  ));
  v_snapshot := public.fn_rental_due_snapshot_internal(p_due_id)
    || jsonb_build_object('prepared_at', now(), 'due_updated_at', v_due.updated_at);

  select * into v_existing from public.rental_due_documents
  where due_id = p_due_id and document_type = p_document_type
    and status in ('draft', 'issued', 'archived')
    and data_snapshot->>'due_updated_at' = v_due.updated_at::text
  order by version desc limit 1;
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
    jsonb_build_object('document_id', v_document.id, 'type', p_document_type,
      'reference', v_reference, 'version', v_version)
  ) on conflict (event_key) where event_key is not null do nothing;
  return jsonb_build_object('reused', false, 'document', to_jsonb(v_document));
end;
$$;

create or replace function public.trg_link_registry_to_rental_due_document()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due_id uuid;
begin
  if new.status = 'active' and new.document_type in (
    'due_notice', 'rent_invoice', 'partial_payment_receipt', 'rent_receipt', 'credit_note'
  ) and new.entity_id ~* '^[0-9a-f-]{36}$' then
    v_due_id := new.entity_id::uuid;
    update public.rental_due_documents d
    set document_registry_id = new.id, status = 'issued', issued_at = new.generated_at
    where d.agency_id = new.agency_id and d.due_id = v_due_id
      and d.document_type = new.document_type and d.reference = new.reference
      and d.status = 'draft';
    update public.rental_dues
    set issued_at = coalesce(issued_at, new.generated_at), updated_at = now()
    where id = v_due_id and agency_id = new.agency_id;
    perform public.fn_refresh_rental_due(v_due_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_link_registry_to_rental_due_document on public.document_registry;
create trigger trg_link_registry_to_rental_due_document
after insert or update of status on public.document_registry
for each row execute function public.trg_link_registry_to_rental_due_document();

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
  if not found then raise exception 'DUE_NOT_FOUND'; end if;
  select coalesce(s.due_reminder_schedule, '[0,3,7,15]'::jsonb) into v_offsets
  from public.agency_settings s where s.agency_id = v_due.agency_id;
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

create or replace function public.fn_run_rental_due_daily_automation()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agency record;
  v_contract record;
  v_due public.rental_dues%rowtype;
  v_period date;
  v_generated integer := 0;
  v_refreshed integer := 0;
  v_reminders integer := 0;
  v_errors integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'DUE_AUTOMATION_FORBIDDEN' using errcode = '42501';
  end if;
  for v_agency in
    select s.agency_id, s.due_generation_day
    from public.agency_settings s
    where s.rental_due_engine_enabled and s.rental_due_auto_generate
  loop
    v_period := case
      when extract(day from current_date)::integer >= v_agency.due_generation_day
        then (date_trunc('month', current_date) + interval '1 month')::date
      else date_trunc('month', current_date)::date
    end;
    for v_contract in
      select c.id from public.contrats c
      where c.agency_id = v_agency.agency_id and c.statut::text = 'actif'
        and c.date_debut <= (v_period + interval '1 month - 1 day')::date
        and (c.date_fin is null or c.date_fin >= v_period)
    loop
      begin
        v_due := public.fn_generate_rental_due(v_contract.id, v_period, 'generated', null);
        v_due := public.fn_refresh_rental_due(v_due.id);
        v_generated := v_generated + 1;
        v_reminders := v_reminders + public.fn_schedule_rental_due_reminders(v_due.id, null);
      exception when others then
        v_errors := v_errors + 1;
      end;
    end loop;
  end loop;

  for v_due in
    select d.* from public.rental_dues d
    join public.agency_settings s on s.agency_id = d.agency_id
    where s.rental_due_engine_enabled
      and d.status in ('SCHEDULED', 'TO_ISSUE', 'ISSUED', 'PARTIALLY_PAID', 'OVERDUE')
  loop
    perform public.fn_refresh_rental_due(v_due.id);
    v_refreshed := v_refreshed + 1;
  end loop;
  return jsonb_build_object(
    'generated', v_generated, 'refreshed', v_refreshed,
    'reminders_scheduled', v_reminders, 'errors', v_errors,
    'completed_at', now()
  );
end;
$$;

revoke all on function public.fn_next_rental_document_reference(uuid, text, date)
  from public, anon, authenticated;
revoke all on function public.fn_prepare_rental_due_document_command(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.fn_schedule_rental_due_reminders(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.fn_run_rental_due_daily_automation()
  from public, anon, authenticated;
revoke all on function public.trg_link_registry_to_rental_due_document()
  from public, anon, authenticated;
grant execute on function public.fn_next_rental_document_reference(uuid, text, date) to service_role;
grant execute on function public.fn_prepare_rental_due_document_command(uuid, uuid, uuid, text) to service_role;
grant execute on function public.fn_schedule_rental_due_reminders(uuid, uuid) to service_role;
grant execute on function public.fn_run_rental_due_daily_automation() to service_role;

commit;
