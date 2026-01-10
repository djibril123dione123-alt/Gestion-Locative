/*
  # Optimize RLS policies for better performance

  1. Changes
    - Replace auth.uid() with (SELECT auth.uid()) in all RLS policies
    - This prevents re-evaluation of auth.uid() for each row
    - Significantly improves query performance at scale

  2. Tables affected
    - user_profiles
    - agencies
    - invitations
    - notifications
    - documents
    - inventaires
    - interventions
    - evenements
    - subscriptions
    - agency_settings
*/

-- =====================================================
-- USER_PROFILES POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

-- =====================================================
-- AGENCIES POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own agency" ON agencies;
CREATE POLICY "Users can view own agency"
  ON agencies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT agency_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can update own agency" ON agencies;
CREATE POLICY "Admins can update own agency"
  ON agencies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    id IN (
      SELECT agency_id FROM user_profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can create first agency" ON agencies;
CREATE POLICY "Users can create first agency"
  ON agencies FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = (SELECT auth.uid()) 
      AND agency_id IS NOT NULL
    )
  );

-- =====================================================
-- INVITATIONS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Admins can view agency invitations" ON invitations;
CREATE POLICY "Admins can view agency invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can create invitations" ON invitations;
CREATE POLICY "Admins can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- =====================================================
-- NOTIFICATIONS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- =====================================================
-- DOCUMENTS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view agency documents" ON documents;
CREATE POLICY "Users can view agency documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins and agents can create documents" ON documents;
CREATE POLICY "Admins and agents can create documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'agent')
    )
  );

DROP POLICY IF EXISTS "Admins and agents can update documents" ON documents;
CREATE POLICY "Admins and agents can update documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'agent')
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'agent')
    )
  );

DROP POLICY IF EXISTS "Admins can delete documents" ON documents;
CREATE POLICY "Admins can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- =====================================================
-- INVENTAIRES POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view agency inventaires" ON inventaires;
CREATE POLICY "Users can view agency inventaires"
  ON inventaires FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins and agents can create inventaires" ON inventaires;
CREATE POLICY "Admins and agents can create inventaires"
  ON inventaires FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'agent')
    )
  );

DROP POLICY IF EXISTS "Admins and agents can update inventaires" ON inventaires;
CREATE POLICY "Admins and agents can update inventaires"
  ON inventaires FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'agent')
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'agent')
    )
  );

-- =====================================================
-- INTERVENTIONS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view agency interventions" ON interventions;
CREATE POLICY "Users can view agency interventions"
  ON interventions FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins and agents can create interventions" ON interventions;
CREATE POLICY "Admins and agents can create interventions"
  ON interventions FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'agent')
    )
  );

DROP POLICY IF EXISTS "Admins and agents can update interventions" ON interventions;
CREATE POLICY "Admins and agents can update interventions"
  ON interventions FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'agent')
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'agent')
    )
  );

-- =====================================================
-- EVENEMENTS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view agency evenements" ON evenements;
CREATE POLICY "Users can view agency evenements"
  ON evenements FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins and agents can create evenements" ON evenements;
CREATE POLICY "Admins and agents can create evenements"
  ON evenements FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'agent')
    )
  );

DROP POLICY IF EXISTS "Admins and agents can update evenements" ON evenements;
CREATE POLICY "Admins and agents can update evenements"
  ON evenements FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'agent')
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'agent')
    )
  );

DROP POLICY IF EXISTS "Admins and agents can delete evenements" ON evenements;
CREATE POLICY "Admins and agents can delete evenements"
  ON evenements FOR DELETE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'agent')
    )
  );

-- =====================================================
-- AGENCY_SETTINGS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own agency settings" ON agency_settings;
CREATE POLICY "Users can view own agency settings"
  ON agency_settings FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own agency settings" ON agency_settings;
CREATE POLICY "Users can insert own agency settings"
  ON agency_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    OR 
    NOT EXISTS (
      SELECT 1 FROM agency_settings WHERE agency_id = agency_settings.agency_id
    )
  );

DROP POLICY IF EXISTS "Admins can update own agency settings" ON agency_settings;
CREATE POLICY "Admins can update own agency settings"
  ON agency_settings FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- =====================================================
-- SUBSCRIPTIONS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Admins can view own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create own subscription" ON subscriptions;
CREATE POLICY "Users can create own subscription"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    OR
    NOT EXISTS (
      SELECT 1 FROM subscriptions WHERE agency_id = subscriptions.agency_id
    )
  );

DROP POLICY IF EXISTS "Admins can update own subscription" ON subscriptions;
CREATE POLICY "Admins can update own subscription"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );
