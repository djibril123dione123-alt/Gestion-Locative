-- Official financial document snapshots.
-- A generated receipt or owner report must remain reproducible even when the
-- underlying operational records change later.

create table if not exists public.financial_document_snapshots (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  document_kind text not null check (
    document_kind in ('quittance', 'facture', 'rapport_bailleur', 'rapport_proprietaire')
  ),
  entity_id uuid not null,
  period_start date not null,
  period_end date not null,
  payload jsonb not null,
  payload_fingerprint text not null,
  source_version text not null default 'finance_snapshot_v1',
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint financial_document_snapshots_period_check check (period_end >= period_start)
);

create index if not exists idx_financial_document_snapshots_lookup
  on public.financial_document_snapshots (
    agency_id, document_kind, entity_id, period_start, period_end, created_at desc
  );

alter table public.financial_document_snapshots enable row level security;
alter table public.financial_document_snapshots force row level security;

drop policy if exists financial_document_snapshots_select_tenant
  on public.financial_document_snapshots;
create policy financial_document_snapshots_select_tenant
  on public.financial_document_snapshots
  for select
  to authenticated
  using (
    agency_id = public.current_user_agency_id()
    or public.is_super_admin()
  );

revoke all on table public.financial_document_snapshots from public, anon, authenticated;
grant select on table public.financial_document_snapshots to authenticated;

create or replace function public.prevent_financial_document_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'FINANCIAL_DOCUMENT_SNAPSHOT_IMMUTABLE' using errcode = '55000';
end;
$$;

drop trigger if exists trg_financial_document_snapshot_immutable
  on public.financial_document_snapshots;
create trigger trg_financial_document_snapshot_immutable
before update or delete on public.financial_document_snapshots
for each row execute function public.prevent_financial_document_snapshot_mutation();

create or replace function public.fn_create_owner_report_snapshot(
  p_agency_id uuid,
  p_bailleur_id uuid,
  p_period_start date,
  p_period_end date,
  p_document_kind text default 'rapport_bailleur'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.user_profiles;
  v_owner_account boolean := false;
  v_effective_bailleur_id uuid;
  v_owner_summary jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_expenses jsonb := '[]'::jsonb;
  v_receivables jsonb := '[]'::jsonb;
  v_contracts jsonb := '[]'::jsonb;
  v_payload jsonb;
  v_fingerprint text;
  v_snapshot public.financial_document_snapshots;
begin
  if p_agency_id is null or p_period_start is null or p_period_end is null
     or p_period_end < p_period_start then
    raise exception 'FINANCE_INVALID_PERIOD' using errcode = '22023';
  end if;

  if p_document_kind not in ('rapport_bailleur', 'rapport_proprietaire') then
    raise exception 'FINANCE_DOCUMENT_KIND_INVALID' using errcode = '22023';
  end if;

  select up.* into v_profile
  from public.user_profiles up
  where up.id = v_actor
    and up.agency_id = p_agency_id
    and coalesce(up.actif, true) = true;

  if not found then
    raise exception 'FINANCE_FORBIDDEN' using errcode = '42501';
  end if;

  select coalesce(a.is_bailleur_account, false)
    into v_owner_account
  from public.agencies a
  where a.id = p_agency_id;

  if v_profile.role::text = 'bailleur' and not v_owner_account then
    if v_profile.bailleur_id is null then
      raise exception 'FINANCE_BAILLEUR_LINK_REQUIRED' using errcode = '42501';
    end if;
    if p_bailleur_id is not null and p_bailleur_id <> v_profile.bailleur_id then
      raise exception 'FINANCE_FORBIDDEN' using errcode = '42501';
    end if;
    v_effective_bailleur_id := v_profile.bailleur_id;
  else
    v_effective_bailleur_id := p_bailleur_id;
  end if;

  if v_effective_bailleur_id is null and v_owner_account then
    select b.id into v_effective_bailleur_id
    from public.bailleurs b
    where b.agency_id = p_agency_id
      and coalesce(b.actif, true) = true
    order by b.created_at asc
    limit 1;
  end if;

  if v_effective_bailleur_id is null or not exists (
    select 1 from public.bailleurs b
    where b.id = v_effective_bailleur_id
      and b.agency_id = p_agency_id
  ) then
    raise exception 'FINANCE_BAILLEUR_NOT_FOUND' using errcode = 'P0002';
  end if;

  select to_jsonb(summary_row)
    into v_owner_summary
  from public.fn_finance_owner_summary(
    p_agency_id,
    p_period_start,
    p_period_end + 1,
    v_effective_bailleur_id
  ) summary_row
  limit 1;

  if v_owner_summary is null then
    raise exception 'FINANCE_BAILLEUR_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(to_jsonb(payment_row) order by payment_row.date_paiement, payment_row.id), '[]'::jsonb)
    into v_payments
  from (
    select
      p.id,
      p.contrat_id,
      p.date_paiement,
      p.mois_concerne,
      p.montant_total,
      p.part_agence,
      p.part_bailleur,
      p.mode_paiement::text,
      p.reference,
      p.statut::text,
      c.loyer_mensuel,
      concat_ws(' ', nullif(l.prenom, ''), nullif(l.nom, '')) as locataire,
      u.nom as unite,
      i.nom as immeuble,
      i.adresse
    from public.paiements p
    join public.contrats c on c.id = p.contrat_id and c.agency_id = p_agency_id
    join public.locataires l on l.id = c.locataire_id and l.agency_id = p_agency_id
    join public.unites u on u.id = c.unite_id and u.agency_id = p_agency_id
    join public.immeubles i on i.id = u.immeuble_id and i.agency_id = p_agency_id
    where p.agency_id = p_agency_id
      and i.bailleur_id = v_effective_bailleur_id
      and p.statut in ('paye', 'partiel')
      and p.deleted_at is null
      and p.mois_concerne >= p_period_start
      and p.mois_concerne <= p_period_end
  ) payment_row;

  select coalesce(jsonb_agg(to_jsonb(expense_row) order by expense_row.date_depense, expense_row.id), '[]'::jsonb)
    into v_expenses
  from (
    select
      d.id,
      d.date_depense,
      d.categorie,
      d.description,
      d.beneficiaire,
      d.montant,
      d.piece_justificative,
      i.id as immeuble_id,
      i.nom as immeuble
    from public.depenses d
    join public.immeubles i on i.id = d.immeuble_id and i.agency_id = p_agency_id
    where d.agency_id = p_agency_id
      and i.bailleur_id = v_effective_bailleur_id
      and coalesce(d.actif, true) = true
      and d.deleted_at is null
      and d.date_depense >= p_period_start
      and d.date_depense <= p_period_end
  ) expense_row;

  select coalesce(jsonb_agg(to_jsonb(receivable_row) order by receivable_row.date_echeance, receivable_row.id), '[]'::jsonb)
    into v_receivables
  from (
    select
      r.id,
      r.contrat_id,
      r.locataire_nom,
      r.locataire_prenom,
      r.unite_nom,
      r.immeuble_nom,
      r.montant_attendu,
      r.montant_encaisse,
      r.montant_du,
      r.mois_concerne,
      r.date_echeance,
      r.statut
    from public.fn_finance_open_receivables(p_agency_id, p_period_start, p_period_end) r
    where r.bailleur_id = v_effective_bailleur_id
  ) receivable_row;

  select coalesce(jsonb_agg(to_jsonb(contract_row) order by contract_row.immeuble, contract_row.unite), '[]'::jsonb)
    into v_contracts
  from (
    with payment_totals as (
      select
        p.contrat_id,
        sum(p.montant_total)::numeric as encaisse,
        sum(p.part_agence)::numeric as commission,
        sum(p.part_bailleur)::numeric as part_bailleur
      from public.paiements p
      where p.agency_id = p_agency_id
        and p.statut in ('paye', 'partiel')
        and p.deleted_at is null
        and p.mois_concerne >= p_period_start
        and p.mois_concerne <= p_period_end
      group by p.contrat_id
    ), receivable_totals as (
      select r.contrat_id, sum(r.montant_du)::numeric as reliquat
      from public.fn_finance_open_receivables(p_agency_id, p_period_start, p_period_end) r
      where r.bailleur_id = v_effective_bailleur_id
      group by r.contrat_id
    )
    select
      c.id as contrat_id,
      i.id as immeuble_id,
      i.nom as immeuble,
      u.id as unite_id,
      u.nom as unite,
      concat_ws(' ', nullif(l.prenom, ''), nullif(l.nom, '')) as locataire,
      c.loyer_mensuel,
      coalesce(pt.encaisse, 0)::numeric as encaisse,
      coalesce(rt.reliquat, 0)::numeric as reliquat,
      coalesce(pt.commission, 0)::numeric as commission,
      coalesce(pt.part_bailleur, 0)::numeric as part_bailleur,
      c.statut::text
    from public.contrats c
    join public.locataires l on l.id = c.locataire_id and l.agency_id = p_agency_id
    join public.unites u on u.id = c.unite_id and u.agency_id = p_agency_id
    join public.immeubles i on i.id = u.immeuble_id and i.agency_id = p_agency_id
    left join payment_totals pt on pt.contrat_id = c.id
    left join receivable_totals rt on rt.contrat_id = c.id
    where c.agency_id = p_agency_id
      and i.bailleur_id = v_effective_bailleur_id
      and c.date_debut <= p_period_end
      and (c.date_fin is null or c.date_fin >= p_period_start)
  ) contract_row;

  v_payload := jsonb_build_object(
    'schemaVersion', 'owner_report_v1',
    'generatedAt', now(),
    'agencyId', p_agency_id,
    'bailleurId', v_effective_bailleur_id,
    'period', jsonb_build_object('start', p_period_start, 'end', p_period_end),
    'owner', jsonb_build_object(
      'id', v_owner_summary -> 'bailleur_id',
      'nom', v_owner_summary -> 'bailleur_nom',
      'prenom', v_owner_summary -> 'bailleur_prenom'
    ),
    'totals', jsonb_build_object(
      'collected', coalesce((v_owner_summary ->> 'loyers_encaisses')::numeric, 0),
      'arrears', coalesce((v_owner_summary ->> 'reliquats_ouverts')::numeric, 0),
      'commissions', coalesce((v_owner_summary ->> 'commissions_agence')::numeric, 0),
      'expenses', coalesce((v_owner_summary ->> 'depenses_total')::numeric, 0),
      'ownerShare', coalesce((v_owner_summary ->> 'net_bailleur')::numeric, 0),
      'netToPay', coalesce((v_owner_summary ->> 'net_bailleur')::numeric, 0)
                    - coalesce((v_owner_summary ->> 'depenses_total')::numeric, 0),
      'activeContracts', coalesce((v_owner_summary ->> 'contrats_actifs')::integer, 0),
      'recoveryRate', case
        when coalesce((v_owner_summary ->> 'loyers_encaisses')::numeric, 0)
           + coalesce((v_owner_summary ->> 'reliquats_ouverts')::numeric, 0) = 0 then 100
        else round(
          100 * coalesce((v_owner_summary ->> 'loyers_encaisses')::numeric, 0)
          / (
            coalesce((v_owner_summary ->> 'loyers_encaisses')::numeric, 0)
            + coalesce((v_owner_summary ->> 'reliquats_ouverts')::numeric, 0)
          )
        )
      end
    ),
    'contracts', v_contracts,
    'payments', v_payments,
    'expenses', v_expenses,
    'receivables', v_receivables
  );

  v_fingerprint := md5(v_payload::text);

  insert into public.financial_document_snapshots (
    agency_id, document_kind, entity_id, period_start, period_end,
    payload, payload_fingerprint, created_by
  ) values (
    p_agency_id, p_document_kind, v_effective_bailleur_id, p_period_start, p_period_end,
    v_payload, v_fingerprint, v_actor
  ) returning * into v_snapshot;

  return jsonb_build_object(
    'snapshotId', v_snapshot.id,
    'fingerprint', v_snapshot.payload_fingerprint,
    'createdAt', v_snapshot.created_at,
    'payload', v_snapshot.payload
  );
end;
$$;

create or replace function public.fn_create_payment_receipt_snapshot(
  p_agency_id uuid,
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.user_profiles;
  v_payment public.paiements;
  v_payload jsonb;
  v_fingerprint text;
  v_snapshot public.financial_document_snapshots;
  v_period_start date;
  v_period_end date;
  v_previous numeric := 0;
  v_paid_to_date numeric := 0;
  v_expected numeric := 0;
  v_remaining numeric := 0;
  v_context jsonb;
begin
  select up.* into v_profile
  from public.user_profiles up
  where up.id = v_actor
    and up.agency_id = p_agency_id
    and coalesce(up.actif, true) = true;

  if not found then
    raise exception 'FINANCE_FORBIDDEN' using errcode = '42501';
  end if;

  select p.* into v_payment
  from public.paiements p
  where p.id = p_payment_id
    and p.agency_id = p_agency_id
    and p.deleted_at is null
    and p.statut in ('paye', 'partiel');

  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not (
    v_profile.role::text in ('admin', 'comptable', 'agent')
    or (
      v_profile.role::text = 'bailleur'
      and exists (
        select 1
        from public.contrats c
        join public.unites u on u.id = c.unite_id
        join public.immeubles i on i.id = u.immeuble_id
        join public.agencies a on a.id = p_agency_id
        where c.id = v_payment.contrat_id
          and c.agency_id = p_agency_id
          and (coalesce(a.is_bailleur_account, false) or i.bailleur_id = v_profile.bailleur_id)
      )
    )
  ) then
    raise exception 'FINANCE_FORBIDDEN' using errcode = '42501';
  end if;

  v_period_start := date_trunc('month', v_payment.mois_concerne)::date;
  v_period_end := (date_trunc('month', v_payment.mois_concerne) + interval '1 month - 1 day')::date;

  select coalesce(sum(p.montant_total), 0)
    into v_previous
  from public.paiements p
  where p.agency_id = p_agency_id
    and p.contrat_id = v_payment.contrat_id
    and date_trunc('month', p.mois_concerne) = date_trunc('month', v_payment.mois_concerne)
    and p.statut in ('paye', 'partiel')
    and p.deleted_at is null
    and (p.created_at, p.id) < (v_payment.created_at, v_payment.id);

  v_paid_to_date := v_previous + v_payment.montant_total;

  select c.loyer_mensuel,
         jsonb_build_object(
           'contractId', c.id,
           'rent', c.loyer_mensuel,
           'tenant', jsonb_build_object('id', l.id, 'nom', l.nom, 'prenom', l.prenom),
           'unit', jsonb_build_object('id', u.id, 'nom', u.nom),
           'property', jsonb_build_object('id', i.id, 'nom', i.nom, 'adresse', i.adresse),
           'ownerId', i.bailleur_id
         )
    into v_expected, v_context
  from public.contrats c
  join public.locataires l on l.id = c.locataire_id and l.agency_id = p_agency_id
  join public.unites u on u.id = c.unite_id and u.agency_id = p_agency_id
  join public.immeubles i on i.id = u.immeuble_id and i.agency_id = p_agency_id
  where c.id = v_payment.contrat_id
    and c.agency_id = p_agency_id;

  if v_context is null then
    raise exception 'PAYMENT_CONTRACT_CONTEXT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_remaining := greatest(v_expected - v_paid_to_date, 0);
  v_payload := jsonb_build_object(
    'schemaVersion', 'payment_receipt_v1',
    'generatedAt', now(),
    'agencyId', p_agency_id,
    'payment', jsonb_build_object(
      'id', v_payment.id,
      'createdAt', v_payment.created_at,
      'date', v_payment.date_paiement,
      'period', v_payment.mois_concerne,
      'amount', v_payment.montant_total,
      'expected', v_expected,
      'previousPayments', v_previous,
      'paidToDate', v_paid_to_date,
      'remaining', v_remaining,
      'status', case when v_remaining > 0 then 'partiel' else 'solde' end,
      'mode', v_payment.mode_paiement::text,
      'reference', v_payment.reference,
      'agencyShare', v_payment.part_agence,
      'ownerShare', v_payment.part_bailleur
    ),
    'context', v_context
  );

  v_fingerprint := md5(v_payload::text);

  insert into public.financial_document_snapshots (
    agency_id, document_kind, entity_id, period_start, period_end,
    payload, payload_fingerprint, created_by
  ) values (
    p_agency_id,
    case when v_remaining > 0 then 'facture' else 'quittance' end,
    v_payment.id,
    v_period_start,
    v_period_end,
    v_payload,
    v_fingerprint,
    v_actor
  ) returning * into v_snapshot;

  return jsonb_build_object(
    'snapshotId', v_snapshot.id,
    'fingerprint', v_snapshot.payload_fingerprint,
    'createdAt', v_snapshot.created_at,
    'payload', v_snapshot.payload
  );
end;
$$;

revoke all on function public.fn_create_owner_report_snapshot(uuid, uuid, date, date, text)
  from public, anon;
revoke all on function public.fn_create_payment_receipt_snapshot(uuid, uuid)
  from public, anon;
grant execute on function public.fn_create_owner_report_snapshot(uuid, uuid, date, date, text)
  to authenticated;
grant execute on function public.fn_create_payment_receipt_snapshot(uuid, uuid)
  to authenticated;

comment on table public.financial_document_snapshots is
  'Immutable canonical payloads used to reproduce official financial PDFs.';
