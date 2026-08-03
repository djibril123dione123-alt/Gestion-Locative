-- Express existence/locking queries as PERFORM so their intent is explicit and
-- the remote PL/pgSQL linter remains clean.

do $repair_command_lock_lint$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.admin_create_invitation(text,uuid,text,text,integer,text)'::regprocedure
  )
  into v_definition;

  v_definition := replace(v_definition, E'\r\n', E'\n');
  v_old := E'  v_existing_id uuid;\n';
  if position(v_old in v_definition) = 0 then
    raise exception 'Unexpected invitation declaration; refusing rewrite';
  end if;
  v_definition := replace(v_definition, v_old, '');

  v_old := E'  select id into v_existing_id\n    from public.invitations\n   where agency_id = p_agency_id\n     and lower(email) = lower(trim(p_email))\n     and status = ''pending''\n     and expires_at > now()\n   order by created_at desc\n   limit 1\n   for update;';
  v_new := E'  perform id\n    from public.invitations\n   where agency_id = p_agency_id\n     and lower(email) = lower(trim(p_email))\n     and status = ''pending''\n     and expires_at > now()\n   order by created_at desc\n   limit 1\n   for update;';
  if position(v_old in v_definition) = 0 then
    raise exception 'Unexpected invitation lock; refusing rewrite';
  end if;
  v_definition := replace(v_definition, v_old, v_new);
  v_definition := replace(
    v_definition,
    'Invitation crÃ©Ã©e depuis la console propriÃ©taire',
    'Invitation créée depuis la console propriétaire'
  );
  execute v_definition;

  select pg_get_functiondef(
    'public.fn_create_contrat_command(uuid,uuid,uuid,uuid,date,date,numeric,numeric,numeric,text,boolean)'::regprocedure
  )
  into v_definition;

  v_definition := replace(v_definition, E'\r\n', E'\n');
  v_old := E'  v_unite public.unites;\n';
  if position(v_old in v_definition) = 0 then
    raise exception 'Unexpected contract declaration; refusing rewrite';
  end if;
  v_definition := replace(v_definition, v_old, '');

  v_old := E'  select * into v_unite\n    from public.unites\n   where id = p_unite_id and agency_id = p_agency_id\n   for update;';
  v_new := E'  perform id\n    from public.unites\n   where id = p_unite_id and agency_id = p_agency_id\n   for update;';
  if position(v_old in v_definition) = 0 then
    raise exception 'Unexpected contract unit lock; refusing rewrite';
  end if;
  v_definition := replace(v_definition, v_old, v_new);
  execute v_definition;
end;
$repair_command_lock_lint$;
