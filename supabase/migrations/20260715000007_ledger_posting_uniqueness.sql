-- =============================================================================
-- Beta hardening: idempotent ledger posting and complete payment reversals.
-- =============================================================================

begin;

alter table public.ledger_entries
  add column if not exists posting_key text;

alter table public.ledger_entries
  drop constraint if exists ledger_entries_posting_key_format;

alter table public.ledger_entries
  add constraint ledger_entries_posting_key_format
  check (
    posting_key is null
    or posting_key ~ '^payment:[0-9a-f-]{36}:[a-z_]+$'
  );

create unique index if not exists uq_ledger_entries_posting_key
  on public.ledger_entries (posting_key)
  where posting_key is not null;

comment on column public.ledger_entries.posting_key is
  'Immutable idempotency key for server-generated ledger postings.';

create or replace function public.fn_post_payment_ledger(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.paiements%rowtype;
begin
  if p_payment_id is null then
    raise exception 'PAYMENT_ID_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_payment_id::text, 0));

  select *
    into v_payment
  from public.paiements
  where id = p_payment_id;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if v_payment.statut not in ('paye', 'partiel') then
    return;
  end if;

  if not exists (
    select 1
    from public.ledger_entries le
    where le.reference_type = 'paiements'
      and le.reference_id = v_payment.id
      and le.type = 'paiement'
      and le.direction = 'credit'
  ) then
    insert into public.ledger_entries (
      agency_id, type, direction, montant, reference_type, reference_id,
      description, created_by, posting_key
    ) values (
      v_payment.agency_id, 'paiement', 'credit', v_payment.montant_total,
      'paiements', v_payment.id, 'Paiement recu', v_payment.created_by,
      'payment:' || v_payment.id::text || ':cash'
    )
    on conflict (posting_key) where posting_key is not null do nothing;
  end if;

  if coalesce(v_payment.part_agence, 0) > 0 and not exists (
    select 1
    from public.ledger_entries le
    where le.reference_type = 'paiements'
      and le.reference_id = v_payment.id
      and le.type = 'commission'
      and le.direction = 'credit'
  ) then
    insert into public.ledger_entries (
      agency_id, type, direction, montant, reference_type, reference_id,
      description, created_by, posting_key
    ) values (
      v_payment.agency_id, 'commission', 'credit', v_payment.part_agence,
      'paiements', v_payment.id, 'Commission agence', v_payment.created_by,
      'payment:' || v_payment.id::text || ':commission'
    )
    on conflict (posting_key) where posting_key is not null do nothing;
  end if;

  if coalesce(v_payment.part_bailleur, 0) > 0 and not exists (
    select 1
    from public.ledger_entries le
    where le.reference_type = 'paiements'
      and le.reference_id = v_payment.id
      and le.type = 'part_bailleur'
      and le.direction = 'debit'
  ) then
    insert into public.ledger_entries (
      agency_id, type, direction, montant, reference_type, reference_id,
      description, created_by, posting_key
    ) values (
      v_payment.agency_id, 'part_bailleur', 'debit', v_payment.part_bailleur,
      'paiements', v_payment.id, 'Part bailleur a reverser', v_payment.created_by,
      'payment:' || v_payment.id::text || ':owner_share'
    )
    on conflict (posting_key) where posting_key is not null do nothing;
  end if;
end;
$$;

create or replace function public.fn_reverse_payment_ledger(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.paiements%rowtype;
begin
  if p_payment_id is null then
    raise exception 'PAYMENT_ID_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_payment_id::text, 0));

  select *
    into v_payment
  from public.paiements
  where id = p_payment_id;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if v_payment.statut <> 'annule' then
    raise exception 'PAYMENT_NOT_CANCELLED';
  end if;

  if exists (
    select 1 from public.ledger_entries le
    where le.reference_type = 'paiements'
      and le.reference_id = v_payment.id
      and le.type = 'paiement'
      and le.direction = 'credit'
  ) and not exists (
    select 1 from public.ledger_entries le
    where le.reference_type = 'paiements'
      and le.reference_id = v_payment.id
      and le.type = 'annulation'
      and le.direction = 'debit'
  ) then
    insert into public.ledger_entries (
      agency_id, type, direction, montant, reference_type, reference_id,
      description, created_by, posting_key
    ) values (
      v_payment.agency_id, 'annulation', 'debit', v_payment.montant_total,
      'paiements', v_payment.id, 'Annulation paiement', v_payment.created_by,
      'payment:' || v_payment.id::text || ':cancellation'
    )
    on conflict (posting_key) where posting_key is not null do nothing;
  end if;

  if coalesce(v_payment.part_agence, 0) > 0 and exists (
    select 1 from public.ledger_entries le
    where le.reference_type = 'paiements'
      and le.reference_id = v_payment.id
      and le.type = 'commission'
      and le.direction = 'credit'
  ) and not exists (
    select 1 from public.ledger_entries le
    where le.reference_type = 'paiements'
      and le.reference_id = v_payment.id
      and le.type = 'annulation_commission'
      and le.direction = 'debit'
  ) then
    insert into public.ledger_entries (
      agency_id, type, direction, montant, reference_type, reference_id,
      description, created_by, posting_key
    ) values (
      v_payment.agency_id, 'annulation_commission', 'debit', v_payment.part_agence,
      'paiements', v_payment.id, 'Annulation commission agence', v_payment.created_by,
      'payment:' || v_payment.id::text || ':commission_reversal'
    )
    on conflict (posting_key) where posting_key is not null do nothing;
  end if;

  if coalesce(v_payment.part_bailleur, 0) > 0 and exists (
    select 1 from public.ledger_entries le
    where le.reference_type = 'paiements'
      and le.reference_id = v_payment.id
      and le.type = 'part_bailleur'
      and le.direction = 'debit'
  ) and not exists (
    select 1 from public.ledger_entries le
    where le.reference_type = 'paiements'
      and le.reference_id = v_payment.id
      and le.type = 'annulation_part_bailleur'
      and le.direction = 'credit'
  ) then
    insert into public.ledger_entries (
      agency_id, type, direction, montant, reference_type, reference_id,
      description, created_by, posting_key
    ) values (
      v_payment.agency_id, 'annulation_part_bailleur', 'credit', v_payment.part_bailleur,
      'paiements', v_payment.id, 'Annulation part bailleur', v_payment.created_by,
      'payment:' || v_payment.id::text || ':owner_share_reversal'
    )
    on conflict (posting_key) where posting_key is not null do nothing;
  end if;
end;
$$;

create or replace function public.fn_after_paiement_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_post_payment_ledger(new.id);

  if new.statut in ('paye', 'partiel') then
    update public.agencies
       set first_payment_at = coalesce(first_payment_at, now())
     where id = new.agency_id;

    update public.agencies
       set activation_at = coalesce(activation_at, now()),
           pilot_status = case when pilot_status = 'trial' then 'pilot' else pilot_status end
     where id = new.agency_id
       and first_contract_at is not null;
  end if;

  return new;
end;
$$;

create or replace function public.fn_after_paiement_cash_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.statut not in ('paye', 'partiel') and new.statut in ('paye', 'partiel') then
    perform public.fn_post_payment_ledger(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.fn_after_paiement_cancel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.statut in ('paye', 'partiel') and new.statut = 'annule' then
    perform public.fn_reverse_payment_ledger(new.id);
  end if;
  return new;
end;
$$;

-- Complete historical cancellations additively. Existing immutable entries are
-- never updated or deleted; only missing component reversals are appended.
do $$
declare
  v_payment record;
begin
  for v_payment in
    select distinct p.id
    from public.paiements p
    join public.ledger_entries le
      on le.reference_type = 'paiements'
     and le.reference_id = p.id
    where p.statut = 'annule'
  loop
    perform public.fn_reverse_payment_ledger(v_payment.id);
  end loop;
end;
$$;

create or replace view public.vw_financial_drift_report
with (security_invoker = true)
as
select
  a.id as agency_id,
  a.name as agency_nom,
  coalesce(le.net_ledger_cash, 0) as ledger_total_credits,
  coalesce(pm.total_paiements_payes, 0) as paiements_total_payes,
  coalesce(le.net_ledger_cash, 0) - coalesce(pm.total_paiements_payes, 0) as ecart_reconciliation,
  now() as last_checked_at
from public.agencies a
left join (
  select
    agency_id,
    sum(
      case
        when type = 'paiement' and direction = 'credit' then montant
        when type = 'annulation' and direction = 'debit' then -montant
        else 0
      end
    ) as net_ledger_cash
  from public.ledger_entries
  where reference_type = 'paiements'
  group by agency_id
) le on le.agency_id = a.id
left join (
  select agency_id, sum(montant_total) as total_paiements_payes
  from public.paiements
  where statut in ('paye', 'partiel')
  group by agency_id
) pm on pm.agency_id = a.id
where a.id = coalesce(
  nullif(current_setting('request.jwt.claim.agency_id', true), '')::uuid,
  (select up.agency_id from public.user_profiles up where up.id = auth.uid())
);

revoke all on function public.fn_post_payment_ledger(uuid) from public, anon, authenticated;
revoke all on function public.fn_reverse_payment_ledger(uuid) from public, anon, authenticated;
grant execute on function public.fn_post_payment_ledger(uuid) to service_role;
grant execute on function public.fn_reverse_payment_ledger(uuid) to service_role;

revoke all on function public.fn_after_paiement_insert() from public, anon, authenticated;
revoke all on function public.fn_after_paiement_cash_transition() from public, anon, authenticated;
revoke all on function public.fn_after_paiement_cancel() from public, anon, authenticated;

comment on function public.fn_post_payment_ledger(uuid) is
  'Internal idempotent payment ledger writer. Serialized per payment.';
comment on function public.fn_reverse_payment_ledger(uuid) is
  'Internal idempotent payment reversal writer. Appends complete contra entries.';

commit;
