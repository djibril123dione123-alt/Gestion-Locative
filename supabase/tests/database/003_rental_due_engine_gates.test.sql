begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(40);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(array[
        'contract_billing_settings', 'rental_dues', 'rental_due_lines',
        'payment_allocations', 'rental_account_credits',
        'rental_credit_movements', 'rental_due_documents',
        'rental_due_deliveries', 'rental_due_reminders', 'rental_due_events'
      ])
  ),
  10,
  'All canonical rental due tables are present'
);

select ok(
  (
    select bool_and(c.relrowsecurity and c.relforcerowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(array[
        'contract_billing_settings', 'rental_dues', 'rental_due_lines',
        'payment_allocations', 'rental_account_credits',
        'rental_credit_movements', 'rental_due_documents',
        'rental_due_deliveries', 'rental_due_reminders', 'rental_due_events'
      ])
  ),
  'RLS is enabled and forced on the canonical rental due tables'
);

select ok(has_table_privilege('authenticated', 'public.rental_dues', 'SELECT'), 'Authenticated users can read tenant-scoped rental dues');
select ok(not has_table_privilege('authenticated', 'public.rental_dues', 'INSERT'), 'Browser cannot insert rental dues');
select ok(not has_table_privilege('authenticated', 'public.rental_dues', 'UPDATE'), 'Browser cannot update rental dues');
select ok(not has_table_privilege('authenticated', 'public.rental_dues', 'DELETE'), 'Browser cannot delete rental dues');

select ok(not has_table_privilege('authenticated', 'public.rental_due_lines', 'INSERT'), 'Browser cannot insert rental due lines');
select ok(not has_table_privilege('authenticated', 'public.rental_due_lines', 'UPDATE'), 'Browser cannot update rental due lines');
select ok(not has_table_privilege('authenticated', 'public.rental_due_lines', 'DELETE'), 'Browser cannot delete rental due lines');

select ok(not has_table_privilege('authenticated', 'public.payment_allocations', 'INSERT'), 'Browser cannot insert payment allocations');
select ok(not has_table_privilege('authenticated', 'public.payment_allocations', 'UPDATE'), 'Browser cannot update payment allocations');
select ok(not has_table_privilege('authenticated', 'public.payment_allocations', 'DELETE'), 'Browser cannot delete payment allocations');

select ok(not has_table_privilege('authenticated', 'public.rental_account_credits', 'INSERT'), 'Browser cannot create rental credits');
select ok(not has_table_privilege('authenticated', 'public.rental_account_credits', 'UPDATE'), 'Browser cannot alter rental credit balances');
select ok(not has_table_privilege('authenticated', 'public.rental_credit_movements', 'INSERT'), 'Browser cannot post rental credit movements');

select ok(not has_table_privilege('authenticated', 'public.rental_due_documents', 'INSERT'), 'Browser cannot prepare due documents directly');
select ok(not has_table_privilege('authenticated', 'public.rental_due_documents', 'UPDATE'), 'Browser cannot issue due documents directly');
select ok(not has_table_privilege('authenticated', 'public.rental_due_deliveries', 'INSERT'), 'Browser cannot forge document deliveries');
select ok(not has_table_privilege('authenticated', 'public.rental_due_reminders', 'INSERT'), 'Browser cannot schedule reminders directly');
select ok(not has_table_privilege('authenticated', 'public.rental_due_events', 'INSERT'), 'Browser cannot forge rental due events');

select ok(
  not has_function_privilege(
    'authenticated',
    'public.fn_prepare_rental_due_document_command(uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  'Document preparation remains service-only'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.fn_prepare_rental_due_document_command(uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  'Service role can prepare canonical due documents'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.fn_cancel_rental_due_command(uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  'Due cancellation remains service-only'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.fn_record_rental_due_delivery_command(uuid,uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'Delivery recording remains service-only'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.fn_rental_due_dashboard_summary(uuid,date)',
    'EXECUTE'
  ),
  'Authenticated clients can call the guarded dashboard read model'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.fn_owner_rental_due_summary(uuid,uuid,date,date)',
    'EXECUTE'
  ),
  'Authenticated clients can call the guarded owner read model'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.fn_owner_rental_due_summary(uuid,uuid,date,date)',
    'EXECUTE'
  ),
  'Anonymous clients cannot read owner financial summaries'
);

select is(
  (
    select count(*)::integer
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and t.tgname = 'trg_validate_rental_due_scope'
      and not t.tgisinternal
  ),
  9,
  'Every rental due child table has the tenant integrity trigger'
);

select ok(
  pg_get_functiondef('public.fn_prepare_rental_due_document_command(uuid,uuid,uuid,text)'::regprocedure)
    like '%CREDIT_NOTE_REQUIRES_ISSUED_BILL%',
  'Credit notes require an issued bill'
);
select ok(
  pg_get_functiondef('public.fn_prepare_rental_due_document_command(uuid,uuid,uuid,text)'::regprocedure)
    like '%CREDIT_NOTE_ALREADY_ISSUED%',
  'A second issued credit note is rejected'
);
select ok(
  pg_get_functiondef('public.fn_prepare_rental_due_document_command(uuid,uuid,uuid,text)'::regprocedure)
    like '%DUE_DOCUMENT_CANCELLED%',
  'Cancelled dues cannot produce new documents'
);
select ok(
  pg_get_functiondef('public.fn_prepare_rental_due_document_command(uuid,uuid,uuid,text)'::regprocedure)
    like '%PARTIAL_RECEIPT_REQUIRES_PARTIAL_DUE%',
  'Partial receipts require a partially paid due'
);
select ok(
  pg_get_functiondef('public.fn_prepare_rental_due_document_command(uuid,uuid,uuid,text)'::regprocedure)
    like '%RENT_RECEIPT_REQUIRES_PAID_DUE%',
  'Rent receipts require a paid due'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_allocations'
      and indexdef ilike 'create unique index%posting_key%'
  ),
  'Payment allocation posting keys are unique'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'rental_credit_movements'
      and indexdef ilike 'create unique index%posting_key%'
  ),
  'Credit movement posting keys are unique'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'rental_due_events'
      and indexname = 'rental_due_events_event_key_unique'
  ),
  'Rental due event keys are idempotent'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'rental_due_documents'
      and indexdef ilike 'create unique index%due_id%document_type%version%'
  ),
  'Document versions are unique per due and type'
);

select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'validate_rental_due_scope'
      and p.prosecdef = false
  ),
  'Scope validation runs as invoker and exposes no definer privilege'
);
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'fn_rental_due_dashboard_summary'
      and p.prosecdef = true
      and p.provolatile = 's'
  ),
  'Dashboard summary is a stable guarded definer read model'
);
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'fn_owner_rental_due_summary'
      and p.prosecdef = true
      and p.provolatile = 's'
  ),
  'Owner summary is a stable guarded definer read model'
);

select * from finish();
rollback;
