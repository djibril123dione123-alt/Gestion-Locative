/*
  # Fix vue vw_owner_agency_stats
  La colonne réelle dans `paiements` est `montant_total`, pas `montant`.
  Cette vue est rejouée pour refléter la bonne colonne.
*/

CREATE OR REPLACE VIEW vw_owner_agency_stats AS
SELECT
  a.id,
  a.name,
  a.status,
  a.plan,
  a.trial_ends_at,
  a.created_at,
  COUNT(DISTINCT up.id)                                              AS nb_users,
  COUNT(DISTINCT b.id)                                               AS nb_bailleurs,
  COUNT(DISTINCT i.id)                                               AS nb_immeubles,
  COUNT(DISTINCT u.id)                                               AS nb_unites,
  COUNT(DISTINCT c.id)                                               AS nb_contrats,
  COUNT(DISTINCT p.id)                                               AS nb_paiements,
  COALESCE(SUM(p.montant_total) FILTER (WHERE p.statut = 'paye'), 0) AS volume_paiements,
  MAX(up.updated_at)                                                 AS derniere_activite
FROM agencies a
LEFT JOIN user_profiles up  ON up.agency_id = a.id
LEFT JOIN bailleurs b        ON b.agency_id  = a.id
LEFT JOIN immeubles i        ON i.agency_id  = a.id
LEFT JOIN unites u           ON u.agency_id  = a.id
LEFT JOIN contrats c         ON c.agency_id  = a.id
LEFT JOIN paiements p        ON p.agency_id  = a.id
GROUP BY a.id, a.name, a.status, a.plan, a.trial_ends_at, a.created_at;

REVOKE ALL ON vw_owner_agency_stats FROM PUBLIC;
GRANT SELECT ON vw_owner_agency_stats TO authenticated;
