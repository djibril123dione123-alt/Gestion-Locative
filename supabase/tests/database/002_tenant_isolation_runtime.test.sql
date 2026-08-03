begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

insert into public.agencies (id, name, phone, email, plan, status)
values
  ('10000000-0000-0000-0000-000000000001', 'Tenant runtime A', '+221700000001', 'tenant-a-runtime@example.test', 'pro', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'Tenant runtime B', '+221700000002', 'tenant-b-runtime@example.test', 'pro', 'active');

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin-a-runtime@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nom":"Runtime","prenom":"Admin A","role":"admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin-b-runtime@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nom":"Runtime","prenom":"Admin B","role":"admin"}'::jsonb,
    now(),
    now()
  );

update public.user_profiles
set agency_id = '10000000-0000-0000-0000-000000000001', role = 'admin', actif = true
where id = '10000000-0000-0000-0000-000000000011';

update public.user_profiles
set agency_id = '20000000-0000-0000-0000-000000000002', role = 'admin', actif = true
where id = '20000000-0000-0000-0000-000000000022';

insert into public.bailleurs (
  id, nom, prenom, telephone, email, agency_id, created_by
)
values
  (
    '10000000-0000-0000-0000-000000000101',
    'Bailleur',
    'Tenant A',
    '+221710000001',
    'bailleur-a-runtime@example.test',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000011'
  ),
  (
    '20000000-0000-0000-0000-000000000202',
    'Bailleur',
    'Tenant B',
    '+221710000002',
    'bailleur-b-runtime@example.test',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000022'
  );

insert into public.depenses (
  id, montant, date_depense, categorie, description, agency_id, created_by
)
values
  (
    '10000000-0000-0000-0000-000000000301',
    1000,
    current_date,
    'runtime-test',
    'Depense tenant A',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000011'
  ),
  (
    '20000000-0000-0000-0000-000000000302',
    2000,
    current_date,
    'runtime-test',
    'Depense tenant B',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000022'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  public.current_user_agency_id(),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Tenant A actor resolves to tenant A'
);

select results_eq(
  $$select id from public.bailleurs where id in (
      '10000000-0000-0000-0000-000000000101'::uuid,
      '20000000-0000-0000-0000-000000000202'::uuid
    ) order by id$$,
  $$values ('10000000-0000-0000-0000-000000000101'::uuid)$$,
  'Tenant A reads only its bailleur'
);

select is_empty(
  $$select id from public.bailleurs
    where id = '20000000-0000-0000-0000-000000000202'::uuid$$,
  'Tenant A cannot read tenant B bailleur'
);

select results_eq(
  $$select id from public.depenses where id in (
      '10000000-0000-0000-0000-000000000301'::uuid,
      '20000000-0000-0000-0000-000000000302'::uuid
    ) order by id$$,
  $$values ('10000000-0000-0000-0000-000000000301'::uuid)$$,
  'Tenant A finance admin reads only its expense'
);

select is_empty(
  $$select id from public.depenses
    where id = '20000000-0000-0000-0000-000000000302'::uuid$$,
  'Tenant A cannot read tenant B expense'
);

select results_eq(
  $$select distinct record_id from public.audit_logs
    where table_name = 'bailleurs'
      and record_id in (
        '10000000-0000-0000-0000-000000000101'::uuid,
        '20000000-0000-0000-0000-000000000202'::uuid
      )
    order by record_id$$,
  $$values ('10000000-0000-0000-0000-000000000101'::uuid)$$,
  'Tenant A admin reads only tenant A audit entries'
);

select is_empty(
  $$select id from public.audit_logs
    where record_id = '20000000-0000-0000-0000-000000000202'::uuid$$,
  'Tenant A cannot read tenant B audit entries'
);

select is_empty(
  $$update public.bailleurs
       set notes = 'cross-tenant mutation must not happen'
     where id = '20000000-0000-0000-0000-000000000202'::uuid
     returning id$$,
  'Tenant A cannot update tenant B bailleur'
);

select results_eq(
  $$update public.bailleurs
       set notes = 'own tenant mutation is allowed'
     where id = '10000000-0000-0000-0000-000000000101'::uuid
     returning id$$,
  $$values ('10000000-0000-0000-0000-000000000101'::uuid)$$,
  'Tenant A can update its own bailleur'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000022', true);

select is(
  public.current_user_agency_id(),
  '20000000-0000-0000-0000-000000000002'::uuid,
  'Tenant B actor resolves to tenant B'
);

select results_eq(
  $$select id from public.bailleurs where id in (
      '10000000-0000-0000-0000-000000000101'::uuid,
      '20000000-0000-0000-0000-000000000202'::uuid
    ) order by id$$,
  $$values ('20000000-0000-0000-0000-000000000202'::uuid)$$,
  'Tenant B reads only its bailleur'
);

select is_empty(
  $$select id from public.bailleurs
    where id = '10000000-0000-0000-0000-000000000101'::uuid$$,
  'Tenant B cannot read tenant A bailleur'
);

select * from finish();
rollback;
