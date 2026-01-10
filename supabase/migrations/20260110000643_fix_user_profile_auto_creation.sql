/*
  # Fix user profile auto-creation

  1. Changes
    - Create a trigger function that automatically creates a user_profile when a new auth.user is created
    - This ensures every new user has a profile, even if the INSERT from the client fails
    - Make nom and prenom columns nullable temporarily for auto-created profiles

  2. Security
    - Trigger runs with SECURITY DEFINER to bypass RLS
    - Only creates profile if one doesn't already exist
*/

-- Make nom and prenom nullable to allow auto-creation
ALTER TABLE user_profiles ALTER COLUMN nom DROP NOT NULL;
ALTER TABLE user_profiles ALTER COLUMN prenom DROP NOT NULL;

-- Create function to auto-create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, nom, prenom, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'agent')::user_role
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Also update the INSERT policy to be more permissive during initial setup
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid() 
    OR is_admin()
  );

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Admins can update user profiles" ON user_profiles;

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());
