/*
  # Fix overly permissive audit_logs policy

  1. Changes
    - Remove the permissive INSERT policy that allows all authenticated users
    - Audit logs should only be inserted by triggers and system functions
    - Users should not be able to manually insert audit logs
    - Keep SELECT policy for admins to view audit logs

  2. Security
    - Prevents users from tampering with audit logs
    - Only database triggers can insert audit logs
    - Admins can view audit logs for compliance and monitoring
*/

-- Remove the overly permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;

-- Audit logs are inserted by triggers only (via SECURITY DEFINER functions)
-- No explicit INSERT policy needed for regular users
