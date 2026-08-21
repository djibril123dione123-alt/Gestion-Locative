-- Second correctif de 20260821000000_neutral_legal_mentions_defaults.sql.
--
-- La chaîne vide retenue comme neutre pour mention_penalites/
-- mention_frais_huissier/mention_litige casse en réalité la génération de
-- documents : templateEngine.ts (resolveTemplateText) traite toute valeur
-- vide/blanche comme une variable requise manquante et lève
-- VARIABLE_REQUIRED -- découvert en générant réellement un contrat et un
-- mandat de test avant de déclarer P0-1 terminé (voir
-- pdf.legalWording.test.ts). Remplacé par un texte neutre non vide, déjà
-- établi ailleurs dans le code (catalogue de variables du Studio,
-- src/lib/templates/helpers.ts) plutôt qu'une nouvelle affirmation inventée.
--
-- Comme pour le premier correctif : nouveau fichier, jamais de réécriture
-- d'une migration déjà appliquée.

ALTER TABLE agency_settings
  ALTER COLUMN mention_penalites SET DEFAULT 'Les pénalités prévues au bail restent applicables.';

ALTER TABLE agency_settings
  ALTER COLUMN mention_frais_huissier SET DEFAULT 'Les frais justifiés restent à la charge de la partie défaillante.';

ALTER TABLE agency_settings
  ALTER COLUMN mention_litige SET DEFAULT 'Les parties privilégient une résolution amiable.';

UPDATE agency_settings
SET mention_penalites = 'Les pénalités prévues au bail restent applicables.'
WHERE mention_penalites = '';

UPDATE agency_settings
SET mention_frais_huissier = 'Les frais justifiés restent à la charge de la partie défaillante.'
WHERE mention_frais_huissier = '';

UPDATE agency_settings
SET mention_litige = 'Les parties privilégient une résolution amiable.'
WHERE mention_litige = '';
