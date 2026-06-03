-- Allow generated landlord reports to be registered in the public
-- document verification table. This keeps the historical `rapport`
-- type while adding the GED-compatible `rapport_bailleur` type.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'document_verifications'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%document_type%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.document_verifications DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.document_verifications
  ADD CONSTRAINT document_verifications_document_type_check
  CHECK (
    document_type IN (
      'quittance',
      'facture',
      'contrat',
      'mandat',
      'rapport',
      'rapport_bailleur',
      'export',
      'document'
    )
  );
