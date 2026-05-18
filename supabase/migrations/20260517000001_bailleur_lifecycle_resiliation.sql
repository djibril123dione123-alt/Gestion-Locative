-- Lifecycle bailleur : resiliation, suspension and archival metadata.
-- Idempotent migration for existing beta databases.

ALTER TABLE public.bailleurs
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'actif',
  ADD COLUMN IF NOT EXISTS resiliation_date date,
  ADD COLUMN IF NOT EXISTS resiliation_motif text,
  ADD COLUMN IF NOT EXISTS resiliation_observations text,
  ADD COLUMN IF NOT EXISTS resiliation_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS lifecycle_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bailleurs_statut_check'
      AND conrelid = 'public.bailleurs'::regclass
  ) THEN
    ALTER TABLE public.bailleurs
      ADD CONSTRAINT bailleurs_statut_check
      CHECK (statut IN ('actif', 'resilie', 'suspendu', 'archive', 'cloture'));
  END IF;
END $$;

UPDATE public.bailleurs
SET statut = CASE WHEN actif IS FALSE THEN 'archive' ELSE COALESCE(NULLIF(statut, ''), 'actif') END
WHERE statut IS NULL OR statut = '' OR actif IS FALSE;

CREATE INDEX IF NOT EXISTS idx_bailleurs_agency_statut
  ON public.bailleurs(agency_id, statut)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bailleurs_resiliation_date
  ON public.bailleurs(agency_id, resiliation_date)
  WHERE resiliation_date IS NOT NULL;
