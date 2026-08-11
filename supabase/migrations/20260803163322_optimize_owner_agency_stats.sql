-- Aggregate each business source independently before joining agencies.
-- This avoids the cartesian multiplication produced by joining every source
-- table together and keeps payment volumes exact as data grows.
create or replace view public.vw_owner_agency_stats
with (security_invoker = true)
as
with user_stats as (
  select
    agency_id,
    count(*) as nb_users,
    max(updated_at) as derniere_activite
  from public.user_profiles
  group by agency_id
),
bailleur_stats as (
  select agency_id, count(*) as nb_bailleurs
  from public.bailleurs
  group by agency_id
),
immeuble_stats as (
  select agency_id, count(*) as nb_immeubles
  from public.immeubles
  group by agency_id
),
unite_stats as (
  select agency_id, count(*) as nb_unites
  from public.unites
  group by agency_id
),
contrat_stats as (
  select agency_id, count(*) as nb_contrats
  from public.contrats
  group by agency_id
),
paiement_stats as (
  select
    agency_id,
    count(*) as nb_paiements,
    coalesce(sum(montant_total) filter (where statut = 'paye'), 0) as volume_paiements
  from public.paiements
  group by agency_id
)
select
  agency.id,
  agency.name,
  agency.status,
  agency.plan,
  agency.trial_ends_at,
  agency.created_at,
  coalesce(users.nb_users, 0) as nb_users,
  coalesce(bailleurs.nb_bailleurs, 0) as nb_bailleurs,
  coalesce(immeubles.nb_immeubles, 0) as nb_immeubles,
  coalesce(unites.nb_unites, 0) as nb_unites,
  coalesce(contrats.nb_contrats, 0) as nb_contrats,
  coalesce(paiements.nb_paiements, 0) as nb_paiements,
  coalesce(paiements.volume_paiements, 0) as volume_paiements,
  users.derniere_activite
from public.agencies agency
left join user_stats users on users.agency_id = agency.id
left join bailleur_stats bailleurs on bailleurs.agency_id = agency.id
left join immeuble_stats immeubles on immeubles.agency_id = agency.id
left join unite_stats unites on unites.agency_id = agency.id
left join contrat_stats contrats on contrats.agency_id = agency.id
left join paiement_stats paiements on paiements.agency_id = agency.id;

revoke all on public.vw_owner_agency_stats from public;
grant select on public.vw_owner_agency_stats to authenticated;;
