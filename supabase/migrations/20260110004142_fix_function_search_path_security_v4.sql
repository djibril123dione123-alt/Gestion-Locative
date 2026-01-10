/*
  # Fix function search_path security issues

  1. Changes
    - Alter all functions to set explicit search_path
    - Protects against schema injection attacks
    - Uses 'SET search_path = public, pg_temp' for all functions

  2. Functions affected
    - cleanup_expired_invitations
    - check_plan_limits
    - log_table_changes
    - update_updated_at_column
    - get_user_role
    - is_admin
    - is_agent_or_admin
    - get_user_bailleur_id
    - create_admin_profile
    - create_agent_profile
    - create_notification
*/

-- Alter functions to set search_path with correct signatures
ALTER FUNCTION update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION log_table_changes() SET search_path = public, pg_temp;
ALTER FUNCTION get_user_role() SET search_path = public, pg_temp;
ALTER FUNCTION is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION is_agent_or_admin() SET search_path = public, pg_temp;
ALTER FUNCTION get_user_bailleur_id() SET search_path = public, pg_temp;
ALTER FUNCTION create_admin_profile(uuid, text, text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION create_agent_profile(uuid, text, text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION create_notification(uuid, uuid, text, text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION cleanup_expired_invitations() SET search_path = public, pg_temp;
ALTER FUNCTION check_plan_limits(uuid) SET search_path = public, pg_temp;
