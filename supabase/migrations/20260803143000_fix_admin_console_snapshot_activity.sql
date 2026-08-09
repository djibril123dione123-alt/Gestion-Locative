-- Keep the consolidated owner snapshot compatible with the canonical agency
-- statistics view. Last activity is calculated by vw_owner_agency_stats and
-- is intentionally not duplicated on public.agencies.
do $migration$
declare
  function_definition text;
begin
  function_definition := pg_get_functiondef('public.admin_console_snapshot()'::regprocedure);

  if position('agency.derniere_activite' in function_definition) > 0 then
    execute replace(
      function_definition,
      'coalesce(stats.derniere_activite, agency.derniere_activite)',
      'stats.derniere_activite'
    );
  end if;
end
$migration$;
