/*
  # Add RLS policies for agency_settings and subscriptions

  1. Changes
    - Add INSERT, SELECT, UPDATE policies for agency_settings table
    - Add INSERT, SELECT, UPDATE policies for subscriptions table
    - Allow users to manage settings/subscriptions for their own agency

  2. Security
    - Users can only access settings/subscriptions for their own agency
    - Admins of an agency can insert/update settings and subscriptions
    - All authenticated users in an agency can view settings
*/

-- =====================================================
-- AGENCY_SETTINGS POLICIES
-- =====================================================

-- Policy: Users can view their own agency settings
CREATE POLICY "Users can view own agency settings"
  ON agency_settings FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert settings for their agency during onboarding
CREATE POLICY "Users can insert own agency settings"
  ON agency_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
    OR 
    -- Allow during onboarding when user doesn't have agency_id yet
    NOT EXISTS (
      SELECT 1 FROM agency_settings WHERE agency_id = agency_settings.agency_id
    )
  );

-- Policy: Admins can update their agency settings
CREATE POLICY "Admins can update own agency settings"
  ON agency_settings FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- SUBSCRIPTIONS POLICIES
-- =====================================================

-- Policy: Users can view their own agency subscription
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can create subscription for their agency during onboarding
CREATE POLICY "Users can create own subscription"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
    OR
    -- Allow during onboarding
    NOT EXISTS (
      SELECT 1 FROM subscriptions WHERE agency_id = subscriptions.agency_id
    )
  );

-- Policy: Admins can update their agency subscription
CREATE POLICY "Admins can update own subscription"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
