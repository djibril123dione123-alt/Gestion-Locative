-- Correctif de 20260821000000_neutral_legal_mentions_defaults.sql.
--
-- Le WHERE de la migration précédente pour mention_penalites/mention_litige
-- a été transcrit avec de légers écarts par rapport au texte réellement
-- stocké en base (une virgule en trop pour mention_penalites, une clause
-- manquante pour mention_litige), ce qui a fait matcher zéro ligne pour ces
-- deux colonnes lors de l'application initiale. Vérifié en relisant les
-- valeurs réelles après application, puis corrigé ici avec le texte exact.
--
-- Ne pas éditer 20260821000000 après coup : par principe, une migration déjà
-- appliquée n'est jamais réécrite, on ajoute la correction dans un nouveau
-- fichier -- pour que l'historique local reste identique à l'historique
-- réellement appliqué en base (supabase_migrations.schema_migrations).

UPDATE agency_settings
SET mention_penalites = ''
WHERE mention_penalites = 'Il est expressément convenu qu''à défaut de paiement d''un mois de loyer dans les délais impartis (au plus tard le 07 du mois en cours) des pénalités seront appliquées. Passé ce délai, la procédure judiciaire sera enclenchée.';

UPDATE agency_settings
SET mention_litige = ''
WHERE mention_litige = 'Il est expressément convenu qu''en cas de litige, les frais d''huissier, d''expertises et d''honoraires d''avocat, qui auraient été engagés par le bailleur et ce sur pièces justificatives, seront remboursés par le locataire.';
