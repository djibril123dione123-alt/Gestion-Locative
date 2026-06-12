-- Occupants & Baux - coherence occupation unite
-- Une unite ne peut avoir qu'un seul bail actif.

create unique index if not exists idx_contrats_unite_actif_unique
  on public.contrats (unite_id)
  where (statut = 'actif');
