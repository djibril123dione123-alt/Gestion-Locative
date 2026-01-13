/*
  # Fix agencies INSERT RLS policy

  1. Problem
    - Users get "new row violates row-level security policy for table agencies" error
    - Despite having a policy "Authenticated users can insert agency" with WITH CHECK (true)
    - The issue is that WITH CHECK (true) should work but appears not to be applied correctly

  2. Solution
    - Drop ALL existing INSERT policies on agencies
    - Create a fresh, explicit INSERT policy for authenticated users
    - Ensure the policy is properly permissive

  3. Security
    - Only authenticated users can create agencies
    - This is safe as the application layer controls agency creation flow
    - User profiles are linked to agencies after creation
*/

-- Drop all existing INSERT policies on agencies
DROP POLICY IF EXISTS "Authenticated users can insert agency" ON agencies;
DROP POLICY IF EXISTS "Users can create first agency" ON agencies;
DROP POLICY IF EXISTS "Users can create their first agency" ON agencies;

-- Create a fresh INSERT policy that explicitly allows authenticated users
CREATE POLICY "Authenticated users can create agency"
  ON agencies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Verify RLS is enabled (should already be, but just in case)
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
