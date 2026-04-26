/*
  # Fix agencies INSERT policy with TO authenticated

  1. Problem
    - The current policy has role "public" instead of "authenticated"
    - When users authenticate with Supabase client (ANON_KEY + JWT), they have role "authenticated"
    - The policy needs TO authenticated to work with authenticated users
    
  2. Solution
    - Drop existing INSERT policy
    - Create new policy with TO authenticated explicitly
    - Keep auth.uid() IS NOT NULL check for extra safety
    
  3. Security
    - Only authenticated users with valid JWT can insert
    - auth.uid() IS NOT NULL ensures the user has a valid session
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Users with valid session can create agency" ON agencies;

-- Create policy with TO authenticated
CREATE POLICY "Authenticated users can create agency"
  ON agencies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
