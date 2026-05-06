alter table public.paiements
  add column if not exists idempotency_key text;

alter table public.paiements
  drop constraint if exists paiements_contrat_mois_unique;

create unique index if not exists paiements_agency_idempotency_key_unique
  on public.paiements (agency_id, idempotency_key)
  where idempotency_key is not null and deleted_at is null;

create index if not exists idx_paiements_contrat_mois_active
  on public.paiements (contrat_id, mois_concerne)
  where deleted_at is null;
