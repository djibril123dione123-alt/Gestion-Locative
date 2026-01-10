/*
  # Remove duplicate RLS policies

  1. Changes
    - Remove old duplicate policies that were replaced in previous migrations
    - Eliminates conflicts between multiple permissive policies
    - Ensures only one clear policy per action

  2. Policies removed
    - agency_settings: "Authenticated users can view agency settings"
    - agency_settings: "Admins can update agency settings"
*/

-- Remove duplicate agency_settings policies
DROP POLICY IF EXISTS "Authenticated users can view agency settings" ON agency_settings;
DROP POLICY IF EXISTS "Admins can update agency settings" ON agency_settings;
