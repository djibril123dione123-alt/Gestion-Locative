create or replace function public.fn_default_contract_caution()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.caution is null and new.loyer_mensuel is not null then
    new.caution := new.loyer_mensuel * 2;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_default_contract_caution on public.contrats;

create trigger trg_default_contract_caution
before insert or update of caution, loyer_mensuel on public.contrats
for each row
execute function public.fn_default_contract_caution();
