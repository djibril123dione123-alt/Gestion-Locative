/*
  # Add INSERT policy for agencies table

  1. Changes
    - Add a policy allowing authenticated users to create their first agency
    - Users can only insert an agency if they don't already have one (agency_id is null in user_profiles)

  2. Security
    - Only authenticated users can create agencies
    - Users without an existing agency can create one
    - This enables the onboarding flow in the Welcome page
*/

-- Create policy allowing authenticated users to create their first agency
CREATE POLICY "Users can create first agency"
  ON agencies FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if user doesn't have an agency yet
    NOT EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND agency_id IS NOT NULL
    )
  );
