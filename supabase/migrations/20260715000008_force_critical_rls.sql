-- =============================================================================
-- Beta hardening: force tenant isolation on critical business records.
-- =============================================================================

begin;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'agencies',
    'user_profiles',
    'bailleurs',
    'immeubles',
    'unites',
    'locataires',
    'contrats',
    'paiements',
    'revenus',
    'depenses',
    'ledger_entries',
    'document_registry',
    'document_verifications',
    'financial_document_snapshots',
    'subscriptions',
    'subscription_payment_proofs'
  ] loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'Critical table public.% is missing', v_table;
    end if;

    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
  end loop;
end
$$;

-- The browser receives read-only access to the immutable ledger. Inserts are
-- produced by server-owned payment/dependency commands and trigger functions.
revoke insert, update, delete, truncate, references, trigger
  on table public.ledger_entries from authenticated;
grant select on table public.ledger_entries to authenticated;

-- Remove the historical permissive INSERT policy. SECURITY DEFINER commands
-- and the service role do not need an authenticated-client policy.
drop policy if exists "ledger_insert_service" on public.ledger_entries;

commit;

