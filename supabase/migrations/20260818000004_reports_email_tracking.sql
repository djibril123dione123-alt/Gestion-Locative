-- Migration: 20260818000004_reports_email_tracking.sql
-- Purpose: Add settings for landlord reports and enhance notification queue tracking

-- 1. Update landlord_report_settings
ALTER TABLE landlord_report_settings
ADD COLUMN IF NOT EXISTS send_time TIME DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Dakar';

-- 2. Update notification_queue statuses
ALTER TABLE notification_queue DROP CONSTRAINT IF EXISTS notification_queue_status_check;
ALTER TABLE notification_queue ADD CONSTRAINT notification_queue_status_check 
CHECK (status IN (
  'pending', 
  'queued', 
  'sent', 
  'delivered', 
  'failed', 
  'skipped',
  'delayed',
  'bounced',
  'complained',
  'suppressed'
));

-- 3. Add idempotency key to notification_queue
ALTER TABLE notification_queue
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Create unique index for idempotency_key (only if it is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_queue_idempotency 
ON notification_queue(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 4. Update document_registry for secure sharing
ALTER TABLE document_registry
ADD COLUMN IF NOT EXISTS secure_token UUID UNIQUE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Create a SECURITY DEFINER function to fetch a document by its secure_token safely
CREATE OR REPLACE FUNCTION get_document_by_secure_token(p_token UUID)
RETURNS SETOF document_registry
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM document_registry
  WHERE secure_token = p_token
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
END;
$$;
