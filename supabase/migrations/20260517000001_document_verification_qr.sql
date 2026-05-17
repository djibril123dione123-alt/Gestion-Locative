-- Public document verification registry for QR codes.
-- The public page never reads this table directly; it calls the verify-document
-- Edge Function, which returns a sanitized response by token.

CREATE TABLE IF NOT EXISTS public.document_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE CHECK (length(token) >= 32),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  document_ref text NOT NULL,
  document_type text NOT NULL CHECK (
    document_type IN ('quittance', 'facture', 'contrat', 'mandat', 'rapport', 'export', 'document')
  ),
  agency_name text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  amount_xof numeric(14, 2),
  payment_status text,
  document_status text NOT NULL DEFAULT 'authentic' CHECK (
    document_status IN ('authentic', 'revoked', 'superseded')
  ),
  payload_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_verifications_token
  ON public.document_verifications(token);

CREATE INDEX IF NOT EXISTS idx_document_verifications_agency_created
  ON public.document_verifications(agency_id, created_at DESC);

ALTER TABLE public.document_verifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.document_verifications FROM anon;
GRANT SELECT, INSERT ON public.document_verifications TO authenticated;

DROP POLICY IF EXISTS "Agency users can insert document verifications" ON public.document_verifications;
CREATE POLICY "Agency users can insert document verifications"
  ON public.document_verifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id = (
      SELECT up.agency_id
      FROM public.user_profiles up
      WHERE up.id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Agency users can view document verifications" ON public.document_verifications;
CREATE POLICY "Agency users can view document verifications"
  ON public.document_verifications
  FOR SELECT
  TO authenticated
  USING (
    agency_id = (
      SELECT up.agency_id
      FROM public.user_profiles up
      WHERE up.id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = (SELECT auth.uid())
        AND up.role = 'super_admin'
    )
  );
