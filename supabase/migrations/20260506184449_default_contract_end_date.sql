create or replace function public.fn_default_contract_end_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.date_fin is null and new.date_debut is not null then
    new.date_fin := (new.date_debut + interval '2 years')::date;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_default_contract_end_date on public.contrats;

create trigger trg_default_contract_end_date
before insert or update of date_debut, date_fin on public.contrats
for each row
execute function public.fn_default_contract_end_date();
