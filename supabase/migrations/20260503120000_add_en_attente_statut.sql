/*
  Migration : Ajout de 'en_attente' à l'enum paiement_statut
  
  Contexte :
    - L'Edge Function create-paiement accepte 'en_attente' (paiement PayDunya initié)
    - Le frontend expose ce statut dans les formulaires et filtres
    - Mais l'ENUM DB ne le contenait pas → crash à l'INSERT
  
  Fix : ALTER TYPE … ADD VALUE (idempotent via DO $$ IF NOT EXISTS $$)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'en_attente'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'paiement_statut'
      )
  ) THEN
    ALTER TYPE paiement_statut ADD VALUE 'en_attente';
  END IF;
END $$;
