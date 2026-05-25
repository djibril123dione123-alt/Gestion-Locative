-- Phase 1 adaptabilite multi-profils
-- Garantit qu'un compte bailleur individuel dispose d'un proprietaire interne
-- utilisable par les relations metier sans exposer la page Bailleurs.

-- Les comptes bailleurs individuels ont une commission metier de 0%.
-- Une migration anterieure avait resserre la contrainte a commission > 0
-- pour eviter les oublis en mode agence ; ici on retablit [0, 100] pour
-- supporter explicitement le mode proprietaire sans commission.
alter table public.bailleurs drop constraint if exists check_commission_valide;
alter table public.bailleurs
  add constraint check_commission_valide
  check (commission is null or (commission >= 0 and commission <= 100));

alter table public.contrats drop constraint if exists check_commission_contrat_valide;
alter table public.contrats
  add constraint check_commission_contrat_valide
  check (commission is null or (commission >= 0 and commission <= 100));

alter table public.bailleurs
  add column if not exists is_account_owner boolean not null default false,
  add column if not exists account_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists idx_bailleurs_unique_account_owner
  on public.bailleurs (agency_id)
  where is_account_owner = true;

create or replace function public.current_user_is_individual_landlord_account()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_profiles up
    join public.agencies a on a.id = up.agency_id
    where up.id = auth.uid()
      and up.actif = true
      and coalesce(a.is_bailleur_account, false) = true
  );
$$;

grant execute on function public.current_user_is_individual_landlord_account() to authenticated;

create or replace function public.ensure_individual_landlord_owner_for_agency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name_parts text[];
  v_prenom text;
  v_nom text;
begin
  if coalesce(new.is_bailleur_account, false) is not true then
    return new;
  end if;

  if exists (
    select 1
    from public.bailleurs b
    where b.agency_id = new.id
      and b.is_account_owner = true
  ) then
    return new;
  end if;

  v_name_parts := regexp_split_to_array(trim(coalesce(new.name, '')), '\s+');
  v_prenom := coalesce(nullif(v_name_parts[1], ''), 'Proprietaire');
  v_nom := coalesce(nullif(array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' '), ''), 'Principal');

  insert into public.bailleurs (
    agency_id,
    is_account_owner,
    nom,
    prenom,
    telephone,
    email,
    adresse,
    commission,
    notes,
    actif
  )
  values (
    new.id,
    true,
    v_nom,
    v_prenom,
    coalesce(nullif(new.phone, ''), '000000000'),
    nullif(new.email, ''),
    nullif(new.address, ''),
    0,
    'Proprietaire principal du compte bailleur individuel.',
    true
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_ensure_individual_landlord_owner on public.agencies;
create trigger trg_ensure_individual_landlord_owner
after insert or update of is_bailleur_account, name, phone, email, address
on public.agencies
for each row
execute function public.ensure_individual_landlord_owner_for_agency();

with individual_agencies as (
  select a.id as agency_id, a.name, a.phone, a.email, a.address
  from public.agencies a
  where coalesce(a.is_bailleur_account, false) = true
),
owner_users as (
  select distinct on (up.agency_id)
    up.agency_id,
    up.id as user_id,
    up.nom,
    up.prenom,
    up.telephone,
    up.email
  from public.user_profiles up
  join individual_agencies ia on ia.agency_id = up.agency_id
  where up.actif = true
  order by up.agency_id, (up.role = 'admin') desc, up.created_at asc
)
insert into public.bailleurs (
  agency_id,
  created_by,
  account_user_id,
  is_account_owner,
  nom,
  prenom,
  telephone,
  email,
  adresse,
  commission,
  notes,
  actif
)
select
  ia.agency_id,
  ou.user_id,
  ou.user_id,
  true,
  coalesce(nullif(ou.nom, ''), nullif(split_part(ia.name, ' ', 2), ''), 'Principal'),
  coalesce(nullif(ou.prenom, ''), nullif(split_part(ia.name, ' ', 1), ''), 'Proprietaire'),
  coalesce(nullif(ou.telephone, ''), nullif(ia.phone, ''), '000000000'),
  coalesce(nullif(ou.email, ''), nullif(ia.email, '')),
  nullif(ia.address, ''),
  0,
  'Proprietaire principal du compte bailleur individuel.',
  true
from individual_agencies ia
left join owner_users ou on ou.agency_id = ia.agency_id
where not exists (
  select 1
  from public.bailleurs b
  where b.agency_id = ia.agency_id
    and b.actif = true
);

with ranked as (
  select
    b.id,
    b.agency_id,
    ou.user_id,
    row_number() over (
      partition by b.agency_id
      order by b.is_account_owner desc, b.created_at asc
    ) as rn
  from public.bailleurs b
  join public.agencies a on a.id = b.agency_id
  left join (
    select distinct on (agency_id)
      agency_id,
      id as user_id
    from public.user_profiles
    where actif = true
    order by agency_id, (role = 'admin') desc, created_at asc
  ) ou on ou.agency_id = b.agency_id
  where coalesce(a.is_bailleur_account, false) = true
    and b.actif = true
)
update public.bailleurs b
set
  is_account_owner = true,
  account_user_id = coalesce(b.account_user_id, ranked.user_id),
  commission = 0
from ranked
where ranked.id = b.id
  and ranked.rn = 1;

update public.user_profiles up
set role = 'admin'::public.user_role
where up.role = 'bailleur'::public.user_role
  and exists (
    select 1
    from public.agencies a
    where a.id = up.agency_id
      and coalesce(a.is_bailleur_account, false) = true
  );

drop policy if exists bailleurs_tenant_insert on public.bailleurs;
create policy bailleurs_tenant_insert
on public.bailleurs
for insert
to authenticated
with check (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
);

drop policy if exists bailleurs_tenant_update on public.bailleurs;
create policy bailleurs_tenant_update
on public.bailleurs
for update
to authenticated
using (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
)
with check (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
);

drop policy if exists immeubles_tenant_insert on public.immeubles;
create policy immeubles_tenant_insert
on public.immeubles
for insert
to authenticated
with check (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
);

drop policy if exists immeubles_tenant_update on public.immeubles;
create policy immeubles_tenant_update
on public.immeubles
for update
to authenticated
using (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
)
with check (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
);

drop policy if exists unites_tenant_insert on public.unites;
create policy unites_tenant_insert
on public.unites
for insert
to authenticated
with check (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
);

drop policy if exists unites_tenant_update on public.unites;
create policy unites_tenant_update
on public.unites
for update
to authenticated
using (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
)
with check (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
);

drop policy if exists locataires_tenant_insert on public.locataires;
create policy locataires_tenant_insert
on public.locataires
for insert
to authenticated
with check (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
);

drop policy if exists locataires_tenant_update on public.locataires;
create policy locataires_tenant_update
on public.locataires
for update
to authenticated
using (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
)
with check (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
);

drop policy if exists contrats_tenant_insert on public.contrats;
create policy contrats_tenant_insert
on public.contrats
for insert
to authenticated
with check (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
);

drop policy if exists contrats_tenant_update on public.contrats;
create policy contrats_tenant_update
on public.contrats
for update
to authenticated
using (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
)
with check (
  agency_id = public.current_user_agency_id()
  and (public.is_agent_or_admin() or public.current_user_is_individual_landlord_account())
);
