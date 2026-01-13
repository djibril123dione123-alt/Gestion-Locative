/*
  # Fix agencies INSERT RLS with explicit auth check

  1. Problem
    - Users get RLS error when trying to insert into agencies
    - Policy "TO authenticated" may not be applying correctly with anon key + JWT
    
  2. Solution
    - Change policy to use auth.uid() check instead of relying on role
    - This explicitly verifies the user has a valid JWT session
    
  3. Security
    - Only users with valid auth session can create agencies
    - auth.uid() returns NULL for unauthenticated requests
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Authenticated users can create agency" ON agencies;

-- Create policy with explicit auth check
CREATE POLICY "Users with valid session can create agency"
  ON agencies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
