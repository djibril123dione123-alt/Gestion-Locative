-- P0-1 : neutraliser les mentions légales par défaut de agency_settings.
--
-- Ces quatre colonnes ont été créées (migration 20260206205713) avec des
-- DEFAULT affirmant une attribution automatique de juridiction ("juge des
-- référés du Tribunal de Dakar" / "Tribunal de commerce de Dakar" selon le
-- document), une procédure judiciaire présentée comme automatique, et une
-- saisie automatique sur caution "conformément à la loi sénégalaise" --
-- sans base juridique vérifiée. Comme le trigger de création d'agence ne
-- surcharge pas ces colonnes, ce DEFAULT devenait le texte réellement
-- imprimé sur chaque contrat/mandat généré par toute agence n'ayant jamais
-- ouvert ses Paramètres.
--
-- Cette migration :
--   1. change le DEFAULT pour les nouvelles lignes (texte neutre pour
--      mention_tribunal, chaîne vide pour les trois autres -- le texte
--      environnant des templates couvre déjà le fond, ne pas dupliquer une
--      affirmation financière/juridique par défaut) ;
--   2. corrige rétroactivement UNIQUEMENT les lignes qui contiennent encore
--      exactement l'ancien texte par défaut (comparaison stricte) -- une
--      agence ayant personnalisé sa propre mention n'est jamais touchée.
--
-- Portée : configuration courante de l'agence (agency_settings), jamais les
-- documents déjà émis -- ceux-ci restent liés à leur révision de template
-- figée (document_template_revisions / checksum), donc non affectés.

-- 1. Nouveau DEFAULT pour les futures lignes / futures agences.
ALTER TABLE agency_settings
  ALTER COLUMN mention_tribunal SET DEFAULT
    'En cas de litige, les parties s''en remettent aux juridictions compétentes déterminées par la réglementation applicable.';

ALTER TABLE agency_settings
  ALTER COLUMN mention_penalites SET DEFAULT '';

ALTER TABLE agency_settings
  ALTER COLUMN mention_frais_huissier SET DEFAULT '';

ALTER TABLE agency_settings
  ALTER COLUMN mention_litige SET DEFAULT '';

-- 2. Backfill strictement scopé aux lignes jamais personnalisées.
UPDATE agency_settings
SET mention_tribunal = 'En cas de litige, les parties s''en remettent aux juridictions compétentes déterminées par la réglementation applicable.'
WHERE mention_tribunal IN (
  'Avec attribution exclusive de juridiction au juge des référés du Tribunal de Dakar.',
  'En cas de litige, le Tribunal de commerce de Dakar est seul compétent.'
);

UPDATE agency_settings
SET mention_penalites = ''
WHERE mention_penalites = 'Il est expressément convenu qu''à défaut de paiement d''un mois de loyer dans les délais impartis (au plus tard le 07 du mois en cours), des pénalités seront appliquées. Passé ce délai, la procédure judiciaire sera enclenchée.';

UPDATE agency_settings
SET mention_frais_huissier = ''
WHERE mention_frais_huissier = 'En cas de non-paiement du loyer dans les délais impartis, une somme est prélevée sur la caution pour les frais d''huissier afin d''assignation en expulsion, conformément à la loi sénégalaise.';

UPDATE agency_settings
SET mention_litige = ''
WHERE mention_litige = 'Il est expressément convenu qu''en cas de litige, les frais d''huissier, d''expertises et d''honoraires d''avocat engagés par le bailleur sur pièces justificatives seront remboursés par le locataire.';
