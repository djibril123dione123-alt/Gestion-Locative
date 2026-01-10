/*
  # Enable RLS on subscription_plans table

  1. Changes
    - Enable Row Level Security on subscription_plans table
    - Add policy to allow all authenticated users to view plans
    - Plans are read-only for regular users (only system/admin can modify)

  2. Security
    - All authenticated users can view available subscription plans
    - This is necessary for users to see plan options during signup and upgrades
*/

-- Enable RLS on subscription_plans
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view subscription plans
CREATE POLICY "Authenticated users can view subscription plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (true);

-- Only allow service role to modify plans (INSERT/UPDATE/DELETE not exposed to regular users)
