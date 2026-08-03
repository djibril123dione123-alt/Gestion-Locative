begin;

alter table public.user_profiles
  add column if not exists accepted_terms_at timestamptz,
  add column if not exists accepted_privacy_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists privacy_version text;

alter function public.tenant_create_invitation(text, text, text, integer, text)
  set search_path = public, extensions, pg_temp;

alter function public.tenant_complete_onboarding(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text
)
  set search_path = public, extensions, pg_temp;

alter function public.tenant_update_owner_profile(
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text
)
  set search_path = public, extensions, pg_temp;

drop rule if exists ledger_no_update on public.ledger_entries;
drop rule if exists ledger_no_delete on public.ledger_entries;

create or replace function public.fn_prevent_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('samay.allow_ledger_mutation', true) = 'agency_closure'
     and public.is_super_admin() then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  raise exception 'ledger_entries is append-only'
    using errcode = '42501';
end;
$$;

revoke all on function public.fn_prevent_ledger_mutation() from public;
revoke all on function public.fn_prevent_ledger_mutation() from anon;
revoke all on function public.fn_prevent_ledger_mutation() from authenticated;

drop trigger if exists ledger_prevent_mutation on public.ledger_entries;
create trigger ledger_prevent_mutation
before update or delete on public.ledger_entries
for each row
execute function public.fn_prevent_ledger_mutation();

do $repair_delete_agency$
declare
  v_definition text;
  v_old_start constant text := E'begin\n  if p_agency_id is null then';
  v_new_start constant text := E'begin\n  perform set_config(''samay.allow_ledger_mutation'', ''agency_closure'', true);\n\n  if p_agency_id is null then';
  v_old_loop constant text := 'foreach v_table in array array[';
  v_new_loop constant text := E'for v_table in\n    select unnest(array[';
  v_old_loop_end constant text := E'    ''user_profiles''\n  ]\n  loop';
  v_new_loop_end constant text := E'      ''user_profiles''\n    ]::text[])\n  loop';
begin
  select pg_get_functiondef(
    'public.delete_agency_cascade(uuid,text)'::regprocedure
  )
  into v_definition;

  v_definition := replace(v_definition, E'\r\n', E'\n');

  if position(v_old_start in v_definition) = 0
     or position(v_old_loop in v_definition) = 0
     or position(v_old_loop_end in v_definition) = 0 then
    raise exception 'Unexpected delete_agency_cascade definition; refusing an unsafe rewrite';
  end if;

  v_definition := replace(v_definition, v_old_start, v_new_start);
  v_definition := replace(v_definition, v_old_loop, v_new_loop);
  v_definition := replace(v_definition, v_old_loop_end, v_new_loop_end);
  execute v_definition;
end;
$repair_delete_agency$;

do $repair_reset_demo$
declare
  v_definition text;
  v_table text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.reset_demo_data(uuid)'::regprocedure
  )
  into v_definition;

  v_definition := replace(v_definition, E'\r\n', E'\n');

  foreach v_table in array array[
    'bailleurs',
    'immeubles',
    'unites',
    'locataires',
    'contrats',
    'paiements'
  ]
  loop
    v_old := format(
      'create temporary table if not exists pg_temp.demo_%1$s(id uuid primary key) on commit drop;',
      v_table
    );
    v_new := format(
      'execute ''create temporary table if not exists pg_temp.demo_%1$s(id uuid primary key) on commit drop'';',
      v_table
    );
    if position(v_old in v_definition) = 0 then
      raise exception 'Unexpected reset_demo_data definition for create temp table %', v_table;
    end if;
    v_definition := replace(v_definition, v_old, v_new);

    v_old := format('truncate pg_temp.demo_%s;', v_table);
    v_new := format('execute ''truncate pg_temp.demo_%s'';', v_table);
    if position(v_old in v_definition) = 0 then
      raise exception 'Unexpected reset_demo_data definition for truncate %', v_table;
    end if;
    v_definition := replace(v_definition, v_old, v_new);

    v_old := format(
      E'insert into pg_temp.demo_%1$s(id)\n  select id from public.%1$s\n  where agency_id = p_agency_id and is_demo_data = true;',
      v_table
    );
    v_new := format(
      E'execute ''insert into pg_temp.demo_%1$s(id)\n    select id from public.%1$s where agency_id = $1 and is_demo_data = true''\n    using p_agency_id;',
      v_table
    );
    if position(v_old in v_definition) = 0 then
      raise exception 'Unexpected reset_demo_data definition for snapshot %', v_table;
    end if;
    v_definition := replace(v_definition, v_old, v_new);

    v_old := format(
      E'delete from public.%1$s\n  where agency_id = p_agency_id\n    and id in (select id from pg_temp.demo_%1$s);',
      v_table
    );
    v_new := format(
      E'execute ''delete from public.%1$s\n    where agency_id = $1\n      and id in (select id from pg_temp.demo_%1$s)''\n    using p_agency_id;',
      v_table
    );
    if position(v_old in v_definition) = 0 then
      raise exception 'Unexpected reset_demo_data definition for delete %', v_table;
    end if;
    v_definition := replace(v_definition, v_old, v_new);
  end loop;

  execute v_definition;
end;
$repair_reset_demo$;

drop function if exists public.validate_ledger_integrity(uuid, text);
drop function if exists public.export_certified_ledger(uuid, text);
drop function if exists public.get_commission_breakdown(uuid, text);
drop function if exists public.get_monthly_ledger(uuid, integer);
drop function if exists public.get_baileur_revenue_breakdown(uuid);
drop function if exists public.get_financial_kpis(uuid);
drop function if exists public.queue_loyer_encaisse_notification(uuid, uuid);

commit;
