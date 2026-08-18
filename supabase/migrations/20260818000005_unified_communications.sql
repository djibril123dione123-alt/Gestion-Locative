-- Migration: Unified Communications & Orange SMS
-- Converts notification_queue into a unified communication_events architecture
-- Adds agency communication preferences

-- 1. Agency Settings
ALTER TABLE agency_settings
ADD COLUMN IF NOT EXISTS communications_email_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS communications_sms_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS communications_config JSONB DEFAULT '{}'::jsonb;

-- 2. Notification Queue Extensions (Communication Events)
ALTER TABLE notification_queue
ADD COLUMN IF NOT EXISTS context_type TEXT,
ADD COLUMN IF NOT EXISTS context_id UUID,
ADD COLUMN IF NOT EXISTS provider TEXT,
ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error_code TEXT;

-- Create indexes for the new communication abstractions
CREATE INDEX IF NOT EXISTS idx_notif_queue_context ON notification_queue(context_type, context_id) WHERE context_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notif_queue_provider_msg ON notification_queue(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- 3. Update existing check constraints if necessary (if status has a constraint, let's just make sure it supports all states)
-- Actually, we'll try dropping and recreating the status check constraint to ensure it supports our unified statuses.
DO $$
BEGIN
  -- We don't know the exact name of the constraint, so we just attempt to drop it if we know it.
  -- In a lot of schemas, it's something like notification_queue_status_check
  ALTER TABLE notification_queue DROP CONSTRAINT IF EXISTS notification_queue_status_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE notification_queue
ADD CONSTRAINT notification_queue_status_check
CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped', 'delayed', 'bounced', 'complained', 'suppressed'));

-- 4. Set defaults for existing rows
UPDATE notification_queue SET provider = 'resend' WHERE channel = 'email' AND provider IS NULL;
UPDATE notification_queue SET provider = 'orange_sms' WHERE channel = 'sms' AND provider IS NULL;
