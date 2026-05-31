-- Add nullable terms/privacy acceptance fields for new signups.
-- Existing accounts stay valid because every column is nullable.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS accepted_privacy_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS terms_version text NULL,
  ADD COLUMN IF NOT EXISTS privacy_version text NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    email,
    nom,
    prenom,
    role,
    agency_id,
    accepted_terms_at,
    accepted_privacy_at,
    terms_version,
    privacy_version
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'agent'),
    NULL,
    NULLIF(NEW.raw_user_meta_data->>'accepted_terms_at', '')::timestamptz,
    NULLIF(NEW.raw_user_meta_data->>'accepted_privacy_at', '')::timestamptz,
    NULLIF(NEW.raw_user_meta_data->>'terms_version', ''),
    NULLIF(NEW.raw_user_meta_data->>'privacy_version', '')
  )
  ON CONFLICT (id) DO UPDATE
    SET accepted_terms_at = COALESCE(EXCLUDED.accepted_terms_at, user_profiles.accepted_terms_at),
        accepted_privacy_at = COALESCE(EXCLUDED.accepted_privacy_at, user_profiles.accepted_privacy_at),
        terms_version = COALESCE(EXCLUDED.terms_version, user_profiles.terms_version),
        privacy_version = COALESCE(EXCLUDED.privacy_version, user_profiles.privacy_version);

  RETURN NEW;
END;
$$;
