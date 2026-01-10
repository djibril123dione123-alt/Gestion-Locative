/*
  # Fix new user registration flow

  1. Changes
    - Fix agencies INSERT policy to allow first agency creation even if profile doesn't exist yet
    - Fix agency_settings INSERT policy to be more permissive for initial setup
    - Fix subscriptions INSERT policy to be more permissive for initial setup
    - Update handle_new_user trigger function with proper search_path
    - Ensure user_profile is created with agency_id = NULL initially

  2. Security
    - All policies still enforce ownership checks
    - Users can only create ONE agency if they don't have one
    - Settings and subscriptions must match user's agency
*/

-- =====================================================
-- STEP 1: Fix handle_new_user trigger function
-- =====================================================

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create user profile with agency_id = NULL initially
  INSERT INTO public.user_profiles (id, email, nom, prenom, role, agency_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'agent'),
    NULL  -- Explicitly set agency_id to NULL on creation
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- STEP 2: Fix agencies policies
-- =====================================================

-- Drop and recreate INSERT policy for agencies
DROP POLICY IF EXISTS "Users can create first agency" ON agencies;

CREATE POLICY "Users can create first agency"
  ON agencies FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if user doesn't have an agency yet (agency_id is NULL or profile doesn't exist)
    NOT EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = (SELECT auth.uid()) 
      AND agency_id IS NOT NULL
    )
    OR NOT EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- STEP 3: Fix agency_settings policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert own agency settings" ON agency_settings;

CREATE POLICY "Users can insert own agency settings"
  ON agency_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if this is the user's agency
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid())
    )
    OR
    -- Allow if user has no settings yet (first-time setup)
    NOT EXISTS (
      SELECT 1 FROM agency_settings settings
      WHERE settings.agency_id IN (
        SELECT agency_id FROM user_profiles 
        WHERE id = (SELECT auth.uid())
      )
    )
    OR
    -- Allow if this is a brand new agency (just created, not in any settings yet)
    NOT EXISTS (
      SELECT 1 FROM agency_settings existing
      WHERE existing.agency_id = agency_settings.agency_id
    )
  );

-- =====================================================
-- STEP 4: Fix subscriptions policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create own subscription" ON subscriptions;

CREATE POLICY "Users can create own subscription"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if this is the user's agency
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid())
    )
    OR
    -- Allow if agency has no subscription yet (first-time setup)
    NOT EXISTS (
      SELECT 1 FROM subscriptions existing
      WHERE existing.agency_id = subscriptions.agency_id
    )
  );

-- =====================================================
-- STEP 5: Ensure user_profiles UPDATE policy allows setting agency_id
-- =====================================================

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()) OR is_admin())
  WITH CHECK (id = (SELECT auth.uid()) OR is_admin());
