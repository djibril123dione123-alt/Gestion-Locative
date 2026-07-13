-- Migration : Ajout des colonnes structurées type_piece et numero_piece sur locataires
ALTER TABLE locataires
  ADD COLUMN IF NOT EXISTS type_piece text,
  ADD COLUMN IF NOT EXISTS numero_piece text;
