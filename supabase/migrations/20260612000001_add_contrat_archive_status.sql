-- Occupants & Baux - lifecycle contrats
-- Ajoute le statut terminal "archive" aux contrats existants sans modifier les RLS.

alter type public.contrat_statut add value if not exists 'archive';
