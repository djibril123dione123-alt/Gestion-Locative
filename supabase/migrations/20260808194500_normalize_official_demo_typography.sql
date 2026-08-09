-- Normalize the isolated official demo tenant after an earlier seed was applied
-- through a client that transcoded the diaeresis in one property name.
update public.immeubles
set nom = 'Immeuble Keur Yoff'
where agency_id = 'd3e00000-0000-4000-8000-000000000001'::uuid
  and nom like 'Immeuble K%r Yoff';

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.seed_official_demo_agency(text)'::regprocedure)
  into function_definition;

  function_definition := regexp_replace(
    function_definition,
    'Immeuble K[^'']*r Yoff',
    'Immeuble Keur Yoff',
    'g'
  );
  execute function_definition;
end;
$$;
