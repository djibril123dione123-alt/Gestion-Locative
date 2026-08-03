begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(102);

select ok(
  (
    select bool_and(c.relrowsecurity and c.relforcerowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(array[
        'agencies', 'user_profiles', 'bailleurs', 'immeubles', 'unites',
        'locataires', 'contrats', 'paiements', 'revenus', 'depenses',
        'ledger_entries', 'document_registry', 'document_verifications',
        'financial_document_snapshots', 'subscriptions', 'audit_logs',
        'subscription_payment_proofs', 'invitations', 'user_page_permissions',
        'event_log', 'event_outbox', 'job_queue'
      ])
  ),
  'RLS is enabled and forced on every critical tenant table'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(array[
        'agencies', 'user_profiles', 'bailleurs', 'immeubles', 'unites',
        'locataires', 'contrats', 'paiements', 'revenus', 'depenses',
        'ledger_entries', 'document_registry', 'document_verifications',
        'financial_document_snapshots', 'subscriptions', 'audit_logs',
        'subscription_payment_proofs', 'invitations', 'user_page_permissions',
        'event_log', 'event_outbox', 'job_queue'
      ])
  ),
  22,
  'All critical tenant tables are present'
);

select ok(not has_table_privilege('authenticated', 'public.contrats', 'INSERT'), 'Browser cannot insert contracts directly');
select ok(not has_table_privilege('authenticated', 'public.contrats', 'UPDATE'), 'Browser cannot update contracts directly');
select ok(not has_table_privilege('authenticated', 'public.contrats', 'DELETE'), 'Browser cannot delete contracts directly');
select ok(not has_table_privilege('authenticated', 'public.paiements', 'INSERT'), 'Browser cannot insert payments directly');
select ok(not has_table_privilege('authenticated', 'public.paiements', 'UPDATE'), 'Browser cannot update payments directly');
select ok(not has_table_privilege('authenticated', 'public.paiements', 'DELETE'), 'Browser cannot delete payments directly');
select ok(not has_table_privilege('authenticated', 'public.depenses', 'INSERT'), 'Browser cannot insert expenses directly');
select ok(not has_table_privilege('authenticated', 'public.depenses', 'UPDATE'), 'Browser cannot update expenses directly');
select ok(not has_table_privilege('authenticated', 'public.depenses', 'DELETE'), 'Browser cannot delete expenses directly');
select ok(not has_table_privilege('authenticated', 'public.revenus', 'INSERT'), 'Browser cannot insert legacy revenues directly');
select ok(not has_table_privilege('authenticated', 'public.revenus', 'UPDATE'), 'Browser cannot update legacy revenues directly');
select ok(not has_table_privilege('authenticated', 'public.revenus', 'DELETE'), 'Browser cannot delete legacy revenues directly');
select ok(not has_table_privilege('authenticated', 'public.audit_logs', 'INSERT'), 'Browser cannot insert business audit logs directly');
select ok(not has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE'), 'Browser cannot update business audit logs directly');
select ok(not has_table_privilege('authenticated', 'public.audit_logs', 'DELETE'), 'Browser cannot delete business audit logs directly');
select ok(not has_table_privilege('authenticated', 'public.event_log', 'INSERT'), 'Browser cannot insert domain events directly');
select ok(not has_table_privilege('authenticated', 'public.event_log', 'UPDATE'), 'Browser cannot alter domain events directly');
select ok(not has_table_privilege('authenticated', 'public.event_log', 'DELETE'), 'Browser cannot delete domain events directly');
select ok(not has_table_privilege('authenticated', 'public.event_outbox', 'INSERT'), 'Browser cannot insert outbox events directly');
select ok(not has_table_privilege('authenticated', 'public.event_outbox', 'UPDATE'), 'Browser cannot alter outbox events directly');
select ok(not has_table_privilege('authenticated', 'public.event_outbox', 'DELETE'), 'Browser cannot delete outbox events directly');
select ok(not has_table_privilege('authenticated', 'public.job_queue', 'INSERT'), 'Browser cannot enqueue jobs directly');
select ok(not has_table_privilege('authenticated', 'public.job_queue', 'UPDATE'), 'Browser cannot alter queued jobs directly');
select ok(not has_table_privilege('authenticated', 'public.job_queue', 'DELETE'), 'Browser cannot delete queued jobs directly');
select ok(not has_table_privilege('authenticated', 'public.ledger_entries', 'INSERT'), 'Browser cannot insert ledger entries directly');
select ok(not has_table_privilege('authenticated', 'public.ledger_entries', 'UPDATE'), 'Browser cannot update ledger entries directly');
select ok(not has_table_privilege('authenticated', 'public.ledger_entries', 'DELETE'), 'Browser cannot delete ledger entries directly');
select ok(not has_table_privilege('authenticated', 'public.subscriptions', 'INSERT'), 'Browser cannot create subscriptions directly');
select ok(not has_table_privilege('authenticated', 'public.subscriptions', 'UPDATE'), 'Browser cannot update subscriptions directly');
select ok(not has_table_privilege('authenticated', 'public.subscriptions', 'DELETE'), 'Browser cannot delete subscriptions directly');

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'depenses'
      and policyname = 'depenses_tenant_finance_read'
      and qual ilike '%agency_id%current_user_agency_id%'
  ),
  'Expense reads are tenant scoped'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'revenus'
      and policyname = 'revenus_tenant_finance_read'
      and qual ilike '%paiements%agency_id%current_user_agency_id%'
  ),
  'Legacy revenue reads inherit the tenant from their payment'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_logs'
      and policyname = 'audit_logs_tenant_admin_read'
      and qual ilike '%agency_id%current_user_agency_id%'
  ),
  'Business audit reads are tenant scoped'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_log'
      and policyname = 'event_log_tenant_admin_read'
      and qual ilike '%agency_id%current_user_agency_id%'
  ),
  'Domain event reads are tenant scoped'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_outbox'
      and policyname = 'event_outbox_tenant_admin_read'
      and qual ilike '%agency_id%current_user_agency_id%'
  ),
  'Outbox reads are tenant scoped'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'job_queue'
      and policyname = 'job_queue_tenant_admin_read'
      and qual ilike '%agency_id%current_user_agency_id%'
  ),
  'Job queue reads are tenant scoped'
);

select ok(
  not has_function_privilege('authenticated', 'public.fn_create_paiement_financial(uuid,uuid,uuid,numeric,date,date,text,text,text,text,text)', 'EXECUTE'),
  'Authenticated clients cannot call the service-only payment writer'
);
select ok(
  not has_function_privilege('authenticated', 'public.fn_post_payment_ledger(uuid)', 'EXECUTE'),
  'Authenticated clients cannot call the internal ledger writer'
);
select ok(
  not has_function_privilege('authenticated', 'public.fn_reverse_payment_ledger(uuid)', 'EXECUTE'),
  'Authenticated clients cannot call the internal ledger reversal'
);
select ok(
  has_function_privilege('authenticated', 'public.fn_create_contrat_command(uuid,uuid,uuid,uuid,date,date,numeric,numeric,numeric,text,boolean)', 'EXECUTE'),
  'Authenticated clients can use the guarded contract creation command'
);
select ok(
  has_function_privilege('authenticated', 'public.fn_update_contrat_command(uuid,uuid,uuid,jsonb)', 'EXECUTE'),
  'Authenticated clients can use the guarded contract update command'
);
select ok(
  has_function_privilege('authenticated', 'public.fn_renew_contrat_command(uuid,uuid,uuid,date,numeric,text)', 'EXECUTE'),
  'Authenticated clients can use the guarded contract renewal command'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'ledger_entries'
      and indexname = 'uq_ledger_entries_posting_key'
      and indexdef ilike 'create unique index%'
  ),
  'Ledger posting keys are protected by a unique index'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'paiements'
      and column_name = 'idempotency_payload'
      and data_type = 'jsonb'
  ),
  'Payments retain the canonical idempotency payload'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'paiements'
      and indexdef ilike '%idempotency_key%'
      and indexdef ilike 'create unique index%'
  ),
  'Payment idempotency keys are protected by a unique index'
);

select ok(
  exists (
    select 1 from storage.buckets
    where id = 'agency-assets'
      and public is false
      and file_size_limit = 2097152
      and allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']::text[]
  ),
  'Agency identity assets use a private, bounded image bucket'
);
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in ('agency_assets_identity_insert', 'agency_assets_identity_update', 'agency_assets_identity_delete')
  ),
  'Authenticated clients receive no direct identity-asset write policy'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'agency_assets_identity_read'
      and qual ilike '%current_user_agency_id%'
  ),
  'Identity-asset reads are tenant scoped'
);

select ok(
  has_function_privilege('authenticated', 'public.register_document_verification_command(uuid,text,text,text,timestamptz,numeric,text,text,jsonb)', 'EXECUTE'),
  'Authenticated clients can use the guarded verification registration command'
);
select ok(
  has_function_privilege('authenticated', 'public.revoke_document_verification_command(uuid,text)', 'EXECUTE'),
  'Authenticated clients can use the guarded verification revocation command'
);
select ok(
  not has_table_privilege('authenticated', 'public.document_verifications', 'INSERT'),
  'Browser cannot insert document verifications directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.document_verifications', 'UPDATE'),
  'Browser cannot update document verifications directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.document_registry', 'UPDATE'),
  'Browser cannot update the document registry directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.financial_document_snapshots', 'INSERT'),
  'Browser cannot create financial snapshots directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.fn_finalize_managed_document(uuid,text,text)',
    'EXECUTE'
  ),
  'Browser cannot finalize managed documents with a client supplied hash'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.fn_finalize_managed_document_server(uuid,text,text,uuid,uuid)',
    'EXECUTE'
  ),
  'Browser cannot invoke the service-only document finalizer'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.fn_finalize_managed_document_server(uuid,text,text,uuid,uuid)',
    'EXECUTE'
  ),
  'Service role can finalize a server-hashed managed document'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.fn_create_owner_report_snapshot_authorized_impl(uuid,uuid,date,date,text)',
    'EXECUTE'
  ),
  'Browser cannot bypass owner report snapshot authorization'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.fn_create_payment_receipt_snapshot_authorized_impl(uuid,uuid)',
    'EXECUTE'
  ),
  'Browser cannot bypass receipt snapshot authorization'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.fn_create_owner_report_snapshot(uuid,uuid,date,date,text)',
    'EXECUTE'
  ),
  'Authenticated users retain the guarded owner report snapshot command'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.fn_create_payment_receipt_snapshot(uuid,uuid)',
    'EXECUTE'
  ),
  'Authenticated users retain the guarded receipt snapshot command'
);

select ok(not has_table_privilege('authenticated', 'public.invitations', 'INSERT'), 'Browser cannot create invitations directly');
select ok(not has_table_privilege('authenticated', 'public.invitations', 'UPDATE'), 'Browser cannot alter invitations directly');
select ok(not has_table_privilege('authenticated', 'public.invitations', 'DELETE'), 'Browser cannot delete invitations directly');
select ok(not has_table_privilege('authenticated', 'public.user_page_permissions', 'INSERT'), 'Browser cannot create page permissions directly');
select ok(not has_table_privilege('authenticated', 'public.user_page_permissions', 'UPDATE'), 'Browser cannot alter page permissions directly');
select ok(not has_table_privilege('authenticated', 'public.user_page_permissions', 'DELETE'), 'Browser cannot delete page permissions directly');
select ok(not has_table_privilege('authenticated', 'public.subscription_payment_proofs', 'INSERT'), 'Browser cannot submit payment proofs directly');
select ok(not has_table_privilege('authenticated', 'public.subscription_payment_proofs', 'UPDATE'), 'Browser cannot alter payment proofs directly');
select ok(not has_table_privilege('authenticated', 'public.subscription_payment_proofs', 'DELETE'), 'Browser cannot delete payment proofs directly');

select ok(
  has_function_privilege('authenticated', 'public.tenant_create_invitation(text,text,text,integer,text)', 'EXECUTE'),
  'Authenticated agency admins can use the guarded invitation command'
);
select ok(
  has_function_privilege('authenticated', 'public.tenant_replace_user_page_permissions(uuid,jsonb,text)', 'EXECUTE'),
  'Authenticated agency admins can use the guarded permission command'
);
select ok(
  has_function_privilege('authenticated', 'public.tenant_deactivate_member(uuid,text,text)', 'EXECUTE'),
  'Authenticated agency admins can use the guarded deactivation command'
);
select ok(
  has_function_privilege('authenticated', 'public.tenant_submit_subscription_payment_proof(uuid,text,numeric,text,text,date,text,text,text)', 'EXECUTE'),
  'Authenticated agency admins can use the guarded proof command'
);
select ok(
  has_function_privilege('authenticated', 'public.accept_invitation(text)', 'EXECUTE'),
  'Authenticated recipients can use the guarded invitation acceptance command'
);
select ok(
  (
    select c.relrowsecurity and c.relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'samay_tenant' and c.relname = 'command_idempotency'
  ),
  'Tenant command idempotency state has forced RLS'
);
select ok(
  not has_table_privilege('authenticated', 'samay_tenant.command_idempotency', 'SELECT'),
  'Authenticated clients cannot inspect command idempotency state'
);

select ok(
  has_function_privilege('authenticated', 'public.tenant_complete_onboarding(text,text,text,text,text,text,text,timestamptz,text)', 'EXECUTE'),
  'Authenticated agency admins can use the guarded onboarding command'
);
select ok(
  has_function_privilege('authenticated', 'public.tenant_mark_onboarding_complete(timestamptz,text)', 'EXECUTE'),
  'Authenticated agency admins can use the guarded deferred onboarding command'
);
select ok(
  has_function_privilege('authenticated', 'public.tenant_update_owner_profile(text,text,text,text,text,text,uuid,text)', 'EXECUTE'),
  'Authenticated tenant owners can use the guarded owner profile command'
);
select ok(
  has_function_privilege('authenticated', 'public.tenant_accept_legal_terms(timestamptz,timestamptz,text,text)', 'EXECUTE'),
  'Authenticated users can use the guarded legal acceptance command'
);
select ok(
  has_function_privilege('authenticated', 'public.tenant_mark_demo_data_loaded(text)', 'EXECUTE'),
  'Authenticated agency admins can use the guarded demo-state command'
);

select ok(
  not has_function_privilege('anon', 'public.tenant_complete_onboarding(text,text,text,text,text,text,text,timestamptz,text)', 'EXECUTE'),
  'Anonymous clients cannot complete tenant onboarding'
);
select ok(
  not has_function_privilege('anon', 'public.tenant_mark_onboarding_complete(timestamptz,text)', 'EXECUTE'),
  'Anonymous clients cannot mark onboarding complete'
);
select ok(
  not has_function_privilege('anon', 'public.tenant_update_owner_profile(text,text,text,text,text,text,uuid,text)', 'EXECUTE'),
  'Anonymous clients cannot update an owner profile'
);
select ok(
  not has_function_privilege('anon', 'public.tenant_accept_legal_terms(timestamptz,timestamptz,text,text)', 'EXECUTE'),
  'Anonymous clients cannot record legal acceptance'
);
select ok(
  not has_function_privilege('anon', 'public.tenant_mark_demo_data_loaded(text)', 'EXECUTE'),
  'Anonymous clients cannot mutate demo state'
);
select ok(
  not has_function_privilege('authenticated', 'samay_tenant.assert_tenant_actor()', 'EXECUTE'),
  'Authenticated clients cannot invoke the private tenant assertion helper'
);

select ok(
  has_function_privilege('authenticated', 'public.check_plan_limits(uuid)', 'EXECUTE'),
  'Authenticated clients can read their guarded plan limits'
);
select ok(
  pg_get_functiondef('public.check_plan_limits(uuid)'::regprocedure) ilike '%current_user_agency_id%',
  'Plan limit reads enforce the current tenant scope server-side'
);
select ok(
  not has_function_privilege('anon', 'public.check_plan_limits(uuid)', 'EXECUTE'),
  'Anonymous clients cannot inspect plan limits'
);

select ok(not has_function_privilege('authenticated', 'public.archive_document_registry_duplicates(uuid)', 'EXECUTE'), 'Browser cannot call duplicate archival directly');
select ok(not has_function_privilege('authenticated', 'public.mark_expired_temporary_documents(uuid)', 'EXECUTE'), 'Browser cannot mark expired documents directly');
select ok(not has_function_privilege('authenticated', 'public.mark_orphan_document_records(uuid)', 'EXECUTE'), 'Browser cannot mark orphan documents directly');
select ok(not has_function_privilege('authenticated', 'public.cleanup_temporary_documents(uuid,integer)', 'EXECUTE'), 'Browser cannot clean temporary documents directly');
select ok(not has_function_privilege('authenticated', 'public.optimize_document_storage(uuid)', 'EXECUTE'), 'Browser cannot optimize storage directly');

select ok(has_function_privilege('authenticated', 'public.tenant_mark_orphan_document_records(uuid)', 'EXECUTE'), 'Agency admins can use the guarded orphan command');
select ok(has_function_privilege('authenticated', 'public.tenant_cleanup_temporary_documents(uuid,integer)', 'EXECUTE'), 'Agency admins can use the guarded cleanup command');
select ok(has_function_privilege('authenticated', 'public.tenant_optimize_document_storage(uuid)', 'EXECUTE'), 'Agency admins can use the guarded optimization command');
select ok(
  not has_function_privilege('authenticated', 'samay_tenant.assert_document_maintenance_admin(uuid)', 'EXECUTE'),
  'Authenticated clients cannot invoke the private document maintenance assertion'
);

select * from finish();
rollback;
