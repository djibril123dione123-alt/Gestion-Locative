-- Occupants & Baux - lifecycle contrats
-- Ajoute le statut terminal "archive" aux contrats existants sans modifier les RLS.

do $$
begin
  if exists (
    select 1
    from pg_type
    where typname = 'contrat_statut'
  ) then
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'contrat_statut'
        and e.enumlabel = 'archive'
    ) then
      alter type public.contrat_statut add value 'archive';
    end if;
  end if;
end $$;
