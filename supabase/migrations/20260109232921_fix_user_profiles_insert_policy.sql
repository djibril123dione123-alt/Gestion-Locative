/*
  # Fix user_profiles INSERT policy
  
  1. Changes
    - Drop the overly restrictive INSERT policy
    - Create a new policy allowing users to create their own profile during signup
    - Allow admins to create any profile
  
  2. Security
    - Users can only insert their own profile (id = auth.uid())
    - Admins can insert any profile using is_admin() function
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Admins can insert user profiles" ON user_profiles;

-- Create new policy allowing users to create their own profile
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() OR is_admin());
